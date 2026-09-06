import {renderedTerrainHeight} from './terrain-surface.ts';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng,terrainSlope,shoreDistance,noise} from './math';
import type {Placement} from './ecology';
import {windMaterial,type Textures} from '../render/materials';
export function createForestFloor(t:Textures,trees:Placement[]){
 const group=new THREE.Group();group.name='roots-regeneration-and-litter';const random=rng(390181),dummy=new THREE.Object3D();
 const wood=new THREE.MeshStandardMaterial({map:t.bark,normalMap:t.barkNormal,color:0x827865,roughness:.97});
 const roots:THREE.BufferGeometry[]=[];let rootTrees=0;
 for(let i=0;i<trees.length&&rootTrees<150;i+=7){const tree=trees[i];if(tree.family===2||shoreDistance(tree.x,tree.z)>150||terrainSlope(tree.x,tree.z)>1.2)continue;rootTrees++;
  for(let branch=0;branch<4;branch++){const angle=tree.angle+branch*Math.PI*.5+random()*.5,length=(1.8+random()*2.1)*tree.scale,points:THREE.Vector3[]=[];
   for(let j=0;j<=5;j++){const u=j/5,x=tree.x+Math.cos(angle+u*.24)*length*u,z=tree.z+Math.sin(angle+u*.24)*length*u;points.push(new THREE.Vector3(x,renderedTerrainHeight(x,z)+.025+.52*tree.scale*Math.pow(1-u,3),z))}
   const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),10,.065*tree.scale,5,false);roots.push(geometry);
  }
 }
 if(roots.length){const geometry=mergeGeometries(roots);roots.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,wood);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh)}
 // Small curved leaf surfaces rest on the terrain; regeneration occupies moist
 // pockets below the canopy, with open beach sand kept clear.
 const leafShape=new THREE.Shape();leafShape.moveTo(0,0);leafShape.quadraticCurveTo(.14,.08,.0,.38);leafShape.quadraticCurveTo(-.14,.08,0,0);
 const leafGeometry=new THREE.ShapeGeometry(leafShape,4);leafGeometry.rotateX(-Math.PI/2);
 const lp=leafGeometry.attributes.position;for(let i=0;i<lp.count;i++)lp.setY(i,.045*Math.sin(Math.abs(lp.getZ(i))/.38*Math.PI));leafGeometry.computeVertexNormals();
 const leafMaterial=new THREE.MeshStandardMaterial({color:0x746039,roughness:.98,side:THREE.DoubleSide});
 const litter=new THREE.InstancedMesh(leafGeometry,leafMaterial,5200);let count=0;
 for(let i=0;i<26000&&count<5200;i++){const tree=trees[Math.floor(random()*trees.length)],x=tree.x+(random()-.5)*12,z=tree.z+(random()-.5)*12,d=shoreDistance(x,z);if(d<30||d>190||terrainSlope(x,z)>1||noise(x*.16,z*.16)<.32)continue;
  const normal=new THREE.Vector3(renderedTerrainHeight(x-.2,z)-renderedTerrainHeight(x+.2,z),.4,renderedTerrainHeight(x,z-.2)-renderedTerrainHeight(x,z+.2)).normalize();
  dummy.position.set(x,renderedTerrainHeight(x,z)+.016,z);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);dummy.rotateY(random()*Math.PI*2);dummy.scale.setScalar(.5+random()*1.7);dummy.updateMatrix();litter.setMatrixAt(count,dummy.matrix);litter.setColorAt(count,new THREE.Color().setHSL(.09+random()*.045,.15+random()*.2,.48+random()*.18));count++;
 }
 litter.count=count;litter.receiveShadow=true;litter.computeBoundingSphere();group.add(litter);
 const seedParts:THREE.BufferGeometry[]=[new THREE.CylinderGeometry(.014,.028,.85,5,3).translate(0,.425,0)];
 for(let i=0;i<7;i++){const leaf=leafGeometry.clone();leaf.rotateZ((i%2?1:-1)*.3);leaf.rotateY(i*2.399);leaf.translate(Math.sin(i*2.399)*.1,.17+i*.085,Math.cos(i*2.399)*.1);seedParts.push(leaf)}
 // Vertex colors let stems and individual leaves share one wind-deformed draw.
 for(let i=0;i<seedParts.length;i++){const geometry=seedParts[i],color=new THREE.Color(i===0?0x6c7347:0x608447),colors=new Float32Array(geometry.attributes.position.count*3);for(let v=0;v<geometry.attributes.position.count;v++)colors.set(color.toArray(),v*3);geometry.setAttribute('color',new THREE.BufferAttribute(colors,3))}
 const seedGeometry=mergeGeometries(seedParts);seedParts.forEach(g=>g.dispose());const seedlings=new THREE.InstancedMesh(seedGeometry,windMaterial(0xd3d3b8),1300);let sc=0;
 for(let i=0;i<15000&&sc<1300;i++){const tree=trees[Math.floor(random()*trees.length)],x=tree.x+(random()-.5)*15,z=tree.z+(random()-.5)*15,d=shoreDistance(x,z);if(d<34||d>175||terrainSlope(x,z)>.8||noise(x*.045,z*.045)<.5)continue;dummy.position.set(x,renderedTerrainHeight(x,z),z);dummy.rotation.set(0,random()*Math.PI*2,0);dummy.scale.setScalar(.45+random()*1.5);dummy.updateMatrix();seedlings.setMatrixAt(sc++,dummy.matrix)}
 seedlings.count=sc;seedlings.receiveShadow=true;seedlings.computeBoundingSphere();group.add(seedlings);group.userData.counts={rootTrees,roots:roots.length,litter:count,seedlings:sc};return group;
}
