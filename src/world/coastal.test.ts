import test from 'node:test';
import assert from 'node:assert/strict';
import {shoreZ} from './math.ts';
import {COAST,coastNormal,coastPhase,runup,runupVelocity,sandWetness,swashDepth} from './coastal.ts';
test('a shallow crest travels inland and along the shoreline normal',()=>{for(let x=-450;x<=450;x+=25){const z=shoreZ(x),n=coastNormal(x),dt=.001,v=COAST.angularSpeed/COAST.waveNumber;assert.ok(n[1]>0);assert.ok(Math.abs(Math.hypot(...n)-1)<1e-12);const before=coastPhase(x,z,2),after=coastPhase(x+n[0]*v*dt,z+n[1]*v*dt,2+dt);assert.ok(Math.abs(before-after)<.00025)}});
test('swash velocity agrees with displacement in both advance and retreat',()=>{let advance=false,retreat=false;for(let t=0;t<20;t+=.07){const velocity=runupVelocity(75,t),numeric=(runup(75,t+.00001)-runup(75,t-.00001))/.00002;assert.ok(Math.abs(velocity-numeric)<1e-7);advance ||= velocity>1;retreat ||= velocity< -1}assert.ok(advance&&retreat)});
test('sand retains moisture behind a retreating wave, without wetting unreached sand',()=>{let retained=0;for(let t=0;t<20;t+=.1){const reach=runup(20,t),d=reach+1.3;if(runupVelocity(20,t)<-1&&sandWetness(20,d,t)>.4)retained++;assert.equal(sandWetness(20,7,t),0);assert.equal(sandWetness(20,-5,t),1)}assert.ok(retained>20)});
test('connected swash stays within tide bounds, thins at its shared front and drains on retreat',()=>{
 let advancing=0,retreating=0;
 for(let x=-575;x<=575;x+=13)for(let t=0;t<=20;t+=.13){
  const reach=runup(x,t),velocity=runupVelocity(x,t);
  assert.ok(reach>=COAST.meanRunup-COAST.runupAmplitude-.6&&reach<=COAST.meanRunup+COAST.runupAmplitude+.6);
  assert.equal(swashDepth(x,reach,t),0);assert.equal(swashDepth(x,reach+1,t),0);
  const back=swashDepth(x,reach-3,t),edge=swashDepth(x,reach-.5,t);
  assert.ok(edge>0&&edge<back&&back<=.075);
  if(velocity>2){assert.ok(back>.0749);advancing++;}
  if(velocity< -2){assert.ok(back<.03376);retreating++;}
  const numeric=(runup(x,t+.00001)-runup(x,t-.00001))/.00002;
  assert.ok(Math.abs(velocity-numeric)<1e-7);
  assert.ok(Math.abs(swashDepth(x,reach-1,t+1e-5)-swashDepth(x,reach-1,t-1e-5))<.00001);
 }
 assert.ok(advancing>100&&retreating>100);
});
