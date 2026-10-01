// CPU checks are the default. --gpu requires the team's exclusive tiny GPU slot.
// One 128px WebGL context, bounded synthetic work; never imports the full scene.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {waitForProfilingFence} from '../../src/render/profiling-sync.ts';

async function cpuChecks(){
 let checks=0;
 function mock(options={}){
  let polls=0,created=0,deleted=0,flushed=false;
  const sync={};
  const gl={NO_ERROR:0,SYNC_GPU_COMMANDS_COMPLETE:1,ALREADY_SIGNALED:2,CONDITION_SATISFIED:3,TIMEOUT_EXPIRED:4,WAIT_FAILED:5,
   isContextLost:()=>Boolean(options.lostBefore||options.lostAfterFlush&&flushed),
   getError:()=>options.errorBefore?1280:options.errorAfterFlush&&flushed?1282:0,
   fenceSync:(condition,flags)=>{assert.equal(condition,1);assert.equal(flags,0);created++;return options.nullSync?null:sync;},
   flush:()=>{flushed=true;},
   clientWaitSync:(value,flags,timeout)=>{assert.equal(value,sync);assert.equal(flags,0);assert.equal(timeout,0);polls++;return options.status??(polls===1?4:2);},
   deleteSync:value=>{assert.equal(value,sync);deleted++;},
  };
  return {gl,state:()=>({polls,created,deleted,flushed})};
 }
 const pass=mock();const pending=waitForProfilingFence(pass.gl,{pollMilliseconds:0});
 assert.equal(pass.state().polls,0,'Must return to the event loop before first poll');
 assert.equal((await pending).polls,2);assert.equal(pass.state().deleted,1);checks++;
 for(const [options,pattern,created,deleted]of [
  [{errorBefore:true},/before fence/,0,0],
  [{lostBefore:true},/context lost/,0,0],
  [{nullSync:true},/creation returned null/,1,0],
  [{errorAfterFlush:true},/flush/,1,1],
  [{lostAfterFlush:true},/context lost/,1,1],
  [{status:5},/wait failed/,1,1],
  [{status:999},/unexpected status/,1,1],
  [{status:4},/timed out/,1,1],
 ]){
  const test=mock(options);
  await assert.rejects(waitForProfilingFence(test.gl,{timeoutMilliseconds:2,pollMilliseconds:0}),pattern);
  assert.equal(test.state().created,created);assert.equal(test.state().deleted,deleted);checks++;
 }
 for(const options of [{timeoutMilliseconds:0},{timeoutMilliseconds:Infinity},{pollMilliseconds:-1}]){
  const test=mock();await assert.rejects(waitForProfilingFence(test.gl,options),/must be/);assert.equal(test.state().created,0);checks++;
 }
 return {ok:true,checks,scope:'CPU lifecycle/error checks; no GPU timing claim'};
}

