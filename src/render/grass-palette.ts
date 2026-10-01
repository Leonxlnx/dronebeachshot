import * as THREE from 'three';

// Authored palette interpretation study, not a claim about the original intent
// of setHSL's working-linear default. Only the local grass/fern material opts in.
export const grassPaletteSRGB={value:0};

export function bindGrassPaletteStudy(material:THREE.MeshStandardMaterial){
 const prior=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey();
 material.onBeforeCompile=(shader,renderer)=>{
  prior(shader,renderer);
  shader.uniforms.uGrassPaletteSRGB=grassPaletteSRGB;
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
   uniform float uGrassPaletteSRGB;
   attribute vec3 grassPaletteColor;`);
  const color=THREE.ShaderChunk.color_vertex.replace('vColor.rgb *= color;',`
   // Control zero uses the original arithmetic, without a blend/re-encoding.
   if(uGrassPaletteSRGB>.5)vColor.rgb*=grassPaletteColor;
   else vColor.rgb *= color;`);
  shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>',color);
 };
 material.customProgramCacheKey=()=>key+'-grass-palette-srgb-study-v1';
 return material;
}
