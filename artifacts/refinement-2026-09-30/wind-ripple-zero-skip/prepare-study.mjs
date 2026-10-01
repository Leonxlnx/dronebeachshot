import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import * as THREE from 'three';
import {sampleCamera} from '../../../src/camera/cinematic.ts';
import {shoreDistance} from '../../../src/world/math.ts';
import {WIND} from '../../../src/world/weather.ts';
const dir='artifacts/refinement-2026-09-30/wind-ripple-zero-skip/',sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const source=fs.readFileSync('src/world/ocean.ts','utf8'),start=source.indexOf('vec2 windRipple('),end=source.indexOf('\nvec3 waterNormal(',start),original=source.slice(start,end);
assert.ok(start>0&&end>start);assert.equal((original.match(/unresolvedWaterSlopeVariance\+=/g)||[]).length,1);
const marker=' float phase=dot(p,waveVector)-t*sqrt(9.81*k)+phaseOffset;';assert.ok(original.includes(marker));
const guard=' if(bandVisibility==0.)return vec2(0.);';const candidate=original.replace(marker,guard+'\n'+marker),patched=source.slice(0,start)+candidate+source.slice(end);
assert.equal(patched.replace(guard+'\n',''),source,'Only the exact zero guard may change');
const calls=source.split('\n').filter(line=>line.includes('ripples+=windRipple('));assert.equal(calls.length,64);
const waves=calls.map(line=>{const m=line.match(/along\*cos\(([-\d.]+)\)\+across\*sin\(([-\d.]+)\),([-\d.]+),([-\d.]+),([-\d.]+)\);/);assert.ok(m);assert.equal(m[1],m[2]);const [angle,k,amplitude,phase]=[m[1],m[3],m[4],m[5]].map(Number);return{angle,k,amplitude,phase}});
const length=Math.hypot(...WIND),along=WIND.map(x=>x/length),across=[-along[1],along[0]];
for(const wave of waves)wave.direction=along.map((a,i)=>a*Math.cos(wave.angle)+across[i]*Math.sin(wave.angle));
const f=Math.fround,add=(a,b)=>f(f(a)+f(b)),mul=(a,b)=>f(f(a)*f(b)),sub=(a,b)=>f(f(a)-f(b));
function dot(a,b){return add(mul(a[0],b[0]),mul(a[1],b[1]))}
function visibility(w,dx,dy){const v=w.direction.map(d=>mul(d,w.k)),q=Math.max(Math.abs(dot(v,dx)),Math.abs(dot(v,dy)));const t=f(Math.min(1,Math.max(0,f(sub(q,1)/2))));return{value:sub(1,mul(mul(t,t),sub(3,mul(2,t)))),q,v}}
function spectrum(input,skip){let x=f(0),y=f(0),variance=f(0),skipped=0,signedZeros=0;
 for(const w of waves){const {value:vis,v}=visibility(w,input.dx,input.dy);variance=add(variance,mul(mul(mul(.5,w.amplitude),w.amplitude),sub(1,mul(vis,vis))));
  if(skip&&vis===0){skipped++;continue}
  const phase=add(sub(dot(input.p,v),mul(input.time,f(Math.sqrt(mul(9.81,w.k))))),w.phase),scale=mul(mul(w.amplitude,vis),f(Math.cos(phase))),rx=mul(w.direction[0],scale),ry=mul(w.direction[1],scale);if(Object.is(rx,-0)||Object.is(ry,-0))signedZeros++;
  x=add(x,rx);y=add(y,ry);
 }return{x,y,variance,skipped,signedZeros}}
