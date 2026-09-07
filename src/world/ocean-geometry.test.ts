import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createDistantWaterGeometry} from './ocean-geometry.ts';

test('distant water is a flat, upward-facing ring with the correct total area',()=>{
 const geometry=createDistantWaterGeometry(),position=geometry.getAttribute('position'),index=geometry.getIndex()!;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let area=0;
 for(let i=0;i<position.count;i++)assert.equal(position.getY(i),0);
 for(let i=0;i<index.count;i+=3){
  a.fromBufferAttribute(position,index.getX(i));b.fromBufferAttribute(position,index.getX(i+1));c.fromBufferAttribute(position,index.getX(i+2));
  const cross=b.sub(a).cross(c.sub(a));assert.ok(cross.y>0,'all faces must point toward the camera above the sea');area+=cross.y/2;
 }
 assert.equal(area,26000*26000-1800*1800);geometry.dispose();
});

test('distant water covers the outer sea while leaving the exact fine-ocean opening',()=>{
 const geometry=createDistantWaterGeometry(),material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(geometry,material);
 mesh.updateMatrixWorld();const ray=new THREE.Raycaster();
 for(const x of [-14000,-12900,-950,-900.1,-899.9,0,899.9,900.1,950,12900,14000])
  for(const z of [-18000,-16900,-1250.1,-1249.9,0,549.9,550.1,8900,10000]){
   ray.set(new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0));
   const outsideFine=x< -900||x>900||z< -1250||z>550;
   const withinOuter=x> -13000&&x<13000&&z> -17000&&z<9000;
   assert.equal(ray.intersectObject(mesh).length>0,outsideFine&&withinOuter,`coverage at ${x}, ${z}`);
  }
 material.dispose();geometry.dispose();
});
