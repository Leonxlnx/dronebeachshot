import test from 'node:test';
import assert from 'node:assert/strict';
import {positiveBox,captureBox,positiveRayFootprint,reconstructionVariance,footprintWidth} from './coastal-reflection-filter.ts';

const close=(a:number,b:number,tolerance=1e-12)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);

test('horizon fraction and positive centroid agree with numerical box integration',()=>{
 const count=20000;
 for(const halfWidth of [1e-8,.003,.08,.5])for(const relativeCenter of [-2,-1,-.97,-.5,0,.13,.75,1,2]){
  const center=halfWidth*relativeCenter,[coverage,mean]=positiveBox(center,halfWidth);
  let included=0,sum=0;
  for(let i=0;i<count;i++){
   const value=center+halfWidth*(2*(i+.5)/count-1);
   if(value>0){included++;sum+=value;}
  }
  close(coverage,included/count,1/count);
  if(included)close(mean,sum/included,halfWidth*2/count);
  assert.ok(coverage>=0&&coverage<=1&&mean>=0);
 }
 assert.deepEqual(positiveBox(-.1,0),[0,0]);assert.deepEqual(positiveBox(0,0),[0,0]);assert.deepEqual(positiveBox(.1,0),[1,.1]);
 close(positiveBox(0,1e-100)[0],.5);assert.ok(positiveBox(0,1e-100).every(Number.isFinite));
});

test('capture-edge footprint overlap has continuous coverage and an in-bounds representative',()=>{
 const count=16000;
 for(const halfWidth of [1/640,.01,.2,.8,2])for(const center of [-2,-.3,-.01,0,.002,.1,.5,.99,1,1.01,1.5,3]){
  const [coverage,representative]=captureBox(center,halfWidth);let included=0,sum=0;
  for(let i=0;i<count;i++){
   const sample=center+halfWidth*(2*(i+.5)/count-1);
   if(sample>=0&&sample<=1){included++;sum+=sample;}
  }
  close(coverage,included/count,2/count);
  if(included)close(representative,sum/included,halfWidth*2/count);
  assert.ok(coverage>=0&&coverage<=1&&representative>=0&&representative<=1);
 }
 close(captureBox(.5,.1)[0],1);assert.equal(captureBox(-.2,.1)[0],0);
 close(captureBox(0,.1)[0],.5);close(captureBox(1,.1)[0],.5);
 for(const boundary of [-.1,.1,.9,1.1]){
  const a=captureBox(boundary-1e-7,.1)[0],b=captureBox(boundary+1e-7,.1)[0];assert.ok(Math.abs(a-b)<1.1e-6);
 }
 assert.deepEqual(captureBox(.5,0),[1,.5]);assert.deepEqual(captureBox(2,0),[0,1]);
});

test('partial negative central rays use positive support; zero support remains pure fallback',()=>{
 for(const y of [-.8,-.02,0,.02,.8])for(const slopeVariance of [0,1e-14,.0002,.02]){
  const ray:[number,number,number]=[Math.sqrt(1-y*y),y,0];
  const dx:[number,number,number]=[-y*.07,ray[0]*.07,0],dy:[number,number,number]=[0,0,.03];
  const result=positiveRayFootprint(ray,dx,dy,slopeVariance);
  assert.ok([...result.ray,result.coverage,result.mean,result.variance,...result.covarianceY].every(Number.isFinite));
  assert.ok(result.coverage>=0&&result.coverage<=1);close(Math.hypot(...result.ray),1);
  assert.ok(result.ray[1]>=0,'Never project a negative geometry ray');
  if(result.coverage>0)assert.ok(result.ray[1]>0,'Positive support uses an above-water representative');
  if(result.variance>0)close(ray[1]+result.covarianceY[1]*(result.mean-ray[1])/result.variance,result.mean);
 }
 const partial=positiveRayFootprint([Math.sqrt(1-.01*.01),-.01,0],[0,.12,0],[0,0,0],0);
 assert.ok(partial.coverage>0&&partial.coverage<1&&partial.ray[1]>0);
 const below=positiveRayFootprint([.6,-.8,0],[0,0,0],[0,0,0],0);
 assert.equal(below.coverage,0);
 const up=positiveRayFootprint([.6,.8,0],[0,0,0],[0,0,0],0);
 assert.equal(up.coverage,1);assert.deepEqual(up.ray,[.6,.8,0]);
});

test('NPOT trilinear reconstruction moment bounds all bilinear phases and remains continuous',()=>{
 for(const size of [64,180,320])for(const lod of [0,.01,.5,1,2.9,4,5.7,7.999,8]){
  const level=Math.floor(lod),fraction=lod-level,n0=Math.max(1,Math.floor(size/2**level)),n1=Math.max(1,Math.floor(size/2**(level+1)));
  const bound=reconstructionVariance(size,lod);assert.ok(Number.isFinite(bound)&&bound>0);
  for(let i=0;i<101;i++)for(let j=0;j<101;j++){
   const phase0=i/100,phase1=j/100;
   // Independently sum the box-texel variance and the two weighted centers.
   const v0=(1/12+(1-phase0)*phase0**2+phase0*(1-phase0)**2)/(n0*n0);
   const v1=(1/12+(1-phase1)*phase1**2+phase1*(1-phase1)**2)/(n1*n1);
   assert.ok((1-fraction)*v0+fraction*v1<=bound+1e-14);
  }
 }
 for(let level=1;level<=8;level++)close(reconstructionVariance(180,level-1e-8),reconstructionVariance(180,level+1e-8),1e-8);
 close(reconstructionVariance(180,6),1/12); // 180px mip6 has two texels.
});

test('combined footprint includes both variance sources and agrees with projected principal-axis search',()=>{
 close(footprintWidth([1,1],0,[1,1]),2*Math.sqrt(3));
 close(footprintWidth([2,2],0,[1,1]),Math.sqrt(2)*footprintWidth([1,1],0,[1,1]));
 assert.equal(footprintWidth([0,0],0,[320,180]),0);
 for(const [a,b,c]of [[1,1,0],[1,4,1.5],[4,1,-1.5],[.003,.01,-.005],[2,2,2]]){
  let maximum=0;
  for(let i=0;i<20000;i++){
   const angle=Math.PI*2*i/20000,x=Math.cos(angle),y=Math.sin(angle);
   maximum=Math.max(maximum,a*x*x+2*c*x*y+b*y*y);
  }
  close(footprintWidth([a,b],c,[1,1]),2*Math.sqrt(3*maximum),1e-6);
 }
});
