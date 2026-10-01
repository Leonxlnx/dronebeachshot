import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {partitionTerrainShadowGeometry,createTerrainShadowChunkStudy} from './terrain-shadow-chunks.ts';

function fixture(){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([
  -9,0,-2, 8,5,-2, 0,2,8, 20,1,20, 29,-3,20, 20,0,29,
  -130,0,-10, 70,4,-10, 70,0,170,
 ],3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(Array(27).fill(0).map((_,i)=>i%3===1?1:0),3));
 // The first triangle deliberately repeats: a partition may not deduplicate it.
 geometry.setIndex([0,1,2,3,5,4,6,7,8,0,1,2]);return geometry;
}
const triangles=(geometry:THREE.BufferGeometry)=>{
 const a=geometry.index!;return Array.from({length:a.count/3},(_,i)=>[a.getX(i*3),a.getX(i*3+1),a.getX(i*3+2)].join(',')).sort();
};

test('partition retains exact triangle multiplicity, winding, attributes and original draw range',()=>{
 const source=fixture(),before=new Float32Array(source.attributes.position.array),indices=Array.from(source.index!.array);
 const chunks=partitionTerrainShadowGeometry(source,10);
 assert.ok(chunks.length>1);assert.deepEqual(chunks.flatMap(triangles).sort(),triangles(source));
 for(const chunk of chunks)for(const name of Object.keys(source.attributes))assert.equal(chunk.attributes[name],source.attributes[name]);
 assert.deepEqual(source.attributes.position.array,before);assert.deepEqual(Array.from(source.index!.array),indices);
 assert.deepEqual(source.drawRange,{start:0,count:Infinity});
});

test('every referenced vertex is bounded, including long triangles crossing cell borders',()=>{
 const source=fixture(),point=new THREE.Vector3(),chunks=partitionTerrainShadowGeometry(source,10);
 for(const chunk of chunks)for(const i of chunk.index!.array){
  point.fromBufferAttribute(source.attributes.position,i);
  assert.ok(chunk.boundingBox!.containsPoint(point));
  assert.ok(point.distanceTo(chunk.boundingSphere!.center)<=chunk.boundingSphere!.radius+1e-12);
 }
 // Long triangle centroid is in one bin but its -130m corner must still cast
 // into a narrow offscreen light volume around that corner.
 const long=chunks.find(g=>triangles(g).includes('6,7,8'))!;
 const camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,40);camera.position.set(-128,12,-8);camera.lookAt(-128,0,-8);camera.updateMatrixWorld();
 const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const mesh=new THREE.Mesh(long);mesh.updateMatrixWorld();assert.ok(frustum.intersectsObject(mesh));
});

test('study is lazy, follows source transforms, suppresses colour draws and restores ownership',()=>{
 const geometry=fixture(),material=new THREE.MeshStandardMaterial(),source=new THREE.Mesh(geometry,material);
 source.castShadow=true;source.position.set(10,4,-8);source.rotation.y=.31;source.scale.set(2,1,3);
 const study=createTerrainShadowChunkStudy(source,10);
 assert.equal(source.children.length,0);assert.equal(study.get().terrainChunks,false);assert.equal(source.castShadow,true);
 study.set(true);assert.equal(source.castShadow,false);assert.equal(source.children.length,1);
 source.updateMatrixWorld(true);const group=source.children[0],child=group.children[0] as THREE.Mesh;
 assert.deepEqual(child.matrixWorld.elements,source.matrixWorld.elements);
 assert.equal(child.material,material);assert.equal(child.geometry.attributes.position,geometry.attributes.position);
 const count=child.geometry.index!.count;assert.equal(child.geometry.drawRange.count,0);
 child.onBeforeShadow(null as never,null as never,null as never,null as never,null as never,null as never,null as never);
 assert.equal(child.geometry.drawRange.count,count);assert.equal(study.get().terrainShadowSubmittedTriangles,count/3);
 child.onAfterShadow(null as never,null as never,null as never,null as never,null as never,null as never,null as never);
 assert.equal(child.geometry.drawRange.count,0);
 child.geometry.setDrawRange(0,count);child.onBeforeRender(null as never,null as never,null as never,null as never,null as never,null as never);
 assert.equal(child.geometry.drawRange.count,0,'Colour pass cannot submit proxy triangles');
 study.beginFrame();assert.equal(study.get().terrainShadowSubmittedTriangles,0);
 study.set(false);assert.equal(source.castShadow,true);assert.equal(group.visible,false);
 study.set(true);assert.equal(source.children.length,1,'Re-enable reuses existing partition');
 let sourceDisposed=false,materialDisposed=false,borrowedAtDisposal=-1;
 geometry.addEventListener('dispose',()=>{sourceDisposed=true;});material.addEventListener('dispose',()=>{materialDisposed=true;});
 child.geometry.addEventListener('dispose',()=>{borrowedAtDisposal=Object.keys(child.geometry.attributes).length;});
 study.dispose();study.dispose();assert.equal(source.children.length,0);assert.equal(source.castShadow,true);
 assert.equal(borrowedAtDisposal,0);assert.equal(sourceDisposed,false);assert.equal(materialDisposed,false);
 assert.throws(()=>study.set(true),/disposed/);
});

