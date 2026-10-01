// CPU/file-only preparation. Never imports a browser or launches a capture.
// Run: node scripts/control/prepare-post-film-plan.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseOptions} from '../progress-capture.mjs';
import {canonical,validateProfile,validateTimeline,writeAtomicJson} from './progress-checkpoints.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
assert.ok(process.argv.slice(2).every(x=>x==='--check'),'Only --check is supported');
const checkOnly=process.argv.includes('--check');
const base='artifacts/refinement-2026-09-30/';
const inputs={baseline:base+'coastal-reflection/actual-scene-profile.json',
 source:base+'source-response-plan-v3.json',coast:base+'coastal-reflection/actual-scene-plan.json',
 coastContract:base+'coastal-reflection/actual-scene-plan-contract.json'};
const outputs={plan:base+'post-film-plan.json',effective:base+'post-film-effective-profiles.json',
 contract:base+'post-film-plan-contract.json'};
const expectedSourceIdentity='5b3479529a796233889fd2de92d044f0aba207d73933c932ccb34c85b495e248';
const expectedDistEntry='dist/assets/index-Cv_z3WVV.js';
const expectedDistEntrySha256='0d3db1ab36d8f141dea8b9ba969ff5881177edbc5c8ea5c6cc27a053852da6b4';
const read=p=>fs.readFileSync(path.join(root,p));
const json=p=>JSON.parse(read(p));
const hash=v=>createHash('sha256').update(v).digest('hex');
const inputHashes=Object.fromEntries(Object.values(inputs).map(p=>[p,hash(read(p))]));
const encode=value=>JSON.stringify(value,null,2)+'\n';
const clone=value=>structuredClone(value);
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const nested=new Set(['lighting','surfaceStudy','shadowStudy']);
const settingsOf=entry=>Object.fromEntries(Object.entries(entry).filter(([key])=>key!=='view'&&key!=='label'));
const baseline=validateProfile(json(inputs.baseline));
assert.equal(baseline.surfaceStudy.grassPalette,0);

// The complete baseline defines the setting vocabulary as well as default
// values. Materialize each source sequence independently before any reordering.
function apply(state,settings){
 validateProfile(settings);
 const next=clone(state);
 for(const [key,value]of Object.entries(settings)){
  assert.ok(Object.hasOwn(baseline,key),'Unknown baseline setting: '+key);
  if(nested.has(key)){
   for(const child of Object.keys(value))assert.ok(Object.hasOwn(baseline[key],child),'Unknown nested setting: '+key+'.'+child);
   Object.assign(next[key],value);
  }else next[key]=value;
 }
 return canonical(next);
}
function materialize(file,group){
 let state=clone(baseline);
 return validateTimeline(json(file)).map((entry,sourceIndex)=>{
  state=apply(state,settingsOf(entry));
  return {view:entry.view,label:entry.label,group,sourcePlan:file,sourceIndex,profile:clone(state)};
 });
}
function delta(previous,desired){
 const changed={};
 for(const [key,value]of Object.entries(desired)){
  if(nested.has(key)){
   const part={};for(const [child,v]of Object.entries(value))if(!equal(previous[key][child],v))part[child]=v;
   if(Object.keys(part).length)changed[key]=part;
  }else if(!equal(previous[key],value))changed[key]=value;
 }
 return canonical(changed);
}
function changedPaths(a,b){
 return Object.entries(delta(a,b)).flatMap(([key,v])=>nested.has(key)?Object.keys(v).map(k=>key+'.'+k):[key]).sort();
}
const source=materialize(inputs.source,'source-visual');
const coast=materialize(inputs.coast,'coastal-reflection-and-film');
assert.equal(source.length,24);assert.equal(coast.length,8);
const nearLabels=['near-crown-native','near-crown-linear-1x','near-crown-linear-2x','near-crown-native-restored'];
const timingLabels=['terrain-shadow-off','terrain-shadow-on','terrain-shadow-on-repeat','terrain-shadow-off-restored'];
const sourceByLabel=new Map(source.map(x=>[x.label,x]));
for(const label of [...nearLabels,...timingLabels])assert.ok(sourceByLabel.has(label),'Missing required original label: '+label);
const near=nearLabels.map(label=>({...sourceByLabel.get(label),group:'near-crown-sampling-first'}));
const timing=timingLabels.map(label=>({...sourceByLabel.get(label),group:'terrain-profiling-last'}));
const remaining=source.filter(row=>!nearLabels.includes(row.label)&&!timingLabels.includes(row.label));
assert.equal(remaining.length,16);
assert.ok(timing.every(row=>row.profile.profiling===true));

