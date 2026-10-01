import * as THREE from 'three';
import {createEngine} from '../../src/render/engine.ts';
import {createAtmosphere,cloudAerialDensity} from '../../src/world/atmosphere.ts';
import {applyCinematic,sampleCamera} from '../../src/camera/cinematic.ts';
import {worldTime} from '../../src/render/materials.ts';
import {solarColor,solarIntensity,solarDirection} from '../../src/render/sky-lighting.ts';
import {cloudCoverageScale,setCloudMorphologyStudy,getCloudMorphologyStudy} from '../../src/world/clouds.ts';
import {waitForProfilingFence} from '../../src/render/profiling-sync.ts';

const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
function difference(a,b){
 let changedPixels=0,sum=0,max=0;
 for(let i=0;i<a.length;i+=4){let changed=false;for(let c=0;c<3;c++){const d=Math.abs(a[i+c]-b[i+c]);sum+=d;max=Math.max(max,d);changed||=d!==0;}changedPixels+=Number(changed);}
 return {changedPixels,maximumChannelDelta:max,meanAbsoluteRGBDelta:sum/(a.length/4*3)};
}

window.runProbe=async()=>{
 const config=await(await fetch('/probe-config.json')).json();
 const {width,height,time,lighting}=config;
 const started=performance.now(),canvas=document.querySelector('canvas');
 const {renderer,scene,camera,shaderErrors,contextFallback}=createEngine(canvas);
 let atmosphere;
 try{
  // No casters exist. Excluding their unused pass avoids allocating a 2048 map.
  renderer.shadowMap.enabled=false;renderer.setPixelRatio(1);renderer.setSize(width,height,false);
  renderer.toneMappingExposure=lighting.exposure;
  camera.aspect=width/height;applyCinematic(camera,time);camera.updateMatrixWorld(true);
  const noiseStarted=performance.now();atmosphere=createAtmosphere(renderer);
  const creationMilliseconds=performance.now()-noiseStarted;
  atmosphere.sun.color.set(lighting.sunColor);solarColor.value.copy(atmosphere.sun.color);
  solarIntensity.value=lighting.sunIntensity;cloudAerialDensity.value=lighting.cloudFogDensity;
  cloudCoverageScale.value=lighting.cloudCoverage;worldTime.value=time;
  // These are the exact visible bindings at the start of atmosphere.update().
  // Deliberately do not update its cubemap, cloud-shadow or PMREM targets here.
  atmosphere.dome.position.copy(camera.position);
  atmosphere.dome.material.uniforms.uEye.value.copy(camera.position);
  scene.add(atmosphere.dome);
  const compiled=[];const beforeCompile=atmosphere.dome.material.onBeforeCompile.bind(atmosphere.dome.material);
  atmosphere.dome.material.onBeforeCompile=(shader,activeRenderer)=>{beforeCompile(shader,activeRenderer);compiled.push({enabled:getCloudMorphologyStudy(),fragmentShader:shader.fragmentShader});};
  const gl=renderer.getContext(),rows=[],pixels=[];
  if(gl.drawingBufferWidth!==width||gl.drawingBufferHeight!==height)throw Error('Unexpected physical drawing buffer size');
  for(const [index,enabled]of [false,true,false].entries()){
   const name=['off-1','on','off-2'][index];setCloudMorphologyStudy(enabled);atmosphere.invalidateLighting();
   renderer.info.reset();const frameStarted=performance.now();renderer.render(scene,camera);
   const fence=await waitForProfilingFence(gl,{timeoutMilliseconds:60000});
   if(shaderErrors.length)throw Error('Shader compile failed: '+shaderErrors.join('\n'));
   const rgba=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
   if(gl.getError()!==gl.NO_ERROR)throw Error('Default framebuffer readPixels failed');
   let alphaFailures=0,min=255,max=0,sum=[0,0,0];
   for(let i=0;i<rgba.length;i+=4){alphaFailures+=Number(rgba[i+3]!==255);for(let c=0;c<3;c++){min=Math.min(min,rgba[i+c]);max=Math.max(max,rgba[i+c]);sum[c]+=rgba[i+c];}}
   if(alphaFailures||max-min<8)throw Error('Opaque/nonblank sky check failed');
   const png=canvas.toDataURL('image/png');await window.savePNG(name+'.png',png);
   const row={name,enabled,sha256:await sha256(rgba),renderAndReadbackMilliseconds:performance.now()-frameStarted,
    fence,alphaFailures,minimumRGB:min,maximumRGB:max,meanRGB:sum.map(v=>v/(width*height)),
    drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
   rows.push(row);pixels.push(rgba);await window.saveFrameRow(row);
  }
  const restoration=difference(pixels[0],pixels[2]),onDifference=difference(pixels[0],pixels[1]);
  if(restoration.changedPixels!==0||rows[0].sha256!==rows[2].sha256)throw Error('OFF restoration is not byte exact');
  if(onDifference.changedPixels===0)throw Error('ON study did not change any sky pixels');
  const compiledPrograms=[];
  for(const shader of compiled)compiledPrograms.push({enabled:shader.enabled,fragmentSHA256:await sha256(new TextEncoder().encode(shader.fragmentShader))});
  const sample=sampleCamera(time);
  return {ok:true,scope:'Actual production visible atmosphere shader only; no geometry, reflection, shadow or PMREM renders',
   config,camera:{position:camera.position.toArray(),target:sample.target.toArray(),quaternion:camera.quaternion.toArray(),up:camera.up.toArray(),fov:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far},
   sun:{direction:solarDirection.value.toArray(),linearColor:solarColor.value.toArray(),intensity:solarIntensity.value},
   renderer:{threeRevision:THREE.REVISION,contextFallback,drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],antialias:gl.getContextAttributes().antialias,samples:gl.getParameter(gl.SAMPLES),toneMapping:renderer.toneMapping,outputColorSpace:renderer.outputColorSpace},
   creationMilliseconds,probeMilliseconds:performance.now()-started,rows,restoration,onDifference,compiledPrograms,
   unusedLightingUpdates:{...atmosphere.lightingStats},shaderErrors,
   limitations:['192-pixel view uses its own derivative-driven cloud footprint; it is not a full-resolution scene pixel match.',
    'The unoccluded lower hemisphere replaces terrain/ocean only in this isolated sky fixture.',
    'Shared reflection/shadow field composition is CPU-verified separately; those targets are not rendered here.',
    'Changing morphology can change actual occupied density and image coverage at unchanged coverage control.']};
 }finally{
  setCloudMorphologyStudy(false);
  if(atmosphere){scene.remove(atmosphere.dome);atmosphere.dispose();atmosphere.dome.material.dispose();atmosphere.dome.geometry.dispose();}
  renderer.dispose();renderer.forceContextLoss();
 }
};
