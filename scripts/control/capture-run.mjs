import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {assertCaptureHealthy,inspectPng,sha256,sourceIdentity} from './capture-integrity.mjs';

const writeJson=(file,data)=>fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
function runTool(command,args,timeout=300000){
 const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:4*1024*1024,timeout,killSignal:'SIGKILL'});
 if(result.error||result.status!==0)throw Error(`${command} failed: ${result.error||result.stderr}`);
 return result.stdout;
}
export function withDeadline(promise,milliseconds,label){
 if(!Number.isFinite(milliseconds)||milliseconds<=0)throw Error('Invalid encoder deadline');
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error(label+' timed out')),milliseconds);
  promise.then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)});
 });
}
export function writeEncoderFrame(stream,bytes,timeout){
 return withDeadline(new Promise((resolve,reject)=>stream.write(bytes,error=>error?reject(error):resolve())),timeout,'Encoder frame write');
}
export function probeVideo(file,width,height){
 const data=JSON.parse(runTool('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',file]));
 const streams=data.streams??[],videos=streams.filter(s=>s.codec_type==='video'),v=videos[0];
 if(videos.length!==1||streams.some(s=>s.codec_type==='audio')||v.width!==width||v.height!==height||v.avg_frame_rate!=='60/1'||v.codec_name!=='h264'||v.profile!=='High'||v.pix_fmt!=='yuv420p'||Number(v.nb_read_frames)!==1200||Math.abs(Number(data.format?.duration)-20)>.025)throw Error('Video format validation failed: '+path.basename(file));
 if(!Number.isFinite(Number(data.format.duration))||!fs.statSync(file).size)throw Error('Empty video or invalid duration');
 runTool('ffmpeg',['-v','error','-xerror','-i',file,'-map','0:v:0','-f','null','-']);
 return data;
}

