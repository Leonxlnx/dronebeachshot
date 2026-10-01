import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {renderedTerrainHeight as height,renderedTerrainHeightBeforePrincipalFace as referenceHeight} from '../../src/world/terrain-surface.ts';
import {terrainSlope} from '../../src/world/math.ts';
import {sampleCamera} from '../../src/camera/cinematic.ts';
import {EAST_SPUR_STUDY_ENABLED} from '../../src/world/east-spur.ts';
assert.equal(EAST_SPUR_STUDY_ENABLED,true);
const dir='artifacts/refinement-2026-09-30/east-wall-structure/',read=name=>JSON.parse(fs.existsSync(dir+name)?fs.readFileSync(dir+name,'utf8'):gunzipSync(fs.readFileSync(dir+name+'.gz')).toString());
const off=read('cohorts-integrated-off.json'),on=read('cohorts-integrated-on.json');
const floats=p=>{const b=Buffer.from(p.data,'base64');return new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))};
const audit=on.floor.data.eastSpurCohort,records=[];
for(const [meshIndex,kind] of ['roots','litter','seedlings'].entries()){
 const a=off.floor.meshes[meshIndex],b=on.floor.meshes[meshIndex],positions=floats(b.attributes.position),oldPositions=floats(a.attributes.position),matrix=b.matrix?floats(b.matrix):null;
 for(const [emitted,ordinal] of b.sourceOrdinals.entries()){
  const record=audit[kind][ordinal];if(!record.local)continue;
  if(kind==='roots'){
   let maximumNewBottomGap=-Infinity,maximumIncrease=-Infinity;
   for(let ring=0;ring<=10;ring++){
    let current=Infinity,previous=Infinity;
    for(let v=0;v<=5;v++){
     const next=(emitted*66+ring*6+v)*3,old=(ordinal*66+ring*6+v)*3;
     current=Math.min(current,positions[next+1]-height(positions[next],positions[next+2]));previous=Math.min(previous,oldPositions[old+1]-referenceHeight(oldPositions[old],oldPositions[old+2]));
    }
    assert.ok(current<=Math.max(.06,previous+.12)+1e-6);maximumNewBottomGap=Math.max(maximumNewBottomGap,current);maximumIncrease=Math.max(maximumIncrease,current-previous);
   }
   records.push({kind,ordinal,treeOrdinal:record.treeOrdinal,maximumNewBottomGap,maximumIncrease});
  }else{
   const m=new THREE.Matrix4().fromArray(matrix,emitted*16),point=new THREE.Vector3();let maximumGap=-Infinity;
   const x=matrix[emitted*16+12],z=matrix[emitted*16+14];assert.ok(terrainSlope(x,z)<=(kind==='litter'?1:.8)+.0001);
   for(let v=0;v<positions.length;v+=3){if(kind==='seedlings'&&positions[v+1]>.03)continue;point.set(positions[v],positions[v+1],positions[v+2]).applyMatrix4(m);maximumGap=Math.max(maximumGap,point.y-height(point.x,point.z))}
   assert.ok(maximumGap<=(kind==='litter'?.12:.15)+.0001);records.push({kind,ordinal,maximumGap});
  }
 }
}
// A limited composition diagnostic for the removed local crowns. Project an
// authored family-height midpoint and test terrain along the ray every 2 m.
// It omits vegetation/rock occlusion and is not a silhouette or visual claim.
const core=read('integrated-core-support.json'),omitted=new Set(core.omitted),affected=new Set(core.records.map(r=>r.index)),coverage=[];
for(const time of [6,7.5,9,10.5,12]){
 const s=sampleCamera(time),camera=new THREE.PerspectiveCamera(s.fov,512/288,.1,5000);camera.position.copy(s.position);camera.up.set(Math.sin(s.bank),Math.cos(s.bank),0);camera.lookAt(s.target);camera.updateMatrixWorld();
 const projected=[];
 for(const index of affected){const tree=off.trees[index],familyHeight=(tree.family===2?21:tree.family===1?14.4:18.2)*tree.scale;
  const point=new THREE.Vector3(tree.x,height(tree.x,tree.z)-.06+familyHeight*.5,tree.z),ndc=point.clone().project(camera);if(Math.abs(ndc.x)>1||Math.abs(ndc.y)>1||ndc.z< -1||ndc.z>1)continue;
  const ray=point.clone().sub(s.position),distance=ray.length(),steps=Math.ceil(distance/2);let clear=true;
  for(let j=1;j<steps-1;j++){const p=s.position.clone().addScaledVector(ray,j/steps);if(p.y<height(p.x,p.z)){clear=false;break}}
  projected.push({index,omitted:omitted.has(index),x:(ndc.x+1)*256,y:(1-ndc.y)*144,terrainRayClear:clear});
 }
 coverage.push({time,inFrustum:projected.length,omittedInFrustum:projected.filter(p=>p.omitted).length,omittedTerrainRayClear:projected.filter(p=>p.omitted&&p.terrainRayClear).length,retainedTerrainRayClear:projected.filter(p=>!p.omitted&&p.terrainRayClear).length,records:projected});
}
const result={scope:'Actual emitted Float32 floor geometry support; approximate family crown-midpoint projection/2m terrain ray for local composition risk only',floor:records,coverage,limits:['Root-ring test preserves intentional source trunk-end rise; it does not claim every upper tube vertex lies in soil.','Crown midpoint visibility excludes vegetation/rocks and cannot replace full-scene comparison.']};
fs.writeFileSync(dir+'dependent-support-check.json',JSON.stringify(result,null,2)+'\n');console.log('EAST_SPUR_DEPENDENT_SUPPORT '+JSON.stringify({...result,floor:{roots:records.filter(r=>r.kind==='roots').length,litter:records.filter(r=>r.kind==='litter').length,seedlings:records.filter(r=>r.kind==='seedlings').length},coverage:coverage.map(({records,...r})=>r)}));
