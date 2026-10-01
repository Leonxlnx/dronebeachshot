import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

// A session nonce distinguishes this module's process lifetime; it is deliberately
// not represented as an OS-verified process birth or used to reclaim any lock.
const processSession=crypto.randomUUID();
export function portableCaptureProcessIdentity({platform=process.platform,pid=process.pid}={}){
 if(!['darwin','win32'].includes(platform))throw Error('Portable capture locks support macOS and Windows only');
 if(!Number.isSafeInteger(pid)||pid<=0)throw Error('Invalid portable capture PID');
 return {kind:'portable-no-reclaim-v1',platform,pid,processSession,birthVerified:false};
}

/** Portable policy: exclusive creation, checked owner release, never stale reclaim.
 * Injected platform/PID/host metadata is for policy tests, not OS emulation.
 */
export function acquirePortableCaptureLock(output,{platform=process.platform,pid=process.pid,host=os.hostname()}={}){
 const processIdentity=portableCaptureProcessIdentity({platform,pid});
 if(typeof host!=='string'||!host)throw Error('Invalid portable capture host');
 fs.mkdirSync(output,{recursive:true});
 if(!fs.lstatSync(output).isDirectory())throw Error('Capture output is not a directory');
 const file=path.join(output,'.capture-lock.json');
 const owner={lockVersion:3,pid,host,platform,processIdentity,token:crypto.randomUUID(),startedAt:new Date().toISOString(),reclaimPolicy:'never-automatic'};
 const bytes=JSON.stringify(owner);let fd;
 try{fd=fs.openSync(file,'wx',0o600);}
 catch(error){
  if(error.code!=='EEXIST')throw error;
  // Do not read/probe/delete the previous owner. Even an absent PID, old date,
  // same session, foreign format or malformed file does not authorize reclaim.
  throw Error('Capture output is locked by an active writer or an unverified previous owner. Portable locks are never automatically reclaimed; verify the original owner has exited before manual recovery, or use a new output directory.');
 }
 let created;
 try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);created=fs.fstatSync(fd,{bigint:true});}
 finally{fs.closeSync(fd);}
 let released=false;
 return()=>{
  if(released)return;
  try{
   const current=fs.lstatSync(file,{bigint:true});
   if(!current.isFile()||current.dev!==created.dev||current.ino!==created.ino||current.birthtimeNs!==created.birthtimeNs
    ||current.size!==BigInt(Buffer.byteLength(bytes))||fs.readFileSync(file,'utf8')!==bytes)return;
   // No portable code path replaces a held lock. The exact owner bytes and file
   // identity must still match; manually replacing locks while a writer runs is
   // outside this protocol and must never be part of automatic recovery.
   fs.unlinkSync(file);released=true;
  }catch(error){if(error.code!=='ENOENT')throw error;released=true;}
 };
}