const grassLabels=['grass-palette-off-12','grass-palette-on-12','grass-palette-off-restored-12'];
const grass=grassLabels.map((label,index)=>({view:12,label,group:'grass-palette-first',
 sourcePlan:null,sourceIndex:null,profile:apply(baseline,{surfaceStudy:{grassPalette:index===1?1:0}})}));
const cloud=[];
for(const [coverage,suffix]of [[.9,'09'],[.65,'065']]){
 for(const [view,pose]of [[0,'opening'],[10.5,'shore'],[19.5,'sunset']]){
  cloud.push({view,label:pose+'-cloud-morphology-'+suffix,group:'cloud-morphology',
   sourcePlan:null,sourceIndex:null,
   profile:apply(baseline,{lighting:{cloudCoverage:coverage,cloudMorphology:true}})});
 }
}
for(const morphology of [false,true]){
 for(const [view,pose]of [[0,'opening'],[10.5,'shore'],[19.5,'sunset']]){
  cloud.push({view,label:pose+'-cloud-'+(morphology?'morphology':'coverage')+'-04',
   group:morphology?'cloud-morphology':'cloud-coverage-controls',sourcePlan:null,sourceIndex:null,
   profile:apply(baseline,{lighting:{cloudCoverage:.4,cloudMorphology:morphology}})});
 }
}
const effective=[...grass,...near,...remaining,...coast,...cloud,...timing];
assert.equal(effective.length,47);
assert.equal(new Set(effective.map(x=>x.label)).size,47);
assert.deepEqual(effective.slice(0,3).map(x=>x.label),grassLabels);
assert.deepEqual(effective.slice(3,7).map(x=>x.label),nearLabels);
assert.deepEqual(effective.slice(-4).map(x=>x.label),timingLabels);
assert.deepEqual(effective.filter(row=>row.profile.profiling).map(row=>row.label),timingLabels);
for(const original of [...source,...coast]){
 const reordered=effective.find(x=>x.label===original.label);
 assert.ok(reordered);assert.equal(reordered.view,original.view);
 assert.deepEqual(reordered.profile,original.profile,'Reordering changed effective settings: '+original.label);
}

const byLabel=new Map(effective.map((row,index)=>[row.label,{...row,index}]));
const baselineLabels=['grass-palette-off-12','grass-palette-off-restored-12',
 'near-crown-native','near-crown-native-restored','opening-baseline','descent-baseline',
 'shore-old-sand','sunset-old-sand','spur-reference-9','shore-off','nearby-off','shore-off-restored'];
for(const label of baselineLabels)assert.deepEqual(byLabel.get(label).profile,baseline,'Baseline equivalence failed: '+label);
assert.deepEqual(byLabel.get('shore-off').profile,byLabel.get('shore-off-restored').profile);
for(const row of effective){
 assert.ok(row.profile.lighting.cloudCoverage>=.4&&row.profile.lighting.cloudCoverage<=1.15);
 assert.equal(row.profile.surfaceStudy.grassPalette,row.label==='grass-palette-on-12'?1:0);
 assert.equal(row.profile.linearMainSampleScale,row.label==='near-crown-linear-2x'?2:1);
 assert.equal(row.profile.linearMainOutput,['near-crown-linear-1x','near-crown-linear-2x'].includes(row.label));
 if(row.group!=='coastal-reflection-and-film'){
  assert.equal(row.profile.coastalReflection,false);assert.equal(row.profile.surfaceStudy.sandFilmDrying,0);
 }
 assert.equal(row.profile.lighting.cloudMorphology,row.group==='cloud-morphology');
}

let current=clone(baseline);
const plan=effective.map(row=>{
 const changes=delta(current,row.profile),entry={view:row.view,label:row.label,...changes};
 // Every emitted leaf changes state; no repeated full lighting object can
 // invalidate the atmosphere simply because the camera/time is different.
 for(const [key,value]of Object.entries(changes)){
  if(nested.has(key)){assert.ok(Object.keys(value).length);for(const [child,v]of Object.entries(value))assert.ok(!equal(current[key][child],v));}
  else assert.ok(!equal(current[key],value));
 }
 current=apply(current,changes);assert.deepEqual(current,row.profile);
 return entry;
});
validateTimeline(plan);

