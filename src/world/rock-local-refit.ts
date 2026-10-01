import * as THREE from 'three';
import {renderedTerrainHeight as currentHeight,renderedTerrainHeightBeforePrincipalFace as referenceHeight} from './terrain-surface';
import type {Placement} from './ecology';

type CohortMember={id:string,kind:'procedural'|'near-scan'|'inland-scan',sourceVariant?:number};
type RootConstraint={tree:number,loweredBy:number};
type RefitRecord={id:string,kind:CohortMember['kind'],mesh:string,originalIndex:number,affectedVertices:number,rootConstraints:RootConstraint[],shift:number,referenceMatrix:number[],matrix:number[],referenceExposure:number,exposure:number,penetration:number,buriedFraction:number,omitted:boolean,reason?:string,bounds:{min:number[],max:number[]}};
const roundingFloat=new Float32Array(1),roundingBits=new Uint32Array(roundingFloat.buffer);
function floorFloat32(value:number){roundingFloat[0]=value;if(roundingFloat[0]>value)roundingBits[0]+=value>=0?-1:1;return roundingFloat[0]}

/** Refit the already selected reference cohort, without new draws or replacements.
 * Shapes, X/Z, scale and orientation stay fixed. Only a touched instance's Y may
 * decrease. Offshore rocks are assembled afterwards and never enter this pass.
 */
