// Small CPU/source proof only. It creates no renderer, textures or browser.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {cloudFieldGLSL} from '../../src/world/clouds.ts';
import {cloudBankParameters as p,createCloudMorphologyStudy} from '../../src/world/cloud-morphology.ts';

const literal=source=>{source=source.replace(/\r\n/g,'\n');return source.slice(source.indexOf('export const cloudFieldGLSL=`'),source.indexOf('\n`;',source.indexOf('export const cloudFieldGLSL=`'))+3);};
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
const oldSun='float depth=density(point+sun*95.)*135.+density(point+sun*275.)*250.+density(point+sun*620.)*380.;';
const newSun='// Contiguous midpoint cells cover 0..810 m and resolve nearby self-shadow.\n float depth=density(point+sun*40.)*80.+density(point+sun*190.)*220.+density(point+sun*555.)*510.;';
assert.equal(variants[0].slice(variants[0].indexOf('\nfloat density(')),cloudFieldGLSL.slice(cloudFieldGLSL.indexOf('\nfloat density(')).replace(oldSun,newSun));
assert.equal(80+220+510,810);assert.equal(40*80+190*220+555*510,810*810/2);
assert(variants[0].includes('textureLod(uCloudNoise,p*.00032*5.+vec3(.18,.31,.13),detailLod)'));
assert.equal(study.set(false),false);
for(const material of materials){assert.equal(compile(material),cloudFieldGLSL);assert.equal(material.defines.BAY_CLOUD_WIND_BANKS,undefined);}
study.set(true);materials[0].dispose();assert.equal(study.get(),false);assert.throws(()=>study.set(true),/all three/);
materials.slice(1).forEach(material=>material.dispose());
const changedField=cloudFieldGLSL.replace('const float cloudBase=1000.;','const float cloudBase=1001.;');
const changedStudy=createCloudMorphologyStudy(changedField);
const changedMaterials=Array.from({length:3},()=>new THREE.ShaderMaterial({fragmentShader:changedField}));
changedMaterials.forEach(changedStudy.register);assert(changedMaterials.every(material=>compile(material)===changedField));
assert.throws(()=>changedStudy.set(true),/source anchor changed/);assert.equal(changedStudy.get(),false);
changedMaterials.forEach(material=>material.dispose());

const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
let samples=0;
for(let t=0;t<=32;t++)for(let h=0;h<=256;h++){
 const occupancy=t/32,height=h/256;
 const vertical=height<.42?(height-.42)/.42:(height-.42)/.58;
 const surface=.67+(.52-.67)*occupancy+.72*vertical*vertical;
 // Both volume channels are bounded by one and radius variation by .06.
 const maximumSupport=Math.max(1.06-surface,0)*occupancy;
 assert(Number.isFinite(maximumSupport)&&maximumSupport>=0&&maximumSupport<=1);
 if(occupancy===0||height===0||height===1)assert.equal(maximumSupport,0);
 samples++;
}
const minimumBase=p.baseHeight-p.baseFragmentRange*.5;
const maximumBase=p.baseHeight+p.baseRange+p.baseFragmentRange*.5;
const maximumDepth=p.minimumDepth+p.depthRange;
assert(minimumBase>p.lowerBound&&maximumBase+maximumDepth<p.upperBound,'Local volumes must fit strictly inside the integration slab');
const occupancy=(weather,coverage=.4)=>smooth(.50,.70,weather+.30*(coverage-.4));
for(let i=0;i<=100;i++){
 const weather=i/100;
 assert(occupancy(weather,.25)<=occupancy(weather,.4)&&occupancy(weather,.4)<=occupancy(weather,1.15));
 if(weather<=.50)assert.equal(occupancy(weather),0,'Weak weather must contain no clouds, even with maximal texture values');
}
assert(variants[0].includes('float lobes=max(n.g,.85*n.b)+(n.r-.5)*.12;'));
assert(variants[0].includes('float surface=mix(.67,.52,occupancy)+.72*vertical*vertical;'));
assert(variants[0].includes('return shape*occupancy*distantFade;'));
// In empty space outside both feature spheres, Perlin may not create a bridge.
for(let perlin=0;perlin<=1;perlin+=.01)assert(Math.max(.44,.85*.44)+(perlin-.5)*.12<.52);
assert(variants[0].includes('24000.+10000.*cloudType,radius)'));
assert(34000<36000,'Regional clouds must fade before the cylinder wall');
// Wind rotation is orthonormal. The remaining XY map is [s,-s*shear;0,1].
const s=p.alongScale,trace=1+s*s*(1+p.shear*p.shear),det=s*s;
const maximumStretch=Math.sqrt((trace+Math.sqrt(trace*trace-4*det))/2);
// Cubic value noise's derivative on each input axis is at most 1.5.
// Bound the added warp by its Frobenius norm, then use the triangle inequality.
const warpStretch=1.5*Math.hypot(
 s*p.warpAlong*Math.hypot(p.weatherAlong,p.weatherAcross),
 p.warpHeight*Math.hypot(p.maturityAlong,p.maturityAcross),
 p.warpAcross*Math.hypot(p.fragmentAlong,p.fragmentAcross));
const maximumWarpedStretch=maximumStretch+warpStretch;
assert(maximumWarpedStretch<=p.footprintScale);
const minimumStretch=s/maximumStretch;
assert(minimumStretch>warpStretch,'Regional warp must not fold the volume coordinates');
assert(p.alongScale>=.75,'Macro lobes must not return to long wind-stretched ribbons');
const proof={ok:true,method:'CPU shader composition and analytic bounds; no GPU/pixel/mean-density acceptance',
 originalFieldLiteralUnchanged:true,offShaderExact:true,offOnOffShaderExact:true,sharedCompiledDensityAcrossThreeConsumers:true,
 disposalDisablesIncompleteSet:true,changedAnchorLeavesOffUsable:true,maximumScalarNoiseCallsPerDensity:3,maximumTextureSamplesPerDensity:2,
 profileBoundSamples:samples,profileAlwaysWithin01:true,zeroOccupancyHasZeroDensity:true,localVolumeStrictlyInsideMarchBounds:true,
 macroAspectAlongWind:1/s,maximumWindShearMeters:(p.upperBound-p.lowerBound)*p.shear,maximumCoordinateStretch:maximumWarpedStretch,
 maximumUnwarpedStretch:maximumStretch,maximumWarpStretch:warpStretch,minimumWarpedStretch:minimumStretch-warpStretch,
 conservativeFootprintScale:p.footprintScale,
 localBaseBoundsMeters:[minimumBase,maximumBase],maximumLocalCloudTopMeters:maximumBase+maximumDepth,
 marchBoundsMeters:[p.lowerBound,p.upperBound],maximumDistantFadeMeters:34000,
 localSunlightMidpointPartitionMeters:[0,80,300,810],localSunlightConstantAndLinearIntegralExact:true,
 coverageScaleUnchanged:true,equalMeanDensityGuaranteed:false,
 limits:['Envelope integral is not actual cloud mass/occupancy; domains and nonlinear erosion also change.','ON shader requires actual GPU compile and image review.','Set control and invalidate lighting only between frames; register visible/reflection/shadow materials.'],
 originalFieldSHA256:createHash('sha256').update(cloudFieldGLSL).digest('hex'),variantFieldSHA256:createHash('sha256').update(variants[0]).digest('hex')};
await fs.mkdir('artifacts/refinement-2026-10-02/cloud-morphology',{recursive:true});
await fs.writeFile('artifacts/refinement-2026-10-02/cloud-morphology/cpu-proof-volume-03.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof,null,2));
