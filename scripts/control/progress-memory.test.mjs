import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {parseOptions,browserCapture,runProgressCapture} from '../progress-capture.mjs';
import {createCaptureMemoryGuard,validateCaptureMemoryLimits,parseCaptureMemoryStat} from './progress-memory.mjs';

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

test('working memory is opt-in and requires the existing paired limits',()=>{
 assert.equal(validateCaptureMemoryLimits(),null);
 assert.equal(validateCaptureMemoryLimits(undefined,undefined,'total'),null);
 assert.equal(validateCaptureMemoryLimits(6144,7424).memoryMetric,'total');
 assert.deepEqual(validateCaptureMemoryLimits(6144,7424,'working'),{memoryStartMiB:6144,memoryLimitMiB:7424,memoryMetric:'working'});
 assert.throws(()=>validateCaptureMemoryLimits(undefined,undefined,'working'),/requires.*supplied together/);
 assert.throws(()=>validateCaptureMemoryLimits(6144,undefined,'working'),/supplied together/);
 for(const metric of ['resident','',null,3])assert.throws(()=>validateCaptureMemoryLimits(6144,7424,metric),/memoryMetric must be/);
});

test('memory.stat parses keyed fields irrespective of order and rejects malformed or incomplete data',()=>{
 const valid='file_dirty 7\nfile_writeback 3\nfuture_kernel_counter 11\nfile_mapped 5\ninactive_file 41\n';
 assert.deepEqual({...parseCaptureMemoryStat(valid)},{file_dirty:7,file_writeback:3,future_kernel_counter:11,file_mapped:5,inactive_file:41});
 for(const invalid of [
  valid.replace('file_mapped 5\n',''),valid+'inactive_file 99\n',valid+'file_dirty -1\n',
  valid.replace('file_mapped 5','file_mapped 1.5'),valid.replace('file_mapped 5','file_mapped NaN'),
  valid.replace('file_mapped 5','file_mapped Infinity'),valid.replace('file_mapped 5','file_mapped 9007199254740992'),
  valid+'unknown_counter -1\n',valid+'bad 4 extra\n',valid+'__proto__ 0\n','',null,
 ])assert.throws(()=>parseCaptureMemoryStat(invalid),/memory.stat/);
});

const memoryStat=(inactive,mapped=0,dirty=0,writeback=0)=>({inactive_file:inactive,file_mapped:mapped,file_dirty:dirty,file_writeback:writeback});

test('working discount protects mapped, dirty and writeback bytes, floors at zero and caps at raw memory',async()=>{
 for(const {raw,stat,discount}of [
  {raw:100,stat:memoryStat(70,10,5,5),discount:50},
  {raw:100,stat:memoryStat(20,15,10,1),discount:0},
  {raw:100,stat:memoryStat(200),discount:100},
  {raw:Number.MAX_SAFE_INTEGER,stat:memoryStat(Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER),discount:0},
 ]){
  const diagnostics={};let canceled=0;
  const guard=createCaptureMemoryGuard({memoryStartMiB:Number.MAX_SAFE_INTEGER,memoryLimitMiB:Number.MAX_SAFE_INTEGER+1,memoryMetric:'working',diagnostics},
   {readMemory:()=>raw,readMemoryStat:()=>stat,schedule:()=>17,cancel:()=>{canceled++;}});
  guard.preflight();await guard.finish();
  const state=diagnostics.memoryGuard;
  assert.equal(state.lastRawBytes,raw);assert.equal(state.lastEffectiveBytes,raw-discount);assert.equal(state.lastDiscountBytes,discount);
  assert.equal(state.startBytes,raw);assert.equal(state.startRawBytes,raw);assert.equal(state.startEffectiveBytes,raw-discount);
  assert.deepEqual(state.lastStat,stat);assert.equal(canceled,1);
 }
});

