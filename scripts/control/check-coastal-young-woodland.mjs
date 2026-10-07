// CPU-only source support and unchanged-base check for the bounded tree pocket.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sha256} from './capture-integrity.mjs';
import {treePlacements,treePlacementsBeforePrincipalFace,renderTreePlacements} from '../../src/world/ecology.ts';
import {COASTAL_YOUNG_WOODLAND_ENABLED,COASTAL_YOUNG_WOODLAND_SITES,createCoastalYoungWoodland} from '../../src/world/coastal-young-woodland.ts';
import {renderedTerrainHeight as height} from '../../src/world/terrain-surface.ts';
import {shoreDistance} from '../../src/world/math.ts';
import {habitatAt} from '../../src/world/habitat.ts';
import {pathPosition,applyCinematic} from '../../src/camera/cinematic.ts';
import {WIND} from '../../src/world/weather.ts';
import {treeTint} from '../../src/world/tree-palette.ts';

const out='artifacts/refinement-2026-10-02/vegetation';
const base=treePlacements(),baseHash=sha256(Buffer.from(JSON.stringify(base)));
const reference=treePlacementsBeforePrincipalFace();
assert.equal(base.length,14000);assert.equal(sha256(Buffer.from(JSON.stringify(reference))),'927ddf7d749c7c3ec4673acebd280e97dd02c0664d26c02225deb8fff7fb64e6');
base.forEach((tree,i)=>{assert.deepEqual({...tree,y:reference[i].y},reference[i]);assert.equal(tree.y,height(tree.x,tree.z)-.06);});
assert.equal(renderTreePlacements(base,false),base,'OFF must return the exact original cohort');
const trees=createCoastalYoungWoodland(base),rendered=renderTreePlacements(base,true);
if(COASTAL_YOUNG_WOODLAND_ENABLED)assert.deepEqual(renderTreePlacements(base),rendered,'Default must render the enabled young cohort');
else assert.equal(renderTreePlacements(base),base,'Default OFF must preserve the original cohort');
assert.ok(trees.length>70&&trees.length<130);assert.deepEqual(trees,createCoastalYoungWoodland(base));
assert.deepEqual(trees.slice(0,16).map(t=>t.x),[108.3,112.7,120.1,118.2,151.8,155.6,161.5,164.3,168.2,172.3,174.1,207.7,210.5,214,216.8,221]);
assert.deepEqual([...new Set(trees.map(t=>t.family))].sort(),[0,1]);
assert.deepEqual(rendered.slice(0,base.length),base);assert.deepEqual(rendered.slice(base.length),trees);
assert.equal(sha256(Buffer.from(JSON.stringify(base))),baseHash,'Candidate mutated base');

