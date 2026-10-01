import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {parseOptions,browserCapture,runProgressCapture} from '../progress-capture.mjs';
import {createCaptureMemoryGuard} from './progress-memory.mjs';

const MIB=1024*1024;
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bay-memory-guard-'));fs.mkdirSync(path.join(root,'dist'));fs.writeFileSync(path.join(root,'dist/index.html'),'fixture');
 const options=parseOptions(['width=8','height=4','views=0','out=out','memoryStartMiB=100','memoryLimitMiB=200'],root);
 return{root,options,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}

test('memory CLI requires a valid pair and stays disabled unless explicitly enabled',()=>{
 const plain=parseOptions([]);assert.equal(plain.memoryStartMiB,undefined);assert.equal(plain.memoryLimitMiB,undefined);
 assert.equal(parseOptions(['memoryStartMiB=6144','memoryLimitMiB=7424']).memoryLimitMiB,7424);
 for(const args of [['memoryStartMiB=1'],['memoryLimitMiB=2'],['memoryStartMiB=0','memoryLimitMiB=2'],['memoryStartMiB=2','memoryLimitMiB=2'],['memoryStartMiB=3','memoryLimitMiB=2'],['memoryStartMiB=NaN','memoryLimitMiB=2'],['memoryStartMiB=1','memoryLimitMiB=Infinity']])assert.throws(()=>parseOptions(args),/Memory thresholds|supplied together/);
 const diagnostics={};const guard=createCaptureMemoryGuard({diagnostics},{readMemory:()=>{throw Error('Disabled guard must not read');},schedule:()=>{throw Error('Disabled guard must not poll');}});
 guard.preflight();guard.attachBrowser({close:()=>{throw Error('Disabled guard must not close');}});guard.assertHealthy();guard.stop();assert.deepEqual(diagnostics,{});
});

test('preflight holds before browser launch, records reason, and releases owned server/lock',async()=>{
 for(const failure of ['threshold','unreadable']){
  const f=fixture();let launches=0,serverCloses=0;
  try{
   await assert.rejects(runProgressCapture(f.options,{captureFactory:options=>browserCapture(options,{
    launchBrowser:async()=>{launches++;throw Error('Browser must not launch');},
    serve:async()=>({url:'http://fixture/',close:async()=>{serverCloses++;}}),
    memoryDependencies:{readMemory:()=>{if(failure==='unreadable')throw Error('EACCES');return 100*MIB;},schedule:()=>{throw Error('Preflight must not start a timer');}},
   }),log:()=>{}}),failure==='threshold'?/memory preflight held/:/could not read memory.current.*EACCES/);
   const manifest=JSON.parse(fs.readFileSync(path.join(f.options.output,'manifest.json')));
   assert.equal(launches,0);assert.equal(serverCloses,1);assert.equal(manifest.captureSucceeded,false);
   assert.equal(manifest.diagnostics.failingStage,'memory-preflight');
   assert.equal(manifest.diagnostics.memoryGuard.abort.reason,failure==='threshold'?'preflight-limit':'memory-read-failure');
   assert.equal(fs.existsSync(path.join(f.options.output,'.capture-lock.json')),false);
  }finally{f.cleanup();}
 }
});

test('runtime threshold interrupts its own startup and preserves the memory cause when cleanup also fails',async()=>{
 const f=fixture(),navigating=deferred(),navigation=deferred();let tick,memory=50*MIB,browserCloses=0,contextCloses=0,serverCloses=0,timerCancels=0,otherBrowserCloses=0;
 const otherBrowser={close:async()=>{otherBrowserCloses++;}};void otherBrowser;
 const page=new EventEmitter();Object.assign(page,{setDefaultTimeout:()=>{},addInitScript:async()=>{},goto:()=>{navigating.resolve();return navigation.promise;},url:()=> 'http://fixture/',evaluate:async()=>{throw Error('Owned browser closed');}});
 const context={newPage:async()=>page,close:async()=>{contextCloses++;}};
 const browser={newContext:async()=>context,close:async()=>{browserCloses++;if(browserCloses>1)throw Error('Owned browser cleanup failed');navigation.reject(Error('Target closed'));}};
 try{
  const capture=runProgressCapture(f.options,{captureFactory:options=>browserCapture(options,{
   launchBrowser:async()=>browser,serve:async()=>({url:'http://fixture/',close:async()=>{serverCloses++;}}),
   memoryDependencies:{readMemory:()=>memory,schedule:(callback,interval)=>{assert.equal(interval,750);tick=callback;return 27;},cancel:id=>{assert.equal(id,27);timerCancels++;}},
  }),log:()=>{}});
  const rejected=assert.rejects(capture,/Capture memory limit reached: 200.00 MiB >= 200 MiB/);
  await navigating.promise;memory=200*MIB;tick();await rejected;
  const manifest=JSON.parse(fs.readFileSync(path.join(f.options.output,'manifest.json'))),guard=manifest.diagnostics.memoryGuard;
  assert.equal(manifest.captureSucceeded,false);assert.equal(manifest.frames.length,0);
  assert.equal(guard.startBytes,50*MIB);assert.equal(guard.peakBytes,200*MIB);assert.equal(guard.memoryLimitMiB,200);assert.equal(guard.abort.reason,'runtime-limit');assert.equal(guard.abort.stage,'navigate');
  assert.match(manifest.error,/memory limit reached/);assert.match(manifest.diagnostics.failure,/memory limit reached/);
  assert.deepEqual(manifest.diagnostics.cleanupErrors,['Error: Owned browser cleanup failed']);
  assert.ok(browserCloses>=1);assert.equal(contextCloses,1);assert.equal(otherBrowserCloses,0);assert.equal(serverCloses,1);assert.equal(timerCancels,1);
  assert.equal(fs.existsSync(path.join(f.options.output,'.capture-lock.json')),false);
  assert.equal(page.listenerCount('request'),0);
 }finally{f.cleanup();}
});

test('guard stops after normal completion and closes a late launch if the limit crossed during launch',async()=>{
 let callback,bytes=40*MIB,cancels=0,closes=0;const diagnostics={};
 const guard=createCaptureMemoryGuard({memoryStartMiB:100,memoryLimitMiB:200,diagnostics,getStage:()=> 'launch-browser'},
  {readMemory:()=>bytes,schedule:fn=>{callback=fn;return 9;},cancel:()=>{cancels++;}});
 guard.preflight();bytes=200*MIB;callback();assert.throws(()=>guard.assertHealthy(),/memory limit reached/);
 guard.attachBrowser({close:async()=>{closes++;}});await guard.finish();assert.equal(closes,1);assert.equal(cancels,1);
 let normalPoll,normalCancels=0;const normalDiagnostics={};
 const normal=createCaptureMemoryGuard({memoryStartMiB:100,memoryLimitMiB:200,diagnostics:normalDiagnostics},
  {readMemory:()=>40*MIB,schedule:fn=>{normalPoll=fn;return 11;},cancel:()=>{normalCancels++;}});
 normal.preflight();normalPoll();normal.attachBrowser({close:async()=>{throw Error('Successful guard must leave closing to capture lifecycle');}});await normal.finish();
 assert.equal(normalCancels,1);assert.equal(normalDiagnostics.memoryGuard.abort,null);assert.equal(normalDiagnostics.memoryGuard.samples,2);
});
