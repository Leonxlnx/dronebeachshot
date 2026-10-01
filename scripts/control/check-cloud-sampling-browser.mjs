// Exact-resolution cropped visible-sky sampling diagnosis; no scene geometry. Running this file launches one WebGL context;
// --prepare-only freezes source and compiled HTTP bytes without a browser.
// run-prepared=<frozen-routes.json> never imports TypeScript; --server-check
// additionally verifies every served route and reports RSS without a browser.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const runFile=promisify(execFile);
import {createCaptureMemoryGuard,readCaptureMemoryBytes,readCaptureMemoryStat} from './progress-memory.mjs';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const output=path.resolve(root,process.argv.find(value=>value.startsWith('out='))?.slice(4)??'artifacts/refinement-2026-09-30/cloud-sampling-study/probe-01');
const prepareOnly=process.argv.includes('--prepare-only');
const preparedArguments=process.argv.filter(value=>value.startsWith('run-prepared='));
if(preparedArguments.length>1)throw Error('Supply run-prepared= at most once');
const preparedFile=preparedArguments[0]?.slice(13),serverCheck=process.argv.includes('--server-check');
if((preparedArguments.length&&!preparedFile)||(prepareOnly&&preparedFile)||(serverCheck&&!preparedFile))throw Error('Invalid preparation/run-prepared/server-check combination');
const variants=[
 {name:'step-30',stepMeters:30,constantIllumination:false,footprintFactor:.5},
 {name:'step-15',stepMeters:15,constantIllumination:false,footprintFactor:.5},
 {name:'step-7p5',stepMeters:7.5,constantIllumination:false,footprintFactor:.5},
 {name:'constant-light',stepMeters:30,constantIllumination:true,footprintFactor:.5},
 {name:'full-cell-footprint',stepMeters:30,constantIllumination:false,footprintFactor:1},
 {name:'step-30-restore',stepMeters:30,constantIllumination:false,footprintFactor:.5},
];
const expectedCrop={fullWidth:1280,fullHeight:720,x:220,y:0};
const expectedReference={file:'artifacts/refinement-2026-09-30/final-environment-review/capture/coast-refined-10_5.png',sha256:'6bd5ca6553f43a43574bc8634bfa6227a79b2e917a527f6d4ebdbff3fcaa9f34',width:1280,height:720};
const MiB=1024**2,startLimit=7168*MiB,stopLimit=7424*MiB,deadlineMilliseconds=120000;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const html='<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><canvas></canvas><script type="importmap">{"imports":{"three":"/three.module.js"}}</script><script type="module" src="/scripts/control/cloud-sampling-probe-page.mjs"></script>';
const routes=new Map();let config,sourceHashes,preparation;
await fs.mkdir(output,{recursive:true});
try{await fs.access(path.join(output,'results.json'));throw Error('Completed probe output exists; choose a new out= directory');}catch(error){if(error.code!=='ENOENT')throw error;}
if(preparedFile){
 const filename=path.resolve(root,preparedFile),bytes=await fs.readFile(filename),expected=(await fs.readFile(filename+'.sha256','utf8')).trim();
 if(!/^[a-f0-9]{64}$/.test(expected)||sha(bytes)!==expected)throw Error('Frozen route table SHA256 mismatch');
 const frozen=JSON.parse(bytes);
 if(frozen.schema!=='cloud-sampling-frozen-routes-v1'||!Array.isArray(frozen.routes)||!frozen.sourceHashes)throw Error('Invalid frozen route table schema');
 config=frozen.config;sourceHashes=frozen.sourceHashes;
 if(config.width!==256||config.height!==128||config.time!==10.5||config.lighting?.cloudCoverage!==.4||config.lighting?.cloudMorphology!==true
  ||JSON.stringify(config.crop)!==JSON.stringify(expectedCrop)||JSON.stringify(config.variants)!==JSON.stringify(variants)
  ||config.linearMainOutput!==true||config.linearMainSampleScale!==1||JSON.stringify(config.reference)!==JSON.stringify(expectedReference)
  ||config.guards?.startLimit!==startLimit||config.guards?.stopLimit!==stopLimit||config.guards?.deadlineMilliseconds!==deadlineMilliseconds||config.guards?.memoryMetric!=='working')throw Error('Frozen fixture configuration/guards changed');
 for(const [filename,hash]of Object.entries(sourceHashes))if(!filename||!/^[a-f0-9]{64}$/.test(hash))throw Error('Invalid frozen source hash');
 for(const route of frozen.routes){
  if(typeof route.url!=='string'||!route.url.startsWith('/')||route.url.includes('..')||routes.has(route.url)||typeof route.body!=='string'||!['text/javascript','text/html','application/json'].includes(route.type)||sha(route.body)!==route.sha256)throw Error('Invalid or modified frozen route');
  routes.set(route.url,{body:route.body,type:route.type});
 }
 for(const url of ['/','/probe-config.json','/three.module.js','/three.core.js','/scripts/control/cloud-sampling-probe-page.mjs'])if(!routes.has(url))throw Error('Missing frozen route '+url);
 if(routes.get('/').body!==html||routes.get('/probe-config.json').body!==JSON.stringify(config))throw Error('Frozen HTML/config route mismatch');
 preparation={config,sourceHashes,sourceModuleCount:routes.size-2,sourceBytes:frozen.sourceBytes,preparedFile:filename,preparedSHA256:expected,compiler:frozen.compiler,runPrepared:true};
}else{
 // Compiler and ASTs live only in the preparation process when run-prepared is used.
 const ts=(await import('typescript')).default;
 const profileFile='profiles/last-light-bay.json',profile=await fs.readFile(path.join(root,profileFile)),profileJSON=JSON.parse(profile);
 if(profileJSON.lighting?.cloudCoverage!==.4||profileJSON.lighting?.cloudMorphology!==true||profileJSON.linearMainOutput!==true||profileJSON.linearMainSampleScale!==1)throw Error('Canonical cloud/linear-main profile changed');
 if(sha(await fs.readFile(path.join(root,expectedReference.file)))!==expectedReference.sha256)throw Error('Reference full-scene PNG SHA256 changed');
 config={width:256,height:128,time:10.5,crop:expectedCrop,variants,reference:expectedReference,lighting:{...profileJSON.lighting},
  linearMainOutput:true,linearMainSampleScale:1,profileFile,profileSHA256:sha(profile),
  diagnosis:{detailBaseTexelMeters:9.765625,nominalHalfCellDetailLOD:Math.log2(15/9.765625),nominalFullCellDetailLOD:Math.log2(30/9.765625),meaning:'Full-cell variant tests a primary sample-spacing/mip-footprint mismatch. Constant illumination isolates density/support from the secondary light march.'},
  guards:{memoryMetric:'working',startLimit,stopLimit,deadlineMilliseconds}};
 sourceHashes={[profileFile]:sha(profile),[expectedReference.file]:expectedReference.sha256};const sourceBytes=new Map();
const resolveModule=(url,specifier)=>{
 if(specifier==='three')return '/three.module.js';
 if(!specifier.startsWith('.'))throw Error('Unexpected module dependency: '+specifier);
 const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(url),specifier));
 return path.posix.extname(resolved)?resolved:resolved+'.ts';
};
async function freezeModule(url){
 if(routes.has(url))return;
 let filename;
 if(['/three.module.js','/three.core.js'].includes(url))filename=path.join(root,'node_modules/three/build',url.slice(1));
 else if(url.startsWith('/src/')||url==='/scripts/control/cloud-sampling-probe-page.mjs')filename=path.join(root,url.slice(1));
 else throw Error('Unexpected source path: '+url);
 if(!filename.startsWith(root+path.sep))throw Error('Source escaped repository');
 const bytes=await fs.readFile(filename),relative=path.relative(root,filename);sourceHashes[relative]=sha(bytes);sourceBytes.set(relative,bytes);
 const original=bytes.toString(),source=ts.createSourceFile(filename,original,ts.ScriptTarget.Latest,true);
 const dependencies=[];
 for(const statement of source.statements){
  if((ts.isImportDeclaration(statement)||ts.isExportDeclaration(statement))&&statement.moduleSpecifier&&!statement.importClause?.isTypeOnly)
   dependencies.push(resolveModule(url,statement.moduleSpecifier.text));
 }
 const body=filename.endsWith('.ts')?ts.transpileModule(original,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
  .replace(/((?:from\s*|import\s*)['"])(\.{1,2}\/[^'"]+)(['"])/g,(_,a,b,c)=>a+(/\.[a-z0-9]+$/i.test(b)?b:b+'.ts')+c):original;
 routes.set(url,{body,type:'text/javascript'});
 for(const dependency of dependencies)await freezeModule(dependency);
}
await freezeModule('/scripts/control/cloud-sampling-probe-page.mjs');
sourceHashes['scripts/control/check-cloud-sampling-browser.mjs']=sha(await fs.readFile(fileURLToPath(import.meta.url)));
sourceHashes['scripts/control/progress-memory.mjs']=sha(await fs.readFile(path.join(root,'scripts/control/progress-memory.mjs')));
for(const [relative,bytes]of sourceBytes){const destination=path.join(output,'source',relative);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,bytes);}
 preparation={config,sourceHashes,sourceModuleCount:routes.size,sourceBytes:[...sourceBytes.values()].reduce((n,b)=>n+b.length,0),compiler:{name:'typescript',version:ts.version,target:'ES2022',module:'ESNext'}};
 routes.set('/',{body:html,type:'text/html'});routes.set('/probe-config.json',{body:JSON.stringify(config),type:'application/json'});
 const frozen=JSON.stringify({schema:'cloud-sampling-frozen-routes-v1',...preparation,routes:[...routes].map(([url,route])=>({url,...route,sha256:sha(route.body)}))})+'\n';
 const filename=path.join(output,'frozen-routes.json');await fs.writeFile(filename,frozen);await fs.writeFile(filename+'.sha256',sha(frozen)+'\n');
 preparation.preparedFile=filename;preparation.preparedSHA256=sha(frozen);preparation.runPrepared=false;
}
await fs.writeFile(path.join(output,'preparation.json'),JSON.stringify(preparation,null,2)+'\n');
if(prepareOnly){console.log(JSON.stringify({prepared:true,output,preparedFile:preparation.preparedFile,preparedSHA256:preparation.preparedSHA256,sourceModuleCount:routes.size-2,config}));process.exit(0);}

