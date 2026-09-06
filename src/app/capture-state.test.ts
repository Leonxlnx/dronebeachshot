import test from 'node:test';
import assert from 'node:assert/strict';
import {timelineTime,captureDimensions} from './capture-state.ts';

test('invalid external timestamps never enter the cinematic or GPU uniforms',()=>{
 for(const value of [NaN,Infinity,-Infinity,-7])assert.equal(timelineTime(value),0);
 assert.equal(timelineTime(37),20);
 assert.equal(timelineTime(7.125),7.125);
});

test('capture size rejects allocations outside actual device limits',()=>{
 captureDimensions(3840,2160,4096);
 for(const [w,h] of [[0,1080],[-1,1080],[1920,.5],[NaN,1080],[Infinity,1080],[8192,2160],[3840,8192]]) {
  assert.throws(()=>captureDimensions(w,h,4096),RangeError);
 }
});
