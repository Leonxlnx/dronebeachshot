/** Intermediate production capture only. Does not satisfy final capture gates.
 * node scripts/progress-capture.mjs [video] width=768 [height=432] out=...
 * Still plans: plan=entries.json, or views=0,6,10.5,19.5
 * Video: fps=24 duration=20 start=0 profile=settings.json [resume]
 * A video pins its first dist bundle. Resume validates every committed PNG and
 * replays it into a fresh encoder before rendering the missing suffix.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {assertCaptureHealthy,inspectPng} from './control/capture-integrity.mjs';
import {withDeadline,writeEncoderFrame} from './control/capture-run.mjs';
import {acquireCaptureLock,makeVideoContract,openVideoCheckpoint,validateProfile,validateTimeline,writeAtomic,writeAtomicJson} from './control/progress-checkpoints.mjs';
import {trackCaptureRequests} from './control/progress-network.mjs';
import {captureGlbManifest,installCaptureGlbFetch} from './control/progress-glb-fetch.mjs';

const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const settingMethods={lighting:'setLighting',surfaceStudy:'setSurfaceStudy',shadowStudy:'setShadowStudy',
 culling:'setGroundCulling',oceanCulling:'setOceanCulling',debug:'setDebug',farCrownCoverage:'setFarCrownCoverage',
 farCrownBlending:'setFarCrownBlending',linearMainOutput:'setLinearMainOutput',profiling:'setFrameProfiling',coastalUnderstory:'setCoastalUnderstory'};
const settingsOf=entry=>Object.fromEntries(Object.entries(entry).filter(([key])=>key!=='view'&&key!=='label'));
const supportedArguments=new Set(['width','height','out','dist','plan','views','times','fps','duration','start','profile','writeTimeout','exitTimeout','readyTimeout','networkTimeout','resume','video']);
export function parseOptions(argv,root=projectRoot){
 const args={};let video=false,resume=false;
 for(const item of argv){
  if(item==='video'){video=true;continue;}if(item==='resume'){resume=true;continue;}
  const index=item.indexOf('=');if(index<1)throw Error('Expected key=value capture argument: '+item);
  const key=item.slice(0,index),value=item.slice(index+1);if(!supportedArguments.has(key)||Object.hasOwn(args,key))throw Error('Unknown or repeated capture argument: '+key);args[key]=value;
 }
 for(const key of ['video','resume'])if(args[key]!==undefined&&!['true','false','1','0'].includes(args[key]))throw Error('Invalid boolean capture option: '+key);
 video=video||args.video==='true'||args.video==='1';resume=resume||args.resume==='true'||args.resume==='1';
 const width=Number(args.width??768),height=Number(args.height??Math.floor(width*9/16/2)*2);
 if(![width,height].every(n=>Number.isInteger(n)&&n>=2&&n<=16384))throw Error('Invalid capture dimensions');
 const resolve=file=>path.resolve(root,file),readJson=file=>JSON.parse(fs.readFileSync(resolve(file),'utf8'));
 const profile=validateProfile(args.profile?readJson(args.profile):{});
 let timeline=args.plan?readJson(args.plan):undefined;
 if(args.plan&&(args.views||args.times))throw Error('Choose a plan or explicit views');
 if(args.views&&args.times)throw Error('Choose views or times, not both');
 if(args.views||args.times)timeline=(args.views??args.times).split(',').map(view=>({view}));
 const options={root,width,height,video,resume,output:resolve(args.out??'artifacts/progress-'+new Date().toISOString().replaceAll(':','-')),
  dist:resolve(args.dist??'dist'),fps:Number(args.fps??24),duration:Number(args.duration??20),start:Number(args.start??0),profile,
  writeTimeout:Number(args.writeTimeout??120000),exitTimeout:Number(args.exitTimeout??120000),readyTimeout:Number(args.readyTimeout??300000),networkTimeout:Number(args.networkTimeout??30000)};
 for(const key of ['writeTimeout','exitTimeout','readyTimeout','networkTimeout'])if(!Number.isFinite(options[key])||options[key]<=0)throw Error('Invalid '+key);
 if(video)options.contract=makeVideoContract({...options,timeline});
 else{if(resume)throw Error('Resume is supported for video checkpoints only');options.timeline=validateTimeline(timeline??[0,6,10.5,19.5].map(view=>({view})));}
 return options;
}

async function serveBundle(directory,diagnostics={}){
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.glb':'model/gltf-binary','.rg8':'application/octet-stream','.woff2':'font/woff2'};
 const issue=value=>{const list=diagnostics.serverIssues??=[];list.push({at:new Date().toISOString(),duringCleanup:diagnostics.closing===true,...value});if(list.length>40)list.shift();};
 const root=path.resolve(directory),server=http.createServer((request,response)=>{
  try{
   const requested=decodeURIComponent(new URL(request.url,'http://localhost').pathname),file=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
   if(file!==root&&!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
   const stat=fs.statSync(file);if(!stat.isFile()){response.writeHead(404).end();return;}
   response.writeHead(200,{'content-type':mime[path.extname(file)]??'application/octet-stream','content-length':stat.size,'cache-control':'no-store'});
   const stream=fs.createReadStream(file);
   stream.on('error',error=>{issue({kind:'read-error',url:request.url,error:String(error),code:error.code??null});response.destroy();});
   response.on('close',()=>{if(!response.writableFinished)issue({kind:'incomplete-response',url:request.url,expectedBytes:stat.size,readBytes:stream.bytesRead});});stream.pipe(response);
  }catch(error){issue({kind:'server-error',url:request.url,error:String(error),code:error.code??null});response.writeHead(error.code==='ENOENT'?404:500).end(String(error));}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}
function captureStatus(output,stage,{name,...counts}={}){
 if(output)writeAtomicJson(path.join(output,'capture-status.json'),{stage,...(name===undefined?{}:{name}),timestamp:new Date().toISOString(),...counts});
}
async function browserCapture({directory,output,width,height,readyTimeout,networkTimeout=30000,errors,failedRequests,diagnostics={}}){
 let startup=true;
 const stage=(name,{persist=startup,frameName}={})=>{
  diagnostics.stage=name;const history=diagnostics.stageHistory??=[];history.push({stage:name,at:new Date().toISOString()});if(history.length>64)history.shift();
  if(persist)captureStatus(output,name,{name:frameName,errorCount:errors.length,failedRequestCount:failedRequests.length});
 };
 stage('serve-bundle');const server=await serveBundle(directory,diagnostics);let browser,context,page,requests;
 async function diagnose(error){
  diagnostics.failingStage??=diagnostics.stage;diagnostics.failure=String(error);diagnostics.activeRequests=requests?.snapshot()??[];
  if(!page){diagnostics.pageSnapshot={unavailable:'Browser page not created'};return;}
  try{
   diagnostics.pageSnapshot=await withDeadline(page.evaluate(()=>({url:location.href,documentReadyState:document.readyState,
    ready:window.lastLightBay?.ready??false,error:window.lastLightBay?.error??null,build:window.lastLightBay?.build??null,
    loadingHidden:document.getElementById('loading')?.hidden??null,
    loadingLabel:document.getElementById('load-label')?.textContent?.slice(0,1024)??null,
    loadingProgress:document.getElementById('load-progress')?.value??null,
    visibleError:document.getElementById('error')?.textContent?.slice(0,2048)??null,
    datasetReady:document.documentElement.dataset.ready??null,
    canvasSize:document.getElementById('world')?[document.getElementById('world').width,document.getElementById('world').height]:null,
    recentResources:performance.getEntriesByType('resource').slice(-12).map(value=>({name:value.name,duration:value.duration,responseEnd:value.responseEnd,transferSize:value.transferSize,encodedBodySize:value.encodedBodySize})),
    glbDelivery:globalThis.__bayCaptureGlbDelivery??null,
   })),2500,'Failure page snapshot');
  }catch(snapshotError){diagnostics.pageSnapshot={unavailable:String(snapshotError),url:page.url()};}
 }
 try{
  stage('hash-served-glbs');diagnostics.glbInventory=captureGlbManifest(directory);
  stage('launch-browser');
  const {chromium}=await import('playwright');
  browser=await chromium.launch({executablePath:process.env.BAY_BROWSER_EXECUTABLE,headless:true,timeout:120000,
   args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--force-color-profile=srgb']});
  context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
  page=await context.newPage();page.setDefaultTimeout(0);
  let startupFailure;
  const failedStartup=new Promise(resolve=>{startupFailure=resolve;});
  const runtimeError=error=>{const text=String(error);errors.push(text);startupFailure({error:text});};
  page.on('pageerror',runtimeError);
  page.on('console',message=>{if(message.type()==='error')runtimeError(message.text());});
  requests=trackCaptureRequests(page,{failedRequests,diagnostics,getStage:()=>diagnostics.closing?'browser-cleanup':diagnostics.stage});
  stage('install-glb-transport');await page.addInitScript(installCaptureGlbFetch,diagnostics.glbInventory);
  stage('navigate');
  await page.goto(server.url+'/?capture=1&quality=high',{waitUntil:'load',timeout:120000});
  stage('scene-readiness');
  const readyOrFailure=await Promise.race([
   page.waitForFunction(()=>window.lastLightBay?.ready===true||window.lastLightBay?.error||Boolean(document.getElementById('error')?.textContent?.trim()),undefined,{timeout:readyTimeout}),
   failedStartup,
  ]);
  if(readyOrFailure?.error)throw Error('Scene startup failed: '+readyOrFailure.error);
  const sceneError=await page.evaluate(()=>window.lastLightBay?.error||document.getElementById('error')?.textContent?.trim()||null);
  if(sceneError)throw Error('Scene startup failed: '+sceneError);
  stage('validate-build');
  const build=await page.evaluate(()=>window.lastLightBay?.build);
  if(build?.production!==true||!/^[a-f0-9]{64}$/.test(build.sourceIdentity??''))throw Error('Loaded page is not a verified production build');
  const healthy=async()=>{
   await assertCaptureHealthy(page,errors,failedRequests,build.sourceIdentity);
   diagnostics.glbDelivery=await page.evaluate(()=>globalThis.__bayCaptureGlbDelivery??null);
   if(diagnostics.glbDelivery?.version!==1||diagnostics.glbDelivery.failures.length)throw Error('Capture GLB delivery verification failed: '+JSON.stringify(diagnostics.glbDelivery));
  };
  stage('health-before-network-drain');await healthy();
  // Scene readiness can precede delivery of the browser's requestfinished
  // events. Do not cut off a still-active request by switching offline early.
  stage('network-drain');await requests.waitForIdle({timeoutMs:networkTimeout});await healthy();
  diagnostics.requestsBeforeOffline=requests.snapshot();
  stage('offline-transition');await context.setOffline(true);
  stage('health-after-offline');await healthy();
  stage('graphics-state');
  const graphics=await page.evaluate(()=>{const gl=document.getElementById('world').getContext('webgl2'),extension=gl.getExtension('WEBGL_debug_renderer_info');return{version:gl.getParameter(gl.VERSION),renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),samples:gl.getParameter(gl.SAMPLES)};});
  stage('capture-ready');startup=false;
  return {build,graphics,offlineAfterLoad:true,healthy,diagnose,
   async applySettings(settings){
    stage('apply-settings');
    validateProfile(settings);
    await page.evaluate(({settings,methods})=>{for(const [key,value]of Object.entries(settings)){const method=methods[key];if(typeof window.lastLightBay[method]!=='function')throw Error('Capture setting unavailable: '+method);window.lastLightBay[method](value);}}, {settings,methods:settingMethods});
    await healthy();
   },
   async renderFrame(entry){
    stage('frame-health-before');
    await healthy();
    stage('frame-render-and-png',{persist:true,frameName:String(entry.label??entry.view)});
    const result=await page.evaluate(async({view})=>{
     const number=Number(view),api=window.lastLightBay;
     const renderStarted=performance.now();
     const stats=await (Number.isFinite(number)?api.renderAt(number):api.setCamera(String(view)));
     const renderFinished=performance.now(),exportStarted=performance.now();
     const dataURL=document.getElementById('world').toDataURL('image/png');
     const exportFinished=performance.now();
     return{stats:{...stats,
      capturePageMilliseconds:{action:Number.isFinite(number)?'renderAt':'setCamera',render:renderFinished-renderStarted,pngExport:exportFinished-exportStarted},
      ...(typeof api.getShadowStudy==='function'?{shadowStudy:api.getShadowStudy()}:{}),
      ...(typeof api.getLinearMainOutput==='function'?{linearMainOutput:api.getLinearMainOutput()}:{}),
     },dataURL};
    },entry);
    stage('frame-health-after');await healthy();
    if(!result.dataURL.startsWith('data:image/png;base64,'))throw Error('Canvas did not produce a PNG');
    return{stats:result.stats,bytes:Buffer.from(result.dataURL.slice('data:image/png;base64,'.length),'base64')};
   },
   async close(){diagnostics.closing=true;try{await context.close();}finally{try{await browser.close();}finally{requests?.dispose();await server.close();}}},
  };
 }catch(error){await diagnose(error);diagnostics.closing=true;try{await context?.close();}finally{try{await browser?.close();}finally{requests?.dispose();await server.close();}}throw error;}
}

function createEncoder(options,spawnEncoder){
 const target=path.join(options.output,'last-light-bay-progress.encoding.mp4');
 const args=['-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','png','-framerate',String(options.fps),'-i','pipe:0','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',target];
 const process=spawnEncoder('ffmpeg',args,{stdio:['pipe','ignore','pipe']});
 let result,finished=false,stderr='',pipeError;
 // Attach immediately: an early executable or encoder failure must not leave
 // an unobserved event while a browser is starting or a long frame is drawing.
 const exit=new Promise(resolve=>{
  process.once('error',error=>{result={error:String(error)};resolve(result);});
  process.once('close',(code,signal)=>{finished=true;result??={code,signal};resolve(result);});
 });
 process.stderr.on('data',data=>{stderr=(stderr+data).slice(-65536);});
 process.stdin.on('error',error=>{pipeError=error;});
 const failure=()=>Error('Progress video encoder failed: '+(result?.error??pipeError?.message??stderr??'')+' (code '+result?.code+')');
 return {target,command:{command:'ffmpeg',args},
  async write(bytes){
   if(result||pipeError)throw failure();
   try{await Promise.race([writeEncoderFrame(process.stdin,bytes,options.writeTimeout),exit.then(()=>{throw failure();})]);}
   catch(error){throw Error('Progress video encoder frame write failed: '+String(error),{cause:error});}
  },
  async finish(){
   if(result||pipeError)throw failure();process.stdin.end();
   const outcome=await withDeadline(exit,options.exitTimeout,'Encoder completion');
   if(outcome.error||outcome.code!==0||pipeError)throw failure();
   if(!fs.existsSync(target)||fs.statSync(target).size===0)throw Error('Progress encoder produced no video');
   return target;
  },
  async close(){
   if(!finished){process.stdin.destroy();process.kill('SIGTERM');try{await withDeadline(exit,3000,'Encoder shutdown');}catch{process.kill('SIGKILL');await withDeadline(exit,3000,'Encoder termination');}}
  },
 };
}
export async function runProgressCapture(options,{captureFactory=browserCapture,spawnEncoder=spawn,log=console.log}={}){
 const errors=[],failedRequests=[],diagnostics={};let capture,encoder,checkpoint,release,stillManifest;
 const frameState=(stats,expectedIdentity,entry)=>{
  if(stats?.ready!==true||stats.sourceIdentity!==expectedIdentity||stats.quality!=='high'||!Number.isFinite(stats.time))throw Error('Frame is not ready at production high quality');
  if(Number.isFinite(Number(entry.view))&&Math.abs(stats.time-Number(entry.view))>1e-8)throw Error('Absolute frame time mismatch');
 };
 try{
  if(options.video){
   checkpoint=openVideoCheckpoint({output:options.output,dist:options.dist,contract:options.contract,resume:options.resume});
   release=checkpoint.release;checkpoint.startAttempt();
   encoder=createEncoder(options,spawnEncoder);checkpoint.update({encodingCommand:encoder.command});
   const completed=checkpoint.manifest.frames.length,timeline=options.contract.timeline;
   for(let index=0;index<timeline.length;index++){
    let bytes;
    if(index<completed)bytes=checkpoint.readFrame(index);
    else{
     if(!capture){
      // Await startup completely even if the encoder exits: no orphan browser
      // promise may escape cleanup. Already saved frames remain reusable.
      capture=await captureFactory({directory:checkpoint.bundle,...options,errors,failedRequests,diagnostics});
      checkpoint.bindBuild(capture.build);checkpoint.update({graphics:capture.graphics,offlineAfterLoad:capture.offlineAfterLoad});
      await capture.applySettings(options.contract.profile);
      for(let prior=0;prior<index;prior++)await capture.applySettings(settingsOf(timeline[prior]));
     }
     const started=Date.now();await capture.applySettings(settingsOf(timeline[index]));
     const rendered=await capture.renderFrame(timeline[index]);await capture.healthy();
     bytes=rendered.bytes;
     // Durable PNG+manifest precede the encoder write, including when the
     // encoder failed during this frame. A retry reuses this expensive result.
     checkpoint.appendFrame(index,bytes,rendered.stats,Date.now()-started);
     log(JSON.stringify({frame:index+1,total:timeline.length,time:rendered.stats.time,milliseconds:Date.now()-started,saved:true}));
    }
    await encoder.write(bytes);
   }
   await capture?.healthy();const encoded=await encoder.finish();await capture?.healthy();
   if(errors.length||failedRequests.length)throw Error('Capture accumulated browser errors');
   fs.renameSync(encoded,path.join(options.output,'last-light-bay-progress.mp4'));
   checkpoint.update({diagnostics});checkpoint.finish({errors,failedRequests});
   captureStatus(options.output,'complete',{errorCount:errors.length,failedRequestCount:failedRequests.length});
   return{captureSucceeded:true,intermediate:true,output:options.output,frames:checkpoint.manifest.frames.length,reusedFrames:completed};
  }
  release=acquireCaptureLock(options.output);
  const manifestPath=path.join(options.output,'manifest.json');if(fs.existsSync(manifestPath))throw Error('Still output already has a manifest; choose a new output directory');
  const names=options.timeline.map(entry=>entry.label??(Number.isFinite(Number(entry.view))?'flight-'+Number(entry.view).toFixed(3):String(entry.view)));
  if(new Set(names).size!==names.length)throw Error('Still plan would overwrite a frame');
  stillManifest={kind:'intermediate-progress',startedAt:new Date().toISOString(),width:options.width,height:options.height,frames:[],errors,failedRequests,diagnostics,captureSucceeded:false};writeAtomicJson(manifestPath,stillManifest);
  capture=await captureFactory({directory:options.dist,...options,errors,failedRequests,diagnostics});
  Object.assign(stillManifest,{build:capture.build,graphics:capture.graphics,offlineAfterLoad:capture.offlineAfterLoad});
  await capture.applySettings(options.profile);
  for(const [index,entry]of options.timeline.entries()){
   const started=Date.now();await capture.applySettings(settingsOf(entry));const rendered=await capture.renderFrame(entry);await capture.healthy();
   frameState(rendered.stats,capture.build.sourceIdentity,entry);const info=inspectPng(rendered.bytes,options.width,options.height),name=names[index];
   writeAtomic(path.join(options.output,name+'.png'),rendered.bytes);
   stillManifest.frames.push({index,view:name,settings:entry,time:rendered.stats.time,...info,milliseconds:Date.now()-started,stats:rendered.stats});writeAtomicJson(manifestPath,stillManifest);
   log(JSON.stringify({frame:index+1,total:options.timeline.length,view:name,milliseconds:Date.now()-started}));
  }
  await capture.healthy();if(errors.length||failedRequests.length)throw Error('Capture accumulated browser errors');
  Object.assign(stillManifest,{captureSucceeded:true,finishedAt:new Date().toISOString()});writeAtomicJson(manifestPath,stillManifest);
  captureStatus(options.output,'complete',{errorCount:errors.length,failedRequestCount:failedRequests.length});
  return{captureSucceeded:true,intermediate:true,output:options.output,frames:stillManifest.frames.length};
 }catch(error){
  await capture?.diagnose?.(error);diagnostics.failingStage??=diagnostics.stage??'capture-or-encode';diagnostics.failure??=String(error);
  if(checkpoint||stillManifest)captureStatus(options.output,'failed',{name:diagnostics.failingStage,errorCount:errors.length,failedRequestCount:failedRequests.length});
  if(checkpoint){checkpoint.update({diagnostics});checkpoint.fail(error,{errors,failedRequests});}
  if(stillManifest){Object.assign(stillManifest,{captureSucceeded:false,error:String(error),finishedAt:new Date().toISOString()});writeAtomicJson(path.join(options.output,'manifest.json'),stillManifest);}
  throw error;
 }finally{try{await encoder?.close();}finally{try{await capture?.close();}finally{release?.();}}}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const options=parseOptions(process.argv.slice(2));
 runProgressCapture(options).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});
}
