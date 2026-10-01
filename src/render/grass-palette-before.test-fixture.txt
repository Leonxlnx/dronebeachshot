import {renderedTerrainHeight} from './terrain-surface.ts';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng,noise,terrainSlope,shoreDistance,fbm} from './math';
import {windMaterial,type Textures} from '../render/materials';
function blade(points:THREE.Vector3[],width:number,color:THREE.Color){
 const verts:number[]=[],cols:number[]=[];
 const direction=points[points.length-1].clone().sub(points[0]);
 const across=new THREE.Vector3(-direction.z,0,direction.x);
 if(across.lengthSq()<.000001)across.set(1,0,0);else across.normalize();
 const vertex=(point:THREE.Vector3,side:number,w:number,u:number)=>{
  verts.push(point.x+across.x*side*w,point.y,point.z+across.z*side*w);
  const light=.84+.16*u;cols.push(color.r*light,color.g*light,color.b*light);
 };
 for(let i=0;i<points.length-1;i++){
  const u=i/(points.length-1),v=(i+1)/(points.length-1);
  const wa=width*Math.pow(1-u,.7),wb=width*Math.pow(1-v,.7);
  vertex(points[i],-1,wa,u);vertex(points[i],1,wa,u);vertex(points[i+1],-1,wb,v);
  if(wb>0){vertex(points[i+1],-1,wb,v);vertex(points[i],1,wa,u);vertex(points[i+1],1,wb,v);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));g.computeVertexNormals();return g;
}
// Set the root plane to the local rendered slope. Individual blades retain
// curved geometry instead of their basal ring hovering over a horizontal plane.
const up=new THREE.Vector3(0,1,0),groundNormal=new THREE.Vector3();
function orientToGround(object:THREE.Object3D,x:number,z:number,angle:number){
 const dx=renderedTerrainHeight(x+.5,z)-renderedTerrainHeight(x-.5,z);
 const dz=renderedTerrainHeight(x,z+.5)-renderedTerrainHeight(x,z-.5);
 groundNormal.set(-dx,1,-dz).normalize();
 object.quaternion.setFromUnitVectors(up,groundNormal);object.rotateY(angle);
}
export function createGroundCover(t:Textures){const root=new THREE.Group();root.name='understory';const random=rng(8278),dummy=new THREE.Object3D();const grassMat=windMaterial(0xffffff);for(let family=0;family<4;family++){const gs:THREE.BufferGeometry[]=[];for(let b=0;b<9;b++){const a=random()*Math.PI*2,h=.35+random()*.9,r=.08+random()*.2,c=new THREE.Color().setHSL(.225+random()*.06,.33,.29+random()*.08);gs.push(blade(Array.from({length:7},(_,j)=>{const u=j/6,reach=r+h*.45*u*u;return new THREE.Vector3(Math.cos(a)*reach,h*(u-.17*u*u*u),Math.sin(a)*reach)}),.025+family*.007,c))}const g=mergeGeometries(gs);gs.forEach(g=>g.dispose());const mesh=new THREE.InstancedMesh(g,grassMat,11000);let count=0;for(let i=0;i<130000&&count<11000;i++){const x=(random()-.5)*850,z=random()*670-160,d=shoreDistance(x,z);if(d<22||d>150||terrainSlope(x,z)>1.2||noise(x*.07,z*.07)<.25)continue;dummy.position.set(x,renderedTerrainHeight(x,z)-.03,z);orientToGround(dummy,x,z,random()*Math.PI*2);dummy.scale.setScalar(.45+random()*.95);dummy.updateMatrix();mesh.setMatrixAt(count++,dummy.matrix)}mesh.count=count;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh)}
// Fern rosettes with individually shaped pinnae, not crossed rectangles.
const fernParts:THREE.BufferGeometry[]=[];for(let f=0;f<8;f++){const angle=f*Math.PI/4;for(let l=1;l<10;l++)for(const side of [-1,1]){const u=l/10,r=u*1.2,y=Math.sin(u*Math.PI)*.55+.08;const direction=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),perp=new THREE.Vector3(-Math.sin(angle),0,Math.cos(angle));const a=direction.clone().multiplyScalar(r);a.y=y;const b=a.clone().add(perp.multiplyScalar(side*.29*(1-u)));b.y+=.04;fernParts.push(blade([a,a.clone().lerp(b,.6),b],.055,new THREE.Color(0x4d7435)))}}const fernGeo=mergeGeometries(fernParts);fernParts.forEach(g=>g.dispose());const fern=new THREE.InstancedMesh(fernGeo,grassMat,1800);let fc=0;for(let i=0;i<16000&&fc<1800;i++){const x=(random()-.5)*790,z=random()*650-30,d=shoreDistance(x,z);if(d<35||terrainSlope(x,z)>.85||noise(x*.05,z*.05)<.45)continue;dummy.position.set(x,renderedTerrainHeight(x,z),z);orientToGround(dummy,x,z,random()*Math.PI*2);dummy.scale.setScalar(.65+random()*.85);dummy.updateMatrix();fern.setMatrixAt(fc++,dummy.matrix)}fern.count=fc;fern.receiveShadow=true;root.add(fern);
const woodMat=new THREE.MeshStandardMaterial({map:t.bark,normalMap:t.barkNormal,color:0x878276,roughness:.97});const log=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.28,5.5,10,3),woodMat,68);let logs=0;for(let attempt=0;attempt<10000&&logs<68;attempt++){const x=(random()-.5)*620,z=50+random()*350,d=shoreDistance(x,z);if(d<32||d>165||terrainSlope(x,z)>.65)continue;const angle=random()*Math.PI*2,scale=.5+random(),half=2.75*scale;const a=new THREE.Vector3(x-Math.cos(angle)*half,0,z-Math.sin(angle)*half),b=new THREE.Vector3(x+Math.cos(angle)*half,0,z+Math.sin(angle)*half);a.y=renderedTerrainHeight(a.x,a.z)+.2*scale;b.y=renderedTerrainHeight(b.x,b.z)+.2*scale;dummy.position.copy(a).lerp(b,.5);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());dummy.scale.set(scale,a.distanceTo(b)/5.5,scale);dummy.updateMatrix();log.setMatrixAt(logs++,dummy.matrix)}log.count=logs;log.computeBoundingSphere();log.castShadow=true;log.receiveShadow=true;root.add(log);return root;}
