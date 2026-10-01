/** Ordinary application smoke; prepare only unless --run is explicitly supplied.
 * node --experimental-strip-types scripts/control/check-ordinary-app.mjs --prepare-only
 * node --experimental-strip-types scripts/control/check-ordinary-app.mjs --run dist=dist out=NEW_DIRECTORY
 * Uses production capture guards/transport, changing only the navigation URL.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {browserCapture,parseOptions,runProgressCapture} from '../progress-capture.mjs';
import {sourceIdentity,sha256} from './capture-integrity.mjs';
import {writeAtomicJson} from './progress-checkpoints.mjs';
import {withDeadline} from './capture-run.mjs';
import {canonicalLook} from '../../src/app/canonical-look.ts';

const root=fileURLToPath(new URL('../../',import.meta.url));
const values=new Map(Object.entries({width:'320',height:'180',dist:'dist',out:'artifacts/refinement-2026-09-30/ordinary-app-01',
 memoryStartMiB:'6144',memoryLimitMiB:'7424',memoryMetric:'working',jsHeapMiB:'384',readyTimeout:'300000',writeTimeout:'180000',backend:'software'}));
const allowed=new Set([...values.keys(),'networkTimeout','source']);
const seen=new Set();let run=false,explicitMode=false,expectedSource;
for(const argument of process.argv.slice(2)){
 if(argument==='--run'||argument==='--prepare-only'){
  assert.equal(explicitMode,false,'Choose one mode');explicitMode=true;run=argument==='--run';continue;
 }
 const split=argument.indexOf('='),key=argument.slice(0,split),value=argument.slice(split+1);
 assert.ok(split>0&&allowed.has(key)&&value&&!seen.has(key),'Unknown or repeated argument: '+argument);seen.add(key);
 if(key==='source')expectedSource=value;else values.set(key,value);
}
expectedSource??=sourceIdentity(root);
assert.match(expectedSource,/^[a-f0-9]{64}$/,'Invalid expected source identity');
const options=parseOptions([...values].map(([key,value])=>key+'='+value),root);
assert.ok([[320,180],[640,360]].some(([width,height])=>options.width===width&&options.height===height),'Use a bounded 320x180 or 640x360 ordinary-app viewport');
options.timeline=[{view:'10.5',label:'ordinary-app-default-10.500'}];
options.profile={};
assert.equal(options.video,false);assert.equal(options.resume,false);
fs.mkdirSync(options.output,{recursive:true});
assert.equal(fs.existsSync(path.join(options.output,'manifest.json')),false,'Choose an output without an existing capture manifest');
const metadata={kind:'ordinary-app-verification',createdAt:new Date().toISOString(),executed:false,verified:false,
 captureMode:false,inspectionMode:false,productionCaptureImplementationChanged:false,
 expectedSourceIdentity:expectedSource,canonicalLook,canonicalLookSHA256:sha256(fs.readFileSync(path.join(root,'src/app/canonical-look.ts'))),
 harnessSHA256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
 viewport:{width:options.width,height:options.height},bundleDirectory:options.dist,
 mode:options.backend,guards:{memoryStartMiB:options.memoryStartMiB,memoryLimitMiB:options.memoryLimitMiB,memoryMetric:options.memoryMetric,jsHeapMiB:options.jsHeapMiB,readyTimeout:options.readyTimeout,writeTimeout:options.writeTimeout},
 navigationPolicy:'Remove capture=1 only; preserve quality=high and actual app startup/warmup.',
 profileApplied:{},checks:[],navigation:[],requests:[],outputFrame:'ordinary-app-default-10.500.png',
 limitations:['One paused 10.5-second canvas frame, not animation/performance acceptance.','Ordinary app startup includes its real multi-time warmup.','Low/high switch checks atlas state and network reuse; only restored high output is saved.']};
if(!run){
 writeAtomicJson(path.join(options.output,'ordinary-app-preparation.json'),metadata);
 console.log(JSON.stringify({preparedOnly:true,browserLaunched:false,output:options.output,expectedSourceIdentity:expectedSource,viewport:metadata.viewport}));
 process.exit(0);
}

let page;
async function launchOrdinaryBrowser(launchOptions){
 const {chromium}=await import('playwright');
 const browser=await chromium.launch(launchOptions),newContext=browser.newContext.bind(browser);
 browser.newContext=async contextOptions=>{
  const context=await newContext(contextOptions),newPage=context.newPage.bind(context);
  context.newPage=async()=>{
   assert.equal(page,undefined,'Ordinary-app harness owns exactly one page');
   page=await newPage();
   page.on('request',request=>metadata.requests.push({url:request.url(),method:request.method(),resourceType:request.resourceType()}));
   const goto=page.goto.bind(page);
   page.goto=(address,navigationOptions)=>{
    const url=new URL(address);
    assert.equal(url.searchParams.get('capture'),'1');assert.equal(url.searchParams.get('quality'),'high');assert.equal(url.searchParams.has('inspect'),false);
    url.searchParams.delete('capture');metadata.navigation.push({requested:address,actual:url.href});
    return goto(url.href,navigationOptions);
   };
   return page;
  };
  return context;
 };
 return browser;
}
const bounded=(promise,label)=>withDeadline(promise,options.writeTimeout,label);
async function state(){
 return bounded(page.evaluate(()=>{
  const api=window.lastLightBay,canvas=document.getElementById('world');
  return {url:location.href,ready:api.ready,error:api.error,build:api.build,quality:document.getElementById('quality').value,
   captureClass:document.body.classList.contains('capture'),inspectionControls:!!document.getElementById('review-controls'),
   canvas:[canvas.width,canvas.height],contextAttributes:canvas.getContext('webgl2').getContextAttributes(),
   lighting:api.getLighting(),surface:api.getSurfaceStudy(),response:api.getIslandDirectResponseStudy(),
   blending:api.getFarCrownBlending(),linear:api.getLinearMainOutput(),reflection:api.getCoastalReflection()};
 }), 'Ordinary-app state read');
}
function assertDefaults(actual){
 const url=new URL(actual.url);
 assert.equal(url.searchParams.has('capture'),false);assert.equal(url.searchParams.has('inspect'),false);
 assert.equal(actual.captureClass,false);assert.equal(actual.inspectionControls,false);
 assert.equal(actual.ready,true);assert.equal(actual.error,null);assert.equal(actual.quality,'high');
 assert.equal(actual.build.production,true);assert.equal(actual.build.sourceIdentity,expectedSource);
 assert.deepEqual(actual.canvas,[options.width,options.height]);assert.equal(actual.contextAttributes.preserveDrawingBuffer,true);
 for(const [key,value] of Object.entries(canonicalLook.lighting))assert.deepEqual(actual.lighting[key],value,'Canonical lighting '+key);
 for(const [key,value] of Object.entries(canonicalLook.surfaceStudy))assert.deepEqual(actual.surface[key],value,'Canonical surface '+key);
 assert.equal(actual.response.ready,true);assert.equal(actual.response.loading,false);assert.equal(actual.response.enabled,canonicalLook.islandDirectResponse);assert.equal(actual.response.error,null);
 assert.equal(actual.blending.enabled,canonicalLook.farCrownBlending);
 assert.equal(actual.linear.enabled,false);assert.equal(actual.linear.sampleScale,1);
 assert.equal(actual.reflection.supported,true,'This verification context must support the accepted reflection path');
 assert.equal(actual.reflection.enabled,canonicalLook.coastalReflection);
 assert.equal(actual.reflection.distortion,canonicalLook.coastalReflectionDistortion);
}
async function ordinaryCaptureFactory(captureOptions){
 assert.equal(captureOptions.islandResponseNeeded,false,'No capture-side atlas preload may replace app startup');
 const capture=await browserCapture(captureOptions,{launchBrowser:launchOrdinaryBrowser});
 captureOptions.diagnostics.ordinaryApp=metadata;
 try{
  metadata.initial=await state();assertDefaults(metadata.initial);metadata.checks.push('Actual normal startup matches canonical look before any study setter');
  const rejection=await bounded(page.evaluate(()=>{
   const api=window.lastLightBay,before=api.getLighting();let error=null;
   try{api.setLighting({exposure:before.exposure+.1});}catch(reason){error=String(reason);}
   return {error,before,after:api.getLighting()};
  }),'Ordinary-app access guard');
  assert.match(rejection.error??'',/Study controls require capture or inspection mode/);assert.deepEqual(rejection.after,rejection.before);
  metadata.guardRejection=rejection;metadata.checks.push('Public setLighting rejects normal mode without mutation');
  const requestCount=metadata.requests.length;
  await bounded(page.selectOption('#quality','low'),'Ordinary-app low quality UI change');
  metadata.low=await state();assert.equal(metadata.low.ready,true);assert.equal(metadata.low.quality,'low');
  assert.equal(metadata.low.response.ready,true);assert.equal(metadata.low.response.enabled,false);assert.equal(metadata.low.response.loading,false);
  assert.equal(metadata.low.reflection.enabled,false);
  assert.equal(metadata.requests.length,requestCount,'Low quality unexpectedly fetched a resource');
  await capture.healthy();
  await bounded(page.selectOption('#quality','high'),'Ordinary-app high quality UI change');
  metadata.restored=await state();assertDefaults(metadata.restored);
  assert.equal(metadata.requests.length,requestCount,'Restoring high quality unexpectedly fetched a resource');
  assert.equal(metadata.restored.response.dataSHA256,metadata.initial.response.dataSHA256);
  metadata.qualitySwitchRequests={before:requestCount,after:metadata.requests.length,additional:0};
  metadata.checks.push('Low/high UI quality switch disables/restores validated forest response and coastal reflection without a new resource request');
  await capture.healthy();
  const renderFrame=capture.renderFrame.bind(capture);
  capture.renderFrame=entry=>bounded(renderFrame(entry),'Ordinary-app renderAt and PNG');
  return capture;
 }catch(error){await capture.diagnose(error);await capture.close();throw error;}
}

metadata.executed=true;
try{
 const result=await runProgressCapture(options,{captureFactory:ordinaryCaptureFactory});
 metadata.verified=true;metadata.result=result;metadata.finishedAt=new Date().toISOString();
 metadata.checks.push('Saved actual normal-app high-quality canvas at 10.5 seconds through public renderAt');
 writeAtomicJson(path.join(options.output,'ordinary-app-verification.json'),metadata);
 console.log(JSON.stringify({ordinaryAppVerified:true,output:options.output,frame:metadata.outputFrame,sourceIdentity:expectedSource}));
}catch(error){
 metadata.error=String(error);metadata.failedAt=new Date().toISOString();
 writeAtomicJson(path.join(options.output,'ordinary-app-verification.json'),metadata);
 console.error(error);process.exitCode=1;
}