const html=String.raw`<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><canvas id="world"></canvas>
<script type="importmap">{"imports":{"three":"/three.module.js"}}</script><script type="module">
import * as THREE from 'three';
import {waitForProfilingFence} from '/profiling-sync.js';
window.runProfilingProbe=async()=>{
 const canvas=document.getElementById('world'),size=128;
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
 renderer.setPixelRatio(1);renderer.setSize(size,size,false);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
 const gl=renderer.getContext(),shaderErrors=[];
 renderer.debug.onShaderError=(context,program,vertex,fragment)=>shaderErrors.push([context.getProgramInfoLog(program),context.getShaderInfoLog(vertex),context.getShaderInfoLog(fragment)].filter(Boolean).join('\n'));
 const target=new THREE.WebGLRenderTarget(size,size,{samples:4,depthBuffer:false});
 const camera=new THREE.Camera(),scene=new THREE.Scene();
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
 const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
  uniforms:{uPhase:{value:0}},vertexShader:'varying vec2 vUv; void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position,1.);}',
  fragmentShader:'varying vec2 vUv; uniform float uPhase; void main(){vec3 value=vec3(vUv,.47+uPhase);for(int i=0;i<128;i++){value=fract(value.yzx*vec3(1.173,1.097,1.061)+vec3(.019,.023,.017));}gl_FragColor=vec4(.1+.8*value,1.);}'});
 scene.add(new THREE.Mesh(geometry,material));
 const display=new THREE.Scene(),displayMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{tInput:{value:target.texture}},
  vertexShader:'varying vec2 vUv; void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position,1.);}',
  fragmentShader:'varying vec2 vUv; uniform sampler2D tInput; void main(){gl_FragColor=texture2D(tInput,vUv);}'});
 display.add(new THREE.Mesh(geometry,displayMaterial));
 const assert=(value,message)=>{if(!value)throw Error(message);};
 const same=(a,b)=>a.length===b.length&&a.every((value,i)=>value===b[i]);
 function errors(label){assert(!gl.isContextLost(),'Context lost '+label);const error=gl.getError();assert(error===gl.NO_ERROR,'WebGL error '+error+' '+label);assert(!shaderErrors.length,shaderErrors.join('\n'));}
 function snapshot(){return{
  target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),
  read:gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),draw:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),readBuffer:gl.getParameter(gl.READ_BUFFER),
  pbo:gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING),alignment:gl.getParameter(gl.PACK_ALIGNMENT),row:gl.getParameter(gl.PACK_ROW_LENGTH),skipRows:gl.getParameter(gl.PACK_SKIP_ROWS),skipPixels:gl.getParameter(gl.PACK_SKIP_PIXELS),
  viewport:Array.from(gl.getParameter(gl.VIEWPORT)),scissor:Array.from(gl.getParameter(gl.SCISSOR_BOX)),scissorTest:gl.isEnabled(gl.SCISSOR_TEST),
  colorMask:Array.from(gl.getParameter(gl.COLOR_WRITEMASK)),depthMask:gl.getParameter(gl.DEPTH_WRITEMASK),clear:Array.from(gl.getParameter(gl.COLOR_CLEAR_VALUE)),
 };}
 function equalState(before,after){for(const key of Object.keys(before))assert(Array.isArray(before[key])?same(before[key],after[key]):before[key]===after[key],'State changed: '+key);}
 function readCanvas(){assert(renderer.getRenderTarget()===null,'Read requires canvas');const pixels=new Uint8Array(size*size*4);gl.readPixels(0,0,size,size,gl.RGBA,gl.UNSIGNED_BYTE,pixels);errors('read canvas');return pixels;}
 function drawWork(draws,offscreen){renderer.setRenderTarget(offscreen?target:null);for(let i=0;i<draws;i++){material.uniforms.uPhase.value=i*.03125;renderer.render(scene,camera);}if(offscreen){renderer.setRenderTarget(null);renderer.render(display,camera);}}
 const rows=[],stateChecks=[];
 try{
  // Compile and allocate before timing. This probe studies completion, not startup.
  drawWork(1,false);drawWork(1,true);await waitForProfilingFence(gl);canvas.toDataURL();
  const extension=gl.getExtension('WEBGL_debug_renderer_info'),rendererName=extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  const samples=gl.getParameter(gl.SAMPLES);assert(samples===4,'Expected four canvas samples, got '+samples);
  // ABBA order helps expose warm-up drift. End-to-end means draw + barrier + PNG.
  for(const offscreen of [false,true])for(const draws of [16,48]){
   let reference;
   for(const method of ['finish','fence','fence','finish']){
    await waitForProfilingFence(gl);
    const start=performance.now();drawWork(draws,offscreen);const submitted=performance.now();
    const barrier=method==='fence'?await waitForProfilingFence(gl):null;if(method==='finish')gl.finish();
    const completed=performance.now(),png=canvas.toDataURL('image/png'),serialized=performance.now();
    const pixels=readCanvas();if(reference)assert(same(reference,pixels),'Barrier method changed canvas bytes');else reference=pixels;
    rows.push({offscreen,draws,method,submitMilliseconds:submitted-start,barrierMilliseconds:completed-submitted,
     serializationMilliseconds:serialized-completed,totalMilliseconds:serialized-start,fence:barrier,pngBytes:png.length,byteIdentical:true});
   }
  }
  // State invariance with adversarial pack/PBO state and an actual MSAA target.
  drawWork(2,false);await waitForProfilingFence(gl);const beforePixels=readCanvas(),beforePNG=canvas.toDataURL('image/png');
  const packBuffer=gl.createBuffer();gl.bindBuffer(gl.PIXEL_PACK_BUFFER,packBuffer);gl.bufferData(gl.PIXEL_PACK_BUFFER,4096,gl.STREAM_READ);
  gl.pixelStorei(gl.PACK_ALIGNMENT,8);gl.pixelStorei(gl.PACK_ROW_LENGTH,13);gl.pixelStorei(gl.PACK_SKIP_ROWS,2);gl.pixelStorei(gl.PACK_SKIP_PIXELS,3);
  gl.colorMask(true,false,true,false);gl.depthMask(false);renderer.setViewport(3,5,91,89);renderer.setScissor(7,9,73,71);renderer.setScissorTest(true);
  for(const offscreen of [false,true]){
   renderer.setRenderTarget(offscreen?target:null);const before=snapshot();await waitForProfilingFence(gl);equalState(before,snapshot());stateChecks.push({offscreen,unchanged:true});
  }
  renderer.setRenderTarget(null);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);gl.deleteBuffer(packBuffer);
  gl.pixelStorei(gl.PACK_ALIGNMENT,4);gl.pixelStorei(gl.PACK_ROW_LENGTH,0);gl.pixelStorei(gl.PACK_SKIP_ROWS,0);gl.pixelStorei(gl.PACK_SKIP_PIXELS,0);
  gl.colorMask(true,true,true,true);gl.depthMask(true);renderer.setViewport(0,0,size,size);renderer.setScissorTest(false);
  assert(same(beforePixels,readCanvas()),'Fence altered RGB/alpha');assert(beforePNG===canvas.toDataURL('image/png'),'Fence altered encoded canvas');
  errors('all valid cases');
  // Expected errors are checked only after timing, never hidden inside a result.
  gl.enable(0xdead);let expectedError='';try{await waitForProfilingFence(gl);}catch(error){expectedError=String(error);}
  assert(expectedError.includes('before fence'),'Pre-existing WebGL error was not rejected');errors('after consumed expected error');
  const png=canvas.toDataURL('image/png');
  const lose=gl.getExtension('WEBGL_lose_context');let contextLossRejected=false;
  if(lose){canvas.addEventListener('webglcontextlost',event=>event.preventDefault());lose.loseContext();await new Promise(resolve=>setTimeout(resolve,0));try{await waitForProfilingFence(gl);}catch(error){contextLossRejected=String(error).includes('context lost');}assert(contextLossRejected,'Lost context was not rejected');}
  return{ok:true,size,samples,renderer:rendererName,threeRevision:THREE.REVISION,rows,stateChecks,
   expectedError,contextLossRejected,shaderErrors,png,
   limits:['Synthetic workload only; no full-scene bottleneck claim','Fence wall time includes JS scheduling and driver/IPC waits','Canvas export can still incur resolve/copy/PNG work after GPU fence completion']};
 }finally{target.dispose();material.dispose();displayMaterial.dispose();geometry.dispose();renderer.dispose();}
};
</script>`;

