// Isolated256px terrain-only study; --gpu requires a root-cleared tiny GPU slot
// and BAY_BROWSER_EXECUTABLE set to an absolute Chromium executable path.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url)),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const evidence='artifacts/refinement-2026-09-30/east-wall-structure';
const helperSHA256=sha(await fs.readFile(path.join(root,evidence,'rounded-spur-study.mjs')));
// Compact retained summary equals the original measurement report's first summary.
const summary=JSON.parse(await fs.readFile(path.join(root,evidence,'rounded-spur-summary.json'),'utf8'))[0].summary;
assert.equal(summary.routeChanged,0);
assert(summary.minimumShoreDistance>45);
assert.equal(summary.heightAdded.max,32);
console.log(JSON.stringify({sourceReady:true,helperSHA256,productionUnmodified:true,CPUProof:'rounded-spur-summary.json',actualSourceBasalReview:'rounded-spur-basal-support.json; unresolved local support, not accepted'}));
async function memory(){const bytes=Number(await fs.readFile('/sys/fs/cgroup/memory.current','utf8'));return{at:new Date().toISOString(),bytes,GiB:bytes/2**30};}
async function gpuStudy(){
 const browserExecutable=process.env.BAY_BROWSER_EXECUTABLE;
 assert.ok(browserExecutable&&path.isAbsolute(browserExecutable),'Set BAY_BROWSER_EXECUTABLE to an absolute Chromium executable path for --gpu');
 const outputArg=process.argv.indexOf('--output'),output=outputArg<0?path.join(root,evidence,'rounded-spur-render-01'):path.resolve(process.argv[outputArg+1]);
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
  else if(url==='/study-page.mjs')filename=path.join(root,'scripts/control/studies/east-outcrop/rounded-spur-page.mjs');
  else if(url==='/spur-helper.mjs')filename=path.join(root,evidence,'rounded-spur-study.mjs');
  else if(url.startsWith('/src/')&&url.endsWith('.ts'))filename=path.join(root,url.slice(1));
  else if(url.startsWith('/assets/'))filename=path.join(root,'public',url.slice(1));
  else return null;
  if(!filename.startsWith(root))return null;let body=await fs.readFile(filename);sourceHashes[path.relative(root,filename)]=sha(body);
  if(filename.endsWith('/world/habitat.ts'))body=Buffer.concat([body,Buffer.from('\nexport {habitatData};\n')]);
  if(filename.endsWith('.ts'))body=Buffer.from(ts.transpileModule(body.toString(),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/((?:from\s*|import\s*)['"])(\.{1,2}\/[^'"]+)(['"])/g,(_,prefix,specifier,suffix)=>prefix+(/\.[a-z0-9]+$/i.test(specifier)?specifier:specifier+'.ts')+suffix));
  const type=/\.(?:ts|mjs|js)$/.test(filename)?'text/javascript':filename.endsWith('.json')?'application/json':'application/octet-stream';
  const value={type,body};routes.set(url,value);return value;
 }
 const server=http.createServer(async(req,res)=>{try{const result=await route(new URL(req.url,'http://localhost').pathname);if(!result){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':result.type,'content-length':result.body.length,'cache-control':'no-store'}).end(result.body);}catch(error){res.writeHead(500).end(String(error));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const pageErrors=[],consoleErrors=[],requestFailures=[],savedFiles=[],stages=[],memorySamples=[memoryBefore];let browser,timer,monitor,monitorBusy=false;const started=Date.now();
 try{
  browser=await chromium.launch({executablePath:browserExecutable,headless:true,timeout:60000,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--force-color-profile=srgb']});
  const page=await browser.newPage({viewport:{width:256,height:256},deviceScaleFactor:1});
  page.on('pageerror',error=>pageErrors.push(String(error)));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});page.on('requestfailed',request=>requestFailures.push({url:request.url(),failure:request.failure()}));
  await page.addInitScript(config=>window.studyConfig=config,{helperSHA256});
  await page.exposeFunction('studyStage',async name=>{const value={name,milliseconds:Date.now()-started,memory:await memory()};stages.push(value);console.log(JSON.stringify(value));});
  await page.exposeFunction('studySave',async(name,payload)=>{assert(/^[a-zA-Z0-9_.-]+\.png$/.test(name));const data=Buffer.from(payload,'base64');await fs.writeFile(path.join(output,name),data);savedFiles.push({name,bytes:data.length,sha256:sha(data)});});
  const bounded=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('240 second total deadline')),240000);monitor=setInterval(async()=>{if(monitorBusy)return;monitorBusy=true;try{const sample=await memory();memorySamples.push(sample);if(sample.GiB>7.25)reject(Error('Shared7.25GiB memory abort'));}catch(error){reject(error);}finally{monitorBusy=false;}},1000);});
  const run=(async()=>{await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load',timeout:60000});await page.waitForFunction(()=>typeof window.runRoundedSpurStudy==='function',undefined,{timeout:20000});return page.evaluate(()=>window.runRoundedSpurStudy());})();
  const result=await Promise.race([run,bounded]);Object.assign(result,{wallMilliseconds:Date.now()-started,memoryBefore,memoryBeforeClose:await memory(),sourceHashes,pageErrors,consoleErrors,requestFailures,savedFiles,stages});
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2)+'\n');assert.equal(result.ok,true);assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(requestFailures,[]);console.log(JSON.stringify({ok:true,output,frames:result.rows.length}));
 }catch(error){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({error:String(error),stack:error.stack,pageErrors,consoleErrors,requestFailures,sourceHashes,savedFiles,stages,memory:await memory()},null,2)+'\n');throw error;}
 finally{clearTimeout(timer);clearInterval(monitor);await browser?.close();await new Promise(resolve=>server.close(resolve));const memoryAfter=await memory();await fs.writeFile(path.join(output,'memory.json'),JSON.stringify({memoryBefore,memoryAfter,memorySamples},null,2)+'\n');console.log(JSON.stringify({browserClosed:true,memoryAfter}));}
}
if(process.argv.includes('--gpu'))await gpuStudy();
