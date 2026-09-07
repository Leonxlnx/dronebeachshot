import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyIslandTreeForm,islandTreeForm,refineBentWood,formDeterminant} from './tree-form.ts';
import {treeFormFor} from './tree-form-data.ts';

function triangle(points:THREE.Vector3[]){
 const normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
 const values=new Float32Array(points.flatMap((p,i)=>[p.x,p.y,p.z,normal.x,normal.y,normal.z,i===1?1:0,i===2?1:0]));
 const data=new THREE.InterleavedBuffer(values,8),geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.InterleavedBufferAttribute(data,3,0));
 geometry.setAttribute('normal',new THREE.InterleavedBufferAttribute(data,3,3));
 geometry.setAttribute('uv',new THREE.InterleavedBufferAttribute(data,2,6));
 geometry.setIndex([0,1,2]);return geometry;
}

test('base form is an exact no-op and the lower root stays fixed in interleaved geometry',()=>{
 const geometry=triangle([new THREE.Vector3(0,0,0),new THREE.Vector3(1,1,0),new THREE.Vector3(0,2,1)]);
 const position=geometry.getAttribute('position'),before=Array.from(position.array),index=geometry.index;
 assert.equal(applyIslandTreeForm(geometry,'base'),geometry);
 assert.equal(geometry.getAttribute('position'),position);assert.equal(geometry.index,index);
 assert.deepEqual(Array.from(position.array),before);
 applyIslandTreeForm(geometry);
 for(let i=0;i<3;i++)assert.deepEqual([position.getX(i),position.getY(i),position.getZ(i)],before.slice(i*8,i*8+3));
});

test('coarse source wood is refined on its source surface with interpolated UVs before bending',()=>{
 // Actual coarse source triangle; naïve vertex bending reverses this face.
 const geometry=triangle([new THREE.Vector3(2.68410515785,11.82855033875,.53486430645),new THREE.Vector3(1.28346741199,5.63625192642,1.72449398041),new THREE.Vector3(2.06622147560,8.99378967285,.85958117247)]);
 const original=geometry.clone(),source=[0,1,2].map(i=>new THREE.Vector3().fromBufferAttribute(original.getAttribute('position'),i));
 const surface=new THREE.Triangle(...source as [THREE.Vector3,THREE.Vector3,THREE.Vector3]);
 refineBentWood(geometry,'fork-open');assert.ok(geometry.index!.count>3);
 const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
 for(let i=0;i<p.count;i++){
  const vertex=new THREE.Vector3().fromBufferAttribute(p,i),closest=surface.closestPointToPoint(vertex,new THREE.Vector3()),weights=surface.getBarycoord(closest,new THREE.Vector3())!;
  assert.ok(vertex.distanceTo(closest)<1e-6,'subdivision must stay on the original source surface');
  assert.ok(Math.abs(uv.getX(i)-weights.y)<5e-5&&Math.abs(uv.getY(i)-weights.z)<5e-5,'source UV interpolation');
 }
 const refined=geometry.clone();applyIslandTreeForm(geometry);
 for(let i=0;i<p.count;i++){
  const before=refined.getAttribute('position'),expected=islandTreeForm(before.getX(i),before.getY(i),before.getZ(i)).position;
  const after=geometry.getAttribute('position');assert.ok(new THREE.Vector3().fromBufferAttribute(after,i).distanceTo(new THREE.Vector3(...expected))<2e-6);
  assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('normal'),i).length()-1)<1e-6);
 }
 assert.ok(geometry.boundingBox&&geometry.boundingSphere);
});

test('growth differential agrees with independent central differences and preserves orientation',()=>{
 for(let i=0;i<80;i++){
  const p:[number,number,number]=[(i*7%29)-14,(i*11%43)*.45,(i*17%37)-12],q=islandTreeForm(...p);
  assert.ok(Math.abs(formDeterminant(q.jacobian)-1)<1e-12);
  for(let axis=0;axis<3;axis++){
   const a=[...p] as typeof p,b=[...p] as typeof p;a[axis]+=1e-4;b[axis]-=1e-4;
   const fa=islandTreeForm(...a).position,fb=islandTreeForm(...b).position;
   for(let row=0;row<3;row++)assert.ok(Math.abs((fa[row]-fb[row])/2e-4-q.jacobian[row*3+axis])<1e-6);
  }
 }
});

test('form choice is stable per root, bounded to the intended forest and independent of iteration order',()=>{
 const roots=Array.from({length:500},(_,i)=>Object.freeze({family:i%3,x:(i*37%800)-400,z:(i*41%700)-100}));
 const first=roots.map(treeFormFor),reverse=[...roots].reverse().map(treeFormFor).reverse();assert.deepEqual(first,reverse);
 assert.ok(first.includes(1));
 roots.forEach((p,i)=>{if(p.family!==0||p.x < -220||p.x > 80||p.z < 65||p.z > 400)assert.equal(first[i],0)});
});