const cases=[],synthetic=[];
const random=(()=>{let state=871623;return()=>{state=Math.imul(state,1664525)+1013904223|0;return(state>>>0)/2**32}})();
for(let i=0;i<5000;i++){const magnitude=10**(-4+random()*6),angle=random()*Math.PI*2;synthetic.push({p:[(random()-.5)*26000,(random()-.5)*26000],time:random()*20,dx:[Math.cos(angle)*magnitude,Math.sin(angle)*magnitude],dy:[-Math.sin(angle)*magnitude*(.2+random()*8),Math.cos(angle)*magnitude*(.2+random()*8)]})}
for(const wave of waves)for(const q of [0,.9999999,1,1.0000001,1.5,2,2.999,2.9999998,3,3.0000002,4,100])for(const sign of [-1,1])synthetic.push({p:[-412.7*sign,718.2],time:9.75,dx:wave.direction.map(d=>d*q/wave.k*sign),dy:[0,0]});
let skippedTotal=0,nonzeroBands=0,partialBands=0,signedZeroComponents=0;
for(const input of synthetic){const a=spectrum(input,false),b=spectrum(input,true);assert.ok(Object.is(a.x,b.x)&&Object.is(a.y,b.y)&&Object.is(a.variance,b.variance),'Float32 sum/variance differs');skippedTotal+=b.skipped;nonzeroBands+=64-b.skipped;signedZeroComponents+=a.signedZeros;for(const w of waves){const v=visibility(w,input.dx,input.dy).value;if(v>0&&v<1)partialBands++}cases.push(input)}
const percentiles=values=>{values.sort((a,b)=>a-b);const at=q=>values[Math.floor((values.length-1)*q)];return values.length?{min:values[0],p10:at(.1),median:at(.5),p90:at(.9),max:values.at(-1)}:null};
const footprintReports=[];
for(const width of [384,640,1280,1920])for(const time of [6,9,10.5,14,17,20]){
 const height=width*9/16,s=sampleCamera(time),camera=new THREE.PerspectiveCamera(s.fov,width/height,.1,50000);camera.position.copy(s.position);camera.up.set(Math.sin(s.bank),Math.cos(s.bank),0);camera.lookAt(s.target);camera.updateMatrixWorld();
 function hit(x,y){const p=new THREE.Vector3((x/width)*2-1,1-y/height*2,.5).unproject(camera).sub(camera.position);if(p.y>=0)return null;const t=-camera.position.y/p.y;return camera.position.clone().addScaledVector(p,t)}
 const records=[];for(let yi=0;yi<36;yi++)for(let xi=0;xi<64;xi++){
  const x=Math.floor((xi+.5)*width/64/2)*2+.5,y=Math.floor((yi+.5)*height/36/2)*2+.5,p=hit(x,y),px=hit(x+1,y),py=hit(x,y+1);if(!p||!px||!py||Math.abs(p.x)>13000||p.z< -17000||p.z>9000||shoreDistance(p.x,p.z)>-12)continue;
  const input={p:[p.x,p.z],time,dx:[px.x-p.x,px.z-p.z],dy:[py.x-p.x,py.z-p.z]},v=waves.map(w=>visibility(w,input.dx,input.dy).value),skipped=v.filter(x=>x===0).length;
  const record={footprint:Math.max(Math.hypot(...input.dx),Math.hypot(...input.dy)),skipped,distance:p.distanceTo(camera.position),flatDistant:Math.abs(p.x)>900||p.z< -1250||p.z>550};records.push(record);if(width===640)cases.push(input);
 }
 const subset=list=>({samples:list.length,footprintMetersPerPixel:percentiles(list.map(r=>r.footprint)),skippedOf64:percentiles(list.map(r=>r.skipped)),meanSkipped:list.length?list.reduce((s,r)=>s+r.skipped,0)/list.length:0,all64:list.filter(r=>r.skipped===64).length,none:list.filter(r=>r.skipped===0).length});
 footprintReports.push({width,height,time,whole:subset(records),near:subset(records.filter(r=>!r.flatDistant)),flatDistant:subset(records.filter(r=>r.flatDistant))});
}
const inputs=new Float32Array(128*128*8);for(let i=0;i<128*128;i++){const c=cases[i%cases.length];inputs.set([...c.p,c.time,c.dx[0],c.dx[1],...c.dy,0],i*8)}
fs.writeFileSync(dir+'ripple-inputs.rgba32f',Buffer.from(inputs.buffer));
const fixture={size:128,sourceSHA256:sha(source),original,candidate,calls:calls.join('\n'),wind:WIND,inputFile:'ripple-inputs.rgba32f',inputSHA256:sha(Buffer.from(inputs.buffer)),sourceGuard:guard};fs.writeFileSync(dir+'glsl-fixture.json',JSON.stringify(fixture,null,2)+'\n');
fs.writeFileSync(dir+'wind-ripple.before.glsl',original+'\n');fs.writeFileSync(dir+'wind-ripple.proposed.glsl',candidate+'\n');
const varianceLine=' unresolvedWaterSlopeVariance+=.5*slopeAmplitude*slopeAmplitude*(1.-bandVisibility*bandVisibility);',lineNumber=source.slice(0,source.indexOf(varianceLine)).split('\n').length;
fs.writeFileSync(dir+'ocean-wind-ripple-zero-skip.patch',`--- a/src/world/ocean.ts\n+++ b/src/world/ocean.ts\n@@ -${lineNumber},3 +${lineNumber},4 @@\n ${varianceLine}\n+${guard}\n ${marker}\n  return dir*(slopeAmplitude*bandVisibility*cos(phase));\n`);
const result={sourceSHA256:sha(source),sourceUnmodified:sha(fs.readFileSync('src/world/ocean.ts'))===sha(source),sourceDifference:'One exact equality guard after unchanged variance accumulation, before phase/cos. No other source line changed.',waves:64,kRange:[Math.min(...waves.map(w=>w.k)),Math.max(...waves.map(w=>w.k))],zeroProjectionThresholdMeters:[3/Math.max(...waves.map(w=>w.k)),3/Math.min(...waves.map(w=>w.k))],numeric:{syntheticInputs:synthetic.length,waveEvaluations:synthetic.length*64,zeroBandsSkipped:skippedTotal,nonzeroBandsPreserved:nonzeroBands,partialBandsPreserved:partialBands,signedZeroIntermediateCases:signedZeroComponents,aggregateSlopeAndVarianceBitIdentical:true,scope:'Deterministic Float32 JS model; not actual GLSL/compiler proof. Exact per-band return may change signed zero, but tested accumulated slopes/variance remain bit-identical.'},footprints:{method:'Actual cinematic camera/FOV/bank; 64x36 screen lattice; one-pixel world-XZ finite differences on sea-level plane. Only domain water samples with shoreDistance<-12m. Near waves, swash and occlusion are not rendered; not measured fragment derivatives.',reports:footprintReports},potential:'One dynamic phase/cos per fully hidden band can be bypassed. Constant arguments may already fold sqrt/direction. SIMD divergence/predication can erase some gain; no speedup claimed without actual GPU timing.',glslHarnessPrepared:true,gpuLaunched:false};fs.writeFileSync(dir+'cpu-proof.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,footprints:{method:result.footprints.method,reports:footprintReports.filter(r=>r.width===640)}}));
