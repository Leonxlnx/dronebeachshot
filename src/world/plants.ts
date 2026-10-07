import {renderedTerrainHeight,renderedTerrainHeightBeforePrincipalFace} from './terrain-surface.ts';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng,noise,terrainSlope,terrainSlopeBeforePrincipalFace,shoreDistance} from './math';
import {windMaterial,type Textures} from '../render/materials';
import {bindGrassPaletteStudy} from '../render/grass-palette';
function blade(points:THREE.Vector3[],width:number,color:THREE.Color,studyColor?:THREE.Color){
 const verts:number[]=[],cols:number[]=[],studyCols:number[]=[];
 const direction=points[points.length-1].clone().sub(points[0]);
 const across=new THREE.Vector3(-direction.z,0,direction.x);
 if(across.lengthSq()<.000001)across.set(1,0,0);else across.normalize();
 const vertex=(point:THREE.Vector3,side:number,w:number,u:number)=>{
  verts.push(point.x+across.x*side*w,point.y,point.z+across.z*side*w);
  const light=.84+.16*u;cols.push(color.r*light,color.g*light,color.b*light);
  // Decode the base palette first; retain the existing linear blade shading.
  if(studyColor)studyCols.push(studyColor.r*light,studyColor.g*light,studyColor.b*light);
 };
 for(let i=0;i<points.length-1;i++){
  const u=i/(points.length-1),v=(i+1)/(points.length-1);
  const wa=width*Math.pow(1-u,.7),wb=width*Math.pow(1-v,.7);
  vertex(points[i],-1,wa,u);vertex(points[i],1,wa,u);vertex(points[i+1],-1,wb,v);
  if(wb>0){vertex(points[i+1],-1,wb,v);vertex(points[i],1,wa,u);vertex(points[i+1],1,wb,v);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));if(studyColor)g.setAttribute('grassPaletteColor',new THREE.Float32BufferAttribute(studyCols,3));g.computeVertexNormals();return g;
}
// Set the root plane to the local rendered slope. Individual blades retain
// curved geometry instead of their basal ring hovering over a horizontal plane.
const up=new THREE.Vector3(0,1,0),groundNormal=new THREE.Vector3();
function orientToGround(object:THREE.Object3D,x:number,z:number,angle:number,height=renderedTerrainHeight){
 const dx=height(x+.5,z)-height(x-.5,z);
 const dz=height(x,z+.5)-height(x,z-.5);
 groundNormal.set(-dx,1,-dz).normalize();
 object.quaternion.setFromUnitVectors(up,groundNormal);object.rotateY(angle);
}
// Select the original cohort before refitting it. The shared RNG also authors
// later grass geometry and logs: omissions must consume their draws and cap.
function changedGround(x:number,z:number,radius:number){
 for(let pz=Math.floor((z-radius)/2)*2;pz<=Math.ceil((z+radius)/2)*2;pz+=2)
  for(let px=Math.floor((x-radius)/2)*2;px<=Math.ceil((x+radius)/2)*2;px+=2)
   if(renderedTerrainHeight(px,pz)!==renderedTerrainHeightBeforePrincipalFace(px,pz))return true;
 return false;
}
const referenceObject=new THREE.Object3D(),point=new THREE.Vector3(),referencePoint=new THREE.Vector3();
function coverSupported(g:THREE.BufferGeometry,object:THREE.Object3D,x:number,z:number,angle:number,offset:number,maxSlope:number){
 const sphere=g.boundingSphere!,radius=Math.max(.5,(sphere.radius+sphere.center.length())*object.scale.x);
 if(!changedGround(x,z,radius))return true;
 if(terrainSlope(x,z)>maxSlope)return false;
 referenceObject.position.set(x,renderedTerrainHeightBeforePrincipalFace(x,z)+offset,z);
 orientToGround(referenceObject,x,z,angle,renderedTerrainHeightBeforePrincipalFace);referenceObject.scale.copy(object.scale);referenceObject.updateMatrix();
 const vertices=g.attributes.position,minY=g.boundingBox!.min.y;
 // Compare basal vertices with their original rise (ferns intentionally arch).
 for(let v=0;v<vertices.count;v++){
  if(vertices.getY(v)>minY+.0001)continue;
  point.fromBufferAttribute(vertices,v);referencePoint.copy(point).applyMatrix4(referenceObject.matrix);point.applyMatrix4(object.matrix);
  const before=referencePoint.y-renderedTerrainHeightBeforePrincipalFace(referencePoint.x,referencePoint.z);
  if(point.y-renderedTerrainHeight(point.x,point.z)>Math.max(.12,before+.12))return false;
 }
 return true;
}
function seatLog(object:THREE.Object3D,x:number,z:number,angle:number,scale:number,height=renderedTerrainHeight){
 const half=2.75*scale,a=new THREE.Vector3(x-Math.cos(angle)*half,0,z-Math.sin(angle)*half),b=new THREE.Vector3(x+Math.cos(angle)*half,0,z+Math.sin(angle)*half);
 a.y=height(a.x,a.z)+.2*scale;b.y=height(b.x,b.z)+.2*scale;
 object.position.copy(a).lerp(b,.5);object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());object.scale.set(scale,a.distanceTo(b)/5.5,scale);object.updateMatrix();
}
function logSupported(object:THREE.Object3D,x:number,z:number,angle:number,scale:number){
 if(!changedGround(x,z,3.03*scale))return true;
 if(terrainSlope(x,z)>.65)return false;
 seatLog(referenceObject,x,z,angle,scale,renderedTerrainHeightBeforePrincipalFace);
 // Sample the tapered cylinder perimeter between the three authored axial
 // segments too, so a newly cut channel cannot leave the log bridging air.
 // ponytail: .25 m samples suit the 2 m terrain; use triangle intersections if finer cuts are added.
 const steps=Math.ceil(5.5*object.scale.y/.25);
 for(let i=0;i<=steps;i++){
  const u=i/steps,radius=.28-.12*u;let before=Infinity,after=Infinity;
  for(let side=0;side<10;side++){
   const a=side*Math.PI/5;point.set(Math.sin(a)*radius,-2.75+5.5*u,Math.cos(a)*radius);
   referencePoint.copy(point).applyMatrix4(referenceObject.matrix);point.applyMatrix4(object.matrix);
   before=Math.min(before,referencePoint.y-renderedTerrainHeightBeforePrincipalFace(referencePoint.x,referencePoint.z));
   after=Math.min(after,point.y-renderedTerrainHeight(point.x,point.z));
  }
  if(after>Math.max(.12,before+.12))return false;
 }
 return true;
}
export function createGroundCover(t:Textures){const root=new THREE.Group();root.name='understory';const random=rng(8278),dummy=new THREE.Object3D();const grassMat=bindGrassPaletteStudy(windMaterial(0xffffff));for(let family=0;family<4;family++){const gs:THREE.BufferGeometry[]=[];for(let b=0;b<9;b++){const a=random()*Math.PI*2,h=.35+random()*.9,r=.08+random()*.2,c=new THREE.Color().setHSL(.225+random()*.06,.33,.29+random()*.08);gs.push(blade(Array.from({length:7},(_,j)=>{const u=j/6,reach=r+h*.45*u*u;return new THREE.Vector3(Math.cos(a)*reach,h*(u-.17*u*u*u),Math.sin(a)*reach)}),.025+family*.007,c,c.clone().convertSRGBToLinear()))}const g=mergeGeometries(gs);g.computeBoundingBox();g.computeBoundingSphere();gs.forEach(g=>g.dispose());const mesh=new THREE.InstancedMesh(g,grassMat,11000);const sourceOrdinals:number[]=[];let count=0,selected=0;for(let i=0;i<130000&&selected<11000;i++){const x=(random()-.5)*850,z=random()*670-160,d=shoreDistance(x,z);if(d<22||d>150||terrainSlopeBeforePrincipalFace(x,z)>1.2||noise(x*.07,z*.07)<.25)continue;const angle=random()*Math.PI*2;dummy.position.set(x,renderedTerrainHeight(x,z)-.03,z);orientToGround(dummy,x,z,angle);dummy.scale.setScalar(.45+random()*.95);dummy.updateMatrix();const ordinal=selected++;if(!coverSupported(g,dummy,x,z,angle,-.03,1.2))continue;sourceOrdinals.push(ordinal);mesh.setMatrixAt(count++,dummy.matrix)}mesh.userData={sourceOrdinals,selected};mesh.count=count;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh)}
// Fern rosettes with individually shaped pinnae, not crossed rectangles.
const fernParts:THREE.BufferGeometry[]=[];for(let f=0;f<8;f++){const angle=f*Math.PI/4;for(let l=1;l<10;l++)for(const side of [-1,1]){const u=l/10,r=u*1.2,y=Math.sin(u*Math.PI)*.55+.08;const direction=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),perp=new THREE.Vector3(-Math.sin(angle),0,Math.cos(angle));const a=direction.clone().multiplyScalar(r);a.y=y;const b=a.clone().add(perp.multiplyScalar(side*.29*(1-u)));b.y+=.04;fernParts.push(blade([a,a.clone().lerp(b,.6),b],.055,new THREE.Color(0x4d7435)))}}const fernGeo=mergeGeometries(fernParts);fernGeo.computeBoundingBox();fernGeo.computeBoundingSphere();fernParts.forEach(g=>g.dispose());
// The shared material reads identical data for ferns in either mode. This is
// an alias of the original attribute, not another allocation or a recoloring.
fernGeo.setAttribute('grassPaletteColor',fernGeo.getAttribute('color'));
const fern=new THREE.InstancedMesh(fernGeo,grassMat,1800);const fernOrdinals:number[]=[];let fc=0,selectedFerns=0;for(let i=0;i<16000&&selectedFerns<1800;i++){const x=(random()-.5)*790,z=random()*650-30,d=shoreDistance(x,z);if(d<35||terrainSlopeBeforePrincipalFace(x,z)>.85||noise(x*.05,z*.05)<.45)continue;const angle=random()*Math.PI*2;dummy.position.set(x,renderedTerrainHeight(x,z),z);orientToGround(dummy,x,z,angle);dummy.scale.setScalar(.65+random()*.85);dummy.updateMatrix();const ordinal=selectedFerns++;if(!coverSupported(fernGeo,dummy,x,z,angle,0,.85))continue;fernOrdinals.push(ordinal);fern.setMatrixAt(fc++,dummy.matrix)}fern.userData={sourceOrdinals:fernOrdinals,selected:selectedFerns};fern.count=fc;fern.receiveShadow=true;root.add(fern);
const woodMat=new THREE.MeshStandardMaterial({map:t.bark,normalMap:t.barkNormal,color:0x878276,roughness:.97});const log=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.28,5.5,10,3),woodMat,68);const logOrdinals:number[]=[];let logs=0,selectedLogs=0;for(let attempt=0;attempt<10000&&selectedLogs<68;attempt++){const x=(random()-.5)*620,z=50+random()*350,d=shoreDistance(x,z);if(d<32||d>165||terrainSlopeBeforePrincipalFace(x,z)>.65)continue;const angle=random()*Math.PI*2,scale=.5+random(),ordinal=selectedLogs++;seatLog(dummy,x,z,angle,scale);if(!logSupported(dummy,x,z,angle,scale))continue;logOrdinals.push(ordinal);log.setMatrixAt(logs++,dummy.matrix)}log.userData={sourceOrdinals:logOrdinals,selected:selectedLogs};log.count=logs;log.computeBoundingSphere();log.castShadow=true;log.receiveShadow=true;root.add(log);return root;}
