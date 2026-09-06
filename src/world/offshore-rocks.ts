import * as THREE from 'three';
import {rng,shoreZ,shoreDistance} from './math';
import {coastNormal} from './coastal';
import {renderedTerrainHeight} from './terrain-surface';
import {pathPosition,evaluationCameras} from '../camera/cinematic';
import {createRockMaterial} from '../render/ground-materials';
import type {Textures} from '../render/materials';

// Attached to headland toes rather than randomly peppered across the bay.
// Negative distance is seaward; individual groups taper into submerged rubble.
const clusters=[
 {x:-210,d:-12,size:9,count:6}, {x:-285,d:-22,size:11,count:7},
 {x:-375,d:-14,size:8,count:5}, {x:208,d:-11,size:8.5,count:6},
 {x:282,d:-18,size:12,count:7}, {x:360,d:-25,size:10,count:6},
] as const;

/** Visible scans and worker collision geometry use this identical assembly. */
export function createOffshoreRocks(textures:Textures,source:THREE.Group){
 const root=new THREE.Group();root.name='headland-tidal-rocks';
 const sources:THREE.Mesh[]=[];
 source.traverse(object=>{if(object instanceof THREE.Mesh)sources.push(object)});
 sources.sort((a,b)=>a.name.localeCompare(b.name));
 if(sources.length!==6)throw Error('Offshore geology requires the six original rock scans');
 const variants=[0,1,2,4,5]; // The fourth original scan has an open boundary.
 const geometries=variants.map(index=>{
  const geometry=sources[index].geometry.clone();geometry.computeBoundingBox();
  const center=geometry.boundingBox!.getCenter(new THREE.Vector3());
  geometry.translate(-center.x,-center.y,-center.z);geometry.computeBoundingBox();return geometry;
 });
 const material=createRockMaterial(textures),random=rng(962701);
 const routes=Array.from({length:401},(_,i)=>pathPosition(i*.05));
 const cameras=Object.values(evaluationCameras).map(camera=>camera.position);
 const batches:THREE.Matrix4[][]=variants.map(()=>[]),records=[];
 const object=new THREE.Object3D(),vertex=new THREE.Vector3(),size=new THREE.Vector3();
 for(const [clusterIndex,cluster] of clusters.entries()){
  const [nx,nz]=coastNormal(cluster.x),tx=nz,tz=-nx;
  for(let i=0;i<cluster.count;i++){
   const along=(i-(cluster.count-1)*.5)*4.3+(random()-.5)*3;
   const seaward=cluster.d-(i%3)*3.7+(random()-.5)*3;
   const x=cluster.x+nx*seaward+tx*along,z=shoreZ(cluster.x)+nz*seaward+tz*along;
   const distance=shoreDistance(x,z);
   if(distance>0||distance<-60)continue;
   const variant=(clusterIndex*3+i)%variants.length,geometry=geometries[variant];
   const extent=geometry.boundingBox!.getSize(size);
   const diameter=cluster.size*(i===0?1:.30+.53*random());
   object.scale.setScalar(diameter/Math.max(extent.x,extent.z));
   object.rotation.set((random()-.5)*.18,Math.atan2(tx,tz)+(random()-.5)*1.3,(random()-.5)*.16);
   object.position.set(x,0,z);object.updateMatrix();
   // Bury an actual sampled portion of the scan, following the rendered seabed
   // triangles. A centre-height or sphere placement can float at sloped toes.
   const position=geometry.getAttribute('position'),offsets:number[]=[];
   for(let v=0;v<position.count;v+=4){
    vertex.fromBufferAttribute(position,v).applyMatrix4(object.matrix);
    offsets.push(vertex.y-renderedTerrainHeight(vertex.x,vertex.z));
   }
   offsets.sort((a,b)=>a-b);object.position.y=-offsets[Math.floor(offsets.length*.32)];
   object.updateMatrix();
   const box=geometry.boundingBox!.clone().applyMatrix4(object.matrix);
   const clearance=Math.min(...routes.map(p=>box.distanceToPoint(p)),...cameras.map(p=>box.distanceToPoint(p)));
   if(clearance<5)continue;
   batches[variant].push(object.matrix.clone());
   records.push({cluster:clusterIndex,variant:variants[variant],center:[x,object.position.y,z],diameter,
    shoreDistance:distance,routeAndCameraClearance:clearance,
    minimumPenetration:-(offsets[0]+object.position.y),
    maximumProtrusion:offsets[offsets.length-1]+object.position.y,
    min:box.min.toArray(),max:box.max.toArray()});
  }
 }
 batches.forEach((matrices,index)=>{
  if(!matrices.length){geometries[index].dispose();return}
  const mesh=new THREE.InstancedMesh(geometries[index],material,matrices.length);
  mesh.name=`tidal-scan-${variants[index]}`;mesh.castShadow=mesh.receiveShadow=true;
  matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.computeBoundingSphere();root.add(mesh);
 });
 root.userData.offshoreRocks={clusters:clusters.length,instances:records.length,records};
 return root;
}
