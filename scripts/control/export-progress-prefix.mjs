#!/usr/bin/env node
/** Manual intermediate export only. Default prepares evidence; --export encodes now. */
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectPng,sha256} from './capture-integrity.mjs';

const usage=`Usage:
  node scripts/control/export-progress-prefix.mjs --manifest=PATH --out=NEW_DIRECTORY [--prepare]
  node scripts/control/export-progress-prefix.mjs --manifest=PATH --out=NEW_DIRECTORY --export

Optional: --capture-dir=PATH (defaults to manifest directory), --count=N
          --source=SHA256 (add an expected pinned source identity)

Default --prepare snapshots and validates committed PNGs without launching ffmpeg.
--export performs that validation and encodes immediately. Nothing is scheduled.
The output directory must not exist and must be outside the capture directory.
Use --capture-dir when passing a previously saved manifest snapshot.
An incomplete prefix is explicitly labeled; this utility never passes final gates.
`;
const fail=message=>{throw Error(message);};
const within=(parent,child)=>{const relative=path.relative(parent,child);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));};
const writeJson=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const closeEnough=(actual,expected)=>typeof actual==='number'&&Number.isFinite(actual)&&Math.abs(actual-expected)<=1e-7;
function options(argv){
 const result={mode:'prepare'};let explicitMode=false;
 for(const argument of argv){
  if(argument==='--help'){console.log(usage);return null;}
  if(argument==='--prepare'||argument==='--export'){
   if(explicitMode)fail('Choose exactly one mode');
   result.mode=argument.slice(2);explicitMode=true;continue;
  }
  const match=argument.match(/^--(manifest|capture-dir|out|count|source)=(.+)$/);
  if(!match||Object.hasOwn(result,match[1]))fail('Unknown or repeated argument: '+argument);
  result[match[1]]=match[2];
 }
 if(!result.manifest||!result.out)fail(usage);
 return result;
}
function regularFile(file){if(!fs.lstatSync(file).isFile())fail('Expected regular file: '+file);}
function validateSnapshot(snapshot,config){
 const {contract,build,frames}=snapshot;
 if(snapshot.kind!=='intermediate-progress'||build?.production!==true||!/^[a-f0-9]{64}$/.test(build.sourceIdentity??''))fail('Not a pinned production progress manifest');
 if(config.source!==undefined&&config.source!==build.sourceIdentity)fail('Expected source identity does not match snapshot');
 if(contract?.fps!==24||contract.start!==0||contract.duration!==20)fail('This exporter requires the 20-second, zero-start, 24 fps flight contract');
 const {width,height}=contract;
 if(![width,height].every(value=>Number.isSafeInteger(value)&&value>=2&&value<=16384&&value%2===0)||snapshot.width!==width||snapshot.height!==height)fail('Invalid or inconsistent dimensions');
 const totalFrames=480;
 if(!Array.isArray(frames)||frames.length<1||frames.length>totalFrames||!Array.isArray(contract.timeline)||contract.timeline.length!==totalFrames)fail('Invalid committed frame list or flight timeline');
 let count=frames.length;
 if(config.count!==undefined){
  if(!/^[1-9]\d*$/.test(config.count))fail('Count must be a positive integer');
  count=Number(config.count);
  if(!Number.isSafeInteger(count)||count>frames.length)fail('Count exceeds the selected manifest snapshot');
 }
 for(let index=0;index<totalFrames;index++)if(!closeEnough(Number(contract.timeline[index]?.view),index/24))fail('Noncontiguous contract time at '+index);
 const selected=frames.slice(0,count),paths=new Set(),hashes=new Set();
 for(const [index,frame] of selected.entries()){
  if(frame.index!==index||!closeEnough(frame.time,index/24)||!closeEnough(frame.stats?.time,index/24)||!closeEnough(Number(frame.settings?.view),index/24))fail('Frame index or time mismatch at '+index);
  if(frame.sourceIdentity!==build.sourceIdentity||frame.stats?.sourceIdentity!==build.sourceIdentity||frame.stats?.ready!==true||frame.stats?.quality!=='high')fail('Frame source or readiness mismatch at '+index);
  if(frame.width!==width||frame.height!==height||!Number.isSafeInteger(frame.sizeBytes)||frame.sizeBytes<=0||!/^[a-f0-9]{64}$/.test(frame.sha256??''))fail('Invalid frame integrity metadata at '+index);
  if(frame.path!==`frames/${String(index).padStart(6,'0')}.png`||paths.has(frame.path))fail('Unexpected or repeated PNG path at '+index);
  if(hashes.has(frame.sha256))fail('Repeated PNG bytes in selected prefix at '+index);
  paths.add(frame.path);hashes.add(frame.sha256);
 }
 return {selected,count,totalFrames,width,height,fps:24,sourceIdentity:build.sourceIdentity};
}
function readVerifiedFrame(directory,frame,width,height){
 const file=path.join(directory,frame.path);
 regularFile(file);
 if(!within(directory,fs.realpathSync(file)))fail('Frame resolves outside capture directory: '+frame.path);
 const bytes=fs.readFileSync(file),actual=inspectPng(bytes,width,height);
 if(actual.sha256!==frame.sha256||actual.sizeBytes!==frame.sizeBytes)fail('PNG bytes do not match snapshot: '+frame.path);
 return bytes;
}
async function encode(args,details,captureDirectory){
 // This is an immediate owned-process safety deadline, not a delayed task.
 const encoder=spawn('ffmpeg',args,{stdio:['pipe','ignore','pipe'],timeout:180000,killSignal:'SIGTERM'});
 let log='';encoder.stderr.on('data',chunk=>{log=(log+chunk).slice(-65536);});
 encoder.stdin.on('error',()=>{});
 const exit=new Promise(resolve=>{encoder.once('error',error=>resolve({error}));encoder.once('close',(code,signal)=>resolve({code,signal}));});
 try{
  for(const frame of details.selected){
   const bytes=readVerifiedFrame(captureDirectory,frame,details.width,details.height);
   await new Promise((resolve,reject)=>encoder.stdin.write(bytes,error=>error?reject(error):resolve()));
  }
  encoder.stdin.end();
  const result=await exit;
  if(result.error||result.code!==0)fail('ffmpeg failed: '+(result.error?.message??`${result.code}/${result.signal}\n${log}`));
 }catch(error){encoder.stdin.destroy();encoder.kill('SIGTERM');await exit;throw error;}
 return log;
}
function probe(file,details){
 const args=['-v','error','-threads','2','-count_frames','-show_streams','-show_format','-of','json',file];
 const result=spawnSync('ffprobe',args,{encoding:'utf8',maxBuffer:4*1024*1024,timeout:60000,killSignal:'SIGTERM'});
 if(result.error||result.status!==0||result.stderr.trim())fail('ffprobe decode failed: '+(result.error?.message??result.stderr));
 const data=JSON.parse(result.stdout),streams=data.streams??[],video=streams[0];
 const rational=value=>{const parts=String(value).split('/').map(Number);return parts.length===2&&parts[1]!==0?parts[0]/parts[1]:NaN;};
 if(streams.length!==1||video?.codec_type!=='video'||video.codec_name!=='h264'||video.pix_fmt!=='yuv420p'||video.width!==details.width||video.height!==details.height||Number(video.nb_read_frames)!==details.count||rational(video.avg_frame_rate)!==24||rational(video.r_frame_rate)!==24)fail('Encoded stream does not match selected prefix');
 if(video.nb_frames!==undefined&&Number(video.nb_frames)!==details.count)fail('Encoded container frame count mismatch');
 const expected=details.count/24;
 if(!Number.isFinite(Number(data.format?.duration))||Math.abs(Number(data.format.duration)-expected)>.002||!Number.isFinite(Number(video.duration))||Math.abs(Number(video.duration)-expected)>.002)fail('Encoded duration mismatch');
 return {command:'ffprobe',args,result:data};
}
async function main(){
 const config=options(process.argv.slice(2));if(!config)return;
 const manifestFile=fs.realpathSync(path.resolve(config.manifest));regularFile(manifestFile);
 const captureDirectory=fs.realpathSync(path.resolve(config['capture-dir']??path.dirname(manifestFile)));
 if(!fs.lstatSync(captureDirectory).isDirectory())fail('Capture directory is not a directory');
 const requestedOut=path.resolve(config.out),parent=fs.realpathSync(path.dirname(requestedOut));
 const output=path.join(parent,path.basename(requestedOut));
 if(within(captureDirectory,output)||within(output,captureDirectory))fail('Output must be separate from and outside the capture directory');
 if(fs.existsSync(output))fail('Output directory already exists; use a new directory');
 // One read creates a consistent snapshot of the atomically replaced live manifest.
 const manifestBytes=fs.readFileSync(manifestFile),snapshot=JSON.parse(manifestBytes);
 const details=validateSnapshot(snapshot,config),complete=details.count===details.totalFrames;
 for(const frame of details.selected)readVerifiedFrame(captureDirectory,frame,details.width,details.height);
 fs.mkdirSync(output);
 fs.writeFileSync(path.join(output,'manifest-snapshot.json'),manifestBytes,{flag:'wx'});
 const filename=`last-light-bay-progress-${complete?'full-flight':'prefix'}-${details.count}f.mp4`;
 const temporary=path.join(output,filename.replace('.mp4','.encoding.mp4')),videoFile=path.join(output,filename);
 const label=complete?'Complete 20-second progress flight; intermediate quality, not final acceptance':`Incomplete progress prefix: ${details.count}/${details.totalFrames} frames; ${(details.count/24).toFixed(3)} of 20 seconds`;
 const args=['-hide_banner','-loglevel','error','-n','-threads','2','-f','image2pipe','-vcodec','png','-framerate','24','-i','pipe:0','-map','0:v:0','-frames:v',String(details.count),'-an','-sn','-dn','-c:v','libx264','-threads','2','-preset','medium','-crf','18','-pix_fmt','yuv420p','-fps_mode','passthrough','-movflags','+faststart','-metadata','title='+label,'-metadata','comment=Source '+details.sourceIdentity+'; validated committed PNG prefix; no repeated, interpolated, or newly rendered frames.',temporary];
 const provenance={kind:'manual-intermediate-flight-export',createdAt:new Date().toISOString(),mode:config.mode,label,completeFlight:complete,finalGateClaim:false,visuallyApproved:false,sourceManifest:manifestFile,captureDirectory,manifestSnapshotSha256:sha256(manifestBytes),sourceIdentity:details.sourceIdentity,sourceCaptureSucceededAtSnapshot:snapshot.captureSucceeded===true,snapshotCommittedFrames:snapshot.frames.length,selectedFrames:details.count,nominalFullFrames:details.totalFrames,firstIndex:0,lastIndex:details.count-1,firstSceneTime:0,lastSceneTime:(details.count-1)/24,videoDuration:details.count/24,fps:24,width:details.width,height:details.height,allSelectedPngsValidated:true,exportSucceeded:false,outputFilename:filename,encoder:{command:'ffmpeg',args},scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),selected:details.selected.map(({index,path,time,sha256,sizeBytes})=>({index,path,time,sha256,sizeBytes}))};
 writeJson(path.join(output,'prepared.json'),provenance);
 fs.writeFileSync(path.join(output,'README.md'),`# Last Light Bay progress export\n\n${label}.\n\nPinned source: \`${details.sourceIdentity}\`. Scene sample times: 0 through ${((details.count-1)/24).toFixed(8)} seconds; playback duration ${details.count/24} seconds at 24 fps.\n\nOnly committed, hash-verified PNGs from this saved manifest are selected. No duplicate padding, interpolation, or future frames. The source capture remains untouched.\n\nThis is an intermediate progress deliverable. It does not pass final quality or media gates. Export status is recorded separately in \`export-result.json\`; in prepare mode no video exists.\n`,{flag:'wx'});
 if(config.mode==='prepare'){console.log(JSON.stringify({mode:'prepared-only',output,label,selectedFrames:details.count,videoCreated:false},null,2));return;}
 try{
  const log=await encode(args,details,captureDirectory);
  const validation=probe(temporary,details);writeJson(path.join(output,'ffprobe.json'),validation);
  fs.renameSync(temporary,videoFile);
  const bytes=fs.readFileSync(videoFile);
  writeJson(path.join(output,'export-result.json'),{...provenance,exportSucceeded:true,finishedAt:new Date().toISOString(),video:{path:filename,sizeBytes:bytes.length,sha256:sha256(bytes)},decodedFrameCount:Number(validation.result.streams[0].nb_read_frames),encoderLog:log});
  console.log(JSON.stringify({mode:'exported',output,video:videoFile,label,selectedFrames:details.count,decodedFrameCount:Number(validation.result.streams[0].nb_read_frames)},null,2));
 }catch(error){writeJson(path.join(output,'export-result.json'),{...provenance,exportSucceeded:false,failedAt:new Date().toISOString(),error:String(error)});throw error;}
}
main().catch(error=>{console.error(String(error));process.exitCode=1;});
