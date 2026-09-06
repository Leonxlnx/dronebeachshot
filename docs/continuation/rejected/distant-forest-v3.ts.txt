import * as THREE from 'three';
import {noise} from './math';
import {createTreeImpostor} from './tree-impostor';
import {treeImpostorDefinitions} from './tree-impostor-data';
import {createLandscapeSampler} from './landscape-sampler';
import {createDistantForestLayout,DISTANT_FOREST,type DistantTree} from './distant-forest-layout';

type Atlas={albedo:THREE.Texture,normals:THREE.Texture,visibility?:THREE.DataTexture|null};
/** Actual source-tree view geometry covers the remote ridges at far LOD. */
export function createDistantForest(terrain:THREE.Group,atlases:Atlas[]){
 const continuation=terrain.getObjectByName('continuous-coastal-extension');
 if(!(continuation instanceof THREE.Mesh))throw Error('Missing continuous terrain');
 const surface=createLandscapeSampler(continuation);
 const layout=createDistantForestLayout(surface,treeImpostorDefinitions.map(source=>source.bounds.max[1]));
 const cells=new Map<string,DistantTree[]>();
 for(const item of layout.trees){
  const key=[Math.floor(item.x/DISTANT_FOREST.cellSize),Math.floor(item.z/DISTANT_FOREST.cellSize),item.family].join(',');
  if(!cells.has(key))cells.set(key,[]);
  cells.get(key)!.push(item);
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
   // Preserve the previous source-response multiplier to isolate structure.
   color.setHSL(.24,.08,.86+noise(p.z,p.x)*.08);mesh.setColorAt(i,color);
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor!.needsUpdate=true;
  // These ranges lie outside the near sun-shadow volume. Their normal atlases
  // provide source crown response without submitting distant shadow overdraw.
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.computeBoundingSphere();
  if(mesh.boundingSphere)mesh.boundingSphere.radius+=2;
  group.add(mesh);
 }
 group.userData.stats={...layout.stats,cells:cells.size};
 return group;
}
