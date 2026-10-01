import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {deflateSync} from 'node:zlib';
import {EventEmitter} from 'node:events';
import {parseOptions,browserCapture,runProgressCapture} from '../progress-capture.mjs';
import {makeVideoContract,openVideoCheckpoint} from './progress-checkpoints.mjs';
import {crc32} from './capture-integrity.mjs';
import {captureLaunchOptions,assertHardwareGraphics,assertHardwareGraphicsMatch,probeHardwareWebGL2} from './progress-backend.mjs';

const hardware={available:true,backend:'hardware',version:'WebGL 2.0 (OpenGL ES 3.0 Chromium)',
 renderer:'ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)',
 unmaskedRendererAvailable:true,samples:4};

test('backend CLI preserves legacy software launch and chooses sandboxed full Chromium for hardware',()=>{
 const legacy=parseOptions(['video','width=8','height=4','duration=.5','fps=4']);
 assert.equal(legacy.backend,'software');assert.equal(Object.hasOwn(legacy.contract,'backend'),false);
 const local=parseOptions(['video','width=8','height=4','duration=.5','fps=4','backend=hardware']);
 assert.equal(local.backend,'hardware');assert.equal(local.contract.backend,'hardware');
 for(const backend of ['','auto','Hardware','gpu','false'])assert.throws(()=>parseOptions(['backend='+backend]),/backend must be/);
 const original={executablePath:undefined,headless:true,timeout:120000,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--force-color-profile=srgb']};
 assert.deepEqual(captureLaunchOptions(),original);
 const launch=captureLaunchOptions({backend:'hardware'});
 assert.equal(launch.channel,'chromium');assert.equal(launch.chromiumSandbox,true);
 assert.deepEqual(launch.ignoreDefaultArgs,['--enable-unsafe-swiftshader']);
 assert.deepEqual(launch.args,['--force-color-profile=srgb']);
 const custom=captureLaunchOptions({backend:'hardware',executablePath:'/local/chrome',jsHeapMiB:512});
 assert.equal(custom.executablePath,'/local/chrome');assert.equal(custom.channel,undefined);
 assert.deepEqual(custom.args,['--force-color-profile=srgb','--js-flags=--max-old-space-size=512']);
});

test('hardware evidence rejects unavailable, masked and known software renderers without silently accepting fallback',()=>{
 for(const renderer of [hardware.renderer,'ANGLE (Intel, Intel Iris Xe Direct3D11 vs_5_0 ps_5_0, D3D11)','ANGLE (NVIDIA, NVIDIA GeForce RTX 4060, OpenGL 4.5)'])assert.equal(assertHardwareGraphics({...hardware,renderer}).renderer,renderer);
 for(const value of [null,{available:false,reason:'context denied'},{...hardware,version:'WebGL 1.0'},
  {...hardware,unmaskedRendererAvailable:false},...['','unknown','WebKit WebGL','ANGLE',
   'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))','llvmpipe (LLVM 20, 256 bits)',
   'Mesa softpipe','lavapipe','swrast','Microsoft Basic Render Driver','Microsoft WARP','Software Rasterizer'].map(renderer=>({...hardware,renderer}))])assert.throws(()=>assertHardwareGraphics(value),/Hardware capture/);
});

test('preflight inspects only a tiny context and releases it even when renderer access fails',()=>{
 for(const fail of [false,true]){
  let lost=0,removed=0;const ext={UNMASKED_RENDERER_WEBGL:10,UNMASKED_VENDOR_WEBGL:11};
  const gl={VERSION:1,RENDERER:2,VENDOR:3,SAMPLES:4,getExtension:name=>name==='WEBGL_debug_renderer_info'?ext:{loseContext:()=>{lost++;}},
   getParameter:key=>{if(fail)throw Error('query failed');return({1:hardware.version,10:hardware.renderer,11:'Apple',4:4})[key];}};
  const canvas={getContext:(kind,options)=>{assert.equal(kind,'webgl2');assert.equal(options.powerPreference,'high-performance');return gl;},remove:()=>{removed++;}};
  const result=vm.runInNewContext('('+probeHardwareWebGL2.toString()+')()',{document:{createElement:name=>{assert.equal(name,'canvas');return canvas;}}});
  assert.equal(canvas.width,16);assert.equal(canvas.height,16);assert.equal(lost,1);assert.equal(removed,1);
  if(fail){assert.equal(result.available,false);assert.match(result.reason,/query failed/);}else assertHardwareGraphics(result);
 }
});

test('injected hardware preflight runs before scene navigation, rejects changed GPUs and closes only its resources on failure',async()=>{
 for(const scenario of ['software','match','gpu-mismatch']){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bay-backend-'));fs.mkdirSync(path.join(root,'assets'));
  let navigated=0,contextClosed=0,browserClosed=0,serverClosed=0,probed=0;
  const diagnostics={},page=new EventEmitter();
  Object.assign(page,{setDefaultTimeout:()=>{},url:()=> 'about:blank',addInitScript:async()=>{},
   goto:async()=>{navigated++;assert.equal(probed,1);throw Error('fixture stopped before scene load');},
   evaluate:async fn=>{if(fn===probeHardwareWebGL2){probed++;return scenario==='software'?{...hardware,renderer:'SwiftShader'}:{...hardware};}return {fixture:true};}});
  const context={newPage:async()=>page,close:async()=>{contextClosed++;}};
  try{
   await assert.rejects(browserCapture({directory:root,width:8,height:4,readyTimeout:100,backend:'hardware',errors:[],failedRequests:[],diagnostics,
    ...(scenario==='gpu-mismatch'?{expectedGraphics:{...hardware,renderer:'ANGLE (NVIDIA, GeForce RTX 4060, OpenGL 4.5)'}}:{})},{
    serve:async()=>({url:'http://fixture',close:async()=>{serverClosed++;}}),
    launchBrowser:async launch=>{assert.equal(launch.chromiumSandbox,true);return{newContext:async()=>context,close:async()=>{browserClosed++;}};},
   }),scenario==='match'?/fixture stopped before scene load/:scenario==='software'?/rejected software renderer/:/graphics mismatch for renderer/);
   assert.equal(navigated,scenario==='match'?1:0);assert.equal(probed,1);assert.equal(contextClosed,1);assert.equal(browserClosed,1);assert.equal(serverClosed,1);
   assert.equal(diagnostics.hardwarePreflight.renderer,scenario==='software'?'SwiftShader':hardware.renderer);
   if(scenario!=='match')assert.equal(diagnostics.failingStage,'hardware-webgl2-preflight');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
 }
});

test('backend checkpoint identity preserves legacy software and rejects both cross-backend resumes without altering the manifest',()=>{
 for(const originalBackend of ['software','hardware']){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bay-backend-contract-')),dist=path.join(root,'dist'),output=path.join(root,'out');
  fs.mkdirSync(dist);fs.writeFileSync(path.join(dist,'index.html'),'fixture');
  try{
   const base={width:8,height:4,fps:4,duration:.5},contract=makeVideoContract({...base,backend:originalBackend});
   const first=openVideoCheckpoint({output,dist,contract});first.release();
   const file=path.join(output,'manifest.json'),before=fs.readFileSync(file);
   if(originalBackend==='software')assert.equal(Object.hasOwn(JSON.parse(before).contract,'backend'),false);
   assert.throws(()=>openVideoCheckpoint({output,dist,contract:makeVideoContract({...base,backend:originalBackend==='hardware'?'software':'hardware'}),resume:true}),/settings or timeline mismatch/);
   assert.deepEqual(fs.readFileSync(file),before);
   const same=openVideoCheckpoint({output,dist,contract,resume:true});same.release();
  }finally{fs.rmSync(root,{recursive:true,force:true});}
 }
});

test('programmatic captures cannot launch hardware against a software contract',async()=>{
 const contract=makeVideoContract({width:8,height:4,fps:4,duration:.5});
 await assert.rejects(runProgressCapture({video:true,backend:'hardware',contract},{captureFactory:async()=>{throw Error('must not launch');}}),/backend does not match/);
});

test('hardware resume compares renderer, version, samples and backend',()=>{
 assertHardwareGraphicsMatch({...hardware},hardware);
 for(const [key,value]of [['renderer','ANGLE (Intel, Iris Xe, D3D11)'],['version','WebGL 2.0 changed'],['samples',0],['backend','software']])assert.throws(()=>assertHardwareGraphicsMatch({...hardware,[key]:value},hardware),/Hardware checkpoint/);
 assert.throws(()=>assertHardwareGraphicsMatch(hardware,undefined),/Hardware capture/);
});

test('hardware checkpoint keeps prior graphics on mismatch and resumes its prefix with the same graphics',async()=>{
 function png(){
  const chunk=(type,data)=>{const header=Buffer.alloc(8),crc=Buffer.alloc(4);header.writeUInt32BE(data.length);header.write(type,4);crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type),data])));return Buffer.concat([header,data,crc]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(8);header.writeUInt32BE(4,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc(33*4))),chunk('IEND',Buffer.alloc(0))]);
 }
 for(const changed of [false,true]){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bay-hardware-resume-')),dist=path.join(root,'dist'),output=path.join(root,'out');
  fs.mkdirSync(dist);fs.writeFileSync(path.join(dist,'index.html'),'fixture');
  const options=parseOptions(['video','backend=hardware','width=8','height=4','fps=4','duration=.5','out=out','resume'],root);
  const build={production:true,sourceIdentity:'a'.repeat(64)},stats=time=>({ready:true,quality:'high',sourceIdentity:build.sourceIdentity,time});
  let rendered=0,closed=0;
  try{
   const prefix=openVideoCheckpoint({output,dist,contract:options.contract});prefix.bindBuild(build);prefix.update({graphics:hardware});prefix.appendFrame(0,png(),stats(0));prefix.release();
   const captureFactory=async({expectedGraphics})=>{
    assert.deepEqual(expectedGraphics,hardware);
    return{build,graphics:changed?{...hardware,samples:0}:{...hardware},offlineAfterLoad:true,healthy:async()=>{},applySettings:async()=>{},
     renderFrame:async entry=>{rendered++;return{bytes:png(),stats:stats(Number(entry.view))};},close:async()=>{closed++;}};
   };
   const result=runProgressCapture(options,{captureFactory,log:()=>{}});
   if(changed)await assert.rejects(result,/graphics mismatch for samples/);else assert.equal((await result).frames,2);
   const manifest=JSON.parse(fs.readFileSync(path.join(output,'manifest.json')));
   assert.deepEqual(manifest.graphics,hardware);assert.deepEqual(manifest.build,build);assert.equal(manifest.frames.length,changed?1:2);
   assert.equal(rendered,changed?0:1);assert.equal(closed,1);assert.equal(manifest.captureSucceeded,!changed);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
 }
});
