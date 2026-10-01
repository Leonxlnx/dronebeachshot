// Preparation is CPU-only. Launch only after the root releases this GPU slot.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {createCaptureMemoryGuard} from './progress-memory.mjs';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),output=path.resolve(root,process.argv.find(v=>v.startsWith('out='))?.slice(4)??'artifacts/refinement-2026-09-30/coastal-reflection/isolated-gpu-01');
const oceanPath='src/world/ocean.ts',ocean=fs.readFileSync(path.join(root,oceanPath),'utf8'),ast=ts.createSourceFile(oceanPath,ocean,ts.ScriptTarget.Latest,true);
const declaration=ast.statements.find(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(item=>item.name.getText(ast)==='coastalReflectionGLSL'));
if(!declaration)throw Error('Actual ocean coastalReflectionGLSL declaration missing');
const filterPath='src/render/coastal-reflection-filter.ts',filterSource=fs.readFileSync(path.join(root,filterPath),'utf8');
const selected="import {coastalReflectionFilterGLSL} from '/"+filterPath+"';\nexport "+declaration.getText(ast).replace(/^export\s+/,'');
const hash=data=>createHash('sha256').update(data).digest('hex'),sourceHashes={[oceanPath]:hash(ocean),'selected coastalReflectionGLSL declaration':hash(selected)};
sourceHashes[filterPath]=hash(filterSource);
// The helper only consumes this binding. Extract its actual declaration so the
// fixture does not execute materials.ts's unrelated habitat-field generation.
const materialSource=fs.readFileSync(path.join(root,'src/render/materials.ts'),'utf8'),materialAst=ts.createSourceFile('materials.ts',materialSource,ts.ScriptTarget.Latest,true);
const debugDeclaration=materialAst.statements.find(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(item=>item.name.getText(materialAst)==='debugMode'));
if(!debugDeclaration)throw Error('Actual debugMode binding missing');
const selectedDebug='export '+debugDeclaration.getText(materialAst).replace(/^export\s+/,'');
sourceHashes['src/render/materials.ts']=hash(materialSource);sourceHashes['selected debugMode declaration']=hash(selectedDebug);
fs.mkdirSync(output,{recursive:true});if(fs.existsSync(path.join(output,'results.json')))throw Error('Completed fixture output exists');
const prepared={fixture:'isolated actual coastal reflection',physicalCanvas:[128,128],reflection:[64,64],dpr:[1,2],samples:4,format:'RGBA16F',approximateExpectedAdditionalMiB:'200–300 browser overhead; texture/geometry payload below1MiB, not a measured bound',memoryMetric:'working',memoryStartMiB:7168,memoryLimitMiB:7424,productionModified:false,sourceHashes};
fs.writeFileSync(path.join(output,'prepared.json'),JSON.stringify(prepared,null,2)+'\n');
const diagnostics={pageErrors:[],consoleErrors:[],requestFailures:[]};let stage='preflight',browser,server,deadline,result;
const guard=createCaptureMemoryGuard({memoryStartMiB:7168,memoryLimitMiB:7424,memoryMetric:'working',diagnostics,getStage:()=>stage});
const modules=new Map(),html='<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><canvas id="world"></canvas><script type="importmap">{"imports":{"three":"/three.module.js","three/addons/":"/addons/"}}</script><script type="module" src="/scripts/control/isolated-coastal-reflection-page.mjs"></script>';
function compile(source){return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/((?:from\s*|import\s*)['"])(\.{1,2}\/[^'"]+)(['"])/g,(_,a,b,c)=>a+(/\.[a-z0-9]+$/i.test(b)?b:b+'.ts')+c);}
function route(url){
 if(url==='/')return {body:html,type:'text/html'};
 if(url==='/actual-coastal-reflection-glsl.js')return {body:compile(selected),type:'text/javascript'};
 if(url==='/src/render/materials.ts')return {body:compile(selectedDebug),type:'text/javascript'};
 let file;if(['/three.module.js','/three.core.js'].includes(url))file=path.join(root,'node_modules/three/build',url.slice(1));else if(url.startsWith('/addons/'))file=path.join(root,'node_modules/three/examples/jsm',url.slice(8));else if(url.startsWith('/src/')||url.startsWith('/scripts/control/isolated-coastal-reflection'))file=path.join(root,url.slice(1));else return null;
 if(!file.startsWith(root+path.sep)||!['.mjs','.js','.ts'].includes(path.extname(file)))return null;
 if(!modules.has(file)){const source=fs.readFileSync(file);sourceHashes[path.relative(root,file)]=hash(source);modules.set(file,{body:file.endsWith('.ts')?compile(source.toString()):source,type:'text/javascript'});}return modules.get(file);
}
for(const url of ['/','/scripts/control/isolated-coastal-reflection-page.mjs','/src/render/coastal-reflection.ts','/src/render/refraction.ts','/src/render/materials.ts','/three.module.js','/three.core.js','/actual-coastal-reflection-glsl.js'])if(!route(url))throw Error('Fixture route missing: '+url);
fs.writeFileSync(path.join(output,'prepared.json'),JSON.stringify(prepared,null,2)+'\n');
if(!process.argv.includes('--gpu')){console.log(JSON.stringify({prepared:true,gpuStarted:false,output,...prepared}));process.exit(0);}
try{
 guard.preflight();stage='server';server=http.createServer((req,res)=>{try{const data=route(new URL(req.url,'http://localhost').pathname);if(!data){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':data.type,'cache-control':'no-store'}).end(data.body);}catch(error){diagnostics.consoleErrors.push(String(error));res.writeHead(500).end(String(error));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));stage='browser';const {chromium}=await import('playwright');
 browser=await chromium.launch({executablePath:process.env.BAY_BROWSER_EXECUTABLE??'/workspace/scratch/46479389b383/forest-capture-runtime/browser/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--force-color-profile=srgb','--js-flags=--max-old-space-size=256']});guard.attachBrowser(browser);guard.assertHealthy();
 deadline=setTimeout(()=>{diagnostics.deadline='120s owned-fixture deadline';browser.close().catch(()=>{});},120000);
 const page=await browser.newPage({viewport:{width:128,height:128},deviceScaleFactor:1});
 page.on('pageerror',e=>diagnostics.pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')diagnostics.consoleErrors.push(m.text());});page.on('requestfailed',r=>diagnostics.requestFailures.push({url:r.url(),error:r.failure()?.errorText}));
 await page.exposeFunction('savePNG',async(name,url)=>{guard.assertHealthy();if(!/^[a-z0-9-]+\.png$/.test(name)||!url.startsWith('data:image/png;base64,'))throw Error('Invalid fixture PNG');fs.writeFileSync(path.join(output,name),Buffer.from(url.slice(22),'base64'));});
 stage='loading';await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load',timeout:20000});
 if(diagnostics.pageErrors.length||diagnostics.consoleErrors.length||diagnostics.requestFailures.length)throw Error('Fixture module loading failed');
 await page.waitForFunction(()=>typeof window.runProbe==='function',undefined,{timeout:20000});guard.assertHealthy();
 stage='rendering';result=await page.evaluate(()=>window.runProbe());guard.assertHealthy();
 if(diagnostics.pageErrors.length||diagnostics.consoleErrors.length||diagnostics.requestFailures.length||diagnostics.deadline)throw Error('Fixture runtime errors');
 stage='complete';fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({...prepared,...result,sourceHashes,diagnostics},null,2)+'\n');console.log(JSON.stringify({ok:true,output,images:result.images,depthEvidence:result.depthEvidence,edgeEvidence:result.edgeEvidence}));
}catch(error){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(guard.error??error),stack:error.stack,stage,sourceHashes,diagnostics},null,2)+'\n');throw guard.error??error;}
finally{
 clearTimeout(deadline);guard.stop();
 try{await browser?.close();}
 finally{
  try{server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));}
  finally{try{await guard.finish();}finally{fs.writeFileSync(path.join(output,'memory.json'),JSON.stringify(diagnostics.memoryGuard??null,null,2)+'\n');}}
 }
}
