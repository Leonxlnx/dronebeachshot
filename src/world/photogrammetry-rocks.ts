import * as THREE from 'three';

export type PhotogrammetryRockOptions = {
 terrainHeight:(x:number,z:number)=>number;
 focusPoints:THREE.Vector3[];
 maximumInstances?:number;
 radius?:number;
 mediumIndices?:Array<Uint16Array>;
};

// Called once after loading the original CC0 rock_moss_set_01_2k.glb, before
// coastal-field rasterization and the existing cloud-lighting material pass.
// It upgrades existing geological placements; it does not scatter more rocks.
export function upgradeNearRockOutcrops(geology:THREE.Group,source:THREE.Group,
 options:PhotogrammetryRockOptions){
 const {terrainHeight,focusPoints,mediumIndices}=options;
 if(!focusPoints.length)throw new Error('Rock upgrade needs authored focus positions');
 const maximum=options.maximumInstances??48,radius=options.radius??180;
 const sourceMeshes:THREE.Mesh[]=[];source.traverse(o=>{if(o instanceof THREE.Mesh)sourceMeshes.push(o)});
 sourceMeshes.sort((a,b)=>a.name.localeCompare(b.name));
 if(sourceMeshes.length!==6)throw new Error('Expected the six original Rock Moss Set 01 meshes');
 // Variant 04 has 18 small boundary edges in the original scan. Use the five
 // completely closed scans for exposed outcrop silhouettes; no repair invented.
 const variants=[0,1,2,4,5],material=(sourceMeshes[0].material as THREE.MeshStandardMaterial).clone();
 material.name='rock-moss-set-01-original-pbr';
 const geometries=sourceMeshes.map(mesh=>{
  const geometry=mesh.geometry.clone();geometry.computeBoundingBox();
  const c=geometry.boundingBox!.getCenter(new THREE.Vector3());
  // The glTF nodes translate separate specimens into a showroom grid. Remove
  // that layout only: retain every local position, smooth normal and UV shape.
  geometry.translate(-c.x,-c.y,-c.z);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
 });
 type Placement={mesh:THREE.InstancedMesh,index:number,matrix:THREE.Matrix4,box:THREE.Box3,center:THREE.Vector3,scale:THREE.Vector3,yaw:number,distance:number};
 const placements:Placement[]=[],matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),euler=new THREE.Euler();
 geology.updateMatrixWorld(true);
 geology.traverse(o=>{if(!(o instanceof THREE.InstancedMesh)||!o.name.startsWith('fractured-bedrock-'))return;
  o.geometry.computeBoundingBox();
  for(let index=0;index<o.count;index++){
   o.getMatrixAt(index,matrix);matrix.decompose(position,rotation,scale);euler.setFromQuaternion(rotation,'YXZ');
   const center=new THREE.Vector3(position.x,terrainHeight(position.x,position.z),position.z);
   const distance=Math.min(...focusPoints.map(p=>p.distanceTo(center)));
   if(distance>radius)continue;
   placements.push({mesh:o,index,matrix:matrix.clone(),box:o.geometry.boundingBox!.clone().applyMatrix4(matrix),center,scale:scale.clone(),yaw:euler.y,distance});
  }
 });
 placements.sort((a,b)=>a.distance-b.distance||a.mesh.name.localeCompare(b.mesh.name)||a.index-b.index);
 const selected=placements.slice(0,maximum),removed=new Map<THREE.InstancedMesh,Set<number>>();
 const records:Array<{variant:number,matrix:THREE.Matrix4,center:THREE.Vector3,scale:number}>=[];
 const stats={family:'rock_moss_set_01',selected:selected.length,fullTriangles:0,mediumTriangles:0,
  uniformScaleMin:Infinity,uniformScaleMax:0,minimumPenetration:Infinity,maximumProtrusion:0,
  allHorizontalBoundsInsidePrevious:true,allTopsAtOrBelowPrevious:true,details:[] as object[]};
 const vertex=new THREE.Vector3(),object=new THREE.Object3D();
 for(let itemIndex=0;itemIndex<selected.length;itemIndex++){
  const item=selected[itemIndex],variant=variants[itemIndex%variants.length],geometry=geometries[variant];
  const yaw=item.yaw+(variant===0||variant===4?Math.PI*.5:0);
  const dx=(terrainHeight(item.center.x+2,item.center.z)-terrainHeight(item.center.x-2,item.center.z))*.25;
  const dz=(terrainHeight(item.center.x,item.center.z+2)-terrainHeight(item.center.x,item.center.z-2))*.25;
  const slopeRotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(-dx,1,-dz).normalize());
  // Flat scan bases follow the host flank instead of becoming horizontal ledges.
  slopeRotation.slerp(new THREE.Quaternion(),.15);
  object.position.set(0,0,0);object.quaternion.copy(slopeRotation).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw));object.scale.setScalar(1);object.updateMatrix();
  const rotatedBox=geometry.boundingBox!.clone().applyMatrix4(object.matrix),oldSize=item.box.getSize(new THREE.Vector3()),newSize=rotatedBox.getSize(new THREE.Vector3());
  const uniformScale=Math.min(4.8,oldSize.x*.94/newSize.x,oldSize.z*.94/newSize.z);
  object.scale.setScalar(uniformScale);object.position.set(item.box.getCenter(new THREE.Vector3()).x,0,item.box.getCenter(new THREE.Vector3()).z);object.updateMatrix();
  const p=geometry.attributes.position,deltas:number[]=[];
  for(let i=0;i<p.count;i++){vertex.fromBufferAttribute(p,i).applyMatrix4(object.matrix);deltas.push(vertex.y-terrainHeight(vertex.x,vertex.z))}
  deltas.sort((a,b)=>a-b);
  // Bury 60% of actual scan vertices in the shared rendered terrain. Keep each
  // replacement inside the previous conservative X/Z and upper Y envelope.
  let y=-deltas[Math.floor(deltas.length*.60)];
  y=Math.min(y,item.box.max.y-rotatedBox.max.y*uniformScale-.025);
  object.position.y=y;object.updateMatrix();
  const finalBox=geometry.boundingBox!.clone().applyMatrix4(object.matrix),penetration=-(deltas[0]+y),protrusion=deltas[deltas.length-1]+y;
  if(protrusion<.12)continue; // Fully buried source is not a useful upgrade.
  const horizontal=finalBox.min.x>=item.box.min.x-.001&&finalBox.max.x<=item.box.max.x+.001&&finalBox.min.z>=item.box.min.z-.001&&finalBox.max.z<=item.box.max.z+.001;
  stats.allHorizontalBoundsInsidePrevious&&=horizontal;stats.allTopsAtOrBelowPrevious&&=finalBox.max.y<=item.box.max.y+.001;
  stats.minimumPenetration=Math.min(stats.minimumPenetration,penetration);stats.maximumProtrusion=Math.max(stats.maximumProtrusion,protrusion);
  stats.uniformScaleMin=Math.min(stats.uniformScaleMin,uniformScale);stats.uniformScaleMax=Math.max(stats.uniformScaleMax,uniformScale);
  stats.fullTriangles+=(geometry.index?.count??p.count)/3;
  stats.mediumTriangles+=(mediumIndices?.[variant]?.length??geometry.index!.count)/3;
  records.push({variant,matrix:object.matrix.clone(),center:finalBox.getCenter(new THREE.Vector3()),scale:uniformScale});
  if(!removed.has(item.mesh))removed.set(item.mesh,new Set());removed.get(item.mesh)!.add(item.index);
  stats.details.push({originalMesh:item.mesh.name,originalIndex:item.index,variant,uniformScale,center:finalBox.getCenter(new THREE.Vector3()).toArray(),minimumPenetration:penetration,maximumProtrusion:protrusion,oldBounds:{min:item.box.min.toArray(),max:item.box.max.toArray()},newBounds:{min:finalBox.min.toArray(),max:finalBox.max.toArray()}});
 }
 for(const [mesh,indices]of removed){
  const retained=new THREE.InstancedMesh(mesh.geometry,mesh.material,mesh.count-indices.size);retained.name=mesh.name;retained.castShadow=mesh.castShadow;retained.receiveShadow=mesh.receiveShadow;
  let n=0;const color=new THREE.Color();for(let i=0;i<mesh.count;i++)if(!indices.has(i)){mesh.getMatrixAt(i,matrix);retained.setMatrixAt(n,matrix);if(mesh.instanceColor){mesh.getColorAt(i,color);retained.setColorAt(n,color)}n++}
  retained.computeBoundingSphere();geology.remove(mesh);geology.add(retained);mesh.dispose();
 }
 const batches=variants.map(variant=>{
  const items=records.filter(r=>r.variant===variant),near=new THREE.InstancedMesh(geometries[variant],material,items.length);
  near.name=`scanned-outcrop-${variant}-hero`;near.castShadow=near.receiveShadow=true;near.instanceMatrix.setUsage(THREE.DynamicDrawUsage);geology.add(near);
  let medium:THREE.InstancedMesh|undefined;
  if(mediumIndices?.[variant]){const g=geometries[variant].clone();g.setIndex(new THREE.BufferAttribute(mediumIndices[variant],1));medium=new THREE.InstancedMesh(g,material,items.length);medium.name=`scanned-outcrop-${variant}-medium`;medium.castShadow=medium.receiveShadow=true;medium.instanceMatrix.setUsage(THREE.DynamicDrawUsage);geology.add(medium)}
  return {items,near,medium};
 });
 function update(cameraPosition?:THREE.Vector3){for(const {items,near,medium}of batches){let n=0,m=0;for(const item of items){
   // Full original geometry within 180 m. The modest attribute-aware index LOD
   // retains original vertices, normals and UVs and has < .064 m reported simplification error at scale 4.8.
   const useMedium=medium&&cameraPosition&&cameraPosition.distanceTo(item.center)>180;
   if(useMedium)medium.setMatrixAt(m++,item.matrix);else near.setMatrixAt(n++,item.matrix);
  }near.count=n;near.instanceMatrix.needsUpdate=true;near.computeBoundingSphere();if(medium){medium.count=m;medium.instanceMatrix.needsUpdate=true;medium.computeBoundingSphere()}
 }}
 update();Object.assign(stats,{upgraded:records.length,retainedPrimitiveInstances:geology.children.filter((o:any)=>o.name.startsWith('fractured-bedrock-')).reduce((n,o:any)=>n+o.count,0)});geology.userData.photogrammetryRocks=stats;
 return {group:geology,stats,update,restoreFullDetail:()=>update()};
}
