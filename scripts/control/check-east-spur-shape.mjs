import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Worker} from 'node:worker_threads';
import {terrainHeight,terrainHeightBeforePrincipalFace,shoreDistance,rng} from '../../src/world/math.ts';
import {renderedTerrainHeight,renderedTerrainHeightBeforePrincipalFace} from '../../src/world/terrain-surface.ts';
import {EAST_SPUR_STUDY_ENABLED,eastSpurUplift} from '../../src/world/east-spur.ts';
import {pathPosition} from '../../src/camera/cinematic.ts';
import {roundedSpurSample} from '../../artifacts/refinement-2026-09-30/east-wall-structure/rounded-spur-study.mjs';
assert.equal(EAST_SPUR_STUDY_ENABLED,true);
let changed=0,maxUplift=0,minChangedShore=Infinity;const samples=[];
for(let z=90;z<=180;z+=2)for(let x=138;x<=268;x+=2){
 const h=terrainHeightBeforePrincipalFace(x,z),d=shoreDistance(x,z),actual=terrainHeight(x,z),expected=roundedSpurSample(x,z,h,d).height;
 assert.equal(actual,expected,'Production changed the exact visually tested spur');
 const addition=actual-h;assert.ok(addition>=0&&addition<=32+1e-12);
 if(addition>0){changed++;maxUplift=Math.max(maxUplift,addition);minChangedShore=Math.min(minChangedShore,d)}
 if(d<=45)assert.equal(actual,h);samples.push([x,z]);
}
assert.equal(changed,1160);assert.ok(Math.abs(maxUplift-32)<1e-12);
let routeSamples=0;
for(let i=0;i<=1200;i++){
 const {x,z}=pathPosition(i/60);assert.equal(terrainHeight(x,z),terrainHeightBeforePrincipalFace(x,z));assert.equal(renderedTerrainHeight(x,z),renderedTerrainHeightBeforePrincipalFace(x,z));routeSamples++;
}
assert.equal(terrainHeight(-124,350),terrainHeightBeforePrincipalFace(-124,350));
const random=rng(801942);for(let i=0;i<10000;i++){const x=random()*1600-800,z=random()*2000-1000,d=shoreDistance(x,z);if(d<=45)assert.equal(eastSpurUplift(x,z,d),0);if(z<=98||z>=173)assert.equal(terrainHeight(x,z),terrainHeightBeforePrincipalFace(x,z))}
// The actual source imports run in a fresh worker with the same loader override.
// This is height/surface parity; it does not substitute for a full atlas build.
const worker=new Worker(new URL('./east-spur-height-worker.mjs',import.meta.url),{workerData:samples});
const values=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject)});await worker.terminate();
assert.deepEqual(values,samples.map(([x,z])=>[terrainHeight(x,z),renderedTerrainHeight(x+.37,z+.59)]));
const result={enabled:true,changedCoreGridVertices:changed,maxUplift,minChangedShore,routeSamples,protectedCoastExact:true,summitExact:true,workerHeightSamples:samples.length,workerScope:'Source height and Float32 surface imports; not coastal atlas/GPU verification',visualAcceptance:false};
fs.writeFileSync('artifacts/refinement-2026-09-30/east-wall-structure/integrated-shape-check.json',JSON.stringify(result,null,2)+'\n');console.log('EAST_SPUR_SHAPE_PASS '+JSON.stringify(result));
