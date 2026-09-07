import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {deflateSync} from 'node:zlib';
import {runCapture,withDeadline,writeEncoderFrame} from './capture-run.mjs';
import {assertCaptureHealthy,crc32,inspectPng} from './capture-integrity.mjs';
import {Writable} from 'node:stream';

test('encoder deadlines reject stalled writes and exits while preserving success and failures',async()=>{
 const stalled=new Writable({write(){}});stalled.on('error',()=>{});
 await assert.rejects(writeEncoderFrame(stalled,Buffer.alloc(65536),25),/frame write timed out/);
 stalled.destroy();
 await assert.rejects(withDeadline(new Promise(()=>{}),25,'Encoder completion'),/completion timed out/);
 assert.equal(await withDeadline(Promise.resolve(42),25,'ready'),42);
 await assert.rejects(withDeadline(Promise.reject(Error('encoder exited')),25,'ready'),/encoder exited/);
 const broken={write:(_bytes,callback)=>callback(Error('broken pipe'))};
 await assert.rejects(writeEncoderFrame(broken,Buffer.from('frame'),25),/broken pipe/);
});

test('capture health rejects late events and unverified or development builds',async()=>{
 const identity='a'.repeat(64),state={ready:true,error:null,build:{production:true,sourceIdentity:identity}};
 await assertCaptureHealthy({evaluate:async()=>state},[],[],identity);
 const requests=[];
 await assert.rejects(assertCaptureHealthy({evaluate:async()=>{requests.push('/late.bin');return state}},[],requests,identity),/health failed/);
 for(const build of [undefined,{production:false,sourceIdentity:identity},{production:true,sourceIdentity:'b'.repeat(64)}]){
  await assert.rejects(assertCaptureHealthy({evaluate:async()=>({...state,build})},[],[],identity),/production build/);
 }
});

function png(number,width=8,height=4){
 function chunk(type,data){const header=Buffer.alloc(8),crc=Buffer.alloc(4);header.writeUInt32BE(data.length);header.write(type,4);crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type),data])));return Buffer.concat([header,data,crc])}
 const h=Buffer.alloc(13);h.writeUInt32BE(width);h.writeUInt32BE(height,4);h[8]=8;h[9]=6;
 const pixels=Buffer.alloc((width*4+1)*height,number);for(let y=0;y<height;y++)pixels[y*(width*4+1)]=0;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}

test('PNG validation rejects corrupt compressed data and claimed dimensions',()=>{
 const image=png(3);assert.equal(inspectPng(image,8,4).width,8);
 assert.throws(()=>inspectPng(image,16,4),/dimensions/);
 const corrupt=Buffer.from(image);corrupt[corrupt.length-20]^=1;
 assert.throws(()=>inspectPng(corrupt,8,4),/CRC/);
 assert.throws(()=>inspectPng(image.subarray(0,-3),8,4),/Truncated/);
});

for(const scenario of ['healthy','context-loss','late-request','http-error','startup-failure','duplicate','corrupt-png']){
 test('capture transaction: '+scenario,async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bay-capture-'));
  const original=globalThis.window;let calls=0,contextClosed=false,browserClosed=false;const callbacks=new Map();
  const old=path.join(root,'artifacts/baseline');fs.mkdirSync(old,{recursive:true});fs.writeFileSync(path.join(old,'previous.txt'),'prior complete bundle');
  const api={ready:true,error:null,build:{production:true,sourceIdentity:'a'.repeat(64)},cameraNames:Array.from({length:16},(_,i)=>'view-'+i),cameraDiagnostics:()=>({}),setCamera:()=>{
   calls++;
   if(calls===3&&scenario==='context-loss')api.ready=false;
   if(calls===3&&scenario==='late-request')callbacks.get('requestfailed')({url:()=>'/assets/late.bin'});
   if(calls===3&&scenario==='http-error')callbacks.get('response')({url:()=>'/assets/missing.bin',status:()=>404});
   return {ready:api.ready,sourceIdentity:'a'.repeat(64),quality:'high',time:4};
  }};
  globalThis.window={lastLightBay:api};
  const page={on:(event,fn)=>callbacks.set(event,fn),goto:async()=>{if(scenario==='startup-failure')throw Error('navigation failed')},waitForFunction:async fn=>{if(!fn())throw Error('not ready')},evaluate:async(fn,arg)=>fn(arg),locator:()=>({screenshot:async()=>scenario==='corrupt-png'?Buffer.from('not png'):png(scenario==='duplicate'?0:calls)})};
  const launch=async()=>({newContext:async()=>({newPage:async()=>page,setOffline:async()=>{},close:async()=>{contextClosed=true}}),close:async()=>{browserClosed=true}});
  try{
   const run=runCapture({base:'https://example.invalid',mode:'baseline',launch,root,identity:'a'.repeat(64),dimensions:{width:8,height:4}});
   if(scenario==='healthy'){
    const result=await run;assert.equal(result.captureSucceeded,true);assert.equal(calls,16);
    const manifest=JSON.parse(fs.readFileSync(path.join(old,'manifest.json')));assert.equal(manifest.length,16);
    for(const item of manifest)assert.equal(inspectPng(fs.readFileSync(path.join(old,item.path)),8,4).sha256,item.sha256);
    assert.equal(fs.existsSync(path.join(old,'previous.txt')),false);
    const runs=path.join(root,'artifacts/capture-runs');const prior=fs.readdirSync(runs).find(n=>n.startsWith('previous-'));
    assert.equal(fs.readFileSync(path.join(runs,prior,'previous.txt'),'utf8'),'prior complete bundle');
   }else{
    await assert.rejects(run);
    assert.equal(fs.readFileSync(path.join(old,'previous.txt'),'utf8'),'prior complete bundle');
    const latest=JSON.parse(fs.readFileSync(path.join(root,'artifacts/capture-latest-baseline.json')));
    assert.equal(latest.captureSucceeded,false);assert.equal(latest.state,'failed');
    assert.equal(fs.existsSync(path.join(old,'manifest.json')),false);assert.ok(calls<=3);
   }
   assert.equal(contextClosed,true);assert.equal(browserClosed,true);
  }finally{globalThis.window=original;fs.rmSync(root,{recursive:true,force:true})}
 });
}