export function refitRockCohort(geology:THREE.Group,trees:readonly Placement[],referenceTrees:readonly Placement[]){
 const referenceByXZ=new Map<string,{tree:Placement,index:number}>();
 for(const [index,tree] of referenceTrees.entries()){const key=tree.x+','+tree.z;if(referenceByXZ.has(key))throw Error('Duplicate reference rock-root X/Z identity');referenceByXZ.set(key,{tree,index})}
 const currentKeys=new Set<string>();
 const rootIdentities=trees.map(tree=>{const key=tree.x+','+tree.z;if(currentKeys.has(key))throw Error('Duplicate current rock-root X/Z identity');currentKeys.add(key);const original=referenceByXZ.get(key);if(!original)throw Error('Current rock-root identity is absent from reference cohort');return original});
 const matrix=new THREE.Matrix4(),world=new THREE.Matrix4(),point=new THREE.Vector3(),box=new THREE.Box3();
 const records:RefitRecord[]=[];let instances=0,untouched=0;
 geology.updateMatrixWorld(true);
 for(const mesh of [...geology.children]){
  if(!(mesh instanceof THREE.InstancedMesh))continue;
  const cohort=mesh.userData.rockCohort as CohortMember[]|undefined;
  if(!cohort)continue;
  if(cohort.length!==mesh.count)throw Error('Rock cohort metadata does not match instances');
  const position=mesh.geometry.attributes.position,keep:number[]=[];
  for(let instance=0;instance<mesh.count;instance++){
   instances++;const member=cohort[instance];mesh.getMatrixAt(instance,matrix);world.multiplyMatrices(mesh.matrixWorld,matrix);
   const referenceMatrix=matrix.toArray(),before:number[]=[],current:number[]=[];let affectedVertices=0;
   box.makeEmpty();
   for(let i=0;i<position.count;i++){
    point.fromBufferAttribute(position,i).applyMatrix4(world);box.expandByPoint(point);
    const oldHeight=referenceHeight(point.x,point.z),height=currentHeight(point.x,point.z);
    if(height!==oldHeight)affectedVertices++;
    before.push(point.y-oldHeight);current.push(point.y-height);
   }
   // A bordering scan can be constrained by lower actual roots even when none
   // of its sampled source vertices lie over changed terrain.
   let changedRootTouches=false;
   if(member.kind==='inland-scan')for(let i=0;i<trees.length;i++){
    const tree=trees[i];if(tree.y===rootIdentities[i].tree.y)continue;
    const radius=2.75*tree.scale,dx=Math.max(box.min.x-tree.x,0,tree.x-box.max.x),dz=Math.max(box.min.z-tree.z,0,tree.z-box.max.z);
    if(dx*dx+dz*dz<=radius*radius){changedRootTouches=true;break;}
   }
   if(!affectedVertices&&!changedRootTouches){untouched++;keep.push(instance);continue;}
   before.sort((a,b)=>a-b);current.sort((a,b)=>a-b);
   const referenceExposure=before.at(-1)!,quantile=Math.floor(current.length*.60),rootConstraints:RootConstraint[]=[];
   let shift:number;
   if(member.kind==='procedural'){
    // Retain origin embed, old60th-percentile burial and maximum exposed height.
    const origin=new THREE.Vector3().setFromMatrixPosition(world);
    shift=Math.min(0,currentHeight(origin.x,origin.z)-referenceHeight(origin.x,origin.z),before[quantile]-current[quantile],referenceExposure-current.at(-1)!);
   }else{
    shift=Math.min(0,-current[quantile]-(member.kind==='inland-scan'?.01:0));
    if(member.kind==='inland-scan'){
     shift=Math.min(shift,12-current.at(-1)!);
     for(let i=0;i<trees.length;i++){
      const tree=trees[i],radius=2.75*tree.scale,dx=Math.max(box.min.x-tree.x,0,tree.x-box.max.x),dz=Math.max(box.min.z-tree.z,0,tree.z-box.max.z);
      if(dx*dx+dz*dz>radius*radius)continue;
      const limit=tree.y-.4-box.max.y;
      if(limit<shift){rootConstraints.push({tree:rootIdentities[i].index,loweredBy:shift-limit});shift=limit;}
     }
    }
   }
   if(!mesh.matrixWorld.equals(new THREE.Matrix4()))throw Error('Local rock refit requires the untransformed assembly');
   // Round toward the ground so Float32 storage cannot break the embed quantile.
   matrix.elements[13]=floorFloat32(matrix.elements[13]+shift);
   const actualShift=matrix.elements[13]-referenceMatrix[13],exposure=current.at(-1)!+actualShift,penetration=-current[0]-actualShift;
   const buriedFraction=current.filter(delta=>delta+actualShift<=0).length/current.length;
   const minimumExposure=member.kind==='inland-scan'?.75:.12;
   const omitted=referenceExposure>=minimumExposure&&exposure<minimumExposure;
   box.min.y+=actualShift;box.max.y+=actualShift;
   records.push({id:member.id,kind:member.kind,mesh:mesh.name,originalIndex:instance,affectedVertices,rootConstraints,shift:actualShift,referenceMatrix,matrix:matrix.toArray(),referenceExposure,exposure,penetration,buriedFraction,omitted,...(omitted?{reason:'Local supported fit becomes buried; no replacement admitted'}:{}),bounds:{min:box.min.toArray(),max:box.max.toArray()}});
   if(!omitted){mesh.setMatrixAt(instance,matrix);keep.push(instance);}
  }
  if(keep.length<mesh.count){
   const replacement=new THREE.InstancedMesh(mesh.geometry,mesh.material,keep.length),color=new THREE.Color();
   replacement.name=mesh.name;replacement.castShadow=mesh.castShadow;replacement.receiveShadow=mesh.receiveShadow;
   keep.forEach((index,i)=>{mesh.getMatrixAt(index,matrix);replacement.setMatrixAt(i,matrix);if(mesh.instanceColor){mesh.getColorAt(index,color);replacement.setColorAt(i,color)}});
   replacement.userData={...mesh.userData,rockCohort:keep.map(i=>cohort[i])};replacement.computeBoundingSphere();
   geology.remove(mesh);geology.add(replacement);mesh.dispose();
  }else{mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
 }
 const inland=geology.userData.inlandRocks;
 if(inland){
  inland.referenceRecords=inland.records;inland.referenceAccepted=inland.accepted;
  const byId=new Map(records.filter(record=>record.kind==='inland-scan').map(record=>[record.id,record]));
  inland.records=inland.records.flatMap((record:any)=>{const refit=byId.get(record.id);return !refit?[record]:refit.omitted?[]:[{...record,matrix:refit.matrix,newVertexExposure:refit.exposure,penetration:refit.penetration,newBounds:refit.bounds,rootConstraints:refit.rootConstraints}]});
  inland.accepted=inland.records.length;
 }
 const near=geology.userData.photogrammetryRocks;
 if(near){
  near.referenceDetails=near.details;
  const byId=new Map(records.filter(record=>record.kind==='near-scan').map(record=>[record.id,record]));
  near.details=near.details.flatMap((record:any)=>{const refit=byId.get(`${record.originalMesh}:${record.originalIndex}`);return !refit?[record]:refit.omitted?[]:[{...record,center:refit.bounds.min.map((value:number,i:number)=>(value+refit.bounds.max[i])*.5),minimumPenetration:refit.penetration,maximumProtrusion:refit.exposure,newBounds:refit.bounds}]});
  near.upgraded=near.details.length;
  near.minimumPenetration=Math.min(...near.details.map((record:any)=>record.minimumPenetration));
  near.maximumProtrusion=Math.max(...near.details.map((record:any)=>record.maximumProtrusion));
 }
 const stats={instances,untouched,touched:records.length,omitted:records.filter(record=>record.omitted),records};
 geology.userData.localRockRefit=stats;return stats;
}
