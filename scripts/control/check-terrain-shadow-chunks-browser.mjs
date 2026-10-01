import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import ts from 'typescript';
import {chromium} from 'playwright';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),output=path.join(root,'artifacts/refinement-2026-09-30/terrain-shadow-chunks/browser-02');
await fs.mkdir(output,{recursive:true});
const memory=async()=>Number((await fs.readFile('/sys/fs/cgroup/memory.current','utf8')).trim());
const before=await memory();if(before>=6*1024**3)throw Error('Hold tiny terrain probe: current memory is at least6GiB');
const html='<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><canvas id="world"></canvas><script type="importmap">{"imports":{"three":"/three.module.js","three/addons/":"/addons/"}}</script><script type="module" src="/scripts/control/terrain-shadow-chunks-probe-page.mjs"></script>';
const sourceHashes={},cache=new Map(),errors=[],requests=[];let browser,peak=before,memoryTimer,totalTimer;
async function route(url){
 if(url==='/')return {body:html,type:'text/html'};
 let filename;
 if(['/three.module.js','/three.core.js'].includes(url))filename=path.join(root,'node_modules/three/build',url.slice(1));
 else if(url.startsWith('/addons/'))filename=path.join(root,'node_modules/three/examples/jsm',url.slice(8));
 else if(url.startsWith('/src/')||url.startsWith('/scripts/control/'))filename=path.join(root,url.slice(1));
 else return null;
 if(!filename.startsWith(root+path.sep)||!['.mjs','.js','.ts'].includes(path.extname(filename)))return null;
 if(!cache.has(filename)){
  let body=await fs.readFile(filename);sourceHashes[path.relative(root,filename)]=crypto.createHash('sha256').update(body).digest('hex');
  if(filename.endsWith('.ts'))body=ts.transpileModule(body.toString(),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/((?:from\s*|import\s*)['"])(\.{1,2}\/[^'"]+)(['"])/g,(_,a,b,c)=>a+(/\.[a-z0-9]+$/i.test(b)?b:b+'.ts')+c);
  cache.set(filename,{body,type:'text/javascript'});
 }return cache.get(filename);
}
const server=http.createServer(async(req,res)=>{try{const value=await route(new URL(req.url,'http://localhost').pathname);if(!value){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':value.type,'cache-control':'no-store'}).end(value.body);}catch(error){errors.push(String(error));res.writeHead(500).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const started=Date.now();let result;
try{
 browser=await chromium.launch({executablePath:process.env.BAY_BROWSER_EXECUTABLE??'/workspace/scratch/46479389b383/forest-capture-runtime/browser/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--force-color-profile=srgb']});
 totalTimer=setTimeout(()=>{errors.push('240s probe deadline');browser.close();},240000);
 memoryTimer=setInterval(async()=>{const current=await memory();peak=Math.max(peak,current);if(current>7.25*1024**3){errors.push('7.25GiB memory guard');browser.close();}},1000);
 const page=await browser.newPage({viewport:{width:256,height:256},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>requests.push({url:r.url(),failure:r.failure()}));
 await page.exposeFunction('savePNG',async(name,url)=>{if(!/^[a-z0-9-]+\.png$/.test(name)||!url.startsWith('data:image/png;base64,'))throw Error('Invalid PNG');await fs.writeFile(path.join(output,name),Buffer.from(url.slice(22),'base64'));});
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load',timeout:30000});await page.waitForFunction(()=>typeof window.runProbe==='function',undefined,{timeout:30000});
 result=await page.evaluate(()=>window.runProbe());if(errors.length||requests.length)throw Error('Probe runtime errors');
 await fs.writeFile(path.join(output,'results.json'),JSON.stringify({...result,sourceHashes,errors,requests,wallMilliseconds:Date.now()-started},null,2)+'\n');
 console.log(JSON.stringify({ok:true,rows:result.rows,wallMilliseconds:Date.now()-started}));
}catch(error){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({error:String(error),stack:error.stack,errors,requests,sourceHashes,wallMilliseconds:Date.now()-started},null,2)+'\n');throw error;}
finally{clearInterval(memoryTimer);clearTimeout(totalTimer);await browser?.close();await new Promise(resolve=>server.close(resolve));await fs.writeFile(path.join(output,'memory.json'),JSON.stringify({before,peak,after:await memory()},null,2)+'\n');}
