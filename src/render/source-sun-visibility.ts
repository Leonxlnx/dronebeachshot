import * as THREE from 'three';

export const SOURCE_VISIBILITY_WIDTH=1024;
export const SOURCE_VISIBILITY_HEIGHT=3072;
export function createSourceVisibilityTexture(bytes:Uint8Array){
 if(bytes.byteLength!==SOURCE_VISIBILITY_WIDTH*SOURCE_VISIBILITY_HEIGHT*2)
  throw Error('Expected 24 views × 8 sun azimuths × 128² RG8');
 const texture=new THREE.DataTexture(bytes,SOURCE_VISIBILITY_WIDTH,SOURCE_VISIBILITY_HEIGHT,THREE.RGFormat,THREE.UnsignedByteType);
 texture.colorSpace=THREE.NoColorSpace;texture.generateMipmaps=true;
 texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
 texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.flipY=false;
 texture.unpackAlignment=1;texture.name='Source geometry sun visibility / coverage';texture.needsUpdate=true;
 return texture;
}
const sampleGLSL=`
uniform sampler2D uSourceSunVisibility;
uniform float uSourceSunEnabled;
varying vec3 vSourceSunFrames;
vec2 sourceSunView(sampler2D atlas,vec2 cellUV,vec4 frames,vec2 blend,float sunFrame){
 vec2 localUV=cellUV*vec2(1.,.125);
 vec2 row=vec2((sunFrame*3.+2.-frames.z)/24.,(sunFrame*3.+2.-frames.w)/24.);
 vec2 a=texture2D(atlas,localUV+vec2(frames.x/8.,row.x)).rg;
 vec2 b=texture2D(atlas,localUV+vec2(frames.y/8.,row.x)).rg;
 vec2 c=texture2D(atlas,localUV+vec2(frames.x/8.,row.y)).rg;
 vec2 d=texture2D(atlas,localUV+vec2(frames.y/8.,row.y)).rg;
 return mix(mix(a,b,blend.x),mix(c,d,blend.x),blend.y);
}
float sourceSunFactor(vec2 cellUV,vec4 frames,vec2 blend){
 vec2 a=sourceSunView(uSourceSunVisibility,cellUV,frames,blend,vSourceSunFrames.x);
 vec2 b=sourceSunView(uSourceSunVisibility,cellUV,frames,blend,vSourceSunFrames.y);
 vec2 value=mix(a,b,vSourceSunFrames.z);
 // Filter source visibility together with its actual cutout coverage. Empty
 // padding cannot create invented shadow when a crown is minified.
 float visibility=value.g>.00001?clamp(value.r/value.g,0.,1.):1.;
 return mix(1.,visibility,uSourceSunEnabled);
}
`;
/** Far-only source self-shadow: fixed source sun elevation, eight relative yaw samples.
 * Does not change source RGB, normals, alpha coverage, sky fill or cloud shadow.
 * The scene currently has one directional sun; no additional lights are baked.
 */
export function bindSourceSunVisibility(material:THREE.MeshStandardMaterial,
 texture:THREE.DataTexture,sun:{value:THREE.Vector3},enabled={value:1}){
 const previous=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  previous(shader,renderer);
  Object.assign(shader.uniforms,{uSourceSunDirection:sun,uSourceSunVisibility:{value:texture},uSourceSunEnabled:enabled});
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>\nuniform vec3 uSourceSunDirection;varying vec3 vSourceSunFrames;')
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    vec3 sourceLocalSun=normalize(inverse(mat3(treeWorld))*uSourceSunDirection);
    float sourceSunColumn=mod(atan(sourceLocalSun.x,sourceLocalSun.z)*(8./6.28318530718)+8.,8.);
    float sourceSun0=floor(sourceSunColumn);
    vSourceSunFrames=vec3(sourceSun0,mod(sourceSun0+1.,8.),fract(sourceSunColumn));`);
  const anchor='float transmission = clamp(uLeafTransmission, 0.0, 0.25);';
  if(!shader.fragmentShader.includes(anchor))throw Error('Expected shared foliage direct-light response');
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>','#include <common>\n'+sampleGLSL)
   .replace(anchor,`IncidentLight sourceOccludedLight=directLight;
    sourceOccludedLight.color*=sourceSunFactor(vMapUv,vImpostorFrames,vImpostorBlend);
    ${anchor}`)
   .replace('RE_Direct_Physical(directLight, geometryPosition','RE_Direct_Physical(sourceOccludedLight, geometryPosition')
   .replace('reflectedLight.directDiffuse += directLight.color','reflectedLight.directDiffuse += sourceOccludedLight.color');
 };
 material.customProgramCacheKey=()=>key()+'-source-sun-visibility-v2-neutral-padding';material.needsUpdate=true;
 return enabled;
}

export async function loadSourceVisibilityTexture(url:string){
 const response=await fetch(url);if(!response.ok)throw Error('Could not load tree light detail: '+response.status);
 return createSourceVisibilityTexture(new Uint8Array(await response.arrayBuffer()));
}
