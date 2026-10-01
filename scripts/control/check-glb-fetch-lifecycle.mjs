// One local browser, no WebGL: real Three GLTF parsing and exact asset transport.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {captureGlbManifest,installCaptureGlbFetch} from './progress-glb-fetch.mjs';
import {trackCaptureRequests} from './progress-network.mjs';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),dist=path.join(root,'dist');
const output=path.join(root,'artifacts/refinement-2026-09-30/glb-fetch-lifecycle');
const expected=captureGlbManifest(dist);
const html=`<!doctype html><meta charset="utf-8"><title>GLB transport probe</title><link rel="icon" href="data:,">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script><script type="module">
import * as THREE from 'three';
import {GLTFLoader} from '/three/examples/jsm/loaders/GLTFLoader.js';
window.runGlbProbe=async()=>{
 const rows=[],loader=new GLTFLoader();
 const assets=['island-tree-hero.glb','island-tree-medium.glb','syringa-tree-near.glb','palm-tree.glb'];
 for(let round=0;round<3;round++)for(const name of assets){
  let lastGc=0,gcCalls=0;
  const gltf=await loader.loadAsync('/assets/models/'+name+'?round='+round,()=>{
   if(round>0&&typeof globalThis.gc==='function'&&performance.now()-lastGc>20){globalThis.gc();lastGc=performance.now();gcCalls++;}
  });
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(gltf.parser.json)))),v=>v.toString(16).padStart(2,'0')).join('');
  let meshes=0,vertices=0,triangles=0;const geometries=new Set(),materials=new Set(),textures=new Set(),images=new Set();
  gltf.scene.traverse(object=>{if(object.isMesh){meshes++;vertices+=object.geometry.attributes.position.count;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture){textures.add(value);if(value.image)images.add(value.image);}}}});
  rows.push({name,round,meshes,vertices,triangles,jsonSha256:hash,images:[...images].map(image=>[image.width,image.height]),gcCalls});
  geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());textures.forEach(value=>value.dispose());images.forEach(value=>value.close?.());
 }
 return{threeRevision:THREE.REVISION,rows,webglContexts:0,canvasElements:document.querySelectorAll('canvas').length,gcExposed:typeof globalThis.gc==='function',delivery:globalThis.__bayCaptureGlbDelivery??null};
};
window.runNegativeGlbProbe=async()=>{
 const rows=[];
 for(const scenario of ['tampered','truncated','http-error','aborted']){
  try{const controller=new AbortController();if(scenario==='aborted')controller.abort();await fetch('/assets/models/palm-tree.glb?case='+scenario,{signal:controller.signal});rows.push({scenario,rejected:false});}
  catch(error){rows.push({scenario,rejected:true,error:String(error)});}
 }
 return {rows,delivery:globalThis.__bayCaptureGlbDelivery};
};
</script>`;
const server=http.createServer((req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html'}).end(html);return;}
  const file=url.pathname.startsWith('/three/')?path.join(root,'node_modules',url.pathname.slice(1)):path.join(dist,url.pathname.slice(1));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const bytes=fs.readFileSync(file),scenario=url.searchParams.get('case');
  if(scenario==='http-error'){res.writeHead(503,{'content-type':'text/plain'}).end('deliberate negative control');return;}
  res.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':'application/octet-stream','content-length':bytes.length,'cache-control':'no-store',...(scenario==='truncated'?{'connection':'close'}:{})});
  if(scenario==='truncated')res.end(bytes.subarray(0,Math.floor(bytes.length/2)));
  else if(scenario==='tampered'){const altered=Buffer.from(bytes);altered[altered.length-1]^=1;res.end(altered);}
  else res.end(bytes);
 }catch(error){res.writeHead(500).end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));fs.mkdirSync(output,{recursive:true});
let browser;const results={expected,conditions:'Actual Three 185 GLTFLoader, four production GLBs, three rounds; rounds 1/2 request GC during progress, no renderer/canvas/WebGL created',modes:[]};
try{
 browser=await chromium.launch({executablePath:process.env.BAY_BROWSER_EXECUTABLE||'/workspace/scratch/46479389b383/forest-capture-runtime/browser/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-webgl','--js-flags=--expose-gc']});
 for(const buffered of [false,true]){
  const page=await browser.newPage(),failedRequests=[],diagnostics={},errors=[],consoleErrors=[];
  results.pendingMode={buffered,failedRequests,diagnostics,errors,consoleErrors};
  const tracker=trackCaptureRequests(page,{failedRequests,diagnostics,getStage:()=>buffered?'buffered-probe':'original-probe'});
  page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  if(buffered)await page.addInitScript(installCaptureGlbFetch,expected);
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load'});
  if(errors.length||consoleErrors.length||failedRequests.length)throw Error('Probe bootstrap failed: '+JSON.stringify({errors,consoleErrors,failedRequests}));
  await page.waitForFunction(()=>typeof window.runGlbProbe==='function');
  const started=Date.now(),result=await page.evaluate(()=>window.runGlbProbe());await tracker.waitForIdle();
  const row={buffered,elapsedMilliseconds:Date.now()-started,...result,failedRequests:[...failedRequests],errors:[...errors],consoleErrors:[...consoleErrors],diagnostics};
  results.modes.push(row);assert.equal(result.canvasElements,0);assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
  if(buffered){
   assert.deepEqual(failedRequests,[],'Fully drained GLBs must have no raw failed requests');assert.equal(result.delivery.records.length,12);assert.deepEqual(result.delivery.failures,[]);
   const strip=rows=>rows.map(({gcCalls,...value})=>value);assert.deepEqual(strip(result.rows),strip(results.modes[0].rows),'Actual parsed geometry/JSON/image dimensions must agree');
   results.negative=await page.evaluate(()=>window.runNegativeGlbProbe());await tracker.waitForIdle();
   assert.ok(results.negative.rows.every(item=>item.rejected));assert.equal(results.negative.delivery.failures.length,4);results.negative.rawFailedRequests=failedRequests.slice(row.failedRequests.length);
  }
  await page.close();tracker.dispose();
 }
 delete results.pendingMode;
 results.ok=true;fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify({ok:true,output,modes:results.modes.map(value=>({buffered:value.buffered,loads:value.rows.length,failedRequests:value.failedRequests.length,milliseconds:value.elapsedMilliseconds})),negative:results.negative.rows}));
}catch(error){results.error=String(error);fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify(results,null,2)+'\n');throw error;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
