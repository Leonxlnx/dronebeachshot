import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {decodeRockGeometrySource} from '../../src/world/rock-geometry.ts';
import {createOffshoreRocks} from '../../src/world/offshore-rocks.ts';
import {createCoastalField,COASTAL_FIELD_SIZE} from '../../src/world/coastal-field.ts';
import {renderedTerrainHeight} from '../../src/world/terrain-surface.ts';
import {pathPosition,evaluationCameras} from '../../src/camera/cinematic.ts';

const packed=fs.readFileSync('public/assets/rocks/rock_moss_set_01_geometry.bin');
const source=decodeRockGeometrySource(packed.buffer.slice(packed.byteOffset,packed.byteOffset+packed.byteLength));
const textures=Object.fromEntries(['rock','rockNormal','rockARM','moss','mossNormal','mossARM'].map(name=>[name,new THREE.Texture()]));
const group=createOffshoreRocks(textures,source),repeat=createOffshoreRocks(textures,source);
assert.deepEqual(group.userData.offshoreRocks,repeat.userData.offshoreRocks,'Rock placement is not deterministic');
const route=Array.from({length:1201},(_,i)=>pathPosition(i/60));
const cameras=Object.values(evaluationCameras).map(camera=>camera.position);
const matrix=new THREE.Matrix4(),point=new THREE.Vector3();
let instances=0,minClearance=Infinity,minPenetration=Infinity,minProtrusion=Infinity;
const centers=[];
group.traverse(mesh=>{
 if(!(mesh instanceof THREE.InstancedMesh))return;
 const p=mesh.geometry.getAttribute('position');
 for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,matrix);const box=new THREE.Box3();let low=Infinity,high=-Infinity;
  for(let v=0;v<p.count;v++){
   point.fromBufferAttribute(p,v).applyMatrix4(matrix);box.expandByPoint(point);
   const d=point.y-renderedTerrainHeight(point.x,point.z);low=Math.min(low,d);high=Math.max(high,d);
  }
  assert.ok(low<-.01,'Rock floats above actual terrain');assert.ok(high>.01,'Rock completely buried');
  minPenetration=Math.min(minPenetration,-low);minProtrusion=Math.min(minProtrusion,high);
  for(const position of [...route,...cameras])minClearance=Math.min(minClearance,box.distanceToPoint(position));
  centers.push(box.getCenter(new THREE.Vector3()));instances++;
 }
});
assert.ok(instances>=24&&instances<=45,'Unexpected headland cluster density');
assert.ok(minClearance>=5,'Offshore rocks intrude into the camera corridor');
assert.ok(centers.every(p=>Math.abs(p.x)>170),'Open central beach obstructed');
const field=createCoastalField(group),data=field.texture.image.data;
assert.ok(field.diagnostics.instancesRasterized>0&&field.diagnostics.blockingSamples>0,'Visible rocks do not contribute to water collision');
let leeOutsideRock=0,submergedSamples=0;
for(let i=0;i<COASTAL_FIELD_SIZE**2;i++){
 if(data[i*4+1]>0&&data[i*4+3]>.1)leeOutsideRock++;
 if(data[i*4+2]>-99&&data[i*4+2]<-.35)submergedSamples++;
}
assert.ok(leeOutsideRock>20,'No wave shelter behind emergent scans');
assert.ok(submergedSamples>20,'No true submerged rock surfaces');
// Negative control: removing every visible instance must remove collision and lee.
const empty=createCoastalField(new THREE.Group());
assert.equal(empty.diagnostics.blockingSamples,0);
assert.ok(empty.texture.image.data.every((value,i)=>i%4!==3||value===0));
const result={scope:'CPU geometry, dense path clearance and actual rasterized wave shelter; not visual acceptance',instances,minClearance,minPenetration,minProtrusion,leeOutsideRock,submergedSamples,blockingSamples:field.diagnostics.blockingSamples,
 sourceSha256:crypto.createHash('sha256').update(packed).digest('hex')};
fs.mkdirSync('artifacts/continuation',{recursive:true});fs.writeFileSync('artifacts/continuation/offshore-check.json',JSON.stringify(result,null,2)+'\n');
console.log('OFFSHORE_CHECK_PASS '+JSON.stringify(result));
