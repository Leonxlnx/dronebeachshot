// CPU-only validation of the real study registry, material chain and loader.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {createTreeImpostor} from '../../src/world/tree-impostor.ts';
import {treeImpostorDefinitions} from '../../src/world/tree-impostor-data.ts';
import {islandForkOpenDefinition} from '../../src/world/tree-form-data.ts';
import {withCloudLighting} from '../../src/render/sky-lighting.ts';
import {getIslandDirectResponseStudy,setIslandDirectResponseStudy,loadIslandDirectResponseStudy,
 disposeIslandDirectResponseStudy,createIslandDirectResponseAtlas,validateIslandDirectResponseManifest} from '../../src/render/island-direct-response.ts';

const digest=bytes=>createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
const assets=JSON.parse(await fs.readFile(new URL('../../public/assets/manifest.json',import.meta.url),'utf8'));
const sha=path=>assets.find(asset=>asset.path===path).sha256;
const base=treeImpostorDefinitions[0],payload=new ArrayBuffer(128*128*192*4*2),samples=new Uint16Array(payload);
for(let layer=0;layer<192;layer++)samples.set([0x3000,0x3400,0x3800,0x3c00],layer*128*128*4);
const manifest={schema:'island-direct-response-v1',complete:true,family:'island-base',
 sourceSHA256:sha('public/assets/models/island-tree-near.glb'),albedoSHA256:sha('public/assets/impostors/island-albedo.png'),normalSHA256:sha('public/assets/impostors/island-normal.png'),
 center:base.center,halfSize:base.halfSize,bounds:base.bounds,viewAzimuths:[0,45,90,135,180,225,270,315],viewElevations:[0,35,70],sunAzimuths:[0,45,90,135,180,225,270,315],sunElevation:6.021653966,
 sourceRenderSize:1024,sourceAlbedoCellSize:256,sourceSupersample:4,samples:4,cellSize:128,layers:192,format:'RGBA16F',byteOrder:'little-endian',layout:'sun-major-view-major-bottom-first',
 response:'coverage-premultiplied-unit-white-sun-directDiffuse',normalization:'conditional-response-own-coverage',data:{file:'response.rgba16f',bytes:payload.byteLength,sha256:digest(payload)}};
let checks=0;
disposeIslandDirectResponseStudy();assert.equal(getIslandDirectResponseStudy().enabled,false);assert.equal(getIslandDirectResponseStudy().ready,false);
assert.throws(()=>setIslandDirectResponseStudy(true),/validated/);checks++;
assert.equal(validateIslandDirectResponseManifest(manifest),manifest);
assert.throws(()=>validateIslandDirectResponseManifest({...manifest,complete:false}),/incomplete/);
assert.throws(()=>validateIslandDirectResponseManifest({...manifest,sourceRenderSize:512}),/sampling/);
assert.throws(()=>validateIslandDirectResponseManifest({...manifest,center:islandForkOpenDefinition.center}),/framing/);
assert.throws(()=>validateIslandDirectResponseManifest({...manifest,normalization:'divide-by-old-alpha'}),/radiometric/);checks+=5;
assert.throws(()=>createIslandDirectResponseAtlas(manifest,new ArrayBuffer(8)),/incomplete/);
samples[0]=0x7c00;assert.throws(()=>createIslandDirectResponseAtlas(manifest,payload),/nonfinite/);samples[0]=0x3000;
const laterAlpha=24*128*128*4+3;samples[laterAlpha]=0x3800;assert.throws(()=>createIslandDirectResponseAtlas(manifest,payload),/sun direction/);samples[laterAlpha]=0x3c00;checks+=3;
const testAtlas=createIslandDirectResponseAtlas(manifest,payload);assert.equal(testAtlas.texture.image.depth,192);assert.equal(testAtlas.texture.minFilter,THREE.LinearMipmapLinearFilter);testAtlas.texture.dispose();checks++;

