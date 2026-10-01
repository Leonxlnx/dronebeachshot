import * as THREE from 'three';
import {createEngine,sealOpaqueCanvas} from '../../src/render/engine.ts';
import {createLinearMainOutput} from '../../src/render/linear-main-output.ts';
import {createAtmosphere,cloudAerialDensity} from '../../src/world/atmosphere.ts';
import {applyCinematic,sampleCamera} from '../../src/camera/cinematic.ts';
import {worldTime} from '../../src/render/materials.ts';
import {sceneCaptureScale} from '../../src/render/refraction.ts';
import {solarColor,solarIntensity,solarDirection} from '../../src/render/sky-lighting.ts';
import {cloudCoverageScale,setCloudMorphologyStudy,getCloudMorphologyStudy} from '../../src/world/clouds.ts';
import {waitForProfilingFence} from '../../src/render/profiling-sync.ts';

const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const glslFloat=value=>Number.isInteger(value)?value+'.':String(value);
const anchors={step:'float stepLen=clamp(30.,span/512.,span/12.);',illumination:'float illumination=cloudSunTransmission(p,uSun);',footprint:'float footprint=max(dist*pixelAngle,cellLength*.5);'};
function replaceOnce(source,from,to){if(source.split(from).length!==2)throw Error('Cloud sampling anchor changed: '+from);return source.replace(from,to);}
function variantShader(original,variant){
 let source=original;
 for(const anchor of Object.values(anchors))if(source.split(anchor).length!==2)throw Error('Cloud sampling anchor missing/duplicated: '+anchor);
 if(variant.stepMeters!==30)source=replaceOnce(source,anchors.step,`float stepLen=clamp(${glslFloat(variant.stepMeters)},span/512.,span/12.);`);
 if(variant.constantIllumination)source=replaceOnce(source,anchors.illumination,'float illumination=1.;');
 if(variant.footprintFactor!==.5)source=replaceOnce(source,anchors.footprint,'float footprint=max(dist*pixelAngle,cellLength*1.);');
 return source;
}
function byteDifference(a,b,components=4){
 let changedPixels=0,sum=0,max=0;
 for(let i=0;i<a.length;i+=components){let changed=false;for(let c=0;c<components;c++){const d=Math.abs(a[i+c]-b[i+c]);sum+=d;max=Math.max(max,d);changed||=d!==0;}changedPixels+=Number(changed);}
 return {changedPixels,maximumComponentDelta:max,meanAbsoluteComponentDelta:sum/a.length};
}
function base64(bytes){let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result);}
function linearStats(half){
 const channels=Array.from({length:4},()=>({min:Infinity,max:-Infinity,sum:0}));let finite=true;
 for(let i=0;i<half.length;i++){const x=THREE.DataUtils.fromHalfFloat(half[i]);finite&&=Number.isFinite(x);const c=channels[i%4];c.min=Math.min(c.min,x);c.max=Math.max(c.max,x);c.sum+=x;}
 return {finite,channels:channels.map(({min,max,sum})=>({min,max,mean:sum/(half.length/4)}))};
}
function cloudSpan(origin,ray){
 let lo=0,hi=100000;
 if(Math.abs(ray.y)<.00001){if(origin.y<1000||origin.y>2250)return 0;}
 else{const a=(1000-origin.y)/ray.y,b=(2250-origin.y)/ray.y;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}
 const a=ray.x*ray.x+ray.z*ray.z,b=origin.x*ray.x+origin.z*ray.z,c=origin.x*origin.x+origin.z*origin.z-36000*36000;
 if(a>.00001){const d=b*b-a*c;if(d<0)return 0;const root=Math.sqrt(d);lo=Math.max(lo,(-b-root)/a);hi=Math.min(hi,(-b+root)/a);}else if(c>0)return 0;
 return Math.max(0,hi-lo);
}
function sampleBudget(camera,width,height,stepMeters){
 const spans=[],steps=[],counts=[];let cappedRays=0,shortRays=0;const ray=new THREE.Vector3();
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  ray.set((x+.5)/width*2-1,1-(y+.5)/height*2,.5).unproject(camera).sub(camera.position).normalize();
  const span=cloudSpan(camera.position,ray);if(span<=0)continue;
  const step=Math.max(span/512,Math.min(stepMeters,span/12));
  spans.push(span);steps.push(step);counts.push(Math.min(512,Math.ceil(span/step)));
  cappedRays+=Number(span/512>stepMeters);shortRays+=Number(span/12<stepMeters);
 }
 const range=a=>a.length?{min:Math.min(...a),max:Math.max(...a),mean:a.reduce((s,v)=>s+v,0)/a.length}:null;
 return {method:'Double-precision center rays through the exact crop camera; theoretical cells before density skip and transmittance early exit, not GPU invocation counts',pixels:width*height,cloudIntervalRays:spans.length,cappedRays,shortRays,spanMeters:range(spans),cellMeters:range(steps),theoreticalCells:range(counts)};
}

