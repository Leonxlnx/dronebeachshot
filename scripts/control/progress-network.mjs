/** Request lifecycle diagnostics for intermediate captures; no failure is ignored. */
export function trackCaptureRequests(page,{failedRequests,diagnostics,getStage=()=> 'unknown'}){
 const active=new Map(),changes=new Set();let sequence=0;
 const timeline=diagnostics.networkEvents??=[];
 const now=()=>new Date().toISOString();
 const notify=()=>{for(const listener of changes)listener();};
 const record=value=>{timeline.push(value);if(timeline.length>160)timeline.splice(0,timeline.length-160);};
 const details=request=>({url:request.url(),method:request.method(),resourceType:request.resourceType()});
 const start=request=>{const value={id:++sequence,...details(request),startedAt:now(),stage:getStage()};active.set(request,value);record({event:'request',...value});notify();};
 const finish=request=>{const value=active.get(request)??details(request);active.delete(request);record({event:'finished',...value,finishedAt:now(),stage:getStage()});notify();};
 const fail=request=>{
  const value={kind:'requestfailed',...(active.get(request)??details(request)),errorText:request.failure()?.errorText??null,failedAt:now(),failureStage:getStage()};
  active.delete(request);failedRequests.push(value);record(value);notify();
 };
 const response=response=>{
  const request=response.request(),entry=active.get(request),headers=response.headers();
  if(entry){entry.status=response.status();entry.contentLength=headers['content-length']??null;}
  if(response.status()>=400){const value={kind:'http-error',...details(request),status:response.status(),failedAt:now(),failureStage:getStage()};failedRequests.push(value);record(value);}
 };
 page.on('request',start);page.on('requestfinished',finish);page.on('requestfailed',fail);page.on('response',response);
 const snapshot=()=>[...active.values()].map(value=>({...value}));
 return{snapshot,
  waitForIdle({timeoutMs=30000,quietMs=250}={}){
   if(!Number.isFinite(timeoutMs)||timeoutMs<=0||!Number.isFinite(quietMs)||quietMs<0)throw Error('Invalid network drain deadline');
   return new Promise((resolve,reject)=>{
    let quiet;
    const cleanup=()=>{clearTimeout(quiet);clearTimeout(deadline);changes.delete(check);};
    const check=()=>{clearTimeout(quiet);if(active.size===0)quiet=setTimeout(()=>{cleanup();resolve();},quietMs);};
    const deadline=setTimeout(()=>{const pending=snapshot();cleanup();reject(Error('Capture network drain timed out: '+JSON.stringify(pending)));},timeoutMs);
    changes.add(check);check();
   });
  },
  dispose(){page.off('request',start);page.off('requestfinished',finish);page.off('requestfailed',fail);page.off('response',response);},
 };
}
