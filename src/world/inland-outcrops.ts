/** Fit a bounded cohort of original inland scans without changing the coast. */
import * as THREE from 'three';
import {upgradeNearRockOutcrops} from './photogrammetry-rocks';
import {renderedTerrainHeight as height} from './terrain-surface';
import {shoreDistance} from './math';
import {treePlacements,type Placement} from './ecology';
import {pathPosition,evaluationCameras} from '../camera/cinematic';

type RootConstraint={tree:number,loweredBy:number};
type OriginalOutcrop={id:string,mesh:THREE.InstancedMesh,index:number,matrix:THREE.Matrix4,center:THREE.Vector3,scale:THREE.Vector3,yaw:number,shore:number,exposure:number,box:THREE.Box3};
type FittedOutcrop={item:OriginalOutcrop,variant:number,geometry:THREE.BufferGeometry,matrix:THREE.Matrix4,uniformScale:number,box:THREE.Box3,exposure:number,penetration:number,rootConstraints:RootConstraint[]};
type RejectedFit={id:string,reason:string,uniformScale?:number,exposure?:number,rootConstraints?:RootConstraint[]};

export const excludedUpperWoodFits=Object.freeze(['fractured-bedrock-5:9','fractured-bedrock-0:10','fractured-bedrock-0:23']);
const variants=[0,1,2,4,5];
export const inlandRockSettings=Object.freeze({minimumOldExposure:25,maximumReplacements:24,minimumShoreDistance:55,minimumGroundHeight:65,maximumUniformScale:4.8,maximumVertexExposure:12,embedQuantile:.60,rootCylinderRadius:2.75,rootFloor:-.4});
const key=(mesh:THREE.InstancedMesh,index:number)=>`${mesh.name}:${index}`;
function sourceGeometries(source:THREE.Group){const meshes:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]=[];source.traverse(m=>{if(m instanceof THREE.Mesh){if(!(m.material instanceof THREE.MeshStandardMaterial))throw Error('Rock source requires one standard material per mesh');meshes.push(m as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>)}});meshes.sort((a,b)=>a.name.localeCompare(b.name));if(meshes.length!==6)throw Error('Expected six original scans');return {meshes,geometries:meshes.map(m=>{const g=m.geometry.clone();g.computeBoundingBox();const c=g.boundingBox!.getCenter(new THREE.Vector3()),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)-c.x,p.getY(i)-c.y,p.getZ(i)-c.z);g.computeBoundingBox();g.computeBoundingSphere();return g})};}
function actualBounds(geometry:THREE.BufferGeometry,matrix:THREE.Matrix4){const box=new THREE.Box3(),point=new THREE.Vector3(),p=geometry.attributes.position;for(let i=0;i<p.count;i++)box.expandByPoint(point.fromBufferAttribute(p,i).applyMatrix4(matrix));return box;}

