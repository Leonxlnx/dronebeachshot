// Native visual diagnostics of the actual production world modules.
// This is not browser/mobile QA and does not establish consumer GPU performance.
import fs from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import nodeGles from 'node-gles-webgl2';
import sharp from 'sharp';
import {installNativeAssetLoaders} from './native-asset-adapter.mjs';
import {wrapNativeGL} from './native-gl-compat.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
const THREE=await import(pathToFileURL(root+'/node_modules/three/build/three.module.js'));
const {GLTFLoader}=await import(pathToFileURL(root+'/node_modules/three/examples/jsm/loaders/GLTFLoader.js'));
const {OutputPass}=await import(pathToFileURL(root+'/node_modules/three/examples/jsm/postprocessing/OutputPass.js'));
const moduleAt=async p=>import(p==='world/terrain'&&process.env.BAY_TERRAIN_CANDIDATE?new URL(process.env.BAY_TERRAIN_CANDIDATE,import.meta.url):pathToFileURL(root+'/src/'+p+'.ts'));
const [{createEngine},{loadTextures},{createTerrain,createRocks},{createAtmosphere},
 {createCoastalField},{createOcean},{createRockSpray},{createGroundCover},
 {createForestFloor},{createForestStructure},{createVegetation},
 {worldTime,debugMode,createGroundWindDepth},{applyCinematic,evaluationCameras},
 {enableMaterialDiagnostics},{withCloudLighting},{createRefractionPass}]=await Promise.all([
 'render/engine','world/assets','world/terrain','world/atmosphere','world/coastal-field',
 'world/ocean','world/spray','world/plants','world/forest-floor','world/forest-structure',
 'world/vegetation','render/materials','camera/cinematic','render/diagnostics',
 'render/sky-lighting','render/refraction'].map(moduleAt));
