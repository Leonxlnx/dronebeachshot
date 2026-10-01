import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {activeGroundLayers,logicalGroundLookups,proposeGroundLayerPruning,proposeGroundLayerPruningCallers} from './ground-layer-pruning-study.mjs';
import {readGroundStudyBaseline} from './ground-study-baseline.mjs';
const f=Math.fround,mix=(a,b,t)=>f(f(a*f(1-t))+f(b*t));
const blend=(v,c,m,s)=>mix(mix(mix(v.soil,v.stone,c),v.moss,m),v.sand,s);

test('historical builder uses the frozen source while live checks inspect the integrated implementation',()=>{
 const previousProposal=proposeGroundLayerPruning();
 assert.equal(createHash('sha256').update(previousProposal).digest('hex'),'6c3782c5b6b047664b9a8a81d9f4947ea8e8266131cddf20cc36d048bcdbf3bf','Reconstruction must match the candidate used by the archived GPU run');
 assert.ok(proposeGroundLayerPruningCallers().includes('createGroundMaterial(t,false)'));
 const current=fs.readFileSync(new URL('../../../src/render/ground-materials.ts',import.meta.url),'utf8');
 assert.throws(()=>proposeGroundLayerPruning(current),/already integrated/);
 assert.ok(current.includes('export const groundLayerPruning={value:0};'),'Integrated pruning must remain opt-in');
});

test('exact mask preserves nested float32 mixes at endpoints and tiny positive factors',()=>{
 const factors=[0,2**-149,2**-126,2**-24,.13,.76,f(1-2**-24),1];
 const payloads=[{soil:.73,stone:.38,moss:.112,sand:.997},{soil:-6.3,stone:12.2,moss:-.4,sand:.071},{soil:2**100,stone:2**-100,moss:2**67,sand:.2}];
 for(const c0 of factors)for(const m0 of factors)for(const s0 of factors){
  const c=f(c0),m=f(m0),s=f(s0),active=activeGroundLayers(c,m,s);
  for(const input of payloads){
   const values=Object.fromEntries(Object.entries(input).map(([k,v])=>[k,f(v)]));
   const pruned=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,active[k]?v:0]));
   assert.ok(blend(values,c,m,s)===blend(pruned,c,m,s),`Different result for ${c}, ${m}, ${s}`);
  }
 }
 assert.equal(activeGroundLayers(2**-149,0,0).stone,true,'Do not treat tiny cliff contributions as zero');
 assert.equal(activeGroundLayers(0,2**-149,0).moss,true,'Do not treat tiny moss contributions as zero');
 assert.equal(activeGroundLayers(0,0,2**-149).sand,true,'Do not treat tiny sediment contributions as zero');
 assert.equal(activeGroundLayers(f(1-2**-24),0,0).soil,true,'Do not round a near-one factor to one');
});

test('logical source lookup opportunities retain every partial layer',()=>{
 assert.equal(logicalGroundLookups(activeGroundLayers(.4,.3,.2)),48);
 assert.equal(logicalGroundLookups(activeGroundLayers(.4,.3,1)),3);
 assert.equal(logicalGroundLookups(activeGroundLayers(0,0,0)),9);
 assert.equal(logicalGroundLookups(activeGroundLayers(1,0,0)),27);
 assert.equal(logicalGroundLookups(activeGroundLayers(0,.3,.2)),21);
 assert.equal(logicalGroundLookups(activeGroundLayers(.4,0,.2)),39);
});

