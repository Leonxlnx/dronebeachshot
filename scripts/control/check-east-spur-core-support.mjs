// Read-only original-source basal audit of the isolated rounded positive spur.
// No module overrides or production changes.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {treePlacements,treePlacementsBeforePrincipalFace} from '../../src/world/ecology.ts';
import {terrainHeight,terrainHeightBeforePrincipalFace,shoreDistance} from '../../src/world/math.ts';
import {EAST_SPUR_STUDY_ENABLED,eastSpurUplift} from '../../src/world/east-spur.ts';
import {EAST_SPUR_BASAL_POLICY,eastSpurExcludesTree} from '../../src/world/east-spur-ecology.ts';
assert.equal(EAST_SPUR_STUDY_ENABLED,true,'Use the east-spur study loader');
const BROAD_RECESS_REGION={minX:145,maxX:260,minZ:97,maxZ:174};
import {WIND} from '../../src/world/weather.ts';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),trees=treePlacementsBeforePrincipalFace();
assert.equal(sha(JSON.stringify(trees)),'927ddf7d749c7c3ec4673acebd280e97dd02c0664d26c02225deb8fff7fb64e6');
const studyHeight=(x,z)=>{const h=terrainHeightBeforePrincipalFace(x,z);return h+eastSpurUplift(x,z,shoreDistance(x,z))};
function sampler(height){const cache=new Map();const vertex=(x,z)=>{const key=x+','+z;if(!cache.has(key))cache.set(key,Math.fround(height(x,z)));return cache.get(key)};return (x,z)=>{const x0=Math.floor(x/2)*2,z0=Math.floor(z/2)*2,u=(x-x0)/2,v=(z-z0)/2,a=vertex(x0,z0),b=vertex(x0+2,z0),c=vertex(x0,z0+2),d=vertex(x0+2,z0+2);return u+v<=1?a*(1-u-v)+b*u+c*v:d*(u+v-1)+b*(1-v)+c*(1-u)}}
const before=sampler(terrainHeightBeforePrincipalFace),after=sampler(terrainHeight);
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
const records=[],currentTrees=treePlacements(),currentByXZ=new Map(currentTrees.map(tree=>[tree.x+','+tree.z,tree]));
assert.equal(currentTrees.length,13954);let lastOrdinal=-1;
for(const tree of currentTrees){const index=trees.findIndex(t=>t.x===tree.x&&t.z===tree.z);assert.ok(index>lastOrdinal);lastOrdinal=index;assert.deepEqual({...tree,y:trees[index].y},trees[index]);assert.equal(tree.y,after(tree.x,tree.z)-.06)}
for(let family=0;family<definitions.length;family++)sources.set(family,basalSource(family));
const basalRadii=new Map([...sources].map(([family,points])=>[family,Math.max(...points.map(p=>Math.hypot(...p)))]));
for(const [index,tree] of trees.entries()){
 const emitted=currentByXZ.get(tree.x+','+tree.z),omitted=!emitted;assert.equal(omitted,eastSpurExcludesTree(index,tree.x,tree.z));
 const radius=basalRadii.get(tree.family)*tree.scale*(1+tree.variant*.06),r=BROAD_RECESS_REGION;
 if(tree.x+radius<r.minX||tree.x-radius>r.maxX||tree.z+radius<r.minZ||tree.z-radius>r.maxZ)continue;
 const oldMatrix=matrixFor(tree,tree.y),newY=after(tree.x,tree.z)-.06,newMatrix=matrixFor(tree,newY),oldDeltas=[],newDeltas=[];let footprintTouches=0;
 if(emitted)assert.equal(emitted.y,newY,'Production root Y differs from candidate surface');
 for(const p of sources.get(tree.family)){
  point.fromArray(p).applyMatrix4(oldMatrix);oldDeltas.push(point.y-before(point.x,point.z));
  point.fromArray(p).applyMatrix4(newMatrix);newDeltas.push(point.y-after(point.x,point.z));
  if(after(point.x,point.z)!==before(point.x,point.z))footprintTouches++;
 }
 if(!footprintTouches&&newY===tree.y)continue;
 const inspect=deltas=>({minimumDelta:Math.min(...deltas),maximumGap:Math.max(...deltas),fractionAbove03:deltas.filter(x=>x>.3).length/deltas.length,fractionBelowMinus05:deltas.filter(x=>x<-.5).length/deltas.length});
 const old=inspect(oldDeltas),current=inspect(newDeltas),flag=p=>p.maximumGap>2&&p.fractionAbove03>=.25;
 records.push({omitted,index,x:tree.x,z:tree.z,family:tree.family,oldY:tree.y,newY,rootRise:newY-tree.y,basalVertices:newDeltas.length,footprintTouches,referenceSlope:slope(before,tree.x,tree.z),currentSlope:slope(after,tree.x,tree.z),before:old,after:current,flagBefore:flag(old),flagAfter:flag(current),newFlag:flag(current)&&!flag(old)});
}
const p=EAST_SPUR_BASAL_POLICY,failed=r=>(r.after.maximumGap>p.maximumGap&&r.after.fractionAbove03>=p.minimumAboveFraction)||r.currentSlope>p.maximumSlope;
for(const record of records)assert.equal(record.omitted,failed(record),'Explicit omission differs from approved source support policy: '+record.index);
const retained=records.filter(r=>!r.omitted),omitted=records.filter(r=>r.omitted);assert.equal(retained.length,20);assert.equal(omitted.length,46);
const report={method:'Actual emitted original-source basal vertices, node transforms, production normalizations, exact wind/yaw/scale and Float32 instance matrices; actual integrated 2m Float32 triangle surface.',scope:'Bounded static source-support audit, not continuous wood/soil contact or full-scene visual acceptance',policy:p,sourceProof,referenceTrees:trees.length,currentTrees:currentTrees.length,affectedFootprints:records.length,retainedAffected:retained.length,omitted:omitted.map(r=>r.index),retainedMaximumGap:Math.max(...retained.map(r=>r.after.maximumGap)),existingLooseFlags:records.filter(r=>r.flagBefore).length,uncorrectedLooseFlags:records.filter(r=>r.flagAfter).length,records,limits:['The historical loose 2m gap rule did not establish support; 25 uncorrected cases remain unacceptable and are not reported as clean.','The approved .75m/25% policy is a bounded static basal diagnostic; animation and actual appearance remain pending.']};
fs.writeFileSync('artifacts/refinement-2026-09-30/east-wall-structure/integrated-core-support.json',JSON.stringify(report,null,2)+'\n');
console.log('EAST_SPUR_ACTUAL_CORE_SUPPORT '+JSON.stringify({...report,sourceProof:undefined,records:undefined}));
