import test from 'node:test';
import assert from 'node:assert/strict';
import {createSceneReadiness} from './scene-readiness.ts';

test('capture rejects loading, loss during rendering and later recovery of a failed session',()=>{
 let lost=false;
 const state=createSceneReadiness(()=>lost);
 assert.equal(state.ready,false);
 assert.throws(()=>state.assertReady(),/not ready/);
 state.markReady();state.assertReady();
 lost=true;
 assert.equal(state.ready,false);
 assert.throws(()=>state.assertReady(),/context was lost/);
 lost=false;
 assert.throws(()=>state.markReady(),/context was lost/);
 assert.equal(state.ready,false);
});

test('asynchronous startup cannot mark a session ready after a prior failure',()=>{
 const state=createSceneReadiness(()=>false);
 state.fail('texture unavailable');
 assert.throws(()=>state.markReady(),/texture unavailable/);
 state.fail('later error');
 assert.equal(state.error,'texture unavailable');
 assert.equal(state.ready,false);
});

test('capture must recheck readiness after asynchronous image encoding',async()=>{
 const state=createSceneReadiness(()=>false);state.markReady();
 const encode=async()=>{state.assertReady();await Promise.resolve();state.assertReady();return 'png'};
 const operation=encode();state.fail('interrupted during encoding');
 await assert.rejects(operation,/interrupted during encoding/);
});
