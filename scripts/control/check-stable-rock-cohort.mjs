import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import * as THREE from 'three';
import {createDetailedRocks,ROCK_GEOMETRY_URL} from '../../src/world/detailed-rocks.ts';
import {decodeRockGeometrySource} from '../../src/world/rock-geometry.ts';
import {treePlacements,treePlacementsBeforePrincipalFace} from '../../src/world/ecology.ts';
import {renderedTerrainHeight,renderedTerrainHeightBeforePrincipalFace} from '../../src/world/terrain-surface.ts';
const sha=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const referenceTrees=treePlacementsBeforePrincipalFace(),trees=treePlacements();
assert.equal(sha(referenceTrees),'927ddf7d749c7c3ec4673acebd280e97dd02c0664d26c02225deb8fff7fb64e6','Reviewed reference tree cohort changed');
let changedRoots=0;const changedRootIds=[];
assert.equal(trees.length,referenceTrees.length);
for(let i=0;i<trees.length;i++){
 const tree=trees[i],before=referenceTrees[i];assert.deepEqual({...tree,y:before.y},before,'Tree identity/attributes/order changed');
 assert.equal(tree.y,renderedTerrainHeight(tree.x,tree.z)-.06,'Actual root is not on current terrain');
 if(tree.y!==before.y){assert.ok(tree.y<before.y);changedRoots++;changedRootIds.push(i)}
 else assert.deepEqual(tree,before,'Untouched tree changed');
}
const texture=new THREE.Texture(),textures=Object.fromEntries(['rock','rockNormal','rockARM','sand','sandNormal','sandARM','bark','barkNormal','soil','soilNormal','soilARM','moss','mossNormal','mossARM'].map(k=>[k,texture]));
const packed=fs.readFileSync('public'+ROCK_GEOMETRY_URL),source=decodeRockGeometrySource(packed.buffer.slice(packed.byteOffset,packed.byteOffset+packed.byteLength)),rocks=createDetailedRocks(textures,source);
const inland=rocks.userData.inlandRocks,cohort=records=>records.map(({id,sourceVariant,matrix})=>({id,sourceVariant,matrix}));
assert.equal(sha(cohort(inland.referenceRecords)),'d14b6e9c75b5981424f50aecb8b69bd71e7129d136a5cd9f64959bc56a124a2b','Reviewed inland source cohort changed');
const records=[],matrix=new THREE.Matrix4(),point=new THREE.Vector3(),color=new THREE.Color();rocks.updateMatrixWorld(true);
rocks.traverse(mesh=>{
 if(!(mesh instanceof THREE.InstancedMesh))return;
 const hash=crypto.createHash('sha256');
 for(const name of Object.keys(mesh.geometry.attributes).sort()){const a=mesh.geometry.attributes[name];hash.update(name);hash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength))}
 if(mesh.geometry.index){const a=mesh.geometry.index.array;hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength))}
 const geometrySha256=hash.digest('hex');
 for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,matrix);const member=mesh.userData.rockCohort?.[i],id=member?member.kind+':'+member.id:mesh.name+':'+i;
  records.push({id,mesh:mesh.name,matrix:matrix.toArray(),matrixBits:Array.from(new Uint32Array(new Float32Array(matrix.elements).buffer)),sourceVariant:member?.sourceVariant??null,geometrySha256,color:mesh.instanceColor?(mesh.getColorAt(i,color),color.toArray()):null});
 }
});
const save=process.argv.find(arg=>arg.startsWith('--write-reference='))?.slice(18),read=process.argv.find(arg=>arg.startsWith('--reference='))?.slice(12);
if(save){assert.equal(changedRoots,0,'Reference snapshot must run with the frozen-baseline loader');assert.equal(rocks.userData.localRockRefit.touched,0);fs.writeFileSync(save,JSON.stringify(records)+'\n')}
let changedRocks=0,footprintChecks=0;
if(read){
 const preceding=JSON.parse(fs.readFileSync(read,'utf8')),byId=new Map(preceding.map(r=>[r.id,r])),currentIds=new Set(records.map(r=>r.id));
 const omitted=new Set(rocks.userData.localRockRefit.omitted.map(r=>r.kind+':'+r.id));
 for(const r of preceding)assert.ok(currentIds.has(r.id)||omitted.has(r.id),'Reference member disappeared without an explicit local omission');
 assert.equal(records.length+omitted.size,preceding.length);
 for(const record of records){
  const original=byId.get(record.id);assert.ok(original,'New remote member admitted');
  assert.deepEqual({...record,matrix:original.matrix,matrixBits:original.matrixBits},original,'Source identity, dimensions/geometry, color or batch changed');
  record.matrixBits.forEach((value,i)=>{if(i!==13)assert.equal(value,original.matrixBits[i],'Refit changed a component other than Y')});
  if(record.matrix[13]!==original.matrix[13]){
   changedRocks++;assert.ok(record.matrix[13]<original.matrix[13]);
   const refit=rocks.userData.localRockRefit.records.find(r=>r.kind+':'+r.id===record.id);assert.ok(refit,'Unreported transform change');
   const mesh=rocks.getObjectByName(record.mesh);matrix.fromArray(original.matrix);const p=mesh.geometry.attributes.position;let affected=false;
   for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(matrix);if(renderedTerrainHeight(point.x,point.z)!==renderedTerrainHeightBeforePrincipalFace(point.x,point.z)){affected=true;break}footprintChecks++}
   assert.ok(affected||refit.rootConstraints.length,'A rock outside changed terrain/root support moved');
  }
 }
 for(const name of new Set(preceding.map(r=>r.mesh)))assert.deepEqual(records.filter(r=>r.mesh===name).map(r=>r.id),preceding.filter(r=>r.mesh===name&&!omitted.has(r.id)).map(r=>r.id),'Cohort order changed within a batch');
}
console.log('STABLE_COHORT_AUDIT '+JSON.stringify({trees:trees.length,changedRoots,changedRootIds,referenceTreeSha256:sha(referenceTrees),currentTreeSha256:sha(trees),rockInstances:records.length,changedRocks,footprintChecks,inlandReferenceSha256:sha(cohort(inland.referenceRecords)),inlandCurrentSha256:sha(cohort(inland.records)),localRefit:rocks.userData.localRockRefit,scope:'Reference identities and actual local support only; basal wood/visual acceptance remains separate'}));
const geometries=new Set(),materials=new Set();rocks.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());texture.dispose();