export function upgradeRockOutcrops(geology:THREE.Group,source:THREE.Group,{settings=inlandRockSettings,trees=treePlacements()}:{settings?:typeof inlandRockSettings,trees?:readonly Placement[]}={}){
 const matrix=new THREE.Matrix4(),point=new THREE.Vector3(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),euler=new THREE.Euler(),original:OriginalOutcrop[]=[];
 geology.traverse(mesh=>{if(!(mesh instanceof THREE.InstancedMesh)||!mesh.name.startsWith('fractured-bedrock-'))return;mesh.geometry.computeBoundingBox();for(let index=0;index<mesh.count;index++){
  mesh.getMatrixAt(index,matrix);matrix.decompose(position,rotation,scale);euler.setFromQuaternion(rotation,'YXZ');
  const y=height(position.x,position.z),shore=shoreDistance(position.x,position.z),p=mesh.geometry.attributes.position;
  let exposure=-Infinity;for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(matrix);exposure=Math.max(exposure,point.y-height(point.x,point.z));}
  original.push({id:key(mesh,index),mesh,index,matrix:matrix.clone(),center:new THREE.Vector3(position.x,y,position.z),scale:scale.clone(),yaw:euler.y,shore,exposure,box:mesh.geometry.boundingBox!.clone().applyMatrix4(matrix)});
 }});
 // Run the exact existing pass first. No changed focus list, ranking or ordinal.
 const near=upgradeNearRockOutcrops(geology,source,{terrainHeight:height,focusPoints:[...Array.from({length:81},(_,i)=>pathPosition(i*.25)),...Object.values(evaluationCameras).map(c=>c.position)]});
 const preserved=new Set((near.stats.details as {originalMesh:string,originalIndex:number}[]).map(d=>`${d.originalMesh}:${d.originalIndex}`));
 const candidates=original.filter(p=>!preserved.has(p.id)&&p.shore>settings.minimumShoreDistance&&p.center.y>settings.minimumGroundHeight&&p.scale.y>10&&p.exposure>settings.minimumOldExposure).sort((a,b)=>b.exposure-a.exposure||a.id.localeCompare(b.id));
 const {meshes,geometries}=sourceGeometries(source),object=new THREE.Object3D(),accepted:FittedOutcrop[]=[],rejected:RejectedFit[]=[];
 for(const item of candidates){if(accepted.length>=settings.maximumReplacements)break;
  const hash=[...item.id].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261),variant=variants[hash%variants.length],geometry=geometries[variant];
  const dx=(height(item.center.x+2,item.center.z)-height(item.center.x-2,item.center.z))*.25,dz=(height(item.center.x,item.center.z+2)-height(item.center.x,item.center.z-2))*.25;
  const slope=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(-dx,1,-dz).normalize()).slerp(new THREE.Quaternion(),.15);
  object.position.set(0,0,0);object.quaternion.copy(slope).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),item.yaw+(variant===0||variant===4?Math.PI*.5:0)));object.scale.setScalar(1);object.updateMatrix();
  const rotated=actualBounds(geometry,object.matrix);
  const uniformScale=Math.min(settings.maximumUniformScale,(item.box.max.x-item.center.x)*.94/rotated.max.x,(item.center.x-item.box.min.x)*.94/-rotated.min.x,(item.box.max.z-item.center.z)*.94/rotated.max.z,(item.center.z-item.box.min.z)*.94/-rotated.min.z);
  if(!Number.isFinite(uniformScale)||uniformScale<1.2){rejected.push({id:item.id,reason:'small horizontal envelope',uniformScale});continue;}
  object.scale.setScalar(uniformScale);object.position.set(item.center.x,0,item.center.z);object.updateMatrix();
  const localBox=actualBounds(geometry,object.matrix),p=geometry.attributes.position,deltas=[];
  for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(object.matrix);deltas.push(point.y-height(point.x,point.z));}deltas.sort((a,b)=>a-b);
  let y=Math.min(-deltas[Math.floor(deltas.length*settings.embedQuantile)]-.01,item.box.max.y-localBox.max.y-.025,settings.maximumVertexExposure-deltas.at(-1)!);
  const rootConstraints:RootConstraint[]=[];
  for(let index=0;index<trees.length;index++){
   const tree=trees[index],r=settings.rootCylinderRadius*tree.scale,dx=Math.max(localBox.min.x-tree.x,0,tree.x-localBox.max.x),dz=Math.max(localBox.min.z-tree.z,0,tree.z-localBox.max.z);
   if(dx*dx+dz*dz>r*r)continue;
   // The entire scan box must be below this protected root corridor. This is
   // stronger than ray-only tests and does not assume the old box was safe.
   const limit=tree.y+settings.rootFloor-localBox.max.y;
   if(limit<y){rootConstraints.push({tree:index,loweredBy:y-limit});y=limit;}
  }
  const exposure=deltas.at(-1)!+y,penetration=-deltas[0]-y;
  if(exposure<.75){rejected.push({id:item.id,reason:'root-safe fit becomes buried',exposure,rootConstraints});continue;}
  object.position.y=y;object.updateMatrix();
  // Reproduce the actual Float32 instance matrix before measurements/final use.
  const finalMatrix=new THREE.Matrix4().fromArray(new Float32Array(object.matrix.elements));
  const finalBox=actualBounds(geometry,finalMatrix);
  accepted.push({item,variant,geometry,matrix:finalMatrix,uniformScale,box:finalBox,exposure,penetration,rootConstraints});
 }
 // Keep the source-reviewed cohort stable. These three fits touch actual upper
 // wood; exclude them after selection so lower-ranked slabs cannot refill it.
 for(let i=accepted.length-1;i>=0;i--)if(excludedUpperWoodFits.includes(accepted[i].item.id))accepted.splice(i,1);
 const removals=new Map<string,Set<string>>();for(const fit of accepted){if(!removals.has(fit.item.mesh.name))removals.set(fit.item.mesh.name,new Set());removals.get(fit.item.mesh.name)!.add(fit.item.matrix.elements.join(','));}
 for(const mesh of [...geology.children]){if(!(mesh instanceof THREE.InstancedMesh))continue;const selected=removals.get(mesh.name);if(!selected)continue;const keep=[];for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);if(!selected.has(matrix.elements.join(',')))keep.push(i);}
  const replacement=new THREE.InstancedMesh(mesh.geometry,mesh.material,keep.length);replacement.name=mesh.name;replacement.castShadow=mesh.castShadow;replacement.receiveShadow=mesh.receiveShadow;const color=new THREE.Color();keep.forEach((i,n)=>{mesh.getMatrixAt(i,matrix);replacement.setMatrixAt(n,matrix);if(mesh.instanceColor){mesh.getColorAt(i,color);replacement.setColorAt(n,color)}});replacement.computeBoundingSphere();geology.remove(mesh);geology.add(replacement);mesh.dispose();
 }
 const material=meshes[0].material.clone();material.name='inland-rock-moss-original-pbr';
 for(const variant of variants){const items=accepted.filter(p=>p.variant===variant);if(!items.length){geometries[variant].dispose();continue;}const mesh=new THREE.InstancedMesh(geometries[variant],material,items.length);mesh.name=`inland-scanned-outcrop-${variant}`;mesh.castShadow=mesh.receiveShadow=true;items.forEach((item,index)=>mesh.setMatrixAt(index,item.matrix));mesh.computeBoundingSphere();geology.add(mesh);}
 geometries[3].dispose();
 const stats={excludedUpperWoodFits,settings,candidateCount:candidates.length,accepted:accepted.length,rejected,nearPreserved:near.stats,records:accepted.map(f=>({id:f.item.id,sourceVariant:f.variant,sourceName:meshes[f.variant].name,originalCenter:f.item.center.toArray(),originalMatrix:f.item.matrix.toArray(),matrix:f.matrix.toArray(),uniformScale:f.uniformScale,oldExposure:f.item.exposure,newVertexExposure:f.exposure,penetration:f.penetration,oldBounds:{min:f.item.box.min.toArray(),max:f.item.box.max.toArray()},newBounds:{min:f.box.min.toArray(),max:f.box.max.toArray()},rootConstraints:f.rootConstraints,triangles:(f.geometry.index?.count??f.geometry.attributes.position.count)/3,removedTriangles:(f.item.mesh.geometry.index?.count??f.item.mesh.geometry.attributes.position.count)/3}))};
 geology.userData.inlandRocks=stats;return {group:geology,stats,accepted};
}
