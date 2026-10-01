import path from 'node:path';
import {withDeadline} from './capture-run.mjs';
import {writeAtomicJson} from './progress-checkpoints.mjs';
import {readCaptureMemoryBytes} from './progress-memory.mjs';

export function validateJsHeapMiB(value){
 if(value===undefined)return undefined;
 const size=Number(value);
 if(!Number.isInteger(size)||size<128||size>4096)throw Error('jsHeapMiB must be an integer from 128 to 4096');
 return size;
}

// Diagnostic reads only: no GC, heap snapshot, rendering or process control.
// A timed-out command may still exist in CDP, so stop sampling permanently
// after any timeout/error rather than queueing more work behind that command.
export function createStartupMemorySampler({context,page,output,diagnostics,jsHeapMiB,getStage=()=>null},
 {readMemory=readCaptureMemoryBytes,schedule=setInterval,cancel=clearInterval,deadline=withDeadline,now=()=>new Date().toISOString(),persist=value=>{if(output)writeAtomicJson(path.join(output,'startup-memory.json'),value);}}={}){
 const state=diagnostics.startupMemory={version:1,jsHeapMiB,intervalMs:5000,timeoutMs:3000,maxSamples:80,samples:[],stoppedReason:null};
 let session,timer,pending,stopped=false,detached=false;
 const save=()=>persist(state);
 function halt(reason){stopped=true;state.stoppedReason??=reason;state.stoppedAt??=now();if(timer!==undefined){cancel(timer);timer=undefined;}}
 async function detach(){if(session&&!detached){detached=true;try{await deadline(session.detach(),1500,'Startup memory CDP detach');}catch(error){state.detachError=String(error);}}}
 async function sample(label){
  if(stopped||pending)return pending;
  const item={at:now(),stage:getStage(),...(label?{label}:{})};
  pending=(async()=>{
   try{
    try{item.cgroupBytes=readMemory();}catch(error){item.cgroupError=String(error);}
    // Persist partial heap evidence even if a busy page cannot answer the DOM read.
    await deadline(Promise.all([
     session.send('Runtime.getHeapUsage').then(heap=>{item.heap=heap;}),
     page.evaluate(()=>({label:document.getElementById('load-label')?.textContent?.slice(0,256)??null,
      progress:document.getElementById('load-progress')?.value??null,ready:window.lastLightBay?.ready??false,
      visibleError:document.getElementById('error')?.textContent?.slice(0,512)??null,
      jsHeapSizeLimit:performance.memory?.jsHeapSizeLimit??null})).then(progress=>{item.page=progress;}),
    ]),state.timeoutMs,'Startup memory sample');
   }catch(error){item.error=String(error);halt('sample-failed');}
   finally{
    item.settledAt=now();state.samples.push({...item});
    if(state.samples.length>=state.maxSamples)halt('sample-limit');
    save();pending=undefined;
   }
  })();
  return pending;
 }
 return {
  async start(){
   try{
    const opening=context.newCDPSession(page).then(value=>{session=value;if(stopped)void detach();return value;});
    await deadline(opening,3000,'Startup memory CDP attachment');
    await sample('before-navigation');
    if(!stopped){timer=schedule(()=>{void sample().catch(error=>{state.persistenceError=String(error);halt('persist-failed');});},state.intervalMs);timer?.unref?.();}
   }catch(error){state.setupError=String(error);halt('setup-failed');save();}
  },
  sample,
  async stop(reason='cleanup'){
   halt(reason);
   // Do not await a stuck page command. Detaching rejects outstanding CDP work;
   // the bounded sample deadline still settles the diagnostic promise itself.
   await detach();
   if(pending)await pending;
   save();
  },
 };
}
