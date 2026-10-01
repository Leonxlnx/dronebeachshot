import * as THREE from 'three';
/** Conservative packing for noncasting ground cover only. Immutable source
 * tuples and a wind margin preserve every potentially visible instance. */
export function createGroundCoverCulling(group:THREE.Object3D){
 const entries:Array<{mesh:THREE.InstancedMesh;matrices:Float32Array;colors:Float32Array|null;bounds:THREE.Sphere[]}>=[];
 const matrix=new THREE.Matrix4(),sphere=new THREE.Sphere(),projection=new THREE.Matrix4(),frustum=new THREE.Frustum();
 group.traverse(object=>{
  if(!(object instanceof THREE.InstancedMesh)||object.castShadow)return;
  if(!object.geometry.boundingSphere)object.geometry.computeBoundingSphere();
  const matrices=new Float32Array(object.instanceMatrix.array.slice(0,object.count*16));
  const colors=object.instanceColor?new Float32Array(object.instanceColor.array.slice(0,object.count*3)):null;
  const bounds=[];for(let i=0;i<object.count;i++){matrix.fromArray(matrices,i*16);const bound=object.geometry.boundingSphere!.clone().applyMatrix4(matrix);bound.radius+=2;bounds.push(bound);}
  // Preserve a full-cohort object bound before any packed prefix is submitted.
  // Three otherwise computes its first bound from the first camera's subset.
  object.computeBoundingBox();object.computeBoundingSphere();object.boundingBox?.expandByScalar(2);if(object.boundingSphere)object.boundingSphere.radius+=2;
  object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);object.instanceColor?.setUsage(THREE.DynamicDrawUsage);
  entries.push({mesh:object,matrices,colors,bounds});
 });
 let enabled=true;
 function prepare(camera:THREE.Camera){
  camera.updateWorldMatrix(true,false);projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection,camera.coordinateSystem,camera.reversedDepth);
  let tested=0,kept=0;
  for(const {mesh,matrices,colors,bounds} of entries){
   mesh.updateWorldMatrix(true,false);let count=0;
   for(let i=0;i<bounds.length;i++){
    tested++;if(enabled&&!frustum.intersectsSphere(sphere.copy(bounds[i]).applyMatrix4(mesh.matrixWorld)))continue;
    (mesh.instanceMatrix.array as Float32Array).set(matrices.subarray(i*16,i*16+16),count*16);
    if(colors&&mesh.instanceColor)(mesh.instanceColor.array as Float32Array).set(colors.subarray(i*3,i*3+3),count*3);
    count++;
   }
   mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;kept+=count;
  }
  return {enabled,tested,kept,culled:tested-kept,meshes:entries.length};
 }
 return {prepare,setEnabled(value:boolean){enabled=value;},get enabled(){return enabled;}};
}
