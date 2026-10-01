// Only --gpu launches a single 128px context. Coordinate the exclusive slot first.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {readGroundStudyBaseline,GROUND_STUDY_BASELINE_FILES} from './studies/ground-study-baseline.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),evidenceRoot=path.join(root,'artifacts/refinement-2026-09-30/ground-layer-pruning-gpu');
const outputArg=process.argv.find(arg=>arg.startsWith('out='))?.slice(4);
const output=outputArg?path.resolve(root,outputArg):path.join(evidenceRoot,'replays',new Date().toISOString().replaceAll(':','-'));
// Preserve the original GPU evidence and bind the candidate to actual current
// source, never to a second application of the already-integrated proposal.
assert.notEqual(output,evidenceRoot,'Choose a fresh output folder; original GPU evidence is immutable');
assert.ok(!fs.existsSync(path.join(output,'results.json')),'Choose a fresh output folder; completed replay evidence cannot be overwritten');
const baseline=readGroundStudyBaseline(),ground=baseline.ground,terrain=baseline.terrain;
const candidate=fs.readFileSync(path.join(root,'src/render/ground-materials.ts'),'utf8'),terrainCandidate=fs.readFileSync(path.join(root,'src/world/terrain.ts'),'utf8');
const sha=source=>createHash('sha256').update(source).digest('hex'),productionHashes={ground:sha(candidate),terrain:sha(terrainCandidate)};
assert.ok(candidate.includes('export const groundLayerPruning='),'Current candidate does not expose the integrated study');
function continuation(source,variant){
 const start=source.indexOf(' const material=createGroundMaterial(t',source.indexOf('function createCoastalContinuation('));
 const end=source.indexOf(' const mesh=new THREE.Mesh(geometry,material);',start);
 assert.ok(start>0&&end>start,'Actual continuation wrapper boundaries changed');
 return`import {createGroundMaterial} from '/virtual/${variant}.ts';\nexport function createContinuationMaterial(t){\n${source.slice(start,end)}\nreturn material;}`;
}
function selectedExports(filename,names){
 const text=fs.readFileSync(path.join(root,filename),'utf8'),source=ts.createSourceFile(filename,text,ts.ScriptTarget.Latest,true);
 return source.statements.filter(node=>ts.isVariableStatement(node)?node.declarationList.declarations.some(d=>names.includes(d.name.getText(source))):ts.isFunctionDeclaration(node)&&names.includes(node.name?.text)).map(node=>node.getText(source)).join('\n');
}
const habitatSource=`import * as THREE from 'three';\n${selectedExports('src/world/habitat.ts',['habitatGLSL'])}\nexport const habitatUniform={value:new THREE.DataTexture(new Uint8Array([90,155,220,120,150,170,190,240,190,110,255,190,80,200,230,160]),2,2,THREE.RGBAFormat)};habitatUniform.value.minFilter=habitatUniform.value.magFilter=THREE.LinearFilter;habitatUniform.value.needsUpdate=true;`;
const mathSource=selectedExports('src/world/math.ts',['clamp','smooth','shoreZ','shoreDistance','noiseGLSL','shorelineGLSL']);
const virtual=new Map([
 ['/virtual/original.ts',{source:ground,base:'src/render/ground-materials.ts'}],
 ['/virtual/candidate.ts',{source:candidate,base:'src/render/ground-materials.ts'}],
 ['/virtual/original-continuation.ts',{source:continuation(terrain,'original'),base:'src/world/terrain.ts'}],
 ['/virtual/candidate-continuation.ts',{source:continuation(terrainCandidate,'candidate'),base:'src/world/terrain.ts'}],
 ['/src/world/habitat.ts',{source:habitatSource,base:'src/world/habitat.ts'}],
 ['/src/world/math.ts',{source:mathSource,base:'src/world/math.ts'}],
]);
function compile(source,base){
 const rewritten=source.replace(/(from\s*['"])(\.[^'"]+)(['"])/g,(_match,prefix,specifier,suffix)=>{
  let resolved=path.posix.normalize(path.posix.join(path.posix.dirname(base),specifier));if(!path.posix.extname(resolved))resolved+='.ts';return prefix+'/'+resolved+suffix;
 });
 return ts.transpileModule(rewritten,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
}
const html=fs.readFileSync(path.join(root,'scripts/control/studies/ground-layer-pruning-fixture.html'),'utf8'),modules=new Map();
const cases=[
 {name:'pure-sand-near',kind:'core',origin:[10,.15,106],span:[2.13,3.19],normal:[.13,1,.04],maskPattern:0,maskOffset:0,bedding:1,mineral:0},
 {name:'mixed-quad-phase-seams',kind:'core',origin:[53,4,110],span:[35.17,47.71],normal:[.34,.83,.19],maskPattern:1,maskOffset:0,bedding:1,mineral:0},
 {name:'grazing-anisotropic-bedding-off',kind:'core',origin:[-143,10,75],span:[1.13,501.7],normal:[.66,.68,.17],maskPattern:1,maskOffset:1,bedding:0,mineral:0},
 {name:'mixed-mineral-positive',kind:'core',origin:[171,25,35],span:[26.91,71.13],normal:[.68,.52,.25],maskPattern:1,maskOffset:2,bedding:1,mineral:.65},
 {name:'continuation-rewritten-pure-core-sand',kind:'continuation',origin:[1100,22,-500],span:[58.73,183.19],normal:[.47,.69,.54],maskPattern:0,maskOffset:0,bedding:1,mineral:.65},
 {name:'continuation-rewritten-mixed',kind:'continuation',origin:[-1100,5,-500],span:[1.47,218.33],normal:[.71,.47,.51],maskPattern:1,maskOffset:1,bedding:0,mineral:.65},
 {name:'rock-positive-mineral',kind:'rock',origin:[73,18,121],span:[43.71,87.19],normal:[.44,.71,.28],maskPattern:0,maskOffset:0,bedding:1,mineral:.65},
];
fs.mkdirSync(output,{recursive:true});
const prepared={kind:'ground material differential fixture',size:128,baselineRef:baseline.ref,baselineFiles:GROUND_STUDY_BASELINE_FILES,productionHashes,candidateSHA256:sha(candidate),cases,sandRippleFilter:0,sourceRoutes:'frozen baseline material/continuation from c604d90; actual current candidate material/continuation; isolated source-derived GLSL math and diagnostic 2x2 habitat texture',productionModified:false};
fs.writeFileSync(path.join(output,'prepared.json'),JSON.stringify(prepared,null,2)+'\n');
if(!process.argv.includes('--gpu')){console.log(JSON.stringify({prepared:true,gpuStarted:false,output,cases:cases.length,productionHashes}));process.exit(0);}
const memory=()=>Number(fs.readFileSync('/sys/fs/cgroup/memory.current','utf8')),GiB=1024**3;
const initialMemory=memory();assert.ok(initialMemory<6*GiB,'Start blocked: memory.current must be below 6 GiB, got '+initialMemory/GiB);
const requests=[],pageErrors=[],consoleErrors=[],requestFailures=[],rows=[],pairs=[];
const server=http.createServer((request,response)=>{
 try{
  const url=new URL(request.url,'http://localhost').pathname;requests.push(url);
  let body,type;
  if(url==='/'){body=html;type='text/html';}
  else if(virtual.has(url)){if(!modules.has(url)){const item=virtual.get(url);modules.set(url,compile(item.source,item.base));}body=modules.get(url);type='text/javascript';}
  else if(url.startsWith('/src/')&&url.endsWith('.ts')){const local=path.join(root,url);assert.ok(local.startsWith(path.join(root,'src')+'/'));if(!modules.has(url))modules.set(url,compile(fs.readFileSync(local,'utf8'),url.slice(1)));body=modules.get(url);type='text/javascript';}
  else if(url.startsWith('/three/')){body=fs.readFileSync(path.join(root,'node_modules/three/build',path.basename(url)));type='text/javascript';}
  else if(url.startsWith('/source256/')){body=fs.readFileSync(path.join(evidenceRoot,'source256',path.basename(url)));type='image/png';}
  else{response.writeHead(404).end();return;}
  response.writeHead(200,{'content-type':type,'cache-control':'no-store'}).end(body);
 }catch(error){response.writeHead(500).end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser,page,peakMemory=initialMemory,aborted=null,monitor,metadata,started=Date.now();
function statsDifference(a,b){
 let changedComponents=0,changedPixels=0,maximumAbsolute=0,sumSquares=0;const first=[];
 for(let p=0;p<a.length;p+=4){let changed=false;for(let c=0;c<4;c++){
  const delta=Math.abs(a[p+c]-b[p+c]);if(delta!==0){changedComponents++;changed=true;maximumAbsolute=Math.max(maximumAbsolute,delta);sumSquares+=delta*delta;if(first.length<12)first.push({pixel:p/4,channel:c,before:a[p+c],after:b[p+c],absolute:delta});}
 }if(changed)changedPixels++;}
 return{changedComponents,changedPixels,maximumAbsolute,rmse:Math.sqrt(sumSquares/a.length),firstDifferences:first};
}
try{
 const {chromium}=await import('playwright');
 browser=await chromium.launch({executablePath:process.env.BAY_BROWSER_EXECUTABLE||'/workspace/scratch/46479389b383/forest-capture-runtime/browser/chromium',headless:true,timeout:60000,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--force-color-profile=srgb']});
 monitor=setInterval(()=>{const current=memory();peakMemory=Math.max(peakMemory,current);if(current>7.25*GiB&&!aborted){aborted='Memory guard exceeded 7.25 GiB';browser.close().catch(()=>{});}},500);
 page=await browser.newPage({viewport:{width:128,height:128},deviceScaleFactor:1});page.setDefaultTimeout(30000);
 page.on('pageerror',error=>pageErrors.push(String(error)));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});page.on('requestfailed',request=>requestFailures.push({url:request.url(),error:request.failure()?.errorText}));
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load',timeout:30000});
 await page.waitForFunction(()=>window.groundProbe||document.body.textContent.includes('ERROR'),{timeout:30000});metadata=await page.evaluate(()=>window.groundProbe.metadata());
 for(const textureKind of ['synthetic','source256'])for(const fixture of cases){
  const results=[];const modes=fixture.kind==='rock'?[['original',0],['candidate',2]]:[['original',0],['candidate',0],['candidate',1],['candidate',2]];
  for(const [variant,mode]of modes){
   if(aborted)throw Error(aborted);assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(requestFailures,[]);
   const label=textureKind+'-'+fixture.name+'-'+variant+'-'+mode,begin=Date.now();console.log('Rendering '+label);
   let timer;const result=await Promise.race([page.evaluate(args=>window.groundProbe.render(args),{...fixture,textureKind,variant,mode}),new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(Error('Render deadline exceeded: '+label)),45000);})]).finally(()=>clearTimeout(timer));
   const bytes=Buffer.from(result.pixels,'base64'),pixels=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
   fs.writeFileSync(path.join(output,label+'.png'),Buffer.from(result.png.split(',')[1],'base64'));
   const row={label,textureKind,fixture:fixture.name,kind:fixture.kind,variant,mode,milliseconds:Date.now()-begin,statistics:result.statistics};rows.push(row);results.push({row,pixels:new Float32Array(pixels),bytes});
   fs.writeFileSync(path.join(output,'status.json'),JSON.stringify({last:row.label,frames:rows.length,memoryBytes:memory(),timestamp:new Date().toISOString()})+'\n');
  }
  for(let i=1;i<results.length;i++){
   const previous=results[i-1],current=results[i],difference=statsDifference(previous.pixels,current.pixels);
   const pair={textureKind,fixture:fixture.name,kind:fixture.kind,from:previous.row.label,to:current.row.label,...difference};pairs.push(pair);
   if(difference.changedComponents){fs.writeFileSync(path.join(output,previous.row.label+'.f32'),previous.bytes);fs.writeFileSync(path.join(output,current.row.label+'.f32'),current.bytes);}
  }
 }
 assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(requestFailures,[]);if(aborted)throw Error(aborted);
 const result={...prepared,completed:true,metadata,rows,pairs,allPairsFloatExact:pairs.every(pair=>pair.changedComponents===0),pageErrors,consoleErrors,requestFailures,initialMemory,peakMemory,elapsedMilliseconds:Date.now()-started,
  limitations:['Synthetic masks/world footprints, not the full scene','Source256 inputs are downsampled diagnostic copies; original production sampler settings are retained','No claimed GPU speedup','PNG previews are sRGB encodings of real linear target pixels','Actual continuation shader hook is retained; continuation geometry is a tiny diagnostic plane']};
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({completed:true,output,frames:rows.length,pairs:pairs.length,allPairsFloatExact:result.allPairsFloatExact,changedPairs:pairs.filter(pair=>pair.changedComponents).map(({fixture,textureKind,from,to,changedPixels,maximumAbsolute})=>({fixture,textureKind,from,to,changedPixels,maximumAbsolute})),peakMemoryGiB:peakMemory/GiB}));
}catch(error){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(error),aborted,pageErrors,consoleErrors,requestFailures,requests,rows,pairs,initialMemory,peakMemory,elapsedMilliseconds:Date.now()-started},null,2)+'\n');throw error;}
finally{
 clearInterval(monitor);if(page&&!page.isClosed())await page.evaluate(()=>window.groundProbe?.dispose()).catch(()=>{});
 await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 assert.equal(sha(fs.readFileSync(path.join(root,'src/render/ground-materials.ts'),'utf8')),productionHashes.ground,'Production material changed during fixture');
 assert.equal(sha(fs.readFileSync(path.join(root,'src/world/terrain.ts'),'utf8')),productionHashes.terrain,'Production terrain changed during fixture');
}