test('continuation cannot reuse the core masks and is explicitly isolated from the shared study',()=>{
 const terrain=fs.readFileSync(new URL('../../../src/world/terrain.ts',import.meta.url),'utf8');
 const candidate=terrain;
 assert.ok(candidate.includes('const material=createGroundMaterial(t,false);\n const baseCompile='));
 assert.ok(candidate.includes("group.name='land';const material=createGroundMaterial(t,true);"));
 // Concrete regression: core sediment=1 suppresses soil/stone/moss, but distant
 // terrain's extension uses them, then changes sediment and the other masks.
 const values={soil:.62,stone:.48,moss:.21,sand:.77},core=activeGroundLayers(0,0,1);
 const wrong=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,core[k]?v:0]));
 const extension=v=>mix(mix(v.soil,v.moss,.82),v.stone,.4);
 assert.notEqual(extension(values),extension(wrong));
 assert.notEqual(blend(values,.4,.82*(1-.4)*.76,0),blend(wrong,.4,.82*(1-.4)*.76,0));
 const material=fs.readFileSync(new URL('../../../src/render/ground-materials.ts',import.meta.url),'utf8');
 assert.ok(material.includes('createGroundMaterial(t:Textures,allowLayerPruning=false)'));
 assert.ok(material.includes('const layerPruningMode=allowLayerPruning?groundLayerPruning:{value:0};'));
 assert.ok(material.includes('uGroundLayerPruning:layerPruningMode'));
});

test('integrated source isolates the rock material and retains protected ground response paths',()=>{
 const original=readGroundStudyBaseline().ground;
 const candidate=fs.readFileSync(new URL('../../../src/render/ground-materials.ts',import.meta.url),'utf8');
 assert.equal(candidate.slice(candidate.indexOf('export function createRockMaterial')),original.slice(original.indexOf('export function createRockMaterial')),'Rock material must remain byte-identical');
 const originalProjection=original.slice(original.indexOf('const projection='),original.indexOf('function attachWorld('));
 assert.ok(candidate.includes(originalProjection),'Shared original projection helpers must remain byte-identical');
 for(const code of [
  'float sandFootprint=max(length(dFdx(gp.xz)),length(dFdy(gp.xz)));',
  'vec3 ground=mix(soil,stone,cliff);ground=mix(ground,living,moss*.76);ground=mix(ground,sand,sediment);',
  'float macro=.91+.18*fbm(gp.xz*.027),wet=sandWetness(gp.x,d,uTime);',
  'ground*=macro*mix(1.,.61,wet*sediment);diffuseColor.rgb*=ground;',
  'roughnessFactor=max(clamp(surfaceARM.g,.42,.98),.73*cliff*(1.-sediment));',
  'roughnessFactor=mix(roughnessFactor,.20,exposedFilm);',
  'detail+=mineral*uMineralRelief*cliff*(1.-sediment)*(1.-moss*.76)*(1.-wet)*smoothstep(.3,2.,gp.y);',
  'reflectedLight.indirectDiffuse*=mix(.72,1.,surfaceARM.r);',
  'if(uDebug==9.)gl_FragColor.rgb=vec3(clamp(d/100.,0.,1.));if(uDebug==12.)gl_FragColor.rgb=mix(vec3(.06,.12,.4),vec3(.3,.9,.18),habitat.a);',
 ])assert.ok(candidate.includes(code),'Lost protected ground path: '+code);
 const helpers=candidate.slice(candidate.indexOf('const groundLayerProjection='),candidate.indexOf('function attachWorld('));
 assert.ok(!/dFdx\(|dFdy\(|texture2D\(/.test(helpers),'Branched helper functions must only consume explicit gradients');
 const firstVaryingBranch=candidate.indexOf('if(groundNeedStone)');
 for(const coordinate of ['groundRockP','groundSoilP','groundMossP','groundMineralP','groundSandUV']){
  assert.ok(candidate.indexOf('dFdx('+coordinate+')')<firstVaryingBranch,'Derivative must precede varying branch: '+coordinate);
  assert.ok(candidate.indexOf('dFdy('+coordinate+')')<firstVaryingBranch,'Derivative must precede varying branch: '+coordinate);
 }
 assert.ok(helpers.includes('stoneXUV(dx),stoneXUV(dy)'),'Bedding swizzle must also select matching source gradients');
 const diagnostics=ts.transpileModule(candidate,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true}).diagnostics??[];
 assert.equal(diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,'Candidate TypeScript must parse; this is not GLSL/GPU validation');
});
