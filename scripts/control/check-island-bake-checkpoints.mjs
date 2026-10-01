// One synthetic source raster +191 resumed layers. No WebGL/browser is created.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import {bakeIslandResponse} from './source-island-response-bake.mjs';
import {treeImpostorDefinitions} from '../../src/world/tree-impostor-data.ts';
import {createIslandDirectResponseAtlas} from '../../src/render/island-direct-response.ts';
const sha=bytes=>createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
const assets=JSON.parse(await fs.readFile(new URL('../../public/assets/manifest.json',import.meta.url),'utf8'));
const sourceSHA=path=>assets.find(asset=>asset.path===path).sha256;
const tile=new Uint16Array(128*128*4);tile.set([0x1800,0x1c00,0x2000,0x2400],(64*128+64)*4);
const tilePayload=Buffer.from(tile.buffer).toString('base64');
const coverage=new Uint16Array(256*256);coverage[128*256+128]=0x2c00;const coverageSHA256=sha(coverage.buffer);
const originalCanvas=globalThis.OffscreenCanvas,originalWindow=globalThis.window;
globalThis.OffscreenCanvas=class{constructor(width,height){this.width=width;this.height=height;}getContext(){return{drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(this.width*this.height*4).fill(255)})};}};
let nextPayload=0,renders=0,checkpoints=0,loaded=0;const payloads=new Map(),saved=new Map();
globalThis.window={
 pilotLoadLayer:async layer=>{loaded++;return{record:{layer,sun:Math.floor(layer/24),view:layer%24,coverageSHA256},payload:tilePayload};},
 pilotSave:async(name,key)=>{const bytes=payloads.get(key);assert(bytes);const record={name,bytes:bytes.byteLength,sha256:sha(bytes.buffer)};saved.set(name,{record,bytes});payloads.delete(key);return record;},
 pilotLayerCheckpoint:async record=>{checkpoints++;assert.equal(record.layer,0);assert.equal(record.coverageSHA256,coverageSHA256);assert.equal(record.sourceRenderSize,1024);for(const file of [record.rawFile,record.cellFile,record.smallFile])assert(saved.has(file.name));},
};
try{
 const result=await bakeIslandResponse({config:{completedLayers:Array.from({length:191},(_,i)=>i+1),
  sourceSHA256:sourceSHA('public/assets/models/island-tree-near.glb'),albedoSHA256:sourceSHA('public/assets/impostors/island-albedo.png'),normalSHA256:sourceSHA('public/assets/impostors/island-normal.png')},
  metadata:treeImpostorDefinitions[0],albedo:{image:{width:2048,height:768}},sourceParts:[{triangles:238617,materialName:'synthetic test only'}],
  render:async(which,size)=>{renders++;assert.equal(which,'source');assert.equal(size,1024);const pixels=new Float32Array(size*size*4);pixels.set([.125,.25,.5,1],(512*size+512)*4);return pixels;},
  setSun(){},setCamera(){},stage:async()=>{},check(){},hash:async bytes=>sha(bytes),
  base64:bytes=>{const key=String(nextPayload++);payloads.set(key,new Uint8Array(bytes));return key;},
 });
 assert.equal(renders,1);assert.equal(loaded,191);assert.equal(checkpoints,1);assert.equal(result.tiles.length,192);assert.equal(result.manifest.complete,true);
 const data=saved.get('island-direct-response.rgba16f').bytes;
 assert.equal(data.byteLength,128*128*192*4*2);assert.equal(result.manifest.data.sha256,sha(data.buffer));
 const parsed=createIslandDirectResponseAtlas(result.manifest,data.buffer);parsed.texture.dispose();
 assert.equal(saved.get('source-raw-view00-sun0.rgba16f').bytes.byteLength,1024*1024*4*2);
 assert.equal(saved.get('response256-view00-sun0.rgba16f').bytes.byteLength,256*256*4*2);
 console.log(JSON.stringify({ok:true,checks:10,sourceRenders:renders,resumedLayers:loaded,scope:'CPU synthetic checkpoint/integration/assembly contract; no GPU'}));
}finally{globalThis.OffscreenCanvas=originalCanvas;globalThis.window=originalWindow;}
