// Run: node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-ground-cover-cohort.mjs
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createGroundCover} from '../../src/world/plants.ts';
import {rng,noise,fbm,shoreDistance,terrainSlope,terrainSlopeBeforePrincipalFace} from '../../src/world/math.ts';
import {renderedTerrainHeight as height,renderedTerrainHeightBeforePrincipalFace as referenceHeight} from '../../src/world/terrain-surface.ts';
import {windMaterial} from '../../src/render/materials.ts';
import {bindGrassPaletteStudy} from '../../src/render/grass-palette.ts';

// Immutable preceding source; production has no test-only terrain/RNG hooks.
const revision='e4f13884e607b420cdef7dc21c233bd7d0d82618';
const source=execFileSync('git',['show',revision+':src/world/plants.ts'],{encoding:'utf8'});
const js=stripTypeScriptTypes(source).replace(/^import .*;\r?\n/gm,'').replace(/\bexport /g,'');
const createReference=runInNewContext(js+'\ncreateGroundCover',{THREE,mergeGeometries,rng,noise,fbm,shoreDistance,
 terrainSlope:terrainSlopeBeforePrincipalFace,renderedTerrainHeight:referenceHeight,windMaterial,bindGrassPaletteStudy});
const textures={bark:new THREE.Texture(),barkNormal:new THREE.Texture()};
const reference=createReference(textures),current=createGroundCover(textures),repeat=createGroundCover(textures);
const matrix=new THREE.Matrix4(),oldMatrix=new THREE.Matrix4(),point=new THREE.Vector3(),oldPoint=new THREE.Vector3(),box=new THREE.Box3();
const report=[];