window.runProbe=async()=>{
 const config=await(await fetch('/probe-config.json')).json();
 const {width,height,time,lighting,crop}=config;
 const started=performance.now(),canvas=document.querySelector('canvas');
 const {renderer,scene,camera,shaderErrors,contextFallback}=createEngine(canvas);
 let atmosphere,linearMain,linearTarget=null,activeVariant=null;
 const originalSetRenderTarget=renderer.setRenderTarget;
 const compiled=[];
 try{
  renderer.shadowMap.enabled=false;renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.toneMappingExposure=lighting.exposure;
  camera.aspect=crop.fullWidth/crop.fullHeight;applyCinematic(camera,time);
  camera.setViewOffset(crop.fullWidth,crop.fullHeight,crop.x,crop.y,width,height);camera.updateMatrixWorld(true);
  const fullCamera=camera.clone();fullCamera.clearViewOffset();fullCamera.updateMatrixWorld(true);
  // Same geometric pixel rays as the full view. Even crop offsets preserve the
  // alignment of 2x2 fragment derivative quads; no image resize occurs.
  let maximumRayError=0;const a=new THREE.Vector3(),b=new THREE.Vector3();
  for(const [x,y]of [[0,0],[width-1,0],[0,height-1],[width-1,height-1],[width/2,height/2]]){
   a.set((x+.5)/width*2-1,1-(y+.5)/height*2,.5).unproject(camera).sub(camera.position).normalize();
   b.set((crop.x+x+.5)/crop.fullWidth*2-1,1-(crop.y+y+.5)/crop.fullHeight*2,.5).unproject(fullCamera).sub(fullCamera.position).normalize();
   maximumRayError=Math.max(maximumRayError,a.distanceTo(b));
  }
  if(maximumRayError>1e-10||crop.x%2||crop.y%2)throw Error('Crop ray/derivative alignment changed');
  const noiseStarted=performance.now();atmosphere=createAtmosphere(renderer);const creationMilliseconds=performance.now()-noiseStarted;
  atmosphere.sun.color.set(lighting.sunColor);solarColor.value.copy(atmosphere.sun.color);solarIntensity.value=lighting.sunIntensity;
  cloudAerialDensity.value=lighting.cloudFogDensity;cloudCoverageScale.value=lighting.cloudCoverage;worldTime.value=time;sceneCaptureScale.value=1;
  setCloudMorphologyStudy(lighting.cloudMorphology);
  // Bind only the visible dome exactly as update() does. No unused cube,
  // shadow or PMREM update is requested by this fixture.
  atmosphere.dome.position.copy(camera.position);const material=atmosphere.dome.material;
  material.uniforms.uEye.value.copy(camera.position);material.uniforms.uStoreTransmittance.value=1;scene.add(atmosphere.dome);
  const originalShader=material.fragmentShader,previousCompile=material.onBeforeCompile.bind(material);
  material.onBeforeCompile=(shader,activeRenderer)=>{previousCompile(shader,activeRenderer);compiled.push({name:activeVariant,fragmentShader:shader.fragmentShader,defines:{...material.defines}});};
  renderer.setRenderTarget=function(target,...args){if(target?.texture?.name==='main-linear-rgba16f-msaa4')linearTarget=target;return originalSetRenderTarget.call(this,target,...args);};
  linearMain=createLinearMainOutput(renderer);linearMain.setEnabled(true);linearMain.setSampleScale(1);
  const gl=renderer.getContext(),rows=[],allHalf=[],allRGB=[];
  if(gl.drawingBufferWidth!==width||gl.drawingBufferHeight!==height)throw Error('Unexpected physical drawing buffer size');
  for(const variant of config.variants){
   activeVariant=variant.name;material.fragmentShader=variantShader(originalShader,variant);material.needsUpdate=true;
   const fixtureFragmentSHA256=await sha256(new TextEncoder().encode(material.fragmentShader));
   renderer.info.reset();const frameStarted=performance.now();linearMain.render(scene,camera,0);sealOpaqueCanvas(renderer);
   const fence=await waitForProfilingFence(gl,{timeoutMilliseconds:60000});
   if(shaderErrors.length)throw Error('Shader compile failed: '+shaderErrors.join('\n'));
   if(!linearTarget||linearTarget.width!==width||linearTarget.height!==height||linearTarget.samples!==4||linearTarget.texture.type!==THREE.HalfFloatType)throw Error('Actual linear-main target mismatch');
   const rgba=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
   if(gl.getError()!==gl.NO_ERROR)throw Error('Default framebuffer readPixels failed');
   const half=new Uint16Array(width*height*4);renderer.readRenderTargetPixels(linearTarget,0,0,width,height,half);
   if(gl.getError()!==gl.NO_ERROR)throw Error('Resolved RGBA16F readPixels failed');
   const stats=linearStats(half);if(!stats.finite||stats.channels[3].min<0||stats.channels[3].max>1)throw Error('Invalid linear/transmittance values');
   const rgb=new Uint8Array(width*height*3);let alphaFailures=0,min=255,max=0;
   for(let i=0,j=0;i<rgba.length;i+=4){alphaFailures+=Number(rgba[i+3]!==255);for(let c=0;c<3;c++){rgb[j++]=rgba[i+c];min=Math.min(min,rgba[i+c]);max=Math.max(max,rgba[i+c]);}}
   if(alphaFailures||max-min<8||stats.channels[0].max===0)throw Error('Opaque/nonblank sky check failed');
   const raw=new Uint8Array(half.length*2),view=new DataView(raw.buffer);for(let i=0;i<half.length;i++)view.setUint16(i*2,half[i],true);
   await window.savePNG(variant.name+'.png',canvas.toDataURL('image/png'));
   await window.saveRaw(variant.name+'.rgba16f.bin',base64(raw));
   const row={...variant,fixtureFragmentSHA256,displayRGBA8SHA256:await sha256(rgba),linearRGBA16FSHA256:await sha256(raw),rawBytes:raw.length,rawFormat:'RGBA16F little-endian, bottom row first, RGB linear sRGB radiance; A cloud transmittance',renderReadbackMilliseconds:performance.now()-frameStarted,fence,alphaFailures,displayRGBRange:[min,max],linear:stats,sampleBudget:sampleBudget(camera,width,height,variant.stepMeters),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,linearMain:linearMain.getState()};
   rows.push(row);allHalf.push(half);allRGB.push(rgb);await window.saveFrameRow(row);
  }
  const last=rows.length-1,restoration={display:byteDifference(allRGB[0],allRGB[last],3),rawHalfBits:byteDifference(allHalf[0],allHalf[last],4)};
  if(restoration.display.changedPixels||restoration.rawHalfBits.changedPixels)throw Error('Baseline restoration is not byte exact');
  const differences=rows.slice(1,-1).map((row,i)=>({name:row.name,display:byteDifference(allRGB[0],allRGB[i+1],3),rawHalfBits:byteDifference(allHalf[0],allHalf[i+1],4)}));
  const compiledPrograms=[];for(const shader of compiled)compiledPrograms.push({name:shader.name,defines:shader.defines,fragmentSHA256:await sha256(new TextEncoder().encode(shader.fragmentShader))});
  const sample=sampleCamera(time);
  return {ok:true,scope:'Production visible atmosphere plus production RGBA16F MSAA4 linear-main resolve, exact cropped full-resolution rays; fixture-only integration variants',config,camera:{position:camera.position.toArray(),target:sample.target.toArray(),quaternion:camera.quaternion.toArray(),up:camera.up.toArray(),fov:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far,view:camera.view,maximumRayError},sun:{direction:solarDirection.value.toArray(),linearColor:solarColor.value.toArray(),intensity:solarIntensity.value},morphology:getCloudMorphologyStudy(),renderer:{threeRevision:THREE.REVISION,contextFallback,drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],canvasAntialias:gl.getContextAttributes().antialias,canvasSamples:gl.getParameter(gl.SAMPLES),toneMapping:renderer.toneMapping,outputColorSpace:renderer.outputColorSpace},creationMilliseconds,probeMilliseconds:performance.now()-started,rows,restoration,differences,compiledPrograms,originalFragmentSHA256:await sha256(new TextEncoder().encode(originalShader)),unusedLightingUpdates:{...atmosphere.lightingStats},shaderErrors,limitations:['Sky-only crop omits scene occlusion, water, reflection, cloud-shadow and PMREM updates; compare only unobstructed sky pixels.','uStoreTransmittance=1 changes alpha only; the production linear-main output resolves the same RGB and the exported PNG alpha is sealed opaque.','15/7.5m variants keep the 512-cell budget, so capped rays may share larger cell lengths instead of requested nominal spacing.','Constant illumination1 and doubled cell-footprint are diagnostic controls, not proposed production looks.','Camera center-ray statistics exclude density skips and early transmittance termination and are not GPU loop timing.','Current source is hashed in frozen preparation; historical full-scene pixel identity is not assumed.']};
 }finally{
  renderer.setRenderTarget=originalSetRenderTarget;linearMain?.dispose();setCloudMorphologyStudy(false);
  if(atmosphere){scene.remove(atmosphere.dome);atmosphere.dispose();atmosphere.dome.material.dispose();atmosphere.dome.geometry.dispose();}
  renderer.dispose();renderer.forceContextLoss();
 }
};
