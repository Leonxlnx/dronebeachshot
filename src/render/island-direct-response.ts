import * as THREE from 'three';
import {treeImpostorDefinitions} from '../world/tree-impostor-data';
import type {TreeImpostorMetadata} from '../world/tree-impostor';

// Optional source response, loaded explicitly by app startup or inspection.
// Registration alone does not fetch it or change OFF shaders. Base Island
// framing distinguishes it from the family-0 fork-open form.
const defineName='BAY_ISLAND_DIRECT_RESPONSE';
const cellSize=128,viewCount=24,sunCount=8,layerCount=viewCount*sunCount;
const payloadBytes=cellSize*cellSize*layerCount*4*2;
const sourceHashes={
 source:'c81e6ece28b7646aa59f2c2c68142619b2790d0db62c5d829278fec92e4373d7',
 albedo:'fa511d86ca9659007e0c4cc0d17d9344cda5b7c8c2868c524eb70a6f942d7eac',
 normal:'a6cd5cbb19f2647d6980a8eaeee9839d0622e81ba847033e321693fe1d4afd7a',
};
type DefinedMaterial=THREE.MeshStandardMaterial & {defines:Record<string,unknown>};
export type IslandDirectResponseManifest={
 schema:'island-direct-response-v1';complete:true;family:'island-base';
 sourceSHA256:string;albedoSHA256:string;normalSHA256:string;
 center:number[];halfSize:number;bounds:{min:number[];max:number[]};
 viewAzimuths:number[];viewElevations:number[];sunAzimuths:number[];sunElevation:number;
 sourceRenderSize:1024;sourceAlbedoCellSize:256;sourceSupersample:4;samples:4;
 cellSize:128;layers:192;format:'RGBA16F';byteOrder:'little-endian';
 layout:'sun-major-view-major-bottom-first';
 response:'coverage-premultiplied-unit-white-sun-directDiffuse';
 normalization:'conditional-response-own-coverage';
 data:{file:string;bytes:number;sha256:string};
};
type Atlas={manifest:IslandDirectResponseManifest;texture:THREE.DataArrayTexture;maxRGB:number};
type StudyState={enabled:boolean;ready:boolean;loading:boolean;error:string|null;registeredMaterials:number;
 scope:string;manifestURL:string|null;dataSHA256:string|null;baseBytes:number;logicalTextureBytesWithMips:number;
 normalization:string;tint:string};
const materials=new Set<DefinedMaterial>();
const registered=new WeakSet<THREE.Material>();
const textureUniform:{value:THREE.DataArrayTexture|null}={value:null};
let enabled=false,atlas:Atlas|null=null,loadedURL:string|null=null;
let pending:Promise<StudyState>|null=null;
let pendingURL:string|null=null,abort:AbortController|null=null,epoch=0,error:string|null=null;

function sameNumbers(a:unknown,b:number[]):boolean{
 return Array.isArray(a)&&a.length===b.length&&a.every((value,index)=>value===b[index]);
}
export function isBaseIslandResponseFrame(metadata:TreeImpostorMetadata){
 const base=treeImpostorDefinitions[0];
 return metadata.family===0&&metadata.columns===8&&metadata.rows===3
  &&metadata.halfSize===base.halfSize&&sameNumbers(metadata.center,base.center)
  &&sameNumbers(metadata.bounds.min,base.bounds.min)&&sameNumbers(metadata.bounds.max,base.bounds.max);
}
export function validateIslandDirectResponseManifest(value:unknown):IslandDirectResponseManifest{
 const m=value as Partial<IslandDirectResponseManifest>|null,base=treeImpostorDefinitions[0];
 const fail=(message:string):never=>{throw Error('Island direct-response manifest: '+message);};
 if(!m||m.schema!=='island-direct-response-v1'||m.complete!==true||m.family!=='island-base')fail('incomplete or wrong source family');
 if(m!.sourceSHA256!==sourceHashes.source||m!.albedoSHA256!==sourceHashes.albedo||m!.normalSHA256!==sourceHashes.normal)fail('source atlas identity mismatch');
 if(m!.halfSize!==base.halfSize||!sameNumbers(m!.center,base.center)||!sameNumbers(m!.bounds?.min,base.bounds.min)||!sameNumbers(m!.bounds?.max,base.bounds.max))fail('source framing mismatch');
 if(!sameNumbers(m!.viewAzimuths,[0,45,90,135,180,225,270,315])||!sameNumbers(m!.viewElevations,[0,35,70])
  ||!sameNumbers(m!.sunAzimuths,[0,45,90,135,180,225,270,315])||m!.sunElevation!==6.021653966)fail('view or sun grid mismatch');
 if(m!.sourceRenderSize!==1024||m!.sourceAlbedoCellSize!==256||m!.sourceSupersample!==4||m!.samples!==4)fail('source sampling contract mismatch');
 if(m!.cellSize!==cellSize||m!.layers!==layerCount||m!.format!=='RGBA16F'||m!.byteOrder!=='little-endian'
  ||m!.layout!=='sun-major-view-major-bottom-first')fail('response storage mismatch');
 if(m!.response!=='coverage-premultiplied-unit-white-sun-directDiffuse'||m!.normalization!=='conditional-response-own-coverage')fail('radiometric contract mismatch');
 if(!m!.data||typeof m!.data.file!=='string'||!m!.data.file||m!.data.bytes!==payloadBytes||!/^[a-f0-9]{64}$/.test(m!.data.sha256))fail('payload identity missing');
 return m as IslandDirectResponseManifest;
}

