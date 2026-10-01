import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {EmbeddedImagePool} from './embedded-image-pool.ts';
import {alphaWeightedColorTexture} from './alpha-weighted-color.ts';

test('alpha filtering shares derived pixels but preserves per-texture sampling',()=>{
 const a=new THREE.DataTexture(new Uint8Array([180,90,20,128]),1,1);a.colorSpace=THREE.SRGBColorSpace;
 const b=a.clone();b.wrapS=THREE.RepeatWrapping;b.offset.x=.7;
 const first=alphaWeightedColorTexture(a),second=alphaWeightedColorTexture(b);
 assert.notEqual(first,second);assert.equal(first.source,second.source);assert.equal(second.offset.x,.7);
 assert.equal(second.wrapS,THREE.RepeatWrapping);assert.equal(second.image.data[3],128);
 assert.notEqual(first.source,a.source);assert.deepEqual([...a.image.data],[180,90,20,128]);
});

test('equal encoded images share storage without merging sampler or colour-space state',async()=>{
 const pool=new EmbeddedImagePool();
 const make=async(bytes:number[],colorSpace:string,wrap:THREE.Wrapping)=>{
  const texture=new THREE.Texture({width:1,height:1} as HTMLImageElement);texture.colorSpace=colorSpace;texture.wrapS=wrap;texture.offset.set(.2,.4);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({map:texture}));
  await pool.share(mesh,{json:{images:[{bufferView:0,mimeType:'image/png'}],textures:[{source:0}]},associations:new Map([[texture,{textures:0}]]),getDependency:async()=>new Uint8Array(bytes).buffer});
  return texture;
 };
 const a=await make([1,2,3,4],THREE.SRGBColorSpace,THREE.RepeatWrapping);
 const b=await make([1,2,3,4],THREE.NoColorSpace,THREE.ClampToEdgeWrapping);
 const different=await make([1,2,3,5],THREE.SRGBColorSpace,THREE.RepeatWrapping);
 assert.notEqual(a,b);assert.equal(a.source,b.source);assert.notEqual(a.source,different.source);
 assert.equal(b.colorSpace,THREE.NoColorSpace);assert.equal(b.wrapS,THREE.ClampToEdgeWrapping);
 assert.deepEqual(b.offset.toArray(),[.2,.4]);assert.deepEqual(pool.stats,{uniqueImages:2,sharedImages:1,closedBitmaps:0,closedBitmapPixels:0});
 pool.clear();assert.equal(a.source,b.source);
});

class FakeBitmap {
 width=16;height=8;closes=0;onClose=()=>{};
 close(){this.onClose();this.closes++;}
}
async function withBitmaps(run:()=>Promise<void>){
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'ImageBitmap'),enabled=THREE.Cache.enabled,files=THREE.Cache.files;
 Object.defineProperty(globalThis,'ImageBitmap',{value:FakeBitmap,configurable:true,writable:true});THREE.Cache.enabled=false;THREE.Cache.files={};
 try{await run()}finally{
  if(descriptor)Object.defineProperty(globalThis,'ImageBitmap',descriptor);else delete (globalThis as any).ImageBitmap;
  THREE.Cache.enabled=enabled;THREE.Cache.files=files;
 }
}
const bitmapTexture=(image:FakeBitmap)=>new THREE.Texture(image as unknown as ImageBitmap);
function bitmapScene(textures:THREE.Texture[],bytes:number[][]){
 const scene=new THREE.Group();textures.forEach(texture=>scene.add(new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({map:texture}))));
 const parser={json:{images:textures.map((_,i)=>({bufferView:i,mimeType:'image/png'})),textures:textures.map((_,i)=>({source:i}))},
  associations:new Map(textures.map((texture,i)=>[texture,{textures:i}])),
  getDependency:async(_kind:string,index:number)=>new Uint8Array(bytes[index]).buffer};
 return {scene,parser};
}

