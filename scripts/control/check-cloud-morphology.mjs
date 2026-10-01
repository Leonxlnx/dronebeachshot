// Small CPU/source proof only. It creates no renderer, textures or browser.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {cloudFieldGLSL} from '../../src/world/clouds.ts';
import {cloudBankParameters as p,createCloudMorphologyStudy} from '../../src/world/cloud-morphology.ts';

const literal=source=>source.slice(source.indexOf('export const cloudFieldGLSL=`'),source.indexOf('\n`;',source.indexOf('export const cloudFieldGLSL=`'))+3);
const current=await fs.readFile('src/world/clouds.ts','utf8');
const before=execFileSync('git',['show','HEAD:src/world/clouds.ts'],{encoding:'utf8'});
assert.equal(literal(current),literal(before),'OFF cloud-field literal changed');
const study=createCloudMorphologyStudy(cloudFieldGLSL);
assert.equal(study.get(),false);assert.throws(()=>study.set(true),/all three/);
const materials=Array.from({length:3},()=>new THREE.ShaderMaterial({fragmentShader:cloudFieldGLSL}));
const compile=material=>{const shader={fragmentShader:material.fragmentShader,vertexShader:material.vertexShader,uniforms:{}};material.onBeforeCompile(shader,{});return shader.fragmentShader;};
materials.forEach(study.register);
for(const material of materials)assert.equal(compile(material),cloudFieldGLSL);
assert.equal(study.set(true),true);
const variants=materials.map(compile);assert(variants.every(field=>field===variants[0]));assert.notEqual(variants[0],cloudFieldGLSL);
const densityBody=field=>field.slice(field.indexOf('float filteredDensity('),field.indexOf('\nfloat density('));
for(const field of [cloudFieldGLSL,variants[0]]){
 const body=densityBody(field);assert.equal((body.match(/\bnoise\(/g)||[]).length,3);assert.equal((body.match(/\btextureLod\(/g)||[]).length,2);
}
assert.equal(variants[0].slice(variants[0].indexOf('\nfloat density(')),cloudFieldGLSL.slice(cloudFieldGLSL.indexOf('\nfloat density(')));
assert(variants[0].includes('textureLod(uCloudNoise,p*.00032*5.+vec3(.18,.31,.13),detailLod)'));
assert.equal(study.set(false),false);
for(const material of materials){assert.equal(compile(material),cloudFieldGLSL);assert.equal(material.defines.BAY_CLOUD_WIND_BANKS,undefined);}
study.set(true);materials[0].dispose();assert.equal(study.get(),false);assert.throws(()=>study.set(true),/all three/);
materials.slice(1).forEach(material=>material.dispose());
const changedField=cloudFieldGLSL.replace('noise(p.xz*.00021','noise(p.xz*.00022');
const changedStudy=createCloudMorphologyStudy(changedField);
const changedMaterials=Array.from({length:3},()=>new THREE.ShaderMaterial({fragmentShader:changedField}));
changedMaterials.forEach(changedStudy.register);assert(changedMaterials.every(material=>compile(material)===changedField));
assert.throws(()=>changedStudy.set(true),/source anchor changed/);assert.equal(changedStudy.get(),false);
changedMaterials.forEach(material=>material.dispose());

const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
let samples=0;
for(let t=0;t<=32;t++)for(let h=0;h<=256;h++){
 const type=t/32,height=h/256,start=p.lowTopStart+(p.highTopStart-p.lowTopStart)*type,end=p.lowTopEnd+(p.highTopEnd-p.lowTopEnd)*type;
 const envelope=smooth(0,.11,height)*(1-smooth(start,end,height));
 const original=smooth(0,.11,height)*(1-smooth(.42+.16*type,.80+.20*type,height));
 assert(Number.isFinite(envelope)&&envelope>=0&&envelope<=1&&envelope<=original+1e-12);samples++;
}
// Wind rotation is orthonormal. The remaining XY map is [s,-s*shear;0,1].
const s=p.alongScale,trace=1+s*s*(1+p.shear*p.shear),det=s*s;
const maximumStretch=Math.sqrt((trace+Math.sqrt(trace*trace-4*det))/2);
assert(maximumStretch<=p.footprintScale);
const integral=(start,end)=>(start+end)/2-.055;
const low=integral(p.lowTopStart,p.lowTopEnd),high=integral(p.highTopStart,p.highTopEnd);
const proof={ok:true,method:'CPU shader composition and analytic bounds; no GPU/pixel/mean-density acceptance',
 originalFieldLiteralUnchanged:true,offShaderExact:true,offOnOffShaderExact:true,sharedCompiledDensityAcrossThreeConsumers:true,
 disposalDisablesIncompleteSet:true,changedAnchorLeavesOffUsable:true,maximumScalarNoiseCallsPerDensity:3,maximumTextureSamplesPerDensity:2,
 profileBoundSamples:samples,profileAlwaysWithin01:true,profileNeverAboveOriginalAtSameMaturity:true,
 macroAspectAlongWind:1/s,maximumWindShearMeters:1250*p.shear,maximumCoordinateStretch:maximumStretch,conservativeFootprintScale:p.footprintScale,
 lowestCloudTopMeters:1000+1250*p.lowTopEnd,highestCloudTopMeters:1000+1250*p.highTopEnd,
 heightEnvelopeIntegral:{lowMaturity:low,highMaturity:high,baselineLowMaturity:.555,baselineHighMaturity:.735,uniformMaturityRatio:(low+high)/(.555+.735)},
 coverageScaleUnchanged:true,equalMeanDensityGuaranteed:false,
 limits:['Envelope integral is not actual cloud mass/occupancy; domains and nonlinear erosion also change.','ON shader requires actual GPU compile and image review.','Set control and invalidate lighting only between frames; register visible/reflection/shadow materials.'],
 originalFieldSHA256:createHash('sha256').update(cloudFieldGLSL).digest('hex'),variantFieldSHA256:createHash('sha256').update(variants[0]).digest('hex')};
await fs.mkdir('artifacts/refinement-2026-09-30/cloud-morphology-study',{recursive:true});
await fs.writeFile('artifacts/refinement-2026-09-30/cloud-morphology-study/cpu-proof.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof,null,2));