const {withAerialPerspective}=await moduleAt('render/aerial-perspective');
const {createDetailedRocks,ROCK_VISUAL_URL}=await moduleAt('world/detailed-rocks');
const sourceHashes={};
for(const folder of ['world','render','camera'])for(const name of await fs.readdir(root+'/src/'+folder))if(name.endsWith('.ts')&&!name.endsWith('.test.ts'))sourceHashes[folder+'/'+name]=crypto.createHash('sha256').update(await fs.readFile(root+'/src/'+folder+'/'+name)).digest('hex');
sharp.concurrency(2);sharp.cache({memory:32,files:0,items:20});
const assetAdapter=await installNativeAssetLoaders({THREE,GLTFLoader,publicRoot:root+'/public',sharp});
// Production byte atlases use fetch; adapt only local asset I/O for native QA.
const browserFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 if(typeof input==='string'&&input.startsWith('/assets/'))return new Response(await fs.readFile(root+'/public'+input));
 return browserFetch(input,init);
};
const cameraNames=(process.argv[2]||'mountain-wide').split(',').map(name=>name.trim()).filter(Boolean);
// Extra diagnostic framing never changes the sixteen production evaluation views.
const customCameras={};
if(process.env.BAY_REVIEW_CAMERAS){
 for(const [name,view] of Object.entries(JSON.parse(await fs.readFile(process.env.BAY_REVIEW_CAMERAS,'utf8')))){
  if(evaluationCameras[name]||!/^[a-z][a-z0-9-]*$/.test(name))throw Error('Invalid or reserved review camera '+name);
  for(const key of ['position','target'])if(!Array.isArray(view[key])||view[key].length!==3||!view[key].every(Number.isFinite))throw Error('Invalid review '+key);
  customCameras[name]={time:view.time,position:new THREE.Vector3(...view.position),target:new THREE.Vector3(...view.target)};
 }
}
if(!cameraNames.length)throw Error('Provide at least one camera');
for(const name of cameraNames){
 const time=(customCameras[name]??evaluationCameras[name])?.time??(/^(?:flight-)?[0-9]+(?:\.[0-9]+)?$/.test(name)?Number(name.replace('flight-','')):NaN);
 if(!Number.isFinite(time)||time<0||time>20)throw Error('Unknown camera or time outside 0–20: '+name);
}
const width=Number(process.argv[3]||640),height=Math.round(width*9/16);
const mode=Number(process.argv[4]||0);
const output=path.resolve(process.env.BAY_OUTPUT_DIR||'frames');await fs.mkdir(output,{recursive:true});
const outputPrefix=process.env.BAY_OUTPUT_PREFIX||'';
if(outputPrefix.includes('/')||outputPrefix.includes('\\'))throw Error('BAY_OUTPUT_PREFIX must be a filename prefix');
let lastPhase='initializing';
process.on('exit',code=>writeFileSync(path.join(output,'process-exit.json'),JSON.stringify({code,lastPhase,at:new Date().toISOString()})));
const log=(...args)=>{lastPhase=String(args[0]);console.log(new Date().toISOString(),...args);};
const gl=wrapNativeGL(nodeGles.createWebGLRenderingContext({width,height,majorVersion:3,minorVersion:0}));
const canvas={width,height,style:{},addEventListener(){},removeEventListener(){},setAttribute(){},getContext(type){return type==='webgl2'?gl:null;}};
gl.canvas=canvas;
const engine=createEngine(canvas),{renderer,scene,camera}=engine;
// Explicit offscreen MSAA is necessary for native diagnostics: this surfaceless
// context has an unmultisampled default buffer even when the engine requests AA.
// This only changes the diagnostic framebuffer, never scene shaders or assets.
const requestedSamples=Number(process.env.BAY_NATIVE_SAMPLES||0);
if(![0,2,4,8].includes(requestedSamples))throw Error('Unsupported BAY_NATIVE_SAMPLES');
const nativeSamples=Math.min(requestedSamples,gl.getParameter(gl.MAX_SAMPLES));
const reviewTarget=nativeSamples?new THREE.WebGLRenderTarget(width,height,{
 type:THREE.HalfFloatType,format:THREE.RGBAFormat,colorSpace:THREE.LinearSRGBColorSpace,
 samples:nativeSamples,depthBuffer:true,generateMipmaps:false
}):null;
const reviewOutput=reviewTarget?new OutputPass():null;
if(reviewOutput)reviewOutput.renderToScreen=true;
const nativeCoverage=process.env.BAY_NATIVE_COVERAGE==='samples'&&nativeSamples>0;
const {setFoliageMultisampling}=await moduleAt('render/vegetation-material');
setFoliageMultisampling(nativeCoverage);
const shaderDetails=[];
const onShaderError=renderer.debug.onShaderError;
renderer.debug.onShaderError=(context,program,vertex,fragment)=>{
  onShaderError(context,program,vertex,fragment);
  shaderDetails.push({program:context.getProgramInfoLog(program),vertexLog:context.getShaderInfoLog(vertex),fragmentLog:context.getShaderInfoLog(fragment),vertex:context.getShaderSource(vertex),fragment:context.getShaderSource(fragment)});
};
renderer.setPixelRatio(1);renderer.setSize(width,height,false);
camera.aspect=width/height;camera.updateProjectionMatrix();
renderer.shadowMap.autoUpdate=false;
const refraction=createRefractionPass(renderer);
log('renderer',gl.getParameter(gl.RENDERER),gl.getParameter(gl.VERSION));
const progress=(p,label)=>log(p,label);
const textures=await loadTextures(progress);
const terrain=createTerrain(textures);scene.add(terrain);
const rockSource=await new GLTFLoader().loadAsync(ROCK_VISUAL_URL);
const rocks=createDetailedRocks(textures,rockSource.scene);scene.add(rocks);
const field=createCoastalField(rocks);log('coastal field ready');
const atmosphere=createAtmosphere(renderer);scene.add(atmosphere.group);
const ocean=createOcean(field,terrain);scene.add(ocean.group);
const spray=createRockSpray(field);scene.add(spray);
const cover=createGroundCover(textures);scene.add(cover);
const vegetation=await createVegetation(progress,terrain);scene.add(vegetation.group);
cover.add(createForestFloor(textures,vegetation.placements));
const forestStructure=createForestStructure(textures,vegetation.placements);cover.add(forestStructure.group);
scene.traverse(o=>{if(o instanceof THREE.Mesh&&o.castShadow&&o.material instanceof THREE.MeshStandardMaterial&&typeof o.material.userData.windBark==='boolean')o.customDepthMaterial=createGroundWindDepth(o.material)});
const fogCandidate=process.env.BAY_FOG_CANDIDATE?await import(new URL(process.env.BAY_FOG_CANDIDATE,import.meta.url)):null;
const materials=new Set();scene.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial&&!materials.has(m)){enableMaterialDiagnostics(m);withCloudLighting(m);withAerialPerspective(m);fogCandidate?.applyHeightFog(m);materials.add(m)}});
vegetation.setTier('high');atmosphere.sun.shadow.mapSize.setScalar(2048);
const completed=[];
try {
 for(const [cameraIndex,cameraName] of cameraNames.entries()){
  log('batch camera',cameraIndex+1,'of',cameraNames.length,cameraName);
const choice=customCameras[cameraName]??evaluationCameras[cameraName];
const time=choice?choice.time:Number(cameraName.replace('flight-',''));
if(!Number.isFinite(time))throw Error('Unknown camera '+cameraName);
worldTime.value=time;
if(choice){camera.position.copy(choice.position);camera.up.set(0,1,0);camera.lookAt(choice.target);camera.fov=54;camera.updateProjectionMatrix()}
else applyCinematic(camera,time);
debugMode.value=mode;
vegetation.group.visible=mode!==12;rocks.visible=mode!==12;cover.visible=mode!==12;
atmosphere.sun.intensity=mode===6?0:atmosphere.lighting.sunIntensity;atmosphere.hemi.intensity=mode===5?0:atmosphere.lighting.skyIntensity;
renderer.shadowMap.enabled=mode!==6;
atmosphere.dome.visible=![1,2,3,4,7,8,9,10,11,12].includes(mode);
scene.background=new THREE.Color(mode===0||mode===5||mode===6?0xa4a89a:0x000000);
renderer.toneMappingExposure=mode===11?1:1.08;
vegetation.update(camera.position);
log('atmosphere render begin');atmosphere.update(renderer,camera.position,time);
scene.environment=mode===5?null:atmosphere.environment;scene.environmentIntensity=.65;
log('scene compile begin');await renderer.compileAsync(scene,camera);await refraction.compile(scene,camera);
log('scene render begin');renderer.info.reset();renderer.shadowMap.needsUpdate=true;
if(renderer.shadowMap.enabled)vegetation.prepareSunShadow(atmosphere.sun);
refraction.render(scene,camera,ocean.group,spray);
vegetation.prepareMain(camera);
renderer.setRenderTarget(reviewTarget);renderer.render(scene,camera);renderer.setRenderTarget(null);
if(reviewOutput)reviewOutput.render(renderer,null,reviewTarget);
gl.finish();
const errors=engine.shaderErrors;
if(errors.length){await fs.writeFile(path.join(output,outputPrefix+cameraName+'-shader-errors.json'),JSON.stringify(shaderDetails,null,2));throw Error(errors.join('\n'))}
const pixels=new Uint8Array(width*height*4);
gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
const glError=gl.getError();if(glError!==gl.NO_ERROR)throw Error('Native GL error '+glError);
const filename=path.join(output,`${outputPrefix}${cameraName}-mode-${mode}-${width}.png`);
await sharp(pixels,{raw:{width,height,channels:4}}).flip().removeAlpha().png().toFile(filename);
const candidateOverrides={fog:process.env.BAY_FOG_CANDIDATE||null,terrain:process.env.BAY_TERRAIN_CANDIDATE||null};
const info={candidateOverrides,method:'Native ANGLE execution of production Three.js modules, software graphics; not browser QA or consumer FPS',camera:cameraName,time,width,height,debugMode:mode,nativeSamples,nativeCoverage,nativeOutput:reviewTarget?'linear-half-float-MSAA + official OutputPass ACES/sRGB':'production-default-framebuffer',renderer:gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),trees:vegetation.count,cells:vegetation.cells,render:renderer.info.render,memory:renderer.info.memory,programs:renderer.info.programs.length,imageSharing:vegetation.imageSharing,offshoreRocks:rocks.userData.offshoreRocks?.instances??0,assetMetrics:assetAdapter.metrics,shaderErrors:errors,glError,at:new Date().toISOString(),sourceHashes,batchIndex:cameraIndex,batchCount:cameraNames.length};

info.cameraPose={position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,diagnosticOverride:!!customCameras[cameraName]};
await fs.writeFile(filename+'.json',JSON.stringify(info,null,2)+'\n');log('saved',filename,info.render);
completed.push({camera:cameraName,time,filename,render:{...info.render},programs:info.programs,glError});
await fs.writeFile(path.join(output,outputPrefix+'batch-progress.json'),JSON.stringify({completed,requested:cameraNames},null,2)+'\n');

 }
} finally {
 reviewOutput?.dispose();reviewTarget?.dispose();atmosphere.dispose();refraction.dispose();renderer.dispose();gl.destroy();assetAdapter.restore();globalThis.fetch=browserFetch;
}
