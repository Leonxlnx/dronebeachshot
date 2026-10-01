export type ProfilingFenceOptions={timeoutMilliseconds?:number,pollMilliseconds?:number};
export type ProfilingFenceResult={method:'webgl2-fence',milliseconds:number,polls:number};

/** Inspection only: wait for commands already submitted to this WebGL2 context.
 * The caller must await this before submitting the next measured phase. It does
 * not measure PNG encoding, compositing, canvas copying, or commands issued by
 * another context. Normal rendering must never call this helper.
 *
 * A macrotask yield is required: WebGL forbids a newly-created fence from
 * reporting signaled until control returns to the browser's event loop.
 * No framebuffer, pixel-pack, viewport, renderer cache, or render state changes.
 * getError() consumes diagnostic error flags; any existing error fails loudly.
 */
export async function waitForProfilingFence(
 gl:WebGL2RenderingContext,
 {timeoutMilliseconds=120000,pollMilliseconds=4}:ProfilingFenceOptions={}
):Promise<ProfilingFenceResult>{
 if(!Number.isFinite(timeoutMilliseconds)||timeoutMilliseconds<=0)throw Error('Profiling fence timeout must be positive and finite');
 if(!Number.isFinite(pollMilliseconds)||pollMilliseconds<0)throw Error('Profiling fence polling interval must be nonnegative and finite');
 const started=performance.now();
 function check(label:string){
  if(gl.isContextLost())throw Error('Profiling fence: WebGL context lost ('+label+')');
  const error=gl.getError();
  if(error!==gl.NO_ERROR)throw Error('Profiling fence: WebGL error 0x'+error.toString(16)+' ('+label+')');
 }
 check('before fence');
 const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
 if(!sync){check('fence creation');throw Error('Profiling fence creation returned null');}
 try{
  check('fence creation');gl.flush();check('flush');
  let polls=0;
  // Promise.resolve()/queueMicrotask() do not return to the user-agent main loop.
  await new Promise<void>(resolve=>setTimeout(resolve,0));
  for(;;){
   check('before poll');
   const status=gl.clientWaitSync(sync,0,0);polls++;
   check('after poll');
   if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)
    return {method:'webgl2-fence',milliseconds:performance.now()-started,polls};
   if(status===gl.WAIT_FAILED)throw Error('Profiling fence wait failed');
   if(status!==gl.TIMEOUT_EXPIRED)throw Error('Profiling fence returned unexpected status '+status);
   const elapsed=performance.now()-started;
   if(elapsed>=timeoutMilliseconds)throw Error('Profiling fence timed out after '+Math.round(elapsed)+' ms');
   await new Promise<void>(resolve=>setTimeout(resolve,Math.min(pollMilliseconds,timeoutMilliseconds-elapsed)));
  }
 }finally{gl.deleteSync(sync);}
}
