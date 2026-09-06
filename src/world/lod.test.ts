import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lodWeights,lodRanges,activeLods,type QualityTier} from './lod.ts';
test('LOD coverage conserves opacity at every distance',()=>{for(const tier of ['high','balanced','low'] as QualityTier[])for(let d=0;d<2000;d+=.37){const weights=lodWeights(d,tier);assert.ok(weights.every(x=>x>=0&&x<=1));assert.ok(Math.abs(weights.reduce((a,b)=>a+b)-1)<1e-12)}});
test('cell culling never hides a contributing tree LOD',()=>{for(const tier of ['high','balanced','low'] as QualityTier[])for(let center=0;center<1600;center+=17){const min=Math.max(0,center-82),max=center+82,active=activeLods(min,max,tier);for(let d=min;d<=max;d+=.75)lodWeights(d,tier).forEach((w,i)=>{if(w>1e-10)assert.ok(active[i],`${tier} ${d} ${i}`)})}});
test('LOD weights and first derivative meet continuously at threshold boundaries',()=>{for(const tier of ['high','balanced'] as QualityTier[])for(const bound of lodRanges[tier]){const a=lodWeights(bound-.0001,tier),b=lodWeights(bound+.0001,tier);a.forEach((x,i)=>assert.ok(Math.abs(x-b[i])<1e-8))}});
