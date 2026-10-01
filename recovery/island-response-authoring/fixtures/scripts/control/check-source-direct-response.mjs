// Isolated pilot; production imports none of these study modules.
// CPU: node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-source-direct-response.mjs
// GPU: same command with --gpu, only in an explicitly authorized tiny GPU window.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzip} from 'node:zlib';
import {promisify} from 'node:util';
import * as THREE from 'three';
import {createTreeImpostor} from '../../src/world/tree-impostor.ts';
import {treeImpostorDefinitions} from '../../src/world/tree-impostor-data.ts';
import {withCloudLighting} from '../../src/render/sky-lighting.ts';
import {pilotViews,pilotSuns,pilotPoses,responseLayer,integrateResponseTile,fixedRasterAreaReference,bindPilotDirectResponse} from './source-direct-response-pilot-helper.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function cpuChecks(){
 let checks=0;
 const data=new Float32Array([.2,0,0,.5,0,.4,0,1,0,0,.1,.25,0,0,0,0]);
 const integrated=integrateResponseTile(data,2,2,2);
 for(const [index,expected]of [.05,.1,.025,.4375].entries())assert(Math.abs(integrated[index]-expected)<1e-7);
 assert.deepEqual(integrateResponseTile(new Float32Array(16),2,2,2),new Float32Array(4));checks+=2;
 assert.throws(()=>integrateResponseTile(data,2,2,3),/dimensions/);
 const invalid=data.slice();invalid[0]=NaN;assert.throws(()=>integrateResponseTile(invalid,2,2,2),/sample/);checks+=2;
 const source4x=new Float32Array(4*4*4);source4x.set([.25,.5,1,1]);
 assert.deepEqual(Array.from(integrateResponseTile(source4x,4,4,4)),[.25/16,.5/16,1/16,1/16]);checks++;
 const area=fixedRasterAreaReference(source4x,4,2,4);assert.equal(area[4*(1*4+1)+3],.25);assert.equal(area.reduce((sum,v,i)=>sum+(i%4===3?v:0),0),.25);checks++;
 const full=new Float32Array(4*4*4).fill(1),fractional=fixedRasterAreaReference(full,4,3,3);
 assert(fractional.every(v=>v===1));assert.throws(()=>fixedRasterAreaReference(full,4,3,4),/dimensions/);checks++;
 assert.deepEqual(pilotSuns,[0,1,4,5]);assert.equal(pilotPoses.length,6);
 const layers=pilotSuns.flatMap(sun=>pilotViews.map(view=>responseLayer(view,sun)));
 assert.deepEqual(layers,Array.from({length:16},(_,i)=>i));assert.throws(()=>responseLayer(2,0),/Unbaked/);checks+=2;
 const makeTexture=()=>{const texture=new THREE.DataTexture(new Uint8Array(4*4*4).fill(255),4,4);texture.needsUpdate=true;return texture;};
 const albedo=makeTexture(),normal=makeTexture(),visibility=new THREE.DataTexture(new Uint8Array([255,255]),1,1,THREE.RGFormat);
 const mesh=createTreeImpostor(treeImpostorDefinitions[0],albedo,normal,1,visibility);withCloudLighting(mesh.material);
 const compile=(material,library)=>{const source=THREE.ShaderLib[library],shader={uniforms:THREE.UniformsUtils.clone(source.uniforms),vertexShader:source.vertexShader,fragmentShader:source.fragmentShader};material.onBeforeCompile(shader,{});return shader;};
 const depthBefore=compile(mesh.customDepthMaterial,'depth'),before=compile(mesh.material,'standard');
 const colorState={map:mesh.material.map,alphaTest:mesh.material.alphaTest,alphaHash:mesh.material.alphaHash,alphaToCoverage:mesh.material.alphaToCoverage,transparent:mesh.material.transparent};
 const response=new THREE.DataArrayTexture(new Uint16Array(16*4),1,1,16),exact=makeTexture(),ownCoverage={value:0};
 const enabled=bindPilotDirectResponse(mesh.material,response,{value:0},{exactTexture:exact,ownCoverage});
 const after=compile(mesh.material,'standard'),depthAfter=compile(mesh.customDepthMaterial,'depth');
 assert.equal(after.fragmentShader.split('vec3 pilotDirectResponse(').length,2);
 assert.equal(after.fragmentShader.split('pilotPriorDiffuse+directLight.color*pilotDirectResponse(').length,2);
 assert(after.fragmentShader.includes('RE_Direct_Physical(sourceOccludedLight, geometryPosition'));
 assert(after.fragmentShader.includes('* backCosine * transmission * transmittance;'));
 assert(after.fragmentShader.includes('impostorNormalRaw'));
 assert.equal(after.vertexShader,before.vertexShader);assert.equal(depthAfter.vertexShader,depthBefore.vertexShader);assert.equal(depthAfter.fragmentShader,depthBefore.fragmentShader);
 for(const [key,value]of Object.entries(colorState))assert.equal(mesh.material[key],value);
 assert.equal(after.uniforms.uPilotDirectResponse.value,response);assert.equal(after.uniforms.uPilotDirectResponseEnabled,enabled);checks+=4;
 assert.equal(after.uniforms.uPilotExactResponse.value,exact);assert.equal(after.uniforms.uPilotResponseOwnCoverage,ownCoverage);
 assert.equal(after.fragmentShader.split('if(uPilotResponseOwnCoverage>.5)diffuseColor.a=').length,2);
 assert(after.fragmentShader.includes('if(uPilotDirectResponseEnabled>1.5)return texture(uPilotExactResponse'));checks+=2;
 assert.equal(enabled.value,0);enabled.value=1;assert.equal(after.uniforms.uPilotDirectResponseEnabled.value,1);checks++;
 const broken=new THREE.MeshStandardMaterial();bindPilotDirectResponse(broken,response);assert.throws(()=>compile(broken,'standard'),/actual source-light hook/);checks++;
 for(const texture of new Set([albedo,normal,visibility,response,exact,mesh.material.map,...mesh.material.userData.sharedShaderTextures]))texture.dispose();
 mesh.geometry.dispose();mesh.material.dispose();mesh.customDepthMaterial.dispose();mesh.dispose();broken.dispose();
 return {ok:true,checks,source:'Actual current Three185/impostor/visibility/cloud shader hook composition; no GPU',geometryOrPixelClaim:false};
}

