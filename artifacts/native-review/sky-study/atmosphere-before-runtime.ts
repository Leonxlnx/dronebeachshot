import * as THREE from 'file:///workspace/sites/last-light-bay/node_modules/three/build/three.module.js';
import {worldTime} from 'file:///workspace/sites/last-light-bay/src/render/materials.ts';
import {cloudFieldGLSL} from 'file:///workspace/scratch/2b912ce37941/native-render/sky-study/clouds-before-runtime.ts';
import {sceneCaptureScale} from 'file:///workspace/sites/last-light-bay/src/render/refraction.ts';
import {reflectedSky,solarDirection,cloudShadow,cloudShadowBounds,skyDecodeScale} from 'file:///workspace/sites/last-light-bay/src/render/sky-lighting.ts';
export const sunDirection=solarDirection.value;
export const atmosphereLighting={sunIntensity:3.6,skyIntensity:1.15};
export function createAtmosphere(renderer:THREE.WebGLRenderer){const group=new THREE.Group();group.name='atmosphere';const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uSun:{value:sunDirection},uTime:worldTime,uEye:{value:new THREE.Vector3()},uSunDisk:{value:1},uOutputScale:{value:1},uSceneCaptureScale:sceneCaptureScale},vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`precision highp float;varying vec3 vDirection;uniform vec3 uSun,uEye;uniform float uTime,uSunDisk,uOutputScale,uSceneCaptureScale;${cloudFieldGLSL}

void main(){vec3 ray=normalize(vDirection);float h=max(ray.y,0.);float sunDot=dot(ray,uSun);float scatter=pow(max(sunDot,0.),5.);vec3 zenith=vec3(.075,.17,.29),horizon=vec3(.95,.385,.095);vec3 color=mix(horizon,zenith,pow(smoothstep(0.,.8,h),.42));color+=vec3(.88,.30,.042)*pow(max(sunDot,0.),12.)*exp(-h*3.);color=mix(color,vec3(.56,.36,.20),(1.-smoothstep(-.13,0.,ray.y)));float disk=smoothstep(cos(.009),cos(.006),sunDot);color+=vec3(22.,11.,2.8)*disk*uSunDisk;float skyTransmittance=1.;
if(ray.y>.018){float start=max(0.,(900.-uEye.y)/ray.y);float stepLen=34./max(ray.y,.08);float trans=1.;vec3 cloudLight=vec3(0);for(int i=0;i<24;i++){float dist=start+(float(i)+.5)*stepLen;vec3 p=uEye+ray*dist;p.xz-=worldWind*uTime;float d=density(p);float shadow=density(p+uSun*65.)*.7+density(p+uSun*145.)*.3;float illumination=exp(-shadow*2.8);vec3 lit=mix(vec3(.095,.12,.16),vec3(1.75,.76,.23),illumination);lit+=vec3(.60,.27,.07)*pow(max(sunDot,0.),8.)*(1.-d);float alpha=1.-exp(-d*stepLen*.014);cloudLight+=lit*alpha*trans;trans*=1.-alpha;if(trans<.015)break;}color=color*trans+cloudLight;skyTransmittance=trans;}
gl_FragColor=vec4(color*uOutputScale*uSceneCaptureScale,skyTransmittance);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace('1.);#include','1.);\n#include')});const dome=new THREE.Mesh(new THREE.SphereGeometry(12000,32,16),material);dome.name='volumetric-cloud-sky';dome.frustumCulled=false;dome.renderOrder=-10;group.add(dome);const sun=new THREE.DirectionalLight(0xffbd75,atmosphereLighting.sunIntensity);sun.position.copy(sunDirection).multiplyScalar(1000);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-380,right:380,top:380,bottom:-380,near:1,far:1800});sun.shadow.bias=-.00025;sun.shadow.normalBias=1.1;sun.target.position.set(0,80,150);sun.position.copy(sun.target.position).addScaledVector(sunDirection,1000);group.add(sun,sun.target);const hemi=new THREE.HemisphereLight(0xabc7e0,0x4c5634,atmosphereLighting.skyIntensity);group.add(hemi);
// Small deterministic cube capture shares the visible ray-marched cloud field.
// Alpha carries cloud transmittance; the solar disk is omitted to avoid counting
// the analytic water sun glitter twice.
const hdr=renderer.extensions.has('EXT_color_buffer_float');skyDecodeScale.value=hdr?1:4;
const skyTarget=new THREE.WebGLCubeRenderTarget(128,{type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,format:THREE.RGBAFormat,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
const reflectionScene=new THREE.Scene(),reflectionMaterial=material.clone();
reflectionMaterial.uniforms.uSceneCaptureScale=sceneCaptureScale;reflectionMaterial.uniforms.uTime=worldTime;reflectionMaterial.uniforms.uEye=material.uniforms.uEye;reflectionMaterial.uniforms.uSunDisk.value=0;reflectionMaterial.uniforms.uOutputScale.value=1/skyDecodeScale.value;
const reflectionDome=new THREE.Mesh(dome.geometry,reflectionMaterial);reflectionDome.frustumCulled=false;reflectionScene.add(reflectionDome);
const reflectionCamera=new THREE.CubeCamera(.1,22000,skyTarget);reflectedSky.value=skyTarget.texture;

const cloudTarget=new THREE.WebGLRenderTarget(256,256,{depthBuffer:false,generateMipmaps:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});cloudShadow.value=cloudTarget.texture;
const cloudMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{uTime:worldTime,uSun:solarDirection,uBounds:cloudShadowBounds,skyDecodeScale},vertexShader:`varying vec2 vUV;void main(){vUV=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`precision highp float;varying vec2 vUV;uniform float uTime;uniform vec3 uSun;uniform vec4 uBounds;${cloudFieldGLSL}
void main(){vec2 ground=mix(uBounds.xy,uBounds.zw,vUV);vec3 origin=vec3(ground.x,0.,ground.y);float stepLen=34./max(uSun.y,.08),start=350./uSun.y,transmittance=1.;for(int i=0;i<24;i++){vec3 p=origin+uSun*(start+(float(i)+.5)*stepLen);p.xz-=worldWind*uTime;transmittance*=exp(-density(p)*stepLen*.014);}gl_FragColor=vec4(vec3(transmittance),1.);}`});
const cloudScene=new THREE.Scene(),cloudPlane=new THREE.Mesh(new THREE.PlaneGeometry(2,2),cloudMaterial),cloudCamera=new THREE.Camera();cloudScene.add(cloudPlane);cloudPlane.frustumCulled=false;
const pmrem=hdr?new THREE.PMREMGenerator(renderer):null;let environmentTarget:THREE.WebGLRenderTarget|null=null;
let previousTime=NaN,shadowTime=NaN;const previousEye=new THREE.Vector3(Infinity,Infinity,Infinity);
function update(renderer:THREE.WebGLRenderer,eye:THREE.Vector3,time:number){
 dome.position.copy(eye);material.uniforms.uEye.value.copy(eye);
 if(shadowTime!==time){const previousTarget=renderer.getRenderTarget();renderer.setRenderTarget(cloudTarget);renderer.render(cloudScene,cloudCamera);renderer.setRenderTarget(previousTarget);shadowTime=time;}
 if(previousTime===time&&previousEye.equals(eye))return;reflectionCamera.update(renderer,reflectionScene);if(pmrem)environmentTarget=pmrem.fromCubemap(skyTarget.texture,environmentTarget);previousTime=time;previousEye.copy(eye);
}
function dispose(){pmrem?.dispose();environmentTarget?.dispose();skyTarget.dispose();reflectionMaterial.dispose();cloudTarget.dispose();cloudMaterial.dispose();cloudPlane.geometry.dispose();}
return {group,dome,sun,hemi,lighting:atmosphereLighting,update,dispose,skyTarget,get environment(){return environmentTarget?.texture??null}};}