const pairs=[];
function pair(a,b,expectedChanges,decision){
 const first=byLabel.get(a),second=byLabel.get(b);
 assert.ok(first&&second,'Unknown pair label');assert.equal(first.view,second.view,'A/B camera/time differs');
 const changes=changedPaths(first.profile,second.profile);
 assert.deepEqual(changes,[...expectedChanges].sort(),'Unisolated comparison: '+a+' / '+b);
 pairs.push({a,b,aIndex:first.index,bIndex:second.index,view:first.view,changedSettings:changes,decision});
}
pair('grass-palette-off-12','grass-palette-on-12',['surfaceStudy.grassPalette'],'Judge grass palette without changing geometry, coverage, lighting or source response.');
pair('grass-palette-off-12','grass-palette-off-restored-12',[],'Require decoded RGBA equality after grass palette opt-out.');
pair('near-crown-native','near-crown-linear-1x',['linearMainOutput'],'Separate linear output from added spatial samples.');
pair('near-crown-linear-1x','near-crown-linear-2x',['linearMainSampleScale'],'Judge finer leaf sampling, retained coverage and remaining stipple.');
pair('near-crown-native','near-crown-native-restored',[],'Require decoded RGBA equality after SSAA opt-out.');
for(const pose of ['opening','descent']){
 pair(pose+'-baseline',pose+'-response',['islandDirectResponse'],'Isolate source direct response.');
 pair(pose+'-baseline',pose+'-blend',['farCrownBlending'],'Isolate far-crown blending.');
 pair(pose+'-baseline',pose+'-combined',['farCrownBlending','islandDirectResponse'],'Judge the combined crown response without attributing either isolated effect incorrectly.');
}
for(const pose of ['shore','sunset'])pair(pose+'-old-sand',pose+'-warm-sand',['surfaceStudy.sandChroma'],'Isolate sand chroma at fixed luminance/material controls.');
const coastContract=json(inputs.coastContract);
const coastDiffs=[['coastalReflection','coastalReflectionDistortion'],['coastalReflectionDistortion'],['surfaceStudy.sandFilmDrying'],['surfaceStudy.sandFilmDrying'],['coastalReflection','surfaceStudy.sandFilmDrying'],[]];
coastContract.comparisonOrder.forEach((p,i)=>pair(p.pair[0],p.pair[1],coastDiffs[i],p.decides));
for(const pose of ['opening','shore','sunset']){
 const normal=pose==='opening'?'opening-baseline':pose+'-old-sand';
 pair(normal,pose+'-clearer-clouds',['lighting.cloudCoverage'],'Isolate existing coverage 0.9 versus 0.65 with morphology off.');
 pair(normal,pose+'-cloud-morphology-09',['lighting.cloudMorphology'],'Isolate morphology at coverage 0.9.');
 pair(pose+'-clearer-clouds',pose+'-cloud-morphology-065',['lighting.cloudMorphology'],'Isolate morphology at coverage 0.65.');
 pair(pose+'-clearer-clouds',pose+'-cloud-coverage-04',['lighting.cloudCoverage'],'Isolate coverage 0.65 versus 0.4 with morphology off.');
 pair(pose+'-cloud-coverage-04',pose+'-cloud-morphology-04',['lighting.cloudMorphology'],'Isolate morphology at coverage 0.4.');
}
pair('terrain-shadow-off','terrain-shadow-on',['shadowStudy.terrainChunks'],'Retain image equality while measuring the bounded partition study at the end.');
pair('terrain-shadow-on','terrain-shadow-on-repeat',[],'Separate warmed repeat timing from first-use work.');
pair('terrain-shadow-off','terrain-shadow-off-restored',[],'Require decoded RGBA equality after terrain partition opt-out.');

