import * as THREE from 'three';
import {debugMode} from './materials';
export const diagnosticFragment=`
if(uDebug==1.)gl_FragColor.rgb=diffuseColor.rgb;
if(uDebug==2.)gl_FragColor.rgb=inverseTransformDirection(normal,viewMatrix)*.5+.5;
if(uDebug==3.)gl_FragColor.rgb=vec3(roughnessFactor);
if(uDebug==4.)gl_FragColor.rgb=vec3(clamp(length(vViewPosition)/800.,0.,1.));
if(uDebug==7.)gl_FragColor.rgb=vec3(getShadowMask()*atmosphericSunlight(vLightingWorld));
if(uDebug==8.)gl_FragColor.rgb=uLod<0.?vec3(.3):uLod<.5?vec3(.2,.9,.3):uLod<1.5?vec3(.1,.75,.9):uLod<2.5?vec3(.15,.35,1.):vec3(1.,.2,.7);
if(uDebug==11.){float lum=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));gl_FragColor.rgb=lum<.015?vec3(.1,.2,1.):lum>3.?vec3(1.,.1,.05):vec3(lum*.25);}
`;
export function diagnosticOutputShader(fragment:string){
 for(const chunk of ['tonemapping_fragment','fog_fragment','dithering_fragment'])fragment=fragment.replace('#include <'+chunk+'>','if(uDebug==0.||uDebug==5.||uDebug==6.){\n#include <'+chunk+'>\n}');
 fragment=fragment.replace('#include <colorspace_fragment>','if(uDebug==0.||uDebug==1.||uDebug==5.||uDebug==6.){\n#include <colorspace_fragment>\n}');
 return fragment;
}
function declaredUniforms(fragment:string){
 // Material hooks can put several names in one declaration. Ignore comments
 // and inspect complete declarators, not a substring such as "uDebug;".
 const source=fragment.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/\/\/[^\n]*/g,' '),names=new Set<string>();
 for(const declaration of source.matchAll(/\buniform\s+(?:(?:lowp|mediump|highp)\s+)?\w+\s+([^;{}]+);/g)){
  for(const declarator of declaration[1].split(',')){
   const name=/^\s*([A-Za-z_]\w*)\b/.exec(declarator)?.[1];if(name)names.add(name);
  }
 }
 return names;
}
export function enableMaterialDiagnostics(material:THREE.MeshStandardMaterial){
 if(material.userData.diagnostics)return;material.userData.diagnostics=true;
 const previous=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey();
 material.onBeforeCompile=(shader,renderer)=>{
  previous(shader,renderer);shader.uniforms.uDebug=debugMode;shader.uniforms.uLod={value:Number(material.userData.lod??-1)};
  const declared=declaredUniforms(shader.fragmentShader),missing=['uDebug','uLod'].filter(name=>!declared.has(name));
  const uniform=missing.length?'uniform float '+missing.join(',')+';':'';
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+uniform)
   .replace('#include <shadowmap_pars_fragment>','#include <shadowmap_pars_fragment>\n'+THREE.ShaderChunk.shadowmask_pars_fragment)
   .replace('#include <opaque_fragment>','#include <opaque_fragment>\n'+diagnosticFragment);
  shader.fragmentShader=diagnosticOutputShader(shader.fragmentShader);
 };
 material.customProgramCacheKey=()=>key+'-diagnostics-v3';
}