async function gpuProbe(){
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const output=path.join(root,'artifacts/refinement-2026-09-30/profiling-sync');
 const [{chromium},{default:ts}]=await Promise.all([import('playwright'),import('typescript')]);
 const helper=await fs.readFile(path.join(root,'src/render/profiling-sync.ts'),'utf8');
 const helperJS=ts.transpileModule(helper,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const routes=new Map([['/',{type:'text/html',body:html}],['/profiling-sync.js',{type:'text/javascript',body:helperJS}]]);
 for(const name of ['three.module.js','three.core.js'])routes.set('/'+name,{type:'text/javascript',body:await fs.readFile(path.join(root,'node_modules/three/build',name))});
 const server=http.createServer((req,res)=>{const route=routes.get(new URL(req.url,'http://localhost').pathname);if(!route){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':route.type,'cache-control':'no-store'}).end(route.body);});
 await fs.mkdir(output,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;const pageErrors=[],consoleErrors=[],requestFailures=[];
 try{
  browser=await chromium.launch({executablePath:process.env.BAY_BROWSER_EXECUTABLE||'/workspace/scratch/46479389b383/forest-capture-runtime/browser/chromium',headless:true,timeout:120000,
   args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--force-color-profile=srgb']});
  const page=await browser.newPage({viewport:{width:128,height:128},deviceScaleFactor:1});
  page.on('pageerror',error=>pageErrors.push(String(error)));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});page.on('requestfailed',request=>requestFailures.push({url:request.url(),failure:request.failure()}));
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof window.runProfilingProbe==='function');
  console.log('Running one bounded 128px fence probe');const start=Date.now(),result=await page.evaluate(()=>window.runProfilingProbe());
  await fs.writeFile(path.join(output,'fixture.png'),Buffer.from(result.png.split(',')[1],'base64'));delete result.png;
  Object.assign(result,{elapsedMilliseconds:Date.now()-start,pageErrors,consoleErrors,requestFailures,sourceSHA256:createHash('sha256').update(helper).digest('hex')});
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2)+'\n');
  assert.equal(result.ok,true);assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(requestFailures,[]);
  console.log(JSON.stringify({ok:true,output,elapsedMilliseconds:result.elapsedMilliseconds,rows:result.rows.length,stateChecks:result.stateChecks.length}));
 }catch(error){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({error:String(error),pageErrors,consoleErrors,requestFailures},null,2)+'\n');throw error;}
 finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}

console.log(JSON.stringify(await cpuChecks()));
if(process.argv.includes('--gpu'))await gpuProbe();