// Test the old complete geometry footprint plus its normal-sampling stencil,
// independently of the production conservative spherical-footprint shortcut.
function touchesChangedTerrain(geometry,m){
 geometry.computeBoundingBox();box.copy(geometry.boundingBox).applyMatrix4(m);
 box.expandByPoint(new THREE.Vector3(m.elements[12]-.5,0,m.elements[14]-.5));
 box.expandByPoint(new THREE.Vector3(m.elements[12]+.5,0,m.elements[14]+.5));
 for(let z=Math.floor(box.min.z/2)*2;z<=Math.ceil(box.max.z/2)*2;z+=2)
  for(let x=Math.floor(box.min.x/2)*2;x<=Math.ceil(box.max.x/2)*2;x+=2)
   if(height(x,z)!==referenceHeight(x,z))return true;
 return false;
}
for(let family=0;family<reference.children.length;family++){
 const a=reference.children[family],b=current.children[family],c=repeat.children[family],kind=family<4?'grass-'+family:family===4?'fern':'log';
 assert.equal(b.userData.selected,a.count,kind+' changed reference cap or random stream');
 assert.equal(b.count,c.count);assert.deepEqual(b.userData,c.userData);assert.deepEqual(b.instanceMatrix.array,c.instanceMatrix.array,'Nondeterministic matrices');
 for(const name of Object.keys(a.geometry.attributes)){
  assert.deepEqual(b.geometry.attributes[name].array,a.geometry.attributes[name].array,kind+' geometry/RNG drift');
  assert.deepEqual(b.geometry.attributes[name].array,c.geometry.attributes[name].array,kind+' nondeterministic geometry');
 }
 const ids=b.userData.sourceOrdinals;assert.equal(ids.length,b.count);
 assert.ok(ids.every((id,index)=>index===0||id>ids[index-1]),kind+' reordered or duplicate source identities');
 const emitted=new Map(ids.map((id,index)=>[id,index]));let unchanged=0,changed=0,omitted=0,maximumNewBasalGap=0;
 const vertices=a.geometry.attributes.position,minY=a.geometry.boundingBox?.min.y??Math.min(...Array.from({length:vertices.count},(_,i)=>vertices.getY(i)));
 for(let ordinal=0;ordinal<a.count;ordinal++){
  a.getMatrixAt(ordinal,oldMatrix);const local=touchesChangedTerrain(a.geometry,oldMatrix),index=emitted.get(ordinal);
  if(index===undefined){assert.ok(local,kind+' omitted unchanged footprint '+ordinal);omitted++;continue}
  b.getMatrixAt(index,matrix);
  assert.equal(matrix.elements[12],oldMatrix.elements[12],kind+' moved x '+ordinal);
  assert.equal(matrix.elements[14],oldMatrix.elements[14],kind+' moved z '+ordinal);
  if(!local){assert.deepEqual(matrix.elements,oldMatrix.elements,kind+' changed untouched transform '+ordinal);unchanged++}
  else changed++;
  const x=matrix.elements[12],z=matrix.elements[14];
  if(family<5){
   assert.ok(Math.abs(matrix.elements[13]-(height(x,z)+(family<4?-.03:0)))<.001,kind+' root missed current terrain');
   if(!local)continue;
   assert.ok(terrainSlope(x,z)<=(family<4?1.2:.85)+.0001,kind+' on newly steep cut');
   for(let v=0;v<vertices.count;v++){
    if(vertices.getY(v)>minY+.0001)continue;
    point.fromBufferAttribute(vertices,v);oldPoint.copy(point).applyMatrix4(oldMatrix);point.applyMatrix4(matrix);
    const before=oldPoint.y-referenceHeight(oldPoint.x,oldPoint.z),after=point.y-height(point.x,point.z);
    assert.ok(after<=Math.max(.12,before+.12)+.001,kind+' new unsupported basal vertex '+ordinal);
    maximumNewBasalGap=Math.max(maximumNewBasalGap,after-before);
   }
  }else{
   const scale=Math.hypot(matrix.elements[0],matrix.elements[1],matrix.elements[2]);
   for(const end of [-2.75,2.75]){
    point.set(0,end,0).applyMatrix4(matrix);
    assert.ok(Math.abs(point.y-height(point.x,point.z)-.2*scale)<.001,'Log endpoint missed current terrain '+ordinal);
   }
   if(!local)continue;
   assert.ok(terrainSlope(x,z)<=.6501,'Log on newly steep cut');
   // Twice the production axial density checks between accepted support rings.
   const steps=Math.ceil(5.5*Math.hypot(matrix.elements[4],matrix.elements[5],matrix.elements[6])/.125);
   for(let i=0;i<=steps;i++){
    const u=i/steps,r=.28-.12*u;let before=Infinity,after=Infinity;
    for(let side=0;side<10;side++){
     const angle=side*Math.PI/5;point.set(Math.sin(angle)*r,-2.75+5.5*u,Math.cos(angle)*r);
     oldPoint.copy(point).applyMatrix4(oldMatrix);point.applyMatrix4(matrix);
     before=Math.min(before,oldPoint.y-referenceHeight(oldPoint.x,oldPoint.z));after=Math.min(after,point.y-height(point.x,point.z));
    }
    assert.ok(after<=Math.max(.12,before+.12)+.001,'Log gained unsupported span '+ordinal);
    maximumNewBasalGap=Math.max(maximumNewBasalGap,after-before);
   }
  }
 }
 if(family===5)for(const ordinal of [52,65]){
  assert.ok(emitted.has(ordinal),'Faraway regression log omitted');
  a.getMatrixAt(ordinal,oldMatrix);b.getMatrixAt(emitted.get(ordinal),matrix);
  assert.deepEqual(matrix.elements,oldMatrix.elements,'Faraway regression log moved '+ordinal);
 }
 report.push({kind,selected:a.count,emitted:b.count,unchanged,changed,omitted,maximumNewBasalGap});
}
assert.ok(report.some(r=>r.changed+r.omitted>0),'Check never exercised terrain edit');
console.log('GROUND_COVER_COHORT_PASS '+JSON.stringify({reference:revision,scope:'CPU identity, geometry and support; no visual acceptance',families:report}));
const geometries=new Set(),materials=new Set();
for(const group of [reference,current,repeat])group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material)});
for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of Object.values(textures))t.dispose();