test('working thresholds use the estimate while preserving different raw and effective peaks and closing only its browser',async()=>{
 let tick,raw=95*MIB,stat=memoryStat(60*MIB,10*MIB,5*MIB,5*MIB),closes=0,cancels=0;
 const diagnostics={};
 const guard=createCaptureMemoryGuard({memoryStartMiB:80,memoryLimitMiB:90,memoryMetric:'working',diagnostics,getStage:()=> 'render'},
  {readMemory:()=>raw,readMemoryStat:()=>stat,schedule:(fn,interval)=>{assert.equal(interval,750);tick=fn;return 23;},cancel:()=>{cancels++;}});
 guard.preflight();guard.attachBrowser({close:async()=>{closes++;}});
 assert.equal(diagnostics.memoryGuard.startEffectiveBytes,55*MIB);
 raw=150*MIB;stat=memoryStat(100*MIB,10*MIB,5*MIB,5*MIB);tick();guard.assertHealthy();
 raw=140*MIB;stat=memoryStat(60*MIB,10*MIB,5*MIB,5*MIB);tick();
 assert.throws(()=>guard.assertHealthy(),/Capture memory limit reached: 100.00 MiB >= 90 MiB/);
 tick();await guard.finish();
 const state=diagnostics.memoryGuard;
 assert.equal(state.peakBytes,150*MIB);assert.equal(state.peakRawBytes,150*MIB);assert.equal(state.peakEffectiveBytes,100*MIB);
 assert.equal(state.abort.reason,'runtime-limit');assert.equal(state.abort.rawBytes,140*MIB);assert.equal(state.abort.effectiveBytes,100*MIB);assert.equal(state.abort.discountBytes,40*MIB);
 assert.equal(state.abort.stage,'render');assert.equal(closes,1);assert.equal(cancels,1);assert.equal(state.samples,3);
});

test('working guard fails closed for unreadable, absent or invalid stat data before launch and during polling',async()=>{
 for(const readMemoryStat of [
  ()=>{throw Error('EACCES');},()=>undefined,()=>memoryStat(undefined),()=>memoryStat(-1),
  ()=>memoryStat(1.5),()=>memoryStat(1,'0'),()=>({...memoryStat(1),unexpected:NaN}),
 ]){
  const diagnostics={};let scheduled=0;
  const guard=createCaptureMemoryGuard({memoryStartMiB:100,memoryLimitMiB:200,memoryMetric:'working',diagnostics},
   {readMemory:()=>50*MIB,readMemoryStat,schedule:()=>{scheduled++;}});
  assert.throws(()=>guard.preflight(),/could not read memory.current\/memory.stat/);
  assert.equal(diagnostics.memoryGuard.abort.reason,'memory-read-failure');assert.equal(scheduled,0);
 }
 let tick,fail=false,closes=0,cancels=0;const diagnostics={};
 const guard=createCaptureMemoryGuard({memoryStartMiB:100,memoryLimitMiB:200,memoryMetric:'working',diagnostics},
  {readMemory:()=>50*MIB,readMemoryStat:()=>{if(fail)throw Error('truncated stat');return memoryStat(10*MIB);},schedule:fn=>{tick=fn;return 29;},cancel:()=>{cancels++;}});
 guard.preflight();guard.attachBrowser({close:async()=>{closes++;}});fail=true;tick();await guard.finish();
 assert.throws(()=>guard.assertHealthy(),/memory.stat.*truncated stat/);assert.equal(closes,1);assert.equal(cancels,1);assert.equal(diagnostics.memoryGuard.abort.reason,'memory-read-failure');
});

test('total metric never reads memory.stat and preserves raw threshold behavior',async()=>{
 const diagnostics={};let tick,raw=50*MIB;
 const guard=createCaptureMemoryGuard({memoryStartMiB:100,memoryLimitMiB:200,diagnostics},
  {readMemory:()=>raw,readMemoryStat:()=>{throw Error('Total mode must not inspect memory.stat');},schedule:fn=>{tick=fn;return 31;},cancel:()=>{}});
 guard.preflight();raw=200*MIB;tick();await guard.finish();
 assert.throws(()=>guard.assertHealthy(),/memory limit reached/);const state=diagnostics.memoryGuard;
 assert.equal(state.memoryMetric,'total');assert.equal(state.lastRawBytes,200*MIB);assert.equal(state.lastEffectiveBytes,200*MIB);assert.equal(state.lastDiscountBytes,0);
 assert.equal(state.lastStat,undefined);assert.equal(state.peakBytes,200*MIB);
});
