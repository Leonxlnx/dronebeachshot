import * as THREE from 'three';
import {createCoastalReflectionPass,coastalReflectionUniforms as uniforms} from '/src/render/coastal-reflection.ts';
import {coastalReflectionGLSL} from '/actual-coastal-reflection-glsl.js';
import {sealOpaqueCanvas} from '/src/render/engine.ts';

window.runProbe=async()=>{
 const canvas=document.getElementById('world'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;
 const gl=renderer.getContext(),shaderErrors=[],images=[],rows=[];let shadowDraws=0,prepared=0,restored=0;
 renderer.debug.onShaderError=(g,p,v,f)=>shaderErrors.push([g.getProgramInfoLog(p),g.getShaderInfoLog(v),g.getShaderInfoLog(f)].filter(Boolean).join('\n'));
 const cubeTarget=new THREE.WebGLCubeRenderTarget(8,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
 const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,vertexShader:'varying vec3 d;void main(){d=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec3 d;void main(){vec3 r=normalize(d);gl_FragColor=vec4(vec3(.08,.16,.34)+vec3(.06,.07,.08)*max(r.y,0.)+vec3(.05,.01,0.)*r.x,.35);}'});
 const skyScene=new THREE.Scene(),skyMesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),skyMaterial);skyScene.add(skyMesh);new THREE.CubeCamera(.1,10,cubeTarget).update(renderer,skyScene);
 const scene=new THREE.Scene();scene.background=cubeTarget.texture;
 const sun=new THREE.DirectionalLight(0xffe1bb,2);sun.position.set(-4,8,5);sun.castShadow=true;sun.shadow.mapSize.set(64,64);Object.assign(sun.shadow.camera,{left:-12,right:12,bottom:-10,top:10,near:.1,far:40});
 scene.add(sun,sun.target,new THREE.HemisphereLight(0xbbd5e8,0x302d25,.7));
 const coast=new THREE.Mesh(new THREE.PlaneGeometry(8,6),new THREE.MeshStandardMaterial({color:0x577340,roughness:.86,side:THREE.DoubleSide}));
 coast.position.set(-1,3,-6);coast.castShadow=true;coast.onBeforeShadow=()=>{shadowDraws++;};scene.add(coast);
 const below=new THREE.Mesh(new THREE.PlaneGeometry(6,4),new THREE.MeshStandardMaterial({color:0xff00ff,side:THREE.DoubleSide}));below.position.set(0,-2.05,-5);scene.add(below);
 const alpha=new Uint8Array(32*32*4);
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4,distance=Math.abs((x-15.5)*.77+(y-15.5)*.41);alpha.set([120,198,75,Math.round(255*Math.max(0,Math.min(.7,(9-distance)/5)))],i);}
 const cutoutTexture=new THREE.DataTexture(alpha,32,32,THREE.RGBAFormat);cutoutTexture.minFilter=cutoutTexture.magFilter=THREE.LinearFilter;cutoutTexture.needsUpdate=true;cutoutTexture.colorSpace=THREE.SRGBColorSpace;
 const cutout=new THREE.Mesh(new THREE.PlaneGeometry(4,5),new THREE.MeshStandardMaterial({map:cutoutTexture,roughness:.8,side:THREE.DoubleSide,alphaToCoverage:true}));cutout.position.set(3.7,4.6,-5);scene.add(cutout);
 const camera=new THREE.PerspectiveCamera(54,1,.2,100);camera.position.set(0,5,10);camera.lookAt(0,1,-6);camera.updateMatrixWorld(true);
 const waterMaterial=new THREE.ShaderMaterial({uniforms:{...uniforms,uCoastalReflectionSeaLevel:{value:0},uSky:{value:cubeTarget.texture},uSlope:{value:0}},
  vertexShader:'varying vec3 p;void main(){p=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}',
  fragmentShader:`varying vec3 p;uniform samplerCube uSky;uniform float uSlope;${coastalReflectionGLSL}
void main(){vec3 ray=reflect(normalize(p-cameraPosition),normalize(vec3(uSlope,1.,0.)));vec3 color=textureCube(uSky,ray).rgb;
if(uCoastalReflectionReady>.5)color=coastalReflectedRadiance(p,ray,color,0.);gl_FragColor=vec4(color,1.);
#include <colorspace_fragment>
}`});
 const water=new THREE.Mesh(new THREE.PlaneGeometry(24,28),waterMaterial);water.rotation.x=-Math.PI/2;water.position.z=-4;scene.add(water);
 const spray=new THREE.Object3D(),dome=new THREE.Object3D();scene.add(spray,dome);
 const pass=createCoastalReflectionPass(renderer),options={water,spray,dome,skyTexture:cubeTarget.texture,
  prepareCamera:mirror=>{if(!(mirror.position.y<0))throw Error('Camera was not mirrored');prepared++;},
  restoreCamera:main=>{if(main!==camera)throw Error('Wrong restored camera');restored++;}};
 const readTarget=new THREE.WebGLRenderTarget(64,64,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false});
 const reader=new THREE.ShaderMaterial({depthWrite:false,depthTest:false,uniforms:{...uniforms,uReadMode:{value:0}},vertexShader:'varying vec2 uvRead;void main(){uvRead=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`varying vec2 uvRead;uniform sampler2D uCoastalReflectionDepth,uCoastalReflectionColor;uniform mat4 uCoastalReflectionInverseViewProjection;uniform float uReadMode;
void main(){if(uReadMode>.5){gl_FragColor=texture2D(uCoastalReflectionColor,uvRead);return;}float d=texture2D(uCoastalReflectionDepth,uvRead).r;vec4 p=uCoastalReflectionInverseViewProjection*vec4(uvRead*2.-1.,d*2.-1.,1.);gl_FragColor=vec4(p.xyz/p.w,d);}`});
 const readScene=new THREE.Scene(),readMesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),reader),readCamera=new THREE.Camera();readScene.add(readMesh);
 const equal=(a,b,label)=>{if(a.length!==b.length)throw Error(label+' length mismatch');for(let i=0;i<a.length;i++)if(a[i]!==b[i])throw Error(label+' differs at '+i);};
 function readLinear(mode){reader.uniforms.uReadMode.value=mode;renderer.setRenderTarget(readTarget);renderer.render(readScene,readCamera);const data=new Float32Array(64*64*4);renderer.readRenderTargetPixels(readTarget,0,0,64,64,data);renderer.setRenderTarget(null);if(gl.getError()!==gl.NO_ERROR)throw Error('Float readback GL error');return data;}
 async function frame(enabled,label,distortion=0,slope=0){
  pass.setEnabled(enabled);pass.setDistortion(distortion);waterMaterial.uniforms.uSlope.value=slope;
  const shadowsBefore=shadowDraws;renderer.shadowMap.needsUpdate=true;
  pass.render(scene,camera,options);
  if(shadowDraws!==shadowsBefore||renderer.shadowMap.needsUpdate!==true)throw Error('Reflection recomputed or lost pending main shadows');
  renderer.render(scene,camera);sealOpaqueCanvas(renderer);
  if(shaderErrors.length)throw Error(shaderErrors.join('\n'));
  const pixels=new Uint8Array(128*128*4);gl.readPixels(0,0,128,128,gl.RGBA,gl.UNSIGNED_BYTE,pixels);if(gl.getError()!==gl.NO_ERROR)throw Error('Canvas readback GL error');
  let minimum=255,maximum=0,changedFromSky=0;for(let i=0;i<pixels.length;i+=4){minimum=Math.min(minimum,pixels[i],pixels[i+1],pixels[i+2]);maximum=Math.max(maximum,pixels[i],pixels[i+1],pixels[i+2]);if(Math.abs(pixels[i]-pixels[i+1])>8)changedFromSky++;}
  if(maximum-minimum<30||changedFromSky<100)throw Error('Blank/vacuous fixture output');
  await window.savePNG(label+'.png',canvas.toDataURL('image/png'));images.push(label+'.png');rows.push({label,enabled,distortion,slope,minimum,maximum,changedFromSky,state:pass.getState()});return pixels;
 }
 try{
  let referenceOff,referenceOn,depthEvidence,edgeEvidence;
  for(const dpr of [1,2]){
   renderer.setPixelRatio(dpr);renderer.setSize(128/dpr,128/dpr,false);renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);
   const off=await frame(false,'dpr'+dpr+'-off'),on=await frame(true,'dpr'+dpr+'-on');
   const depth=readLinear(0),color=readLinear(1);let geometry=0,sky=0,minY=Infinity,maxPlaneError=0,footprintMisses=0,maxBoundViolation=0;
   for(let i=0;i<depth.length;i+=4){
    for(let c=0;c<4;c++)if(!Number.isFinite(depth[i+c]))throw Error('Nonfinite reconstructed depth');
    if(depth[i+3]>.999999){sky++;continue;}geometry++;minY=Math.min(minY,depth[i+1]);maxPlaneError=Math.max(maxPlaneError,Math.min(Math.abs(depth[i+2]+6),Math.abs(depth[i+2]+5)));
    // Depth resolve selects a covered subpixel. At fixed sampled depth, the
    // inverse projective map's extrema over this half-texel rectangle occur
    // at its corners (all homogeneous denominators have the same sign).
    // The true known plane must intersect that interval; centre reconstruction
    // alone need not land exactly on it. Allow only .002 for float roundoff.
    const pixel=i/4,x=((pixel%64)+.5)/64*2-1,y=(Math.floor(pixel/64)+.5)/64*2-1;
    let minZ=Infinity,maxZ=-Infinity,minW=Infinity,maxW=-Infinity;
    for(const dx of [-1/64,1/64])for(const dy of [-1/64,1/64]){
     const h=new THREE.Vector4(x+dx,y+dy,depth[i+3]*2-1,1).applyMatrix4(uniforms.uCoastalReflectionInverseViewProjection.value);
     minW=Math.min(minW,h.w);maxW=Math.max(maxW,h.w);const z=h.z/h.w;minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
    }
    if(minW<=0&&maxW>=0)throw Error('Unprojection footprint crosses infinity');
    const violation=Math.min(...[-6,-5].map(z=>Math.max(minZ-z,z-maxZ,0)));maxBoundViolation=Math.max(maxBoundViolation,violation);if(violation>.002)footprintMisses++;
   }
   if(geometry<40||sky<40||minY<-.15||footprintMisses)throw Error('Oblique depth fixture failed: '+JSON.stringify({geometry,sky,minY,maxPlaneError,footprintMisses,maxBoundViolation}));
   depthEvidence={geometry,sky,minY,maxPlaneError,footprintMisses,maxBoundViolation,method:'Known z=-6/-5 planes must intersect inverse-VP half-texel bounds at each resolved depth; .002 world roundoff tolerance'};
   cutout.visible=false;pass.render(scene,camera,options);const noCutout=readLinear(1);cutout.visible=true;
   let partial=0,changed=0,finite=0;for(let i=0;i<color.length;i+=4){if(color.slice(i,i+4).every(Number.isFinite))finite++;if(Math.max(...[0,1,2].map(c=>Math.abs(color[i+c]-noCutout[i+c])))>.001){changed++;if(color[i+3]>.36&&color[i+3]<.95)partial++;}}
   if(changed<10||partial<5||finite!==64*64)throw Error('No meaningful finite A2C partial edge: '+JSON.stringify({changed,partial,finite}));
   edgeEvidence={changed,partial,finite,alphaUsedAsCoverage:false};
   const restoredOff=await frame(false,'dpr'+dpr+'-off-restored');equal(off,restoredOff,'off/on/off restoration');
   if(referenceOff){equal(referenceOff,off,'DPR1/2 off');equal(referenceOn,on,'DPR1/2 on');}else{referenceOff=off;referenceOn=on;}
   let onOffChanged=0;for(let i=0;i<on.length;i+=4)if(on[i]!==off[i]||on[i+1]!==off[i+1]||on[i+2]!==off[i+2])onOffChanged++;
   if(onOffChanged<100)throw Error('Reflection on/off comparison is vacuous');rows.at(-1).onOffChangedPixels=onOffChanged;
  }
  await frame(true,'wave-ray-reprojection',1,.07);
  return {ok:true,rows,images,depthEvidence,edgeEvidence,prepared,restored,shaderErrors,physicalCanvas:[128,128],reflection:[64,64],exactDprComparison:true,
   limitations:['Tiny diagnostic PBR planes and procedural cutout/sky, not full-scene quality acceptance','Uses exact production reflection pass and extracted ocean function; no ocean/terrain geometry created','Resolved MSAA depth is not a conservative coverage map','No performance or final-video claim']};
 }finally{
  pass.dispose();readTarget.dispose();reader.dispose();readMesh.geometry.dispose();water.geometry.dispose();waterMaterial.dispose();coast.geometry.dispose();coast.material.dispose();below.geometry.dispose();below.material.dispose();cutout.geometry.dispose();cutout.material.dispose();cutoutTexture.dispose();skyMesh.geometry.dispose();skyMaterial.dispose();cubeTarget.dispose();sun.shadow.map?.dispose();renderer.dispose();
 }
};
