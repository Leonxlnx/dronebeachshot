import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {inflateSync} from 'node:zlib';

export const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable=Array.from({length:256},(_,n)=>{
 for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;
 return n>>>0;
});
export function crc32(bytes){let c=0xffffffff;for(const byte of bytes)c=crcTable[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0}

/** Inspect the actual browser PNG stream, including CRCs and decoded scanlines. */
export function inspectPng(bytes,expectedWidth,expectedHeight){
 if(!Buffer.isBuffer(bytes))bytes=Buffer.from(bytes);
 if(!bytes.subarray(0,8).equals(signature))throw Error('Invalid PNG signature');
 let offset=8,width,height,channels,ended=false;const idat=[];
 while(offset<bytes.length){
  if(offset+12>bytes.length)throw Error('Truncated PNG chunk');
  const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8),end=offset+12+length;
  if(end>bytes.length)throw Error('Truncated PNG payload');
  if(crc32(bytes.subarray(offset+4,end-4))!==bytes.readUInt32BE(end-4))throw Error('PNG CRC mismatch');
  const data=bytes.subarray(offset+8,end-4);
  if(type==='IHDR'){
   if(offset!==8||length!==13)throw Error('Invalid PNG header');
   width=data.readUInt32BE(0);height=data.readUInt32BE(4);
   channels=data[9]===6?4:data[9]===2?3:0;
   if(!width||!height||width>16384||height>16384||data[8]!==8||!channels||data[10]||data[11]||data[12])throw Error('Unsupported capture PNG format');
  }else if(type==='IDAT')idat.push(data);
  else if(type==='IEND'){if(length!==0||end!==bytes.length)throw Error('Invalid PNG ending');ended=true}
  offset=end;
 }
 if(!ended||!width||!idat.length)throw Error('Incomplete PNG');
 if(width!==expectedWidth||height!==expectedHeight)throw Error(`PNG dimensions ${width}x${height} do not match ${expectedWidth}x${expectedHeight}`);
 const stride=width*channels+1,decoded=inflateSync(Buffer.concat(idat),{maxOutputLength:stride*height});
 if(decoded.length!==stride*height)throw Error('Invalid PNG scanline length');
 for(let y=0;y<height;y++)if(decoded[y*stride]>4)throw Error('Invalid PNG filter');
 return {width,height,sizeBytes:bytes.length,sha256:sha256(bytes)};
}

export function sourceIdentity(root=process.cwd()){
 const files=['index.html','package.json','package-lock.json','vite.config.ts','public/assets/manifest.json','scripts/control/capture-integrity.mjs'];
 function walk(dir){for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const file=dir+'/'+entry.name;if(entry.isDirectory())walk(file);else if(!file.endsWith('.test.ts'))files.push(file)}}
 walk('src');
 return sha256(Buffer.from(files.sort().map(file=>file+'\0'+sha256(fs.readFileSync(path.join(root,file)))).join('\n')));
}

export async function assertCaptureHealthy(page,errors,requests,identity){
 const checkEvents=()=>{if(errors.length||requests.length)throw Error('Capture health failed: '+JSON.stringify({errors,failedRequests:requests}))};
 checkEvents();
 const state=await page.evaluate(()=>({ready:window.lastLightBay?.ready===true,error:window.lastLightBay?.error??null,build:window.lastLightBay?.build}));
 checkEvents();
 if(!state.ready||state.error)throw Error('Capture scene unavailable: '+(state.error||'not ready'));
 if(state.build?.production!==true||state.build.sourceIdentity!==identity)throw Error('The loaded production build does not match the source being captured');
}
