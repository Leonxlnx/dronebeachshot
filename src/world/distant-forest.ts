import * as THREE from 'three';
import {rng,noise,smooth} from './math';
import {createTreeImpostor} from './tree-impostor';
import {treeImpostorDefinitions} from './tree-impostor-data';
import {createLandscapeSampler} from './landscape-sampler';
import {treeTint} from './tree-palette';

type Atlas={albedo:THREE.Texture,normals:THREE.Texture,visibility?:THREE.DataTexture|null};
type DistantPlacement={x:number,y:number,z:number,scale:number,angle:number,family:number};
type Surface=(x:number,z:number)=>{height:number,slope:number}|null;
export const distantForestDensity=Object.freeze({candidateSpacing:8,nearSpacing:8,midSpacing:9,farSpacing:14,
 nearBlendStart:400,nearBlendEnd:1200,farBlendEnd:2600,minimumRootDistance:3.5});
/** Root density only: the original crown assets, coverage and light response are unchanged.
 * An 8 m candidate lattice approaches the core's 117 stems/ha gross density.
 * Smooth acceptance thinning reaches the old 14 m density before its outer fade.
 */
export function createDistantPlacements(surface:Surface){
 const random=rng(902174),placements:DistantPlacement[]=[];
 const {candidateSpacing:spacing,minimumRootDistance:clearance,nearSpacing,midSpacing,farSpacing,
  nearBlendStart,nearBlendEnd,farBlendEnd}=distantForestDensity;
 const rootCells=new Map<string,DistantPlacement[]>();
 const densityBands=[{outsideMin:4,outsideMax:400,trees:0},{outsideMin:400,outsideMax:1200,trees:0},
  {outsideMin:1200,outsideMax:2600,trees:0},{outsideMin:2600,outsideMax:3600,trees:0}];
 let rejectedSteep=0,rejectedCrowding=0;
 for(let z=-2800;z<=3600;z+=spacing)for(let x=-4200;x<=4200;x+=spacing){
  const px=x+(random()-.5)*spacing*.88,pz=z+(random()-.5)*spacing*.88;
  const outside=Math.hypot(Math.max(0,Math.abs(px)-600),Math.max(0,Math.abs(pz)-800));
  if(outside<4||outside>3600)continue;
  const ground=surface(px,pz);if(!ground||ground.height<9||ground.height>720)continue;
  if(ground.slope>2.5){rejectedSteep++;continue;}
  const patch=noise(px*.006,pz*.006);
  const slopeSurvival=1-smooth(.9,2.5,ground.slope)*.80;
  const distanceFade=1-smooth(2800,3600,outside);
  const targetSpacing=nearSpacing+(midSpacing-nearSpacing)*smooth(nearBlendStart,nearBlendEnd,outside)
   +(farSpacing-midSpacing)*smooth(nearBlendEnd,farBlendEnd,outside);
  const densitySurvival=(spacing/targetSpacing)**2;
  if(random()>(.50+.50*patch)*slopeSurvival*distanceFade*densitySurvival)continue;
  // A jittered cell lattice alone can put adjacent roots less than a metre apart.
  // Enforce real root separation while allowing the source crowns to overlap.
  const cx=Math.floor(px/clearance),cz=Math.floor(pz/clearance);
  let crowded=false;
  for(let dz=-1;dz<=1&&!crowded;dz++)for(let dx=-1;dx<=1&&!crowded;dx++)
   for(const p of rootCells.get((cx+dx)+','+(cz+dz))??[])
    if((p.x-px)**2+(p.z-pz)**2<clearance*clearance){crowded=true;break;}
  if(crowded){rejectedCrowding++;continue;}
  const family=random()<.23?1:0,scale=.76+random()*.60;
  const item={x:px,y:ground.height-.12,z:pz,scale,angle:random()*Math.PI*2,family};
  placements.push(item);
  const rootKey=cx+','+cz,list=rootCells.get(rootKey)??[];list.push(item);rootCells.set(rootKey,list);
  densityBands.find(b=>outside>=b.outsideMin&&outside<=b.outsideMax)!.trees++;
 }
 return {placements,rejectedSteep,rejectedCrowding,densityBands};
}
/** Actual source-tree view geometry covers the remote ridges at far LOD. */
export function createDistantForest(terrain:THREE.Group,atlases:Atlas[]){
 const continuation=terrain.getObjectByName('continuous-coastal-extension');
 if(!(continuation instanceof THREE.Mesh))throw Error('Missing continuous terrain');
 const {placements,rejectedSteep,rejectedCrowding,densityBands}=createDistantPlacements(createLandscapeSampler(continuation));
 const cells=new Map<string,DistantPlacement[]>();
 for(const item of placements){
  const key=[Math.floor(item.x/300),Math.floor(item.z/300),item.family].join(',');
  if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(item);
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
   mesh.setColorAt(i,treeTint(p.x,p.z,p.family,color));
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor!.needsUpdate=true;
  // These ranges lie outside the near sun-shadow volume. Their normal atlases
  // provide source crown response without submitting distant shadow overdraw.
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.computeBoundingSphere();
  if(mesh.boundingSphere)mesh.boundingSphere.radius+=2;
  group.add(mesh);
 }
 group.userData.stats={trees:placements.length,cells:cells.size,triangles:placements.length*2,rejectedSteep,rejectedCrowding,
  density:distantForestDensity,densityBands,grounding:'exact rendered annulus triangles',seed:902174};
 return group;
}
