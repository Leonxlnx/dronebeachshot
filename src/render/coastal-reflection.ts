import * as THREE from 'three';
import {debugMode} from './materials';
import {sceneCaptureScale} from './refraction';

// Stable shared values: the study allocates no target and issues no renderer
// calls while disabled. The aerial wrapper can use the pass flag to fog only
// the reflected water-hit-to-land segment; the ocean owns eye-to-water fog.
export const coastalReflectionPass={value:0};
export const coastalReflectionSeaLevel={value:0};
export const coastalReflectionUniforms={
 uCoastalReflectionColor:{value:null as THREE.Texture|null},
 uCoastalReflectionDepth:{value:null as THREE.DepthTexture|null},
 uCoastalReflectionResolution:{value:new THREE.Vector2(1,1)},
 uCoastalReflectionInverseViewProjection:{value:new THREE.Matrix4()},
 uCoastalReflectionTextureMatrix:{value:new THREE.Matrix4()},
 uCoastalReflectionDistortion:{value:1},
 uCoastalReflectionReady:{value:0},
};

/** Mean sea plane only, following the installed Three Reflector's perspective
 * reflection and oblique clipping. Individual wave self-reflections are not
 * traced. Depth reconstruction must use the final, clipped inverse VP. */
export function updateCoastalReflectionCamera(source:THREE.PerspectiveCamera,mirror:THREE.PerspectiveCamera,
 textureMatrix:THREE.Matrix4,inverseViewProjection:THREE.Matrix4,seaLevel=0){
 if(!Number.isFinite(seaLevel))throw Error('Coastal reflection sea level must be finite');
 if(source.coordinateSystem!==THREE.WebGLCoordinateSystem||source.reversedDepth)
  throw Error('Coastal reflection requires ordinary WebGL perspective depth');
 source.updateWorldMatrix(true,false);
 const eye=new THREE.Vector3().setFromMatrixPosition(source.matrixWorld);
 if(eye.y<=seaLevel+1e-6)return false;
 const rotation=new THREE.Matrix4().extractRotation(source.matrixWorld),normal=new THREE.Vector3(0,1,0);
 const forward=new THREE.Vector3(0,0,-1).applyMatrix4(rotation).reflect(normal);
 const up=new THREE.Vector3(0,1,0).applyMatrix4(rotation).reflect(normal);
 mirror.copy(source,false);mirror.matrixAutoUpdate=true;mirror.matrixWorldAutoUpdate=true;
 mirror.position.set(eye.x,2*seaLevel-eye.y,eye.z);mirror.scale.set(1,1,1);
 mirror.up.copy(up);mirror.lookAt(mirror.position.clone().add(forward));mirror.updateMatrixWorld(true);
 const plane=new THREE.Plane(normal,-seaLevel).applyMatrix4(mirror.matrixWorldInverse);
 const clip=new THREE.Vector4(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
 const p=mirror.projectionMatrix.elements;
 const q=new THREE.Vector4((Math.sign(clip.x)+p[8])/p[0],(Math.sign(clip.y)+p[9])/p[5],-1,(1+p[10])/p[14]);
 const denominator=clip.dot(q);
 if(!Number.isFinite(denominator)||Math.abs(denominator)<1e-10)throw Error('Degenerate coastal reflection clipping plane');
 clip.multiplyScalar(2/denominator);p[2]=clip.x;p[6]=clip.y;p[10]=clip.z+1;p[14]=clip.w;
 mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
 const viewProjection=new THREE.Matrix4().multiplyMatrices(mirror.projectionMatrix,mirror.matrixWorldInverse);
 inverseViewProjection.copy(viewProjection).invert();
 textureMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(viewProjection);
 return true;
}

type ReflectionOptions={
 water:THREE.Object3D;spray:THREE.Object3D;dome:THREE.Object3D;
 skyTexture:THREE.CubeTexture;skyDecodeScale?:number;seaLevel?:number;
 // These must prepare/restore every camera-dependent instance pack, LOD
 // selection, ground-cover cull and far-crown sort. Restore also runs when
 // preparation itself fails part way through.
 prepareCamera:(camera:THREE.PerspectiveCamera)=>void;
 restoreCamera:(camera:THREE.PerspectiveCamera)=>void;
};

/** A capability failure that callers may handle after render restores state.
 * Rendering and restoration failures retain their original error types. */
export class CoastalReflectionUnsupportedError extends Error{
 constructor(reason:string){
  super('Coastal reflection requires RGBA16F MSAA4 with resolved depth: '+reason);
  this.name='CoastalReflectionUnsupportedError';
 }
}

/** Separate post-refraction/pre-main study. Color already contains the sky;
 * alpha is NOT coverage (cube transmittance and A2C alpha both invalidate that
 * interpretation). MSAA depth is a resolved sample, not conservative coverage. */
export function createCoastalReflectionPass(renderer:THREE.WebGLRenderer){
 let enabled=false,disposed=false,target:THREE.WebGLRenderTarget|null=null;
 let supported:boolean|null=null,supportError:string|null=null,maximumExtent=0,validatedWidth=0,validatedHeight=0;
 let renders=0,failures=0,skippedBelowSea=0,lastDrawCalls=0,lastTriangles=0;
 const mirror=new THREE.PerspectiveCamera(),size=new THREE.Vector2();
 function available(){if(disposed)throw Error('Coastal reflection has been disposed');}
 function unsupported(reason:string):never{supported=false;supportError=reason;throw new CoastalReflectionUnsupportedError(reason);}
 function checkSupport(){
  if(supported===true)return;if(supported===false)unsupported(supportError!);
  const gl=renderer.getContext() as WebGL2RenderingContext;
  if(typeof gl.getInternalformatParameter!=='function'||!renderer.extensions.has('EXT_color_buffer_float'))unsupported('floating-point WebGL2 render targets are unavailable');
  if(renderer.capabilities.maxSamples<4)unsupported('fewer than four MSAA samples');
  for(const [name,format]of [['RGBA16F',gl.RGBA16F],['DEPTH_COMPONENT24',gl.DEPTH_COMPONENT24]] as const){
   const counts=gl.getInternalformatParameter(gl.RENDERBUFFER,format,gl.SAMPLES) as Int32Array;
   if(!counts||!Array.from(counts).includes(4))unsupported(name+' lacks four-sample support');
  }
  maximumExtent=Math.min(renderer.capabilities.maxTextureSize,gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number);
  if(!Number.isFinite(maximumExtent)||maximumExtent<1)unsupported('invalid target-size limit');
  supported=true;
 }
 function ensureTarget(){
  checkSupport();renderer.getDrawingBufferSize(size);
  const width=Math.max(1,Math.floor(size.x/2)),height=Math.max(1,Math.floor(size.y/2));
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width>maximumExtent||height>maximumExtent)
   throw Error(`Coastal reflection target ${width}x${height} exceeds ${maximumExtent}px`);
  if(!target){
   target=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,
    minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:true,
    depthBuffer:true,stencilBuffer:false,samples:4,resolveDepthBuffer:true});
   target.texture.name='coastal-reflection-linear-rgba16f-msaa4';target.texture.colorSpace=THREE.LinearSRGBColorSpace;
   target.depthTexture=new THREE.DepthTexture(width,height,THREE.UnsignedIntType);
   target.depthTexture.name='coastal-reflection-resolved-depth';target.depthTexture.minFilter=target.depthTexture.magFilter=THREE.NearestFilter;
   coastalReflectionUniforms.uCoastalReflectionColor.value=target.texture;
   coastalReflectionUniforms.uCoastalReflectionDepth.value=target.depthTexture;
  }else if(target.width!==width||target.height!==height)target.setSize(width,height);
  coastalReflectionUniforms.uCoastalReflectionResolution.value.set(width,height);
  return target;
 }
 function render(scene:THREE.Scene,camera:THREE.PerspectiveCamera,options:ReflectionOptions){
  available();coastalReflectionUniforms.uCoastalReflectionReady.value=0;
  if(!enabled)return false;
  if(!options.skyTexture?.isCubeTexture)throw Error('Coastal reflection requires the actual sky CubeTexture');
  const decode=options.skyDecodeScale??1,seaLevel=options.seaLevel??0;
  if(!Number.isFinite(decode)||decode<=0)throw Error('Coastal reflection sky decode scale must be positive');
  if(!updateCoastalReflectionCamera(camera,mirror,coastalReflectionUniforms.uCoastalReflectionTextureMatrix.value,
   coastalReflectionUniforms.uCoastalReflectionInverseViewProjection.value,seaLevel)){skippedBelowSea++;return false;}
  const reflectionTarget=ensureTarget(),gl=renderer.getContext();
  const previous={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),
   xr:renderer.xr.enabled,shadowAuto:renderer.shadowMap.autoUpdate,shadowNeeds:renderer.shadowMap.needsUpdate,
   autoClear:renderer.autoClear,autoClearColor:renderer.autoClearColor,autoClearDepth:renderer.autoClearDepth,autoClearStencil:renderer.autoClearStencil,
   infoAutoReset:renderer.info.autoReset,depthMask:gl.getParameter(gl.DEPTH_WRITEMASK) as boolean,
   background:scene.background,intensity:scene.backgroundIntensity,blur:scene.backgroundBlurriness,rotation:scene.backgroundRotation.clone(),
   overrideMaterial:scene.overrideMaterial,debug:debugMode.value,scale:sceneCaptureScale.value,
   pass:coastalReflectionPass.value,seaLevel:coastalReflectionSeaLevel.value};
  const hidden=new Map([options.water,options.spray,options.dome].map(object=>[object,object.visible]));
  const errors:unknown[]=[];let prepared=false,calls=renderer.info.render.calls,triangles=renderer.info.render.triangles;
  try{
   for(const object of hidden.keys())object.visible=false;
   scene.background=options.skyTexture;scene.backgroundIntensity=decode;scene.backgroundBlurriness=0;scene.backgroundRotation.set(0,0,0);scene.overrideMaterial=null;
   debugMode.value=0;sceneCaptureScale.value=1;coastalReflectionPass.value=1;coastalReflectionSeaLevel.value=seaLevel;
   renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
   renderer.info.autoReset=false;renderer.autoClear=true;renderer.autoClearColor=true;renderer.autoClearDepth=true;renderer.autoClearStencil=false;
   // setRenderTarget applies its physical viewport/scissor directly. Public
   // setViewport uses logical pixels even for targets, so avoid a second DPR
   // multiplication and leave the caller's canvas settings untouched.
   renderer.setRenderTarget(reflectionTarget);
   if(validatedWidth!==reflectionTarget.width||validatedHeight!==reflectionTarget.height){
    const status=gl.checkFramebufferStatus(gl.FRAMEBUFFER),samples=gl.getParameter(gl.SAMPLES) as number;
    if(status!==gl.FRAMEBUFFER_COMPLETE)unsupported('incomplete framebuffer 0x'+status.toString(16));
    if(samples!==4)unsupported('allocated framebuffer has '+samples+' samples');
    validatedWidth=reflectionTarget.width;validatedHeight=reflectionTarget.height;
   }
   prepared=true;options.prepareCamera(mirror);
   renderer.render(scene,mirror); // Three resolves both MSAA attachments here.
   lastDrawCalls=renderer.info.render.calls-calls;lastTriangles=renderer.info.render.triangles-triangles;
  }catch(error){errors.push(error);}
  finally{
   // Restore scene/pass values before returning to the main camera's callbacks.
   for(const [object,visible]of hidden)object.visible=visible;
   scene.background=previous.background;scene.backgroundIntensity=previous.intensity;scene.backgroundBlurriness=previous.blur;scene.backgroundRotation.copy(previous.rotation);scene.overrideMaterial=previous.overrideMaterial;
   debugMode.value=previous.debug;sceneCaptureScale.value=previous.scale;coastalReflectionPass.value=previous.pass;coastalReflectionSeaLevel.value=previous.seaLevel;
   try{if(prepared)options.restoreCamera(camera);}catch(error){errors.push(error);}
   finally{
    renderer.xr.enabled=previous.xr;renderer.shadowMap.autoUpdate=previous.shadowAuto;renderer.shadowMap.needsUpdate=previous.shadowNeeds;
    renderer.autoClear=previous.autoClear;renderer.autoClearColor=previous.autoClearColor;renderer.autoClearDepth=previous.autoClearDepth;renderer.autoClearStencil=previous.autoClearStencil;renderer.info.autoReset=previous.infoAutoReset;
    try{renderer.setRenderTarget(previous.target,previous.face,previous.mip);renderer.state.buffers.depth.setMask(previous.depthMask);}catch(error){errors.push(error);}
   }
  }
  if(errors.length){failures++;throw errors.length===1?errors[0]:new AggregateError(errors,'Coastal reflection render/restoration failed');}
  renders++;coastalReflectionUniforms.uCoastalReflectionReady.value=1;return true;
 }
 function setEnabled(value:boolean){available();if(typeof value!=='boolean')throw Error('Coastal reflection control must be boolean');if(value)checkSupport();enabled=value;coastalReflectionUniforms.uCoastalReflectionReady.value=0;}
 function setDistortion(value:0|1){available();if(value!==0&&value!==1)throw Error('Coastal reflection distortion must be zero or one');coastalReflectionUniforms.uCoastalReflectionDistortion.value=value;}
 function getState(){return {enabled,initialized:target!==null,supported,supportError,width:target?.width??0,height:target?.height??0,
  scale:.5,samples:4,format:'RGBA16F',resolvedDepth:true,alphaIsCoverage:false,distortion:coastalReflectionUniforms.uCoastalReflectionDistortion.value,ready:coastalReflectionUniforms.uCoastalReflectionReady.value===1,
  renders,failures,skippedBelowSea,lastDrawCalls,lastTriangles,disposed};}
 function dispose(){if(disposed)return;enabled=false;coastalReflectionUniforms.uCoastalReflectionReady.value=0;
  if(coastalReflectionUniforms.uCoastalReflectionColor.value===target?.texture){coastalReflectionUniforms.uCoastalReflectionColor.value=null;coastalReflectionUniforms.uCoastalReflectionDepth.value=null;}
  target?.depthTexture?.dispose();target?.dispose();target=null;disposed=true;}
 return {render,setEnabled,setDistortion,getState,dispose,uniforms:coastalReflectionUniforms};
}
