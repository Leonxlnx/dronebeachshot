import fs from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {integrate,insertPNGCell,insertVisibilityCell} from './encode.mjs';

const args={};
for(let i=2;i<process.argv.length;i+=2){if(!process.argv[i].startsWith('--')||process.argv[i+1]===undefined)throw Error('Use --name value arguments');args[process.argv[i].slice(2)]=process.argv[i+1];}
const root=path.resolve(args.root||fileURLToPath(new URL('../../',import.meta.url)));
const family=args.family||'island',form=args.form||'base',mode=args.mode||'smoke';
if(!['island','syringa'].includes(family)||!['smoke','atlas'].includes(mode))throw Error('Invalid family or mode');
if(form!=='base'&&(!args['form-module']||family!=='island'))throw Error('Nonbase Island form requires --form-module');
const output=path.resolve(args.output||path.join(root,'artifacts/tree-form-authoring',`${family}-${form}-${mode}`));
const cellSize=Number(args.cell||(mode==='atlas'?256:64));
const visibilityCell=Number(args['visibility-cell']||(mode==='atlas'?128:64));
const supersample=Number(args.supersample||(mode==='atlas'?4:2)),samples=4;
for(const v of [cellSize,visibilityCell,supersample])if(!Number.isInteger(v)||v<1)throw Error('Positive integral render dimensions required');
const parseFrames=(s,max)=>{const a=s.split(',').map(Number);if(a.some(v=>!Number.isInteger(v)||v<0||v>=max)||new Set(a).size!==a.length)throw Error('Invalid frame indices');return a;};
const views=parseFrames(args.views||(mode==='atlas'?Array.from({length:24},(_,i)=>i).join(','):'0,8,16'),24);
const suns=parseFrames(args.suns||(mode==='atlas'?'0,1,2,3,4,5,6,7':'0,4'),8);
const complete=views.length===24&&suns.length===8;
let runtimeCompatible=complete&&cellSize===256&&visibilityCell===128&&supersample===4;
const nativeRequire=createRequire(path.join(root,'docs/native-render/package.json'));
const nodeGles=nativeRequire('node-gles-webgl2'),sharp=nativeRequire('sharp');
const THREE=await import(pathToFileURL(path.join(root,'node_modules/three/build/three.module.js')));
const {GLTFLoader}=await import(pathToFileURL(path.join(root,'node_modules/three/examples/jsm/loaders/GLTFLoader.js')));
const {wrapNativeGL}=await import(pathToFileURL(path.join(root,'docs/native-render/native-gl-compat.mjs')));
const {installNativeAssetLoaders}=await import(pathToFileURL(path.join(root,'docs/native-render/native-asset-adapter.mjs')));
const {prepareTreeMaterial}=await import(pathToFileURL(path.join(root,'src/render/vegetation-material.ts')));
const {diagnosticFragment}=await import(pathToFileURL(path.join(root,'src/render/diagnostics.ts')));
const {worldTime}=await import(pathToFileURL(path.join(root,'src/render/materials.ts')));worldTime.value=0;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function attributeBytes(attribute){
 const packed=new Float32Array(attribute.count*attribute.itemSize);
 for(let i=0;i<attribute.count;i++)for(let c=0;c<attribute.itemSize;c++)packed[i*attribute.itemSize+c]=attribute.getComponent(i,c);
 return Buffer.from(packed.buffer);
}
const sourceFile=path.join(root,`public/assets/models/${family}-tree-near.glb`);
const sourceSHA256=hash(await fs.readFile(sourceFile));
const sourceHashes={};
for(const folder of ['world','render'])for(const name of (await fs.readdir(path.join(root,'src',folder))).sort())if(name.endsWith('.ts')&&!name.endsWith('.test.ts'))sourceHashes[`src/${folder}/${name}`]=hash(await fs.readFile(path.join(root,'src',folder,name)));
for(const filename of ['docs/native-render/native-gl-compat.mjs','docs/native-render/native-asset-adapter.mjs','scripts/control/ts-resolve.mjs','node_modules/three/package.json'])sourceHashes[filename]=hash(await fs.readFile(path.join(root,filename)));
const toolHashes={};for(const filename of ['bake-tree.mjs','encode.mjs'])toolHashes[filename]=hash(await fs.readFile(new URL(filename,import.meta.url)));
// Record the actual recursive local import closure separately from the broad
// checkout snapshot: unrelated runtime integration may proceed during a bake.
const bakeSourceHashes={};
async function recordImports(filename){
 const key=path.relative(root,filename);if(bakeSourceHashes[key])return;
 const bytes=await fs.readFile(filename),source=bytes.toString();bakeSourceHashes[key]=hash(bytes);
 for(const match of source.matchAll(/(?:import|export)\s[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)){
  if(!match[1].startsWith('.'))continue;
  let dependency=path.resolve(path.dirname(filename),match[1]);if(!path.extname(dependency))dependency+='.ts';
  await recordImports(dependency);
 }
}
for(const filename of ['src/render/vegetation-material.ts','src/render/diagnostics.ts','src/render/materials.ts'])await recordImports(path.join(root,filename));
let applyForm=null,formModule=null;
if(args['form-module']){
 const filename=path.resolve(args['form-module']),module=await import(pathToFileURL(filename));
 const exportName=args['form-export']||'applyIslandTreeForm';
 if(typeof module[exportName]!=='function')throw Error('Missing geometry form export');
 applyForm=module[exportName];formModule={file:filename,sha256:hash(await fs.readFile(filename)),exportName};
 if(args['expect-form-sha']&&formModule.sha256!==args['expect-form-sha'])throw Error('Form source hash differs from frozen authoring input');
}
await fs.mkdir(output,{recursive:true});
try{await fs.access(path.join(output,'manifest.json'));throw Error('Output already has a completed manifest; choose a new directory');}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({complete:false,runtimeCompatible:false,state:'preparing',sourceFile,sourceSHA256,formModule,bakeSourceHashes,toolHashes},null,2)+'\n');
const started=performance.now(),adapter=installNativeAssetLoaders({THREE,GLTFLoader,publicRoot:path.join(root,'public'),sharp});
const gltf=await new GLTFLoader().loadAsync(pathToFileURL(sourceFile).href);gltf.scene.updateMatrixWorld(true);
const scale=family==='island'?18/3.4:14/4.556740965694189;
const scene=new THREE.Scene(),tree=new THREE.Group();scene.add(tree);
const bounds=new THREE.Box3(),originalBounds=new THREE.Box3(),parts=[],height={value:1};
gltf.scene.traverse(object=>{
 if(!object.isMesh)return;
 if(Array.isArray(object.material))throw Error('Expected glTF material per primitive');
 const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);geometry.scale(scale,scale,scale);geometry.computeBoundingBox();originalBounds.union(geometry.boundingBox);
 const before={position:hash(attributeBytes(geometry.attributes.position)),normal:hash(attributeBytes(geometry.attributes.normal))};
 const sourceVertices=geometry.attributes.position.count,sourceTriangles=(geometry.index?.count||sourceVertices)/3;
 // All source materials now receive exactly the same continuous position
 // field. The rejected rigid leaf option is deliberately absent.
 try{if(applyForm)applyForm(geometry,form);}catch(error){
  writeFileSync(path.join(output,'failure.json'),JSON.stringify({complete:false,stage:'source-form-preparation',material:object.material.name,error:String(error),stack:error.stack,formModule,sourceFile,sourceSHA256,toolHashes,sourceHashes,sourceVertices,sourceTriangles},null,2)+'\n');
  throw new Error(`Tree form failed for ${object.material.name}: ${error.message}`,{cause:error});
 }
 geometry.computeBoundingBox();bounds.union(geometry.boundingBox);
 const {material,depth}=prepareTreeMaterial(object.material,-1,{height,thinLeaf:object.material.alphaTest>0});
 const mesh=new THREE.Mesh(geometry,material);mesh.customDepthMaterial=depth;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;tree.add(mesh);
 const textureInfo={};for(const [name,texture] of Object.entries(material))if(texture?.isTexture)textureInfo[name]={name:texture.name,width:texture.image?.width,height:texture.image?.height,colorSpace:texture.colorSpace,flipY:texture.flipY,channel:texture.channel,offset:texture.offset.toArray(),repeat:texture.repeat.toArray(),rotation:texture.rotation};
 parts.push({mesh,source:object.material,stats:{name:object.name,material:object.material.name,sourceVertices,sourceTriangles,vertices:geometry.attributes.position.count,triangles:(geometry.index?.count||geometry.attributes.position.count)/3,formAddedTriangles:geometry.userData.treeFormAddedTriangles??0,alphaTest:material.alphaTest,alphaHash:material.alphaHash,side:material.side,textures:textureInfo,baseGeometrySHA256:before,formGeometrySHA256:{position:hash(attributeBytes(geometry.attributes.position)),normal:hash(attributeBytes(geometry.attributes.normal))}}});
 object.geometry.dispose();
});
height.value=bounds.max.y;
const center=bounds.getCenter(new THREE.Vector3()),halfSize=bounds.getBoundingSphere(new THREE.Sphere()).radius*1.1;
let frameCenter=center.clone(),frameHalfSize=halfSize,frameMetadata=null;
if(args['frame-metadata']){
 const filename=path.resolve(args['frame-metadata']),bytes=await fs.readFile(filename),metadata=JSON.parse(bytes);
 if(!Array.isArray(metadata.center)||metadata.center.length!==3||!metadata.center.every(Number.isFinite)||!Number.isFinite(metadata.halfSize)||metadata.halfSize<=0)throw Error('Invalid frame metadata');
 frameCenter.fromArray(metadata.center);frameHalfSize=metadata.halfSize;frameMetadata={file:filename,sha256:hash(bytes)};
 if(!frameCenter.equals(center)||frameHalfSize!==halfSize)runtimeCompatible=false;
}
const shaderErrors=[],passUniform={value:0};
for(const {mesh} of parts){
 const material=mesh.material,previous=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey.bind(material);
 material.fog=false;material.toneMapped=false;
 material.onBeforeCompile=(shader,renderer)=>{
  previous(shader,renderer);shader.uniforms.uBakePass=passUniform;
  // Remove only diagnostic outputs: diagnostic mode 7 expects full-world
  // atmosphere bindings. Keep production map, alpha, wind and normal shaders.
  if(!shader.fragmentShader.includes(diagnosticFragment))throw Error('Production diagnostic hook changed');
  shader.fragmentShader=shader.fragmentShader.replace(diagnosticFragment,'')
   .replace('#include <common>','#include <common>\nuniform float uBakePass;')
   .replace('#include <opaque_fragment>',`#include <opaque_fragment>
    if(uBakePass<.5)gl_FragColor=vec4(diffuseColor.rgb,1.);
    else if(uBakePass<1.5)gl_FragColor=vec4(inverseTransformDirection(normal,viewMatrix)*.5+.5,1.);
    else gl_FragColor=vec4(vec3(getShadowMask()),1.);`);
 };
 material.customProgramCacheKey=()=>key()+'-isolated-tree-baker-v1';
}
const maxDimension=Math.max(cellSize,visibilityCell)*supersample;
const gl=wrapNativeGL(nodeGles.createWebGLRenderingContext({width:maxDimension,height:maxDimension,majorVersion:3,minorVersion:0}));
const canvas={width:maxDimension,height:maxDimension,style:{},addEventListener(){},removeEventListener(){},setAttribute(){},getContext(type){return type==='webgl2'?gl:null;}};gl.canvas=canvas;
const renderer=new THREE.WebGLRenderer({canvas,context:gl,alpha:true,premultipliedAlpha:false,antialias:false});
renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.setClearColor(0,0);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{shaderErrors.push([gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)].filter(Boolean).join('\n'));};
const sun=new THREE.DirectionalLight(0xffffff,1);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:.1,far:200});sun.shadow.camera.updateProjectionMatrix();
sun.shadow.normalBias=.025;sun.shadow.bias=-.00002;sun.shadow.radius=1;sun.target.position.copy(frameCenter);scene.add(sun,sun.target);
const sunElevation=6.021653966*Math.PI/180;
function setSun(frame){const azimuth=frame*Math.PI/4;sun.position.copy(frameCenter).addScaledVector(new THREE.Vector3(Math.sin(azimuth)*Math.cos(sunElevation),Math.sin(sunElevation),Math.cos(azimuth)*Math.cos(sunElevation)),100);sun.updateMatrixWorld();sun.target.updateMatrixWorld();renderer.shadowMap.needsUpdate=true;}
setSun(0);
const camera=new THREE.OrthographicCamera(-frameHalfSize,frameHalfSize,frameHalfSize,-frameHalfSize,.1,240);
const targets=new Map();
function targetFor(cell){if(!targets.has(cell))targets.set(cell,new THREE.WebGLRenderTarget(cell*supersample,cell*supersample,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,colorSpace:THREE.LinearSRGBColorSpace,samples,depthBuffer:true,generateMipmaps:false}));return targets.get(cell);}
const records=[],coverageByView=new Map(),atlasColor=new Uint8Array(8*cellSize*3*cellSize*4),atlasNormal=new Uint8Array(atlasColor.length),atlasVisibility=new Uint8Array(8*visibilityCell*24*visibilityCell*2);
let maxRss=process.memoryUsage().rss;
const fileEvidence=[];
async function save(name,bytes){await fs.writeFile(path.join(output,name),bytes);fileEvidence.push({file:name,bytes:bytes.byteLength,sha256:hash(bytes)});}
async function png(name,bytes,width,height,channels,bottomFirst=true){let pipeline=sharp(bytes,{raw:{width,height,channels}});if(bottomFirst)pipeline=pipeline.flip();await save(name,await pipeline.png().toBuffer());}
async function renderCell(view,pass,sunFrame=null){
 const start=performance.now(),row=Math.floor(view/8),column=view%8,azimuth=column*Math.PI/4,elevation=row*35*Math.PI/180;
 camera.position.copy(frameCenter).addScaledVector(new THREE.Vector3(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation)),120);camera.lookAt(frameCenter);camera.updateMatrixWorld();
 const cell=pass==='visibility'?visibilityCell:cellSize,target=targetFor(cell),dimension=cell*supersample;passUniform.value={albedo:0,normal:1,visibility:2}[pass];
 renderer.setRenderTarget(target);renderer.clear(true,true,true);renderer.render(scene,camera);renderer.setRenderTarget(null);gl.finish();
 if(shaderErrors.length)throw Error(shaderErrors.join('\n'));
 const half=new Uint16Array(dimension*dimension*4);renderer.readRenderTargetPixels(target,0,0,dimension,dimension,half);gl.finish();
 const glError=gl.getError();if(glError!==gl.NO_ERROR)throw Error('Native GL error '+glError);
 const linear=Float32Array.from(half,THREE.DataUtils.fromHalfFloat);
 const cellData=integrate(linear,dimension,dimension,supersample,pass);
 if(cellData.stats.coveragePixels<=0)throw Error('Empty source silhouette');
 const coverageSHA256=hash(cellData.coverage),coverageKey=`${cell}-${view}`;
 if(coverageByView.has(coverageKey)&&coverageByView.get(coverageKey)!==coverageSHA256)throw Error(`Coverage differs between passes or sunlight at view ${view}`);
 coverageByView.set(coverageKey,coverageSHA256);
 const prefix=`${pass}-view-${String(view).padStart(2,'0')}${sunFrame===null?'':`-sun-${sunFrame}`}`;
 // Keep exact linear source readback for provenance, downsampling audits and
 // quantitative comparisons. This is not an sRGB image or an output atlas.
 await save(prefix+'.rgba16f',Buffer.from(half.buffer));
 if(pass==='visibility'){
  await save(prefix+'.rg8',cellData.bytes);const preview=new Uint8Array(cell*cell*4);
  for(let i=0;i<cell*cell;i++){const r=cellData.bytes[i*2],a=cellData.bytes[i*2+1],v=a?Math.round(r/a*255):0;preview.set([v,v,v,a],i*4);}
  await png(prefix+'.png',preview,cell,cell,4);insertVisibilityCell(atlasVisibility,cellData.bytes,column,row,sunFrame,cell);
 }else{
  await png(prefix+'.png',cellData.bytes,cell,cell,4);insertPNGCell(pass==='albedo'?atlasColor:atlasNormal,cellData.bytes,column,row,cell);
 }
 maxRss=Math.max(maxRss,process.memoryUsage().rss);
 const record={view,column,row,azimuthDegrees:column*45,elevationDegrees:row*35,cameraPosition:camera.position.toArray(),cameraTarget:frameCenter.toArray(),pass,sunFrame,cellPixels:cell,renderPixels:dimension,samples,coverageSHA256,linearSHA256:hash(Buffer.from(half.buffer)),...cellData.stats,coverageSquareMeters:cellData.stats.coveragePixels*(2*frameHalfSize/cell)**2,glError,renderMilliseconds:Math.round(performance.now()-start),rss:process.memoryUsage().rss};records.push(record);
 await fs.writeFile(path.join(output,'progress.json'),JSON.stringify({complete:false,family,form,completed:records.length,expected:views.length*(2+suns.length),records,shaderErrors},null,2)+'\n');
 console.log(JSON.stringify({pass,view,sunFrame,coverage:cellData.stats.coveragePixels,visibility:cellData.stats.weightedMeanVisibility,milliseconds:record.renderMilliseconds,rss:record.rss}));
}
try{
 for(const view of views){await renderCell(view,'albedo');await renderCell(view,'normal');}
 for(const sunFrame of suns){setSun(sunFrame);for(const view of views)await renderCell(view,'visibility',sunFrame);}
 for(const [filename,digest] of Object.entries(bakeSourceHashes))if(hash(await fs.readFile(path.join(root,filename)))!==digest)throw Error('Active bake dependency changed during rendering: '+filename);
 if(formModule&&hash(await fs.readFile(formModule.file))!==formModule.sha256)throw Error('Form changed during rendering');
 if(hash(await fs.readFile(sourceFile))!==sourceSHA256)throw Error('Source GLB changed during rendering');
 if(complete){
  await png(`${family}-${form}-albedo.png`,atlasColor,8*cellSize,3*cellSize,4,false);
  await png(`${family}-${form}-normal.png`,atlasNormal,8*cellSize,3*cellSize,4,false);
  await save(`${family}-${form}-visibility.rg8`,atlasVisibility);
 }
 const manifest={method:'Native Three source geometry bake; no browser or consumer-GPU validation',complete,runtimeCompatible,family:family==='island'?0:1,name:`${family}-${form}`,form,formModule,sourceFile,sourceSHA256,sourceTriangles:parts.reduce((n,p)=>n+p.stats.sourceTriangles,0),renderedTriangles:parts.reduce((n,p)=>n+p.stats.triangles,0),scale,center:center.toArray(),halfSize,captureFrame:{center:frameCenter.toArray(),halfSize:frameHalfSize,metadata:frameMetadata},bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},baseBounds:{min:originalBounds.min.toArray(),max:originalBounds.max.toArray()},columns:8,rows:3,cellPixels:cellSize,visibilityCellPixels:visibilityCell,supersampleLinearFactor:supersample,nativeSamples:samples,worldTime:0,albedoColorSpace:'sRGB after linear sample integration, straight color plus fractional coverage; source maps alpha-weighted in linear space before mip filtering',normalSpace:'Root-local visible-face shading normal including source normal maps, linear coverage-weighted mean direction renormalized per texel, encoded and stored straight with fractional coverage; runtime alpha-weights then normalizes',atlasOrigin:'PNG top-first, elevation rows 0/35/70, azimuth columns 0 through315; camera +Z at azimuth0, positive toward +X',visibility:{width:8*visibilityCell,height:24*visibilityCell,format:'RG8',origin:'bottom-first, flipY=false; blockRow=sunFrame*3+2-cameraRow',red:'visibility times silhouette coverage',green:'silhouette coverage',sunElevationDegrees:6.021653966,sunAzimuthDegrees:suns.map(v=>v*45),shadow:{type:'PCFShadowMap',size:1024,footprint:50,normalBias:.025,bias:-.00002,radius:1,near:.1,far:200,lightDistance:100,target:frameCenter.toArray()}},parts:parts.map(p=>p.stats),sourceHashes,bakeSourceHashes,toolHashes,threeRevision:THREE.REVISION,nativeVersions:{gles:nativeRequire('node-gles-webgl2/package.json').version,sharp:sharp.versions},assetAdapter:adapter.metrics,renderer:gl.getParameter(gl.RENDERER),shaderErrors,glError:gl.getError(),renderMilliseconds:Math.round(performance.now()-started),maxRss,records,files:fileEvidence,limits:['Static self-shadow at world time zero and fixed sun elevation; root position, wind, tilt and nonuniform instance scale are not rebaked.','Exact pixel identity to the missing original baker is not claimed; old lighting-frustum defaults were not all retained.','No far-LOD runtime, integrated forest or artistic acceptance is established by authoring alone.']};
 if(manifest.glError!==0)throw Error('Final native GL error '+manifest.glError);
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({done:true,output,complete,runtimeCompatible,frames:records.length,maxRss,milliseconds:manifest.renderMilliseconds}));
}catch(error){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({complete:false,error:String(error),stack:error.stack,shaderErrors,records,sourceSHA256,formModule,toolHashes},null,2)+'\n');throw error;}
finally{for(const target of targets.values())target.dispose();for(const {mesh} of parts){mesh.geometry.dispose();mesh.material.dispose();mesh.customDepthMaterial.dispose();}renderer.dispose();adapter.restore();gl.destroy();}