test('unsupported topology is rejected instead of silently changing the shadow source',()=>{
 assert.throws(()=>partitionTerrainShadowGeometry(fixture(),0),/cell size/);
 const source=fixture();source.setDrawRange(3,9);assert.throws(()=>partitionTerrainShadowGeometry(source),/complete source/);
 source.setDrawRange(0,Infinity);source.addGroup(0,3,0);assert.throws(()=>partitionTerrainShadowGeometry(source),/ungrouped/);
 source.clearGroups();source.morphAttributes.position=[source.attributes.position];assert.throws(()=>partitionTerrainShadowGeometry(source),/static vertices/);
});

test('sun pass arms only live light-frustum chunks and consumes their camera layers',()=>{
 const source=new THREE.Mesh(fixture(),new THREE.MeshStandardMaterial());source.castShadow=true;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),sun=new THREE.DirectionalLight();
 sun.castShadow=true;sun.position.set(0,100,0);sun.target.position.set(0,0,0);
 Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:1,far:200});
 scene.add(source,sun,sun.target);
 const renderer={shadowMap:{enabled:true,autoUpdate:false,needsUpdate:true,type:THREE.PCFShadowMap}} as THREE.WebGLRenderer;
 const study=createTerrainShadowChunkStudy(source,10);study.set(true);
 const chunks=source.children[0].children as THREE.Mesh[];
 study.prepareSunShadow(renderer,scene,camera,sun);
 const frustum=sun.shadow.getFrustum(),eligible=chunks.filter(mesh=>frustum.intersectsObject(mesh));
 assert.ok(eligible.length>0);
 for(const mesh of chunks)assert.equal(mesh.layers.mask,eligible.includes(mesh)?source.layers.mask:0);
 for(const mesh of eligible){
  mesh.onBeforeShadow(null as never,null as never,null as never,null as never,null as never,null as never,null as never);
  mesh.onAfterShadow(null as never,null as never,null as never,null as never,null as never,null as never,null as never);
 }
 assert.ok(chunks.every(mesh=>!mesh.layers.test(camera.layers)&&mesh.geometry.drawRange.count===0),'Camera list recheck must skip every proxy');
 assert.equal(study.get().terrainShadowSubmittedChunks,eligible.length);
 // A cached-main pass must not accidentally re-arm the already consumed map.
 renderer.shadowMap.needsUpdate=false;study.prepareSunShadow(renderer,scene,camera,sun);
 assert.ok(chunks.every(mesh=>mesh.layers.mask===0));
 renderer.shadowMap.needsUpdate=true;study.prepareSunShadow(renderer,scene,camera,sun);
 assert.ok(chunks.some(mesh=>mesh.layers.mask!==0),'Every genuine shadow rebuild re-arms its casters');
 study.finishSunShadow();assert.ok(chunks.every(mesh=>mesh.layers.mask===0));study.dispose();
});

test('disabled, invisible and skipped sun work never arms proxies; unsupported extra lights fail closed',()=>{
 const source=new THREE.Mesh(fixture(),new THREE.MeshStandardMaterial());source.castShadow=true;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),sun=new THREE.DirectionalLight();sun.castShadow=true;
 sun.position.set(0,100,0);Object.assign(sun.shadow.camera,{left:-300,right:300,top:300,bottom:-300,near:1,far:300});
 scene.add(source,sun,sun.target);
 const renderer={shadowMap:{enabled:true,autoUpdate:false,needsUpdate:true,type:THREE.PCFShadowMap}} as THREE.WebGLRenderer;
 const study=createTerrainShadowChunkStudy(source,10);study.set(true);const chunks=source.children[0].children as THREE.Mesh[];
 const prepare=()=>study.prepareSunShadow(renderer,scene,camera,sun);
 const cleared=()=>assert.ok(chunks.every(mesh=>mesh.layers.mask===0&&mesh.geometry.drawRange.count===0));
 prepare();assert.ok(chunks.some(mesh=>mesh.layers.mask!==0));
 renderer.shadowMap.enabled=false;prepare();cleared();renderer.shadowMap.enabled=true;
 sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=false;prepare();cleared();sun.shadow.autoUpdate=true;
 sun.visible=false;prepare();cleared();sun.visible=true;
 sun.layers.set(1);prepare();cleared();sun.layers.set(0);
 source.material.visible=false;prepare();cleared();source.material.visible=true;
 source.visible=false;prepare();cleared();source.visible=true;
 const other=new THREE.DirectionalLight();other.castShadow=true;scene.add(other);
 assert.throws(prepare,/one visible shadow-casting sun/);cleared();
 // Even a skipped configured sun must not hide a second light's unsupported pass.
 sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=false;assert.throws(prepare,/one visible/);cleared();
 other.removeFromParent();sun.shadow.autoUpdate=true;
 renderer.shadowMap.type=THREE.VSMShadowMap;assert.throws(prepare,/PCF sun pass/);cleared();study.dispose();
});
