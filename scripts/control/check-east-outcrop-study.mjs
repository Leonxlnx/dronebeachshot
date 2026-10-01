// CPU: node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-east-outcrop-study.mjs
// GPU: add --gpu with BAY_BROWSER_EXECUTABLE set to an absolute Chromium path.
// Run only in a root-cleared tiny GPU window. Never writes dist.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {decodeRockGeometrySource} from '../../src/world/rock-geometry.ts';
import {sampleCamera} from '../../src/camera/cinematic.ts';
import {renderedTerrainHeight} from '../../src/world/terrain-surface.ts';
import {createEastOutcropStudy,cropViews,setStudyCamera} from './studies/east-outcrop/helper.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const evidence='artifacts/refinement-2026-09-30/cliff-mass-proposal';
const sourceSHA256='864ece45cf6cafeb7fab5ab65704b1810622ba411da2026ebad847a0a08eab2f';
const geometrySHA256='581b4f5b375b1eb2bed91178120d31811d09001904f43ee5f78e0168b61f6e42';
async function cpuChecks(){
 const source=await fs.readFile(path.join(root,'public/assets/rocks/rock_moss_set_01_2k.glb'));
 const packed=await fs.readFile(path.join(root,'public/assets/rocks/rock_moss_set_01_geometry.bin'));
 assert.equal(sha(source),sourceSHA256);assert.equal(sha(packed),geometrySHA256);
 const proposal=JSON.parse(await fs.readFile(path.join(root,evidence,'east-lower-group-proposal.json'),'utf8'));
 const group=decodeRockGeometrySource(packed.buffer.slice(packed.byteOffset,packed.byteOffset+packed.byteLength));
 const study=createEastOutcropStudy(group,proposal),point=new THREE.Vector3(),matrix=new THREE.Matrix4(),rows=[];
 assert.deepEqual(study.parts.map(p=>p.record.variant),[2,0,4]);assert.equal(study.parts.reduce((sum,p)=>sum+p.mesh.geometry.index.count/3,0),32548);
 for(const view of cropViews){
  const camera=new THREE.PerspectiveCamera(42,16/9,.4,22000);setStudyCamera(camera,sampleCamera(view.time),view);
  const uncropped=camera.clone();uncropped.clearViewOffset();uncropped.updateMatrixWorld();
  const bounds=[Infinity,Infinity,-Infinity,-Infinity];let exposed=0;
  for(const part of study.parts){
   part.mesh.getMatrixAt(0,matrix);assert.deepEqual(matrix.elements,part.record.matrix);
   const p=part.mesh.geometry.attributes.position,localBounds=new THREE.Box3();
   for(let i=0;i<p.count;i++){
    point.fromBufferAttribute(p,i).applyMatrix4(matrix);localBounds.expandByPoint(point);
    if(point.y<=renderedTerrainHeight(point.x,point.z))continue;exposed++;
    const full=point.clone().project(uncropped),crop=point.clone().project(camera);
    const x=(full.x*.5+.5)*view.fullWidth,y=(.5-full.y*.5)*view.fullHeight;
    assert.ok(Math.abs((crop.x*.5+.5)*view.width-(x-view.x))<1e-9,'Crop changed horizontal camera ray');
    assert.ok(Math.abs((.5-crop.y*.5)*view.height-(y-view.y))<1e-9,'Crop changed vertical camera ray');
    bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);
   }
   for(let axis=0;axis<3;axis++)for(const side of ['min','max'])assert.ok(Math.abs(localBounds[side].getComponent(axis)-part.record.actualBounds[side][axis])<1e-5);
  }
  assert(exposed>1000);assert(bounds[0]>=view.x&&bounds[2]<=view.x+view.width&&bounds[1]>=view.y&&bounds[3]<=view.y+view.height);
  rows.push({time:view.time,fullFrame:[view.fullWidth,view.fullHeight],actualExposedVertexProjection:bounds,crop:[view.x,view.y,view.width,view.height],output:[128,128],cropEnlargement:2,exposedVertices:exposed});
 }
 const result={ok:true,method:'Original GLB/packed source hashes, exact Float32 proposal transforms/bounds, actual camera projection and setViewOffset ray equality; CPU only',sourceSHA256,geometrySHA256,rows};
 await fs.writeFile(path.join(root,evidence,'local-study-cpu.json'),JSON.stringify(result,null,2)+'\n');
 study.parts.forEach(p=>p.mesh.geometry.dispose());study.material.dispose();group.children.forEach(m=>{m.geometry.dispose();m.material.dispose();});return result;
}
async function memory(){const bytes=Number(await fs.readFile('/sys/fs/cgroup/memory.current','utf8'));return{at:new Date().toISOString(),bytes,GiB:bytes/2**30};}
async function gpuStudy(){
 const browserExecutable=process.env.BAY_BROWSER_EXECUTABLE;
 assert.ok(browserExecutable&&path.isAbsolute(browserExecutable),'Set BAY_BROWSER_EXECUTABLE to an absolute Chromium executable path for --gpu');
 const outputArg=process.argv.indexOf('--output'),output=outputArg<0?path.join(root,evidence,'local-render-01'):path.resolve(process.argv[outputArg+1]);
 await fs.mkdir(output,{recursive:true});
 try{await fs.access(path.join(output,'results.json'));throw Error('Completed output exists; choose new --output');}catch(error){if(error.code!=='ENOENT')throw error;}
 const memoryBefore=await memory();assert(memoryBefore.GiB<6,'Launch held: shared memory must be below6GiB; got '+memoryBefore.GiB);
 const [{chromium},{default:ts}]=await Promise.all([import('playwright'),import('typescript')]);
 const sourceHashes={},routes=new Map(),html='<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><canvas id="world"></canvas><script type="importmap">{"imports":{"three":"/three.module.js","three/addons/":"/three-addons/"}}</script><script type="module" src="/study-page.mjs"></script>';
 routes.set('/',{type:'text/html',body:Buffer.from(html)});
 async function route(url){
  if(routes.has(url))return routes.get(url);let filename;
  if(url==='/three.module.js'||url==='/three.core.js')filename=path.join(root,'node_modules/three/build',url.slice(1));
  else if(url.startsWith('/three-addons/'))filename=path.join(root,'node_modules/three/examples/jsm',url.slice(14));
  else if(url==='/study-helper.mjs')filename=path.join(root,'scripts/control/studies/east-outcrop/helper.mjs');
  else if(url==='/study-page.mjs')filename=path.join(root,'scripts/control/studies/east-outcrop/page.mjs');
  else if(url==='/proposal.json')filename=path.join(root,evidence,'east-lower-group-proposal.json');
  else if(url.startsWith('/src/')&&url.endsWith('.ts'))filename=path.join(root,url.slice(1));
  else if(url.startsWith('/assets/'))filename=path.join(root,'public',url.slice(1));
  else return null;
  if(!filename.startsWith(root))return null;let body=await fs.readFile(filename);sourceHashes[path.relative(root,filename)]=sha(body);
  if(filename.endsWith('.ts'))body=Buffer.from(ts.transpileModule(body.toString(),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/((?:from\s*|import\s*)['"])(\.{1,2}\/[^'"]+)(['"])/g,(_,prefix,specifier,suffix)=>prefix+(/\.[a-z0-9]+$/i.test(specifier)?specifier:specifier+'.ts')+suffix));
  const type=/\.(?:ts|mjs|js)$/.test(filename)?'text/javascript':filename.endsWith('.json')?'application/json':'application/octet-stream';
  const value={type,body};routes.set(url,value);return value;
 }
 const server=http.createServer(async(req,res)=>{try{const result=await route(new URL(req.url,'http://localhost').pathname);if(!result){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':result.type,'content-length':result.body.length,'cache-control':'no-store'}).end(result.body);}catch(error){res.writeHead(500).end(String(error));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const pageErrors=[],consoleErrors=[],requestFailures=[],savedFiles=[],stages=[],memorySamples=[memoryBefore];let browser,timer,monitor,monitorBusy=false;const started=Date.now();
 try{
  browser=await chromium.launch({executablePath:browserExecutable,headless:true,timeout:60000,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--force-color-profile=srgb']});
  const page=await browser.newPage({viewport:{width:128,height:128},deviceScaleFactor:1});
  page.on('pageerror',error=>pageErrors.push(String(error)));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});page.on('requestfailed',request=>requestFailures.push({url:request.url(),failure:request.failure()}));
  await page.addInitScript(config=>window.studyConfig=config,{sourceSHA256,geometrySHA256});
  await page.exposeFunction('studyStage',async name=>{const value={name,milliseconds:Date.now()-started,memory:await memory()};stages.push(value);console.log(JSON.stringify(value));});
  await page.exposeFunction('studySave',async(name,payload)=>{assert(/^[a-zA-Z0-9_.-]+\.png$/.test(name));const data=Buffer.from(payload,'base64');await fs.writeFile(path.join(output,name),data);savedFiles.push({name,bytes:data.length,sha256:sha(data)});});
  const bounded=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('240 second total deadline')),240000);monitor=setInterval(async()=>{if(monitorBusy)return;monitorBusy=true;try{const sample=await memory();memorySamples.push(sample);if(sample.GiB>7.25)reject(Error('Shared7.25GiB memory abort'));}catch(error){reject(error);}finally{monitorBusy=false;}},1000);});
  const run=(async()=>{await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load',timeout:60000});await page.waitForFunction(()=>typeof window.runEastOutcropStudy==='function',undefined,{timeout:20000});return page.evaluate(()=>window.runEastOutcropStudy());})();
  const result=await Promise.race([run,bounded]);Object.assign(result,{wallMilliseconds:Date.now()-started,memoryBefore,memoryBeforeClose:await memory(),sourceHashes,pageErrors,consoleErrors,requestFailures,savedFiles,stages});
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2)+'\n');assert.equal(result.ok,true);assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(requestFailures,[]);console.log(JSON.stringify({ok:true,output,frames:result.rows.length}));
 }catch(error){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({error:String(error),stack:error.stack,pageErrors,consoleErrors,requestFailures,sourceHashes,savedFiles,stages,memory:await memory()},null,2)+'\n');throw error;}
 finally{clearTimeout(timer);clearInterval(monitor);await browser?.close();await new Promise(resolve=>server.close(resolve));const memoryAfter=await memory();await fs.writeFile(path.join(output,'memory.json'),JSON.stringify({memoryBefore,memoryAfter,memorySamples},null,2)+'\n');console.log(JSON.stringify({browserClosed:true,memoryAfter}));}
}
console.log(JSON.stringify(await cpuChecks()));
if(process.argv.includes('--gpu'))await gpuStudy();
