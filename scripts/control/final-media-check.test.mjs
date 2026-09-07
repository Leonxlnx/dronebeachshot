import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {crc32,inspectPng} from './capture-integrity.mjs';
import {validateGallery,validateTimeline,validateFinalMedia} from './final-media-check.mjs';
function png(n){
 const chunk=(type,data)=>{const h=Buffer.alloc(8),c=Buffer.alloc(4);h.writeUInt32BE(data.length);h.write(type,4);c.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type),data])));return Buffer.concat([h,data,c])};
 const h=Buffer.alloc(13);h.writeUInt32BE(8);h.writeUInt32BE(4,4);h[8]=8;h[9]=6;
 const pixels=Buffer.alloc(132,n);for(let y=0;y<4;y++)pixels[y*33]=0;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
const write=(p,data)=>fs.writeFileSync(p,JSON.stringify(data));
test('gallery accepts measured bytes and rejects missing, tampered, duplicate and stale evidence',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bay-gallery-')),dir=path.join(root,'artifacts/gallery'),identity='a'.repeat(64);fs.mkdirSync(dir,{recursive:true});
 const names=Array.from({length:16},(_,i)=>'camera-'+i);
 const status={runId:'fixture',sourceIdentity:identity,captureSucceeded:true,offlineAfterLoad:true,errors:[],failedRequests:[],cameraNames:names};
 write(path.join(dir,'capture-status.json'),status);write(path.join(root,'artifacts/capture-latest-gallery.json'),{...status,state:'captured'});
 const manifest=names.map((name,i)=>{const bytes=png(i+1);fs.writeFileSync(path.join(dir,name+'.png'),bytes);return {name,path:name+'.png',...inspectPng(bytes,8,4),runId:'fixture',sourceIdentity:identity,visuallyReviewed:true}});
 const file=path.join(dir,'manifest.json');write(file,manifest);
 try{
  assert.equal(validateGallery(root,identity,8,4).length,16);
  for(const change of [m=>m[0].width=3840,m=>m[0].sha256='b'.repeat(64),m=>m[0].visuallyReviewed=false,m=>m[0].path='../outside.png',m=>m[0].sourceIdentity='old',m=>m[1]={...m[0]}]){
   const changed=structuredClone(manifest);change(changed);write(file,changed);assert.throws(()=>validateGallery(root,identity,8,4));
  }
  write(file,manifest);fs.writeFileSync(path.join(dir,names[0]+'.png'),Buffer.alloc(0));
  assert.throws(()=>validateGallery(root,identity,8,4),/PNG/);
  fs.rmSync(path.join(dir,names[0]+'.png'));assert.throws(()=>validateGallery(root,identity,8,4),/ENOENT/);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('timeline rejects gaps, repeated inputs, wrong time and stale source identity',()=>{
 const rows=Array.from({length:1200},(_,i)=>({frame:i,t:i/60,sha256:crypto.createHash('sha256').update('frame'+i).digest('hex'),runId:'run',sourceIdentity:'source'}));
 validateTimeline(rows,'run','source');
 for(const change of [r=>r.pop(),r=>r[12].frame=13,r=>r[12].t+=1/60,r=>r[12].sha256=r[11].sha256,r=>r[12].sourceIdentity='old']){
  const changed=structuredClone(rows);change(changed);assert.throws(()=>validateTimeline(changed,'run','source'));
 }
});

test('existence-only empty media cannot pass final validation',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bay-empty-media-'));fs.mkdirSync(path.join(root,'artifacts/final-video'),{recursive:true});
 for(const name of ['last-light-bay-1440p60.mp4','last-light-bay-1080p60.mp4','ffprobe.json','full-review.md'])fs.writeFileSync(path.join(root,'artifacts/final-video',name),'');
 try{const failures=validateFinalMedia(root);assert.ok(failures.some(f=>f.startsWith('Master and web film:')));assert.ok(failures.some(f=>f.startsWith('Gallery bytes:')))}finally{fs.rmSync(root,{recursive:true,force:true})}
});
