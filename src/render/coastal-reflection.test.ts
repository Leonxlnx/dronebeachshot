import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCoastalReflectionPass,updateCoastalReflectionCamera,coastalReflectionUniforms as uniforms,coastalReflectionPass,coastalReflectionSeaLevel} from './coastal-reflection.ts';
import {debugMode} from './materials.ts';
import {sceneCaptureScale} from './refraction.ts';

function close(a:number,b:number,epsilon=1e-9){assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);}
function closeVector(a:THREE.Vector3,b:THREE.Vector3){close(a.distanceTo(b),0);}

test('mirrored, rolled parented camera clips below sea and reconstructs actual oblique depth',()=>{
 const source=new THREE.PerspectiveCamera(54,16/9,.4,22000),parent=new THREE.Group();
 parent.position.set(17,0,-9);parent.rotation.y=.3;parent.add(source);
 source.position.set(3,8,14);source.lookAt(new THREE.Vector3(12,2,-30));source.rotateZ(.19);parent.updateMatrixWorld(true);
 const originalProjection=source.projectionMatrix.clone(),mirror=new THREE.PerspectiveCamera(),texture=new THREE.Matrix4(),inverse=new THREE.Matrix4();
 assert.equal(updateCoastalReflectionCamera(source,mirror,texture,inverse),true);
 const eye=source.getWorldPosition(new THREE.Vector3()),forward=source.getWorldDirection(new THREE.Vector3());
 closeVector(mirror.position,new THREE.Vector3(eye.x,-eye.y,eye.z));
 closeVector(mirror.getWorldDirection(new THREE.Vector3()),forward.reflect(new THREE.Vector3(0,1,0)));
 assert.deepEqual(source.projectionMatrix.elements,originalProjection.elements);close(mirror.aspect,source.aspect);
 const identity=new THREE.Matrix4().multiplyMatrices(mirror.projectionMatrix,mirror.projectionMatrixInverse);
 for(let i=0;i<16;i++)close(identity.elements[i],i%5===0?1:0);
 const vp=new THREE.Matrix4().multiplyMatrices(mirror.projectionMatrix,mirror.matrixWorldInverse);
 for(const point of [new THREE.Vector3(0,0,-30),new THREE.Vector3(15,8,-60),new THREE.Vector3(-40,70,-300)]){
  const clip=new THREE.Vector4(point.x,point.y,point.z,1).applyMatrix4(vp),ndc=clip.clone().multiplyScalar(1/clip.w);
  const restored=new THREE.Vector4(ndc.x,ndc.y,ndc.z,1).applyMatrix4(inverse).divideScalar(new THREE.Vector4(ndc.x,ndc.y,ndc.z,1).applyMatrix4(inverse).w);
  closeVector(new THREE.Vector3(restored.x,restored.y,restored.z),point);
  const tex=new THREE.Vector4(point.x,point.y,point.z,1).applyMatrix4(texture).divideScalar(clip.w);
  close(tex.x,ndc.x*.5+.5);close(tex.y,ndc.y*.5+.5);close(tex.z,ndc.z*.5+.5);
  if(point.y===0)close(ndc.z,-1);
 }
 for(const [height,sign]of [[2,1],[-2,-1]]){
  const p=new THREE.Vector4(15,height,-60,1).applyMatrix4(vp);assert.ok((p.z+p.w)*sign>0);
 }
 source.position.y=0;parent.updateMatrixWorld(true);assert.equal(updateCoastalReflectionCamera(source,mirror,texture,inverse),false);
});

