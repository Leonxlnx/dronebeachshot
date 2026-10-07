import {renderedTerrainHeight,renderedTerrainHeightBeforePrincipalFace} from './terrain-surface.ts';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng,terrainSlope,terrainSlopeBeforePrincipalFace,shoreDistance,noise} from './math';
import {treePlacementsBeforePrincipalFace,type Placement} from './ecology';
import {EAST_SPUR_STUDY_ENABLED} from './east-spur';
import {eastSpurExcludesTree} from './east-spur-ecology';
import {eastSpurTouchesBounds} from './east-spur-local-support';
import {windMaterial,type Textures} from '../render/materials';
function touchesChangedTerrain(geometry:THREE.BufferGeometry,matrix?:THREE.Matrix4){
 const positions=geometry.attributes.position,point=new THREE.Vector3();
 for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i);if(matrix)point.applyMatrix4(matrix);if(renderedTerrainHeight(point.x,point.z)!==renderedTerrainHeightBeforePrincipalFace(point.x,point.z))return true;}
 return false;
}
export function createForestFloor(t:Textures,trees:Placement[]){
 const group=new THREE.Group();group.name='roots-regeneration-and-litter';const random=rng(390181),dummy=new THREE.Object3D();
 const wood=new THREE.MeshStandardMaterial({map:t.bark,normalMap:t.barkNormal,color:0x827865,roughness:.97});
 // Select on the reference landscape first: a local cut or omitted tree must
 // not reshuffle the shared RNG for unrelated roots, litter and seedlings.
 const selectionTrees=treePlacementsBeforePrincipalFace(),liveRoots=new Set(trees.map(tree=>tree.x+','+tree.z));
 const selectionSlope=terrainSlopeBeforePrincipalFace,selectionHeight=renderedTerrainHeightBeforePrincipalFace;
 const audit={selected:{rootTrees:0,roots:0,litter:0,seedlings:0},roots:[] as {sourceOrdinal:number,treeOrdinal:number,local:boolean,omitted:boolean,reason?:string}[],litter:[] as {sourceOrdinal:number,local:boolean,omitted:boolean}[],seedlings:[] as {sourceOrdinal:number,local:boolean,omitted:boolean}[]};
 const roots:THREE.BufferGeometry[]=[];let rootTrees=0,selectedRootTrees=0;
 for(let i=0;i<selectionTrees.length&&selectedRootTrees<150;i+=7){const tree=selectionTrees[i];if(tree.family===2||shoreDistance(tree.x,tree.z)>150||selectionSlope(tree.x,tree.z)>1.2)continue;selectedRootTrees++;let emitted=false;
  for(let branch=0;branch<4;branch++){const sourceOrdinal=(selectedRootTrees-1)*4+branch,angle=tree.angle+branch*Math.PI*.5+random()*.5,length=(1.8+random()*2.1)*tree.scale,points:THREE.Vector3[]=[];
   for(let j=0;j<=5;j++){const u=j/5,x=tree.x+Math.cos(angle+u*.24)*length*u,z=tree.z+Math.sin(angle+u*.24)*length*u;points.push(new THREE.Vector3(x,selectionHeight(x,z)+.025+.52*tree.scale*Math.pow(1-u,3),z))}
   let geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),10,.065*tree.scale,5,false);
   geometry.computeBoundingBox();const box=geometry.boundingBox!,local=touchesChangedTerrain(geometry)||EAST_SPUR_STUDY_ENABLED&&eastSpurTouchesBounds(box.min.x,box.max.x,box.min.z,box.max.z);
   let omitted=!liveRoots.has(tree.x+','+tree.z)||EAST_SPUR_STUDY_ENABLED&&eastSpurExcludesTree(i,tree.x,tree.z),reason=omitted?'Owning core tree omitted':undefined;
   if(local&&!omitted){
    const candidatePoints=points.map(p=>new THREE.Vector3(p.x,p.y+renderedTerrainHeight(p.x,p.z)-selectionHeight(p.x,p.z),p.z));
    const candidate=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(candidatePoints),10,.065*tree.scale,5,false);
    // Compare the lower point of every source/candidate tube ring. The rising
    // trunk end is intentional; do not mistake its old profile for flotation.
    const old=geometry.attributes.position,next=candidate.attributes.position;
    for(let ring=0;ring<=10;ring++){
     let before=Infinity,after=Infinity;
     for(let side=0;side<=5;side++){const v=ring*6+side;before=Math.min(before,old.getY(v)-selectionHeight(old.getX(v),old.getZ(v)));after=Math.min(after,next.getY(v)-renderedTerrainHeight(next.getX(v),next.getZ(v)))}
     if(after>Math.max(.06,before+.12)){omitted=true;reason='New unsupported tube ring';break}
    }
    geometry.dispose();geometry=candidate;
   }
   audit.roots.push({sourceOrdinal,treeOrdinal:i,local,omitted,...(reason?{reason}:{})});
   if(omitted)geometry.dispose();else{roots.push(geometry);emitted=true}
  }
  if(emitted)rootTrees++;
 }
 audit.selected.rootTrees=selectedRootTrees;audit.selected.roots=selectedRootTrees*4;
 if(roots.length){const geometry=mergeGeometries(roots);roots.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,wood);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.sourceOrdinals=audit.roots.filter(r=>!r.omitted).map(r=>r.sourceOrdinal);group.add(mesh)}
 // Small curved leaf surfaces rest on the terrain; regeneration occupies moist
 // pockets below the canopy, with open beach sand kept clear.
 const leafShape=new THREE.Shape();leafShape.moveTo(0,0);leafShape.quadraticCurveTo(.14,.08,.0,.38);leafShape.quadraticCurveTo(-.14,.08,0,0);
 const leafGeometry=new THREE.ShapeGeometry(leafShape,4);leafGeometry.rotateX(-Math.PI/2);
 const lp=leafGeometry.attributes.position;for(let i=0;i<lp.count;i++)lp.setY(i,.045*Math.sin(Math.abs(lp.getZ(i))/.38*Math.PI));leafGeometry.computeVertexNormals();
 const leafMaterial=new THREE.MeshStandardMaterial({color:0x746039,roughness:.98,side:THREE.DoubleSide});
 const litter=new THREE.InstancedMesh(leafGeometry,leafMaterial,5200);let count=0,selectedLitter=0;
 for(let i=0;i<26000&&selectedLitter<5200;i++){const tree=selectionTrees[Math.floor(random()*selectionTrees.length)],x=tree.x+(random()-.5)*12,z=tree.z+(random()-.5)*12,d=shoreDistance(x,z);if(d<30||d>190||selectionSlope(x,z)>1||noise(x*.16,z*.16)<.32)continue;
  const normal=new THREE.Vector3(renderedTerrainHeight(x-.2,z)-renderedTerrainHeight(x+.2,z),.4,renderedTerrainHeight(x,z-.2)-renderedTerrainHeight(x,z+.2)).normalize();
  dummy.position.set(x,renderedTerrainHeight(x,z)+.016,z);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);dummy.rotateY(random()*Math.PI*2);dummy.scale.setScalar(.5+random()*1.7);dummy.updateMatrix();const color=new THREE.Color().setHSL(.09+random()*.045,.15+random()*.2,.48+random()*.18),sourceOrdinal=selectedLitter++;
  const radius=.4*dummy.scale.x,local=touchesChangedTerrain(leafGeometry,dummy.matrix)||EAST_SPUR_STUDY_ENABLED&&eastSpurTouchesBounds(x-radius,x+radius,z-radius,z+radius);
  let omitted=local&&terrainSlope(x,z)>1;
  if(local&&!omitted){const point=new THREE.Vector3(),position=leafGeometry.attributes.position;for(let v=0;v<position.count;v++){point.fromBufferAttribute(position,v).applyMatrix4(dummy.matrix);if(point.y-renderedTerrainHeight(point.x,point.z)>.12){omitted=true;break}}}
  audit.litter.push({sourceOrdinal,local,omitted});if(omitted)continue;
  litter.setMatrixAt(count,dummy.matrix);litter.setColorAt(count,color);count++;
 }
 audit.selected.litter=selectedLitter;litter.userData.sourceOrdinals=audit.litter.filter(r=>!r.omitted).map(r=>r.sourceOrdinal);litter.count=count;litter.receiveShadow=true;litter.computeBoundingSphere();group.add(litter);
 const seedParts:THREE.BufferGeometry[]=[new THREE.CylinderGeometry(.014,.028,.85,5,3).translate(0,.425,0)];
 for(let i=0;i<7;i++){const leaf=leafGeometry.clone();leaf.rotateZ((i%2?1:-1)*.3);leaf.rotateY(i*2.399);leaf.translate(Math.sin(i*2.399)*.1,.17+i*.085,Math.cos(i*2.399)*.1);seedParts.push(leaf)}
 // Vertex colors let stems and individual leaves share one wind-deformed draw.
 for(let i=0;i<seedParts.length;i++){const geometry=seedParts[i],color=new THREE.Color(i===0?0x6c7347:0x608447),colors=new Float32Array(geometry.attributes.position.count*3);for(let v=0;v<geometry.attributes.position.count;v++)colors.set(color.toArray(),v*3);geometry.setAttribute('color',new THREE.BufferAttribute(colors,3))}
 const seedGeometry=mergeGeometries(seedParts);seedGeometry.computeBoundingBox();const seedBox=seedGeometry.boundingBox!,seedRadius=Math.hypot(Math.max(Math.abs(seedBox.min.x),Math.abs(seedBox.max.x)),Math.max(Math.abs(seedBox.min.z),Math.abs(seedBox.max.z)));seedParts.forEach(g=>g.dispose());const seedlings=new THREE.InstancedMesh(seedGeometry,windMaterial(0xd3d3b8),1300);let sc=0,selectedSeedlings=0;
 for(let i=0;i<15000&&selectedSeedlings<1300;i++){const tree=selectionTrees[Math.floor(random()*selectionTrees.length)],x=tree.x+(random()-.5)*15,z=tree.z+(random()-.5)*15,d=shoreDistance(x,z);if(d<34||d>175||selectionSlope(x,z)>.8||noise(x*.045,z*.045)<.5)continue;dummy.position.set(x,renderedTerrainHeight(x,z),z);dummy.rotation.set(0,random()*Math.PI*2,0);dummy.scale.setScalar(.45+random()*1.5);dummy.updateMatrix();const sourceOrdinal=selectedSeedlings++,radius=seedRadius*dummy.scale.x,local=touchesChangedTerrain(seedGeometry,dummy.matrix)||EAST_SPUR_STUDY_ENABLED&&eastSpurTouchesBounds(x-radius,x+radius,z-radius,z+radius);
  let omitted=local&&terrainSlope(x,z)>.8;
  if(local&&!omitted){const point=new THREE.Vector3(),position=seedGeometry.attributes.position;for(let v=0;v<position.count;v++){if(position.getY(v)>.03)continue;point.fromBufferAttribute(position,v).applyMatrix4(dummy.matrix);if(point.y-renderedTerrainHeight(point.x,point.z)>.15){omitted=true;break}}}
  audit.seedlings.push({sourceOrdinal,local,omitted});if(!omitted)seedlings.setMatrixAt(sc++,dummy.matrix)}
 audit.selected.seedlings=selectedSeedlings;seedlings.userData.sourceOrdinals=audit.seedlings.filter(r=>!r.omitted).map(r=>r.sourceOrdinal);seedlings.count=sc;seedlings.receiveShadow=true;seedlings.computeBoundingSphere();group.add(seedlings);group.userData.eastSpurCohort=audit;group.userData.counts={rootTrees,roots:roots.length,litter:count,seedlings:sc};return group;
}