// Validate the actual current production bundle, without executing its code.
const distHtml=read('dist/index.html').toString();
const entryUrls=[...distHtml.matchAll(/\bsrc=["']([^"']+\.js)["']/g)].map(m=>m[1]);
assert.equal(entryUrls.length,1,'Expected one current dist entry');
const entryPath='dist/'+entryUrls[0].replace(/^\//,'');
assert.equal(entryPath,expectedDistEntry,'Current dist entry changed; review the completed bundle before regenerating');
assert.ok(path.resolve(root,entryPath).startsWith(path.join(root,'dist')+path.sep));
const entryBytes=read(entryPath),entryText=entryBytes.toString();
assert.equal(hash(entryBytes),expectedDistEntrySha256,'Current dist entry bytes changed');
const identityMatch=entryText.match(/sourceIdentity\s*:\s*[`"']([a-f0-9]{64})[`"']/);
assert.ok(identityMatch,'Could not identify the current production bundle');
assert.equal(identityMatch[1],expectedSourceIdentity,'Current dist changed; review the expected source identity before regenerating');
const responseManifestPath='dist/assets/studies/island-response/response-manifest.json';
assert.equal(json(responseManifestPath).complete,true);
const responsePreload=[baseline,...plan].some(settings=>settings.islandDirectResponse===true);
assert.equal(responsePreload,true,'Minimal deltas must still trigger the runner response preload');

const argumentsForCapture=['width=640','height=360','dist=dist','out='+base+'post-film-review-01',
 'profile='+inputs.baseline,'plan='+outputs.plan,
 'memoryStartMiB=6144','memoryLimitMiB=7424','memoryMetric=working','jsHeapMiB=384'];
const effectiveArtifact={baselineSource:inputs.baseline,baseline:clone(baseline),frames:effective.map((row,index)=>({index,...row}))};
const countLeaves=object=>Object.entries(object).reduce((n,[k,v])=>n+(nested.has(k)?Object.keys(v).length:1),0);
const contract={
 status:'Prepared and CPU-validated only: manual environment still comparisons after user-cancelled film. Root launches manually with sufficient working-memory headroom. No browser, GPU, scheduled task or visual acceptance is part of this preparation.',
 sourceIdentity:expectedSourceIdentity,distEntry:entryPath,distEntrySha256:hash(entryBytes),
 sourceIdentityVerification:'Read from the current dist entry without executing it; the capture manifest must independently confirm the same identity.',
 excludedOldFilmControlIdentity:'ee114c8d7bf6eca95ce22fe39a35e16f00e779974c773861829e36c84c1dfbd8',
 inputSha256:inputHashes,originalPlansUntouched:true,
 plan:outputs.plan,planSha256:hash(encode(plan)),effectiveProfiles:outputs.effective,effectiveProfilesSha256:hash(encode(effectiveArtifact)),
 baselineProfile:inputs.baseline,dimensions:{width:640,height:360},frameCount:47,
 requiresBaselineProfileArgument:true,
 order:[{group:'grass palette',indices:[0,2],frames:3},{group:'near-crown sampling',indices:[3,6],frames:4},
  {group:'remaining source visuals',indices:[7,22],frames:16},{group:'coastal reflection and film',indices:[23,30],frames:8},
  {group:'cloud coverage and morphology',indices:[31,42],frames:12},{group:'terrain profiling',indices:[43,46],frames:4}],
 orderingMethod:'Each original plan is replayed against the complete actual-scene baseline first. Its full effective state is attached to each frame before reordering. Only then are minimum nested setting deltas emitted against the previous reordered frame.',
 deltaAudit:{emittedTopLevelSetterCalls:plan.reduce((n,row)=>n+Object.keys(settingsOf(row)).length,0),
  emittedLeafChanges:plan.reduce((n,row)=>n+countLeaves(settingsOf(row)),0),
  lightingSetterCallsWithinPlan:plan.filter(row=>row.lighting).map(row=>({label:row.label,changes:row.lighting})),
  initialBaselineLightingSetterCalls:1,noUnchangedLeaves:true,replayedProfilesExactlyMatchMaterializedOriginals:true},
 baselineEquivalentLabels:baselineLabels,
 coastResetSemantics:'shore-off and shore-off-restored both have the complete exact baseline state. The emitted JSON sends only fields that differ at those positions; omitting already-correct settings preserves full-reset semantics without unnecessary atmosphere invalidation.',
 sourceResetChecks:{allOriginalLabelsRetained:true,grassPaletteOneOnlyAt:'grass-palette-on-12',grassResetBeforeSSAA:true,
  ssaaTwoOnlyAt:'near-crown-linear-2x',ssaaResetBeforeRemainingVisuals:true,
  reflectionAndDryingOnlyInCoastGroup:true,cloudMorphologyOnlyInNineNewFrames:true,terrainProfilingOnlyInFinalFour:true},
 pairMap:pairs,
 unpairedReference:{label:'spur-reference-9',meaning:'Preserved source-OFF anchor. This plan does not load an east-spur build or accept geometry.'},
 reflectionOpticalChecks:coastContract.opticalFailureChecks,
 grassOpticalChecks:['Judge actual grass at the fixed 12.0-second view for implausible brightness or saturation, retained sun/shade variation and consistency with nearby vegetation.',
  'The palette switch must not move blades, change density, introduce edge halos or disturb unrelated materials. Require the off-restored frame to match the off frame in decoded RGBA.'],
 cloudOpticalChecks:['Cloud banks must remain connected volumes without recurring bulb shapes, uniform carved lines, halos, obvious layer seams or an empty horizon.',
  'Visible sky, water sky reflection and coast illumination must remain directionally consistent; inspect both coverage pairs rather than treating global brightening as morphology quality.'],
 runtimeChecks:['All 47 outputs must record the same expected current sourceIdentity. Old ee114 film frames and older candidates are reference only, never these A/B controls.',
  'Current normal dist must keep principal, broad-recess and east-spur source switches false. All noncompared inspection controls are pinned by the complete baseline/effective profiles.',
  'Require no shader, context or capture-health errors. Compare decoded RGBA for every restored pair; do not infer restoration from PNG compression hashes.',
  'Reflection ON must report ready=true,320x180,MSAA4 and the selected distortion; OFF reports ready=false. Initialized cached targets may remain allocated.',
  'A failed late timing group does not erase the earlier visual evidence, but any incomplete output remains explicitly incomplete. No timing result proves visual quality.'],
 responsePreload:{required:responsePreload,detectedFromEmittedPlan:true,manifest:responseManifestPath,
  manifestSha256:hash(read(responseManifestPath)),runnerBehavior:'Preloads ready and disabled before offline mode and before the first grass frame. This asset startup cost remains even though response comparisons occur later.'},
 captureArguments:argumentsForCapture,
 guard:{memoryMetric:'working',memoryStartMiB:6144,memoryLimitMiB:7424,jsHeapMiB:384,
  interpretation:'Conservative working estimate, not a reclamation guarantee. Fresh preflight must be below 6144 MiB. Root schedules no timer and launches only with real current headroom; never raise the guard for this plan.'},
 coverageRange:{minimum:.4,maximum:1.15,baseline:.9,defaultUnchanged:true,
  note:'Coverage 0.4 is now accepted by inspection validation. These exact off/on full-scene controls remain pending visual review; tiny sky evidence is not full-scene acceptance.'},
 finalState:{allVisualStudiesOff:true,linearMainSampleScale:1,coastalReflectionDistortion:1,
  profiling:true,note:'The final restored terrain timing frame retains profiling=true to preserve its original comparison. The owned browser closes after capture; if kept alive, setFrameProfiling(false), or reapply the complete baseline without adding a frame.'},
  acceptance:'Separate per-study decisions only. The comparisons can justify retaining or rejecting a study; they do not establish 8/10 realism, finished-environment quality, a speedup or production-default acceptance.'
};
const artifacts=new Map([[outputs.plan,plan],[outputs.effective,effectiveArtifact],[outputs.contract,contract]]);
for(const [file,value]of artifacts){
 if(checkOnly)assert.equal(read(file).toString(),encode(value),'Generated artifact differs: '+file);
 else writeAtomicJson(path.join(root,file),value);
}
const parsed=parseOptions(argumentsForCapture,root);
assert.deepEqual([parsed.width,parsed.height,parsed.timeline.length,parsed.video],[640,360,47,false]);
assert.equal(parsed.backend,'software','The default capture backend must remain software');
assert.deepEqual([parsed.memoryStartMiB,parsed.memoryLimitMiB,parsed.memoryMetric,parsed.jsHeapMiB],[6144,7424,'working',384]);
assert.deepEqual(parsed.profile,baseline);
assert.equal([parsed.profile,...parsed.timeline].some(s=>s.islandDirectResponse===true),true);
for(const [file,sha]of Object.entries(inputHashes))assert.equal(hash(read(file)),sha,'Original input changed: '+file);
console.log(JSON.stringify({mode:checkOnly?'check':'prepare',frames:47,sourceIdentity:expectedSourceIdentity,
 grassFirst:true,ssaaAfterGrass:true,timingLast:true,originalProfilesPreserved:true,baselineEquivalenceLabels:baselineLabels.length,
 pairComparisons:pairs.length,lightingChanges:contract.deltaAudit.lightingSetterCallsWithinPlan.length,
 responsePreload,cliValidated:true,noBrowser:true,files:Object.values(outputs)},null,2));
