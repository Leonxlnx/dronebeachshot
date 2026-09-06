import * as THREE from 'three';

type Entry={mesh:THREE.InstancedMesh,shadow:THREE.InstancedMesh,wasCaster:boolean,
 matrices:Float32Array,colors:Float32Array|undefined,bounds:Float64Array,lodIndices:readonly number[]};
/** Independent main/sun buffers avoid Three's cross-pass object-upload cache.
 * Geometry, material, custom depth material and source instance values are shared
 * or copied unchanged. Shadow twins never issue a color draw.
 */
export function createInstanceFrustumPacker(){
 const entries=new Map<THREE.InstancedMesh,Entry>();
 const instanceMatrix=new THREE.Matrix4(),sphere=new THREE.Sphere();
 const projection=new THREE.Matrix4(),mainFrustum=new THREE.Frustum();
 function register(mesh:THREE.InstancedMesh){
  if(entries.has(mesh))throw Error('Instance frustum packer registered twice');
  if(!mesh.parent)throw Error('Attach the main mesh before registering its shadow twin');
  const matrices=mesh.userData.sourceMatrices as Float32Array;
  const colors=mesh.userData.sourceColors as Float32Array|undefined;
  if(!(matrices instanceof Float32Array)||matrices.length%16)throw Error('Missing immutable source matrices');
  if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();
  const source=mesh.geometry.boundingSphere!,capacity=matrices.length/16;
  const bounds=new Float64Array(capacity*4);
  for(let i=0;i<capacity;i++){
   instanceMatrix.fromArray(matrices,i*16);sphere.copy(source).applyMatrix4(instanceMatrix);
   bounds.set([sphere.center.x,sphere.center.y,sphere.center.z,sphere.radius+2],i*4);
  }
  const shadow=new THREE.InstancedMesh(mesh.geometry,mesh.material,capacity);
  shadow.name=mesh.name+' / sun only';shadow.userData.sourceShadowTwin=true;
  shadow.customDepthMaterial=mesh.customDepthMaterial;shadow.customDistanceMaterial=mesh.customDistanceMaterial;
  shadow.matrixAutoUpdate=false;shadow.matrix.copy(mesh.matrix);shadow.layers.mask=mesh.layers.mask;
  shadow.boundingSphere=mesh.boundingSphere?.clone()??null;
  shadow.boundingBox=mesh.boundingBox?.clone()??null;shadow.frustumCulled=mesh.frustumCulled;
  shadow.castShadow=mesh.castShadow;shadow.receiveShadow=false;shadow.count=0;
  shadow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if(colors)shadow.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(colors.length),3).setUsage(THREE.DynamicDrawUsage);
  // Public color callbacks run after shadow rendering. Count-only changes need
  // no GPU buffer upload and do not alter the independent sun submission.
  let savedCount:number|undefined;
  shadow.onBeforeRender=()=>{savedCount=shadow.count;shadow.count=0};
  shadow.onAfterRender=()=>{if(savedCount!==undefined)shadow.count=savedCount;savedCount=undefined};
  mesh.parent.add(shadow);
  entries.set(mesh,{mesh,shadow,wasCaster:mesh.castShadow,matrices,colors,bounds,lodIndices:[]});
  mesh.castShadow=false;
  return shadow;
 }
 function setLODIndices(mesh:THREE.InstancedMesh,indices:readonly number[]){
  const entry=entries.get(mesh);if(!entry)throw Error('Unregistered core tree mesh');entry.lodIndices=indices;
 }
 function visible(mesh:THREE.Object3D){
  for(let object:THREE.Object3D|null=mesh;object;object=object.parent)if(!object.visible)return false;
  return true;
 }
 function prepare(frustum:THREE.Frustum,sunPass:boolean){
  let tested=0,kept=0,meshes=0;
  for(const entry of entries.values()){
   const {mesh,shadow,matrices,colors,bounds,lodIndices}=entry;
   shadow.visible=mesh.visible;
   if(!visible(mesh))continue;
   mesh.updateWorldMatrix(true,false);
   const target=sunPass?shadow:mesh;
   if(sunPass){shadow.matrix.copy(mesh.matrix);shadow.layers.mask=mesh.layers.mask;shadow.updateWorldMatrix(true,false)}
   let count=0;
   for(const index of lodIndices){
    const b=index*4;sphere.center.set(bounds[b],bounds[b+1],bounds[b+2]);sphere.radius=bounds[b+3];sphere.applyMatrix4(mesh.matrixWorld);tested++;
    if(!frustum.intersectsSphere(sphere))continue;
    (target.instanceMatrix.array as Float32Array).set(matrices.subarray(index*16,index*16+16),count*16);
    if(colors&&target.instanceColor)(target.instanceColor.array as Float32Array).set(colors.subarray(index*3,index*3+3),count*3);
    count++;
   }
   target.count=count;target.instanceMatrix.needsUpdate=true;
   if(colors&&target.instanceColor)target.instanceColor.needsUpdate=true;
   kept+=count;meshes++;
  }
  return {tested,kept,culled:tested-kept,meshes};
 }
 function prepareMain(camera:THREE.Camera){
  camera.updateWorldMatrix(true,false);projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  mainFrustum.setFromProjectionMatrix(projection,camera.coordinateSystem,camera.reversedDepth);
  return prepare(mainFrustum,false);
 }
 function prepareSunShadow(sun:THREE.DirectionalLight){
  sun.updateWorldMatrix(true,false);sun.target.updateWorldMatrix(true,false);
  // The renderer normally initializes this on first shadow-map allocation,
  // which is later than this CPU cull. Use the actual configured bounds now.
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.updateMatrices(sun);
  return prepare(sun.shadow.getFrustum(),true);
 }
 function dispose(){
  for(const {mesh,shadow,wasCaster}of entries.values()){
   mesh.castShadow=wasCaster;shadow.removeFromParent();shadow.dispose();
   // Shared geometry/material/depth are owned by the main scene; do not dispose.
  }
  entries.clear();
 }
 return {register,setLODIndices,prepareMain,prepareSunShadow,dispose};
}
