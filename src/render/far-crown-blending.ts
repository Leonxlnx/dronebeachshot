import * as THREE from 'three';
import {getFarCrownMaterialBlending,setFarCrownMaterialBlending,
 onFarCrownMaterialBlendingChange} from './far-crown-coverage';

// Inspection-only source-over study. One draw per existing cell is retained.
// Three sorts these transparent cells by their world bounding-sphere centers;
// we sort each cell's instances. Interleaving depth ranges across families/cells
// remains approximate. No renderOrder override may move crowns ahead of spray.
type Snapshot={matrices:Float32Array;colors?:Float32Array;count:number};
type Entry={mesh:THREE.InstancedMesh;baseline?:Snapshot;restore?:Snapshot;
 matrixVersion?:number;colorVersion?:number;depths:Float64Array;indices:number[];
 dispose:()=>void};
const entries=new Map<THREE.InstancedMesh,Entry>();
const viewWorld=new THREE.Matrix4(),projection=new THREE.Matrix4();
const frustum=new THREE.Frustum(),sphere=new THREE.Sphere();
let lastStats={meshes:0,instances:0,reordered:0,cpuMilliseconds:0};

function snapshot(mesh:THREE.InstancedMesh):Snapshot{
 return {matrices:(mesh.instanceMatrix.array as Float32Array).slice(0,mesh.count*16),
  colors:mesh.instanceColor?(mesh.instanceColor.array as Float32Array).slice(0,mesh.count*3):undefined,count:mesh.count};
}
function restore(entry:Entry){
 const {mesh}=entry,saved=entry.restore;
 // A later core prepareMain owns any newer upload version. Never replace its
 // newly culled prefix with the previous camera's saved subset.
 if(saved&&mesh.count===saved.count&&mesh.instanceMatrix.version===entry.matrixVersion
  &&mesh.instanceColor?.version===entry.colorVersion){
  (mesh.instanceMatrix.array as Float32Array).set(saved.matrices);mesh.instanceMatrix.needsUpdate=true;
  if(saved.colors&&mesh.instanceColor){(mesh.instanceColor.array as Float32Array).set(saved.colors);mesh.instanceColor.needsUpdate=true;}
 }
 entry.restore=undefined;
}
onFarCrownMaterialBlendingChange(value=>{if(!value)for(const entry of entries.values())restore(entry);});

/** Call only for actual atlas meshes. Registration precedes population in the
 * impostor factory, so remote source arrays are copied lazily at first prepare.
 * Core shadow twins are independent meshes and must never be registered.
 */
export function registerFarCrownBlendingMesh(mesh:THREE.InstancedMesh){
 if(entries.has(mesh))throw Error('Far crown blend mesh already registered');
 if(mesh.userData.sourceShadowTwin)throw Error('Do not register sun-only crown buffers');
 const entry:Entry={mesh,depths:new Float64Array(0),indices:[],dispose:()=>{
  restore(entry);entries.delete(mesh);mesh.removeEventListener('dispose',entry.dispose);
 }};
 entries.set(mesh,entry);mesh.addEventListener('dispose',entry.dispose);
}
function visible(mesh:THREE.Object3D){
 for(let object:THREE.Object3D|null=mesh;object;object=object.parent)if(!object.visible)return false;
 return true;
}
/** Call after vegetation.prepareMain(camera), immediately before the main scene
 * render. onBeforeRender is too late: Three uploads instanced attributes while
 * assembling the render list. Matrix/color tuples and conservative bounds stay
 * intact; roots and wind do not depend on packed order.
 */