/** Validates authoring output; it does not enable or install the study. */
export function createIslandDirectResponseAtlas(manifestValue:unknown,payload:ArrayBuffer):Atlas{
 const manifest=validateIslandDirectResponseManifest(manifestValue);
 if(payload.byteLength!==payloadBytes)throw Error('Island direct-response payload is incomplete');
 if(new Uint8Array(new Uint16Array([1]).buffer)[0]!==1)throw Error('Island response requires a little-endian host');
 const data=new Uint16Array(payload),layerValues=cellSize*cellSize*4;
 let maxRGB=0;
 for(let layer=0;layer<layerCount;layer++){
  let covered=false;
  for(let pixel=0;pixel<layerValues;pixel+=4){
   const offset=layer*layerValues+pixel,alpha=data[offset+3];
   for(let c=0;c<4;c++){
    const value=data[offset+c];
    if((value&0x7c00)===0x7c00||((value&0x8000)!==0&&value!==0x8000))throw Error('Island response contains nonfinite or negative samples');
    if(c<3&&value>maxRGB)maxRGB=value;
   }
   if(alpha>0x3c00)throw Error('Island response coverage exceeds one');
   if(alpha>0)covered=true;
   if(layer>=viewCount&&alpha!==data[(layer%viewCount)*layerValues+pixel+3])throw Error('Island response coverage varies with sun direction');
  }
  if(!covered)throw Error('Island response has an empty view layer');
 }
 const texture=new THREE.DataArrayTexture(data,cellSize,cellSize,layerCount);
 texture.name='Island source direct diffuse';
 texture.type=THREE.HalfFloatType;texture.format=THREE.RGBAFormat;texture.colorSpace=THREE.NoColorSpace;
 texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
 texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.flipY=false;texture.unpackAlignment=1;texture.needsUpdate=true;
 return {manifest,texture,maxRGB:THREE.DataUtils.fromHalfFloat(maxRGB)};
}

const responseGLSL=/* glsl */`
uniform highp sampler2DArray uIslandDirectResponse;
vec4 islandDirectView(vec2 localUV,vec4 frames,vec2 blend,float sunFrame){
 float first=sunFrame*24.;
 vec4 a=texture(uIslandDirectResponse,vec3(localUV,first+frames.z*8.+frames.x));
 vec4 b=texture(uIslandDirectResponse,vec3(localUV,first+frames.z*8.+frames.y));
 vec4 c=texture(uIslandDirectResponse,vec3(localUV,first+frames.w*8.+frames.x));
 vec4 d=texture(uIslandDirectResponse,vec3(localUV,first+frames.w*8.+frames.y));
 return mix(mix(a,b,blend.x),mix(c,d,blend.x),blend.y);
}
vec3 islandDirectConditionalResponse(vec2 cellUV,vec4 frames,vec2 blend){
 vec2 localUV=cellUV*vec2(8.,3.);
 vec4 a=islandDirectView(localUV,frames,blend,vSourceSunFrames.x);
 vec4 b=islandDirectView(localUV,frames,blend,vSourceSunFrames.y);
 vec4 value=mix(a,b,vSourceSunFrames.z);
 // This denominator belongs to the same source samples as response RGB.
 // The existing map alpha remains the sole owner of runtime coverage.
 return value.a>.00001?value.rgb/value.a:vec3(0.);
}
`;

/** Register the color material after its actual source-visibility hook, before
 * cloud lighting. Custom depth, opacity, alpha and normal code are untouched. */
