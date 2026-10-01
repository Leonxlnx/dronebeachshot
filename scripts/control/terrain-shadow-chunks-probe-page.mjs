import * as THREE from 'three';
import {createTerrain} from '/src/world/terrain.ts';
import {createTerrainShadowChunkStudy} from '/src/render/terrain-shadow-chunks.ts';
import {solarDirection} from '/src/render/sky-lighting.ts';
import {waitForProfilingFence} from '/src/render/profiling-sync.ts';

window.runProbe=async()=>{
 const started=performance.now(),land=createTerrain({}),source=land.getObjectByName('continuous-coastal-extension');
 const originalMaterial=source.material;source.removeFromParent();
 for(const mesh of land.children){mesh.geometry.dispose();}land.children[0]?.material.dispose();originalMaterial.dispose();
 source.material=new THREE.MeshLambertMaterial({color:0x809279});
 const scene=new THREE.Scene(),receiver=new THREE.Mesh(new THREE.PlaneGeometry(7000,7000),new THREE.MeshLambertMaterial({color:0xbdb7a4}));
 receiver.rotation.x=-Math.PI/2;receiver.position.y=-90;receiver.receiveShadow=true;scene.add(source,receiver);
 const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('world'),antialias:true,preserveDrawingBuffer:true});
 renderer.setSize(256,256,false);renderer.setClearColor(0x92aac0,1);renderer.toneMapping=THREE.NoToneMapping;
 renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=THREE.PCFShadowMap;
 const gl=renderer.getContext(),errors=[];
 renderer.debug.onShaderError=(g,p,v,f)=>{errors.push([g.getProgramInfoLog(p),g.getShaderInfoLog(v),g.getShaderInfoLog(f)].filter(Boolean).join('\n'));};
 const sun=new THREE.DirectionalLight(0xffffff,2);sun.castShadow=true;sun.shadow.mapSize.set(256,256);sun.shadow.bias=-.00004;sun.shadow.normalBias=.25;
 scene.add(sun,sun.target,new THREE.HemisphereLight(0xc2d5ec,0x263520,.6));
 const camera=new THREE.PerspectiveCamera(54,1,1,25000),study=createTerrainShadowChunkStudy(source,512);
 const depthTarget=new THREE.WebGLRenderTarget(256,256,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false});
 const depthReader=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{uDepth:{value:null}},vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`precision highp float;
  uniform highp sampler2DShadow uDepth;
  void main(){vec2 uv=gl_FragCoord.xy/256.;float low=0.,high=1.;
   // PCF depth textures cannot be read as ordinary sampler2D. At exact texel
   // centres binary comparison recovers a deterministic24-bit depth interval.
   for(int i=0;i<24;i++){float middle=(low+high)*.5;float visible=texture(uDepth,vec3(uv,middle));if(visible>.5)low=middle;else high=middle;}
   gl_FragColor=vec4(low,high,0.,1.);}`});
 const readerScene=new THREE.Scene(),readerCamera=new THREE.Camera(),readerMesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),depthReader);readerScene.add(readerMesh);
 const rows=[],images=[];
 function equal(a,b,label){if(a.length!==b.length)throw Error(label+' length');for(let i=0;i<a.length;i++)if(a[i]!==b[i])throw Error(label+' differs at '+i+': '+a[i]+' vs '+b[i]);}
 async function render(enabled,label){
  study.set(enabled);study.beginFrame();renderer.info.reset();renderer.shadowMap.needsUpdate=true;
  const start=performance.now();renderer.render(scene,camera);await waitForProfilingFence(gl);
  const renderMilliseconds=performance.now()-start,triangles=renderer.info.render.triangles,calls=renderer.info.render.calls;
  if(errors.length)throw Error(errors.join('\n'));
  const color=new Uint8Array(256*256*4);gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,color);
  if(gl.getError()!==gl.NO_ERROR)throw Error('Colour readback failed');
  const url=document.getElementById('world').toDataURL('image/png');await window.savePNG(label+'.png',url);images.push(label+'.png');
  depthReader.uniforms.uDepth.value=sun.shadow.map.depthTexture;renderer.setRenderTarget(depthTarget);renderer.render(readerScene,readerCamera);
  const depth=new Float32Array(256*256*4);renderer.readRenderTargetPixels(depthTarget,0,0,256,256,depth);renderer.setRenderTarget(null);
  if(gl.getError()!==gl.NO_ERROR)throw Error('Depth interval readback failed');
  let covered=0;for(let i=0;i<depth.length;i+=4){if(!Number.isFinite(depth[i])||depth[i]<0||depth[i]>1)throw Error('Invalid native depth interval');if(depth[i]<.9999)covered++;}
  if(covered<32)throw Error('Vacuous shadow comparison: fewer than32 occupied shadow texels');
  rows.push({label,enabled,renderMilliseconds,triangles,calls,occupiedShadowTexels:covered,...study.get()});return{color,depth};
 }
 try{
  for(const fit of ['production','remote','transformed']){
   source.position.set(0,0,0);source.rotation.set(0,0,0);source.scale.set(1,1,1);
   if(fit==='production'){
    sun.target.position.set(0,80,150);sun.position.copy(sun.target.position).addScaledVector(solarDirection.value,1000);
    Object.assign(sun.shadow.camera,{left:-380,right:380,top:380,bottom:-380,near:1,far:1800});
    camera.position.set(-650,650,-1300);camera.lookAt(-350,80,-350);
   }else{
    sun.target.position.set(-1350,150,-1100);sun.position.copy(sun.target.position).addScaledVector(solarDirection.value,2600);
    Object.assign(sun.shadow.camera,{left:-1450,right:1550,bottom:-420,top:500,near:600,far:4400});
    camera.position.set(-1900,1250,-2800);camera.lookAt(-1350,100,-1100);
    if(fit==='transformed'){source.position.set(27,8,-14);source.rotation.y=.17;source.scale.set(1.1,.94,.88);}
   }
   sun.shadow.camera.updateProjectionMatrix();scene.updateMatrixWorld(true);camera.updateMatrixWorld();
   const off=await render(false,fit+'-off'),on=await render(true,fit+'-on');
   equal(off.color,on.color,fit+' colour');equal(off.depth,on.depth,fit+' native shadow depth interval');
   const repeat=await render(true,fit+'-on-repeat');equal(on.color,repeat.color,fit+' repeat colour');equal(on.depth,repeat.depth,fit+' repeat depth');
   const restored=await render(false,fit+'-off-restored');equal(off.color,restored.color,fit+' restored colour');equal(off.depth,restored.depth,fit+' restored depth');
  }
  return{ok:true,elapsedMilliseconds:performance.now()-started,rows,images,errors,method:'Actual continuation geometry; exact main-colour RGBA and sampled nativePCF depth interval comparisons; source attributes and winding unchanged',limitations:['Isolated single-terrain geometry with plain materials, not full-scene art acceptance','256px shadow map; full-scene2048px colour/depth comparisons still required','Binary PCF comparisons recover depth intervals at texel centres, not raw hardware-depth bytes']};
 }finally{
  study.dispose();source.geometry.dispose();source.material.dispose();receiver.geometry.dispose();receiver.material.dispose();readerMesh.geometry.dispose();depthReader.dispose();depthTarget.dispose();sun.shadow.map?.dispose();sun.shadow.map?.depthTexture?.dispose();renderer.dispose();
 }
};