async function memorySnapshot(){
 const current=Number((await fs.readFile('/sys/fs/cgroup/memory.current','utf8')).trim());
 const maximum=(await fs.readFile('/sys/fs/cgroup/memory.max','utf8')).trim();
 return{at:new Date().toISOString(),currentBytes:current,currentGiB:current/2**30,maximumBytes:maximum==='max'?null:Number(maximum),nodeRssBytes:process.memoryUsage().rss};
}
async function gpuProbe(){
 const bakeIsland=process.argv.includes('--bake-island');
 const index=process.argv.indexOf('--output');
 if(bakeIsland&&index<0)throw Error('One-family authoring requires an explicit new --output directory');
 const output=index<0?path.join(root,'artifacts/refinement-2026-09-30/normal-response-audit/pilot-01'):path.resolve(process.argv[index+1]);
 await fs.mkdir(output,{recursive:true});
 try{await fs.access(path.join(output,'results.json'));throw Error('Completed output exists; use a new --output');}catch(error){if(error.code!=='ENOENT')throw error;}
 const memoryBefore=await memorySnapshot();
 if(memoryBefore.currentBytes>=6*2**30){
  await fs.writeFile(path.join(output,'launch-held.json'),JSON.stringify({reason:'Current memory is not below the authorized 6 GiB launch threshold',memoryBefore},null,2)+'\n');
  console.log(JSON.stringify({held:true,memoryBefore,output}));return;
 }
 console.log(JSON.stringify({memoryBefore,authorizedSingleContextSize:128}));
 const [{chromium},{default:ts}]=await Promise.all([import('playwright'),import('typescript')]);
 const sourceFile=path.join(root,'public/assets/models/island-tree-near.glb'),sourceSHA256=digest(await fs.readFile(sourceFile));
 const albedoSHA256=bakeIsland?digest(await fs.readFile(path.join(root,'public/assets/impostors/island-albedo.png'))):null;
 const normalSHA256=bakeIsland?digest(await fs.readFile(path.join(root,'public/assets/impostors/island-normal.png'))):null;
 const hashes={},routes=new Map();
 hashes['scripts/control/check-source-direct-response.mjs']=digest(await fs.readFile(fileURLToPath(import.meta.url)));
 const checkpointFile=path.join(output,'layer-checkpoints.json'),completedLayers=new Map();
 let checkpointHashes=null;
 async function verifySourceHashes(expected){
  for(const [filename,value]of Object.entries(expected))assert.equal(digest(await fs.readFile(path.join(root,filename))),value,'Authoring dependency changed: '+filename);
 }
 if(bakeIsland){
  let saved=null;try{saved=JSON.parse(await fs.readFile(checkpointFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(saved){
   assert.equal(saved.schema,'island-response-checkpoints-v1');await verifySourceHashes(saved.sourceHashes);checkpointHashes=saved.sourceHashes;
   for(const record of saved.layers){
    assert(Number.isInteger(record.layer)&&record.layer===record.sun*24+record.view&&record.layer>=0&&record.layer<192);
    assert(!completedLayers.has(record.layer),'Duplicate checkpoint layer');
    for(const file of [record.rawFile,record.cellFile,record.smallFile]){
     const filename=file.storedName??file.name;assert(/^[a-zA-Z0-9_.-]+$/.test(filename),'Invalid checkpoint file name');
     const bytes=await fs.readFile(path.join(output,filename));assert.equal(bytes.length,file.storedBytes??file.bytes);assert.equal(digest(bytes),file.storedSHA256??file.sha256,'Checkpoint file changed: '+filename);
    }
    completedLayers.set(record.layer,record);
   }
  }
 }
 const html='<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><canvas id="world"></canvas><script type="importmap">{"imports":{"three":"/three.module.js","three/addons/":"/three-addons/"}}</script><script type="module" src="/pilot-page.mjs"></script>';
 routes.set('/',{type:'text/html',body:Buffer.from(html)});
 async function route(url){
  if(routes.has(url))return routes.get(url);
  let filename;
  if(url==='/three.module.js'||url==='/three.core.js')filename=path.join(root,'node_modules/three/build',url.slice(1));
  else if(url.startsWith('/three-addons/'))filename=path.join(root,'node_modules/three/examples/jsm',url.slice('/three-addons/'.length));
  else if(url==='/pilot-helper.mjs'||url==='/source-direct-response-pilot-helper.mjs')filename=path.join(root,'scripts/control/source-direct-response-pilot-helper.mjs');
  else if(url==='/pilot-page.mjs')filename=path.join(root,'scripts/control/source-direct-response-pilot-page.mjs');
  else if(url==='/island-bake.mjs')filename=path.join(root,'scripts/control/source-island-response-bake.mjs');
  else if(url.startsWith('/src/')&&url.endsWith('.ts'))filename=path.join(root,url.slice(1));
  else if(url.startsWith('/assets/'))filename=path.join(root,'public',url.slice(1));
  else return null;
  if(!filename.startsWith(root))return null;
  let body=await fs.readFile(filename);hashes[path.relative(root,filename)]=digest(body);
  if(filename.endsWith('.ts')){
   body=Buffer.from(ts.transpileModule(body.toString(),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/((?:from\s*|import\s*)['"])(\.{1,2}\/[^'"]+)(['"])/g,(_,prefix,specifier,suffix)=>prefix+(/\.[a-z0-9]+$/i.test(specifier)?specifier:specifier+'.ts')+suffix));
  }
  const type=/\.(?:ts|mjs|js)$/.test(filename)?'text/javascript':filename.endsWith('.png')?'image/png':'application/octet-stream';
  const value={type,body};routes.set(url,value);return value;
 }
 const server=http.createServer(async(req,res)=>{
  try{const result=await route(new URL(req.url,'http://localhost').pathname);if(!result){res.writeHead(404).end();return;}
   res.writeHead(200,{'content-type':result.type,'content-length':result.body.length,'cache-control':'no-store'}).end(result.body);
  }catch(error){console.error('Pilot HTTP error',req.url,String(error));res.writeHead(500).end(String(error));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const pageErrors=[],consoleErrors=[],requestFailures=[],stages=[],savedFiles=[],memorySamples=[memoryBefore];
 let browser,timer,monitor,monitorBusy=false;const started=Date.now();
 try{
  const memoryAtLaunch=await memorySnapshot();
  if(memoryAtLaunch.currentBytes>=6*2**30){await fs.writeFile(path.join(output,'launch-held.json'),JSON.stringify({reason:'Fresh memory guard before browser launch',memoryAtLaunch},null,2)+'\n');console.log(JSON.stringify({held:true,memoryAtLaunch}));return;}
  browser=await chromium.launch({executablePath:process.env.BAY_BROWSER_EXECUTABLE||'/workspace/scratch/46479389b383/forest-capture-runtime/browser/chromium',headless:true,timeout:60000,
   args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--force-color-profile=srgb']});
  const page=await browser.newPage({viewport:{width:128,height:128},deviceScaleFactor:1});
  page.on('pageerror',error=>pageErrors.push(String(error)));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});page.on('requestfailed',request=>requestFailures.push({url:request.url(),failure:request.failure()}));
  await page.addInitScript(config=>window.pilotConfig=config,{sourceSHA256,albedoSHA256,normalSHA256,bakeIsland,completedLayers:[...completedLayers.keys()]});
  await page.exposeFunction('pilotStage',async name=>{const value={name,milliseconds:Date.now()-started,memory:await memorySnapshot()};stages.push(value);console.log(JSON.stringify(value));});
  await page.exposeFunction('pilotLoadLayer',async layer=>{
   assert(bakeIsland&&completedLayers.has(layer),'Unknown checkpoint layer');const record=completedLayers.get(layer);
   return {record,payload:(await fs.readFile(path.join(output,record.smallFile.name))).toString('base64')};
  });
  await page.exposeFunction('pilotLayerCheckpoint',async record=>{
   assert(bakeIsland&&record.layer===record.sun*24+record.view&&record.layer>=0&&record.layer<192&&!completedLayers.has(record.layer),'Invalid new layer checkpoint');
   if(!checkpointHashes)checkpointHashes={...hashes};
   for(const [filename,value]of Object.entries(hashes))assert.equal(checkpointHashes[filename],value,'Checkpoint source set changed: '+filename);
   if(record.view===0)await verifySourceHashes(checkpointHashes);
   completedLayers.set(record.layer,record);
   const state={schema:'island-response-checkpoints-v1',sourceHashes:checkpointHashes,
    contract:{family:'island-base',sourceSHA256,albedoSHA256,normalSHA256,sourceSize:1024,samples:4,outputCells:[256,128],layout:'sun-major-view-major-bottom-first'},
    layers:[...completedLayers.values()].sort((a,b)=>a.layer-b.layer)};
   const temporary=checkpointFile+'.tmp';await fs.writeFile(temporary,JSON.stringify(state,null,2)+'\n');await fs.rename(temporary,checkpointFile);
  });
  await page.exposeFunction('pilotSave',async(name,payload)=>{
   assert(/^[a-zA-Z0-9_.-]+\.(png|rgba32f|rgba16f)$/.test(name),'Invalid pilot artifact path');
   const data=Buffer.from(payload,'base64'),record={name,bytes:data.length,sha256:digest(data)};
   if(bakeIsland&&name.startsWith('source-raw-')){
    const compressed=await promisify(gzip)(data,{level:4});record.storedName=name+'.gz';record.storedBytes=compressed.length;record.storedSHA256=digest(compressed);
    await fs.writeFile(path.join(output,record.storedName),compressed);
   }else await fs.writeFile(path.join(output,name),data);
   savedFiles.push(record);return record;
  });
  const bounded=new Promise((_,reject)=>{
   const budget=bakeIsland?600000:240000;timer=setTimeout(()=>reject(Error('Pilot exceeded '+budget+'ms total wall budget')),budget);
   monitor=setInterval(async()=>{
    if(monitorBusy)return;monitorBusy=true;
    try{const sample=await memorySnapshot();memorySamples.push(sample);if(sample.currentBytes>7.25*2**30)reject(Error('Pilot exceeded shared 7.25 GiB memory stop threshold'));}
    catch(error){reject(error);}finally{monitorBusy=false;}
   },1000);
  });
  const run=(async()=>{
   await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load',timeout:60000});
   await page.waitForFunction(()=>typeof window.runSourceDirectResponsePilot==='function',undefined,{timeout:20000});
   return page.evaluate(()=>window.runSourceDirectResponsePilot());
  })();
  const result=await Promise.race([run,bounded]);
  if(bakeIsland){
   await verifySourceHashes(hashes);
   assert.equal(result.manifest.complete,true);assert.equal(result.tiles.length,192);
   result.manifest.authoring.sourceHashes=hashes;
   result.manifest.authoring.renderer=await page.evaluate(()=>document.getElementById('world').getContext('webgl2').getParameter(7937));
  }
  Object.assign(result,{wallMilliseconds:Date.now()-started,memoryBefore,memoryBeforeClose:await memorySnapshot(),pageErrors,consoleErrors,requestFailures,stages,savedFiles,sourceHashes:hashes});
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2)+'\n');
  assert.equal(result.ok,true);assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(requestFailures,[]);
  if(bakeIsland)await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(result.manifest,null,2)+'\n');
  console.log(JSON.stringify({ok:true,output,wallMilliseconds:result.wallMilliseconds,tiles:result.tiles.length,rows:result.rows.length}));
 }catch(error){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({error:String(error),stack:error.stack,wallMilliseconds:Date.now()-started,pageErrors,consoleErrors,requestFailures,stages,savedFiles,sourceHashes:hashes,memory:await memorySnapshot()},null,2)+'\n');throw error;}
 finally{
  clearTimeout(timer);clearInterval(monitor);await browser?.close();await new Promise(resolve=>server.close(resolve));
  const memoryAfter=await memorySnapshot();await fs.writeFile(path.join(output,'memory.json'),JSON.stringify({memoryBefore,memoryAfter,memorySamples,wallMilliseconds:Date.now()-started},null,2)+'\n');
  console.log(JSON.stringify({browserClosed:true,memoryAfter}));
 }
}

console.log(JSON.stringify(cpuChecks()));
if(process.argv.includes('--gpu'))await gpuProbe();
