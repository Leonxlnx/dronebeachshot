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
 assert.deepEqual(b.offset.toArray(),[.2,.4]);assert.deepEqual(pool.stats,{uniqueImages:2,sharedImages:1});
 pool.clear();assert.equal(a.source,b.source);
});
