import fs from 'node:fs';

const MIB=1024*1024;
export const CAPTURE_MEMORY_FILE='/sys/fs/cgroup/memory.current';
export const CAPTURE_MEMORY_STAT_FILE='/sys/fs/cgroup/memory.stat';
const WORKING_FIELDS=['inactive_file','file_mapped','file_dirty','file_writeback'];
export function validateCaptureMemoryLimits(memoryStartMiB,memoryLimitMiB,memoryMetric='total'){
 if(!['total','working'].includes(memoryMetric))throw Error('memoryMetric must be total or working');
 if(memoryStartMiB===undefined&&memoryLimitMiB===undefined){
  if(memoryMetric==='working')throw Error('memoryMetric=working requires memoryStartMiB and memoryLimitMiB supplied together');
  return null;
 }
 if(memoryStartMiB===undefined||memoryLimitMiB===undefined)throw Error('memoryStartMiB and memoryLimitMiB must be supplied together');
 const start=Number(memoryStartMiB),limit=Number(memoryLimitMiB);
 if(!Number.isFinite(start)||start<=0||!Number.isFinite(limit)||limit<=0||start>=limit)throw Error('Memory thresholds must be positive finite MiB values with memoryStartMiB < memoryLimitMiB');
 return {memoryStartMiB:start,memoryLimitMiB:limit,memoryMetric};
}
export function readCaptureMemoryBytes(){
 const text=fs.readFileSync(CAPTURE_MEMORY_FILE,'utf8').trim();
 if(!/^\d+$/.test(text))throw Error('Invalid cgroup memory.current value');
 const value=Number(text);
 if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid cgroup memory.current byte count');
 return value;
}
function validateMemoryStat(stat){
 if(!stat||typeof stat!=='object'||Array.isArray(stat))throw Error('Invalid cgroup memory.stat object');
 for(const [key,value]of Object.entries(stat)){
  if(!/^[a-z][a-z0-9_]*$/.test(key)||!Number.isSafeInteger(value)||value<0)throw Error('Invalid cgroup memory.stat field: '+key);
 }
 for(const key of WORKING_FIELDS)if(!Object.hasOwn(stat,key))throw Error('Missing cgroup memory.stat field: '+key);
 return stat;
}
export function parseCaptureMemoryStat(text){
 if(typeof text!=='string')throw Error('Invalid cgroup memory.stat text');
 const stat=Object.create(null);
 for(const line of text.split(/\r?\n/)){
  if(!line.trim())continue;
  const match=/^\s*([a-z][a-z0-9_]*)\s+(\d+)\s*$/.exec(line);
  if(!match)throw Error('Malformed cgroup memory.stat line');
  const [,key,value]=match;
  if(Object.hasOwn(stat,key))throw Error('Duplicate cgroup memory.stat field: '+key);
  stat[key]=Number(value);
 }
 return validateMemoryStat(stat);
}
export function readCaptureMemoryStat(){return parseCaptureMemoryStat(fs.readFileSync(CAPTURE_MEMORY_STAT_FILE,'utf8'));}

// Opt-in pressure estimate, not guaranteed immediately reclaimable memory.
// Kernel definitions: https://docs.kernel.org/admin-guide/cgroup-v2.html#memory
// inactive_file is reclaim-list state; subtracting all mapped/dirty/writeback
// counters deliberately overprotects overlapping categories. Keep raw totals.
function workingDiscount(rawBytes,stat){
 let discount=stat.inactive_file;
 for(const key of WORKING_FIELDS.slice(1))discount=Math.max(0,discount-stat[key]);
 return Math.min(rawBytes,discount);
}

// Owns only a timer and the browser object explicitly attached by this capture.
// Never discovers processes, sends signals, or changes cgroup limits.
export function createCaptureMemoryGuard({memoryStartMiB,memoryLimitMiB,memoryMetric='total',diagnostics,getStage=()=>null},
 {readMemory=readCaptureMemoryBytes,readMemoryStat=readCaptureMemoryStat,schedule=setInterval,cancel=clearInterval,now=()=>new Date().toISOString()}={}){
 const limits=validateCaptureMemoryLimits(memoryStartMiB,memoryLimitMiB,memoryMetric);
 let timer,browser,error,closePromise;
 const state=limits?diagnostics.memoryGuard={enabled:true,file:CAPTURE_MEMORY_FILE,...limits,
  ...(memoryMetric==='working'?{statFile:CAPTURE_MEMORY_STAT_FILE,discountFormula:'min(raw, max(0, inactive_file - file_mapped - file_dirty - file_writeback))'}:{}),
  pollIntervalMs:750,startBytes:null,peakBytes:null,startRawBytes:null,startEffectiveBytes:null,peakRawBytes:null,peakEffectiveBytes:null,samples:0,abort:null}:null;
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
  state.abort={reason,at:now(),stage:getStage(),message:String(error),bytes:state.lastBytes??null,rawBytes:state.lastRawBytes??null,effectiveBytes:state.lastEffectiveBytes??null,discountBytes:state.lastDiscountBytes??null};
  stop();closeOwnedBrowser();
 }
 function sample(){
  const bytes=readMemory();
  if(!Number.isSafeInteger(bytes)||bytes<0)throw Error('Invalid cgroup memory.current byte count');
  const stat=memoryMetric==='working'?validateMemoryStat(readMemoryStat()):null;
  const discount=stat?workingDiscount(bytes,stat):0,effective=bytes-discount;
  state.lastBytes=state.lastRawBytes=bytes;state.lastEffectiveBytes=effective;state.lastDiscountBytes=discount;
  state.peakBytes=state.peakRawBytes=Math.max(state.peakRawBytes??0,bytes);state.peakEffectiveBytes=Math.max(state.peakEffectiveBytes??0,effective);
  if(stat)state.lastStat={...stat};
  state.samples++;state.lastSampleAt=now();
  return effective/MIB;
 }
 const readLabel=memoryMetric==='working'?'memory.current/memory.stat':'memory.current';
 function poll(){
  if(error)return;
  try{const mib=sample();if(mib>=limits.memoryLimitMiB)abort('runtime-limit',Error(`Capture memory limit reached: ${mib.toFixed(2)} MiB >= ${limits.memoryLimitMiB} MiB`));}
  catch(cause){abort('memory-read-failure',Error('Capture memory guard could not read '+readLabel+': '+String(cause),{cause}));}
 }
 return {
  preflight(){
   if(!limits)return;
   if(state.samples)throw Error('Capture memory preflight already performed');
   try{
    const mib=sample();state.startBytes=state.startRawBytes=state.lastRawBytes;state.startEffectiveBytes=state.lastEffectiveBytes;
    if(mib>=limits.memoryStartMiB)abort('preflight-limit',Error(`Capture memory preflight held: ${mib.toFixed(2)} MiB >= ${limits.memoryStartMiB} MiB`));
   }catch(cause){abort('memory-read-failure',Error('Capture memory guard could not read '+readLabel+': '+String(cause),{cause}));}
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
