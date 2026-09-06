import * as THREE from 'three';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleCamera,applyCinematic,pathPosition,flightKeys,cameraDiagnostics,evaluationCameras} from './cinematic.ts';
import {terrainHeight} from '../world/math.ts';
import {treePlacements} from '../world/ecology.ts';
test('route starts above highest surveyed summit and finishes seaward',()=>{const start=sampleCamera(0).position,end=sampleCamera(20).position;let peak=-Infinity;for(let x=-550;x<550;x+=4)for(let z=100;z<700;z+=4)peak=Math.max(peak,terrainHeight(x,z));assert.ok(start.y>peak+20);assert.ok(terrainHeight(start.x,start.z)>peak-2);assert.ok(end.z<-250);assert.ok(end.y>=4&&end.y<=10)});
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
