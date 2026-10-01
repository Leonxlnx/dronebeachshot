import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {noise,hash,shoreZ,shoreDistance} from '../../../src/world/math.ts';
import {sandRipplePhaseWeight as weight,RIPPLE_PASS_BAND as pass,RIPPLE_STOP_BAND as stop} from './sand-ripple-filter-study.mjs';
import {readGroundStudyBaseline} from './ground-study-baseline.mjs';

// Use the actual project's CPU coast/noise functions. This checks the calculus,
// not bit-equivalence between the CPU hash and a particular GLSL implementation.
const phase=(x,z)=>shoreDistance(x,z)*7.5+Math.sin(x*.09)*2.2+noise(x*.14,z*.14)*1.4;
function gradient(x,z){
 const g=-.0047*x+.156*Math.cos(x*.013)+.16*Math.cos(x*.032);
 const curvature=-.0047-.156*.013*Math.sin(x*.013)-.16*.032*Math.sin(x*.032);
 const length=Math.hypot(1,g),d=shoreDistance(x,z);
 const coastDx=-g/length-d*g*curvature/(1+g*g),coastDz=1/length;
 const nx=x*.14,nz=z*.14,ix=Math.floor(nx),iz=Math.floor(nz),fx=nx-ix,fz=nz-iz;
 const u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz),du=6*fx*(1-fx),dv=6*fz*(1-fz);
 const a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),e=hash(ix+1,iz+1);
 const noiseDx=((b-a)*(1-v)+(e-c)*v)*du,noiseDz=(c*(1-u)+e*u-a*(1-u)-b*u)*dv;
 return [7.5*coastDx+.198*Math.cos(x*.09)+.196*noiseDx,7.5*coastDz+.196*noiseDz];
}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];

test('study follows the actual unwrapped production phase',()=>{
 const source=fs.readFileSync(new URL('../../../src/render/ground-materials.ts',import.meta.url),'utf8');
 assert.ok(readGroundStudyBaseline().ground.includes('cos(d*7.5+sin(gp.x*.09)*2.2+noise(gp.xz*.14)*1.4)'),'Frozen study phase changed');
 assert.ok(source.includes('float ripplePhase=d*7.5+sin(gp.x*.09)*2.2+noise(gp.xz*.14)*1.4;'),'Re-evaluate this study if the integrated phase changes');
 assert.ok(source.includes('export const sandRippleFilter={value:0};'),'Integrated filter must remain an opt-in study');
 // Resolve a real calculus pitfall: coastNormal is not the exact derivative of
 // normalized shoreDist away from the coastline, because coast curvature matters.
 for(let i=0;i<151;i++){
  const x=-550+i*7.23,z=shoreZ(x)+(-6+(i%31))*Math.hypot(1,-.0047*x+.156*Math.cos(x*.013)+.16*Math.cos(x*.032));
  const g=gradient(x,z),h=1e-4;
  const numerical=[(phase(x+h,z)-phase(x-h,z))/(2*h),(phase(x,z+h)-phase(x,z-h))/(2*h)];
  for(let axis=0;axis<2;axis++)assert.ok(Math.abs(g[axis]-numerical[axis])<2e-6,`World phase derivative disagrees at ${x}, ${z}, axis ${axis}`);
 }
});

test('nearby resolved phase is unchanged; anisotropic grazing is driven by phase, not distance',()=>{
 for(const dx of [0,Number.MIN_VALUE,1e-12,.01,pass*.5,pass])for(const dy of [0,pass*.3,-pass]){
  assert.equal(weight(dx,dy),1);
  for(let p=-19;p<20;p+=.13){const previous=Math.cos(p)*.035*.2*.73*.89;assert.equal(previous*weight(dx,dy),previous);}
 }
 const g=gradient(53.2,shoreZ(53.2)+8),length=Math.hypot(...g),normal=g.map(v=>v/length),tangent=[-normal[1],normal[0]];
 assert.equal(weight(dot(g,tangent.map(v=>v*100)),dot(g,normal.map(v=>v*.01))),1,'A large along-crest footprint alone must not remove a resolved wave');
 assert.equal(weight(dot(g,normal),dot(g,tangent)),0,'A large cross-crest footprint must remove an unresolved wave at the same world point');
});

test('full phase derivative agrees with projected world gradient and includes both warps',()=>{
 const pixelX=[.003,.008],pixelY=[-.012,.004],h=1e-3;
 for(let i=0;i<97;i++){
  const x=-470+i*9.77,z=shoreZ(x)+7.37,g=gradient(x,z);
  for(const pixel of [pixelX,pixelY]){
   const observed=(phase(x+pixel[0]*h,z+pixel[1]*h)-phase(x-pixel[0]*h,z-pixel[1]*h))/(2*h);
   assert.ok(Math.abs(observed-dot(g,pixel))<2e-7,'Projection chain rule must match derivatives of the complete unwrapped phase');
  }
 }
});

test('transition is bounded, monotone, sign symmetric and smooth at both endpoints',()=>{
 let previous=1;
 for(let i=0;i<=20000;i++){
  const dx=stop*2*i/20000,w=weight(dx,0);
  assert.ok(Number.isFinite(w)&&w>=0&&w<=1);assert.ok(w<=previous);previous=w;
  assert.equal(weight(-dx,0),w);assert.equal(weight(0,dx),w);assert.equal(weight(dx,-dx),w);
 }
 assert.equal(weight((pass+stop)/2,0),.5);
 assert.equal(weight(pass,pass),1,'Do not overblur a diagonal by adding axis frequencies');
 assert.equal(weight(stop,0),0);assert.equal(weight(0,-stop),0);
 for(const large of [1e6,Number.MAX_VALUE,Infinity])assert.equal(weight(large,0),0);
 const h=1e-5;
 assert.ok(Math.abs((weight(pass+h,0)-weight(pass,0))/h)<2e-5);
 assert.ok(Math.abs((weight(stop,0)-weight(stop-h,0))/h)<2e-5);
});

test('a subpixel sinusoid cannot return as an apparently broad alias after filtering',()=>{
 // Integer-pixel sampling makes 1.0625 cycles/pixel look exactly like a broad
 // 0.0625 cycle/pixel ripple. The unwrapped derivative still sees the true rate.
 const low=2*Math.PI/16,high=2*Math.PI+low,samples=256;
 let oldEnergy=0,newEnergy=0,maximumAliasDifference=0;
 for(let i=0;i<samples;i++){
  const coarse=Math.cos(.31+high*i),alias=Math.cos(.31+low*i),filtered=coarse*weight(high,0);
  maximumAliasDifference=Math.max(maximumAliasDifference,Math.abs(coarse-alias));oldEnergy+=coarse*coarse;newEnergy+=filtered*filtered;
 }
 assert.ok(maximumAliasDifference<5e-13);assert.ok(oldEnergy/samples>.49);assert.equal(newEnergy,0);
 // Differentiating cos instead of phase would report zero at extrema, even for
 // a frequency above Nyquist. Every phase offset must still be suppressed.
 // Either signed zero is zero normal energy; multiplication preserves cos's sign.
 for(let p=0;p<2*Math.PI;p+=.01)assert.ok(Math.cos(p)*weight(stop*1.01,0)===0);
});
