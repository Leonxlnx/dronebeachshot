import * as THREE from 'three';
import {debugMode} from './materials';
export const sceneCaptureScale={value:1};
const refractionRendering={value:false};
// The opaque coast buffer only supplies color behind visible water. Above-water
// trees never contribute there. Mesh color callbacks run after the shadow pass,
// so their full geometry still casts onto the shore and underwater terrain.
const hiddenRefractionCounts=new Map<THREE.InstancedMesh,number>();
function restoreRefractionCounts(){for(const [mesh,count] of hiddenRefractionCounts)mesh.count=count;hiddenRefractionCounts.clear()}
export function excludeAboveWaterInstancesFromRefraction(mesh:THREE.InstancedMesh){
 mesh.onBeforeRender=()=>{if(refractionRendering.value){hiddenRefractionCounts.set(mesh,mesh.count);mesh.count=0}};
 mesh.onAfterRender=()=>{const count=hiddenRefractionCounts.get(mesh);if(count!==undefined){mesh.count=count;hiddenRefractionCounts.delete(mesh)}};
}
export const refractionUniforms={uUnderColor:{value:null as THREE.Texture|null},uUnderDepth:{value:null as THREE.DepthTexture|null},uUnderResolution:{value:new THREE.Vector2(1,1)},uClipPlanes:{value:new THREE.Vector2(.15,22000)},uUnderReady:{value:0},uUnderDecodeScale:{value:1}};
export function createRefractionPass(renderer:THREE.WebGLRenderer){
 const hdr=renderer.extensions.has('EXT_color_buffer_float');refractionUniforms.uUnderDecodeScale.value=hdr?1:4;
 const target=new THREE.WebGLRenderTarget(1,1,{type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});
 target.texture.name='opaque-coast-linear-color';target.texture.colorSpace=THREE.LinearSRGBColorSpace;
 target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);target.depthTexture.name='opaque-coast-depth';target.depthTexture.minFilter=target.depthTexture.magFilter=THREE.NearestFilter;
 refractionUniforms.uUnderColor.value=target.texture;refractionUniforms.uUnderDepth.value=target.depthTexture;
 const size=new THREE.Vector2();
 async function compile(scene:THREE.Scene,camera:THREE.PerspectiveCamera){
  const previous=renderer.getRenderTarget();
  try{renderer.setRenderTarget(target);await renderer.compileAsync(scene,camera)}
  finally{renderer.setRenderTarget(previous)}
 }
 function render(scene:THREE.Scene,camera:THREE.PerspectiveCamera,water:THREE.Object3D,spray:THREE.Object3D){
  renderer.getDrawingBufferSize(size);if(target.width!==size.x||target.height!==size.y)target.setSize(size.x,size.y);
  refractionUniforms.uUnderResolution.value.copy(size);refractionUniforms.uClipPlanes.value.set(camera.near,camera.far);
  const fog=scene.fog instanceof THREE.FogExp2?scene.fog:null,fogDensity=fog?.density;
  const previous=renderer.getRenderTarget(),waterVisible=water.visible,sprayVisible=spray.visible,mode=debugMode.value;
  try{refractionRendering.value=true;sceneCaptureScale.value=1/refractionUniforms.uUnderDecodeScale.value;if(fog)fog.density=0;water.visible=false;spray.visible=false;debugMode.value=0;renderer.setRenderTarget(target);renderer.render(scene,camera);refractionUniforms.uUnderReady.value=1}
  finally{restoreRefractionCounts();refractionRendering.value=false;sceneCaptureScale.value=1;if(fog&&fogDensity!==undefined)fog.density=fogDensity;renderer.setRenderTarget(previous);water.visible=waterVisible;spray.visible=sprayVisible;debugMode.value=mode}
 }
 return {render,compile,dispose:()=>{target.dispose();target.depthTexture?.dispose()}};
}
export const refractionGLSL=`
uniform sampler2D uUnderColor,uUnderDepth;uniform vec2 uUnderResolution,uClipPlanes;uniform float uUnderReady,uUnderDecodeScale;
float underViewDistance(vec2 uv){float depth=texture2D(uUnderDepth,uv).r;return uClipPlanes.x*uClipPlanes.y/(uClipPlanes.y-depth*(uClipPlanes.y-uClipPlanes.x));}
vec3 transmittedCoast(vec3 point,vec3 normal,vec3 scattered,float approximateDepth){
 if(uUnderReady<.5)return scattered;
 vec2 uv=gl_FragCoord.xy/uUnderResolution;
 float surfaceDistance=-(viewMatrix*vec4(point,1.)).z;
 vec3 viewNormal=mat3(viewMatrix)*normal;
 vec2 bent=clamp(uv+viewNormal.xy*.0025*min(approximateDepth,5.),vec2(.001),vec2(.999));
 float backgroundDistance=underViewDistance(bent);
 // A distorted sample that belongs to a foreground rock cannot be transmitted.
 if(backgroundDistance<surfaceDistance+.015){bent=uv;backgroundDistance=underViewDistance(uv);}
 float path=clamp((backgroundDistance-surfaceDistance)*length(cameraPosition-point)/max(surfaceDistance,.01),0.,100.);
 vec3 absorption=exp(-vec3(.24,.065,.037)*path);
 vec3 bottom=texture2D(uUnderColor,bent).rgb*uUnderDecodeScale;
 return bottom*absorption+scattered*(vec3(1.)-absorption);
}
`;
