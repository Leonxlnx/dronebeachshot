/** Deterministic capture harness for a WebGL2-capable verification environment.
 * Authored here; NOT executed in this session because the permitted browser has graphics disabled.
 * node scripts/capture.mjs <production URL> baseline|gallery|video
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright';
const [base,mode='baseline']=process.argv.slice(2);
if(!base||!['baseline','gallery','video'].includes(mode))throw Error('Provide a production URL and baseline, gallery or video mode.');
const url=new URL(base);url.searchParams.set('capture','1');url.searchParams.set('quality','high');
if(mode!=='baseline'){
 const state=JSON.parse(fs.readFileSync('RUN_STATE.json','utf8'));
 if(state.cycles.filter(c=>c.verified&&c.before&&c.after&&c.fixes&&c.review).length<8)throw Error('Final capture is blocked until eight actual refinement cycles pass.');
 for(const file of ['gates/branch-land.md','gates/branch-shore.md','gates/branch-atmosphere.md','gates/drone-camera.md','gates/hostile-review.md'])if(/- \[ \]|EVIDENCE:\s*pending/.test(fs.readFileSync(file,'utf8')))throw Error('Final capture blocked by '+file);
}
const width=mode==='video'?2560:3840,height=mode==='video'?1440:2160;
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
const page=await context.newPage(),errors=[],requests=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
page.on('requestfailed',r=>requests.push(r.url()));
const out=mode==='video'?'artifacts/final-video':mode==='gallery'?'artifacts/gallery':'artifacts/baseline';fs.mkdirSync(out,{recursive:true});
try{
 await page.goto(url.href,{waitUntil:'load'});
 await page.waitForFunction(()=>window.lastLightBay?.ready===true,{},{timeout:120000});
 if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));
 await context.setOffline(true); // All assets must already be vendored and ready.
 const names=await page.evaluate(()=>window.lastLightBay.cameraNames);
 const diagnostics=await page.evaluate(()=>window.lastLightBay.cameraDiagnostics());
 fs.writeFileSync(path.join(out,'camera-diagnostics.json'),JSON.stringify(diagnostics,null,2));
 if(mode!=='video'){
  const manifest=[];
  for(const name of names){
   await page.evaluate(name=>window.lastLightBay.setCamera(name),name);
   const bytes=await page.locator('#world').screenshot({type:'png'}),file=path.join(out,name+'.png');
   fs.writeFileSync(file,bytes);manifest.push({name,path:file,width,height,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),visuallyReviewed:false});
   if(errors.length)throw Error(errors.join('\n'));
  }
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
 }else{
  const target=path.join(out,'last-light-bay-1440p60.mp4');
  const args=['-y','-f','image2pipe','-vcodec','png','-framerate','60','-i','pipe:0','-an','-c:v','libx264','-profile:v','high','-pix_fmt','yuv420p','-preset','slow','-crf','18','-movflags','+faststart',target];
  fs.writeFileSync(path.join(out,'encoding-command.json'),JSON.stringify({command:'ffmpeg',args},null,2));
  const encoder=spawn('ffmpeg',args,{stdio:['pipe','ignore','pipe']});let encodingLog='';encoder.stderr.on('data',d=>encodingLog+=d);const exit=once(encoder,'close');const timeline=[];
  for(let i=0;i<1200;i++){
   const t=i/60;const stats=await page.evaluate(t=>window.lastLightBay.renderAt(t),t);
   const bytes=await page.locator('#world').screenshot({type:'png'});
   if(!encoder.stdin.write(bytes))await once(encoder.stdin,'drain');
   timeline.push({frame:i,t,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),stats:i%120===0?stats:undefined});
   if(errors.length)throw Error(errors.join('\n'));
  }
  encoder.stdin.end();const [code]=await exit;if(code!==0)throw Error(encodingLog);
  fs.writeFileSync(path.join(out,'timeline-manifest.json'),JSON.stringify(timeline,null,2));
  const transcode=spawnSync('ffmpeg',['-y','-i',target,'-vf','scale=1920:1080:flags=lanczos','-an','-c:v','libx264','-profile:v','high','-pix_fmt','yuv420p','-crf','19','-movflags','+faststart',path.join(out,'last-light-bay-1080p60.mp4')],{encoding:'utf8'});if(transcode.status!==0)throw Error(transcode.stderr);
  const probe=spawnSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',target],{encoding:'utf8'});if(probe.status!==0)throw Error(probe.stderr);const data=JSON.parse(probe.stdout),v=data.streams.find(s=>s.codec_type==='video');if(v.width!==2560||v.height!==1440||v.avg_frame_rate!=='60/1'||v.codec_name!=='h264'||v.pix_fmt!=='yuv420p'||Number(v.nb_read_frames)!==1200)throw Error('Master format validation failed');fs.writeFileSync(path.join(out,'ffprobe.json'),probe.stdout);
  fs.writeFileSync(path.join(out,'full-review.md'),'# Full video review\nPending. Encoding success does not verify realism, camera clearance, temporal stability or cinematic quality.\n');
 }
 fs.writeFileSync(path.join(out,'capture-status.json'),JSON.stringify({captureSucceeded:true,mode,offlineAfterLoad:true,errors,failedRequests:requests,visuallyApproved:false},null,2));
}finally{await context.close();await browser.close()}
