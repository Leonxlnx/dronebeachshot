import * as THREE from 'three';
import {weatherGLSL} from '../world/weather';
import {habitatUniform} from '../world/habitat';
export const worldTime={value:0};
export const debugMode={value:0};
export type Textures={rock:THREE.Texture,rockNormal:THREE.Texture,rockARM:THREE.Texture,sand:THREE.Texture,sandNormal:THREE.Texture,sandARM:THREE.Texture,bark:THREE.Texture,barkNormal:THREE.Texture,soil:THREE.Texture,soilNormal:THREE.Texture,soilARM:THREE.Texture,moss:THREE.Texture,mossNormal:THREE.Texture,mossARM:THREE.Texture};
function bindGroundWind(m:THREE.Material,bark:boolean,colorPass:boolean){
 m.onBeforeCompile=s=>{
  s.uniforms.uTime=worldTime;s.uniforms.uHabitat=habitatUniform;
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;varying float vLeafHeight;'+weatherGLSL)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    vLeafHeight=position.y;mat4 worldTransform=modelMatrix*instanceMatrix;
    vec3 wp=(worldTransform*vec4(position,1.)).xyz;float strength=pow(clamp(position.y/1.6,0.,1.5),2.);
    vec2 wind=windDisplacement(wp,uTime)*strength;transformed+=localWindOffset(vec3(wind.x,0.,wind.y),worldTransform);
    ${bark?'':'transformed+=normal*(sin(uTime*3.1+dot(wp,vec3(.7,.8,.3)))*.028*strength);'}`);
  if(!bark&&colorPass)s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vLeafHeight;')
   .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=.86+.14*smoothstep(.05,1.1,vLeafHeight);');
 };
 m.customProgramCacheKey=()=> 'ground-wind-v3-'+bark+'-'+colorPass;
}
export function windMaterial(color:number,bark=false,t?:Textures){
 const material=new THREE.MeshStandardMaterial({color,roughness:bark?.93:.76,side:bark?THREE.FrontSide:THREE.DoubleSide,vertexColors:!bark,map:bark?t?.bark??null:null,normalMap:bark?t?.barkNormal??null:null,normalScale:new THREE.Vector2(.5,.5)});
 material.userData.windBark=bark;bindGroundWind(material,bark,true);return material;
}
export function createGroundWindDepth(source:THREE.MeshStandardMaterial){
 const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:source.side,alphaTest:source.alphaTest,map:source.alphaTest>0?source.map:null});
 bindGroundWind(depth,source.userData.windBark===true,false);return depth;
}
