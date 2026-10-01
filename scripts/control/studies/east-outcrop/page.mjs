// LOCAL NO-CANOPY DIAGNOSTIC. This is not the production scene or acceptance.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {cropViews,createEastOutcropStudy,createStudyTile,setStudyCamera,clearSkyTexture} from '/study-helper.mjs';
import {loadTextures} from '/src/world/assets.ts';
import {terrainHeight,noise} from '/src/world/math.ts';
import {sampleCamera} from '/src/camera/cinematic.ts';
import {treePlacements} from '/src/world/ecology.ts';
import {updateHabitatCanopy} from '/src/world/habitat.ts';
import {decodeRockGeometrySource} from '/src/world/rock-geometry.ts';
import {createGroundMaterial,createRockMaterial} from '/src/render/ground-materials.ts';
import {worldTime} from '/src/render/materials.ts';
import {solarDirection,solarColor,solarIntensity,withCloudLighting,cloudShadow} from '/src/render/sky-lighting.ts';
import {withAerialPerspective} from '/src/render/aerial-perspective.ts';
import {waitForProfilingFence} from '/src/render/profiling-sync.ts';

window.runEastOutcropStudy=async()=>{
 const started=performance.now(),config=window.studyConfig;
 const assert=(value,message)=>{if(!value)throw Error(message);};
 const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
 const bytesOf=attribute=>new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength);
 const stage=async name=>{assert(performance.now()-started<180000,'In-page 180 second deadline');await window.studyStage(name);};
 await stage('Load exact original rock GLB and shared terrain textures; no forest geometry');
 const [bytes,packed,proposal,textures]=await Promise.all([
  fetch('/assets/rocks/rock_moss_set_01_2k.glb').then(r=>r.arrayBuffer()),
  fetch('/assets/rocks/rock_moss_set_01_geometry.bin').then(r=>r.arrayBuffer()),
  fetch('/proposal.json').then(r=>r.json()),loadTextures(()=>{}),
 ]);
 assert(await hash(bytes)===config.sourceSHA256,'Original GLB changed');
 assert(await hash(packed)===config.geometrySHA256,'Reviewed source geometry pack changed');
 const gltf=await new GLTFLoader().parseAsync(bytes,'/assets/rocks/');
 const study=createEastOutcropStudy(gltf.scene,proposal),packedSource=decodeRockGeometrySource(packed),packedMeshes=[...packedSource.children].sort((a,b)=>a.name.localeCompare(b.name));
 const sourceProof=[];
 for(const part of study.parts){
  const original=part.original.geometry,reference=packedMeshes[part.record.variant].geometry;
  for(const key of ['position','index']){
   const a=key==='index'?original.index:original.attributes.position,b=key==='index'?reference.index:reference.attributes.position;
   assert(await hash(bytesOf(a))===await hash(bytesOf(b)),'GLB/CPU source geometry differs: '+key);
  }
  const unchanged={};for(const [name,attribute]of Object.entries(original.attributes))if(name!=='position'){
   const before=await hash(bytesOf(attribute)),after=await hash(bytesOf(part.mesh.geometry.attributes[name]));assert(before===after,'Changed source '+name);unchanged[name]=before;
  }
  assert(await hash(bytesOf(original.index))===await hash(bytesOf(part.mesh.geometry.index)),'Changed source index');
  const box=new THREE.Box3(),point=new THREE.Vector3(),matrix=new THREE.Matrix4();part.mesh.getMatrixAt(0,matrix);
  assert(matrix.elements.every((v,i)=>v===part.record.matrix[i]),'Proposal Float32 matrix changed');
  for(let i=0;i<part.mesh.geometry.attributes.position.count;i++)box.expandByPoint(point.fromBufferAttribute(part.mesh.geometry.attributes.position,i).applyMatrix4(matrix));
  for(let axis=0;axis<3;axis++)for(const side of ['min','max'])assert(Math.abs(box[side].getComponent(axis)-part.record.actualBounds[side][axis])<.00001,'Actual source bounds changed');
  sourceProof.push({name:part.original.name,variant:part.record.variant,triangles:original.index.count/3,positionHash:await hash(bytesOf(original.attributes.position)),indexHash:await hash(bytesOf(original.index)),unchangedAttributes:unchanged,center:part.center.toArray(),matrix:matrix.elements,bounds:{min:box.min.toArray(),max:box.max.toArray()}});
 }
 const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('world'),alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
 renderer.setPixelRatio(1);renderer.setSize(128,128,false);renderer.setClearColor(0x9daca7,1);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
 const gl=renderer.getContext(),shaderErrors=[];
 renderer.debug.onShaderError=(g,p,v,f)=>shaderErrors.push([g.getProgramInfoLog(p),g.getShaderInfoLog(v),g.getShaderInfoLog(f)].filter(Boolean).join('\n'));
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x9daca7);scene.fog=new THREE.FogExp2(0x9daca7,.000065);
 const white=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);white.needsUpdate=true;cloudShadow.value=white;
 solarColor.value.set(0xffdfb6);solarIntensity.value=4.8;
 const sun=new THREE.DirectionalLight(0xffdfb6,4.8);sun.target.position.set(236,79,98);sun.position.copy(sun.target.position).addScaledVector(solarDirection.value,1000);
 sun.castShadow=true;sun.shadow.mapSize.set(512,512);Object.assign(sun.shadow.camera,{left:-95,right:95,top:95,bottom:-95,near:1,far:1800});sun.shadow.bias=-.00004;sun.shadow.normalBias=.25;
 scene.add(sun,sun.target,new THREE.HemisphereLight(0xa1c9ed,0x365842,.48));
 const sky=clearSkyTexture(solarDirection.value),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(sky);scene.environment=environment.texture;scene.environmentIntensity=.55;
 // CPU crown coverage is retained in the material field, despite omitting all
 // actual tree/wood geometry. This cannot prove canopy visibility or shadows.
 updateHabitatCanopy(treePlacements());
 const ground=createGroundMaterial(textures),bedrock=createRockMaterial(textures),neutral=new THREE.MeshStandardMaterial({color:new THREE.Color(.38,.38,.38),roughness:.9,metalness:0});
 for(const material of [ground,bedrock,neutral,study.material]){withCloudLighting(material);withAerialPerspective(material);}
 const tiles=[createStudyTile(0,0,ground,terrainHeight,noise),createStudyTile(1,0,ground,terrainHeight,noise)];scene.add(...tiles,study.group);
 const camera=new THREE.PerspectiveCamera(42,16/9,.4,22000),rows=[];
 await stage('One 128 px context ready: two actual core tiles and three exact source scans');
 try{
  for(const view of cropViews){
   setStudyCamera(camera,sampleCamera(view.time),view);worldTime.value=view.time;
   for(const mode of ['neutral','pbr','common-bedrock'])for(const enabled of mode==='common-bedrock'?[true]:[false,true]){
    const name=view.name+'-'+mode+'-'+(enabled?'on':'off');await stage('Render '+name);
    tiles.forEach(mesh=>mesh.material=mode==='neutral'?neutral:ground);study.parts.forEach(part=>part.mesh.material=mode==='neutral'?neutral:mode==='common-bedrock'?bedrock:study.material);study.group.visible=enabled;
    renderer.shadowMap.needsUpdate=true;renderer.info.reset();const before=performance.now();renderer.render(scene,camera);await waitForProfilingFence(gl,{timeoutMilliseconds:60000});
    assert(!gl.isContextLost(),'Context lost');assert(shaderErrors.length===0,shaderErrors.join('\n'));assert(gl.getError()===gl.NO_ERROR,'GL error');
    await window.studySave(name+'.png',document.getElementById('world').toDataURL('image/png').split(',')[1]);
    rows.push({name,mode,enabled,view,position:camera.position.toArray(),fov:camera.fov,bank:sampleCamera(view.time).bank,renderMilliseconds:performance.now()-before,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls});
   }
  }
  const extension=gl.getExtension('WEBGL_debug_renderer_info');
  return{ok:true,label:'LOCAL NO-CANOPY ACTUAL GEOMETRY/PBR DIAGNOSTIC — not scene acceptance',renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),threeRevision:THREE.REVISION,sourceSHA256:config.sourceSHA256,geometrySHA256:config.geometrySHA256,sourceProof,rows,shaderErrors,elapsedMilliseconds:performance.now()-started,
   terrainTiles:['terrain-0-0','terrain-1-0'],geometryTriangles:40000+sourceProof.reduce((sum,p)=>sum+p.triangles,0),
   lighting:{sunDirection:solarDirection.value.toArray(),sunIntensity:4.8,sunColor:'#ffdfb6',skyIntensity:.48,skyColor:'#a1c9ed',groundColor:'#365842',environmentIntensity:.55,exposure:1.08,fogDensity:.000065,environment:'128×64 sample of shared analytic bayClearSky; tiny PMREM; clouds omitted',shadow:{mapSize:512,span:190,texelWorldSize:190/512,bias:-.00004,normalBias:.25}},
   limits:['No forest/wood geometry: does not establish canopy visibility, full occlusion or tree shadows','No ocean/full scene/cloud rendering; analytic clear environment approximates the shared sky, not the full production cloud probe','Only two original tiles: outside terrain/prop shadows omitted; local map has production physical texel density but different projection origin','128 px image enlarges a64×64 source crop2×; original whole-frame source group remains about13×23 px at512','No production import, camera, geometry, material default or dist changes']};
 }finally{
  const texturesToDispose=new Set([...Object.values(textures),white,sky]);for(const value of Object.values(study.material))if(value?.isTexture)texturesToDispose.add(value);
  study.parts.forEach(part=>{part.mesh.geometry.dispose();part.mesh.dispose();});tiles.forEach(tile=>tile.geometry.dispose());[ground,bedrock,neutral,study.material].forEach(m=>m.dispose());
  gltf.scene.traverse(o=>{if(o.isMesh)o.geometry.dispose();});packedSource.children.forEach(o=>{o.geometry.dispose();o.material.dispose();});texturesToDispose.forEach(t=>t.dispose());
  sun.shadow.map?.dispose();sun.shadow.map?.depthTexture?.dispose();environment.dispose();pmrem.dispose();renderer.dispose();
 }
};
