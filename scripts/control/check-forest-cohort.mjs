import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import * as math from '../../src/world/math.ts';
import * as habitat from '../../src/world/habitat.ts';
import * as surface from '../../src/world/terrain-surface.ts';
import * as ecology from '../../src/world/ecology.ts';
import {windMaterial} from '../../src/render/materials.ts';
import {pathPosition} from '../../src/camera/cinematic.ts';
import {createForestFloor} from '../../src/world/forest-floor.ts';
import {createForestStructure} from '../../src/world/forest-structure.ts';

// Independent pre-edit source with its original terrain inputs. No production
// test switch or alternate RNG is introduced to obtain the control cohort.
function reference(name,entry){
 const source=execFileSync('git',['show','e4f13884e607b420cdef7dc21c233bd7d0d82618:src/world/'+name+'.ts'],{encoding:'utf8'});
 const code=stripTypeScriptTypes(source).replace(/^import .*;\r?\n/gm,'').replace(/\bexport /g,'');
 return runInNewContext(code+'\n'+entry,{THREE,mergeGeometries,...math,...habitat,...surface,...ecology,windMaterial,pathPosition,performance,
  EAST_SPUR_STUDY_ENABLED:false,terrainSlope:math.terrainSlopeBeforePrincipalFace,
  habitatAt:habitat.habitatAtBeforePrincipalFace,renderedTerrainHeight:surface.renderedTerrainHeightBeforePrincipalFace});
}
const texture=new THREE.Texture(),textures=new Proxy({},{get:()=>texture});
const currentTrees=ecology.treePlacements(),referenceTrees=ecology.treePlacementsBeforePrincipalFace();
const point=new THREE.Vector3(),actualMatrix=new THREE.Matrix4(),oldMatrix=new THREE.Matrix4();
let unchangedInstances=0,changedInstances=0;
function compare(current,baseline){
 assert.equal(current.children.length,baseline.children.length);
 current.children.forEach((mesh,index)=>{
  const old=baseline.children[index];if(!(mesh instanceof THREE.InstancedMesh))return;
  const ids=mesh.userData.sourceOrdinals,oldIds=old.userData.sourceOrdinals;
  assert.ok(ids.length===mesh.count&&ids.every(id=>oldIds.includes(id)),'No new selection/refill');
  const positions=mesh.geometry.attributes.position;
  assert.deepEqual(Array.from(positions.array),Array.from(old.geometry.attributes.position.array),'RNG changed source shape');
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,actualMatrix);old.getMatrixAt(oldIds.indexOf(ids[i]),oldMatrix);
   assert.equal(actualMatrix.elements[12],oldMatrix.elements[12]);assert.equal(actualMatrix.elements[14],oldMatrix.elements[14]);
   let touched=false;
   for(const dx of [-.5,0,.5])for(const dz of [-.5,0,.5]){
    const x=oldMatrix.elements[12]+dx,z=oldMatrix.elements[14]+dz;
    touched||=surface.renderedTerrainHeight(x,z)!==surface.renderedTerrainHeightBeforePrincipalFace(x,z);
   }
   for(let v=0;v<positions.count&&!touched;v++){
    point.fromBufferAttribute(positions,v).applyMatrix4(oldMatrix);
    touched=surface.renderedTerrainHeight(point.x,point.z)!==surface.renderedTerrainHeightBeforePrincipalFace(point.x,point.z);
   }
   if(!touched){assert.deepEqual(actualMatrix.elements,oldMatrix.elements,'Untouched instance moved');unchangedInstances++;}
   else changedInstances++;
  }
 });
}
const floor=createForestFloor(textures,currentTrees),oldFloor=reference('forest-floor','createForestFloor')(textures,referenceTrees);
assert.equal(JSON.stringify(floor.userData.eastSpurCohort.selected),JSON.stringify(oldFloor.userData.eastSpurCohort.selected));
compare(floor,oldFloor);
const owner=floor.userData.eastSpurCohort.roots.find(record=>!record.omitted).treeOrdinal,removed=referenceTrees[owner];
const withoutOwner=createForestFloor(textures,currentTrees.filter(tree=>tree.x!==removed.x||tree.z!==removed.z));
assert.ok(withoutOwner.userData.eastSpurCohort.roots.filter(record=>record.treeOrdinal===owner).every(record=>record.omitted&&record.reason==='Owning core tree omitted'));
assert.equal(JSON.stringify(withoutOwner.userData.eastSpurCohort.selected),JSON.stringify(floor.userData.eastSpurCohort.selected));
for(let i=1;i<floor.children.length;i++)assert.deepEqual(Array.from(withoutOwner.children[i].instanceMatrix.array),Array.from(floor.children[i].instanceMatrix.array),'Tree omission reshuffled litter or seedlings');
for(const coastalSampling of [false,true]){
 const current=createForestStructure(textures,currentTrees,{coastalSampling});
 const baseline=reference('forest-structure','createForestStructure')(textures,referenceTrees,{coastalSampling});
 assert.equal(current.stats.shrubAttempts,baseline.stats.shrubAttempts);assert.equal(current.stats.snagAttempts,baseline.stats.snagAttempts);
 compare(current.group,baseline.group);
}
assert.ok(unchangedInstances>1000&&changedInstances>0);
console.log('FOREST_COHORT_PASS '+JSON.stringify({unchangedInstances,changedInstances,scope:'Pinned source cohort and exact untouched instance transforms; changed geometry grounding remains separately audited'}));