const makeTexture=()=>{const texture=new THREE.DataTexture(new Uint8Array(64).fill(255),4,4);texture.needsUpdate=true;return texture;};
const textures=[makeTexture(),makeTexture(),new THREE.DataTexture(new Uint8Array([255,255]),1,1,THREE.RGFormat)];
const meshes=[base,islandForkOpenDefinition,treeImpostorDefinitions[1]].map(metadata=>{
 const mesh=createTreeImpostor(metadata,...textures.slice(0,2),1,textures[2]);withCloudLighting(mesh.material);return mesh;
});
const compile=(material,library)=>{const source=THREE.ShaderLib[library],shader={uniforms:THREE.UniformsUtils.clone(source.uniforms),vertexShader:source.vertexShader,fragmentShader:source.fragmentShader};material.onBeforeCompile(shader,{});return shader;};
const before=meshes.map(mesh=>compile(mesh.material,'standard')),depthBefore=meshes.map(mesh=>compile(mesh.customDepthMaterial,'depth'));
const beforeFlags=meshes.map(({material:m})=>[m.map,m.opacity,m.alphaTest,m.alphaHash,m.alphaToCoverage,m.transparent,m.depthWrite]);
assert.equal(getIslandDirectResponseStudy().registeredMaterials,1);assert(before.every(shader=>!shader.fragmentShader.includes('uIslandDirectResponse')));checks++;
const originalFetch=globalThis.fetch;
try{
 let calls=0;
 globalThis.fetch=async url=>{calls++;return new Response(String(url).endsWith('.json')?JSON.stringify(manifest):payload);};
 const loaded=await loadIslandDirectResponseStudy('https://fixture.invalid/manifest.json');
 assert.equal(loaded.ready,true);assert.equal(loaded.loading,false);assert.equal(loaded.enabled,false);assert.equal(calls,2);
 await loadIslandDirectResponseStudy('https://fixture.invalid/manifest.json');assert.equal(calls,2);checks+=2;
 setIslandDirectResponseStudy(true);
 const after=meshes.map(mesh=>compile(mesh.material,'standard'));
 assert(after[0].fragmentShader.includes('uIslandDirectResponse'));
 assert(after[0].fragmentShader.includes('islandInstanceTint*=vColor.rgb'));
 assert(after[0].fragmentShader.includes('RE_Direct_Physical(sourceOccludedLight, geometryPosition'));
 assert(after[0].fragmentShader.includes('directLight.color *= atmosphericSunlight'));
 assert(after[0].fragmentShader.includes('if(uDebug==1.)gl_FragColor.rgb=diffuseColor.rgb'));
 for(let i=0;i<meshes.length;i++){
  assert.equal(after[i].vertexShader,before[i].vertexShader);
  const depth=compile(meshes[i].customDepthMaterial,'depth');assert.equal(depth.vertexShader,depthBefore[i].vertexShader);assert.equal(depth.fragmentShader,depthBefore[i].fragmentShader);
  const m=meshes[i].material;assert.deepEqual([m.map,m.opacity,m.alphaTest,m.alphaHash,m.alphaToCoverage,m.transparent,m.depthWrite],beforeFlags[i]);
  if(i>0)assert.equal(after[i].fragmentShader,before[i].fragmentShader);
 }
 checks+=5;
 setIslandDirectResponseStudy(false);
 for(let i=0;i<meshes.length;i++)assert.equal(compile(meshes[i].material,'standard').fragmentShader,before[i].fragmentShader);
 checks++;
 globalThis.fetch=async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('fixture aborted')),{once:true}));
 const cancelled=loadIslandDirectResponseStudy('https://fixture.invalid/other.json');
 assert.equal(getIslandDirectResponseStudy().ready,true);assert.equal(getIslandDirectResponseStudy().loading,true);
 assert.throws(()=>setIslandDirectResponseStudy(true),/Wait for/);assert.equal(getIslandDirectResponseStudy().enabled,false);checks++;
 disposeIslandDirectResponseStudy();await assert.rejects(cancelled,/aborted/);
 assert.equal(getIslandDirectResponseStudy().ready,false);assert.equal(getIslandDirectResponseStudy().loading,false);checks++;
}finally{
 globalThis.fetch=originalFetch;disposeIslandDirectResponseStudy();
 for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();mesh.customDepthMaterial.dispose();mesh.dispose();}
 textures.forEach(texture=>texture.dispose());
}
assert.equal(getIslandDirectResponseStudy().registeredMaterials,0);checks++;
console.log(JSON.stringify({ok:true,checks,scope:'CPU-only actual source composition, validated payload and lazy-load lifecycle; no GPU or visual acceptance'}));