function readSource(name,family){
 const scale=family===0?18/3.4:14/4.556740965694189;
 const file='public/assets/models/'+name+'.glb',bytes=fs.readFileSync(file);let json,binary;
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 for(let o=12;o<bytes.length;){const n=bytes.readUInt32LE(o),type=bytes.readUInt32LE(o+4),data=bytes.subarray(o+8,o+8+n);if(type===0x4e4f534a)json=JSON.parse(data);if(type===0x004e4942)binary=data;o+=8+n;}
 const points=[],basal=new Map(),box=new THREE.Box3(),point=new THREE.Vector3();
 function visit(index,parent){
  const node=json.nodes[index],local=node.matrix?new THREE.Matrix4().fromArray(node.matrix):new THREE.Matrix4().compose(new THREE.Vector3(...(node.translation??[0,0,0])),new THREE.Quaternion(...(node.rotation??[0,0,0,1])),new THREE.Vector3(...(node.scale??[1,1,1]))),world=parent.clone().multiply(local);
  if(node.mesh!==undefined)for(const primitive of json.meshes[node.mesh].primitives){
   const a=json.accessors[primitive.attributes.POSITION],v=json.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');assert.ok(!a.sparse);
   const values=new Float32Array(a.count*3),start=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??12;
   for(let i=0;i<a.count;i++)for(let k=0;k<3;k++)values[i*3+k]=binary.readFloatLE(start+i*stride+k*4);
   // Same two Float32 geometry transforms as createVegetation, including GLTF nodes.
   const g=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(values,3));g.applyMatrix4(world);g.scale(scale,scale,scale);
   const p=g.attributes.position;for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);box.expandByPoint(point);points.push(point.toArray());if(point.y<.3)basal.set(point.toArray().join(','),point.toArray());}g.dispose();
  }
  for(const child of node.children??[])visit(child,world);
 }
 for(const node of json.scenes[json.scene??0].nodes)visit(node,new THREE.Matrix4());
 return {file,family,sha256:sha256(bytes),points,basal:[...basal.values()],bounds:{min:box.min.toArray(),max:box.max.toArray()}};
}
const sources=['island','syringa'].flatMap((name,family)=>['near','hero','medium'].map(lod=>readSource(name+'-tree-'+lod,family)));
const object=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),axis=new THREE.Vector3(WIND[1],0,-WIND[0]).normalize(),tilt=new THREE.Quaternion(),point=new THREE.Vector3();
const route=Array.from({length:1201},(_,i)=>pathPosition(i/60));
function segmentHitsBox(a,b,box){
 let lo=0,hi=1;for(const key of ['x','y','z']){const d=b[key]-a[key];if(Math.abs(d)<1e-12){if(a[key]<box.min[key]||a[key]>box.max[key])return false;continue;}let t0=(box.min[key]-a[key])/d,t1=(box.max[key]-a[key])/d;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi)return false;}return true;
}
function screenPoint(tree,box,time){
 const camera=new THREE.PerspectiveCamera(42,640/360,.1,10000);applyCinematic(camera,time);camera.updateMatrixWorld();
 const middle=box.getCenter(new THREE.Vector3()),p=middle.clone().project(camera);let terrainClear=true;
 const delta=middle.clone().sub(camera.position),distance=delta.length(),steps=Math.ceil(distance/2);
 for(let i=1;i<steps;i++){point.copy(camera.position).addScaledVector(delta,i/steps);if(height(point.x,point.z)>point.y){terrainClear=false;break;}}
 return {time,pixel:[(p.x+1)*320,(1-p.y)*180],midpointInFrustum:Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&p.z>=-1&&p.z<=1,terrainRayClear:terrainClear,limit:'Terrain-only midpoint probe; does not model crown/rock occlusion'};
}
const records=[];
for(const [index,tree] of trees.entries()){
 assert.ok(tree.family===0||tree.family===1);assert.equal(tree.variant,0);
 const site=COASTAL_YOUNG_WOODLAND_SITES.find(s=>s[1]===tree.x),habitat=habitatAt(tree.x,tree.z),edge=site[0]>=30;
 assert.ok(habitat.soil>=(edge?.08:tree.family===0?.20:.25)&&habitat.moisture>=.36);assert.ok(shoreDistance(tree.x,tree.z)>28&&shoreDistance(tree.x,tree.z)<=46);
 object.position.set(tree.x,tree.y,tree.z);object.quaternion.setFromAxisAngle(up,tree.angle).premultiply(tilt.setFromAxisAngle(axis,.016));object.scale.setScalar(tree.scale);object.updateMatrix();
 const matrix=new THREE.Matrix4().fromArray(new Float32Array(object.matrix.elements)),box=new THREE.Box3(),support=[];
 for(const source of sources.filter(s=>s.family===tree.family)){
  for(const p of source.points)box.expandByPoint(point.fromArray(p).applyMatrix4(matrix));
  const deltas=[],bottom=[];for(const p of source.basal){point.fromArray(p).applyMatrix4(matrix);const delta=point.y-height(point.x,point.z);deltas.push(delta);if(p[1]<=.05)bottom.push(delta);}
  const metrics={source:source.file,vertices:deltas.length,bottomVertices:bottom.length,minimum:Math.min(...deltas),maximum:Math.max(...deltas),bottomMaximum:Math.max(...bottom)};
  assert.ok(metrics.maximum<.20,'Basal gap '+index);assert.ok(metrics.bottomMaximum<=0,'Floating basal foot '+index);assert.ok(metrics.minimum>-.35,'Excess basal burial '+index+' '+metrics.minimum);support.push(metrics);
 }
 const actualHeight=box.max.y-box.min.y;assert.ok(actualHeight>=2&&actualHeight<=8);
 const expanded=box.clone().expandByScalar(2);for(let i=1;i<route.length;i++)assert.ok(!segmentHitsBox(route[i-1],route[i],expanded),'Route intersection '+index);
 const nearestRoute=Math.min(...route.map(p=>box.distanceToPoint(p))),nearestBase=Math.min(...base.map(p=>Math.hypot(p.x-tree.x,p.z-tree.z))),nearestYoung=Math.min(...trees.filter(p=>p!==tree).map(p=>Math.hypot(p.x-tree.x,p.z-tree.z)));
 for(const other of trees){if(tree===other)continue;const otherEdge=COASTAL_YOUNG_WOODLAND_SITES.find(s=>s[1]===other.x)[0]>=30;assert.ok(Math.hypot(tree.x-other.x,tree.z-other.z)>=(edge||otherEdge?Math.max(1.8,(tree.scale+other.scale)*4):3.5));}assert.ok(nearestBase>=2.3);
 records.push({index,group:site[0],...tree,actualHeight,bounds:{min:box.min.toArray(),max:box.max.toArray()},nearestRoute,nearestBase,nearestYoung,support,views:[9,12].map(t=>screenPoint(tree,box,t))});
}
const groups=[...new Set(records.map(r=>r.group))].map(group=>({group,count:records.filter(r=>r.group===group).length}));assert.deepEqual(groups.slice(0,3).map(g=>g.count),[4,7,5]);
const palette=Array.from({length:100},(_,i)=>treeTint(i*37-500,i*53-500,i%2).toArray());
assert.deepEqual(palette,Array.from({length:100},(_,i)=>treeTint(i*37-500,i*53-500,i%2).toArray()));
assert.ok(palette.flat().every(v=>Number.isFinite(v)&&v>.5&&v<1));
assert.ok(Math.max(...palette.map(c=>c[1]))-Math.min(...palette.map(c=>c[1]))>.04);
assert.ok(treeTint(128,40,1).r<treeTint(128,40,0).r);assert.equal(treeTint(128,40,1).g,treeTint(128,40,0).g);
const report={status:'CPU support and unchanged-base validation; current visual acceptance is tracked in gates/refinement-2026-10-02-vegetation.md',defaultEnabled:COASTAL_YOUNG_WOODLAND_ENABLED,base:{count:base.length,sha256:baseHash,exactPreservation:true},youngCount:trees.length,groups,sourceModels:sources.map(({points,basal,...s})=>({...s,vertices:points.length,basalVertices:basal.length})),heightRange:[Math.min(...records.map(r=>r.actualHeight)),Math.max(...records.map(r=>r.actualHeight))],nearestRoute:Math.min(...records.map(r=>r.nearestRoute)),maximumBasalGap:Math.max(...records.flatMap(r=>r.support.map(s=>s.maximum))),maximumBottomGap:Math.max(...records.flatMap(r=>r.support.map(s=>s.bottomMaximum))),method:'Actual source nodes/Float32 geometric normalization; actual Float32 instance yaw/lean/scale; all three geometric LOD basal points against rendered 2m Float32 triangle terrain. Dense 60Hz route polyline excludes full source bounds expanded2m.',limits:['Static source/support checks do not assess full-scene appearance; hardware review is required.','Route check covers dense path polyline and conservative2m bounds, not an analytic spline extremum proof.','No rock/crown occlusion or animated visual acceptance is inferred from these static support checks.'],records};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/cpu-check.json',JSON.stringify(report,null,2)+'\n');
console.log('COASTAL_YOUNG_WOODLAND_PASS '+JSON.stringify({...report,records:undefined,sourceModels:report.sourceModels.map(s=>({file:s.file,basalVertices:s.basalVertices}))}));