test('owned duplicate bitmaps close once after every shared-source texture is rebound; canonical survives across loads and clear',async()=>withBitmaps(async()=>{
 const pool=new EmbeddedImagePool(),canonical=new FakeBitmap(),first=bitmapTexture(canonical),initial=bitmapScene([first],[[1,2]]);
 await pool.share(initial.scene,initial.parser,{disposeOrphanedBitmaps:true});
 const duplicate=new FakeBitmap(),a=bitmapTexture(duplicate),b=a.clone(),next=bitmapScene([a,b],[[1,2],[1,2]]);
 duplicate.onClose=()=>{assert.equal(a.image,canonical);assert.equal(b.image,canonical);};
 await pool.share(next.scene,next.parser,{disposeOrphanedBitmaps:true});
 assert.equal(duplicate.closes,1);assert.equal(canonical.closes,0);assert.equal(a.source,first.source);assert.equal(b.source,first.source);
 const thirdBitmap=new FakeBitmap(),third=bitmapTexture(thirdBitmap),last=bitmapScene([third],[[1,2]]);
 await pool.share(last.scene,last.parser,{disposeOrphanedBitmaps:true});
 assert.equal(thirdBitmap.closes,1);assert.equal(pool.stats.closedBitmaps,2);assert.equal(pool.stats.closedBitmapPixels,256);
 pool.clear();assert.equal(canonical.closes,0);assert.equal(third.image,canonical);
}));

test('bitmap identity protects another Source and unassociated scene textures, not only the replaced Texture.source',async()=>withBitmaps(async()=>{
 for(const associated of [true,false]){
  const pool=new EmbeddedImagePool(),canonical=new FakeBitmap(),first=bitmapScene([bitmapTexture(canonical)],[[1]]);
  await pool.share(first.scene,first.parser,{disposeOrphanedBitmaps:true});
  const shared=new FakeBitmap(),replacement=bitmapTexture(shared),retained=bitmapTexture(shared),next=bitmapScene([replacement,retained],[[1],[9]]);
  assert.notEqual(replacement.source,retained.source);
  if(!associated)next.parser.associations.delete(retained);
  await pool.share(next.scene,next.parser,{disposeOrphanedBitmaps:true});
  assert.equal(replacement.image,canonical);assert.equal(retained.image,shared);assert.equal(shared.closes,0);
 }
}));

test('a canonical bitmap held by an earlier pool entry survives rebinding under a different encoded-image key',async()=>withBitmaps(async()=>{
 const pool=new EmbeddedImagePool(),a=new FakeBitmap(),b=new FakeBitmap(),first=bitmapScene([bitmapTexture(a),bitmapTexture(b)],[[1],[2]]);
 await pool.share(first.scene,first.parser,{disposeOrphanedBitmaps:true});
 const next=bitmapScene([bitmapTexture(b)],[[1]]);
 await pool.share(next.scene,next.parser,{disposeOrphanedBitmaps:true});
 assert.equal(next.scene.children[0] instanceof THREE.Mesh,true);assert.equal(b.closes,0);assert.equal(a.closes,0);
}));

test('lookup or source-rebind failure never closes displaced bitmaps',async()=>withBitmaps(async()=>{
 for(const failRebind of [false,true]){
  const pool=new EmbeddedImagePool(),canonical=new FakeBitmap(),initial=bitmapScene([bitmapTexture(canonical)],[[1]]);
  await pool.share(initial.scene,initial.parser,{disposeOrphanedBitmaps:true});
  const duplicate=new FakeBitmap(),a=bitmapTexture(duplicate),b=bitmapTexture(duplicate),next=bitmapScene([a,b],[[1],[1]]);
  if(failRebind){const source=b.source;Object.defineProperty(b,'source',{get:()=>source,set:()=>{throw Error('rebind failed');}});}
  else{const original=next.parser.getDependency;next.parser.getDependency=async(kind,index)=>{if(index===1)throw Error('lookup failed');return original(kind,index);};}
  await assert.rejects(pool.share(next.scene,next.parser,{disposeOrphanedBitmaps:true}),/failed/);
  assert.equal(duplicate.closes,0);assert.equal(canonical.closes,0);assert.equal(b.image,duplicate);
 }
}));

test('generic callers, cache-enabled loads and directly cached bitmap identities are never disposed',async()=>withBitmaps(async()=>{
 for(const mode of ['default','enabled-cache','cached-identity']){
  THREE.Cache.enabled=false;THREE.Cache.files={};
  const pool=new EmbeddedImagePool(),canonical=new FakeBitmap(),initial=bitmapScene([bitmapTexture(canonical)],[[1]]);
  await pool.share(initial.scene,initial.parser);
  const duplicate=new FakeBitmap(),next=bitmapScene([bitmapTexture(duplicate)],[[1]]);
  if(mode==='enabled-cache')THREE.Cache.enabled=true;
  if(mode==='cached-identity')THREE.Cache.files['image-bitmap:external']=duplicate;
  await pool.share(next.scene,next.parser,mode==='default'?{}:{disposeOrphanedBitmaps:true});
  assert.equal(duplicate.closes,0);assert.equal(canonical.closes,0);
 }
}));
