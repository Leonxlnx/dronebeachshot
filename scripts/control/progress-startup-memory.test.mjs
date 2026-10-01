import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseOptions,browserCapture} from '../progress-capture.mjs';
import {createStartupMemorySampler} from './progress-startup-memory.mjs';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};

test('heap option is bounded, omitted by default, and adds only the requested V8 flag',async()=>{
 assert.equal(parseOptions([]).jsHeapMiB,undefined);
 for(const value of ['127','4097','512.5','NaN','Infinity',''])assert.throws(()=>parseOptions(['jsHeapMiB='+value]),/integer from 128 to 4096/);
 for(const value of ['128','512','4096'])assert.equal(parseOptions(['jsHeapMiB='+value]).jsHeapMiB,Number(value));
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bay-heap-cli-'));fs.mkdirSync(path.join(root,'assets'));
 try{
  for(const jsHeapMiB of [undefined,512]){
   let launchArgs;
   await assert.rejects(browserCapture({directory:root,width:8,height:4,readyTimeout:100,errors:[],failedRequests:[],jsHeapMiB},{
    serve:async()=>({url:'http://fixture',close:async()=>{}}),launchBrowser:async options=>{launchArgs=options.args;throw Error('fixture launch stop');},
   }),/fixture launch stop/);
   assert.deepEqual(launchArgs.filter(arg=>arg.startsWith('--js-flags')),jsHeapMiB===undefined?[]:['--js-flags=--max-old-space-size=512']);
   assert.ok(!launchArgs.some(arg=>arg.includes('expose-gc')));
  }
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('settled startup samples persist heap, progress and cgroup with one outstanding request and owned cleanup',async()=>{
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'bay-startup-samples-')),diagnostics={};
 let callback,cancels=0,detaches=0,requests=0,hold=null;
 const session={send:async method=>{assert.equal(method,'Runtime.getHeapUsage');requests++;if(hold)await hold.promise;return{usedSize:12,totalSize:20,embedderHeapUsedSize:4,backingStorageSize:32};},detach:async()=>{detaches++;}};
 const sampler=createStartupMemorySampler({context:{newCDPSession:async()=>session},page:{evaluate:async()=>({label:'Preparing forest detail',progress:65,ready:false,jsHeapSizeLimit:587202560})},output,diagnostics,jsHeapMiB:512,getStage:()=> 'scene-readiness'},
  {readMemory:()=>6000*1048576,schedule:fn=>{callback=fn;return 17;},cancel:id=>{assert.equal(id,17);cancels++;}});
 try{
  await sampler.start();let saved=JSON.parse(fs.readFileSync(path.join(output,'startup-memory.json')));
  assert.equal(saved.samples.length,1);assert.equal(saved.samples[0].heap.backingStorageSize,32);assert.equal(saved.samples[0].page.progress,65);assert.equal(saved.samples[0].cgroupBytes,6000*1048576);
  hold=deferred();callback();callback();callback();assert.equal(requests,2);
  hold.resolve();await sampler.sample();await sampler.stop('capture-ready');
  saved=JSON.parse(fs.readFileSync(path.join(output,'startup-memory.json')));assert.equal(saved.samples.length,2);assert.equal(saved.stoppedReason,'capture-ready');assert.equal(detaches,1);assert.equal(cancels,1);
  callback();await sampler.sample();assert.equal(requests,2);await sampler.stop();assert.equal(detaches,1);
 }finally{fs.rmSync(output,{recursive:true,force:true});}
});

test('a timed-out startup read persists partial evidence and never queues another request',async()=>{
 let reads=0,timers=0,detaches=0;const diagnostics={},saved=[];
 const stalled=deferred(),timeout=deferred();
 const sampler=createStartupMemorySampler({context:{newCDPSession:async()=>({send:async()=>{reads++;return{usedSize:10,backingStorageSize:300};},detach:async()=>{detaches++;}})},page:{evaluate:()=>stalled.promise},diagnostics,jsHeapMiB:512},
  {readMemory:()=>123,schedule:()=>{timers++;},persist:value=>saved.push(JSON.parse(JSON.stringify(value))),deadline:(promise,ms,label)=>label==='Startup memory sample'?Promise.race([promise,timeout.promise]):promise});
 const starting=sampler.start();await new Promise(resolve=>setImmediate(resolve));timeout.reject(Error('Startup memory sample timed out'));await starting;
 assert.equal(saved.at(-1).samples[0].heap.backingStorageSize,300);assert.match(saved.at(-1).samples[0].error,/timed out/);assert.equal(timers,0);
 await sampler.sample();assert.equal(reads,1);await sampler.stop();assert.equal(detaches,1);
 stalled.resolve({label:'late result'});await new Promise(resolve=>setImmediate(resolve));assert.equal(diagnostics.startupMemory.samples[0].page,undefined);
});

test('sample history is bounded and setup failure remains explicit without leaked sessions',async()=>{
 let detached=0;const diagnostics={};
 const sampler=createStartupMemorySampler({context:{newCDPSession:async()=>({send:async()=>({usedSize:1}),detach:async()=>{detached++;}})},page:{evaluate:async()=>({progress:1})},diagnostics,jsHeapMiB:512},
  {readMemory:()=>1,schedule:()=>5,cancel:()=>{},persist:()=>{}});
 await sampler.start();for(let i=0;i<100;i++)await sampler.sample();assert.equal(diagnostics.startupMemory.samples.length,80);assert.equal(diagnostics.startupMemory.stoppedReason,'sample-limit');await sampler.stop();assert.equal(detached,1);
 const broken={};const failed=createStartupMemorySampler({context:{newCDPSession:async()=>{throw Error('CDP unavailable');}},page:{},diagnostics:broken,jsHeapMiB:512},{persist:()=>{}});
 await failed.start();assert.match(broken.startupMemory.setupError,/CDP unavailable/);await failed.stop();
});
