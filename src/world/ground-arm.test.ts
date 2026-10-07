import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {createGroundARMArray} from './assets.ts';
import {createGroundMaterial,createRockMaterial} from '../render/ground-materials.ts';
import type {Textures} from '../render/materials.ts';

test('ground ARM array preserves real scan bytes, orientation and sampler state within the 16-sampler floor',()=>{
 const names=['sand_03_arm_2k.webp','forest_ground_05_arm_2k.webp','forest_leaves_02_arm_2k.webp'];
 const sources=names.map(name=>{
  const file=fileURLToPath(new URL('../../public/assets/textures/'+name,import.meta.url)),encoded=fs.readFileSync(file);
  // Untagged, opaque sources make the browser's 2D readback a byte-preserving
  // path: no embedded profile conversion or alpha premultiplication rounding.
  for(let offset=12;offset+8<=encoded.length;){
   assert.notEqual(encoded.toString('ascii',offset,offset+4),'ICCP','Recheck browser color conversion before packing profiled ARM images');
   const length=encoded.readUInt32LE(offset+4);offset+=8+length+(length%2);
  }
  const decoded=spawnSync('ffmpeg',['-v','error','-i',file,'-frames:v','1','-pix_fmt','rgba','-c:v','pam','-f','image2pipe','pipe:1'],{maxBuffer:64*1024*1024});
  assert.equal(decoded.status,0,String(decoded.stderr||decoded.error));
  const end=decoded.stdout.indexOf('ENDHDR\n')+7;assert.ok(end>7);
  const header=decoded.stdout.toString('ascii',0,end),width=Number(/WIDTH (\d+)/.exec(header)?.[1]),height=Number(/HEIGHT (\d+)/.exec(header)?.[1]);
  assert.match(header,/DEPTH 4\nMAXVAL 255/);assert.deepEqual([width,height],[2048,2048]);
  const data=decoded.stdout.subarray(end);assert.equal(data.length,width*height*4);
  for(let i=3;i<data.length;i+=4)assert.equal(data[i],255);
  const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.UnsignedByteType);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;texture.flipY=true;
  texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  return texture;
 });
 const array=createGroundARMArray(sources),{data,width,height,depth}=array.image,stride=width*4,layerBytes=stride*height;
 assert.equal(depth,3);assert.equal(array.flipY,false);assert.equal(array.colorSpace,THREE.NoColorSpace);
 for(const key of ['wrapS','wrapT','anisotropy','generateMipmaps','minFilter','magFilter'] as const)assert.equal(array[key],sources[0][key]);
 for(const [layer,source]of sources.entries())for(let y=0;y<height;y++){
  const offset=layer*layerBytes+(height-1-y)*stride;
  assert.deepEqual(Buffer.from(data!.buffer,data!.byteOffset+offset,stride),source.image.data.subarray(y*stride,(y+1)*stride),'source layer '+layer+', row '+y);
 }
 const textures=Object.fromEntries(['rock','rockNormal','rockARM','sand','sandNormal','sandARM','bark','barkNormal','soil','soilNormal','soilARM','moss','mossNormal','mossARM'].map(key=>[key,new THREE.Texture()])) as Textures;
 textures.groundARM=array;
 const compile=(material:THREE.MeshStandardMaterial)=>{
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader} as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);material.dispose();return shader;
 };
 for(const pruning of [false,true]){
  const shader=compile(createGroundMaterial(textures,pruning));
  const samplers=[...shader.fragmentShader.matchAll(/uniform\s+(?:highp\s+)?sampler\w+\s+([^;]+);/g)].flatMap(match=>match[1].split(',')).filter(name=>/^u/.test(name.trim()));
  assert.equal(samplers.length+4,15,'custom maps + cloud shadow/environment/sun shadow/Three DFG');
  assert.equal(shader.uniforms.uGroundARM.value,array);assert.equal(shader.uniforms.uRockARM.value,textures.rockARM);
  assert.ok(!/\bu(?:Sand|Soil|Moss)ARM\b/.test(shader.fragmentShader));
  assert.match(shader.fragmentShader,/groundSandARMGrad\(groundSandUV,groundSandDx,groundSandDy\)/);
  for(const source of ['uSand','uSandN'])assert.ok(shader.fragmentShader.includes('groundStoneSampleGrad('+source+',groundSandUV,groundSandDx,groundSandDy)'));
  for(const phase of ['a','b','c'])assert.ok(shader.fragmentShader.includes('textureGrad(uGroundARM,vec3(uv+stonePhase('+phase+'),0.),dx,dy)'));
  const phaseWeights=(name:string)=>shader.fragmentShader.slice(shader.fragmentShader.indexOf('vec3 '+name+'(')).split('return textureGrad')[0].split('vec2 skew=')[1].replace(/\/\/[^\n]*/g,'').replace(/\s+/g,'');
  assert.equal(phaseWeights('groundSandARMGrad'),phaseWeights('groundStoneSampleGrad'),'sand albedo/normal/ARM must share source phases and weights');
 }
 const rock=compile(createRockMaterial(textures));assert.equal(rock.uniforms.uMossARM.value,textures.mossARM);assert.equal(rock.uniforms.uGroundARM,undefined);
 const tiny=sources.map((source,i)=>{const copy=source.clone();copy.image={data:new Uint8Array([i,1,2,255,i,3,4,255]),width:1,height:2};copy.flipY=i!==1;return copy;});
 assert.deepEqual(Array.from(createGroundARMArray(tiny).image.data!),[0,3,4,255,0,1,2,255,1,1,2,255,1,3,4,255,2,3,4,255,2,1,2,255]);
 tiny[2].anisotropy=1;assert.throws(()=>createGroundARMArray(tiny),/sampler state/);
 assert.throws(()=>createGroundARMArray([]),/sand, soil and moss/);
 array.dispose();for(const source of sources)source.dispose();for(const texture of Object.values(textures))texture.dispose();
});
