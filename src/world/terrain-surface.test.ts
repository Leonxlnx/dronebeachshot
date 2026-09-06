import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {terrainHeight,rng} from './math.ts';
import {renderedTerrainHeight} from './terrain-surface.ts';
test('water contact height agrees with actual rendered terrain triangles',()=>{const plane=new THREE.PlaneGeometry(200,200,100,100);plane.rotateX(-Math.PI/2);plane.translate(0,0,100);const position=plane.attributes.position;for(let i=0;i<position.count;i++)position.setY(i,terrainHeight(position.getX(i),position.getZ(i)));const mesh=new THREE.Mesh(plane,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();const random=rng(3017),ray=new THREE.Raycaster();for(let i=0;i<100;i++){const x=(random()-.5)*198,z=1+random()*198;ray.set(new THREE.Vector3(x,1000,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-renderedTerrainHeight(x,z))<1e-7)}plane.dispose();mesh.material.dispose()});
