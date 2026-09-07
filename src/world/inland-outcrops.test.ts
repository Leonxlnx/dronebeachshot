import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import * as THREE from 'three';
import {createDetailedRocks,ROCK_GEOMETRY_URL} from './detailed-rocks.ts';
import {decodeRockGeometrySource} from './rock-geometry.ts';
import {treePlacements} from './ecology.ts';
import {renderedTerrainHeight} from './terrain-surface.ts';
import {createCoastalField} from './coastal-field.ts';
import type {Textures} from '../render/materials.ts';

const sha=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const packed=readFileSync('public'+ROCK_GEOMETRY_URL);
const texture=new THREE.Texture();
const textures=Object.fromEntries(['rock','rockNormal','rockARM','sand','sandNormal','sandARM','bark','barkNormal','soil','soilNormal','soilARM','moss','mossNormal','mossARM'].map(k=>[k,texture])) as Textures;
const rocks=createDetailedRocks(textures,decodeRockGeometrySource(packed.buffer.slice(packed.byteOffset,packed.byteOffset+packed.byteLength)));
const stats=rocks.userData.inlandRocks;
const trees=treePlacements();

test('inland source cohort remains embedded, root-safe and within its reviewed envelope',()=>{
 assert.equal(stats.accepted,21);
 assert.equal(sha(packed),'581b4f5b375b1eb2bed91178120d31811d09001904f43ee5f78e0168b61f6e42');
 const cohort=stats.records.map((r:{id:string,sourceVariant:number,matrix:number[]})=>({id:r.id,sourceVariant:r.sourceVariant,matrix:r.matrix}));
 assert.equal(sha(JSON.stringify(cohort)),'d14b6e9c75b5981424f50aecb8b69bd71e7129d136a5cd9f64959bc56a124a2b');
 assert.deepEqual(stats.excludedUpperWoodFits,['fractured-bedrock-5:9','fractured-bedrock-0:10','fractured-bedrock-0:23']);
 // Placement changes invalidate the source-bound upper-wood review and need a
 // fresh geometry review before updating this fingerprint.
 assert.equal(sha(JSON.stringify(trees)),'927ddf7d749c7c3ec4673acebd280e97dd02c0664d26c02225deb8fff7fb64e6');
 const point=new THREE.Vector3();
 for(const record of stats.records){
  assert.ok(!stats.excludedUpperWoodFits.includes(record.id));
  const mesh=rocks.getObjectByName('inland-scanned-outcrop-'+record.sourceVariant) as THREE.InstancedMesh;
  assert.ok(mesh instanceof THREE.InstancedMesh);
  const matrix=new THREE.Matrix4().fromArray(record.matrix),p=mesh.geometry.attributes.position,box=new THREE.Box3();
  let buried=0,maxExposure=-Infinity;
  for(let i=0;i<p.count;i++){
   point.fromBufferAttribute(p,i).applyMatrix4(matrix);box.expandByPoint(point);
   const exposure=point.y-renderedTerrainHeight(point.x,point.z);
   if(exposure<=0)buried++;maxExposure=Math.max(maxExposure,exposure);
  }
  assert.ok(buried/p.count>=.60,record.id+' must remain embedded');
  assert.ok(maxExposure<=12.0001&&maxExposure>=.7499,record.id+' exposure');
  for(const axis of ['x','z'] as const){const k=axis==='x'?0:2;assert.ok(box.min[axis]>=record.oldBounds.min[k]-.001&&box.max[axis]<=record.oldBounds.max[k]+.001);}
  assert.ok(box.max.y<=record.oldBounds.max[1]+.001);
  const lengths=[0,1,2].map(k=>new THREE.Vector3().setFromMatrixColumn(matrix,k).length());
  assert.ok(Math.max(...lengths)-Math.min(...lengths)<.000001,'Original scan must use uniform scale');
  assert.ok(Math.max(...lengths)<=4.800001);
  for(const tree of trees){
   const dx=Math.max(box.min.x-tree.x,0,tree.x-box.max.x),dz=Math.max(box.min.z-tree.z,0,tree.z-box.max.z);
   assert.ok(dx*dx+dz*dz>(2.75*tree.scale)**2||box.max.y<=tree.y-.4+.001,record.id+' root corridor');
  }
 }
});

test('inland cleanup preserves existing near scans, tidal rocks and the entire coastal field',()=>{
 assert.equal(stats.nearPreserved.selected,48);
 assert.equal(rocks.userData.offshoreRocks.instances,37);
 const field=createCoastalField(rocks);
 try{assert.equal(sha(new Uint8Array(field.texture.image.data.buffer)),'6fbe6e10c4769b2d2fd00c3a8219d2816194189327fc01394ee831cc1234de11');}
 finally{field.texture.dispose();}
});
