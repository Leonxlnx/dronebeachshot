import * as THREE from 'three';

type Study={remoteFit?:boolean;remoteCasters?:boolean};
/** Fixed, inspection-only test of real mutual shadows on the opening headland.
 * Whole remote batches are retained, including their original atlas depth
 * material. The fit covers the selected batches and an upsun crown margin.
 * This local diagnostic does not claim complete terrain-horizon occlusion.
 */
export function createRemoteShadowStudy(sun:THREE.DirectionalLight,forest:THREE.Object3D){
 const camera=sun.shadow.camera;
 const original={position:sun.position.clone(),target:sun.target.position.clone(),
  left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom,near:camera.near,far:camera.far};
 const direction=original.position.clone().sub(original.target).normalize();
 const selected:Array<{mesh:THREE.InstancedMesh;wasCaster:boolean;bounds:THREE.Box3}>=[];
 const matrix=new THREE.Matrix4(),world=new THREE.Matrix4(),root=new THREE.Vector3(),box=new THREE.Box3();
 let instances=0;
 forest.updateWorldMatrix(true,true);
 const distant=forest.getObjectByName('distant-source-forest');
 distant?.traverse(object=>{
  if(!(object instanceof THREE.InstancedMesh))return;
  let hit=false;
  for(let i=0;i<object.count;i++){
   object.getMatrixAt(i,matrix);world.multiplyMatrices(object.matrixWorld,matrix);root.setFromMatrixPosition(world);
   if(root.x>=-2300&&root.x<=-650&&root.z>=-2150&&root.z<=-250){hit=true;break}
  }
  if(!hit)return;
  if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();
  const bounds=new THREE.Box3();
  for(let i=0;i<object.count;i++){
   object.getMatrixAt(i,matrix);world.multiplyMatrices(object.matrixWorld,matrix);
   box.copy(object.geometry.boundingBox!).applyMatrix4(world);bounds.union(box);
  }
  bounds.expandByScalar(2);instances+=object.count;
  selected.push({mesh:object,wasCaster:object.castShadow,bounds});
 });
 let remoteFit=false,remoteCasters=false;
 function fitCheck(){
  sun.updateWorldMatrix(true,false);sun.target.updateWorldMatrix(true,false);
  camera.updateProjectionMatrix();sun.shadow.updateMatrices(sun);
  const projection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  let maxNdc=0;
  for(const {bounds}of selected)for(const x of [bounds.min.x,bounds.max.x])
   for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    root.set(x,y,z).applyMatrix4(projection);
    maxNdc=Math.max(maxNdc,Math.abs(root.x),Math.abs(root.y),Math.abs(root.z));
   }
  return maxNdc;
 }
 function get(){return {remoteFit,remoteCasters,remoteBatches:selected.length,remoteInstances:instances,
  remoteCasterBoundsMaxNdc:remoteFit?fitCheck():null}}
 function set(settings:Study){
  for(const [key,value]of Object.entries(settings))
   if(!['remoteFit','remoteCasters'].includes(key)||typeof value!=='boolean')throw Error('Invalid remote shadow study setting: '+key);
  if(settings.remoteFit!==undefined){
   remoteFit=settings.remoteFit;
   if(remoteFit){
    sun.target.position.set(-1350,150,-1100);sun.position.copy(sun.target.position).addScaledVector(direction,2600);
    Object.assign(camera,{left:-1450,right:1550,bottom:-420,top:500,near:600,far:4400});
    const limit=fitCheck();if(limit>1.000001)throw Error('Remote shadow fit clips selected conservative caster bounds: '+limit);
   }else{
    sun.position.copy(original.position);sun.target.position.copy(original.target);
    Object.assign(camera,{left:original.left,right:original.right,top:original.top,bottom:original.bottom,near:original.near,far:original.far});
    camera.updateProjectionMatrix();
   }
  }
  if(settings.remoteCasters!==undefined){
   remoteCasters=settings.remoteCasters;
   for(const {mesh,wasCaster}of selected)mesh.castShadow=remoteCasters||wasCaster;
  }
  return get();
 }
 return {set,get};
}
