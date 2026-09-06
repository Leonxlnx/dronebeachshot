import * as THREE from '/workspace/sites/last-light-bay/node_modules/three/build/three.module.js';
import {createCloudNoiseTexture} from './cloud-noise';
import {aerialPerspectiveGLSL} from '/workspace/sites/last-light-bay/src/render/aerial-perspective.ts';
import {worldTime} from '/workspace/sites/last-light-bay/src/render/materials.ts';
import {cloudFieldGLSL} from './clouds-resolved.ts';
import {sceneCaptureScale} from '/workspace/sites/last-light-bay/src/render/refraction.ts';
import {reflectedSky,solarDirection,cloudShadow,cloudShadowBounds,skyDecodeScale} from '/workspace/sites/last-light-bay/src/render/sky-lighting.ts';
export const sunDirection=solarDirection.value;
export const atmosphereLighting={sunIntensity:4.4,skyIntensity:.65};
export function createAtmosphere(renderer:THREE.WebGLRenderer){const cloudNoise=createCloudNoiseTexture();const group=new THREE.Group();group.name='atmosphere';const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uCloudNoise:{value:cloudNoise},uSun:{value:sunDirection},uTime:worldTime,uEye:{value:new THREE.Vector3()},uSunDisk:{value:1},uOutputScale:{value:1},uSceneCaptureScale:sceneCaptureScale},vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`precision highp float;varying vec3 vDirection;uniform vec3 uSun,uEye;uniform float uTime,uSunDisk,uOutputScale,uSceneCaptureScale;${cloudFieldGLSL}${aerialPerspectiveGLSL}

void main(){vec3 ray=normalize(vDirection);float h=max(ray.y,0.);float sunDot=dot(ray,uSun);
 vec3 color=bayClearSky(ray,uSun);
 // The lower probe hemisphere represents low-radiance land/sea bounce. A bright
 // orange constant here leaks warm energy into PMREM and tilted water facets.
 color=mix(color,vec3(.028,.035,.033),(1.-smoothstep(-.13,0.,ray.y)));
 color+=vec3(1.25,.78,.37)*pow(max(sunDot,0.),850.);float disk=smoothstep(cos(.009),cos(.006),sunDot);color+=vec3(22.,11.,2.8)*disk*uSunDisk;float skyTransmittance=1.;
float pixelAngle=max(length(dFdx(ray)),length(dFdy(ray)));
vec2 interval=cloudSegment(uEye,ray);
if(interval.y>interval.x){
 float steps=clamp(ceil((interval.y-interval.x)/30.),12.,512.);float stepLen=(interval.y-interval.x)/steps;float trans=1.;vec3 cloudLight=vec3(0.);
 for(int i=0;i<512;i++){
  if(float(i)>=steps)break;
  // Midpoint quadrature avoids per-pixel grain; the shorter segment resolves cloud edges.
  float dist=interval.x+(float(i)+.5)*stepLen;vec3 p=uEye+ray*dist;p.xz-=worldWind*uTime;
  float footprint=max(dist*pixelAngle,stepLen*.5);
  float d=filteredDensity(p,footprint);if(d<.0002)continue;
  float illumination=cloudSunTransmission(p,uSun);
  float heightFill=mix(.75,1.15,smoothstep(cloudBase,cloudTop,p.y));
  vec3 ambient=vec3(.10,.13,.18)*heightFill;
  float forward=pow(max(sunDot,0.),10.);
  // Match the existing directional-light tint in linear RGB, at similar luminance.
  vec3 lit=ambient+vec3(1.02,.65,.36)*(illumination+.22*sqrt(illumination))*(.65+.55*forward);
  float alpha=1.-exp(-d*stepLen*cloudExtinction);
  lit=bayAerialPerspective(lit,uEye,uEye+ray*dist,uSun,.00010);
  cloudLight+=lit*alpha*trans;trans*=1.-alpha;if(trans<.008)break;
 }
 color=color*trans+cloudLight;skyTransmittance=trans;
}
gl_FragColor=vec4(color*uOutputScale*uSceneCaptureScale,skyTransmittance);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace('1.);#include','1.);\n#include')});const dome=new THREE.Mesh(new THREE.SphereGeometry(12000,32,16),material);dome.name='volumetric-cloud-sky';dome.frustumCulled=false;dome.renderOrder=-10;group.add(dome);const sun=new THREE.DirectionalLight(0xffd1a1,atmosphereLighting.sunIntensity);sun.position.copy(sunDirection).multiplyScalar(1000);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-380,right:380,top:380,bottom:-380,near:1,far:1800});sun.shadow.bias=-.00004;sun.shadow.normalBias=.25;sun.target.position.set(0,80,150);sun.position.copy(sun.target.position).addScaledVector(sunDirection,1000);group.add(sun,sun.target);const hemi=new THREE.HemisphereLight(0xabc7e0,0x4c5634,atmosphereLighting.skyIntensity);group.add(hemi);
// Small deterministic cube capture shares the visible ray-marched cloud field.
// Alpha carries cloud transmittance; the solar disk is omitted to avoid counting
// the analytic water sun glitter twice.
const hdr=renderer.extensions.has('EXT_color_buffer_float');skyDecodeScale.value=hdr?1:4;
const skyTarget=new THREE.WebGLCubeRenderTarget(128,{type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,format:THREE.RGBAFormat,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
const reflectionScene=new THREE.Scene(),reflectionMaterial=material.clone();
reflectionMaterial.uniforms.uCloudNoise={value:cloudNoise};reflectionMaterial.uniforms.uSceneCaptureScale=sceneCaptureScale;reflectionMaterial.uniforms.uTime={value:0};reflectionMaterial.uniforms.uEye={value:new THREE.Vector3(0,4,0)};reflectionMaterial.uniforms.uSunDisk.value=0;reflectionMaterial.uniforms.uOutputScale.value=1/skyDecodeScale.value;
const reflectionDome=new THREE.Mesh(dome.geometry,reflectionMaterial);reflectionDome.frustumCulled=false;reflectionScene.add(reflectionDome);
const reflectionCamera=new THREE.CubeCamera(.1,22000,skyTarget);reflectedSky.value=skyTarget.texture;

const cloudTarget=new THREE.WebGLRenderTarget(256,256,{depthBuffer:false,generateMipmaps:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});cloudShadow.value=cloudTarget.texture;
const cloudMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{uCloudNoise:{value:cloudNoise},uTime:{value:0},uSun:solarDirection,uBounds:cloudShadowBounds,skyDecodeScale},vertexShader:`varying vec2 vUV;void main(){vUV=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`precision highp float;varying vec2 vUV;uniform float uTime;uniform vec3 uSun;uniform vec4 uBounds;${cloudFieldGLSL}
void main(){vec2 ground=mix(uBounds.xy,uBounds.zw,vUV);vec3 origin=vec3(ground.x,0.,ground.y);vec2 interval=cloudSegment(origin,uSun);float transmittance=1.;
 if(interval.y>interval.x){float steps=clamp(ceil((interval.y-interval.x)/60.),12.,256.);float stepLen=(interval.y-interval.x)/steps;for(int i=0;i<256;i++){if(float(i)>=steps)break;vec3 p=origin+uSun*(interval.x+(float(i)+.5)*stepLen);p.xz-=worldWind*uTime;transmittance*=exp(-density(p)*stepLen*cloudExtinction);if(transmittance<.008)break;}}
 gl_FragColor=vec4(vec3(transmittance),1.);}`});