export function registerIslandDirectResponseMaterial(material:THREE.MeshStandardMaterial,metadata:TreeImpostorMetadata){
 if(!isBaseIslandResponseFrame(metadata))return false;
 if(registered.has(material))throw Error('Island response material already registered');
 const defined=material as DefinedMaterial;
 if(defined.defines?.[defineName]!==undefined)throw Error('Island response define is reserved');
 const previous=material.onBeforeCompile.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  previous(shader,renderer);
  if(!enabled)return;
  if(!atlas||!textureUniform.value)throw Error('Island response enabled without its validated atlas');
  const start='IncidentLight sourceOccludedLight=directLight;';
  const end='* backCosine * transmission * transmittance;';
  for(const anchor of [start,end,'varying vec3 vSourceSunFrames;'])
   if(shader.fragmentShader.split(anchor).length!==2)throw Error('Island response requires the actual source-light hook: '+anchor);
  shader.uniforms.uIslandDirectResponse=textureUniform;
  shader.fragmentShader=shader.fragmentShader
   .replace('varying vec3 vSourceSunFrames;','varying vec3 vSourceSunFrames;\n'+responseGLSL)
   .replace(start,'vec3 islandPriorDirectDiffuse=reflectedLight.directDiffuse;\n'+start)
   .replace(end,end+`
    vec3 islandInstanceTint=diffuse;
    #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
     islandInstanceTint*=vColor.rgb;
    #endif
    // directLight already includes current solar color/intensity, scene
    // shadows (including the unchanged proxy self-shadow) and cloud attenuation.
    // Baked albedo/self-shadow/transmission enter
    // once. Multiplying combined RGB by tint approximates nonlinear transmission.
    reflectedLight.directDiffuse=islandPriorDirectDiffuse+directLight.color
     *islandInstanceTint*islandDirectConditionalResponse(vMapUv,vImpostorFrames,vImpostorBlend);`);
 };
 registered.add(material);materials.add(defined);
 const dispose=()=>{materials.delete(defined);material.removeEventListener('dispose',dispose);};
 material.addEventListener('dispose',dispose);
 if(enabled){defined.defines={...defined.defines,[defineName]:1};material.needsUpdate=true;}
 return true;
}

export function setIslandDirectResponseStudy(value:boolean){
 if(value&&pending)throw Error('Wait for the Island response atlas load before enabling the study');
 if(value&&!atlas)throw Error('Load a validated Island direct-response atlas before enabling the study');
 if(value===enabled)return getIslandDirectResponseStudy();
 enabled=value;
 for(const material of materials){
  if(value)material.defines={...material.defines,[defineName]:1};
  else if(material.defines)delete material.defines[defineName];
  // Defines are part of Three's program cache even when later wrappers snapshot
  // customProgramCacheKey. OFF retrieves the original material program.
  material.needsUpdate=true;
 }
 return getIslandDirectResponseStudy();
}
export function getIslandDirectResponseStudy():StudyState{
 return {enabled,ready:atlas!==null,loading:pending!==null,error,registeredMaterials:materials.size,
  scope:'base Island far crowns only; fork-open/Syringa/near LODs unchanged',manifestURL:loadedURL,
  dataSHA256:atlas?.manifest.data.sha256??null,baseBytes:atlas?payloadBytes:0,
  logicalTextureBytesWithMips:atlas?Math.round(payloadBytes*4/3):0,
  normalization:'response RGB / response coverage; existing map alpha unchanged',
  tint:'linear instance tint once; nonlinear source transmission tint is approximate'};
}
const digest=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');

/** Explicit loading for app startup or inspection; registration never fetches. */
export function loadIslandDirectResponseStudy(manifestURL:string){
 const url=new URL(manifestURL,globalThis.location?.href).href;
 if(atlas&&loadedURL===url)return Promise.resolve(getIslandDirectResponseStudy());
 if(enabled)throw Error('Disable Island response before replacing its atlas');
 if(pending){if(pendingURL!==url)throw Error('Another Island response atlas load is active');return pending;}
 const requestEpoch=epoch,controller=new AbortController();abort=controller;pendingURL=url;error=null;
 const task=(async()=>{
  const manifestResponse=await fetch(url,{signal:controller.signal});
  if(!manifestResponse.ok)throw Error('Island response manifest fetch failed: '+manifestResponse.status);
  const manifest=validateIslandDirectResponseManifest(await manifestResponse.json());
  const dataURL=new URL(manifest.data.file,url);
  if(dataURL.origin!==new URL(url).origin)throw Error('Island response payload must share its manifest origin');
  const response=await fetch(dataURL,{signal:controller.signal});
  if(!response.ok)throw Error('Island response data fetch failed: '+response.status);
  const payload=await response.arrayBuffer();
  if(payload.byteLength!==manifest.data.bytes||await digest(payload)!==manifest.data.sha256)throw Error('Island response payload hash/length mismatch');
  const next=createIslandDirectResponseAtlas(manifest,payload);
  if(requestEpoch!==epoch){next.texture.dispose();throw Error('Island response load was disposed');}
  const old=atlas;atlas=next;textureUniform.value=next.texture;loadedURL=url;old?.texture.dispose();
 })();
 const clearPending=()=>{if(requestEpoch===epoch){pending=null;pendingURL=null;abort=null;}};
 pending=task.then(()=>{clearPending();return getIslandDirectResponseStudy();},reason=>{
  if(requestEpoch===epoch)error=String(reason);clearPending();throw reason;
 });
 return pending;
}
/** Call during application teardown; material dispose listeners own registry removal. */
export function disposeIslandDirectResponseStudy(){
 setIslandDirectResponseStudy(false);epoch++;abort?.abort();abort=null;pending=null;pendingURL=null;
 atlas?.texture.dispose();atlas=null;textureUniform.value=null;loadedURL=null;error=null;
}
