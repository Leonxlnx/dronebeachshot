import * as THREE from 'three';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {sampleCamera,applyCinematic,pathPosition,flightKeys,cameraDiagnostics,evaluationCameras,finalGlide,GLIDE_START} from './cinematic.ts';
import {terrainHeight,shoreDistance} from '../world/math.ts';
import {treePlacements} from '../world/ecology.ts';
import {solarDirection} from '../render/sky-lighting.ts';
test('route starts above highest surveyed summit and finishes seaward',()=>{const start=sampleCamera(0).position,end=sampleCamera(20).position;let peak=-Infinity;for(let x=-550;x<550;x+=4)for(let z=100;z<700;z+=4)peak=Math.max(peak,terrainHeight(x,z));assert.ok(start.y>peak+20);assert.ok(terrainHeight(start.x,start.z)>peak-2);assert.ok(shoreDistance(end.x,end.z)<-100);assert.ok(end.y>=4&&end.y<=10)});

test('final glide preserves the complete earlier pose and joins with continuous velocity and acceleration',()=>{
 const hash=crypto.createHash('sha256');
 for(let i=0;i<=1470;i++){const c=sampleCamera(i/100);hash.update(JSON.stringify([c.position.toArray(),c.target.toArray(),c.fov,c.bank]))}
 // Frozen independently before replacing the final curve; includes old lookahead.
 assert.equal(hash.digest('hex'),'3526b48d5d3640e5e1206acc84749b28a60c63310035f699395b29ea8099a38f');
 const e=.0002,p=pathPosition(GLIDE_START),before=pathPosition(GLIDE_START-e),earlier=pathPosition(GLIDE_START-2*e);
 assert.ok(finalGlide(GLIDE_START).distanceTo(p)<1e-10);
 assert.ok(p.clone().sub(before).divideScalar(e).distanceTo(finalGlide(GLIDE_START,1))<.003);
 assert.ok(p.clone().addScaledVector(before,-2).add(earlier).divideScalar(e*e).distanceTo(finalGlide(GLIDE_START,2))<.02);
 let lastSpeed=Infinity;
 for(let i=0;i<=5300;i++){
  const t=GLIDE_START+i/1000,v=finalGlide(t,1),a=finalGlide(t,2),speed=v.length();
  assert.ok(speed<=lastSpeed+1e-8&&speed>=4.99999&&speed<27);
  assert.ok(v.dot(a)<1e-7&&v.z<0&&a.length()<26.7);
  lastSpeed=speed;
 }
 assert.ok(Math.abs(lastSpeed-5)<1e-8);assert.ok(finalGlide(20,2).length()<1e-8);
});

test('sunset composition holds its orientation for the last 1.2 seconds while still gliding',()=>{
 const camera=new THREE.PerspectiveCamera(42,16/9,.15,30000);applyCinematic(camera,18.8);
 const orientation=camera.quaternion.clone(),start=camera.position.clone();
 for(let i=0;i<=120;i++){
  applyCinematic(camera,18.8+i/100);assert.ok(camera.quaternion.angleTo(orientation)<1e-6);
  assert.equal(sampleCamera(18.8+i/100).bank,0);
 }
 assert.ok(camera.position.distanceTo(start)>5&&camera.position.distanceTo(start)<8);
 camera.updateMatrixWorld(true);const sun=camera.position.clone().addScaledVector(solarDirection.value,10000).project(camera);
 assert.ok(sun.x>.55&&sun.x<.85&&Math.abs(sun.y)<.5,'Sun has insufficient frame margin');
});
test('flight has finite positions, no terrain clipping, C1 velocity at every phase boundary',()=>{const d=cameraDiagnostics();assert.ok(d.minClearance>3.5);assert.ok(d.maxSpeed<95);for(const key of flightKeys.slice(1,-1)){const e=.0001,vBefore=pathPosition(key.t).sub(pathPosition(key.t-e)).multiplyScalar(1/e),vAfter=pathPosition(key.t+e).sub(pathPosition(key.t)).multiplyScalar(1/e);assert.ok(vBefore.distanceTo(vAfter)<.015,`velocity discontinuity at ${key.t}`)}for(let i=0;i<=1200;i++){const s=sampleCamera(i/60);assert.ok(s.position.toArray().every(Number.isFinite));assert.ok(s.target.distanceTo(s.position)>1)}});
// Source-geometry audits measure 18 m Island / 14 m Syringa / 21 m palm.
// Syringa's former 21.6 m assumption belonged to an obsolete asset scale.
test('conservative tree envelopes keep the flight corridor clear',()=>{const plants=treePlacements();assert.ok(plants.length>1000);for(let i=0;i<=1200;i++){const c=pathPosition(i/60);for(const p of plants){const height=(p.family===2?21:p.family===1?14.4:18.2)*p.scale,radius=(p.family===2?6:17)*p.scale*(1+p.variant*.06)+1.5;if(c.y>p.y-1&&c.y<p.y+height+2.5)assert.ok(Math.hypot(c.x-p.x,c.z-p.z)>=radius,`tree envelope intersects frame ${i}`)}}});
test('all 16 evaluation cameras are distinct and above terrain',()=>{assert.equal(Object.keys(evaluationCameras).length,16);const positions=new Set();for(const [name,c] of Object.entries(evaluationCameras)){assert.ok(c.position.y>terrainHeight(c.position.x,c.position.z),name+' under terrain');positions.add(c.position.toArray().join(','))}assert.equal(positions.size,16)});

// The old 0.3 s tangent window caused a 101 deg/s pan around the beach turn.
test('cinematic gaze avoids the abrupt beach-turn pan and uses the intended lens',()=>{
 const camera=new THREE.PerspectiveCamera();let previous:THREE.Quaternion|null=null;
 for(let i=0;i<=2400;i++){
  applyCinematic(camera,i/120);
  const equivalent=20.25/(2*Math.tan(camera.fov*Math.PI/360));
  assert.ok(equivalent>=24&&equivalent<=40);
  if(previous)assert.ok(camera.quaternion.angleTo(previous)*120*180/Math.PI<60,`abrupt pan at ${i/120}s`);
  previous=camera.quaternion.clone();
 }
});
