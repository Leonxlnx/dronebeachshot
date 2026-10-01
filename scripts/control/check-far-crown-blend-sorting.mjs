// CPU regression: actual far-material state plus deterministic paired buffers.
// node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-far-crown-blend-sorting.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {registerFarCrownCoveragePair,setFarCrownCoverage,getFarCrownCoverage} from '../../src/render/far-crown-coverage.ts';
import {registerFarCrownBlendingMesh,setFarCrownBlending,getFarCrownBlending,
 prepareFarCrownBlending,disposeFarCrownBlending} from '../../src/render/far-crown-blending.ts';

const scene=new THREE.Scene(),parent=new THREE.Group();scene.add(parent);
parent.position.set(13,7,-8);parent.rotation.set(.12,.41,-.08);parent.scale.set(1.2,.9,1.1);
const camera=new THREE.PerspectiveCamera(55,1,.1,2000),object=new THREE.Object3D();
const assets=[];
function flags(material){return{alphaHash:material.alphaHash,alphaToCoverage:material.alphaToCoverage,
 transparent:material.transparent,depthWrite:material.depthWrite,depthTest:material.depthTest,
 blending:material.blending,forceSinglePass:material.forceSinglePass,premultipliedAlpha:material.premultipliedAlpha,
 opacity:material.opacity,key:material.customProgramCacheKey()};}
