import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rockShelter} from './rock-shelter.ts';
test('rock lee is downstream, bounded, recovers and follows wave direction',()=>{
 const width=81,height=81,mask=new Uint8Array(width*height);
 for(let row=10;row<=14;row++)for(let col=32;col<=48;col++)mask[row*width+col]=1;
 const straight=rockShelter(mask,width,height,1,1,()=>0);
 assert.equal(straight[8*width+40],0);
 assert.ok(straight[16*width+40]>.8);
 assert.ok(straight[50*width+40]<straight[20*width+40]);
 assert.ok(straight.every(v=>v>=0&&v<=.920001));
 const angled=rockShelter(mask,width,height,1,1,()=>.5);
 assert.ok(angled[40*width+53]>angled[40*width+30]);
 const clear=rockShelter(new Uint8Array(width*height),width,height,1,1,()=>0);
 assert.ok(clear.every(v=>v===0));
});