export function prepareFarCrownBlending(camera:THREE.Camera){
 if(!getFarCrownMaterialBlending())return lastStats={meshes:0,instances:0,reordered:0,cpuMilliseconds:0};
 const start=performance.now();let meshes=0,instances=0,reordered=0;
 camera.updateWorldMatrix(true,false);projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
 frustum.setFromProjectionMatrix(projection,camera.coordinateSystem,camera.reversedDepth);
 for(const entry of entries.values()){
  const {mesh}=entry;if(!mesh.count||mesh.userData.sourceShadowTwin||!visible(mesh))continue;
  mesh.updateWorldMatrix(true,false);
  if(mesh.frustumCulled){
   if(!mesh.boundingSphere)mesh.computeBoundingSphere();
   sphere.copy(mesh.boundingSphere!).applyMatrix4(mesh.matrixWorld);
   if(!frustum.intersectsSphere(sphere))continue;
  }
  if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();
  const center=mesh.geometry.boundingSphere!.center;
  // Core main prefixes are freshly packed from immutable sourceMatrices.
  // Remote matrices have no packing owner; retain their initial full ordering
  // for seek-independent sorting and exact opt-out restoration.
  const core=mesh.userData.sourceMatrices instanceof Float32Array;
  const source=core?snapshot(mesh):(entry.baseline??=snapshot(mesh));
  if(source.count!==mesh.count)throw Error('Remote crown count changed after blend baseline capture');
  const count=mesh.count,m=source.matrices,c=source.colors;
  if(entry.depths.length<count)entry.depths=new Float64Array(count);
  entry.indices.length=count;viewWorld.multiplyMatrices(camera.matrixWorldInverse,mesh.matrixWorld);
  const v=viewWorld.elements;
  for(let i=0;i<count;i++){
   const o=i*16,x=m[o]*center.x+m[o+4]*center.y+m[o+8]*center.z+m[o+12];
   const y=m[o+1]*center.x+m[o+5]*center.y+m[o+9]*center.z+m[o+13];
   const z=m[o+2]*center.x+m[o+6]*center.y+m[o+10]*center.z+m[o+14];
   entry.depths[i]=v[2]*x+v[6]*y+v[10]*z+v[14];entry.indices[i]=i;
  }
  entry.indices.sort((a,b)=>{
   const depth=entry.depths[a]-entry.depths[b];if(depth)return depth;
   // Canonical immutable tuple tie-break is independent of earlier seek/pack
   // order. Identical tuples render identically; instance IDs are not used.
   for(let k=0;k<16;k++){const d=m[a*16+k]-m[b*16+k];if(d)return d;}
   if(c)for(let k=0;k<3;k++){const d=c[a*3+k]-c[b*3+k];if(d)return d;}
   return 0;
  });
  const target=mesh.instanceMatrix.array as Float32Array,color=mesh.instanceColor?.array as Float32Array|undefined;
  // Remote output may already be sorted, so compare against its current bytes
  // rather than using source-index identity as the changed test.
  let changed=false;
  for(let i=0;i<count&&!changed;i++){
   const from=entry.indices[i];
   for(let k=0;k<16;k++)if(target[i*16+k]!==m[from*16+k]){changed=true;break;}
   if(c&&color)for(let k=0;k<3;k++)if(color[i*3+k]!==c[from*3+k]){changed=true;break;}
  }
  if(changed){
   entry.restore=source;
   for(let i=0;i<count;i++){
    const from=entry.indices[i];target.set(m.subarray(from*16,from*16+16),i*16);
    if(c&&color)color.set(c.subarray(from*3,from*3+3),i*3);
   }
   mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   entry.matrixVersion=mesh.instanceMatrix.version;entry.colorVersion=mesh.instanceColor?.version;reordered++;
  }
  meshes++;instances+=count;
 }
 return lastStats={meshes,instances,reordered,cpuMilliseconds:performance.now()-start};
}
export function setFarCrownBlending(enabled:boolean){
 setFarCrownMaterialBlending(enabled);return getFarCrownBlending();
}
export function getFarCrownBlending(){
 return {enabled:getFarCrownMaterialBlending(),registeredMeshes:entries.size,...lastStats,
  ordering:'camera-depth within cells; Three bounding-sphere order across cells',
  scope:'core and remote integrated far-crown color only; original hashed depth unchanged'};
}
export function disposeFarCrownBlending(){
 setFarCrownMaterialBlending(false);
 for(const entry of [...entries.values()])entry.dispose();
 lastStats={meshes:0,instances:0,reordered:0,cpuMilliseconds:0};
}