function makeMesh(core){
 const geometry=new THREE.PlaneGeometry(8,8);geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(.5,4,-.25),7);
 const color=new THREE.MeshStandardMaterial({alphaTest:.45});color.alphaToCoverage=true;color.alphaHash=false;color.forceSinglePass=true;
 const depth=new THREE.MeshDepthMaterial({alphaTest:.45});depth.alphaHash=true;
 color.customProgramCacheKey=()=> 'fixture-lit';depth.customProgramCacheKey=()=> 'fixture-depth';
 registerFarCrownCoveragePair(color,depth);
 const mesh=new THREE.InstancedMesh(geometry,color,24);mesh.customDepthMaterial=depth;mesh.frustumCulled=false;
 registerFarCrownBlendingMesh(mesh);
 for(let i=0;i<24;i++){
  object.position.set((i%6-2)*5,Math.floor(i/6)*2,(i*13)%37-18);
  object.rotation.set(0,i*.07,0);object.scale.setScalar(.8+(i%5)*.1);object.updateMatrix();mesh.setMatrixAt(i,object.matrix);
  mesh.setColorAt(i,new THREE.Color(i/24,(24-i)/24,(i%7)/7));
 }
 mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();parent.add(mesh);
 const matrices=mesh.instanceMatrix.array.slice(),colors=mesh.instanceColor.array.slice();
 if(core){mesh.userData.sourceMatrices=matrices;mesh.userData.sourceColors=colors;}
 assets.push({mesh,geometry,color,depth,matrices,colors,initialFlags:flags(color),depthFlags:flags(depth),depthHook:depth.onBeforeCompile,
 bounds:mesh.boundingSphere.clone(),core});return assets.at(-1);
}
const core=makeMesh(true),remote=makeMesh(false);
const shadow=new THREE.InstancedMesh(core.geometry,core.color,24);shadow.userData.sourceShadowTwin=true;
shadow.instanceMatrix.array.set(core.matrices);shadow.customDepthMaterial=core.depth;parent.add(shadow);
assert.throws(()=>registerFarCrownBlendingMesh(shadow),/sun-only/);
const shadowBytes=shadow.instanceMatrix.array.slice();
assert.equal(getFarCrownBlending().enabled,false);assert.equal(getFarCrownBlending().registeredMeshes,2);
function repack(indices){
 core.mesh.count=indices.length;
 for(let i=0;i<indices.length;i++){
  core.mesh.instanceMatrix.array.set(core.matrices.subarray(indices[i]*16,indices[i]*16+16),i*16);
  core.mesh.instanceColor.array.set(core.colors.subarray(indices[i]*3,indices[i]*3+3),i*3);
 }
 core.mesh.instanceMatrix.needsUpdate=true;core.mesh.instanceColor.needsUpdate=true;
}
function pose(value){camera.position.set(Math.sin(value)*80,35+Math.sin(value*.6)*20,Math.cos(value)*80);camera.lookAt(0,7,0);camera.updateMatrixWorld(true);}
function capture(mesh){return{matrices:Array.from(mesh.instanceMatrix.array.slice(0,mesh.count*16)),colors:Array.from(mesh.instanceColor.array.slice(0,mesh.count*3)),count:mesh.count};}
function verify(asset){
 const {mesh,matrices,colors}=asset,m=new THREE.Matrix4(),v=new THREE.Vector3(),viewWorld=new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse,mesh.matrixWorld);
 let last=-Infinity;
 for(let i=0;i<mesh.count;i++){
  m.fromArray(mesh.instanceMatrix.array,i*16);v.copy(mesh.geometry.boundingSphere.center).applyMatrix4(m).applyMatrix4(viewWorld);
  assert(v.z>=last-1e-10,'back-to-front crown center order');last=v.z;
  const current=Array.from(mesh.instanceMatrix.array.slice(i*16,i*16+16));
  const source=Array.from({length:24},(_,j)=>j).find(j=>current.every((x,k)=>x===matrices[j*16+k]));
  assert.notEqual(source,undefined,'matrix must be an unchanged source tuple');
  assert.deepEqual(Array.from(mesh.instanceColor.array.slice(i*3,i*3+3)),Array.from(colors.slice(source*3,source*3+3)),'paired color');
 }
 assert(mesh.boundingSphere.equals(asset.bounds));assert.equal(mesh.renderOrder,0);
 assert.deepEqual(flags(asset.depth),asset.depthFlags);assert.equal(asset.depth.onBeforeCompile,asset.depthHook);
}
setFarCrownBlending(true);repack([]);pose(0);prepareFarCrownBlending(camera);verify(remote);
let seeks=0;const reference=new Map();
for(const value of [0,.5,1,1.5,2,2.5,3,3.5]){
 const indices=Array.from({length:24},(_,i)=>i).filter(i=>(i+Math.round(value*2))%3!==0);
 repack(indices);pose(value);prepareFarCrownBlending(camera);verify(core);verify(remote);
 reference.set(value,[capture(core.mesh),capture(remote.mesh)]);seeks++;
}
for(let i=0;i<80;i++){
 const value=((i*5)%8)*.5,indices=Array.from({length:24},(_,n)=>n).filter(n=>(n+Math.round(value*2))%3!==0);
 repack(indices);pose(value);prepareFarCrownBlending(camera);verify(core);verify(remote);
 assert.deepEqual([capture(core.mesh),capture(remote.mesh)],reference.get(value),'random seek deterministic');seeks++;
}
const indices=[17,2,21,4,8];repack(indices);const coreBefore=capture(core.mesh);pose(.73);prepareFarCrownBlending(camera);
setFarCrownBlending(false);assert.deepEqual(capture(core.mesh),coreBefore);
assert.deepEqual(Array.from(remote.mesh.instanceMatrix.array),Array.from(remote.matrices));
assert.deepEqual(Array.from(remote.mesh.instanceColor.array),Array.from(remote.colors));
for(const asset of assets)assert.deepEqual(flags(asset.color),asset.initialFlags);
setFarCrownBlending(true);repack([7,3,11]);pose(1.2);prepareFarCrownBlending(camera);repack([1,22]);
const newer=capture(core.mesh);setFarCrownBlending(false);assert.deepEqual(capture(core.mesh),newer);
assert.deepEqual(shadow.instanceMatrix.array,shadowBytes);
assert.deepEqual(core.mesh.userData.sourceMatrices,core.matrices);assert.deepEqual(core.mesh.userData.sourceColors,core.colors);
setFarCrownCoverage(true);assert.equal(getFarCrownCoverage().enabled,true);
setFarCrownBlending(true);assert.equal(getFarCrownCoverage().enabled,false);assert.equal(getFarCrownBlending().enabled,true);
for(const asset of assets){assert.equal(asset.color.alphaHash,false);assert.equal(asset.color.alphaToCoverage,false);assert.equal(asset.color.transparent,true);assert.equal(asset.color.depthWrite,false);assert.deepEqual(flags(asset.depth),asset.depthFlags);}
setFarCrownCoverage(true);assert.equal(getFarCrownBlending().enabled,false);assert.equal(getFarCrownCoverage().enabled,true);
setFarCrownCoverage(false);for(const asset of assets)assert.deepEqual(flags(asset.color),asset.initialFlags);
disposeFarCrownBlending();assert.equal(getFarCrownBlending().registeredMeshes,0);
for(const asset of assets){asset.mesh.dispose();asset.color.dispose();asset.depth.dispose();asset.geometry.dispose();}
shadow.dispose();
console.log(JSON.stringify({ok:true,meshes:2,sourceInstances:48,randomAndSequentialSeeks:seeks,
 emptyFirstThenVisible:true,transformedParent:true,matrixColorTuplesPreserved:true,
 offRestoration:true,newerCorePackPreserved:true,shadowBuffersUntouched:true,mutuallyExclusiveStudies:true,
 constraints:['CPU material/buffer regression; cross-cell color ordering and full-scene image/motion acceptance remain separate']}));
