// CPU placement/support study. Terrain-only visibility does not test vegetation
// or rock occlusion, and does not establish actual browser visual acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {createForestStructure,COASTAL_SHRUB_SAMPLING_STUDY_ENABLED} from '../../src/world/forest-structure.ts';
import {treePlacements} from '../../src/world/ecology.ts';
import {shoreDistance,terrainSlope,noise} from '../../src/world/math.ts';
import {habitatAt} from '../../src/world/habitat.ts';
import {renderedTerrainHeight} from '../../src/world/terrain-surface.ts';
import {sampleCamera,pathPosition} from '../../src/camera/cinematic.ts';
const began=performance.now(),directory=new URL('../../artifacts/refinement-2026-09-30/coastal-understory/',import.meta.url);
const baseline=JSON.parse(fs.readFileSync(new URL('baseline.json',directory),'utf8'));
const textures=Object.fromEntries(['rock','rockNormal','rockARM','sand','sandNormal','sandARM','bark','barkNormal','soil','soilNormal','soilARM','moss','mossNormal','mossARM'].map(name=>[name,new THREE.Texture()]));
const trees=treePlacements(),off=createForestStructure(textures,trees,{coastalSampling:false}),on=createForestStructure(textures,trees,{coastalSampling:true});
const hash=array=>crypto.createHash('sha256').update(Buffer.from(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
function geometry(group){return group.children.map(mesh=>({name:mesh.name,attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([key,attribute])=>[key,hash(attribute.array)])),index:hash(mesh.geometry.index.array)}))}
const before=off.group.userData.forestStructurePlacements,after=on.group.userData.forestStructurePlacements,added=after.slice(before.length);
assert.deepEqual(before,baseline.placements,'Default-off changed original ordered cohort');
assert.deepEqual(after.slice(0,before.length),before,'Enabled study altered a pre-existing plant');
assert.deepEqual(geometry(off.group),baseline.geometry,'Default-off source geometry changed');
assert.deepEqual(geometry(on.group),baseline.geometry,'Enabled study source geometry changed');
for(const [key,value] of Object.entries(baseline.stats))if(key!=='buildMilliseconds')assert.equal(off.stats[key],value,'Original statistic changed: '+key);
assert.ok(on.stats.shrubs<=420&&on.stats.drawCalls<=14);assert.equal(on.stats.snags,off.stats.snags);
assert.equal(on.stats.coastalShrubs,added.length);assert.ok(added.every(p=>p.kind==='shrub'));
// The sampled maximum may change legally; unchanged source geometry and each
// added plant's original habitat-dependent scale limits are the real contract.
const flight=Array.from({length:601},(_,i)=>pathPosition(i/30));
let minimumTrunkMargin=Infinity,minimumPlantSpacing=Infinity,maxSlope=0;
for(const p of added){
 const h=habitatAt(p.x,p.z),d=shoreDistance(p.x,p.z),slope=terrainSlope(p.x,p.z);maxSlope=Math.max(maxSlope,slope);
 assert.ok(d>=31&&d<=95&&slope<=.82&&h.soil>=.28&&h.moisture>=.38&&noise(p.x*.033+29,p.z*.033-14)>=.40);
 assert.equal(p.y,renderedTerrainHeight(p.x,p.z)-.055,'Root center missed actual triangle');
 assert.ok(p.scale>=(.72*(1-h.exposure*.24))&&p.scale<=1.37*(1-h.exposure*.24));
 for(const tree of trees){const margin=Math.hypot(tree.x-p.x,tree.z-p.z)-(.65+tree.scale*.55);minimumTrunkMargin=Math.min(minimumTrunkMargin,margin);assert.ok(margin>=0,'Live trunk exclusion failed')}
 assert.ok(!flight.some(q=>q.y>p.y-1.5&&q.y<p.y+p.height+2.5&&Math.hypot(q.x-p.x,q.z-p.z)<p.radius+2.2),'Route envelope intersects shrub');
 for(const q of after){if(q===p)continue;const minimum=q.kind==='snag'?1.5+p.radius+q.radius:(p.radius+q.radius)*.78;
  const margin=Math.hypot(q.x-p.x,q.z-p.z)-minimum;minimumPlantSpacing=Math.min(minimumPlantSpacing,margin);assert.ok(margin>=0,'Plant spacing failed');
 }
}
// Use the Float32 instance transforms and generated wood vertices, rather than
// ideal placement centers. The basal ring is source wood below local Y=-0.12.
const matrix=new THREE.Matrix4(),world=new THREE.Vector3();let basalVertices=0,maximumBasalGap=-Infinity,minimumBasalGap=Infinity;
const supportRecords=[];
for(let variant=0;variant<4;variant++){
 const mesh=on.group.getObjectByName(`shrub-${variant}-wood`),positions=mesh.geometry.attributes.position;
 const matches=after.filter(p=>p.kind==='shrub'&&p.variant===variant);
 for(let index=0;index<matches.length;index++){
  const p=matches[index];if(!added.includes(p))continue;
  mesh.getMatrixAt(index,matrix);let count=0,maxGap=-Infinity,minGap=Infinity;
  for(let v=0;v<positions.count;v++){
   if(positions.getY(v)>=-.12)continue;
   world.fromBufferAttribute(positions,v).applyMatrix4(matrix);
   const gap=world.y-renderedTerrainHeight(world.x,world.z);count++;maxGap=Math.max(maxGap,gap);minGap=Math.min(minGap,gap);
  }
  assert.ok(count>0);assert.ok(maxGap<=0,'Added basal wood floats above terrain');
  basalVertices+=count;maximumBasalGap=Math.max(maximumBasalGap,maxGap);minimumBasalGap=Math.min(minimumBasalGap,minGap);
  supportRecords.push({x:p.x,z:p.z,variant,vertices:count,maxGap,minGap});
 }
}
function distribution(placements){
 const shrubs=placements.filter(p=>p.kind==='shrub'),distances=shrubs.map(p=>shoreDistance(p.x,p.z)).sort((a,b)=>a-b);
 const bands=Array.from({length:10},(_,index)=>{const minX=-500+index*100;return {minX,maxX:minX+100,all:0,within70:0,within95:0}});
 for(const p of shrubs){const band=bands[Math.min(9,Math.max(0,Math.floor((p.x+500)/100)))],d=shoreDistance(p.x,p.z);band.all++;if(d<70)band.within70++;if(d<95)band.within95++}
 return {shrubs:shrubs.length,medianShoreDistance:distances[Math.floor(distances.length/2)],within70:distances.filter(d=>d<70).length,within95:distances.filter(d=>d<95).length,bands};
}
function screenStudy(placements,time){
 const shot=sampleCamera(time),camera=new THREE.PerspectiveCamera(shot.fov,16/9,.1,3000);
 camera.position.copy(shot.position);camera.up.set(Math.sin(shot.bank),Math.cos(shot.bank),0);camera.lookAt(shot.target);camera.updateMatrixWorld();
 const records=[];
 for(const p of placements.filter(p=>p.kind==='shrub')){
  const point=new THREE.Vector3(p.x,p.y+p.height*.7,p.z),projected=point.clone().project(camera);
  if(Math.abs(projected.x)>1||Math.abs(projected.y)>1||projected.z< -1||projected.z>1)continue;
  const bottom=new THREE.Vector3(p.x,p.y,p.z).project(camera),top=new THREE.Vector3(p.x,p.y+p.height,p.z).project(camera);
  const distance=point.distanceTo(camera.position),steps=Math.ceil(distance/2);let visible=true;
  for(let step=1;step<steps;step++){
   const ray=point.clone().lerp(camera.position,step/steps);
   if(renderedTerrainHeight(ray.x,ray.z)>ray.y){visible=false;break}
  }
  records.push({x:p.x,z:p.z,distance,pixelHeight768:Math.abs(top.y-bottom.y)*432*.5,terrainVisible:visible});
 }
 const visible=records.filter(p=>p.terrainVisible),near=visible.filter(p=>p.distance<=200);
 return {time,inFrame:records.length,terrainVisible:visible.length,visibleWithin200:near.length,
  visibleDistanceRange:visible.length?[Math.min(...visible.map(p=>p.distance)),Math.max(...visible.map(p=>p.distance))]:null,
  visiblePixelHeightRange768:visible.length?[Math.min(...visible.map(p=>p.pixelHeight768)),Math.max(...visible.map(p=>p.pixelHeight768))]:null,records};
}
const report={scope:'CPU study only: actual basal wood/triangle support and terrain-only sampled visibility; rock intersections, tree occlusion and browser appearance untested',defaultEnabled:COASTAL_SHRUB_SAMPLING_STUDY_ENABLED,
 baseline:off.stats,candidate:on.stats,distribution:{baseline:distribution(before),candidate:distribution(after),added:distribution(added)},
 support:{plants:supportRecords.length,basalVertices,maximumBasalGap,minimumBasalGap,maximumSlope:maxSlope,minimumTrunkMargin,minimumPlantSpacing,records:supportRecords},
 screens:[6,10].map(time=>({time,baseline:screenStudy(before,time),candidate:screenStudy(after,time),added:screenStudy(added,time)})),milliseconds:performance.now()-began};
fs.writeFileSync(new URL('sampling-audit.json',directory),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(new URL('candidate-placements.json',directory),JSON.stringify(after,null,2)+'\n');
console.log('COASTAL_SHRUB_SAMPLING_AUDIT '+JSON.stringify({...report,distribution:Object.fromEntries(Object.entries(report.distribution).map(([key,value])=>[key,{...value,bands:undefined}])),support:{...report.support,records:undefined},screens:report.screens.map(frame=>({...frame,...Object.fromEntries(['baseline','candidate','added'].map(key=>[key,{...frame[key],records:undefined}]))}))}));
for(const result of [off,on]){const materials=new Set();result.group.traverse(mesh=>{mesh.geometry?.dispose();if(mesh.material)materials.add(mesh.material)});for(const material of materials)material.dispose()}
Object.values(textures).forEach(texture=>texture.dispose());
