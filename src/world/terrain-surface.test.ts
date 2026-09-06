import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {terrainHeight,rng} from './math.ts';
import {renderedTerrainHeight} from './terrain-surface.ts';
test('cached coastal samples remain bit-identical to uncached barycentric heights',()=>{
 const random=rng(5731);
 for(let i=0;i<2000;i++){
  const x=random()*1500-750,z=random()*1900-950,x0=Math.floor(x/2)*2,z0=Math.floor(z/2)*2,u=(x-x0)/2,v=(z-z0)/2;
  const a=Math.fround(terrainHeight(x0,z0)),b=Math.fround(terrainHeight(x0+2,z0)),c=Math.fround(terrainHeight(x0,z0+2)),d=Math.fround(terrainHeight(x0+2,z0+2));
  const expected=u+v<=1?a*(1-u-v)+b*u+c*v:d*(u+v-1)+b*(1-v)+c*(1-u);
  assert.equal(renderedTerrainHeight(x,z),expected);assert.equal(renderedTerrainHeight(x,z),expected);
 }
});
test('water contact height agrees with actual rendered terrain triangles',()=>{const plane=new THREE.PlaneGeometry(200,200,100,100);plane.rotateX(-Math.PI/2);plane.translate(0,0,100);const position=plane.attributes.position;for(let i=0;i<position.count;i++)position.setY(i,terrainHeight(position.getX(i),position.getZ(i)));const mesh=new THREE.Mesh(plane,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();const random=rng(3017),ray=new THREE.Raycaster();for(let i=0;i<100;i++){const x=(random()-.5)*198,z=1+random()*198;ray.set(new THREE.Vector3(x,1000,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-renderedTerrainHeight(x,z))<1e-7)}plane.dispose();mesh.material.dispose()});
