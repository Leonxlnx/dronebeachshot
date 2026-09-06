import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {createTerrain} from '../../src/world/terrain.ts';
import {createLandscapeSampler} from '../../src/world/landscape-sampler.ts';
import {createDistantForest} from '../../src/world/distant-forest.ts';
import {createDistantForestLayout,distantForestHabitat} from '../../src/world/distant-forest-layout.ts';
import {treeImpostorDefinitions} from '../../src/world/tree-impostor-data.ts';
import {rng,noise,smooth} from '../../src/world/math.ts';

const sourceHeights=treeImpostorDefinitions.map(d=>d.bounds.max[1]);
const sha=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const mean=values=>values.reduce((sum,v)=>sum+v,0)/values.length;
const quantile=(values,q)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*q)];
const flat=()=>({height:120,slope:0});
const flatLayout=createDistantForestLayout(flat,sourceHeights);
assert.equal(sha(flatLayout),sha(createDistantForestLayout(flat,sourceHeights)),'layout is not repeatable');
assert.throws(()=>createDistantForestLayout(flat,[0,14]),RangeError);
assert.equal(createDistantForestLayout(()=>null,sourceHeights).trees.length,0,'missing terrain admitted roots');
assert.equal(createDistantForestLayout(()=>({height:120,slope:2.6}),sourceHeights).trees.length,0,'bare cliffs admitted roots');
assert.equal(createDistantForestLayout(()=>({height:3,slope:0}),sourceHeights).trees.length,0,'beach admitted roots');

// A local hole must affect only its support neighbourhood. This catches a
// conditional RNG stream shifting all subsequent tree locations and species.
const hole=(x,z)=>Math.hypot(x-1900,z-900)<80?null:flat();
const unmodified=trees=>trees.filter(p=>Math.hypot(p.x-1900,p.z-900)>150);
assert.equal(sha(unmodified(flatLayout.trees)),sha(unmodified(createDistantForestLayout(hole,sourceHeights).trees)),
 'local terrain edit perturbs unrelated stands');

// Compare actual populations on uniform suitable ground, independently of the
// habitat's internal formula. Adjacent 112 m plots should vary less than plots
// separated by 896 m; occupancy and species cohorts must have visible ranges.
const counts=new Map(),species=new Map();
for(const p of flatLayout.trees){
 if(p.x<1008||p.x>=3024||p.z<-1680||p.z>=1680)continue;
 const x=Math.floor((p.x-1008)/112),z=Math.floor((p.z+1680)/112),key=x+','+z;
 counts.set(key,(counts.get(key)??0)+1);
 const region=Math.floor(p.x/448)+','+Math.floor(p.z/448);
 const cohort=species.get(region)??[0,0];cohort[p.family]++;species.set(region,cohort);
}
const near=[],far=[],plotCounts=[];
for(let z=0;z<30;z++)for(let x=0;x<18;x++){
 const count=counts.get(x+','+z)??0;plotCounts.push(count);
 if(x+1<18)near.push(Math.abs(count-(counts.get((x+1)+','+z)??0)));
 if(x+8<18)far.push(Math.abs(count-(counts.get((x+8)+','+z)??0)));
}
const occupancyRatio=quantile(plotCounts,.9)/Math.max(1,quantile(plotCounts,.1));
const adjacentDifference=mean(near),separatedDifference=mean(far);
const speciesFractions=[...species.values()].filter(([a,b])=>a+b>300).map(([a,b])=>b/(a+b));
const speciesRange=Math.max(...speciesFractions)-Math.min(...speciesFractions);
assert.ok(occupancyRatio>2.2,'stand boundaries lack population contrast');
assert.ok(adjacentDifference<separatedDifference*.88,'patch distribution lacks spatial coherence');
assert.ok(speciesRange>.16,'species remain a uniform random mixture');
const heights=flatLayout.trees.map(p=>p.height);
assert.ok(quantile(heights,.1)<13&&quantile(heights,.95)>26,'canopy layers do not separate');

// Controlled topography reverses convex/concave shelter with identical central
// height, slope and stand coordinates. This catches ignored/incorrect relief.
const central={height:120,slope:.8};
const hollow=distantForestHabitat(1900,900,central,()=>({height:140,slope:.8}));
const shoulder=distantForestHabitat(1900,900,central,()=>({height:100,slope:.8}));
assert.ok(hollow.density>shoulder.density*1.2&&hollow.maturity>shoulder.maturity,
 'sheltered terrain does not support taller denser stands');

// Retained recovery layout is the cost control, not the new implementation.
function recoveryBudget(surface){
 const random=rng(902174),cells=new Set();let trees=0;
 for(let z=-2800;z<=3600;z+=14)for(let x=-4200;x<=4200;x+=14){
  const px=x+(random()-.5)*14*.88,pz=z+(random()-.5)*14*.88;
  const outside=Math.hypot(Math.max(0,Math.abs(px)-600),Math.max(0,Math.abs(pz)-800));
  if(outside<4||outside>3600)continue;
  const ground=surface(px,pz);if(!ground||ground.height<9||ground.height>720||ground.slope>2.5)continue;
  if(random()>(.5+.5*noise(px*.006,pz*.006))*(1-smooth(.9,2.5,ground.slope)*.8)*(1-smooth(2800,3600,outside)))continue;
  const family=random()<.23?1:0;random();random();trees++;
  cells.add([Math.floor(px/300),Math.floor(pz/300),family].join(','));
 }
 return {trees,cells:cells.size,triangles:trees*2};
}