/** Browser orchestration is injectable so failure paths are tested without a browser. */
export async function runCapture({base,mode,launch,root=process.cwd(),identity=sourceIdentity(root),dimensions,deadlines={}}){
 const writeDeadline=deadlines.write??30000,exitDeadline=deadlines.exit??120000;
 const width=dimensions?.width??(mode==='video'?2560:3840),height=dimensions?.height??(mode==='video'?1440:2160);
 const runId=mode+'-'+new Date().toISOString().replaceAll(':','-')+'-'+crypto.randomUUID().slice(0,8);
 const artifacts=path.join(root,'artifacts'),runs=path.join(artifacts,'capture-runs');fs.mkdirSync(runs,{recursive:true});
 const out=path.join(artifacts,mode==='video'?'final-video':mode),stage=path.join(runs,runId);
 fs.mkdirSync(stage);const latest=path.join(artifacts,'capture-latest-'+mode+'.json');
 const status={runId,sourceIdentity:identity,mode,width,height,captureSucceeded:false,visuallyApproved:false,startedAt:new Date().toISOString()};
 writeJson(latest,{...status,state:'in-progress',directory:path.relative(root,stage)});
 writeJson(path.join(stage,'capture-status.json'),status);
 const errors=[],requests=[];let browser,context,encoder,encoderExit,encoderFinished=false,encodingLog='';
 function recordError(error){errors.push(String(error))}
 const url=new URL(base);url.searchParams.set('capture','1');url.searchParams.set('quality','high');
 try{
  browser=await launch();context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await context.newPage();
  page.on('pageerror',recordError);
  page.on('console',m=>{if(m.type()==='error')recordError(m.text())});
  page.on('requestfailed',r=>requests.push(r.url()));
  page.on('response',r=>{if(r.status()>=400)requests.push(r.status()+' '+r.url())});
  await page.goto(url.href,{waitUntil:'load'});
  await page.waitForFunction(()=>window.lastLightBay?.ready===true,{},{timeout:120000});
  await assertCaptureHealthy(page,errors,requests,identity);
  await context.setOffline(true);
  const names=await page.evaluate(()=>window.lastLightBay.cameraNames);
  if(!Array.isArray(names)||names.length!==16||new Set(names).size!==16||names.some(n=>typeof n!=='string'||!/^[a-z0-9-]+$/.test(n)))throw Error('Invalid evaluation camera set');
  status.cameraNames=names;
  const diagnostics=await page.evaluate(()=>window.lastLightBay.cameraDiagnostics());
  writeJson(path.join(stage,'camera-diagnostics.json'),diagnostics);
  async function frame(action,value){
   await assertCaptureHealthy(page,errors,requests,identity);
   const stats=await page.evaluate(({action,value})=>window.lastLightBay[action](value),{action,value});
   if(stats?.ready!==true||stats.sourceIdentity!==identity||stats.quality!=='high'||!Number.isFinite(stats.time))throw Error('Frame state is not ready at final quality');
   if(action==='renderAt'&&Math.abs(stats.time-value)>1e-8)throw Error('Frame time mismatch');
   await assertCaptureHealthy(page,errors,requests,identity);
   const bytes=await page.locator('#world').screenshot({type:'png'});
   const info=inspectPng(bytes,width,height);
   await assertCaptureHealthy(page,errors,requests,identity);
   return {bytes,info,stats};
  }
  if(mode!=='video'){
   const manifest=[],seen=new Set();
   for(const name of names){
    const {bytes,info,stats}=await frame('setCamera',name);
    if(seen.has(info.sha256))throw Error('Duplicate evaluation frame: '+name);
    seen.add(info.sha256);const filename=name+'.png';fs.writeFileSync(path.join(stage,filename),bytes);
    manifest.push({name,path:filename,...info,time:stats.time,runId,sourceIdentity:identity,visuallyReviewed:false});
   }
   writeJson(path.join(stage,'manifest.json'),manifest);
  }else{
   const target=path.join(stage,'last-light-bay-1440p60.mp4');
   const args=['-y','-f','image2pipe','-vcodec','png','-framerate','60','-i','pipe:0','-an','-c:v','libx264','-profile:v','high','-pix_fmt','yuv420p','-preset','slow','-crf','18','-movflags','+faststart',target];
   writeJson(path.join(stage,'encoding-command.json'),{command:'ffmpeg',args});
   encoder=spawn('ffmpeg',args,{stdio:['pipe','ignore','pipe']});
   encoderExit=new Promise(resolve=>{encoder.once('error',error=>resolve({error}));encoder.once('close',code=>{encoderFinished=true;resolve({code})})});
   encoder.stderr.on('data',d=>encodingLog=(encodingLog+d).slice(-65536));
   encoder.stdin.on('error',recordError);
   const timeline=[],hashes=new Set();
   for(let i=0;i<1200;i++){
    const t=i/60,{bytes,info,stats}=await frame('renderAt',t);
    if(hashes.has(info.sha256))throw Error('Duplicate cinematic input at frame '+i);
    hashes.add(info.sha256);
    await writeEncoderFrame(encoder.stdin,bytes,writeDeadline);
    timeline.push({frame:i,t,sha256:info.sha256,runId,sourceIdentity:identity,stats:i%120===0?stats:undefined});
   }
   encoder.stdin.end();const result=await withDeadline(encoderExit,exitDeadline,'Encoder completion');
   if(result.error||result.code!==0)throw Error('Video encoder failed: '+(result.error||encodingLog));
   writeJson(path.join(stage,'timeline-manifest.json'),timeline);
   const web=path.join(stage,'last-light-bay-1080p60.mp4');
   const webArgs=['-y','-i',target,'-vf','scale=1920:1080:flags=lanczos','-an','-c:v','libx264','-profile:v','high','-pix_fmt','yuv420p','-crf','19','-movflags','+faststart',web];
   runTool('ffmpeg',webArgs);writeJson(path.join(stage,'web-encoding-command.json'),{command:'ffmpeg',args:webArgs});
   const masterProbe=probeVideo(target,2560,1440),webProbe=probeVideo(web,1920,1080);
   const media=[target,web].map(file=>({path:path.basename(file),sha256:sha256(fs.readFileSync(file)),sizeBytes:fs.statSync(file).size}));
   writeJson(path.join(stage,'ffprobe.json'),{runId,sourceIdentity:identity,master:masterProbe,web:webProbe,media});
   writeJson(path.join(stage,'checksums.json'),media);
   fs.writeFileSync(path.join(stage,'full-review.md'),'# Full video review\nPending. The complete film must be watched and approved against its exact checksum.\n');
  }
  await assertCaptureHealthy(page,errors,requests,identity);
  Object.assign(status,{captureSucceeded:true,offlineAfterLoad:true,errors,failedRequests:requests,finishedAt:new Date().toISOString()});
  writeJson(path.join(stage,'capture-status.json'),status);
  const previous=path.join(runs,'previous-'+runId);let moved=false;
  if(fs.existsSync(out)){fs.renameSync(out,previous);moved=true}
  try{fs.renameSync(stage,out)}catch(error){if(moved)fs.renameSync(previous,out);throw error}
  writeJson(latest,{...status,state:'captured',directory:path.relative(root,out)});
  return {directory:out,runId,captureSucceeded:true};
 }catch(error){
  Object.assign(status,{captureSucceeded:false,errors,failedRequests:requests,error:String(error),finishedAt:new Date().toISOString()});
  if(fs.existsSync(stage))writeJson(path.join(stage,'capture-status.json'),status);
  writeJson(latest,{...status,state:'failed',directory:path.relative(root,stage)});
  throw error;
 }finally{
  if(encoder&&!encoderFinished){
   encoder.stdin.destroy();encoder.kill('SIGTERM');
   try{await withDeadline(encoderExit,3000,'Encoder shutdown')}catch{
    encoder.kill('SIGKILL');await withDeadline(encoderExit,3000,'Encoder termination');
   }
  }
  try{await context?.close()}finally{await browser?.close()}
 }
}
