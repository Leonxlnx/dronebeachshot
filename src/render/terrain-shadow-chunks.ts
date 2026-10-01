import * as THREE from 'three';

/** Exact index partition for a static, single-material triangle mesh. Shared
 * source attributes remain immutable; every original triangle belongs to one
 * spatial bin. Bounds include all three vertices, not just the bin centre.
 */
export function partitionTerrainShadowGeometry(source:THREE.BufferGeometry,cellSize=512){
 if(!Number.isFinite(cellSize)||cellSize<=0)throw Error('Invalid terrain shadow cell size');
 const position=source.getAttribute('position'),index=source.getIndex();
 if(!position||position.itemSize!==3||!index||index.count%3||source.groups.length)
  throw Error('Terrain shadow partition requires an indexed, ungrouped triangle mesh');
 if(source.drawRange.start!==0||source.drawRange.count<index.count)
  throw Error('Terrain shadow partition requires the complete source draw range');
 if(Object.keys(source.morphAttributes).length)throw Error('Terrain shadow partition requires static vertices');
 const bins=new Map<string,{indices:number[];box:THREE.Box3}>();
 const point=new THREE.Vector3();
 for(let i=0;i<index.count;i+=3){
  const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
  const x=(position.getX(a)+position.getX(b)+position.getX(c))/3;
  const z=(position.getZ(a)+position.getZ(b)+position.getZ(c))/3;
  if(!Number.isFinite(x)||!Number.isFinite(z))throw Error('Invalid terrain shadow vertex');
  const key=Math.floor(x/cellSize)+','+Math.floor(z/cellSize);
  let bin=bins.get(key);if(!bin){bin={indices:[],box:new THREE.Box3()};bins.set(key,bin);}
  for(const vertex of [a,b,c]){
   point.fromBufferAttribute(position,vertex);
   if(!Number.isFinite(point.y))throw Error('Invalid terrain shadow height');
   bin.indices.push(vertex);bin.box.expandByPoint(point);
  }
 }
 return [...bins].map(([key,bin])=>{
  const geometry=new THREE.BufferGeometry();
  for(const [name,attribute]of Object.entries(source.attributes))geometry.setAttribute(name,attribute);
  // Keep original global vertex indices; neither positions nor winding change.
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(bin.indices),1));
  geometry.boundingBox=bin.box;
  geometry.boundingSphere=bin.box.getBoundingSphere(new THREE.Sphere());
  geometry.name='terrain sun cell '+key;
  return geometry;
 });
}

function disposePartition(geometry:THREE.BufferGeometry){
 // BufferGeometry.dispose also deletes its attributes' GPU buffers. Detach the
 // borrowed attributes first so the still-live main terrain keeps ownership.
 for(const name of Object.keys(geometry.attributes))geometry.deleteAttribute(name);
 geometry.dispose();
}

/** Inspection-only, lazy study. Normal rendering keeps the original mesh. On
 * enable, its shadow triangles move into bounded children; main/refraction
 * geometry and materials remain the original objects. Children have an empty
 * draw range outside the real sun pass and never submit a colour triangle.
 */
export function createTerrainShadowChunkStudy(source:THREE.Mesh,cellSize=512){
 if(source instanceof THREE.InstancedMesh||source instanceof THREE.SkinnedMesh||Array.isArray(source.material))
  throw Error('Terrain shadow study requires a static, single-material mesh');
 const originalCaster=source.castShadow,group=new THREE.Group();group.name='terrain shadow partition study';
 const meshes:THREE.Mesh[]=[];let enabled=false,disposed=false,submittedTriangles=0,submittedChunks=0;
 const sourceTriangles=(source.geometry.index?.count??0)/3;
 function get(){return {terrainChunks:enabled,terrainShadowSourceTriangles:sourceTriangles,
  terrainShadowChunks:meshes.length,terrainShadowSubmittedTriangles:enabled?submittedTriangles:null,
  terrainShadowSubmittedChunks:enabled?submittedChunks:null};}
 function set(value:boolean){
  if(disposed)throw Error('Terrain shadow study is disposed');
  if(typeof value!=='boolean')throw Error('Terrain shadow study setting must be boolean');
  if(value&&!meshes.length){
   for(const geometry of partitionTerrainShadowGeometry(source.geometry,cellSize)){
    const count=geometry.index!.count,mesh=new THREE.Mesh(geometry,source.material);
    mesh.name=geometry.name;mesh.castShadow=originalCaster;mesh.receiveShadow=false;
    mesh.customDepthMaterial=source.customDepthMaterial;mesh.customDistanceMaterial=source.customDistanceMaterial;
    mesh.layers.mask=source.layers.mask;geometry.setDrawRange(0,0);
    mesh.onBeforeRender=()=>{geometry.setDrawRange(0,0);};
    mesh.onBeforeShadow=()=>{geometry.setDrawRange(0,count);submittedTriangles+=count/3;submittedChunks++;};
    mesh.onAfterShadow=()=>{geometry.setDrawRange(0,0);};
    group.add(mesh);meshes.push(mesh);
   }
   source.add(group);
  }
  enabled=value;source.castShadow=value?false:originalCaster;group.visible=value;
  submittedTriangles=submittedChunks=0;return get();
 }
 function beginFrame(){
  submittedTriangles=submittedChunks=0;
  if(!enabled)return;
  for(const mesh of meshes){
   mesh.layers.mask=source.layers.mask;mesh.material=source.material;
   mesh.customDepthMaterial=source.customDepthMaterial;mesh.customDistanceMaterial=source.customDistanceMaterial;
   mesh.geometry.setDrawRange(0,0);
  }
 }
 function dispose(){
  if(disposed)return;
  source.castShadow=originalCaster;group.removeFromParent();
  for(const mesh of meshes)disposePartition(mesh.geometry);
  meshes.length=0;disposed=true;enabled=false;
 }
 group.visible=false;
 return {get,set,beginFrame,dispose};
}
