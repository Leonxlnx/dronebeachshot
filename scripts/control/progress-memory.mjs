import fs from 'node:fs';

const MIB=1024*1024;
export const CAPTURE_MEMORY_FILE='/sys/fs/cgroup/memory.current';
export function validateCaptureMemoryLimits(memoryStartMiB,memoryLimitMiB){
 if(memoryStartMiB===undefined&&memoryLimitMiB===undefined)return null;
 if(memoryStartMiB===undefined||memoryLimitMiB===undefined)throw Error('memoryStartMiB and memoryLimitMiB must be supplied together');
 const start=Number(memoryStartMiB),limit=Number(memoryLimitMiB);
 if(!Number.isFinite(start)||start<=0||!Number.isFinite(limit)||limit<=0||start>=limit)throw Error('Memory thresholds must be positive finite MiB values with memoryStartMiB < memoryLimitMiB');
 return {memoryStartMiB:start,memoryLimitMiB:limit};
}
export function readCaptureMemoryBytes(){
 const text=fs.readFileSync(CAPTURE_MEMORY_FILE,'utf8').trim();
 if(!/^\d+$/.test(text))throw Error('Invalid cgroup memory.current value');
 const value=Number(text);
 if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid cgroup memory.current byte count');
 return value;
}

// Owns only a timer and the browser object explicitly attached by this capture.
// Never discovers processes, sends signals, or changes cgroup limits.
export function createCaptureMemoryGuard({memoryStartMiB,memoryLimitMiB,diagnostics,getStage=()=>null},
 {readMemory=readCaptureMemoryBytes,schedule=setInterval,cancel=clearInterval,now=()=>new Date().toISOString()}={}){
 const limits=validateCaptureMemoryLimits(memoryStartMiB,memoryLimitMiB);
 let timer,browser,error,closePromise;
 const state=limits?diagnostics.memoryGuard={enabled:true,file:CAPTURE_MEMORY_FILE,...limits,pollIntervalMs:750,startBytes:null,peakBytes:null,samples:0,abort:null}:null;
 function stop(){if(timer!==undefined){cancel(timer);timer=undefined;}if(state)state.stoppedAt??=now();}
 function closeOwnedBrowser(){
  if(browser&&!closePromise){
   state.browserCloseRequestedAt=now();
   closePromise=Promise.resolve().then(()=>browser.close()).then(()=>{state.browserClosedAt=now();},failure=>{state.browserCloseError=String(failure);});
  }
 }
 function abort(reason,cause){
  if(error)return;
  error=cause instanceof Error?cause:Error(String(cause));
  state.abort={reason,at:now(),stage:getStage(),message:String(error),bytes:state.lastBytes??null};
  stop();closeOwnedBrowser();
 }
 function sample(){
  const bytes=readMemory();
  if(!Number.isSafeInteger(bytes)||bytes<0)throw Error('Invalid cgroup memory.current byte count');
  state.lastBytes=bytes;state.peakBytes=Math.max(state.peakBytes??0,bytes);state.samples++;state.lastSampleAt=now();
  return bytes/MIB;
 }
 function poll(){
  if(error)return;
  try{const mib=sample();if(mib>=limits.memoryLimitMiB)abort('runtime-limit',Error(`Capture memory limit reached: ${mib.toFixed(2)} MiB >= ${limits.memoryLimitMiB} MiB`));}
  catch(cause){abort('memory-read-failure',Error('Capture memory guard could not read memory.current: '+String(cause),{cause}));}
 }
 return {
  preflight(){
   if(!limits)return;
   if(state.samples)throw Error('Capture memory preflight already performed');
   try{
    const mib=sample();state.startBytes=state.lastBytes;
    if(mib>=limits.memoryStartMiB)abort('preflight-limit',Error(`Capture memory preflight held: ${mib.toFixed(2)} MiB >= ${limits.memoryStartMiB} MiB`));
   }catch(cause){abort('memory-read-failure',Error('Capture memory guard could not read memory.current: '+String(cause),{cause}));}
   if(error)throw error;
   timer=schedule(poll,750);timer?.unref?.();
  },
  attachBrowser(value){if(!limits)return;if(browser)throw Error('Capture memory guard already owns a browser');browser=value;if(error)closeOwnedBrowser();},
  assertHealthy(){if(error)throw error;},
  get error(){return error;},
  stop,
  async finish(){stop();await closePromise;},
 };
}