// This small automation dependency is loaded in both the server-check and actual
// browser path, so measured server RSS includes the real launch-side overhead.
const {chromium}=await import('playwright');

const memorySnapshot=()=>({rawBytes:readCaptureMemoryBytes(),stat:readCaptureMemoryStat(),at:new Date().toISOString()});
const before=memorySnapshot(),diagnostics={};let stage='before-browser';
const guard=createCaptureMemoryGuard({memoryStartMiB:7168,memoryLimitMiB:7424,memoryMetric:'working',diagnostics,getStage:()=>stage});
const errors=[],requests=[],frameRows=[],driver={nodeVersion:process.version,execArgv:process.execArgv,runPrepared:Boolean(preparedFile),typescriptImported:!preparedFile,sourceSHA256:sha(await fs.readFile(fileURLToPath(import.meta.url))),memoryAtPreflight:null};let browser,totalTimer,guardReason=null,primaryError=null;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost').pathname,value=routes.get(url);
 if(!value){errors.push('Unfrozen/unexpected URL '+url);res.writeHead(404).end();return;}
 res.writeHead(200,{'content-type':value.type,'cache-control':'no-store'}).end(value.body);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const started=Date.now();
function stop(reason){if(guardReason)return;guardReason=reason;errors.push(reason);void browser?.close().catch(()=>{});}
try{
 if(serverCheck){
  for(const [url,route]of routes){
   const actual=await new Promise((resolve,reject)=>{http.get({hostname:'127.0.0.1',port:server.address().port,path:url},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('error',reject);response.on('end',()=>resolve({status:response.statusCode,type:response.headers['content-type'],body:Buffer.concat(chunks)}));}).on('error',reject);});
   if(actual.status!==200||actual.type!==route.type||sha(actual.body)!==sha(route.body))throw Error('Served frozen route mismatch: '+url);
  }
  driver.memoryAtPreflight=process.memoryUsage();
  const check={ok:true,noBrowser:true,verifiedRoutes:routes.size,preparedSHA256:preparation.preparedSHA256,driver};
  await fs.writeFile(path.join(output,'server-check.json'),JSON.stringify(check,null,2)+'\n');console.log(JSON.stringify(check));
 }else{
 // The shared conservative working-set guard retains raw memory diagnostics.
 // A denied preflight exits once; this harness does not poll/retry a launch.
 driver.memoryAtPreflight=process.memoryUsage();guard.preflight();
 totalTimer=setTimeout(()=>stop('120s cloud probe deadline'),deadlineMilliseconds);
 if(sha(await fs.readFile(path.join(root,config.reference.file)))!==config.reference.sha256)throw Error('Reference full-scene PNG SHA256 changed');
 const browserExecutable=process.env.BAY_BROWSER_EXECUTABLE;
 if(!browserExecutable||!path.isAbsolute(browserExecutable))throw Error('Set BAY_BROWSER_EXECUTABLE to an absolute Chromium executable path');
 stage='browser-launch';
 browser=await chromium.launch({executablePath:browserExecutable,headless:true,timeout:30000,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--force-color-profile=srgb']});
 guard.attachBrowser(browser);guard.assertHealthy();if(guardReason)throw Error(guardReason);
 const page=await browser.newPage({viewport:{width:config.width,height:config.height},deviceScaleFactor:1});
 page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 page.on('requestfailed',request=>requests.push({url:request.url(),failure:request.failure()}));
 await page.exposeFunction('savePNG',async(name,url)=>{if(!config.variants.some(v=>name===v.name+'.png')||!url.startsWith('data:image/png;base64,'))throw Error('Invalid PNG');await fs.writeFile(path.join(output,name),Buffer.from(url.slice(22),'base64'));});
 await page.exposeFunction('saveRaw',async(name,base64)=>{if(!config.variants.some(v=>name===v.name+'.rgba16f.bin')||typeof base64!=='string')throw Error('Invalid raw capture');const bytes=Buffer.from(base64,'base64');if(bytes.length!==config.width*config.height*8)throw Error('Unexpected RGBA16F payload size');await fs.writeFile(path.join(output,name),bytes);});
 await page.exposeFunction('saveFrameRow',async row=>{frameRows.push(row);stage='after-'+row.name;await fs.writeFile(path.join(output,'frames.json'),JSON.stringify(frameRows,null,2)+'\n');});
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load',timeout:30000});
 await page.waitForFunction(()=>typeof window.runProbe==='function',undefined,{timeout:30000});
 stage='six-matched-sky-crops';const result=await page.evaluate(()=>window.runProbe());guard.assertHealthy();if(errors.length||requests.length)throw Error('Cloud probe runtime errors');
 // Compare the actual PNG against the exact full-scene crop before any variant
 // interpretation. A mismatch is evidence, not silently treated as a match.
 const compareCode=`import json,sys,math
from PIL import Image
full=Image.open(sys.argv[1]).convert('RGB')
probe=Image.open(sys.argv[2]).convert('RGB')
assert full.size==(1280,720) and probe.size==(256,128)
reference=full.crop((220,0,476,128))
a=list(reference.getdata());b=list(probe.getdata())
d=[[abs(x-y) for x,y in zip(p,q)] for p,q in zip(a,b)]
v=[x for p in d for x in p]
print(json.dumps({'dimensions':[256,128],'changedPixels':sum(any(p) for p in d),'pixelsAbove2':sum(max(p)>2 for p in d),'maximumChannelDelta':max(v),'meanAbsoluteRGBDelta':sum(v)/len(v),'rootMeanSquareRGBDelta':math.sqrt(sum(x*x for x in v)/len(v)),'exactRGBMatch':not any(v),'method':'Pillow decoded RGB8, exact 1280x720 full-scene crop x220,y0,width256,height128; no scaling'}))`;
 const compared=await runFile('python3',['-c',compareCode,path.join(root,config.reference.file),path.join(output,'step-30.png')],{timeout:10000,maxBuffer:1024*1024});
 result.fullSceneBaselineComparison={reference:config.reference,...JSON.parse(compared.stdout)};
 await fs.writeFile(path.join(output,'baseline-comparison.json'),JSON.stringify(result.fullSceneBaselineComparison,null,2)+'\n');
 await fs.writeFile(path.join(output,'results.json'),JSON.stringify({...result,sourceHashes,errors,requests,driver,wallMilliseconds:Date.now()-started},null,2)+'\n');
 console.log(JSON.stringify({ok:true,output,rows:result.rows,baselineComparison:result.fullSceneBaselineComparison,restoration:result.restoration,differences:result.differences,wallMilliseconds:Date.now()-started}));
 }
}catch(error){
 primaryError=error;
 try{await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({error:String(error),stack:error.stack,errors,requests,sourceHashes,frameRows,driver,wallMilliseconds:Date.now()-started},null,2)+'\n');}
 catch(evidenceError){console.error('Could not write cloud failure evidence:',evidenceError);}
 throw error;
}finally{
 const cleanupErrors=[];
 const attempt=async(label,operation)=>{try{await operation();return true;}catch(error){cleanupErrors.push({stage:label,error:String(error)});return false;}};
 // Each cleanup operation is attempted even if a previous one rejects. Retain
 // the rendering/preflight error as the primary failure when one already exists.
 await attempt('clear deadline',()=>clearTimeout(totalTimer));
 await attempt('stop memory guard',()=>guard.stop());
 const browserClosed=await attempt('close browser',()=>browser?.close());
 await attempt('finish memory guard',()=>guard.finish());
 await attempt('close HTTP connections',()=>server.closeAllConnections());
 const serverClosed=await attempt('close HTTP server',()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
 let after=null;await attempt('read final memory',()=>{after=memorySnapshot();});
 const memoryWritten=await attempt('write memory evidence',()=>fs.writeFile(path.join(output,'memory.json'),JSON.stringify({before,after,...diagnostics,driver,deadlineMilliseconds,guardReason,browserLaunched:Boolean(browser),browserClosed,serverClosed,primaryError:primaryError?String(primaryError):null,cleanupErrors},null,2)+'\n'));
 if(!memoryWritten)console.error('Could not write cloud cleanup evidence:',cleanupErrors);
 if(cleanupErrors.length&&!primaryError)throw Error('Cloud probe cleanup failed: '+JSON.stringify(cleanupErrors));
}
