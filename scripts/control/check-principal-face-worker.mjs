import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import * as THREE from 'three';
import {createDetailedRocks,ROCK_GEOMETRY_URL} from '../../src/world/detailed-rocks.ts';
import {decodeRockGeometrySource} from '../../src/world/rock-geometry.ts';
import {createCoastalField} from '../../src/world/coastal-field.ts';
import {terrainHeight,shoreDistance} from './fixtures/principal-face-baseline/math.ts';
import {terrainHeight as currentTerrainHeight} from '../../src/world/math.ts';
const began=performance.now();
const worker=new Worker(new URL('./principal-face-worker-runner.mjs',import.meta.url));
const result=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.once('exit',code=>{if(code!==0)reject(Error('Worker exit '+code))})});
await worker.terminate();assert.ok(!result.error,result.error);
const texture=new THREE.Texture(),textures=Object.fromEntries(['rock','rockNormal','rockARM','sand','sandNormal','sandARM','bark','barkNormal','soil','soilNormal','soilARM','moss','mossNormal','mossARM'].map(key=>[key,texture]));
const packed=fs.readFileSync('public'+ROCK_GEOMETRY_URL),source=decodeRockGeometrySource(packed.buffer.slice(packed.byteOffset,packed.byteOffset+packed.byteLength));
const rocks=createDetailedRocks(textures,source),field=createCoastalField(rocks),values=field.texture.image.data;
assert.equal(result.data.byteLength,1024*1024*4*4);assert.ok(values.every(Number.isFinite));
assert.deepEqual(Buffer.from(result.data),Buffer.from(values.buffer),'Actual coastal source worker differs from visible main-thread construction');
assert.deepEqual(result.bounds,field.bounds.toArray());
for(const key of ['instancesVisited','instancesRasterized','trianglesVisited','trianglesRasterized','degenerateTriangles','rockSamples','blockingSamples'])assert.equal(result.diagnostics[key],field.diagnostics[key],'Worker geometry mismatch: '+key);
let checked=0,changed=0;const [minX,minZ,maxX,maxZ]=result.bounds;
for(let j=0;j<1024;j++)for(let i=0;i<1024;i++){
 const x=minX+(i+.5)*(maxX-minX)/1024,z=minZ+(j+.5)*(maxZ-minZ)/1024;
 if(x< -209||x> -104||z<146||z>286)continue;
 const preceding=terrainHeight(x,z),actual=currentTerrainHeight(x,z),removal=preceding-actual;
 assert.equal(values[(j*1024+i)*4],Math.fround(actual),'Atlas terrain uses stale or inconsistent current height');
 checked++;if(removal>0)changed++;
}
const baselineWorker=new Worker(new URL('./principal-face-worker-runner.mjs',import.meta.url),{execArgv:[...process.execArgv,'--loader','./scripts/control/principal-face-baseline-loader.mjs']});
const baseline=await new Promise((resolve,reject)=>{baselineWorker.once('message',resolve);baselineWorker.once('error',reject);baselineWorker.once('exit',code=>{if(code!==0)reject(Error('Baseline worker exit '+code))})});
await baselineWorker.terminate();assert.ok(!baseline.error,baseline.error);
const oldValues=new Float32Array(baseline.data),channelChanges=[0,0,0,0],maximumChannelDelta=[0,0,0,0];let protectedShoreTerrainChanges=0;
assert.equal(oldValues.length,values.length);
const currentCoast=new Float32Array(1024*1024*3),referenceCoast=new Float32Array(currentCoast.length);
for(let j=0;j<1024;j++)for(let i=0;i<1024;i++){
 const offset=(j*1024+i)*4,x=minX+(i+.5)*(maxX-minX)/1024,z=minZ+(j+.5)*(maxZ-minZ)/1024;
 assert.equal(values[offset],Math.fround(currentTerrainHeight(x,z)),'Current atlas R must follow actual geometry at every texel');
 for(let channel=1;channel<4;channel++){currentCoast[(j*1024+i)*3+channel-1]=values[offset+channel];referenceCoast[(j*1024+i)*3+channel-1]=oldValues[offset+channel]}
 for(let channel=0;channel<4;channel++)if(values[offset+channel]!==oldValues[offset+channel]){channelChanges[channel]++;maximumChannelDelta[channel]=Math.max(maximumChannelDelta[channel],Math.abs(values[offset+channel]-oldValues[offset+channel]))}
 if(shoreDistance(x,z)<=45&&values[offset]!==oldValues[offset])protectedShoreTerrainChanges++;
}
assert.equal(protectedShoreTerrainChanges,0,'Protected shore terrain changed in actual worker atlas');
assert.deepEqual(channelChanges.slice(1),[0,0,0],'Local terrain edit reshuffled protected coastal masks or shelter');
const baselineSha256=crypto.createHash('sha256').update(Buffer.from(baseline.data)).digest('hex');
assert.equal(baselineSha256,'6fbe6e10c4769b2d2fd00c3a8219d2816194189327fc01394ee831cc1234de11','The exact frozen-world field changed');
const coastSha256=crypto.createHash('sha256').update(Buffer.from(referenceCoast.buffer)).digest('hex');
assert.equal(crypto.createHash('sha256').update(Buffer.from(currentCoast.buffer)).digest('hex'),coastSha256);
console.log('PRINCIPAL_FACE_WORKER_AUDIT '+JSON.stringify({scope:'Actual source-worker entry and transfer equals main-thread field; current R geometry and exact frozen-reference coastal channels; built-worker and GPU acceptance pending',bytes:result.data.byteLength,sha256:crypto.createHash('sha256').update(Buffer.from(result.data)).digest('hex'),checkedTerrainTexels:1024*1024,faceRegionTexels:checked,changedTerrainTexels:changed,baselineSha256,coastSha256,channelChanges,maximumChannelDelta,protectedShoreTerrainChanges,diagnostics:field.diagnostics,milliseconds:performance.now()-began}));
const geometries=new Set(),materials=new Set();rocks.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());field.texture.dispose();texture.dispose();