const cloudScene=new THREE.Scene(),cloudPlane=new THREE.Mesh(new THREE.PlaneGeometry(2,2),cloudMaterial),cloudCamera=new THREE.Camera();cloudScene.add(cloudPlane);cloudPlane.frustumCulled=false;
const pmrem=hdr?new THREE.PMREMGenerator(renderer):null;let environmentTarget:THREE.WebGLRenderTarget|null=null;
// The kilometre-scale cloud field changes slowly. Visible sky remains continuous;
// shared lighting snapshots have exact absolute-time keys, including random seeks.
// The sea-level reflection probe is world-anchored, so camera motion never triggers
// six cubemap renders and PMREM convolution on every animation frame.
let reflectionStep=NaN,shadowStep=NaN;
const lightingStats={cubeUpdates:0,shadowUpdates:0};
function update(renderer:THREE.WebGLRenderer,eye:THREE.Vector3,time:number){
 dome.position.copy(eye);material.uniforms.uEye.value.copy(eye);
 const nextShadowStep=Math.floor(time*4),nextReflectionStep=Math.floor(time*2);
 if(shadowStep!==nextShadowStep){
  cloudMaterial.uniforms.uTime.value=nextShadowStep/4;
  const previousTarget=renderer.getRenderTarget();
  try{renderer.setRenderTarget(cloudTarget);renderer.render(cloudScene,cloudCamera)}
  finally{renderer.setRenderTarget(previousTarget)}
  shadowStep=nextShadowStep;lightingStats.shadowUpdates++;
 }
 if(reflectionStep===nextReflectionStep)return;
 reflectionMaterial.uniforms.uTime.value=nextReflectionStep/2;
 reflectionCamera.update(renderer,reflectionScene);
 if(pmrem)environmentTarget=pmrem.fromCubemap(skyTarget.texture,environmentTarget);
 reflectionStep=nextReflectionStep;lightingStats.cubeUpdates++;
}
function dispose(){cloudNoise.dispose();pmrem?.dispose();environmentTarget?.dispose();skyTarget.dispose();reflectionMaterial.dispose();cloudTarget.dispose();cloudMaterial.dispose();cloudPlane.geometry.dispose();}
return {group,dome,sun,hemi,lighting:atmosphereLighting,lightingStats,update,dispose,skyTarget,get environment(){return environmentTarget?.texture??null}};}
