// Native visual diagnostics of the actual production world modules.
// This is not browser/mobile QA and does not establish consumer GPU performance.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import nodeGles from 'node-gles-webgl2';
import sharp from 'sharp';
import {installNativeAssetLoaders} from './native-asset-adapter.mjs';
import {wrapNativeGL} from './native-gl-compat.mjs';

const root='/workspace/sites/last-light-bay';
const THREE=await import(pathToFileURL(root+'/node_modules/three/build/three.module.js'));
const {GLTFLoader}=await import(pathToFileURL(root+'/node_modules/three/examples/jsm/loaders/GLTFLoader.js'));
const moduleAt=async p=>import(pathToFileURL(root+'/src/'+p+'.ts'));
const [{createEngine},{loadTextures},{createTerrain,createRocks},{createAtmosphere},
 {createCoastalField},{createOcean},{createRockSpray},{createGroundCover},
 {createForestFloor},{createForestStructure},{createVegetation},
 {worldTime,debugMode,createGroundWindDepth},{applyCinematic,evaluationCameras},
 {enableMaterialDiagnostics},{withCloudLighting},{createRefractionPass}]=await Promise.all([
 'render/engine','world/assets','world/terrain','world/atmosphere','world/coastal-field',
 'world/ocean','world/spray','world/plants','world/forest-floor','world/forest-structure',
 'world/vegetation','render/materials','camera/cinematic','render/diagnostics',
 'render/sky-lighting','render/refraction'].map(moduleAt));
const assetAdapter=await installNativeAssetLoaders({THREE,GLTFLoader,publicRoot:root+'/public',sharp});
const cameraName=process.argv[2]||'mountain-wide';
const width=Number(process.argv[3]||640),height=Math.round(width*9/16);
const mode=Number(process.argv[4]||0);
const output=path.resolve(process.env.BAY_OUTPUT_DIR||'frames');await fs.mkdir(output,{recursive:true});
const log=(...args)=>console.log(new Date().toISOString(),...args);
const gl=wrapNativeGL(nodeGles.createWebGLRenderingContext({width,height,majorVersion:3,minorVersion:0}));
const canvas={width,height,style:{},addEventListener(){},removeEventListener(){},setAttribute(){},getContext(type){return type==='webgl2'?gl:null;}};
gl.canvas=canvas;
const engine=createEngine(canvas),{renderer,scene,camera}=engine;
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
scene.add(createTerrain(textures));
const rocks=createRocks(textures);scene.add(rocks);
const field=createCoastalField(rocks);log('coastal field ready');
const atmosphere=createAtmosphere(renderer);scene.add(atmosphere.group);
const ocean=createOcean(field);scene.add(ocean.group);
const spray=createRockSpray(field);scene.add(spray);
const cover=createGroundCover(textures);scene.add(cover);
const vegetation=await createVegetation(progress);scene.add(vegetation.group);
cover.add(createForestFloor(textures,vegetation.placements));
const forestStructure=createForestStructure(textures,vegetation.placements);cover.add(forestStructure.group);
scene.traverse(o=>{if(o instanceof THREE.Mesh&&o.castShadow&&o.material instanceof THREE.MeshStandardMaterial&&typeof o.material.userData.windBark==='boolean')o.customDepthMaterial=createGroundWindDepth(o.material)});
const materials=new Set();scene.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial&&!materials.has(m)){enableMaterialDiagnostics(m);withCloudLighting(m);materials.add(m)}});
vegetation.setTier('high');atmosphere.sun.shadow.mapSize.setScalar(2048);
const choice=evaluationCameras[cameraName];
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
refraction.render(scene,camera,ocean.group,spray);renderer.render(scene,camera);
gl.finish();
const errors=engine.shaderErrors;
if(errors.length){await fs.writeFile(path.join(output,cameraName+'-shader-errors.json'),JSON.stringify(shaderDetails,null,2));throw Error(errors.join('\n'))}
const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
const glError=gl.getError();if(glError!==gl.NO_ERROR)throw Error('Native GL error '+glError);
const filename=path.join(output,`${cameraName}-mode-${mode}-${width}.png`);
await sharp(pixels,{raw:{width,height,channels:4}}).flip().removeAlpha().png().toFile(filename);
const info={method:'Native ANGLE execution of production Three.js modules, software graphics; not browser QA or consumer FPS',camera:cameraName,time,width,height,debugMode:mode,renderer:gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),trees:vegetation.count,cells:vegetation.cells,render:renderer.info.render,memory:renderer.info.memory,programs:renderer.info.programs.length,assetMetrics:assetAdapter.metrics,shaderErrors:errors,glError,at:new Date().toISOString(),sourceHashes:{}};
for(const folder of ['world','render','camera'])for(const name of await fs.readdir(root+'/src/'+folder))if(name.endsWith('.ts')&&!name.endsWith('.test.ts'))info.sourceHashes[folder+'/'+name]=crypto.createHash('sha256').update(await fs.readFile(root+'/src/'+folder+'/'+name)).digest('hex');
await fs.writeFile(filename+'.json',JSON.stringify(info,null,2)+'\n');log('saved',filename,info.render);
atmosphere.dispose();refraction.dispose();renderer.dispose();gl.destroy();
