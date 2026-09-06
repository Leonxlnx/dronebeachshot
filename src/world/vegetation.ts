import {EmbeddedImagePool} from '../render/embedded-image-pool';
import {createInstanceFrustumPacker} from '../render/instance-frustum-packing';
import {loadSourceVisibilityTexture} from '../render/source-sun-visibility';
import {createDistantForest} from './distant-forest';
import {WIND} from './weather';
import {createTreeImpostor} from './tree-impostor';
import {treeImpostorDefinitions} from './tree-impostor-data';
import {excludeAboveWaterInstancesFromRefraction} from '../render/refraction';
import {updateHabitatCanopy} from './habitat';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {treePlacements,type Placement} from './ecology';
import {noise} from './math';
import {activeLods,lodRanges,type QualityTier} from './lod';
import {prepareTreeMaterial,lodCamera,setVegetationQuality} from '../render/vegetation-material';
type Part={geometry:THREE.BufferGeometry,material:THREE.MeshStandardMaterial,depth:THREE.MeshDepthMaterial};
type Cell={bounds:THREE.Sphere,lods:THREE.Group[],family:number,placements:Placement[]};
export async function createVegetation(progress:(p:number,label:string)=>void,terrain?:THREE.Group){
 const loader=new GLTFLoader(),imagePool=new EmbeddedImagePool();
 const paths=['island-tree-near.glb','island-tree-hero.glb','island-tree-medium.glb','island-tree-far.glb','syringa-tree-near.glb','syringa-tree-hero.glb','syringa-tree-medium.glb','syringa-tree-far.glb','palm-tree.glb'];
 const textureLoader=new THREE.TextureLoader();
 const farTextures=await Promise.all(['island','syringa'].map(async family=>{
  const base='/assets/impostors/'+family;
  const [albedo,normals,visibility]=await Promise.all([
   textureLoader.loadAsync(base+'-albedo.png'),
   textureLoader.loadAsync(base+'-normal.png'),
   loadSourceVisibilityTexture(base+'-visibility.rg8')
  ]);
  return {albedo,normals,visibility};
 }));
 const parts:Part[][]=[];
const treeHeights = [{value:1}, {value:1}, {value:1}];
 for(let index=0;index<paths.length;index++){
  // Actual source-tree view atlases supply far LOD; skip loading obsolete cards.
  if(index===3||index===7){parts.push([]);continue;}
  const gltf=await loader.loadAsync('/assets/models/'+paths[index]);gltf.scene.updateMatrixWorld(true);await imagePool.share(gltf.scene,gltf.parser);
  const scale=index===8?21/10.99348258972168:index>=4?14/4.556740965694189:18/3.4;
  const primitives:Part[]=[];
const familyIndex = index === 8 ? 2 : index >= 4 ? 1 : 0;
const heightUniform = treeHeights[familyIndex];
const isHeightSource = index === 0 || index === 4 || index === 8;
let crownY = 0;
  gltf.scene.traverse(object=>{
   if(!(object instanceof THREE.Mesh))return;
   if(Array.isArray(object.material))throw Error('Tree primitive must have one material');
   const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);geometry.scale(scale,scale,scale);
if (isHeightSource) {
  geometry.computeBoundingBox();
  crownY = Math.max(crownY, geometry.boundingBox!.max.y);
}
const response = {
  height: heightUniform,
  thinLeaf: index !== 8 && object.material.alphaTest > 0
};
const {material,depth} = prepareTreeMaterial(
  object.material, index === 8 ? -1 : index % 4, response);
   primitives.push({geometry,material,depth});
   // New vertex data was copied. Original loader geometry can be released.
   object.geometry.dispose();
  });
if (isHeightSource) {
  if (!(crownY > 0)) throw Error('Missing root-relative tree crown height');
  heightUniform.value = crownY;
}
  parts.push(primitives);progress(44+index*3,'Preparing forest detail');
 }
 imagePool.clear();
 const placements=treePlacements();updateHabitatCanopy(placements);const bins=new Map<string,Placement[]>();
 for(const plant of placements){const key=[Math.floor(plant.x/100),Math.floor(plant.z/100),plant.family].join(',');const list=bins.get(key)||[];list.push(plant);bins.set(key,list)}
 const instanceFrustumPacker=createInstanceFrustumPacker();
 const group=new THREE.Group();group.name='forest';const distant=terrain?createDistantForest(terrain,farTextures):null;if(distant)group.add(distant);const cells:Cell[]=[];const dummy=new THREE.Object3D();const up=new THREE.Vector3(0,1,0),windAxis=new THREE.Vector3(WIND[1],0,-WIND[0]).normalize(),tilt=new THREE.Quaternion();
 for(const [key,list] of bins){
  const family=Number(key.split(',')[2]),rootBox=new THREE.Box3();
  for(const p of list)rootBox.expandByPoint(new THREE.Vector3(p.x,p.y,p.z));
  const cell:Cell={bounds:rootBox.getBoundingSphere(new THREE.Sphere()),lods:[],family,placements:list};
  for(let lod=0;lod<(family===2?1:4);lod++){
   const level=new THREE.Group();level.name=`trees-${key}-lod-${lod}`;level.userData.lod=lod;
   const meshes=family!==2&&lod===3
    ?[createTreeImpostor(treeImpostorDefinitions[family],farTextures[family].albedo,farTextures[family].normals,list.length,farTextures[family].visibility)]
    :parts[family===2?8:family*4+lod].map(part=>{
      const mesh=new THREE.InstancedMesh(part.geometry,part.material,list.length);
      mesh.customDepthMaterial=part.depth;return mesh;
     });
   for(const mesh of meshes){
    for(let i=0;i<list.length;i++){
     const p=list[i];
     dummy.position.set(p.x,p.y,p.z);const lean=p.variant===2?.055*p.exposure:.016;dummy.quaternion.setFromAxisAngle(up,p.angle).premultiply(tilt.setFromAxisAngle(windAxis,lean));
     dummy.scale.set(p.scale*(1+p.variant*.06),p.scale,p.scale);dummy.updateMatrix();
     mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color().setHSL(.23+noise(p.x,p.z)*.035,.11,.82+noise(p.z,p.x)*.1));
    }
    if(family!==2){mesh.userData.sourceMatrices=mesh.instanceMatrix.array.slice();mesh.userData.sourceColors=mesh.instanceColor?.array.slice();mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage)}
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    // Cast through the same coverage function at every LOD, avoiding abrupt missing shadows.
    mesh.castShadow=true;mesh.receiveShadow=true;
    excludeAboveWaterInstancesFromRefraction(mesh);
    mesh.computeBoundingSphere();if(mesh.boundingSphere)mesh.boundingSphere.radius+=2;
    level.add(mesh);
    if(family!==2)instanceFrustumPacker.register(mesh);
   }
   level.visible=false;group.add(level);cell.lods.push(level);
  }
  cells.push(cell);
 }
 let tier:QualityTier='balanced';
 function update(position:THREE.Vector3){
  lodCamera.value.copy(position);
  for(const cell of cells){
   const centerDistance=cell.bounds.center.distanceTo(position),min=Math.max(0,centerDistance-cell.bounds.radius),max=centerDistance+cell.bounds.radius;
   const active=cell.family===2?[true]:activeLods(min,max,tier);
   cell.lods.forEach((lod,i)=>lod.visible=active[i]);
   // A cell can cross several transition bands. Submit only roots contributing
   // to each LOD; pixel discard alone still executes all other tree vertices.
   if(cell.family!==2){
    const [a,b,c,d,e,f]=lodRanges[tier];
    const limits:[[number,number],[number,number],[number,number],[number,number]]=[[0,b],[a,d],[c,f],[e,Infinity]];
    for(let lodIndex=0;lodIndex<4;lodIndex++){
    if(!active[lodIndex])continue;
    const selected:number[]=[],[start,end]=limits[lodIndex];
    cell.placements.forEach((p,i)=>{const distance=Math.hypot(p.x-position.x,p.y-position.y,p.z-position.z);if(tier==='low'||distance>=start&&distance<end)selected.push(i)});
    for(const object of cell.lods[lodIndex].children){const mesh=object as THREE.InstancedMesh;
     if(mesh.userData.sourceShadowTwin)continue;
     const matrices=mesh.userData.sourceMatrices as Float32Array,colors=mesh.userData.sourceColors as Float32Array|undefined;
     selected.forEach((index,i)=>{(mesh.instanceMatrix.array as Float32Array).set(matrices.subarray(index*16,index*16+16),i*16);if(colors&&mesh.instanceColor)(mesh.instanceColor.array as Float32Array).set(colors.subarray(index*3,index*3+3),i*3)});
     instanceFrustumPacker.setLODIndices(mesh,selected);
     mesh.count=selected.length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
     // The original full-cell bounds remain conservative after packing a subset.
    }
    }
   }
  }
 }
 return {imageSharing:imagePool.stats,prepareMain:instanceFrustumPacker.prepareMain,prepareSunShadow:instanceFrustumPacker.prepareSunShadow,disposeVisibility:instanceFrustumPacker.dispose,group,placements,farTextures,distantCount:distant?.userData.stats.trees??0,distantStats:distant?.userData.stats??null,update,setTier:(value:QualityTier)=>{tier=value;setVegetationQuality(value)},count:placements.length,cells:cells.length};
}
