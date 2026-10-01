import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Hash only served GLBs. No scene/source mutation or response rewriting on disk. */
export function captureGlbManifest(directory){
 const assets=path.join(directory,'assets'),manifest={},buffer=Buffer.allocUnsafe(1024*1024);
 function walk(relative){
  for(const name of fs.readdirSync(path.join(directory,relative)).sort()){
   const child=relative+'/'+name,file=path.join(directory,child),stat=fs.lstatSync(file);
   if(stat.isSymbolicLink())throw Error('Capture GLB inventory refuses symlink: '+child);
   if(stat.isDirectory())walk(child);
   else if(stat.isFile()&&name.endsWith('.glb')){
    // The inventory retains only hashes. A fixed buffer avoids leaving several
    // complete source GLBs pending garbage collection before browser startup.
    const hash=crypto.createHash('sha256'),fd=fs.openSync(file,'r');let sizeBytes=0;
    try{for(let count;(count=fs.readSync(fd,buffer,0,buffer.length,null))>0;){hash.update(buffer.subarray(0,count));sizeBytes+=count;}}
    finally{fs.closeSync(fd);}
    if(sizeBytes!==stat.size)throw Error('Capture GLB changed size while hashing: '+child);
    manifest['/'+child.split('/').map(encodeURIComponent).join('/')]={sizeBytes,sha256:hash.digest('hex')};
   }
  }
 }
 if(fs.existsSync(assets))walk('assets');return manifest;
}

/** Serialized into the capture page before production modules load. Three's
 * FileLoader receives an ordinary Response over verified, completely drained
 * bytes, rather than owning the browser's live network stream indirectly.
 * Deliberately scoped to same-origin asset GLB GETs; all failures remain fatal.
 */
export function installCaptureGlbFetch(expected){
 const originalFetch=globalThis.fetch.bind(globalThis);
 const delivery={version:1,mode:'drain-and-verify-glb-before-three',records:[],failures:[]};
 Object.defineProperty(globalThis,'__bayCaptureGlbDelivery',{value:delivery,configurable:false});
 const add=(key,value)=>{delivery[key].push(value);if(delivery[key].length>128)delivery[key].shift();};
 globalThis.fetch=async function(input,init){
  const requestUrl=input instanceof Request?input.url:String(input),method=String(init?.method??(input instanceof Request?input.method:'GET')).toUpperCase();
  const url=new URL(requestUrl,location.href);
  if(method!=='GET'||url.origin!==location.origin||!url.pathname.startsWith('/assets/')||!url.pathname.endsWith('.glb'))return originalFetch(input,init);
  const startedAt=new Date().toISOString();
  try{
   const response=await originalFetch(input,init);
   if(response.status!==200)throw Error('Capture GLB HTTP status '+response.status+': '+url.pathname);
   const reference=expected[url.pathname];if(!reference)throw Error('Capture GLB missing from served-file inventory: '+url.pathname);
   const bytes=await response.arrayBuffer();
   const digest=await crypto.subtle.digest('SHA-256',bytes);
   const hash=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
   if(bytes.byteLength!==reference.sizeBytes||hash!==reference.sha256)throw Error('Capture GLB byte integrity mismatch: '+url.pathname);
   const buffered=new Response(bytes,{status:response.status,statusText:response.statusText,headers:response.headers});
   for(const key of ['url','redirected','type'])Object.defineProperty(buffered,key,{value:response[key]});
   add('records',{url:url.href,path:url.pathname,status:response.status,sizeBytes:bytes.byteLength,sha256:hash,startedAt,completedAt:new Date().toISOString()});
   return buffered;
  }catch(error){add('failures',{url:url.href,path:url.pathname,startedAt,failedAt:new Date().toISOString(),error:String(error)});throw error;}
 };
}
