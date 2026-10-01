import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {acquireCaptureLock,captureProcessIdentity,captureLockOwnerState} from './progress-checkpoints.mjs';

function owner(procPid,namespacePid=2){return {
 lockVersion:2,pid:namespacePid,host:'fixture-host',token:'owner-'+procPid,
 processIdentity:{kind:'linux-proc-v1',bootId:'1137de8f-8f48-4c4f-a8d7-f1ce176e6b7c',procfsDevice:'17',procfsRootInode:'1',
  procPid,startTicks:'12345678901234567890',pidNamespace:'pid:['+(4000000000+procPid)+']',namespacePids:[procPid,namespacePid]},
};}
const missing=()=>{throw Object.assign(Error('missing'),{code:'ENOENT'});};
const denied=()=>{throw Object.assign(Error('denied'),{code:'EACCES'});};

test('capture lock distinguishes two namespace PID2 owners using the shared proc view',()=>{
 const previous=owner(701),current=owner(901),reads=[];
 assert.equal(previous.pid,current.pid);assert.notEqual(previous.processIdentity.procPid,current.processIdentity.procPid);
 const active=captureLockOwnerState(previous,current,{
  readProcess:pid=>{reads.push(pid);return{procPid:pid,startTicks:previous.processIdentity.startTicks,state:'S'};},
  readNamespace:pid=>{assert.equal(pid,701);return previous.processIdentity.pidNamespace;},
 });
 assert.equal(active.state,'active');assert.deepEqual(reads,[701,701]);
 const stale=captureLockOwnerState(previous,current,{readProcess:pid=>{assert.equal(pid,701);return missing();},readNamespace:()=>{throw Error('Absent process must not need a namespace read');}});
 assert.equal(stale.state,'stale');assert.match(stale.reason,/absent/);
});

test('capture lock detects reused birth, terminated owner and identity changes during inspection',()=>{
 const previous=owner(701),current=owner(901),birth=previous.processIdentity.startTicks;
 const reused=captureLockOwnerState(previous,current,{readProcess:pid=>({procPid:pid,startTicks:'12345678901234567891',state:'R'}),readNamespace:()=>{throw Error('Birth mismatch is already decisive');}});
 assert.equal(reused.state,'stale');assert.match(reused.reason,/reused/);
 for(const state of ['Z','X','x'])assert.equal(captureLockOwnerState(previous,current,{readProcess:pid=>({procPid:pid,startTicks:birth,state}),readNamespace:denied}).state,'stale');
 let reads=0;
 const changed=captureLockOwnerState(previous,current,{readProcess:pid=>({procPid:pid,startTicks:reads++?String(BigInt(birth)+1n):birth,state:'S'}),readNamespace:()=>previous.processIdentity.pidNamespace});
 assert.equal(changed.state,'stale');assert.match(changed.reason,/during/);
 const otherNamespace=captureLockOwnerState(previous,current,{readProcess:pid=>({procPid:pid,startTicks:birth,state:'S'}),readNamespace:()=> 'pid:[123]'});
 assert.equal(otherNamespace.state,'stale');
});

test('capture lock preserves unknown legacy, foreign-view, malformed and permission-denied owners',()=>{
 const current=owner(901),base=owner(701);
 const unknown=[
  {...base,lockVersion:undefined},
  {...base,host:'other-host'},
  {...base,processIdentity:undefined},
  {...base,processIdentity:{...base.processIdentity,startTicks:123}},
  {...base,processIdentity:{...base.processIdentity,startTicks:'0123'}},
  {...base,processIdentity:{...base.processIdentity,bootId:'------------------------------------'}},
  {...base,processIdentity:{...base.processIdentity,bootId:'2237de8f-8f48-4c4f-a8d7-f1ce176e6b7c'}},
  {...base,processIdentity:{...base.processIdentity,procfsDevice:'99'}},
  {...base,processIdentity:{...base.processIdentity,namespacePids:[701,3]}},
 ];
 for(const record of unknown){let reads=0;assert.equal(captureLockOwnerState(record,current,{readProcess:()=>{reads++;return missing();}}).state,'unknown');assert.equal(reads,0,'Unknown identity must not be treated as dead by querying a different view');}
 assert.equal(captureLockOwnerState(base,current,{readProcess:denied}).state,'unknown');
 assert.equal(captureLockOwnerState(base,current,{readProcess:pid=>({procPid:pid,startTicks:base.processIdentity.startTicks,state:'S'}),readNamespace:denied}).state,'unknown');
 for(const observed of [{procPid:701,startTicks:123,state:'S'},{procPid:701,startTicks:base.processIdentity.startTicks,state:'broken'},null]){
  assert.equal(captureLockOwnerState(base,current,{readProcess:()=>observed}).state,'unknown');
 }
 assert.equal(captureLockOwnerState(base,current,{readProcess:pid=>({procPid:pid,startTicks:base.processIdentity.startTicks,state:'S'}),readNamespace:()=> 'not-a-namespace'}).state,'unknown');
});

