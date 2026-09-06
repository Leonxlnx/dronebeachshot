import * as THREE from 'three';
import {rng,noise,smooth} from './math';
import {createTreeImpostor} from './tree-impostor';
import {treeImpostorDefinitions} from './tree-impostor-data';
import {createLandscapeSampler} from './landscape-sampler';

type Atlas={albedo:THREE.Texture,normals:THREE.Texture,visibility?:THREE.DataTexture|null};
/** Actual source-tree view geometry covers the remote ridges at far LOD. */
export function createDistantForest(terrain:THREE.Group,atlases:Atlas[]){
 const continuation=terrain.getObjectByName('continuous-coastal-extension');
 if(!(continuation instanceof THREE.Mesh))throw Error('Missing continuous terrain');
 const surface=createLandscapeSampler(continuation),random=rng(902174);
 const cells=new Map<string,Array<{x:number,y:number,z:number,scale:number,angle:number,family:number}>>();
 let count=0,rejectedSteep=0;
 const spacing=14;
 for(let z=-2800;z<=3600;z+=spacing)for(let x=-4200;x<=4200;x+=spacing){
  const px=x+(random()-.5)*spacing*.88,pz=z+(random()-.5)*spacing*.88;
  const outside=Math.hypot(Math.max(0,Math.abs(px)-600),Math.max(0,Math.abs(pz)-800));
  if(outside<4||outside>3600)continue;
  const ground=surface(px,pz);if(!ground||ground.height<9||ground.height>720)continue;
  if(ground.slope>2.5){rejectedSteep++;continue;}
  const patch=noise(px*.006,pz*.006);
  const slopeSurvival=1-smooth(.9,2.5,ground.slope)*.80;
  const distanceFade=1-smooth(2800,3600,outside);
  if(random()>(.50+.50*patch)*slopeSurvival*distanceFade)continue;
  const family=random()<.23?1:0,scale=.76+random()*.60;
  const item={x:px,y:ground.height-.12,z:pz,scale,angle:random()*Math.PI*2,family};
  const key=[Math.floor(px/300),Math.floor(pz/300),family].join(',');
  if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(item);count++;
 }
 const group=new THREE.Group();group.name='distant-source-forest';
 const object=new THREE.Object3D(),color=new THREE.Color();
 for(const items of cells.values()){
  const family=items[0].family,atlas=atlases[family];
  const mesh=createTreeImpostor(treeImpostorDefinitions[family],atlas.albedo,atlas.normals,items.length,atlas.visibility);
  mesh.name='distant-crowns-'+group.children.length;
  for(let i=0;i<items.length;i++){
   const p=items[i];object.position.set(p.x,p.y,p.z);object.rotation.set(0,p.angle,0);object.scale.setScalar(p.scale);object.updateMatrix();
   mesh.setMatrixAt(i,object.matrix);
   color.setHSL(.24,.08,.86+noise(p.z,p.x)*.08);mesh.setColorAt(i,color);
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor!.needsUpdate=true;
  // These ranges lie outside the near sun-shadow volume. Their normal atlases
  // provide source crown response without submitting distant shadow overdraw.
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.computeBoundingSphere();
  if(mesh.boundingSphere)mesh.boundingSphere.radius+=2;
  group.add(mesh);
 }
 group.userData.stats={trees:count,cells:cells.size,triangles:count*2,rejectedSteep,grounding:'exact rendered annulus triangles',seed:902174};
 return group;
}