// Real production terrain construction, source-tree metadata and rendering
// assembly, without any GL context, substituted ground or material changes.
const textures=Object.fromEntries(['rock','rockNormal','rockARM','sand','sandNormal','sandARM','bark','barkNormal','soil','soilNormal','soilARM','moss','mossNormal','mossARM'].map(name=>[name,new THREE.Texture()]));
const terrain=createTerrain(textures),annulus=terrain.getObjectByName('continuous-coastal-extension');
const surface=createLandscapeSampler(annulus),layout=createDistantForestLayout(surface,sourceHeights);
const recovery=recoveryBudget(surface);
const dataTexture=(rgba)=>new THREE.DataTexture(new Uint8Array(rgba),1,1,THREE.RGBAFormat);
const atlases=sourceHeights.map(()=>({albedo:dataTexture([120,140,80,255]),normals:dataTexture([128,255,128,255])}));
const forest=createDistantForest(terrain,atlases);
assert.deepEqual(forest.userData.stats.layers,layout.stats.layers);
assert.deepEqual(forest.userData.stats.families,layout.stats.families);
assert.ok(layout.stats.trees<=recovery.trees*1.03,'instance budget regressed');
assert.ok(forest.children.length<=recovery.cells+32,'batch count regressed');
assert.ok(layout.stats.trees>recovery.trees*.55,'forest coverage collapsed');
let instances=0,maxRootError=0;
const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion();
for(const mesh of forest.children){
 assert.ok(mesh instanceof THREE.InstancedMesh);
 assert.equal(mesh.geometry.index.count,6,'impostor triangle cost changed');
 assert.ok(Number.isFinite(mesh.boundingSphere.radius)&&mesh.boundingSphere.radius>0);
 for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);
  const ground=surface(position.x,position.z);assert.ok(ground,'instance escaped annulus');
  maxRootError=Math.max(maxRootError,Math.abs(position.y-(ground.height-.12)));
  assert.ok(ground.slope<=2.501&&ground.height>=8.99,'instance escaped viable ground');
  assert.ok(Math.abs(scale.x-scale.y)<1e-5&&Math.abs(scale.x-scale.z)<1e-5,'source tree distorted');
  instances++;
 }
}
assert.ok(maxRootError<.002,'roots do not follow the rendered surface');
assert.equal(instances,layout.stats.trees,'reported tree count differs from submitted instances');

// Independent plane-height oracle: choose actual indexed triangles and sample
// their interior directly. It does not repeat the annulus lookup algorithm.
const vertices=annulus.geometry.attributes.position,indices=annulus.geometry.index;
let maxPlaneError=0,triangleSamples=0;
for(let index=0;index<indices.count;index+=3*3571){
 const a=indices.getX(index),b=indices.getX(index+1),c=indices.getX(index+2);
 const x=.2*vertices.getX(a)+.3*vertices.getX(b)+.5*vertices.getX(c);
 const z=.2*vertices.getZ(a)+.3*vertices.getZ(b)+.5*vertices.getZ(c);
 const expected=.2*vertices.getY(a)+.3*vertices.getY(b)+.5*vertices.getY(c);
 const actual=surface(x,z);if(!actual)continue;
 maxPlaneError=Math.max(maxPlaneError,Math.abs(actual.height-expected));triangleSamples++;
}
assert.ok(triangleSamples>100&&maxPlaneError<1e-6,'actual triangle grounding oracle failed');

console.log('DISTANT_FOREST_CHECK_PASS '+JSON.stringify({
 scope:'CPU distribution and geometry only; no visual or GPU approval',
 layoutSha256:sha(layout.trees),...forest.userData.stats,recovery,
 maxRootError,maxPlaneError,triangleSamples,
 flatGround:{occupancyRatio,adjacentDifference,separatedDifference,speciesRange,
  heightP10:quantile(heights,.1),heightP95:quantile(heights,.95)},
}));
const geometries=new Set(),materials=new Set(),disposedTextures=new Set(Object.values(textures));
for(const root of [terrain,forest])root.traverse(o=>{
 if(o.geometry)geometries.add(o.geometry);
 for(const material of [o.material,o.customDepthMaterial].flat().filter(Boolean))materials.add(material);
});
for(const material of materials){
 for(const value of Object.values(material))if(value instanceof THREE.Texture)disposedTextures.add(value);
 for(const value of material.userData.sharedShaderTextures??[])disposedTextures.add(value);
 material.dispose();
}
for(const atlas of atlases)for(const texture of Object.values(atlas))disposedTextures.add(texture);
for(const geometry of geometries)geometry.dispose();
for(const texture of disposedTextures)texture.dispose();
