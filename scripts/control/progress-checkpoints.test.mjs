import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {deflateSync} from 'node:zlib';
import {crc32,inspectPng,sha256} from './capture-integrity.mjs';
import {acquireCaptureLock,makeVideoContract,openVideoCheckpoint,validateProfile} from './progress-checkpoints.mjs';
import {parseOptions,runProgressCapture} from '../progress-capture.mjs';
import {trackCaptureRequests} from './progress-network.mjs';

const identity='a'.repeat(64),build={production:true,sourceIdentity:identity};
function png(value,width=8,height=4){
 function chunk(type,data){const header=Buffer.alloc(8),crc=Buffer.alloc(4);header.writeUInt32BE(data.length);header.write(type,4);crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type),data])));return Buffer.concat([header,data,crc]);}
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const pixels=Buffer.alloc((width*4+1)*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const offset=y*(width*4+1)+1+x*4;pixels[offset]=value;pixels[offset+1]=255-value;pixels[offset+2]=value/2;pixels[offset+3]=255;}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
const stats=time=>({ready:true,sourceIdentity:identity,quality:'high',time});

test('network drain waits for actual request completion and records the real failure stage',async()=>{
 const page=new EventEmitter(),failedRequests=[],diagnostics={};let stage='scene-readiness',settled=false;
 const tracker=trackCaptureRequests(page,{failedRequests,diagnostics,getStage:()=>stage});
 const request={url:()=> 'http://127.0.0.1/assets/models/palm-tree.glb',method:()=> 'GET',resourceType:()=> 'fetch',failure:()=>({errorText:'net::ERR_ABORTED'})};
 try{
  page.emit('request',request);
  page.emit('response',{request:()=>request,status:()=>200,headers:()=>({'content-length':'490580'})});
  const drained=tracker.waitForIdle({timeoutMs:1000,quietMs:0}).then(()=>{settled=true;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);assert.equal(tracker.snapshot()[0].contentLength,'490580');
  page.emit('requestfinished',request);await drained;assert.deepEqual(tracker.snapshot(),[]);
  // Even an empty tracker must cancel its pending quiet completion when a new
  // request begins, so readiness alone cannot trigger the offline transition.
  settled=false;const anotherDrain=tracker.waitForIdle({timeoutMs:1000,quietMs:0}).then(()=>{settled=true;});
  page.emit('request',request);await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);
  stage='network-drain';page.emit('requestfailed',request);await anotherDrain;
  assert.equal(failedRequests.length,1);assert.equal(failedRequests[0].errorText,'net::ERR_ABORTED');assert.equal(failedRequests[0].failureStage,'network-drain');assert.equal(failedRequests[0].resourceType,'fetch');
  assert.equal(diagnostics.networkEvents.at(-1).kind,'requestfailed');
 }finally{tracker.dispose();}
});

test('network drain timeout reports unfinished URLs and HTTP failures retain status',async()=>{
 const page=new EventEmitter(),failedRequests=[],diagnostics={},tracker=trackCaptureRequests(page,{failedRequests,diagnostics,getStage:()=> 'network-drain'});
 const request={url:()=> 'http://127.0.0.1/assets/stalled.glb',method:()=> 'GET',resourceType:()=> 'fetch',failure:()=>null};
 try{
  page.emit('request',request);await assert.rejects(tracker.waitForIdle({timeoutMs:20,quietMs:0}),/network drain timed out.*stalled\.glb/);
  page.emit('response',{request:()=>request,status:()=>503,headers:()=>({})});page.emit('requestfinished',request);
  assert.equal(failedRequests[0].status,503);assert.equal(failedRequests[0].failureStage,'network-drain');
 }finally{tracker.dispose();}
});

