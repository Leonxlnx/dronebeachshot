// Browser module for the isolated source-direct-response experiment only.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createTreeImpostor} from '/src/world/tree-impostor.ts';
import {treeImpostorDefinitions} from '/src/world/tree-impostor-data.ts';
import {prepareTreeMaterial,lodCamera,setVegetationQuality,setFoliageMultisampling} from '/src/render/vegetation-material.ts';
import {loadSourceVisibilityTexture} from '/src/render/source-sun-visibility.ts';
import {setFarCrownBlending} from '/src/render/far-crown-blending.ts';
import {withCloudLighting,cloudShadow,solarDirection} from '/src/render/sky-lighting.ts';
import {diagnosticFragment} from '/src/render/diagnostics.ts';
import {worldTime} from '/src/render/materials.ts';
import {waitForProfilingFence} from '/src/render/profiling-sync.ts';
import {pilotViews,pilotSuns,pilotPoses,responseLayer,integrateResponseTile,fixedRasterAreaReference,bindPilotDirectResponse} from '/pilot-helper.mjs';

window.runSourceDirectResponsePilot=async()=>{
 const config=window.pilotConfig,started=performance.now(),deadline=started+(config.bakeIsland?480000:180000);
 const assert=(value,message)=>{if(!value)throw Error(message);};
 const stage=async(name)=>{assert(performance.now()<deadline,'Pilot exceeded 180 second in-page budget');await window.pilotStage(name);};
 const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
 const base64=bytes=>{let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);};
 await stage('load exact Island source and existing atlas assets');
 const bytes=await(await fetch('/assets/models/island-tree-near.glb')).arrayBuffer();
 assert(await hash(bytes)===config.sourceSHA256,'Source GLB hash mismatch');
 const loader=new THREE.TextureLoader();
 const [gltf,albedo,normals,visibility]=await Promise.all([
  new GLTFLoader().parseAsync(bytes,'/assets/models/'),
  loader.loadAsync('/assets/impostors/island-albedo.png'),
  loader.loadAsync('/assets/impostors/island-normal.png'),
  loadSourceVisibilityTexture('/assets/impostors/island-visibility.rg8'),
 ]);
 const metadata=treeImpostorDefinitions[0],center=new THREE.Vector3(...metadata.center),half=metadata.halfSize;
 const canvas=document.getElementById('world');
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:true});
 renderer.setPixelRatio(1);renderer.setSize(128,128,false);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
 const gl=renderer.getContext(),shaderErrors=[];
 assert(gl.getExtension('EXT_color_buffer_float'),'Float color targets unavailable');
 renderer.debug.onShaderError=(context,program,vertex,fragment)=>shaderErrors.push([context.getProgramInfoLog(program),context.getShaderInfoLog(vertex),context.getShaderInfoLog(fragment)].filter(Boolean).join('\n'));
 const check=label=>{assert(!gl.isContextLost(),'Context lost: '+label);assert(!shaderErrors.length,'Shader errors: '+shaderErrors.join('\n'));const error=gl.getError();assert(error===gl.NO_ERROR,'GL error '+error+': '+label);};
 const scene=new THREE.Scene(),source=new THREE.Group();scene.add(source);
 const sun=new THREE.DirectionalLight(0xffffff,1);sun.castShadow=true;scene.add(sun,sun.target);
 sun.target.position.copy(center);sun.shadow.mapSize.set(1024,1024);
 Object.assign(sun.shadow.camera,{left:-25,right:25,bottom:-25,top:25,near:.1,far:200});
 sun.shadow.normalBias=.025;sun.shadow.bias=-.00002;sun.shadow.radius=1;
 const hemi=new THREE.HemisphereLight(0x9bc7ed,0x34583a,.7);scene.add(hemi);
 const whiteCloud=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);whiteCloud.needsUpdate=true;cloudShadow.value=whiteCloud;
 const height={value:metadata.bounds.max[1]},sourceParts=[],sourceBounds=new THREE.Box3();
 const outputMode={value:0};
 function bindOutput(material){
  const previous=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey.bind(material);
  material.fog=false;material.toneMapped=false;
  material.onBeforeCompile=(shader,r)=>{
   previous(shader,r);shader.uniforms.uPilotOutput=outputMode;
   assert(shader.fragmentShader.includes(diagnosticFragment),'Missing actual diagnostics hook');
   shader.fragmentShader=shader.fragmentShader.replace(diagnosticFragment,'')
    .replace('#include <common>','#include <common>\nuniform float uPilotOutput;')
    .replace('#include <opaque_fragment>','#include <opaque_fragment>\nif(uPilotOutput<.5)gl_FragColor=vec4(reflectedLight.directDiffuse,diffuseColor.a);else if(uPilotOutput<1.5)gl_FragColor=vec4(vec3(1.),diffuseColor.a);else gl_FragColor=vec4(reflectedLight.indirectDiffuse+reflectedLight.indirectSpecular,diffuseColor.a);');
  };
  material.customProgramCacheKey=()=>key()+'-isolated-direct-output-v1';material.needsUpdate=true;
 }
 gltf.scene.updateMatrixWorld(true);worldTime.value=0;setVegetationQuality('high');setFoliageMultisampling(true);
 gltf.scene.traverse(object=>{
  if(!object.isMesh)return;assert(!Array.isArray(object.material),'Unexpected multi-material source primitive');
  const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);geometry.scale(18/3.4,18/3.4,18/3.4);geometry.computeBoundingBox();sourceBounds.union(geometry.boundingBox);
  const {material,depth}=prepareTreeMaterial(object.material,-1,{height,thinLeaf:object.material.alphaTest>0});
  withCloudLighting(material);bindOutput(material);
  const mesh=new THREE.Mesh(geometry,material);mesh.customDepthMaterial=depth;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;source.add(mesh);
  sourceParts.push({mesh,materialName:object.material.name,triangles:geometry.index.count/3,thinLeaf:object.material.alphaTest>0});object.geometry.dispose();
 });
 assert(sourceParts.reduce((sum,part)=>sum+part.triangles,0)===238617,'Island source triangle identity changed');
 for(let axis=0;axis<3;axis++){
  assert(Math.abs(sourceBounds.min.getComponent(axis)-metadata.bounds.min[axis])<.0001,'Source minimum framing changed');
  assert(Math.abs(sourceBounds.max.getComponent(axis)-metadata.bounds.max[axis])<.0001,'Source maximum framing changed');
 }
 const responseData=new Uint16Array(128*128*16*4),responseTexture=new THREE.DataArrayTexture(responseData,128,128,16);
 responseTexture.type=THREE.HalfFloatType;responseTexture.format=THREE.RGBAFormat;responseTexture.colorSpace=THREE.NoColorSpace;
 responseTexture.generateMipmaps=true;responseTexture.minFilter=THREE.LinearMipmapLinearFilter;responseTexture.magFilter=THREE.LinearFilter;responseTexture.wrapS=responseTexture.wrapT=THREE.ClampToEdgeWrapping;responseTexture.needsUpdate=true;
 const exactData=new Uint16Array(128*128*4),exactTexture=new THREE.DataTexture(exactData,128,128,THREE.RGBAFormat,THREE.HalfFloatType);
 exactTexture.colorSpace=THREE.NoColorSpace;exactTexture.generateMipmaps=true;exactTexture.minFilter=THREE.LinearMipmapLinearFilter;exactTexture.magFilter=THREE.LinearFilter;
 exactTexture.wrapS=exactTexture.wrapT=THREE.ClampToEdgeWrapping;exactTexture.needsUpdate=true;
 const ownCoverage={value:0};
 const proxy=createTreeImpostor(metadata,albedo,normals,1,visibility);proxy.setMatrixAt(0,new THREE.Matrix4());proxy.setColorAt(0,new THREE.Color(1,1,1));proxy.instanceMatrix.needsUpdate=true;proxy.instanceColor.needsUpdate=true;
 proxy.castShadow=false;proxy.receiveShadow=false;proxy.frustumCulled=false;scene.add(proxy);
 withCloudLighting(proxy.material);
 const responseEnabled=bindPilotDirectResponse(proxy.material,responseTexture,{value:0},{exactTexture,ownCoverage});bindOutput(proxy.material);
 setFarCrownBlending(true); // Linear target + exact raw fractional alpha, same in both proxy variants.
 // Actual far LOD starts at245m. Orthographic framing is independent of this
 // distance; keep the real viewer far enough for its unchanged LOD mask.
 const camera=new THREE.OrthographicCamera(-half,half,half,-half,.1,1600);
 const targets=new Map();
 function targetFor(size){
  if(!targets.has(size)){
   const target=new THREE.WebGLRenderTarget(size,size,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,colorSpace:THREE.LinearSRGBColorSpace,samples:4,depthBuffer:true,generateMipmaps:false});
   targets.set(size,target);renderer.setRenderTarget(target);assert(gl.getParameter(gl.SAMPLES)===4,'Actual target is not four-sample');check('target allocation');renderer.setRenderTarget(null);
  }
  return targets.get(size);
 }
 const elevation=6.021653966*Math.PI/180;
 function setSun(degrees){
  const az=degrees*Math.PI/180;solarDirection.value.set(Math.sin(az)*Math.cos(elevation),Math.sin(elevation),Math.cos(az)*Math.cos(elevation));
  sun.position.copy(center).addScaledVector(solarDirection.value,100);sun.updateMatrixWorld();sun.target.updateMatrixWorld();renderer.shadowMap.needsUpdate=true;
 }
 function setCamera(azimuth,degrees,footprint=128){
  const az=azimuth*Math.PI/180,el=degrees*Math.PI/180,span=half*128/footprint;
  Object.assign(camera,{left:-span,right:span,top:span,bottom:-span});camera.updateProjectionMatrix();
  camera.position.copy(center).addScaledVector(new THREE.Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)),600);
  camera.lookAt(center);camera.updateMatrixWorld();lodCamera.value.copy(camera.position);
 }
 async function render(which,size=128,mode=0){
  source.visible=which==='source';proxy.visible=!source.visible;
  responseEnabled.value=which.startsWith('exact')?2:which.startsWith('response')?1:0;
  ownCoverage.value=which.endsWith('-own')?1:0;outputMode.value=mode;
  const target=targetFor(size);renderer.setRenderTarget(target);renderer.clear(true,true,true);renderer.render(scene,camera);renderer.setRenderTarget(null);
  await waitForProfilingFence(gl,{timeoutMilliseconds:60000});check(which+' render');
  const halfPixels=new Uint16Array(size*size*4);renderer.readRenderTargetPixels(target,0,0,size,size,halfPixels);check(which+' read');
  return Float32Array.from(halfPixels,THREE.DataUtils.fromHalfFloat);
 }
 const preview=document.createElement('canvas'),context=preview.getContext('2d');
 const encode=v=>v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055;
 async function save(name,pixels,size,raw=true){
  preview.width=preview.height=size;const image=context.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const src=(y*size+x)*4,dst=((size-1-y)*size+x)*4,a=pixels[src+3];
   for(let c=0;c<3;c++)image.data[dst+c]=Math.round(Math.min(1,Math.max(0,encode(a>.00001?pixels[src+c]/a:0)))*255);
   image.data[dst+3]=Math.round(Math.max(0,Math.min(1,a))*255);
  }
  context.putImageData(image,0,0);await window.pilotSave(name+'.png',preview.toDataURL('image/png').split(',')[1]);
  if(raw)await window.pilotSave(name+'.rgba32f',base64(new Uint8Array(pixels.buffer,pixels.byteOffset,pixels.byteLength)));
 }
 function sums(pixels){
  let alpha=0;const rgb=[0,0,0];let max=0;
  for(let i=0;i<pixels.length;i+=4){alpha+=pixels[i+3];for(let c=0;c<3;c++){rgb[c]+=pixels[i+c];max=Math.max(max,pixels[i+c]);}}
  return{alphaArea:alpha,premultipliedRGBSum:rgb,meanCoveredRGB:rgb.map(v=>alpha?v/alpha:0),maxPremultipliedRGB:max};
 }
 function compare(reference,candidate){
  let alphaAbsolute=0,intersection=0,straightAbsolute=0,premulAbsolute=0;
  for(let i=0;i<reference.length;i+=4){
   const a=reference[i+3],b=candidate[i+3],w=Math.min(a,b);alphaAbsolute+=Math.abs(a-b);intersection+=w;
   for(let c=0;c<3;c++){premulAbsolute+=Math.abs(reference[i+c]-candidate[i+c]);if(w>.00001)straightAbsolute+=Math.abs(reference[i+c]/a-candidate[i+c]/b)*w;}
  }
  return{alphaAbsoluteSum:alphaAbsolute,intersectionCoverage:intersection,intersectionStraightRGBMAE:intersection?straightAbsolute/(intersection*3):null,premultipliedRGBAbsoluteSum:premulAbsolute};
 }
 const equal=(a,b)=>a.length===b.length&&a.every((value,i)=>value===b[i]);
 const tiles=[],rows=[],indirectChecks=[];
 try{
  if(config.bakeIsland){
   const {bakeIslandResponse}=await import('/island-bake.mjs');
   return await bakeIslandResponse({config,metadata,albedo,render,setSun,setCamera,stage,check,base64,hash,
    sourceParts:sourceParts.map(({materialName,triangles,thinLeaf})=>({materialName,triangles,thinLeaf}))});
  }
  await stage('create one tiny WebGL context; bake 16 direct-response tiles');
  for(const sunFrame of pilotSuns){
   setSun(sunFrame*45);
   for(const view of pilotViews){
    setCamera(view%8*45,Math.floor(view/8)*35);
    const renderStarted=performance.now(),pixels=await render('source',512),tile=integrateResponseTile(pixels,512,512,4),layer=responseLayer(view,sunFrame);
    for(let i=0;i<tile.length;i++)responseData[layer*tile.length+i]=THREE.DataUtils.toHalfFloat(tile[i]);
    const visibilityBytes=visibility.image.data;let coverageDifference=0,visibilityCoverage=0;
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){
     const original=visibilityBytes[(((sunFrame*3+2-Math.floor(view/8))*128+y)*1024+(view%8)*128+x)*2+1]/255;
     coverageDifference+=Math.abs(tile[(y*128+x)*4+3]-original);visibilityCoverage+=original;
    }
    tiles.push({view,sunFrame,layer,...sums(tile),existingVisibilityCoverage:visibilityCoverage,alphaAbsoluteDifferenceFromExisting:coverageDifference,milliseconds:performance.now()-renderStarted});
    await save('bake-view'+view+'-sun'+sunFrame,tile,128,false);
   }
  }
  responseTexture.needsUpdate=true;
  await window.pilotSave('response-128x128x16.rgba16f',base64(new Uint8Array(responseData.buffer)));
  for(const pose of pilotPoses){
   await stage('source/current/response comparisons: '+pose.name);setSun(pose.sunAzimuth);
   // This exact-pose response removes atlas view/light interpolation only in
   // study variants. It is derived from the same 4x source sampling as the bake.
   setCamera(pose.azimuth,pose.elevation,128);
   const exactRaw=await render('source',512),exactTile=integrateResponseTile(exactRaw,512,512,4);
   for(let i=0;i<exactTile.length;i++)exactData[i]=THREE.DataUtils.toHalfFloat(exactTile[i]);
   exactTexture.needsUpdate=true;
   await save(pose.name+'-exact-pose-bake',exactTile,128);
   for(const footprint of [128,24,8]){
    setCamera(pose.azimuth,pose.elevation,footprint);const rendered={};
    const sourceRaw=footprint===128?exactRaw:await render('source',512);
    const sourceSS4=integrateResponseTile(sourceRaw,512,512,4);
    const fixedRasterReference=fixedRasterAreaReference(exactRaw,512,footprint);
    // Preserve actual high-resolution readback independently of the integrated
    // reference and of the 128px runtime-source image. No reference substitution.
    await window.pilotSave(pose.name+'-'+footprint+'px-source-raw512.rgba32f',base64(new Uint8Array(sourceRaw.buffer,sourceRaw.byteOffset,sourceRaw.byteLength)));
    await save(pose.name+'-'+footprint+'px-source-ss4',sourceSS4,128);
    await save(pose.name+'-'+footprint+'px-source-fixed-raster-area',fixedRasterReference,128);
    for(const which of ['source','current','response','response-own','exact','exact-own']){
     rendered[which]=await render(which);assert(sums(rendered[which]).alphaArea>0,'Empty '+which+' silhouette at '+pose.name+' '+footprint);await save(pose.name+'-'+footprint+'px-'+which,rendered[which],128);
    }
    for(let i=3;i<rendered.current.length;i+=4)assert(rendered.current[i]===rendered.response[i],'Response changed raw proxy coverage');
    const repeat=await render('response');assert(equal(repeat,rendered.response),'Static response repeat differs');
    const restored=await render('current');assert(equal(restored,rendered.current),'Disabled response failed to restore current output');
    const diagnosticKinds=['current','response','response-own','exact','exact-own'];
    const ss4Comparisons=Object.fromEntries(diagnosticKinds.map(kind=>[kind,{...sums(rendered[kind]),error:compare(sourceSS4,rendered[kind])}]));
    const fixedRasterComparisons=Object.fromEntries(diagnosticKinds.map(kind=>[kind,compare(fixedRasterReference,rendered[kind])]));
    rows.push({pose,footprint,source:sums(rendered.source),sourceSS4:sums(sourceSS4),current:sums(rendered.current),response:sums(rendered.response),
     fixedRasterReference:sums(fixedRasterReference),sourceRuntimeVsSS4:compare(sourceSS4,rendered.source),ss4Comparisons,fixedRasterComparisons,
     currentError:compare(rendered.source,rendered.current),responseError:compare(rendered.source,rendered.response),alphaUnchanged:true,repeatEqual:true,offRestored:true});
    if(footprint===24){
     const a=await render('current',128,2),b=await render('response',128,2);assert(equal(a,b),'Response changed indirect lighting');indirectChecks.push({pose:pose.name,byteEquivalentFloatPixels:true});
    }
   }
  }
  // A subpixel move is not an exact atlas view; compare both response methods
  // over the same deterministic camera changes without claiming motion quality.
  const motion=[];setSun(202.5);setCamera(22.5,17.5,24);
  const originalPosition=camera.position.clone(),originalTarget=center.clone();
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),worldPixel=(camera.right-camera.left)/128;
  for(const shift of [0,.25,.5,.75,0]){
   camera.position.copy(originalPosition).addScaledVector(right,shift*worldPixel);camera.lookAt(originalTarget.clone().addScaledVector(right,shift*worldPixel));camera.updateMatrixWorld();lodCamera.value.copy(camera.position);
   const a=await render('current'),b=await render('response');motion.push({shift,current:sums(a),response:sums(b)});
   await save('motion-'+String(shift).replace('.','_')+'-current',a,128,false);await save('motion-'+String(shift).replace('.','_')+'-response',b,128,false);
  }
  check('finished');
  const extension=gl.getExtension('WEBGL_debug_renderer_info');
  return{ok:true,method:'Isolated actual Island source directDiffuse versus existing far normal/visibility proxy and source-response proxy; no scene acceptance',
   renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),threeRevision:THREE.REVISION,sourceSHA256:config.sourceSHA256,
   sourceParts:sourceParts.map(({materialName,triangles,thinLeaf})=>({materialName,triangles,thinLeaf})),metadata,
   unitSun:true,sourceWindTime:0,rootTransform:'identity',instanceTint:'white',proxySceneShadow:false,linearHDR:true,
   targetSamples:4,comparisonSize:128,bakeSize:512,responseCellSize:128,bakeSupersample:4,referenceSupersample:4,atlasFormat:'RGBA16F array; premultiplied direct RGB and coverage',
   shadow:{mapSize:1024,footprint:50,normalBias:.025,bias:-.00002},tiles,rows,indirectChecks,motion,shaderErrors,elapsedMilliseconds:performance.now()-started,
   limits:['No full forest, consumer GPU or artistic acceptance','4x source reference and 128px runtime source are distinct outputs; source texture filtering and hashed sample footprints differ','Current/response/exact keep existing proxy alpha; response-own/exact-own deliberately use their baked coverage solely to isolate coverage consistency','Exact-pose response is a diagnostic oracle, not an available runtime atlas view','Identity root/white tint/static wind/fixed sun elevation do not validate transformed runtime poses','Scene self-shadow is intentionally excluded from proxies; known quad self-shadow remains a separate problem']};
 }finally{
  setFarCrownBlending(false);for(const target of targets.values())target.dispose();
  for(const {mesh}of sourceParts){mesh.geometry.dispose();mesh.material.dispose();mesh.customDepthMaterial.dispose();}
  const textureSet=new Set([albedo,normals,visibility,responseTexture,exactTexture,whiteCloud,...proxy.material.userData.sharedShaderTextures??[]]);
  for(const {mesh}of sourceParts)for(const value of Object.values(mesh.material))if(value?.isTexture)textureSet.add(value);
  for(const value of Object.values(proxy.material))if(value?.isTexture)textureSet.add(value);
  textureSet.forEach(texture=>texture.dispose());proxy.geometry.dispose();proxy.material.dispose();proxy.customDepthMaterial.dispose();proxy.dispose();sun.shadow.map?.dispose();renderer.dispose();
 }
};
