// --gpu is only for a separately root-cleared tiny GPU window. Default: validate.
import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {createCaptureMemoryGuard,readCaptureMemoryBytes,readCaptureMemoryStat} from './progress-memory.mjs';
const root=process.cwd(),dir=path.join(root,'artifacts/refinement-2026-09-30/wind-ripple-zero-skip'),sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const fixture=JSON.parse(await fs.readFile(path.join(dir,'glsl-fixture.json'),'utf8')),bytes=await fs.readFile(path.join(dir,fixture.inputFile));assert.equal(fixture.size,128);assert.equal(bytes.length,128*128*8*4);assert.equal(sha(bytes),fixture.inputSHA256);
const source=await fs.readFile(path.join(root,'src/world/ocean.ts'),'utf8'),start=source.indexOf('vec2 windRipple('),end=source.indexOf('\nvec3 waterNormal(',start);assert.equal(source.slice(start,end),fixture.original,'Current source ripple function changed');assert.equal(source.split('\n').filter(line=>line.includes('ripples+=windRipple(')).join('\n'),fixture.calls);
assert.equal(fixture.candidate.replace(fixture.sourceGuard+'\n',''),fixture.original);assert.ok(fixture.candidate.indexOf(fixture.sourceGuard)>fixture.candidate.indexOf('unresolvedWaterSlopeVariance+='));
console.log(JSON.stringify({fixtureReady:true,gpuRequested:process.argv.includes('--gpu'),size:128,sourceFunctionExact:true,productionEdited:false,inputSHA256:fixture.inputSHA256}));
if(process.argv.includes('--gpu')){
 const working=process.argv.includes('--working-memory'),memoryMetric=working?'working':'total',memoryStartMiB=working?7168:6144,memoryLimitMiB=7424;
 const arg=process.argv.indexOf('--output'),out=path.resolve(arg>=0?process.argv[arg+1]:path.join(dir,'glsl-run-01'));await fs.mkdir(out,{recursive:true});try{await fs.access(path.join(out,'results.json'));throw Error('Existing completed result; use a fresh output');}catch(error){if(error.code!=='ENOENT')throw error;}
 const routes=new Map([['/',{type:'text/html',body:Buffer.from('<!doctype html><link rel="icon" href="data:,"><canvas></canvas><script type="module" src="/page.mjs"></script>')}],['/fixture.json',{type:'application/json',body:Buffer.from(JSON.stringify(fixture))}],['/inputs.bin',{type:'application/octet-stream',body:bytes}],['/page.mjs',{type:'text/javascript',body:await fs.readFile(path.join(dir,'glsl-page.mjs'))}]]);
 const diagnostics={chromiumV8OldSpaceMiB:256},errors=[],cleanupErrors=[],started=Date.now();let stage='memory-preflight',browser,server,deadline,deadlineError,failure,closePromise,browserCloseError;
 const guard=createCaptureMemoryGuard({memoryStartMiB,memoryLimitMiB,memoryMetric,diagnostics,getStage:()=>stage});
 const remember=error=>{const text=String(error);if(!cleanupErrors.includes(text))cleanupErrors.push(text)};
 function closeOwnedBrowser(){if(browser&&!closePromise)closePromise=Promise.resolve().then(()=>browser.close());return closePromise??Promise.resolve()}
 function memorySnapshot(){try{return{rawBytes:readCaptureMemoryBytes(),...(working?{stat:readCaptureMemoryStat()}:{}),at:new Date().toISOString()}}catch(error){return{error:String(error),at:new Date().toISOString()}}}
 const memoryBefore=memorySnapshot();
 try{
  guard.preflight();
  const bounded=new Promise((_,reject)=>{deadline=setTimeout(()=>{deadlineError=Error('120s fixture deadline');void closeOwnedBrowser().catch(remember);reject(deadlineError)},120000)});
  const work=(async()=>{
   stage='start-owned-server';server=http.createServer((req,res)=>{const value=routes.get(new URL(req.url,'http://localhost').pathname);if(!value){res.writeHead(404).end();return}res.writeHead(200,{'content-type':value.type,'content-length':value.body.length,'cache-control':'no-store'}).end(value.body)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   stage='launch-browser';const {chromium}=await import('playwright');browser=await chromium.launch({executablePath:process.env.BAY_BROWSER_EXECUTABLE||'/workspace/scratch/46479389b383/forest-capture-runtime/browser/chromium',headless:true,timeout:30000,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--force-color-profile=srgb','--js-flags=--max-old-space-size=256']});
   guard.attachBrowser({close:closeOwnedBrowser});guard.assertHealthy();if(deadlineError){await closeOwnedBrowser();throw deadlineError}
   stage='create-page';const page=await browser.newPage({viewport:{width:128,height:128},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('requestfailed',r=>errors.push(r.url()+':'+JSON.stringify(r.failure())));
   stage='navigate';await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load',timeout:30000});guard.assertHealthy();await page.waitForFunction(()=>typeof window.runWindRippleStudy==='function');
   stage='ripple-glsl-comparison';const result=await page.evaluate(()=>window.runWindRippleStudy());guard.assertHealthy();return result;
  })();
  const result=await Promise.race([work,bounded]);guard.assertHealthy();Object.assign(result,{wallMilliseconds:Date.now()-started,errors,memoryBefore,diagnostics,sourcePageSHA256:sha(routes.get('/page.mjs').body)});await fs.writeFile(path.join(out,'results.json'),JSON.stringify(result,null,2)+'\n');assert.equal(result.ok,true);assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,out,bitDifferences:result.bitDifferences,maxAbsolute:result.maxAbsolute}));
 }catch(error){failure=guard.error??deadlineError??error;await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({error:String(failure),errors,stage,diagnostics},null,2)+'\n');throw failure;}
 finally{
  clearTimeout(deadline);guard.stop();stage='cleanup';
  // Every owned cleanup is attempted. Memory evidence is written even if the
  // browser close rejects; no other process/context is discovered or touched.
  try{await closeOwnedBrowser()}catch(error){browserCloseError=String(error);remember(error)}
  try{await guard.finish()}catch(error){remember(error)}
  try{if(server?.listening){server.closeAllConnections?.();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}}catch(error){remember(error)}
  finally{await fs.writeFile(path.join(out,'memory.json'),JSON.stringify({before:memoryBefore,after:memorySnapshot(),diagnostics,cleanupErrors,primaryFailure:failure?String(failure):null,browserCloseRequested:!!closePromise,browserCloseError:browserCloseError??null},null,2)+'\n')}
  console.log(JSON.stringify({ownedBrowserCleanupFinished:true,cleanupErrors,memoryMetric}));
  if(!failure&&cleanupErrors.length)throw Error('Fixture cleanup failed: '+cleanupErrors.join(' | '));
 }
}