test('capture lock leaves legacy and malformed files intact and resolves its actual proc identity',()=>{
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'bay-lock-identity-')),file=path.join(output,'.capture-lock.json');
 try{
  const identity=captureProcessIdentity();
  assert.equal(identity.procPid,Number(fs.readlinkSync('/proc/self')));assert.equal(identity.namespacePids.at(-1),process.pid);
  assert.equal(identity.pidNamespace,fs.readlinkSync('/proc/self/ns/pid'));
  const record={pid:process.pid,host:os.hostname(),token:'legacy'};fs.writeFileSync(file,JSON.stringify(record));
  const legacy=fs.readFileSync(file);assert.throws(()=>acquireCaptureLock(output),/legacy lock/);assert.deepEqual(fs.readFileSync(file),legacy);
  fs.writeFileSync(file,'{"pid":');assert.throws(()=>acquireCaptureLock(output));assert.equal(fs.readFileSync(file,'utf8'),'{"pid":');
  fs.unlinkSync(file);const release=acquireCaptureLock(output),current=JSON.parse(fs.readFileSync(file));
  assert.equal(current.lockVersion,2);assert.deepEqual(current.processIdentity,identity);assert.throws(()=>acquireCaptureLock(output),/active writer/);release();assert.equal(fs.existsSync(file),false);
 }finally{fs.rmSync(output,{recursive:true,force:true});}
});

test('capture lock blocks an actual child owner, then reclaims its unreleased lock after confirmed exit',{timeout:10000},async()=>{
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'bay-lock-child-')),file=path.join(output,'.capture-lock.json');
 const moduleURL=new URL('./progress-checkpoints.mjs',import.meta.url).href;
 const code=`import fs from 'node:fs';import path from 'node:path';import {acquireCaptureLock} from ${JSON.stringify(moduleURL)};acquireCaptureLock(process.argv[1]);process.stdout.write(fs.readFileSync(path.join(process.argv[1],'.capture-lock.json'),'utf8')+'\\n');process.stdin.once('data',()=>process.exit(0));`;
 const child=spawn(process.execPath,['--input-type=module','-e',code,output],{stdio:['pipe','pipe','pipe']});
 let stderr='',ready=false;child.stderr.on('data',chunk=>{stderr+=chunk;});
 const closed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});
 try{
  const previous=await new Promise((resolve,reject)=>{
   let data='';child.stdout.on('data',chunk=>{data+=chunk;if(data.includes('\n')){ready=true;try{resolve(JSON.parse(data.trim()));}catch(error){reject(error);}}});
   child.once('error',reject);child.once('close',code=>{if(!ready)reject(Error('Child exited before lock handshake: '+code+' '+stderr));});
  });
  assert.equal(previous.processIdentity.namespacePids.at(-1),child.pid);assert.ok(fs.existsSync('/proc/'+previous.processIdentity.procPid));
  assert.throws(()=>acquireCaptureLock(output),/active writer/);assert.deepEqual(JSON.parse(fs.readFileSync(file)),previous);
  child.stdin.end('exit without releasing lock\n');assert.deepEqual(await closed,{code:0,signal:null});
  assert.equal(fs.existsSync('/proc/'+previous.processIdentity.procPid),false,'Actual owner must be gone before reclaim');
  const release=acquireCaptureLock(output),replacement=JSON.parse(fs.readFileSync(file));
  assert.notEqual(replacement.token,previous.token);assert.equal(replacement.processIdentity.procPid,Number(fs.readlinkSync('/proc/self')));
  release();assert.equal(fs.existsSync(file),false);
 }finally{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');await closed.catch(()=>{});fs.rmSync(output,{recursive:true,force:true});}
});
