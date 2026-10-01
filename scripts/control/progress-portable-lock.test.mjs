import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {acquirePortableCaptureLock,portableCaptureProcessIdentity} from './progress-portable-lock.mjs';

function fixture(){
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'bay-portable-lock-'));
 return {output,file:path.join(output,'.capture-lock.json'),cleanup:()=>fs.rmSync(output,{recursive:true,force:true})};
}
for(const platform of ['darwin','win32']){
 test(platform+' portable policy acquires exclusively and releases its own lock',()=>{
  const f=fixture();try{
   const identity=portableCaptureProcessIdentity({platform});
   assert.equal(identity.kind,'portable-no-reclaim-v1');assert.equal(identity.birthVerified,false);
   assert.deepEqual(portableCaptureProcessIdentity({platform}),identity);
   const release=acquirePortableCaptureLock(f.output,{platform}),owner=JSON.parse(fs.readFileSync(f.file));
   assert.equal(owner.lockVersion,3);assert.equal(owner.platform,platform);assert.equal(owner.host,os.hostname());
   assert.equal(owner.pid,process.pid);assert.deepEqual(owner.processIdentity,identity);assert.equal(owner.reclaimPolicy,'never-automatic');
   assert.throws(()=>acquirePortableCaptureLock(f.output,{platform}),/never automatically reclaimed/);
   release();assert.equal(fs.existsSync(f.file),false);release();
   const releaseAgain=acquirePortableCaptureLock(f.output,{platform});
   assert.notEqual(JSON.parse(fs.readFileSync(f.file)).token,owner.token);releaseAgain();
  }finally{f.cleanup();}
 });

 test(platform+' preserves every existing file including old, legacy and malformed owners',()=>{
  const f=fixture();try{
   for(const bytes of ['', '{"pid":',JSON.stringify({pid:999999999,host:os.hostname(),startedAt:'1900-01-01'}),JSON.stringify({lockVersion:2,host:'foreign-host',pid:1}),JSON.stringify({lockVersion:3,pid:process.pid,host:os.hostname(),platform,token:'old',reclaimPolicy:'never-automatic'})]){
    fs.writeFileSync(f.file,bytes);fs.utimesSync(f.file,new Date('2000-01-01'),new Date('2000-01-01'));
    const before=fs.statSync(f.file);
    assert.throws(()=>acquirePortableCaptureLock(f.output,{platform}),/locked/);
    assert.equal(fs.readFileSync(f.file,'utf8'),bytes);assert.equal(fs.statSync(f.file).mtimeMs,before.mtimeMs);
    fs.unlinkSync(f.file);
   }
   fs.mkdirSync(f.file);assert.throws(()=>acquirePortableCaptureLock(f.output,{platform}),/locked/);assert.equal(fs.statSync(f.file).isDirectory(),true);
  }finally{f.cleanup();}
 });

 test(platform+' release preserves changed contents or a replacement file',()=>{
  const f=fixture();try{
   let release=acquirePortableCaptureLock(f.output,{platform});
   fs.writeFileSync(f.file,'a different owner');release();assert.equal(fs.readFileSync(f.file,'utf8'),'a different owner');fs.unlinkSync(f.file);
   release=acquirePortableCaptureLock(f.output,{platform});const bytes=fs.readFileSync(f.file);
   fs.renameSync(f.file,f.file+'.original');fs.writeFileSync(f.file,bytes);release();
   assert.deepEqual(fs.readFileSync(f.file),bytes,'Even identical owner bytes in a replacement file are not our file');
  }finally{f.cleanup();}
 });
}

test('portable policy rejects unsupported platforms and invalid owner metadata',()=>{
 for(const platform of ['linux','freebsd',''])assert.throws(()=>portableCaptureProcessIdentity({platform}),/macOS and Windows only/);
 for(const pid of [0,-1,NaN,Infinity,1.5])assert.throws(()=>portableCaptureProcessIdentity({platform:'darwin',pid}),/PID/);
});

test('an actual exited portable-policy owner is still never automatically reclaimed',{timeout:10000},async()=>{
 const f=fixture(),moduleURL=new URL('./progress-portable-lock.mjs',import.meta.url).href;
 const code=`import {acquirePortableCaptureLock} from ${JSON.stringify(moduleURL)};acquirePortableCaptureLock(process.argv[1],{platform:'darwin'});`;
 try{
  const child=spawn(process.execPath,['--input-type=module','-e',code,f.output],{stdio:['ignore','ignore','pipe']});
  let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});
  const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});
  assert.deepEqual(result,{code:0,signal:null},stderr);const before=fs.readFileSync(f.file);
  assert.throws(()=>acquirePortableCaptureLock(f.output,{platform:'darwin'}),/never automatically reclaimed/);
  assert.deepEqual(fs.readFileSync(f.file),before);
  // The child has demonstrably completed; this explicit test-owned manual
  // recovery is not a runtime reclaim feature or an inference from PID/age.
  fs.unlinkSync(f.file);const release=acquirePortableCaptureLock(f.output,{platform:'darwin'});release();
  assert.equal(fs.existsSync(f.file),false);
 }finally{f.cleanup();}
});
