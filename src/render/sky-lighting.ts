import * as THREE from 'three';
import {sceneCaptureScale} from './refraction';
export const reflectedSky={value:null as THREE.CubeTexture|null};
export const solarDirection={value:new THREE.Vector3(-.38,.105,-.92).normalize()};
export const skyDecodeScale={value:1};
export const cloudShadow={value:null as THREE.Texture|null};
export const cloudShadowBounds={value:new THREE.Vector4(-2000,-1600,2000,5000)};
export const cloudLightingGLSL=`
uniform sampler2D uCloudShadow;uniform vec4 uCloudShadowBounds;uniform vec3 uSolarDirection;
float atmosphericSunlight(vec3 point){
 vec2 projected=point.xz-uSolarDirection.xz*(point.y/max(uSolarDirection.y,.001));
 vec2 uv=(projected-uCloudShadowBounds.xy)/(uCloudShadowBounds.zw-uCloudShadowBounds.xy);
 if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)return 1.;
 float edge=min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y));return mix(1.,mix(.18,1.,texture2D(uCloudShadow,uv).r),smoothstep(0.,.07,edge));
}
`;
// Cloud shadow projection is world-anchored and therefore camera-independent.
// Distant reflected sky uses a world-anchored sea-level probe.
export function withCloudLighting(material:THREE.MeshStandardMaterial){
 const previous=material.onBeforeCompile.bind(material),cache=material.customProgramCacheKey();
 material.onBeforeCompile=(shader,renderer)=>{
  previous(shader,renderer);shader.uniforms.uSceneCaptureScale=sceneCaptureScale;shader.uniforms.uCloudShadow=cloudShadow;shader.uniforms.uCloudShadowBounds=cloudShadowBounds;shader.uniforms.uSolarDirection=solarDirection;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vLightingWorld;').replace('#include <project_vertex>',`#include <project_vertex>
 vec4 lightWorld=vec4(transformed,1.);
 #ifdef USE_INSTANCING
 lightWorld=instanceMatrix*lightWorld;
 #endif
 vLightingWorld=(modelMatrix*lightWorld).xyz;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uSceneCaptureScale;varying vec3 vLightingWorld;\n'+cloudLightingGLSL);
  const lights=THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );','getDirectionalLightInfo( directionalLight, directLight );\n directLight.color *= atmosphericSunlight(vLightingWorld);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',lights).replace('#include <opaque_fragment>','#include <opaque_fragment>\ngl_FragColor.rgb*=uSceneCaptureScale;');
 };
 material.customProgramCacheKey=()=>cache+'-world-cloud-shadow-v2';
}
