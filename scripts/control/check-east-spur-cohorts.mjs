import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const dir='artifacts/refinement-2026-09-30/east-wall-structure/';
const read=name=>JSON.parse(fs.existsSync(dir+name)?fs.readFileSync(dir+name,'utf8'):gunzipSync(fs.readFileSync(dir+name+'.gz')).toString());
const before=read('cohorts-before-integration.json'),off=read('cohorts-integrated-off.json'),on=read('cohorts-integrated-on.json');
const packed=p=>Buffer.from(p.data,'base64');
const semanticMesh=({sourceOrdinals,...mesh})=>mesh;
assert.equal(off.studyEnabled,false);assert.equal(on.studyEnabled,true);
assert.equal(off.treeSha,before.treeSha);assert.equal(off.trees.length,14000);assert.equal(on.trees.length,13954);
for(const name of ['floor','structure','coastal']){
 assert.deepEqual(off[name].meshes.map(semanticMesh),before[name].meshes.map(semanticMesh),'Default-off changed actual '+name+' geometry/matrix/color bytes');
 assert.deepEqual(off[name].data.counts,before[name].data.counts);
 if(name!=='floor'){
  assert.deepEqual(off[name].data.forestStructurePlacements,before[name].data.forestStructurePlacements);
  for(const [key,value] of Object.entries(before[name].data.forestStructureStats))if(key!=='buildMilliseconds')assert.equal(off[name].data.forestStructureStats[key],value,'Default-off stat '+key);
 }
}
let coreChangedY=0;const refByXZ=new Map(off.trees.map((tree,index)=>[tree.x+','+tree.z,{tree,index}]));let last=-1;
for(const tree of on.trees){const original=refByXZ.get(tree.x+','+tree.z);assert.ok(original);assert.ok(original.index>last);last=original.index;assert.deepEqual({...tree,y:original.tree.y},original.tree);if(tree.y!==original.tree.y)coreChangedY++}
const result={defaultOffExact:true,core:{original:off.trees.length,retained:on.trees.length,omitted:off.trees.length-on.trees.length,changedY:coreChangedY},floor:{},structure:{}};
const slice=(packedValue,index,width)=>packed(packedValue).subarray(index*width*4,(index+1)*width*4);
const floorBefore=off.floor.data.eastSpurCohort,floorAfter=on.floor.data.eastSpurCohort;
assert.deepEqual(floorBefore.selected,floorAfter.selected,'Original shared-RNG selection caps changed');
for(const [meshIndex,kind] of ['roots','litter','seedlings'].entries()){
 const a=off.floor.meshes[meshIndex],b=on.floor.meshes[meshIndex],records=floorAfter[kind],expected=records.filter(r=>!r.omitted).map(r=>r.sourceOrdinal);
 assert.deepEqual(b.sourceOrdinals,expected);assert.deepEqual(records.map(r=>r.sourceOrdinal),floorBefore[kind].map(r=>r.sourceOrdinal));
 let unchanged=0,changed=0;
 if(kind==='roots'){
  // Each source TubeGeometry has 11 rings × 6 ring vertices, with fixed layout.
  for(const [out,source] of expected.entries()){
   const record=records[source];
   for(const [name,value] of Object.entries(a.attributes)){
    const bytesPerPrimitive=66*(name==='uv'?2:3)*4;
    const previous=packed(value).subarray(source*bytesPerPrimitive,(source+1)*bytesPerPrimitive),current=packed(b.attributes[name]).subarray(out*bytesPerPrimitive,(out+1)*bytesPerPrimitive);
    if(!record.local)assert.deepEqual(current,previous,'Untouched complete root primitive changed: '+source+'/'+name);
   }
   if(record.local)changed++;else unchanged++;
  }
 }else{
  assert.deepEqual(b.attributes,a.attributes);assert.deepEqual(b.index,a.index);
  for(const [out,source] of expected.entries()){
   if(!records[source].local){assert.deepEqual(slice(b.matrix,out,16),slice(a.matrix,source,16),'Outside '+kind+' transform changed');unchanged++}else changed++;
   if(a.color)assert.deepEqual(slice(b.color,out,3),slice(a.color,source,3),'Original litter color/RNG changed');
  }
 }
 result.floor[kind]={selected:records.length,retained:expected.length,omitted:records.filter(r=>r.omitted),localRetained:changed,outsideByteExact:unchanged};
}
for(const key of ['structure','coastal']){
 const a=off[key],b=on[key],audit=b.data.eastSpurCohort,local=new Map(audit.localRecords.map(r=>[r.sourceOrdinal,r]));
 assert.deepEqual(a.data.eastSpurCohort.referenceCounts,audit.referenceCounts,'Original structure selection counts changed');
 const reference=a.data.forestStructurePlacements,current=b.data.forestStructurePlacements;
 for(const [i,source] of audit.sourceOrdinals.entries())assert.deepEqual({...current[i],y:reference[source].y},reference[source],'Structure identity/attrs/order changed');
 let outside=0,touched=0;
 for(const mesh of b.meshes){
  const old=a.meshes.find(m=>m.name===mesh.name);assert.deepEqual(mesh.attributes,old.attributes);assert.deepEqual(mesh.index,old.index);
  for(const [i,source] of mesh.sourceOrdinals.entries()){
   const j=old.sourceOrdinals.indexOf(source);assert.ok(j>=0);
   if(!local.has(source)){assert.deepEqual(slice(mesh.matrix,i,16),slice(old.matrix,j,16),'Outside structure matrix changed');outside++}else touched++;
   if(mesh.color)assert.deepEqual(slice(mesh.color,i,3),slice(old.color,j,3),'Structure habitat color changed');
  }
 }
 result.structure[key]={counts:b.data.counts,referenceCounts:audit.referenceCounts,outsideExactInstances:outside,localRetainedInstances:touched,localRecords:audit.localRecords};
}
fs.writeFileSync(dir+'cohort-integration-check.json',JSON.stringify(result,null,2)+'\n');
console.log('EAST_SPUR_COHORT_PASS '+JSON.stringify(result));
