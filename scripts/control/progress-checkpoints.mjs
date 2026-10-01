/** Intermediate-only capture recovery. This module does not pass final gates. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {inspectPng,sha256} from './capture-integrity.mjs';

export function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
 if(typeof value==='number'&&!Number.isFinite(value))throw Error('Nonfinite capture setting');
 if(value===undefined||typeof value==='function'||typeof value==='symbol'||typeof value==='bigint')throw Error('Non-JSON capture setting');
 return value;
}
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function validateProfile(profile){
 if(!plain(profile))throw Error('Settings profile must be a JSON object');
 const objectKeys=['lighting','surfaceStudy','shadowStudy'],booleanKeys=['culling','oceanCulling','farCrownCoverage','farCrownBlending','linearMainOutput','profiling','coastalUnderstory'];
 for(const [key,value]of Object.entries(profile)){
  if(objectKeys.includes(key)){if(!plain(value))throw Error('Invalid '+key+' settings');}
  else if(booleanKeys.includes(key)){if(typeof value!=='boolean')throw Error('Invalid '+key+' setting');}
  else if(key==='debug'){if(!Number.isInteger(value)||value<0||value>12)throw Error('Invalid debug setting');}
  else throw Error('Unknown capture setting: '+key);
 }
 return canonical(profile);
}
export function validateTimeline(timeline,{numeric=false}={}){
 if(!Array.isArray(timeline)||!timeline.length)throw Error('Capture timeline is empty');
 return timeline.map((entry,index)=>{
  if(!plain(entry)||!Object.hasOwn(entry,'view'))throw Error('Missing timeline view at '+index);
  const {view,label,...settings}=entry;
  if(typeof view!=='number'&&typeof view!=='string')throw Error('Invalid timeline view');
  const text=String(view),number=Number(text);
  if(!text.trim())throw Error('Empty timeline view');
  if(numeric&&(!Number.isFinite(number)||number<0||number>20))throw Error('Video timeline requires absolute times in [0,20]');
  if(!numeric&&!Number.isFinite(number)&&!/^[a-z0-9-]+$/.test(text))throw Error('Invalid named camera');
  if(Number.isFinite(number)&&(number<0||number>20))throw Error('Timeline time outside [0,20]');
  if(label!==undefined&&(typeof label!=='string'||!/^[a-zA-Z0-9_.-]+$/.test(label)))throw Error('Invalid timeline label');
  return canonical({view,...(label===undefined?{}:{label}),...validateProfile(settings)});
 });
}
export function makeVideoContract({width,height,fps,duration,start=0,profile={},timeline}){
 if(![width,height].every(n=>Number.isInteger(n)&&n>=2&&n<=16384&&n%2===0))throw Error('Video dimensions must be positive even integers');
 if(!Number.isFinite(fps)||fps<1||fps>60)throw Error('Invalid video fps');
 if(!Number.isFinite(duration)||duration<=0||duration>20||!Number.isFinite(start)||start<0||start>=20)throw Error('Invalid video interval');
 const count=Math.round(duration*fps);
 if(!count)throw Error('Video has no frames');
 const plan=timeline??Array.from({length:count},(_,i)=>({view:(start+i/fps).toFixed(8)}));
 if(plan.length!==count)throw Error('Video timeline length does not match duration and fps');
 const validated=validateTimeline(plan,{numeric:true});
 if(new Set(validated.map(entry=>Number(entry.view))).size!==validated.length)throw Error('Video contains repeated input times');
 return canonical({width,height,fps,duration,start,profile:validateProfile(profile),timeline:validated});
}
export function writeAtomic(file,bytes){
 const temporary=file+'.pending-'+process.pid+'-'+crypto.randomUUID();
 let handle;
 try{handle=fs.openSync(temporary,'wx');fs.writeFileSync(handle,bytes);fs.fsyncSync(handle);fs.closeSync(handle);handle=undefined;fs.renameSync(temporary,file);}
 finally{if(handle!==undefined)fs.closeSync(handle);if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
export const writeAtomicJson=(file,value)=>writeAtomic(file,JSON.stringify(value,null,2)+'\n');
function ensureRegular(file){if(!fs.lstatSync(file).isFile())throw Error('Expected regular file: '+file);}
export function bundleInventory(directory){
 if(!fs.lstatSync(directory).isDirectory())throw Error('Expected bundle directory');
 const rows=[];
 function walk(relative){
  for(const name of fs.readdirSync(path.join(directory,relative)).sort()){
   const key=relative?relative+'/'+name:name,file=path.join(directory,key),stat=fs.lstatSync(file);
   if(stat.isSymbolicLink())throw Error('Bundle symlink is not permitted: '+key);
   if(stat.isDirectory())walk(key);
   else if(stat.isFile()){const bytes=fs.readFileSync(file);rows.push({path:key,sizeBytes:bytes.length,sha256:sha256(bytes)});}
   else throw Error('Unsupported bundle entry: '+key);
  }
 }
 walk('');
 if(!rows.some(row=>row.path==='index.html'))throw Error('Production bundle has no index.html');
 return rows.sort((a,b)=>a.path.localeCompare(b.path));
}
export function acquireCaptureLock(output){
 fs.mkdirSync(output,{recursive:true});
 if(!fs.lstatSync(output).isDirectory())throw Error('Capture output is not a directory');
 const file=path.join(output,'.capture-lock.json'),owner={pid:process.pid,host:os.hostname(),token:crypto.randomUUID(),startedAt:new Date().toISOString()};
 for(let attempt=0;attempt<2;attempt++){
  try{const fd=fs.openSync(file,'wx');try{fs.writeFileSync(fd,JSON.stringify(owner));}finally{fs.closeSync(fd);}return()=>{try{ensureRegular(file);const value=JSON.parse(fs.readFileSync(file,'utf8'));if(value.token===owner.token)fs.unlinkSync(file);}catch(error){if(error.code!=='ENOENT')throw error;}};}
  catch(error){
   if(error.code!=='EEXIST')throw error;
   ensureRegular(file);const before=fs.readFileSync(file,'utf8'),previous=JSON.parse(before);
   if(previous.host!==owner.host||!Number.isInteger(previous.pid)||previous.pid<=0)throw Error('Capture output is locked by another or unknown writer');
   let alive=true;try{process.kill(previous.pid,0);}catch(check){if(check.code==='ESRCH')alive=false;else throw check;}
   if(alive)throw Error('Capture output is locked by an active writer');
   if(fs.readFileSync(file,'utf8')!==before)throw Error('Capture lock changed while checking stale writer');
   fs.unlinkSync(file);
  }
 }
 throw Error('Could not acquire capture lock');
}
function pinBundle(dist,output){
 const destination=path.join(output,'render-bundle');
 if(fs.existsSync(destination))throw Error('Uncommitted render-bundle exists without a manifest');
 const original=bundleInventory(dist),temporary=path.join(output,'render-bundle.pending-'+crypto.randomUUID());
 fs.mkdirSync(temporary);
 try{
  for(const row of original){const file=path.join(temporary,row.path);fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(path.join(dist,row.path),file,fs.constants.COPYFILE_EXCL);}
  if(!same(bundleInventory(temporary),original)||!same(bundleInventory(dist),original))throw Error('Production build changed while pinning capture bundle');
  fs.renameSync(temporary,destination);return original;
 }finally{if(fs.existsSync(temporary))fs.rmSync(temporary,{recursive:true});}
}
function validateBuild(build){if(build?.production!==true||!/^[a-f0-9]{64}$/.test(build.sourceIdentity??''))throw Error('Capture requires a verified production source identity');}
export function openVideoCheckpoint({output,dist,contract,resume=false}){
 output=path.resolve(output);contract=makeVideoContract(contract);
 const release=acquireCaptureLock(output),file=path.join(output,'manifest.json');let manifest,attempt;
 try{
  if(fs.existsSync(file)){
   if(!resume)throw Error('Capture output already has a manifest; use resume with the original contract');
   ensureRegular(file);manifest=JSON.parse(fs.readFileSync(file,'utf8'));
   if(manifest.kind!=='intermediate-progress'||manifest.checkpointVersion!==1)throw Error('Unsupported checkpoint manifest');
   if(!same(manifest.contract,contract)||manifest.width!==contract.width||manifest.height!==contract.height)throw Error('Checkpoint settings or timeline mismatch');
   if(!same(bundleInventory(path.join(output,'render-bundle')),manifest.bundleFiles))throw Error('Pinned production bundle mismatch');
   if(!Array.isArray(manifest.frames)||manifest.frames.length>contract.timeline.length||!Array.isArray(manifest.attempts)||!Array.isArray(manifest.failures))throw Error('Malformed checkpoint records');
   if(manifest.build!==undefined)validateBuild(manifest.build);
   if(manifest.frames.length&&!manifest.build)throw Error('Saved frames have no production identity');
   for(const [index,record]of manifest.frames.entries()){
    const expectedPath='frames/'+String(index).padStart(6,'0')+'.png';
    if(record.index!==index||record.path!==expectedPath||record.view!==String(index).padStart(6,'0')||!same(record.settings,contract.timeline[index]))throw Error('Checkpoint frame order or settings mismatch at '+index);
    const expectedTime=Number(contract.timeline[index].view);
    if(record.sourceIdentity!==manifest.build.sourceIdentity||record.time!==expectedTime||record.stats?.ready!==true||record.stats?.sourceIdentity!==manifest.build.sourceIdentity||record.stats?.quality!=='high'||!Number.isFinite(record.stats.time)||Math.abs(record.stats.time-expectedTime)>1e-8)throw Error('Checkpoint frame identity or time mismatch at '+index);
    const frameFile=path.join(output,record.path);ensureRegular(frameFile);const info=inspectPng(fs.readFileSync(frameFile),contract.width,contract.height);
    for(const key of ['width','height','sizeBytes','sha256'])if(record[key]!==info[key])throw Error('Checkpoint PNG metadata mismatch at '+index);
   }
  }else{
   if(resume)throw Error('No video checkpoint to resume');
   const bundleFiles=pinBundle(dist,output);
   manifest={kind:'intermediate-progress',checkpointVersion:1,startedAt:new Date().toISOString(),width:contract.width,height:contract.height,contract,bundleFiles,frames:[],attempts:[],failures:[],captureSucceeded:false,errors:[],failedRequests:[],video:{filename:'last-light-bay-progress.mp4',fps:contract.fps,duration:contract.duration,actualDuration:contract.timeline.length/contract.fps,silent:true}};
   fs.mkdirSync(path.join(output,'frames'),{recursive:true});writeAtomicJson(file,manifest);
  }
 }catch(error){
  try{writeAtomicJson(path.join(output,'last-resume-rejection.json'),{at:new Date().toISOString(),error:String(error)});}finally{release();}
  throw error;
 }
 const save=()=>writeAtomicJson(file,manifest);
 return {
  output,bundle:path.join(output,'render-bundle'),manifest,release,
  startAttempt(){attempt={startedAt:new Date().toISOString(),reusedFrames:manifest.frames.length};manifest.attempts.push(attempt);manifest.captureSucceeded=false;manifest.errors=[];manifest.failedRequests=[];delete manifest.finishedAt;save();},
  bindBuild(build){validateBuild(build);if(manifest.build&&!same(build,manifest.build))throw Error('Loaded production build changed across capture attempts');manifest.build=canonical(build);save();},
  update(values){for(const key of ['encodingCommand','graphics','offlineAfterLoad','diagnostics'])if(Object.hasOwn(values,key))manifest[key]=values[key];save();},
  readFrame(index){const record=manifest.frames[index];if(!record)throw Error('Missing checkpoint record');const file=path.join(output,record.path);ensureRegular(file);const bytes=fs.readFileSync(file);const info=inspectPng(bytes,contract.width,contract.height);if(info.sha256!==record.sha256)throw Error('Checkpoint changed after validation at '+index);return bytes;},
  appendFrame(index,bytes,stats,milliseconds=0){
   if(index!==manifest.frames.length||index>=contract.timeline.length)throw Error('Checkpoint frames must append in order');
   validateBuild(manifest.build);const expectedTime=Number(contract.timeline[index].view);
   if(stats?.ready!==true||stats.sourceIdentity!==manifest.build.sourceIdentity||stats.quality!=='high'||!Number.isFinite(stats.time)||Math.abs(stats.time-expectedTime)>1e-8)throw Error('Rendered frame identity, readiness or time mismatch');
   const info=inspectPng(bytes,contract.width,contract.height),name=String(index).padStart(6,'0'),relative='frames/'+name+'.png';
   writeAtomic(path.join(output,relative),bytes);
   manifest.frames.push({index,path:relative,view:name,settings:contract.timeline[index],time:expectedTime,sourceIdentity:manifest.build.sourceIdentity,...info,milliseconds,stats});save();
   return manifest.frames[index];
  },
  finish({errors=[],failedRequests=[]}={}){if(manifest.frames.length!==contract.timeline.length||errors.length||failedRequests.length)throw Error('Cannot finish an incomplete or unhealthy capture');manifest.captureSucceeded=true;manifest.errors=errors;manifest.failedRequests=failedRequests;manifest.finishedAt=new Date().toISOString();if(attempt)Object.assign(attempt,{finishedAt:manifest.finishedAt,captureSucceeded:true});save();},
  fail(error,{errors=[],failedRequests=[]}={}){const failure={at:new Date().toISOString(),error:String(error),savedFrames:manifest.frames.length};manifest.failures.push(failure);manifest.captureSucceeded=false;manifest.errors=errors;manifest.failedRequests=failedRequests;manifest.finishedAt=failure.at;if(attempt)Object.assign(attempt,{finishedAt:failure.at,captureSucceeded:false,error:failure.error});save();},
 };
}
