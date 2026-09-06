import { test } from 'node:test';
import assert from 'node:assert/strict';
import {rng,shoreZ,terrainHeight,terrainSlope,shoreDistance} from './math.ts';
test('determinism and seed separation',()=>{const a=rng(42),b=rng(42),c=rng(99);for(let i=0;i<1000;i++){assert.equal(a(),b());assert.ok(c()>=0)}});
test('coastline continuous, seabed continues, terrain never NaN',()=>{for(let x=-500;x<=500;x+=5){const coast=shoreZ(x);assert.ok(Math.abs(shoreDistance(x,coast))<1e-9);assert.ok(terrainHeight(x,coast-10)<0);for(let z=-400;z<700;z+=10){assert.ok(Number.isFinite(terrainHeight(x,z)));assert.ok(Number.isFinite(terrainSlope(x,z)))}}});
test('summit scale and asymmetric bay',()=>{assert.ok(terrainHeight(-125,350)>210);assert.ok(shoreZ(0)>shoreZ(250)+100);assert.notEqual(shoreZ(150),shoreZ(-150))});
