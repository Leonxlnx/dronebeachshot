import * as THREE from 'three';

// Opt-in experiment for already integrated source-crown atlas coverage only.
// The source alpha and stock derivative-scaled threshold distribution are kept;
// independent roots receive different discrete hash fields within one draw.
const defineName='BAY_ROOT_SEEDED_CROWN_HASH';
const vertexDeclarations=/* glsl */ `
flat varying vec3 vRootCrownSalt;
uint rootCrownMixBits(uint value){
 value ^= value >> 16u; value *= 0x7feb352du;
 value ^= value >> 15u; value *= 0x846ca68bu;
 return value ^ (value >> 16u);
}
`;
const vertexSalt=/* glsl */ `
mat4 rootCrownWorld=modelMatrix;
#ifdef USE_INSTANCING
 rootCrownWorld=modelMatrix*instanceMatrix;
#endif
// Immutable root transform, before wind and billboard deformation. Packed
// instance order and frame/time are deliberately absent from this seed.
uvec3 rootCrownBits=floatBitsToUint(rootCrownWorld[3].xyz);
uint rootCrownSeed=rootCrownMixBits(rootCrownBits.x
 ^ rootCrownMixBits(rootCrownBits.y+0x9e3779b9u)
 ^ rootCrownMixBits(rootCrownBits.z+0x85ebca6bu));
vRootCrownSalt=vec3(float(rootCrownSeed & 1023u),
 float((rootCrownSeed >> 10u) & 1023u),float((rootCrownSeed >> 20u) & 1023u));
`;
let seededHash=THREE.ShaderChunk.alphahash_pars_fragment;
for(const axis of ['x','y']){
 const anchor=`hash3D( floor( pixScales.${axis} * position.xyz ) )`;
 if(!seededHash.includes(anchor))throw Error('Unsupported Three alphaHash chunk');
 // Salt after discretization. dFdx/dFdy still see the original local position,
 // so a large coordinate offset cannot change the hash footprint estimate.
 seededHash=seededHash.replace(anchor,
  `hash3D( floor( pixScales.${axis} * position.xyz ) + vRootCrownSalt )`);
}
seededHash='flat varying vec3 vRootCrownSalt;\n'+seededHash;

type DefinedMaterial=THREE.Material & {defines?:Record<string,unknown>};
type OriginalFlags={alphaHash:boolean;alphaToCoverage:boolean};
type BlendFlags=Pick<THREE.Material,'transparent'|'depthWrite'|'depthTest'|'blending'|'forceSinglePass'|'premultipliedAlpha'>;
type Pair={color:THREE.Material;depth:THREE.Material;original:OriginalFlags[];blendOriginal:BlendFlags;installed:boolean;enabled:boolean;blended:boolean};
const pairs=new Set<Pair>();
const registered=new WeakSet<THREE.Material>();
const blendListeners=new Set<(value:boolean)=>void>();
let enabled=false,blendingEnabled=false;

function applyBlend(pair:Pair,value:boolean){
 if(pair.blended===value)return;
 pair.blended=value;
 Object.assign(pair.color,value?{transparent:true,depthWrite:false,depthTest:true,
  blending:THREE.NormalBlending,forceSinglePass:true,premultipliedAlpha:false,
  alphaHash:false,alphaToCoverage:false}:{...pair.blendOriginal,...pair.original[0]});
 // Built-in flags select a separate Three program; existing shader hooks, raw
 // atlas alpha, opacity and the original hashed custom depth stay untouched.
 pair.color.needsUpdate=true;
}

function install(material:THREE.Material,pair:Pair){
 const previous=material.onBeforeCompile.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  previous(shader,renderer);
  if(!pair.enabled)return;
  for(const anchor of ['#include <common>','#include <begin_vertex>'])
   if(!shader.vertexShader.includes(anchor))throw Error('Missing crown coverage vertex anchor: '+anchor);
  if(!shader.fragmentShader.includes('#include <alphahash_pars_fragment>'))
   throw Error('Missing crown alphaHash fragment anchor');
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>\n'+vertexDeclarations)
   .replace('#include <begin_vertex>','#include <begin_vertex>\n'+vertexSalt);
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphahash_pars_fragment>',seededHash);
 };
}

function apply(pair:Pair,value:boolean){
 if(pair.enabled===value)return;
 if(value&&!pair.installed){install(pair.color,pair);install(pair.depth,pair);pair.installed=true;}
 pair.enabled=value;
 for(const [index,material] of [pair.color,pair.depth].entries()){
  const defined=material as DefinedMaterial;
  if(value){
   material.alphaHash=true;material.alphaToCoverage=false;
   // Cloud/aerial wrappers can snapshot customProgramCacheKey. This define is
   // also part of Three's cache key, including for depth which was already hashed.
   defined.defines={...defined.defines,[defineName]:1};
  }else{
   material.alphaHash=pair.original[index].alphaHash;
   material.alphaToCoverage=pair.original[index].alphaToCoverage;
   if(defined.defines){delete defined.defines[defineName];if(!Object.keys(defined.defines).length)delete defined.defines;}
  }
  material.needsUpdate=true;
 }
}

/** Register only lod3 + coverageMap pairs after their existing material hooks.
 * Registration while disabled leaves shader hooks, flags and defines untouched.
 * Both color and custom depth receive the identical rule when opted in.
 */
export function registerFarCrownCoveragePair(color:THREE.Material,depth:THREE.Material){
 if(registered.has(color)||registered.has(depth))throw Error('Crown coverage pair already registered');
 if([color,depth].some(m=>(m as DefinedMaterial).defines?.[defineName]!==undefined))
  throw Error('Crown coverage shader define already reserved');
 const pair:Pair={color,depth,installed:false,enabled:false,blended:false,
  blendOriginal:{transparent:color.transparent,depthWrite:color.depthWrite,depthTest:color.depthTest,
   blending:color.blending,forceSinglePass:color.forceSinglePass,premultipliedAlpha:color.premultipliedAlpha},
  original:[color,depth].map(m=>({alphaHash:m.alphaHash,alphaToCoverage:m.alphaToCoverage}))};
 registered.add(color);registered.add(depth);pairs.add(pair);
 const dispose=()=>{
  pairs.delete(pair);color.removeEventListener('dispose',dispose);depth.removeEventListener('dispose',dispose);
 };
 color.addEventListener('dispose',dispose);depth.addEventListener('dispose',dispose);
 apply(pair,enabled);
 applyBlend(pair,blendingEnabled);
}

/** Capture/inspection opt-in. Default OFF; no source texture or opacity changes. */
export function setFarCrownCoverage(value:boolean){
 if(value)setFarCrownMaterialBlending(false);
 enabled=value;for(const pair of pairs)apply(pair,value);
 return getFarCrownCoverage();
}
export function getFarCrownCoverage(){
 return {enabled,pairs:pairs.size,scope:'core and remote integrated far-crown atlases'};
}

/** Internal material half of the independently gated blending study. The two
 * coverage studies are mutually exclusive; enabling either restores the other.
 */
export function setFarCrownMaterialBlending(value:boolean){
 if(value)setFarCrownCoverage(false);
 if(blendingEnabled===value)return;
 blendingEnabled=value;for(const pair of pairs)applyBlend(pair,value);
 for(const listener of blendListeners)listener(value);
}
export function getFarCrownMaterialBlending(){return blendingEnabled;}
export function onFarCrownMaterialBlendingChange(listener:(value:boolean)=>void){
 blendListeners.add(listener);return()=>blendListeners.delete(listener);
}
