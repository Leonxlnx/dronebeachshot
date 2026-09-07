import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectPng,sha256,sourceIdentity} from './capture-integrity.mjs';
import {probeVideo} from './capture-run.mjs';

const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function requireValue(condition,message){if(!condition)throw Error(message)}
function captureStatus(root,mode,identity){
 const dir=path.join(root,'artifacts',mode==='video'?'final-video':mode);
 const status=readJson(path.join(dir,'capture-status.json'));
 const latest=readJson(path.join(root,'artifacts','capture-latest-'+mode+'.json'));
 for(const value of [status,latest]){
  requireValue(value.captureSucceeded===true&&value.sourceIdentity===identity,'Capture has not succeeded for current source');
  requireValue(value.offlineAfterLoad===true&&Array.isArray(value.errors)&&!value.errors.length&&Array.isArray(value.failedRequests)&&!value.failedRequests.length,'Capture contains errors or failed offline requests');
 }
 requireValue(status.runId&&status.runId===latest.runId&&latest.state==='captured','Capture runs do not match');
 return {status,dir};
}

export function validateGallery(root,identity,width=3840,height=2160){
 const {status,dir}=captureStatus(root,'gallery',identity),manifest=readJson(path.join(dir,'manifest.json'));
 requireValue(Array.isArray(manifest)&&manifest.length===16,'Gallery needs sixteen frames');
 const names=new Set(),paths=new Set(),hashes=new Set();
 for(const entry of manifest){
  requireValue(typeof entry.name==='string'&&/^[a-z0-9-]+$/.test(entry.name),'Invalid camera name');
  requireValue(entry.path===entry.name+'.png','Gallery path must identify its camera PNG');
  requireValue(entry.runId===status.runId&&entry.sourceIdentity===identity,'Stale gallery frame identity');
  requireValue(entry.visuallyReviewed===true,'Gallery frame is not visually reviewed');
  requireValue(entry.width===width&&entry.height===height,'Declared gallery dimensions are wrong');
  const actual=inspectPng(fs.readFileSync(path.join(dir,entry.path)),width,height);
  requireValue(actual.sha256===entry.sha256&&actual.sizeBytes===entry.sizeBytes,'Gallery bytes do not match manifest');
  requireValue(!names.has(entry.name)&&!paths.has(entry.path)&&!hashes.has(actual.sha256),'Gallery contains duplicate cameras or image bytes');
  names.add(entry.name);paths.add(entry.path);hashes.add(actual.sha256);
 }
 requireValue(Array.isArray(status.cameraNames)&&status.cameraNames.length===16&&new Set(status.cameraNames).size===16&&status.cameraNames.every(name=>names.has(name)),'Gallery omits a capture camera');
 return manifest;
}

export function validateTimeline(rows,runId,identity){
 requireValue(Array.isArray(rows)&&rows.length===1200,'Timeline must contain 1200 frames');
 const hashes=new Set();
 for(let i=0;i<rows.length;i++){
  const row=rows[i];requireValue(row.frame===i&&Number.isFinite(row.t)&&Math.abs(row.t-i/60)<1e-8,'Timeline index or time mismatch');
  requireValue(row.runId===runId&&row.sourceIdentity===identity,'Stale timeline identity');
  requireValue(typeof row.sha256==='string'&&/^[a-f0-9]{64}$/.test(row.sha256)&&!hashes.has(row.sha256),'Invalid or duplicated input frame hash');
  hashes.add(row.sha256);
 }
}

export function validateFinalMedia(root=process.cwd()){
 const failures=[];let identity;
 const check=(label,fn)=>{try{fn()}catch(error){failures.push(label+': '+error.message)}};
 check('Source identity',()=>{identity=sourceIdentity(root)});
 check('Gallery bytes',()=>validateGallery(root,identity));
 check('Master and web film',()=>{
  const {status,dir}=captureStatus(root,'video',identity);
  validateTimeline(readJson(path.join(dir,'timeline-manifest.json')),status.runId,identity);
  const checksums=readJson(path.join(dir,'checksums.json')),probe=readJson(path.join(dir,'ffprobe.json'));
  const review=readJson(path.join(dir,'full-review.json'));
  const analysis=readJson(path.join(dir,'frame-analysis.json'));
  requireValue(probe.sourceIdentity===identity&&probe.runId===status.runId,'Stored film probe identity is stale');
  requireValue(review.approved===true&&review.reviewedFrames===1200&&review.reviewedSeconds>=20&&typeof review.reviewer==='string'&&review.reviewer.trim()&&review.sourceIdentity===identity&&review.runId===status.runId&&Array.isArray(review.findings)&&review.findings.length===0,'Full film review is incomplete');
  for(const [name,w,h] of [['last-light-bay-1440p60.mp4',2560,1440],['last-light-bay-1080p60.mp4',1920,1080]]){
   const file=path.join(dir,name),size=fs.statSync(file).size;requireValue(size>1024,'Video is empty or truncated');
   const digest=sha256(fs.readFileSync(file)),entry=checksums.find(e=>e.path===name),recorded=probe.media?.find(e=>e.path===name);
   requireValue(entry?.sha256===digest&&entry.sizeBytes===size&&recorded?.sha256===digest&&recorded.sizeBytes===size,'Film checksum or size mismatch');
   requireValue(review.media?.[name]===digest,'Full review does not identify this film');
   requireValue(analysis.media?.[name]===digest,'Frame analysis does not identify this film');
   probeVideo(file,w,h);
  }
  inspectPng(fs.readFileSync(path.join(dir,'poster.png')),3840,2160);
  requireValue(analysis.runId===status.runId&&analysis.sourceIdentity===identity&&analysis.decodedFrames===1200,'Missing current decoded-frame analysis');
  for(const key of ['blackFrames','duplicateFrames','decodeErrors'])requireValue(Array.isArray(analysis[key])&&analysis[key].length===0,'Film analysis has '+key);
  for(const name of ['encoding-command.json','web-encoding-command.json']){
   const command=readJson(path.join(dir,name));requireValue(command.command==='ffmpeg'&&Array.isArray(command.args)&&command.args.length>0,'Encoding command missing');
  }
  const fullReview=fs.readFileSync(path.join(dir,'full-review.md'),'utf8');
  requireValue(fullReview.trim().length>80&&!/\bpending\b/i.test(fullReview),'Written full-film review is pending');
 });
 check('Image contact sheets',()=>{
  const files=['artifacts/gallery/contact-sheet.jpg','artifacts/before-after.jpg','artifacts/final-video/contact-sheet.jpg'].map(p=>path.join(root,p));
  const code='from PIL import Image\nimport sys\nfor file in sys.argv[1:]:\n im=Image.open(file); im.verify()\n im=Image.open(file); im.load()\n assert im.width >= 320 and im.height >= 180\nprint("CONTACT_IMAGES_VALID")';
  const result=spawnSync('python3',['-c',code,...files],{encoding:'utf8',timeout:30000,killSignal:'SIGKILL'});
  requireValue(result.status===0&&result.stdout.includes('CONTACT_IMAGES_VALID'),'Contact sheets missing or undecodable');
 });
 check('Offline production evidence',()=>{
  const offline=readJson(path.join(root,'artifacts/offline-check.json'));
  requireValue(offline.passed===true&&offline.sourceIdentity===identity&&Array.isArray(offline.errors)&&!offline.errors.length&&Array.isArray(offline.failedRequests)&&!offline.failedRequests.length,'Offline production evidence is incomplete or stale');
 });
 return failures;
}
