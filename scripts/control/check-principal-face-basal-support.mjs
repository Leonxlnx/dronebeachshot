// Read-only actual-source basal audit of the archived active principal-face study.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {treePlacementsBeforePrincipalFace} from '../../src/world/ecology.ts';
import {terrainHeight,terrainHeightBeforePrincipalFace,shoreDistance} from '../../src/world/math.ts';
import {principalFacePlaneCut} from '../../src/world/principal-face-planes.ts';
import {WIND} from '../../src/world/weather.ts';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),trees=treePlacementsBeforePrincipalFace();
assert.equal(sha(JSON.stringify(trees)),'927ddf7d749c7c3ec4673acebd280e97dd02c0664d26c02225deb8fff7fb64e6');
const historicalHeight=(x,z)=>{const h=terrainHeightBeforePrincipalFace(x,z);return h-principalFacePlaneCut(x,z,h,shoreDistance(x,z))};
function sampler(height){const cache=new Map();const vertex=(x,z)=>{const key=x+','+z;if(!cache.has(key))cache.set(key,Math.fround(height(x,z)));return cache.get(key)};return (x,z)=>{const x0=Math.floor(x/2)*2,z0=Math.floor(z/2)*2,u=(x-x0)/2,v=(z-z0)/2,a=vertex(x0,z0),b=vertex(x0+2,z0),c=vertex(x0,z0+2),d=vertex(x0+2,z0+2);return u+v<=1?a*(1-u-v)+b*u+c*v:d*(u+v-1)+b*(1-v)+c*(1-u)}}
const before=sampler(terrainHeightBeforePrincipalFace),after=sampler(historicalHeight);
const definitions=[['island-tree-near.glb',18/3.4],['syringa-tree-near.glb',14/4.556740965694189],['palm-tree.glb',21/10.99348258972168]],sourceProof=[];
function basalSource(family){
 const [name,scale]=definitions[family],bytes=fs.readFileSync('public/assets/models/'+name);assert.equal(bytes.toString('ascii',0,4),'glTF');
 let json,binary;for(let offset=12;offset<bytes.length;){const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4),data=bytes.subarray(offset+8,offset+8+length);if(type===0x4e4f534a)json=JSON.parse(data.toString('utf8'));if(type===0x004e4942)binary=data;offset+=8+length;}
 const unique=new Map();let basalVertices=0;const nodeProof=[];
 function visit(index,parent){
  const node=json.nodes[index],local=node.matrix?new THREE.Matrix4().fromArray(node.matrix):new THREE.Matrix4().compose(new THREE.Vector3(...(node.translation??[0,0,0])),new THREE.Quaternion(...(node.rotation??[0,0,0,1])),new THREE.Vector3(...(node.scale??[1,1,1]))),world=parent.clone().multiply(local);
  if(node.mesh!==undefined){
   nodeProof.push({index,name:node.name,matrix:world.toArray()});
   for(const primitive of json.meshes[node.mesh].primitives){
    const accessor=json.accessors[primitive.attributes.POSITION],view=json.bufferViews[accessor.bufferView];assert.equal(accessor.componentType,5126);assert.equal(accessor.type,'VEC3');assert.ok(!accessor.sparse);
    const values=new Float32Array(accessor.count*3),start=(view.byteOffset??0)+(accessor.byteOffset??0),stride=view.byteStride??12;
    for(let i=0;i<accessor.count;i++)for(let k=0;k<3;k++)values[i*3+k]=binary.readFloatLE(start+i*stride+k*4);
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(values,3));geometry.applyMatrix4(world);geometry.scale(scale,scale,scale);const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++)if(p.getY(i)<.3){const point=[p.getX(i),p.getY(i),p.getZ(i)];unique.set(point.join(','),point);basalVertices++;}
    geometry.dispose();
   }
  }
  for(const child of node.children??[])visit(child,world);
 }
 for(const node of json.scenes[json.scene??0].nodes)visit(node,new THREE.Matrix4());
 const points=[...unique.values()];sourceProof.push({family,file:name,sha256:sha(bytes),productionScale:scale,basalVertices,uniqueBasalVertices:points.length,nodes:nodeProof});return points;
}
const sources=new Map(),object=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),windAxis=new THREE.Vector3(WIND[1],0,-WIND[0]).normalize(),tilt=new THREE.Quaternion(),point=new THREE.Vector3();
function matrixFor(tree,y){object.position.set(tree.x,y,tree.z);const lean=tree.variant===2?.055*tree.exposure:.016;object.quaternion.setFromAxisAngle(up,tree.angle).premultiply(tilt.setFromAxisAngle(windAxis,lean));object.scale.set(tree.scale*(1+tree.variant*.06),tree.scale,tree.scale);object.updateMatrix();return new THREE.Matrix4().fromArray(new Float32Array(object.matrix.elements))}
function slope(surface,x,z){const x0=Math.floor(x/2)*2,z0=Math.floor(z/2)*2,a=surface(x0,z0),b=surface(x0+2,z0),c=surface(x0,z0+2),d=surface(x0+2,z0+2);return (x-x0+z-z0)/2<=1?Math.hypot(b-a,c-a)/2:Math.hypot(d-c,d-b)/2}
const records=[];
for(const [index,tree] of trees.entries()){
 if(tree.x< -212||tree.x> -101||tree.z<143||tree.z>289)continue;
 if(!sources.has(tree.family))sources.set(tree.family,basalSource(tree.family));
 const oldMatrix=matrixFor(tree,tree.y),newY=after(tree.x,tree.z)-.06,newMatrix=matrixFor(tree,newY),oldDeltas=[],newDeltas=[];let footprintTouches=0;
 for(const p of sources.get(tree.family)){
  point.fromArray(p).applyMatrix4(oldMatrix);oldDeltas.push(point.y-before(point.x,point.z));
  point.fromArray(p).applyMatrix4(newMatrix);newDeltas.push(point.y-after(point.x,point.z));
  if(after(point.x,point.z)!==before(point.x,point.z))footprintTouches++;
 }
 if(!footprintTouches&&newY===tree.y)continue;
 const inspect=deltas=>({minimumDelta:Math.min(...deltas),maximumGap:Math.max(...deltas),fractionAbove03:deltas.filter(x=>x>.3).length/deltas.length,fractionBelowMinus05:deltas.filter(x=>x<-.5).length/deltas.length});
 const old=inspect(oldDeltas),current=inspect(newDeltas),flag=p=>p.maximumGap>2&&p.fractionAbove03>=.25;
 records.push({index,x:tree.x,z:tree.z,family:tree.family,oldY:tree.y,newY,rootLowering:tree.y-newY,basalVertices:newDeltas.length,footprintTouches,referenceSlope:slope(before,tree.x,tree.z),currentSlope:slope(after,tree.x,tree.z),before:old,after:current,flagBefore:flag(old),flagAfter:flag(current),newFlag:flag(current)&&!flag(old)});
}
const report={method:'Raw source GLB POSITION, node world matrices and production normalization; unique normalized basal points y<0.3m; exact wind-lean/yaw/nonuniform scale followed by Float32 instance matrix; actual2m Float32 surfaces. Island fork-open form is identity below2m.',scope:'Historical active principal-face study, retained reference cohort; no tree removals/refill or shape acceptance',runtimeMatchesHistoricalStudy:terrainHeight(-149,207)===historicalHeight(-149,207),thresholds:{maximumGapAbove:2,fractionAbove03AtLeast:.25},sourceProof,affectedRoots:records.length,changedRootY:records.filter(r=>r.oldY!==r.newY).length,existingFlags:records.filter(r=>r.flagBefore).length,currentFlags:records.filter(r=>r.flagAfter).length,newFlagIds:records.filter(r=>r.newFlag).map(r=>r.index),newTriangleSlopeOver34:records.filter(r=>r.referenceSlope<=3.4&&r.currentSlope>3.4).map(r=>r.index),records,limits:['Source basal vertices are a conservative geometric diagnostic, not a complete continuous wood/soil intersection or ecological law.','Animation is not simulated; near-root wind deformation and appearance remain visual review.']};
fs.mkdirSync('artifacts/refinement-2026-09-30/principal-face',{recursive:true});
fs.writeFileSync('artifacts/refinement-2026-09-30/principal-face/cohort-basal-support.json',JSON.stringify(report,null,2)+'\n');
console.log('PRINCIPAL_FACE_BASAL_AUDIT '+JSON.stringify({...report,records:undefined}));