function fixture(){
 const state={target:null as THREE.WebGLRenderTarget|null,face:3,mip:2,viewport:new THREE.Vector4(7,8,123,99),scissor:new THREE.Vector4(3,4,90,80),scissorTest:true,
  depthMask:false,queries:0,renders:0,samples:4,dpr:2,activeViewport:new THREE.Vector4(14,16,246,198),activeScissor:new THREE.Vector4(6,8,180,160),activeScissorTest:true,drawSize:new THREE.Vector2(640,360),hook:()=>{}};
 const gl={RGBA16F:1,DEPTH_COMPONENT24:2,RENDERBUFFER:3,SAMPLES:4,MAX_RENDERBUFFER_SIZE:5,DEPTH_WRITEMASK:6,FRAMEBUFFER:7,FRAMEBUFFER_COMPLETE:8,
  getInternalformatParameter:()=>new Int32Array([4,2,1]),
  getParameter:(key:number)=>{state.queries++;return key===5?8192:key===6?state.depthMask:key===4?state.samples:undefined;},
  checkFramebufferStatus:()=>8};
 const renderer={getContext:()=>gl,extensions:{has:()=>true},capabilities:{maxSamples:4,maxTextureSize:8192},
  xr:{enabled:true},shadowMap:{autoUpdate:true,needsUpdate:true},autoClear:false,autoClearColor:false,autoClearDepth:false,autoClearStencil:true,
  info:{autoReset:true,render:{calls:19,triangles:200}},state:{buffers:{depth:{setMask:(value:boolean)=>{state.depthMask=value;}}}},
  getDrawingBufferSize:(value:THREE.Vector2)=>value.copy(state.drawSize),getPixelRatio:()=>state.dpr,getRenderTarget:()=>state.target,getActiveCubeFace:()=>state.face,getActiveMipmapLevel:()=>state.mip,
  getViewport:(value:THREE.Vector4)=>value.copy(state.viewport),getScissor:(value:THREE.Vector4)=>value.copy(state.scissor),getScissorTest:()=>state.scissorTest,
  setRenderTarget:(target:THREE.WebGLRenderTarget|null,face=0,mip=0)=>{state.target=target;state.face=face;state.mip=mip;
   state.activeViewport.copy(target?.viewport??state.viewport.clone().multiplyScalar(state.dpr));state.activeScissor.copy(target?.scissor??state.scissor.clone().multiplyScalar(state.dpr));state.activeScissorTest=target?.scissorTest??state.scissorTest;},
  setViewport:(x:THREE.Vector4|number,y?:number,w?:number,h?:number)=>{typeof x==='number'?state.viewport.set(x,y!,w!,h!):state.viewport.copy(x);state.activeViewport.copy(state.viewport).multiplyScalar(state.dpr);},
  setScissor:(value:THREE.Vector4)=>{state.scissor.copy(value);state.activeScissor.copy(value).multiplyScalar(state.dpr);},setScissorTest:(value:boolean)=>{state.scissorTest=state.activeScissorTest=value;},
  render:()=>{state.renders++;state.depthMask=true;state.hook();renderer.info.render.calls+=7;renderer.info.render.triangles+=1234;},
 } as unknown as THREE.WebGLRenderer;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(54,16/9,.4,22000);
 camera.position.set(0,9,14);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 scene.background=new THREE.Color(.2,.3,.4);scene.backgroundIntensity=.7;scene.backgroundBlurriness=.3;scene.backgroundRotation.set(.1,.2,.3);
 scene.fog=new THREE.FogExp2(0xabcdef,.00014);scene.overrideMaterial=new THREE.MeshBasicMaterial();
 const water=new THREE.Object3D(),spray=new THREE.Object3D(),dome=new THREE.Object3D();water.visible=false;dome.visible=false;
 let prepared=0,restored=0,packedFor='main';
 const options={water,spray,dome,skyTexture:new THREE.CubeTexture(),skyDecodeScale:4,seaLevel:0,
  prepareCamera:(mirror:THREE.PerspectiveCamera)=>{prepared++;packedFor='reflection';assert.ok(mirror.position.y<0);},
  restoreCamera:(original:THREE.PerspectiveCamera)=>{restored++;packedFor='main';assert.equal(original,camera);},};
 return {state,renderer,scene,camera,options,counts:()=>({prepared,restored,packedFor})};
}

