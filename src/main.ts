import './style.css';
import * as THREE from 'three';
import {createEngine,sealOpaqueCanvas,type Tier,tiers} from './render/engine';
import {loadTextures} from './world/assets';
import {createTerrain} from './world/terrain';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createDetailedRocks,ROCK_VISUAL_URL} from './world/detailed-rocks';
import {createAtmosphere,cloudAerialDensity} from './world/atmosphere';
import {createOcean,foamDepthGate} from './world/ocean';
import {loadCoastalField} from './world/coastal-loader';
import {createRockSpray} from './world/spray';
import {createGroundCover} from './world/plants';
import {createForestFloor} from './world/forest-floor';
import {createForestStructure} from './world/forest-structure';
import {createVegetation} from './world/vegetation';
import {setFoliageMultisampling} from './render/vegetation-material';
import {worldTime,debugMode,createGroundWindDepth} from './render/materials';
import {applyCinematic,evaluationCameras,DURATION,cameraDiagnostics} from './camera/cinematic';
import {Ambience} from './app/audio';
import {timelineTime,captureDimensions} from './app/capture-state';
import {createSceneReadiness} from './app/scene-readiness';
import {SEED,clamp} from './world/math';
import {enableMaterialDiagnostics} from './render/diagnostics';
import {withAerialPerspective,aerialDensity} from './render/aerial-perspective';
import {withCloudLighting,solarColor,solarIntensity} from './render/sky-lighting';
import {createRefractionPass} from './render/refraction';
import {mineralReliefStrength,stoneBeddingAligned,sandRippleStrength,sandRippleFilter,rockWeatheringStrength,groundLayerPruning} from './render/ground-materials';
import {waitForProfilingFence} from './render/profiling-sync';
import {cloudCoverageScale} from './world/clouds';
import {createGroundCoverCulling} from './render/ground-cover-culling';
import {createRemoteShadowStudy} from './render/remote-shadow-study';
import {createTerrainShadowChunkStudy} from './render/terrain-shadow-chunks';
import {getFarCrownCoverage,setFarCrownCoverage} from './render/far-crown-coverage';
import {getFarCrownBlending,setFarCrownBlending,prepareFarCrownBlending,disposeFarCrownBlending} from './render/far-crown-blending';
import {createLinearMainOutput} from './render/linear-main-output';
declare const __BAY_SOURCE_IDENTITY__:string;
const buildIdentity={sourceIdentity:__BAY_SOURCE_IDENTITY__,production:import.meta.env.PROD};
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const params=new URLSearchParams(location.search),capture=params.has('capture'),inspect=params.has('inspect')&&!capture;
let tier:Tier=(params.get('quality') as Tier)||'balanced';if(!Object.hasOwn(tiers,tier))tier='balanced';if(capture)tier='high';
let time=timelineTime(Number(params.get('t')||0)),playing=false,ready=false,raf=0,last=0,frameCount=0,sumFrame=0,controlsTimer=0;
let contextLost=()=>false;
const readiness=createSceneReadiness(()=>contextLost());
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const audio=new Ambience();
let freeYaw=0,freePitch=0,drag=false,previousX=0,previousY=0;
function failure(message:string){readiness.fail(message);ready=false;playing=false;cancelAnimationFrame(raf);audio.pause();for(const id of ['intro','controls','show-controls','diagnostics'])el(id).hidden=true;document.documentElement.dataset.ready='false';el('error').textContent=message;el('error').hidden=false;el('loading').hidden=true;}
window.addEventListener('error',e=>failure('The coast could not finish rendering. '+e.message));
window.addEventListener('unhandledrejection',e=>failure('A scene resource could not load. '+String(e.reason)));
async function start(){const canvas=el<HTMLCanvasElement>('world');const engine=createEngine(canvas),{renderer,scene,camera}=engine;if(engine.contextFallback&&!capture)tier='low';engine.resize(tier,capture);canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();playing=false;failure('Graphics memory was interrupted. Reload to return to the bay.');});
// The pinned Three renderer requires WebGL2; its older declaration still admits WebGL1.
const graphics=renderer.getContext() as WebGL2RenderingContext;contextLost=()=>graphics.isContextLost();setFoliageMultisampling(graphics.getParameter(graphics.SAMPLES)>0);
const linearMain=createLinearMainOutput(renderer);const refraction=createRefractionPass(renderer);renderer.shadowMap.autoUpdate=false;
const progress=(p:number,label:string)=>{el<HTMLProgressElement>('load-progress').value=p;el('load-label').textContent=label};const coastalTask=loadCoastalField();window.addEventListener('pagehide',event=>{if(!event.persisted)coastalTask.cancel()});const [textures,field,rockSource]=await Promise.all([loadTextures(progress),coastalTask.promise,new GLTFLoader().loadAsync(ROCK_VISUAL_URL)]).catch(error=>{coastalTask.cancel();throw error});const terrain=createTerrain(textures);scene.add(terrain);progress(42,'Building the ridge');const rocks=createDetailedRocks(textures,rockSource.scene);scene.add(rocks);const atmosphere=createAtmosphere(renderer);scene.add(atmosphere.group);const ocean=createOcean(field,terrain);scene.add(ocean.group);const spray=createRockSpray(field);scene.add(spray);const cover=createGroundCover(textures);scene.add(cover);const diagnosedMaterials=new Set<THREE.Material>();cover.traverse(o=>{if(o instanceof THREE.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial&&!diagnosedMaterials.has(m)){enableMaterialDiagnostics(m);diagnosedMaterials.add(m)}}});const vegetation=await createVegetation(progress,terrain);scene.add(vegetation.group);cover.add(createForestFloor(textures,vegetation.placements));const forestStructure=createForestStructure(textures,vegetation.placements,{coastalSampling:false});cover.add(forestStructure.group);
const coastalForestStructure=(capture||inspect)?createForestStructure(textures,vegetation.placements,{coastalSampling:true}):null;
let coastalUnderstory=false;if(coastalForestStructure){coastalForestStructure.group.visible=false;cover.add(coastalForestStructure.group);}
const groundCoverCulling=createGroundCoverCulling(cover);scene.traverse(o=>{if(o instanceof THREE.Mesh&&o.castShadow&&o.material instanceof THREE.MeshStandardMaterial&&typeof o.material.userData.windBark==='boolean')o.customDepthMaterial=createGroundWindDepth(o.material)});const cloudMaterials=new Set<THREE.Material>();scene.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial&&!cloudMaterials.has(m)){enableMaterialDiagnostics(m);withCloudLighting(m);withAerialPerspective(m);cloudMaterials.add(m)}});progress(76,'Warming the light and water');
let capturing=false,pendingResize=false,pendingQuality:Tier|undefined;
function setQuality(value:Tier){tier=value;el<HTMLSelectElement>('quality').value=tier;vegetation.setTier(tier);renderer.shadowMap.enabled=tier!=='low'&&debugMode.value!==6;atmosphere.sun.shadow.mapSize.setScalar(tiers[tier].shadow||512);atmosphere.sun.shadow.map?.dispose();atmosphere.sun.shadow.map=null;renderer.shadowMap.needsUpdate=true;engine.resize(tier,capture);cover.visible=tier!=='low'&&debugMode.value!==12}
setQuality(tier);
function chooseCamera(t:number,name?:string){if(name&&Object.hasOwn(evaluationCameras,name)){const c=evaluationCameras[name];camera.position.copy(c.position);camera.up.set(0,1,0);camera.lookAt(c.target);camera.fov=54;camera.updateProjectionMatrix();}else{applyCinematic(camera,t);if(!playing&&(freeYaw||freePitch)){camera.rotateY(freeYaw);camera.rotateX(freePitch)}}}
let evalName=params.get('camera')||undefined;
let environmentIntensity=.65,exposure=1.08,profileFrame=false;
const remoteShadowStudy=(capture||inspect)?createRemoteShadowStudy(atmosphere.sun,vegetation.group):null;
const terrainShadowStudy=(capture||inspect)?createTerrainShadowChunkStudy(terrain.getObjectByName('continuous-coastal-extension') as THREE.Mesh):null;
function inspection(){readiness.assertReady();if(!capture&&!inspect)throw Error('Study controls require capture or inspection mode');if(capturing)throw Error('A frame capture is in progress');}
function finite(value:unknown,lo:number,hi:number,key:string){if(typeof value!=='number'||!Number.isFinite(value)||value<lo||value>hi)throw Error('Invalid '+key);return value;}
function boolean(value:unknown,key:string){if(typeof value!=='boolean')throw Error('Invalid '+key);return value;}
function getLighting(){return {exposure,sunIntensity:atmosphere.lighting.sunIntensity,skyIntensity:atmosphere.lighting.skyIntensity,environmentIntensity,sunColor:'#'+atmosphere.sun.color.getHexString(),skyColor:'#'+atmosphere.hemi.color.getHexString(),groundColor:'#'+atmosphere.hemi.groundColor.getHexString(),fogDensity:aerialDensity.value,cloudFogDensity:cloudAerialDensity.value,cloudCoverage:cloudCoverageScale.value};}
function setLighting(settings:Record<string,unknown>){
 inspection();const next={...getLighting()};
 for(const [key,value] of Object.entries(settings)){
  if(!Object.hasOwn(next,key))throw Error('Unknown lighting setting: '+key);
  if(key.endsWith('Color')){if(typeof value!=='string'||!/^#[a-f0-9]{6}$/i.test(value))throw Error('Invalid light color');}
  else if(key==='cloudCoverage')finite(value,.65,1.15,key);
  else finite(value,0,key.includes('Density')?.002:key==='exposure'?3:12,key);
  Object.assign(next,{[key]:value});
 }
 exposure=next.exposure;environmentIntensity=next.environmentIntensity;
 atmosphere.lighting.sunIntensity=next.sunIntensity;atmosphere.lighting.skyIntensity=next.skyIntensity;
 atmosphere.sun.intensity=debugMode.value===6?0:next.sunIntensity;atmosphere.hemi.intensity=debugMode.value===5?0:next.skyIntensity;
 atmosphere.sun.color.set(next.sunColor);atmosphere.hemi.color.set(next.skyColor);atmosphere.hemi.groundColor.set(next.groundColor);
 solarColor.value.copy(atmosphere.sun.color);solarIntensity.value=next.sunIntensity;
 aerialDensity.value=next.fogDensity;(scene.fog as THREE.FogExp2).density=next.fogDensity;cloudAerialDensity.value=next.cloudFogDensity;
 cloudCoverageScale.value=next.cloudCoverage;
 renderer.toneMappingExposure=debugMode.value===11?1:exposure;atmosphere.invalidateLighting();return getLighting();
}
function getSurfaceStudy(){return {mineralRelief:mineralReliefStrength.value,foamDepthGate:foamDepthGate.value,stoneBedding:stoneBeddingAligned.value,sandRipple:sandRippleStrength.value,sandRippleFilter:sandRippleFilter.value,rockWeathering:rockWeatheringStrength.value,groundLayerPruning:groundLayerPruning.value};}
function setSurfaceStudy(settings:Record<string,unknown>){inspection();const targets={mineralRelief:mineralReliefStrength,foamDepthGate,stoneBedding:stoneBeddingAligned,sandRipple:sandRippleStrength,sandRippleFilter,rockWeathering:rockWeatheringStrength,groundLayerPruning};for(const [key,value]of Object.entries(settings)){if(!Object.hasOwn(targets,key))throw Error('Unknown surface setting: '+key);if(key==='groundLayerPruning'){if(typeof value!=='number'||![0,1,2].includes(value))throw Error('Invalid ground layer sampling mode');}else finite(value,0,1,key);}for(const [key,value]of Object.entries(settings))targets[key as keyof typeof targets].value=value as number;return getSurfaceStudy();}
function getShadowStudy(){return {mapSize:atmosphere.sun.shadow.mapSize.x,normalBias:atmosphere.sun.shadow.normalBias,bias:atmosphere.sun.shadow.bias,...remoteShadowStudy?.get(),...terrainShadowStudy?.get()};}
function setShadowStudy(settings:Record<string,unknown>){
 inspection();for(const [key,value]of Object.entries(settings)){
  if(['remoteFit','remoteCasters','terrainChunks'].includes(key))boolean(value,key);
  else if(key==='mapSize'){if(![512,1024,2048,4096].includes(Number(value)))throw Error('Invalid shadow map size');}
  else if(key==='normalBias')finite(value,0,5,key);else if(key==='bias')finite(value,-.01,.01,key);else throw Error('Unknown shadow setting: '+key);
 }
 if(settings.mapSize!==undefined&&settings.mapSize!==atmosphere.sun.shadow.mapSize.x){atmosphere.sun.shadow.mapSize.setScalar(settings.mapSize as number);atmosphere.sun.shadow.map?.dispose();atmosphere.sun.shadow.map=null;}
 if(settings.normalBias!==undefined)atmosphere.sun.shadow.normalBias=settings.normalBias as number;
 if(settings.bias!==undefined)atmosphere.sun.shadow.bias=settings.bias as number;
 if(settings.terrainChunks!==undefined)terrainShadowStudy?.set(settings.terrainChunks as boolean);
 const remote:Record<string,boolean>={};for(const key of ['remoteFit','remoteCasters'])if(settings[key]!==undefined)remote[key]=settings[key] as boolean;
 remoteShadowStudy?.set(remote);renderer.shadowMap.needsUpdate=true;return getShadowStudy();
}
function frameWork(t:number,name=evalName){
 readiness.assertAvailable();renderer.info.reset();worldTime.value=t;
 let groundCoverVisibility:ReturnType<typeof groundCoverCulling.prepare>|null=null;
 const phases:[string,()=>void][]=[
  ['cameraAndGroundCover',()=>{chooseCamera(t,name);groundCoverVisibility=groundCoverCulling.prepare(camera)}],
  ['atmosphere',()=>{atmosphere.update(renderer,camera.position,t);scene.environment=debugMode.value===5?null:atmosphere.environment;scene.environmentIntensity=environmentIntensity;}],
  ['forestSelection',()=>{vegetation.update(camera.position);terrainShadowStudy?.beginFrame();renderer.shadowMap.needsUpdate=true;if(renderer.shadowMap.enabled)vegetation.prepareSunShadow(atmosphere.sun);} ],
  ['refractionAndSunShadow',()=>{refraction.render(scene,camera,ocean.group,spray)}],
  ['mainColor',()=>{vegetation.prepareMain(camera);prepareFarCrownBlending(camera);linearMain.render(scene,camera,debugMode.value);sealOpaqueCanvas(renderer);}]
 ];
 function finish(timings:Record<string,number>|null=null,preFrameQueueMilliseconds:number|null=null){
  readiness.assertAvailable();if(engine.shaderErrors.length)throw Error('Shader compilation failed: '+engine.shaderErrors.join(' | '));
  el('clock').textContent='0:'+Math.floor(t).toString().padStart(2,'0');el<HTMLInputElement>('timeline').value=String(t);
  const info={ready,sourceIdentity:buildIdentity.sourceIdentity,seed:SEED,time:t,quality:tier,renderer:'WebGL2',imageSharing:vegetation.imageSharing,offshoreRocks:rocks.userData.offshoreRocks.instances,coastalField:field.diagnostics,sprayEmitters:spray.userData.emitters,forestStructure:coastalUnderstory?coastalForestStructure!.stats:forestStructure.stats,coastalUnderstory,trees:vegetation.count,distantTrees:vegetation.distantCount,cells:vegetation.cells,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs?.length,camera:camera.position.toArray(),groundCoverVisibility,synchronizedPhaseMilliseconds:timings,profilingMethod:timings?'webgl2-fence':null,preFrameQueueMilliseconds};if(inspect){el('diagnostics').textContent=JSON.stringify(info,null,2);document.documentElement.dataset.scene=JSON.stringify(info)}return info;
 }
 return {phases,finish};
}
function draw(t:number,name=evalName){const frame=frameWork(t,name);for(const [,render]of frame.phases)render();return frame.finish();}
async function drawProfiled(t:number,name=evalName){
 if(capturing)throw Error('A frame capture is in progress');
 capturing=true;setPlaying(false);let completed=false;
 try{
  // Drain preceding setup work separately; it must not inflate the next phase.
  const preFrame=await waitForProfilingFence(graphics),frame=frameWork(t,name),timings:Record<string,number>={};
  for(const [phase,render]of frame.phases){const started=performance.now();render();await waitForProfilingFence(graphics);timings[phase]=performance.now()-started;}
  const result=frame.finish(timings,preFrame.milliseconds);completed=true;return result;
 }finally{
  capturing=false;
  const nextQuality=pendingQuality,resizeNeeded=pendingResize;pendingQuality=undefined;pendingResize=false;
  if(nextQuality)setQuality(nextQuality);else if(resizeNeeded)engine.resize(tier,capture);
  if(completed&&ready&&(nextQuality||resizeNeeded))draw(time);
  if(completed&&(nextQuality||resizeNeeded))throw Error('Profiled frame interrupted by a presentation change; retry with the current settings');
 }
}
function drawInspected(t:number,name=evalName){return profileFrame?drawProfiled(t,name):draw(t,name);}
chooseCamera(time,evalName);vegetation.update(camera.position);atmosphere.update(renderer,camera.position,time);scene.environment=atmosphere.environment;scene.environmentIntensity=.65;await renderer.compileAsync(scene,camera);await refraction.compile(scene,camera);for(const moment of capture?[]:[0,3,7,11,15,19]){draw(moment,'');progress(78+moment,'Preparing the flight');await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))}draw(time);if(engine.shaderErrors.length)throw Error("Shader compilation failed: "+engine.shaderErrors.join(" | "));readiness.markReady();progress(100,'Ready');ready=true;el('loading').hidden=true;el('intro').hidden=capture;el('controls').hidden=capture;el('show-controls').hidden=capture;el('diagnostics').hidden=!inspect;document.body.classList.toggle('capture',capture);document.documentElement.dataset.ready='true';
function showControls(){document.body.classList.add('controls-visible');clearTimeout(controlsTimer);controlsTimer=window.setTimeout(()=>{if(playing)document.body.classList.remove('controls-visible')},2400)}
function setPlaying(value:boolean){if(capturing&&value)return;if(value&&time>=DURATION)time=0;playing=value;el('play').textContent=playing?'Pause':'Resume';el('play').setAttribute('aria-label',playing?'Pause flight':'Resume flight');document.body.classList.toggle('flying',playing);el('intro').hidden=true;last=0;if(playing){evalName=undefined;freeYaw=freePitch=0;showControls()}else document.body.classList.add('controls-visible')}
function seek(value:number){readiness.assertReady();if(capturing)throw Error('A frame capture is in progress');time=timelineTime(value);evalName=undefined;freeYaw=freePitch=0;setPlaying(false);audio.update(time);return drawInspected(time)}
function loop(now:number){const delta=last?Math.min((now-last)/1000,.12):0;last=now;const wasPlaying=playing;if(playing){time=Math.min(DURATION,time+delta);audio.update(time);if(time===DURATION)setPlaying(false)}if(!capture&&wasPlaying){draw(time);if(!inspect){sumFrame+=delta;frameCount++;if(frameCount>90&&sumFrame/frameCount>.036&&renderer.getPixelRatio()>.7){renderer.setPixelRatio(Math.max(.7,renderer.getPixelRatio()-.1));frameCount=sumFrame=0}}}raf=requestAnimationFrame(loop)}
if(!capture)raf=requestAnimationFrame(loop);
el('start').onclick=()=>{if(capturing)return;time=0;setPlaying(!reduced);draw(time)};el('play').onclick=()=>{if(capturing)return;if(time===DURATION)time=0;setPlaying(!playing)};el('replay').onclick=()=>{if(capturing)return;time=0;setPlaying(true)};el('sound').onclick=async()=>{try{const on=await audio.toggle();audio.update(time);el('sound').textContent=on?'Sound on':'Sound off';el('sound').setAttribute('aria-pressed',String(on))}catch{audio.pause();el('sound').textContent='Sound unavailable';el<HTMLButtonElement>('sound').disabled=true}};el('fullscreen').onclick=()=>{if(document.fullscreenElement)void document.exitFullscreen().catch(()=>showControls());else if(document.documentElement.requestFullscreen)void document.documentElement.requestFullscreen().catch(()=>showControls())};el('show-controls').onclick=showControls;
el<HTMLSelectElement>('quality').onchange=e=>{const value=(e.target as HTMLSelectElement).value as Tier;if(capturing){pendingQuality=value;return}setQuality(value);draw(time)};
el<HTMLInputElement>('timeline').oninput=e=>{if(capturing)return;seek(Number((e.target as HTMLInputElement).value))};
window.addEventListener('resize',()=>{if(capturing){pendingResize=true;return}engine.resize(tier,capture);draw(time)});window.addEventListener('keydown',e=>{if(capturing)return;if(e.repeat||(e.target as HTMLElement).closest('input,select,button,a,[contenteditable]'))return;if(e.code==='Space'){e.preventDefault();setPlaying(!playing)}if(e.code==='KeyR'){time=0;setPlaying(true)}if(e.key==='Escape'){setPlaying(false);showControls()}if(e.code==='ArrowRight'||e.code==='ArrowLeft'){e.preventDefault();seek(time+(e.code==='ArrowRight'?.5:-.5))}});
canvas.addEventListener('pointerdown',e=>{if(capturing)return;if(playing){showControls();return}drag=true;previousX=e.clientX;previousY=e.clientY;canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',e=>{if(capturing||!drag||playing)return;freeYaw-=(e.clientX-previousX)*.002;freePitch=clamp(freePitch-(e.clientY-previousY)*.002,-.7,.7);previousX=e.clientX;previousY=e.clientY;evalName=undefined;draw(time)});canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('pointercancel',()=>drag=false);
document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden){if(playing)setPlaying(false);audio.pause();el('sound').textContent='Sound off';el('sound').setAttribute('aria-pressed','false')}});
el('play').textContent='Resume';el('play').setAttribute('aria-label','Resume flight');
// Public stable capture API, all animation is absolute-time driven.
const api={build:buildIdentity,
 getCoastalUnderstory:()=>({enabled:coastalUnderstory,stats:coastalUnderstory?coastalForestStructure!.stats:forestStructure.stats}),
 setCoastalUnderstory:(value:boolean)=>{inspection();const enabled=boolean(value,'coastal understory');if(!coastalForestStructure)throw Error('Coastal understory study is unavailable');coastalUnderstory=enabled;forestStructure.group.visible=!coastalUnderstory;coastalForestStructure.group.visible=coastalUnderstory;renderer.shadowMap.needsUpdate=true;return {enabled:coastalUnderstory,stats:coastalUnderstory?coastalForestStructure.stats:forestStructure.stats};},getFarCrownCoverage,getFarCrownBlending,
 setFarCrownCoverage:(value:boolean)=>{inspection();return setFarCrownCoverage(boolean(value,'far crown coverage'));},
 setFarCrownBlending:(value:boolean)=>{inspection();return setFarCrownBlending(boolean(value,'far crown blending'));},
 setLinearMainOutput:(value:boolean)=>{inspection();linearMain.setEnabled(boolean(value,'linear main output'));return linearMain.getState();},
 getLinearMainOutput:()=>linearMain.getState(),getLighting,setLighting,getSurfaceStudy,setSurfaceStudy,getShadowStudy,setShadowStudy,
 setGroundCulling:(value:boolean)=>{inspection();groundCoverCulling.setEnabled(boolean(value,'ground culling'));return value;},
 setOceanCulling:(value:boolean)=>{inspection();ocean.setTiledCulling(boolean(value,'ocean culling'));return value;},
 setFrameProfiling:(value:boolean)=>{inspection();profileFrame=boolean(value,'frame profiling');return profileFrame;},get ready(){return readiness.ready},get error(){return readiness.error},seed:SEED,duration:DURATION,renderAt:(t:number)=>seek(t),cameraNames:Object.keys(evaluationCameras),cameraDiagnostics,stats:()=>{readiness.assertReady();if(capturing)throw Error('A frame capture is in progress');return draw(time)},setCamera:(name:string)=>{readiness.assertReady();if(capturing)throw Error('A frame capture is in progress');if(!Object.hasOwn(evaluationCameras,name))throw Error('Unknown evaluation camera');setPlaying(false);freeYaw=freePitch=0;evalName=name;time=evaluationCameras[name].time;return drawInspected(time,name)},setDebug:(mode:number)=>{readiness.assertReady();if(capturing)throw Error('A frame capture is in progress');if(!Number.isInteger(mode)||mode<0||mode>12)throw Error('Invalid diagnostic mode');debugMode.value=mode;vegetation.group.visible=mode!==12;rocks.visible=mode!==12;cover.visible=tier!=='low'&&mode!==12;atmosphere.sun.intensity=mode===6?0:atmosphere.lighting.sunIntensity;atmosphere.hemi.intensity=mode===5?0:atmosphere.lighting.skyIntensity;renderer.shadowMap.enabled=tier!=="low"&&mode!==6;atmosphere.dome.visible=![1,2,3,4,7,8,9,10,11,12].includes(mode);scene.background=new THREE.Color(mode===0||mode===5||mode===6?0xa4a89a:0x000000);renderer.toneMappingExposure=mode===11?1:exposure;draw(time)},capture:async(width=3840,height=2160)=>{
 readiness.assertReady();
 if(capturing)throw Error('A frame capture is already in progress');
 captureDimensions(width,height,renderer.capabilities.maxTextureSize);
 capturing=true;setPlaying(false);
 const previousSize=renderer.getSize(new THREE.Vector2()),previousDpr=renderer.getPixelRatio(),previousAspect=camera.aspect;
 try{
  renderer.setPixelRatio(1);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();draw(time);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG encoding failed')),'image/png'));
  readiness.assertReady();return blob;
 }finally{
  renderer.setSize(previousSize.x,previousSize.y,false);renderer.setPixelRatio(previousDpr);camera.aspect=previousAspect;camera.updateProjectionMatrix();capturing=false;
  const nextQuality=pendingQuality,resizeNeeded=pendingResize;pendingQuality=undefined;pendingResize=false;
  if(nextQuality)setQuality(nextQuality);else if(resizeNeeded)engine.resize(tier,capture);
  if(ready)draw(time);
 }
}};
Object.assign(window,{lastLightBay:api});
if(inspect){const panel=document.createElement('div');panel.id='review-controls';panel.style.cssText='position:absolute;top:12px;right:12px;display:flex;flex-wrap:wrap;gap:4px;max-width:340px;justify-content:flex-end';for(const name of Object.keys(evaluationCameras)){const b=document.createElement('button');b.textContent=name;b.style.cssText='font-size:11px;padding:5px;min-height:25px';b.onclick=()=>{if(capturing)return;setPlaying(false);api.setCamera(name)};panel.append(b)}const download=document.createElement('button');download.textContent='Save 4K frame';download.onclick=async()=>{if(download.disabled)return;download.disabled=true;const filename=(evalName||'flight-'+time.toFixed(2))+'.png';try{const blob=await api.capture();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);download.textContent='Save 4K frame'}catch{download.textContent='Frame unavailable — try again'}finally{download.disabled=false}};panel.append(download);const modes=['beauty','albedo','normals','roughness','depth','direct light','environment','shadows','LOD','shore depth','foam','exposure','vegetation density'];const select=document.createElement('select');select.setAttribute('aria-label','Diagnostic view');select.style.cssText='color:white;background:#182b2d;padding:8px';modes.forEach((m,i)=>select.add(new Option(m,String(i))));select.onchange=()=>{if(!capturing)api.setDebug(Number(select.value))};panel.append(select);document.body.append(panel)}
draw(time);window.addEventListener('pageshow',event=>{if(event.persisted){last=0;if(!capture)raf=requestAnimationFrame(loop);if(capturing){pendingResize=true;return}draw(time)}});window.addEventListener('pagehide',event=>{cancelAnimationFrame(raf);if(event.persisted){setPlaying(false);audio.pause();el('sound').textContent='Sound off';el('sound').setAttribute('aria-pressed','false');return}audio.dispose();disposeFarCrownBlending();linearMain.dispose();vegetation.disposeVisibility();terrainShadowStudy?.dispose();atmosphere.dispose();refraction.dispose();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),texturesToDispose=new Set<THREE.Texture>(Object.values(textures));scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){if(o instanceof THREE.InstancedMesh)o.dispose();geometries.add(o.geometry);if(o.customDepthMaterial)materials.add(o.customDepthMaterial);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const texture of m.userData.sharedShaderTextures??[])if(texture instanceof THREE.Texture)texturesToDispose.add(texture);for(const value of Object.values(m))if(value instanceof THREE.Texture)texturesToDispose.add(value)}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>{if(m instanceof THREE.ShaderMaterial)for(const uniform of Object.values(m.uniforms))if(uniform.value instanceof THREE.Texture)texturesToDispose.add(uniform.value);m.dispose()});for(const atlas of vegetation.farTextures){texturesToDispose.add(atlas.albedo);texturesToDispose.add(atlas.normals);texturesToDispose.add(atlas.visibility)}texturesToDispose.forEach(t=>t.dispose());renderer.dispose()});}
start().catch(e=>{console.error(e);failure('The scene could not load. '+String(e))});
