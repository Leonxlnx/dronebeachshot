import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
const filename=fs.readdirSync('dist/assets').find(name=>/^coastal-worker-.*\.js$/.test(name));
assert.ok(filename,'Built worker bundle missing');
// CPU-only worker validation. This does not create a browser or a WebGL context.
const runner=new URL('./worker-check-runner.mjs',import.meta.url);
const worker=new Worker(runner,{workerData:{bundle:pathToFileURL(process.cwd()+'/dist/assets/'+filename).href}});
const result=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject)});await worker.terminate();
assert.ok(!result.error,result.error);const floats=new Float32Array(result.data);assert.equal(floats.length,1024*1024*4);assert.ok(floats.every(Number.isFinite));
const sha256=crypto.createHash('sha256').update(Buffer.from(result.data)).digest('hex');
const world=JSON.parse(fs.readFileSync('artifacts/world-cpu-check.json','utf8'));assert.equal(sha256,world.fieldSha256,'Worker field differs from visible-world construction');
const report={scope:'CPU worker bundle and transfer only; no browser or GPU verification',bundle:filename,bytes:result.data.byteLength,sha256,equalsWorldAtlas:true,diagnostics:result.diagnostics};
fs.writeFileSync('artifacts/worker-cpu-check.json',JSON.stringify(report,null,2)+'\n');console.log('WORKER_CPU_PASS: built worker field equals main-thread world field, '+result.data.byteLength+' bytes');