test('off is lazy; enabled pass requests sky/depth compositing and restores owned renderer/scene/camera state',()=>{
 const f=fixture(),pass=createCoastalReflectionPass(f.renderer),originalBackground=f.scene.background,originalOverride=f.scene.overrideMaterial;
 const baseline={debug:debugMode.value,scale:sceneCaptureScale.value,flag:coastalReflectionPass.value,sea:coastalReflectionSeaLevel.value};
 try{
  assert.equal(pass.render(f.scene,f.camera,f.options),false);assert.equal(f.state.queries,0);assert.equal(f.state.renders,0);assert.equal(pass.getState().initialized,false);
  pass.setEnabled(true);assert.equal(pass.getState().initialized,false);
  debugMode.value=7;sceneCaptureScale.value=.25;coastalReflectionPass.value=.2;coastalReflectionSeaLevel.value=4;
  f.state.hook=()=>{
   const rt=f.state.target!;assert.deepEqual([rt.width,rt.height,rt.samples],[320,180,4]);assert.equal(rt.texture.type,THREE.HalfFloatType);
   assert.equal(f.state.dpr,2);assert.deepEqual(f.state.activeViewport.toArray(),[0,0,320,180]);assert.equal(f.state.activeScissorTest,false);
   assert.equal(rt.texture.generateMipmaps,true);assert.equal(rt.texture.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(rt.resolveDepthBuffer,true);
   assert.equal(rt.depthTexture?.type,THREE.UnsignedIntType);assert.equal(rt.depthTexture?.minFilter,THREE.NearestFilter);
   assert.equal(f.scene.background,f.options.skyTexture);assert.equal(f.scene.backgroundIntensity,4);assert.equal(f.scene.backgroundBlurriness,0);
   assert.deepEqual(f.scene.backgroundRotation.toArray().slice(0,3),[0,0,0]);assert.equal((f.scene.fog as THREE.FogExp2).density,.00014);
   assert.equal(f.options.water.visible,false);assert.equal(f.options.spray.visible,false);assert.equal(f.options.dome.visible,false);
   assert.equal(f.renderer.shadowMap.autoUpdate,false);assert.equal(f.renderer.shadowMap.needsUpdate,false);assert.equal(f.renderer.xr.enabled,false);
   assert.equal(debugMode.value,0);assert.equal(sceneCaptureScale.value,1);assert.equal(coastalReflectionPass.value,1);assert.equal(coastalReflectionSeaLevel.value,0);
  };
  assert.equal(pass.render(f.scene,f.camera,f.options),true);
  assert.deepEqual(f.counts(),{prepared:1,restored:1,packedFor:'main'});assert.equal(pass.getState().ready,true);assert.equal(pass.getState().lastDrawCalls,7);assert.equal(pass.getState().lastTriangles,1234);
  assert.equal(f.scene.background,originalBackground);assert.equal(f.scene.overrideMaterial,originalOverride);assert.equal(f.scene.backgroundIntensity,.7);assert.equal(f.scene.backgroundBlurriness,.3);
  assert.deepEqual(f.scene.backgroundRotation.toArray().slice(0,3),[.1,.2,.3]);assert.equal(f.options.spray.visible,true);assert.equal(f.options.water.visible,false);assert.equal(f.options.dome.visible,false);
  assert.deepEqual([f.state.target,f.state.face,f.state.mip],[null,3,2]);assert.deepEqual(f.state.viewport.toArray(),[7,8,123,99]);assert.deepEqual(f.state.scissor.toArray(),[3,4,90,80]);assert.equal(f.state.scissorTest,true);assert.equal(f.state.depthMask,false);
  assert.deepEqual([f.renderer.xr.enabled,f.renderer.shadowMap.autoUpdate,f.renderer.shadowMap.needsUpdate],[true,true,true]);
  assert.deepEqual([f.renderer.autoClear,f.renderer.autoClearColor,f.renderer.autoClearDepth,f.renderer.autoClearStencil,f.renderer.info.autoReset],[false,false,false,true,true]);
  assert.deepEqual([debugMode.value,sceneCaptureScale.value,coastalReflectionPass.value,coastalReflectionSeaLevel.value],[7,.25,.2,4]);
  pass.setDistortion(0);assert.equal(pass.getState().distortion,0);assert.throws(()=>pass.setDistortion(2 as 1),/zero or one/);
  pass.setEnabled(false);assert.equal(uniforms.uCoastalReflectionReady.value,0);
 }finally{pass.dispose();debugMode.value=baseline.debug;sceneCaptureScale.value=baseline.scale;coastalReflectionPass.value=baseline.flag;coastalReflectionSeaLevel.value=baseline.sea;uniforms.uCoastalReflectionDistortion.value=1;}
 assert.equal(uniforms.uCoastalReflectionColor.value,null);assert.equal(uniforms.uCoastalReflectionDepth.value,null);assert.throws(()=>pass.setEnabled(true),/disposed/);
});

test('returning to a non-null target preserves its physical viewport/scissor and cube face/mip',()=>{
 const f=fixture(),previous=new THREE.WebGLRenderTarget(200,100),pass=createCoastalReflectionPass(f.renderer);
 previous.viewport.set(2,3,73,43);previous.scissor.set(4,5,63,31);previous.scissorTest=true;
 f.renderer.setRenderTarget(previous,5,1);pass.setEnabled(true);pass.render(f.scene,f.camera,f.options);
 assert.equal(f.state.target,previous);assert.deepEqual([f.state.face,f.state.mip],[5,1]);
 assert.deepEqual(f.state.activeViewport.toArray(),[2,3,73,43]);assert.deepEqual(f.state.activeScissor.toArray(),[4,5,63,31]);assert.equal(f.state.activeScissorTest,true);
 assert.deepEqual(f.state.viewport.toArray(),[7,8,123,99]);assert.deepEqual(f.state.scissor.toArray(),[3,4,90,80]);
 pass.dispose();previous.dispose();
});

test('preparation/render/restore failures cannot leave packed camera or shadow/target state active',()=>{
 for(const stage of ['prepare','render','restore'] as const){
  const f=fixture(),pass=createCoastalReflectionPass(f.renderer),prepare=f.options.prepareCamera,restore=f.options.restoreCamera;
  pass.setEnabled(true);
  if(stage==='prepare')f.options.prepareCamera=camera=>{prepare(camera);throw Error('prepare failed');};
  if(stage==='render')f.state.hook=()=>{throw Error('render failed');};
  if(stage==='restore')f.options.restoreCamera=camera=>{restore(camera);throw Error('restore failed');};
  assert.throws(()=>pass.render(f.scene,f.camera,f.options),new RegExp(stage+' failed'));
  assert.deepEqual(f.counts(),{prepared:1,restored:1,packedFor:'main'});assert.equal(pass.getState().ready,false);assert.equal(pass.getState().failures,1);
  assert.deepEqual([f.state.target,f.state.face,f.state.mip],[null,3,2]);assert.equal(f.renderer.shadowMap.needsUpdate,true);assert.equal(f.options.spray.visible,true);assert.equal(coastalReflectionPass.value,0);
  pass.dispose();
 }
 const f=fixture(),pass=createCoastalReflectionPass(f.renderer);pass.setEnabled(true);f.state.samples=2;
 assert.throws(()=>pass.render(f.scene,f.camera,f.options),/has 2 samples/);assert.equal(f.counts().prepared,0);assert.equal(f.state.target,null);assert.equal(f.options.spray.visible,true);pass.dispose();
});