function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bay-progress-recovery-')),dist=path.join(root,'dist'),output=path.join(root,'out');
 fs.mkdirSync(dist);fs.writeFileSync(path.join(dist,'index.html'),'original pinned production bundle');
 const contract=makeVideoContract({width:8,height:4,fps:4,duration:.5,start:0});
 return{root,dist,output,contract,options:{...contract,contract,root,dist,output,video:true,resume:false,writeTimeout:3000,exitTimeout:3000,readyTimeout:3000},cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
function populate(f,count=1){
 const checkpoint=openVideoCheckpoint(f);checkpoint.startAttempt();checkpoint.bindBuild(build);
 for(let index=0;index<count;index++)checkpoint.appendFrame(index,png(40+index*60),stats(Number(f.contract.timeline[index].view)),1);
 checkpoint.release();return JSON.parse(fs.readFileSync(path.join(f.output,'manifest.json')));
}

test('restored CLI preserves dimensions, profile controls and original video timeline',()=>{
 const f=fixture();try{
  fs.writeFileSync(path.join(f.root,'profile.json'),JSON.stringify({profiling:true,linearMainOutput:true,farCrownBlending:false,coastalUnderstory:true,surfaceStudy:{foamDepthGate:1}}));
  const parsed=parseOptions(['video','width=512','fps=24','duration=0.5','start=9.75','profile=profile.json','out=video'],f.root);
  assert.equal(parsed.height,288);assert.equal(parsed.contract.timeline.length,12);assert.equal(parsed.contract.timeline[11].view,'10.20833333');
  assert.equal(parsed.profile.profiling,true);assert.equal(parsed.profile.coastalUnderstory,true);assert.throws(()=>validateProfile({profiling:'true'}),/Invalid/);
  assert.throws(()=>parseOptions(['video','width=511'],f.root),/even/);
  assert.throws(()=>makeVideoContract({...f.contract,timeline:[{view:0},{view:0}]}),/repeated/);
 }finally{f.cleanup();}
});

test('response study preloads for a later enabled frame, and ordinary captures request no atlas',async()=>{
 for(const islandDirectResponse of [false,true]){
  const f=fixture();try{
   const options=parseOptions(['width=8','height=4','views=0,1','out=still'],f.root);
   options.timeline[1].islandDirectResponse=islandDirectResponse;
   let observed;
   await runProgressCapture(options,{captureFactory:async({islandResponseNeeded})=>{
    observed=islandResponseNeeded;
    return{build,graphics:{fixture:true},offlineAfterLoad:true,healthy:async()=>{},applySettings:async()=>{},
     renderFrame:async entry=>({bytes:png(50+Number(entry.view)),stats:stats(Number(entry.view))}),close:async()=>{}};
   },log:()=>{}});
   assert.equal(observed,islandDirectResponse);
   assert.deepEqual(validateProfile({islandDirectResponse}),{islandDirectResponse});
   assert.throws(()=>validateProfile({islandDirectResponse:'true'}),/Invalid/);
  }finally{f.cleanup();}
 }
});

for(const scenario of ['missing','corrupt','dimensions','different-content','record-identity','record-time','record-order','settings','fps','timeline','bundle']){
 test('resume rejects '+scenario+' before changing committed manifest',()=>{
  const f=fixture();try{
   populate(f);const manifestFile=path.join(f.output,'manifest.json'),frame=path.join(f.output,'frames/000000.png');let contract=f.contract;
   if(scenario==='missing')fs.unlinkSync(frame);
   if(scenario==='corrupt'){const bytes=fs.readFileSync(frame);bytes[bytes.length-20]^=1;fs.writeFileSync(frame,bytes);}
   if(scenario==='dimensions')fs.writeFileSync(frame,png(40,10,4));
   if(scenario==='different-content')fs.writeFileSync(frame,png(200));
   if(scenario.startsWith('record-')){const value=JSON.parse(fs.readFileSync(manifestFile));if(scenario==='record-identity')value.frames[0].sourceIdentity='b'.repeat(64);if(scenario==='record-time')delete value.frames[0].stats.time;if(scenario==='record-order')value.frames[0].index=1;fs.writeFileSync(manifestFile,JSON.stringify(value));}
   if(scenario==='settings')contract={...contract,profile:{farCrownCoverage:true}};
   if(scenario==='fps')contract={...contract,fps:3};
   if(scenario==='timeline')contract={...contract,timeline:[{view:.1},{view:.25}]};
   if(scenario==='bundle')fs.writeFileSync(path.join(f.output,'render-bundle/index.html'),'a different build');
   const before=fs.readFileSync(manifestFile);
   assert.throws(()=>openVideoCheckpoint({...f,contract,resume:true}));
   assert.deepEqual(fs.readFileSync(manifestFile),before);
   assert.equal(fs.existsSync(path.join(f.output,'.capture-lock.json')),false);
   assert.ok(JSON.parse(fs.readFileSync(path.join(f.output,'last-resume-rejection.json'))).error);
  }finally{f.cleanup();}
 });
}

test('capture lock blocks active writers and never accepts a symlink bundle',()=>{
 const f=fixture();try{
  const release=acquireCaptureLock(f.output);
  assert.throws(()=>acquireCaptureLock(f.output),/active writer/);release();
  fs.symlinkSync(path.join(f.dist,'index.html'),path.join(f.dist,'linked.html'));
  assert.throws(()=>openVideoCheckpoint(f),/symlink/);
  assert.equal(fs.existsSync(path.join(f.output,'manifest.json')),false);
 }finally{f.cleanup();}
});

test('real encoder resumes a prefix from its pinned build, replays settings and can replay all PNGs without a browser',async()=>{
 const f=fixture();let closes=0;try{
  f.contract=makeVideoContract({...f.contract,profile:{farCrownCoverage:false},timeline:[{view:0,lighting:{sunIntensity:3}},{view:.25,profiling:true}]});
  populate(f);const first=fs.readFileSync(path.join(f.output,'frames/000000.png')),firstStat=fs.statSync(path.join(f.output,'frames/000000.png'));
  fs.writeFileSync(path.join(f.dist,'index.html'),'changed working build must not be served on resume');
  fs.writeFileSync(path.join(f.output,'frames/000001.png'),'uncommitted orphan is not reused');
  const applied=[],rendered=[];
  const captureFactory=async({directory})=>{
   assert.equal(fs.readFileSync(path.join(directory,'index.html'),'utf8'),'original pinned production bundle');
   return{build,graphics:{fixture:true},offlineAfterLoad:true,healthy:async()=>{},applySettings:async settings=>applied.push(settings),
    renderFrame:async entry=>{rendered.push(entry.view);return{bytes:png(100),stats:stats(Number(entry.view))};},close:async()=>{closes++;}};
  };
  const result=await runProgressCapture({...f.options,contract:f.contract,resume:true},{captureFactory,log:()=>{}});
  assert.equal(result.reusedFrames,1);assert.deepEqual(rendered,[.25]);
  assert.deepEqual(applied,[{farCrownCoverage:false},{lighting:{sunIntensity:3}},{profiling:true}]);assert.equal(closes,1);
  assert.deepEqual(fs.readFileSync(path.join(f.output,'frames/000000.png')),first);assert.equal(fs.statSync(path.join(f.output,'frames/000000.png')).mtimeMs,firstStat.mtimeMs);
  const video=path.join(f.output,'last-light-bay-progress.mp4');
  const probe=spawnSync('ffprobe',['-v','error','-count_frames','-show_streams','-of','json',video],{encoding:'utf8'});assert.equal(probe.status,0,probe.stderr);
  const stream=JSON.parse(probe.stdout).streams[0];assert.equal(stream.width,8);assert.equal(stream.height,4);assert.equal(Number(stream.nb_read_frames),2);assert.equal(stream.avg_frame_rate,'4/1');
  const replay=await runProgressCapture({...f.options,contract:f.contract,resume:true},{captureFactory:async()=>{throw Error('A complete checkpoint must not launch a browser');},log:()=>{}});
  assert.equal(replay.reusedFrames,2);assert.equal(JSON.parse(fs.readFileSync(path.join(f.output,'manifest.json'))).captureSucceeded,true);
 }finally{f.cleanup();}
});

test('loaded source mismatch cannot append frames to an existing checkpoint',async()=>{
 const f=fixture();let closed=false;try{
  populate(f);await assert.rejects(runProgressCapture({...f.options,resume:true},{captureFactory:async()=>({build:{production:true,sourceIdentity:'b'.repeat(64)},close:async()=>{closed=true;}}),log:()=>{}}),/build changed/);
  const manifest=JSON.parse(fs.readFileSync(path.join(f.output,'manifest.json')));
  assert.equal(manifest.frames.length,1);assert.equal(manifest.build.sourceIdentity,identity);assert.equal(manifest.captureSucceeded,false);assert.equal(closed,true);
 }finally{f.cleanup();}
});

test('encoder early exit preserves the frame completed during its failure and the prior movie',async()=>{
 const f=fixture();let closed=false,childClosed;try{
  fs.mkdirSync(f.output);const prior=Buffer.from('previous successful movie');fs.writeFileSync(path.join(f.output,'last-light-bay-progress.mp4'),prior);
  const captureFactory=async()=>({build,graphics:{fixture:true},offlineAfterLoad:true,healthy:async()=>{},applySettings:async()=>{},
   renderFrame:async entry=>{await childClosed;return{bytes:png(40),stats:stats(Number(entry.view))};},close:async()=>{closed=true;}});
  const spawnEncoder=()=>{const child=spawn(process.execPath,['-e','process.exit(7)'],{stdio:['pipe','ignore','pipe']});childClosed=new Promise((resolve,reject)=>{child.once('close',resolve);child.once('error',reject);});return child;};
  await assert.rejects(runProgressCapture(f.options,{captureFactory,spawnEncoder,log:()=>{}}),/encoder.*failed/);
  const manifest=JSON.parse(fs.readFileSync(path.join(f.output,'manifest.json')));assert.equal(manifest.frames.length,1);assert.equal(manifest.captureSucceeded,false);assert.equal(manifest.failures.length,1);
  assert.equal(inspectPng(fs.readFileSync(path.join(f.output,'frames/000000.png')),8,4).sha256,manifest.frames[0].sha256);
  assert.deepEqual(fs.readFileSync(path.join(f.output,'last-light-bay-progress.mp4')),prior);assert.equal(closed,true);assert.equal(fs.existsSync(path.join(f.output,'.capture-lock.json')),false);
 }finally{f.cleanup();}
});

test('encoder exit deadline retains a complete reusable PNG prefix and prior movie',async()=>{
 const f=fixture();try{
  populate(f,2);const previous=Buffer.from('prior');fs.writeFileSync(path.join(f.output,'last-light-bay-progress.mp4'),previous);
  const spawnEncoder=()=>spawn(process.execPath,['-e','process.stdin.resume();setInterval(()=>{},1000)'],{stdio:['pipe','ignore','pipe']});
  await assert.rejects(runProgressCapture({...f.options,resume:true,exitTimeout:50},{spawnEncoder,captureFactory:async()=>{throw Error('Unexpected browser');},log:()=>{}}),/completion timed out/);
  const manifest=JSON.parse(fs.readFileSync(path.join(f.output,'manifest.json')));assert.equal(manifest.frames.length,2);assert.equal(manifest.captureSucceeded,false);
  assert.deepEqual(fs.readFileSync(path.join(f.output,'last-light-bay-progress.mp4')),previous);
 }finally{f.cleanup();}
});

test('still plans retain named cameras, labels and cumulative settings without a video checkpoint',async()=>{
 const f=fixture();let closed=false;try{
  const plan=[{view:'mountain-wide',label:'first',lighting:{sunIntensity:3}},{view:6,label:'second',profiling:true}];
  fs.writeFileSync(path.join(f.root,'plan.json'),JSON.stringify(plan));const options=parseOptions(['width=8','height=4','out=stills','plan=plan.json'],f.root);
  const applied=[],views=[];
  const result=await runProgressCapture(options,{captureFactory:async()=>({build,graphics:{fixture:true},offlineAfterLoad:true,healthy:async()=>{},
   applySettings:async value=>applied.push(value),renderFrame:async entry=>{views.push(entry.view);return{bytes:png(50+views.length),stats:stats(entry.view==='mountain-wide'?2:Number(entry.view))};},close:async()=>{closed=true;}}),log:()=>{}});
  assert.equal(result.frames,2);assert.deepEqual(views,['mountain-wide',6]);assert.deepEqual(applied,[{},{lighting:{sunIntensity:3}},{profiling:true}]);
  const manifest=JSON.parse(fs.readFileSync(path.join(options.output,'manifest.json')));assert.equal(manifest.captureSucceeded,true);assert.deepEqual(manifest.frames.map(frame=>frame.view),['first','second']);
  assert.equal(sha256(fs.readFileSync(path.join(options.output,'first.png'))),manifest.frames[0].sha256);assert.equal(closed,true);assert.equal(fs.existsSync(path.join(options.output,'render-bundle')),false);
 }finally{f.cleanup();}
});
