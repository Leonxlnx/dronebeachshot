// Tiny terrain-only proof of an isolated shared-heightfield shape. No canopy.
import * as THREE from 'three';
import {createStudyTile,setStudyCamera,clearSkyTexture} from '/study-helper.mjs';
import {roundedSpurSample,roundedSpurSettings} from '/spur-helper.mjs';
import {terrainHeight,shoreDistance,noise} from '/src/world/math.ts';
import {sampleCamera} from '/src/camera/cinematic.ts';
import {loadTextures} from '/src/world/assets.ts';
import {treePlacements} from '/src/world/ecology.ts';
// The fixture server adds ONLY a named export for the existing private function.
// Its complete source body and production module remain unchanged on disk.
import {habitatData,habitatTexture,habitatUniform,updateHabitatCanopy} from '/src/world/habitat.ts';
import {createGroundMaterial} from '/src/render/ground-materials.ts';
import {worldTime} from '/src/render/materials.ts';
import {solarDirection,solarColor,solarIntensity,withCloudLighting,cloudShadow} from '/src/render/sky-lighting.ts';
import {withAerialPerspective} from '/src/render/aerial-perspective.ts';
import {waitForProfilingFence} from '/src/render/profiling-sync.ts';

window.runRoundedSpurStudy=async()=>{
 const start=performance.now(),stage=async name=>{if(performance.now()-start>180000)throw Error('180 second page deadline');await window.studyStage(name);};
 const assert=(condition,message)=>{if(!condition)throw Error(message);};
 const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
 const helperBytes=await(await fetch('/spur-helper.mjs')).arrayBuffer();assert(await hash(helperBytes)===window.studyConfig.helperSHA256,'Candidate helper changed');
 const height=(x,z)=>roundedSpurSample(x,z,terrainHeight(x,z),shoreDistance(x,z)).height;
 await stage('Load original terrain textures; prepare exact baseline/candidate terrain and habitat');
 const textures=await loadTextures(()=>{});updateHabitatCanopy(treePlacements());
 const baselineCanopy=habitatTexture.image.data,candidatePixels=habitatData(height);
 for(let i=3;i<candidatePixels.length;i+=4)candidatePixels[i]=baselineCanopy[i];
 const candidateHabitat=new THREE.DataTexture(candidatePixels,habitatTexture.image.width,habitatTexture.image.height,THREE.RGBAFormat);candidateHabitat.minFilter=habitatTexture.minFilter;candidateHabitat.magFilter=habitatTexture.magFilter;candidateHabitat.generateMipmaps=false;candidateHabitat.flipY=false;candidateHabitat.needsUpdate=true;
 const ground=createGroundMaterial(textures),neutral=new THREE.MeshStandardMaterial({color:new THREE.Color(.38,.38,.38),roughness:.9});
 const oldTiles=[0,1].map(tx=>createStudyTile(tx,0,ground,terrainHeight,noise)),newTiles=[0,1].map(tx=>createStudyTile(tx,0,ground,height,noise));
 let changedVertices=0,maximumRise=0;const terrainProof=[];
 for(let j=0;j<2;j++){
  const old=oldTiles[j].geometry,p=old.attributes.position,newG=newTiles[j].geometry,q=newG.attributes.position;
  assert(p.count===q.count,'Tile resolution changed');
  for(let i=0;i<p.count;i++){assert(p.getX(i)===q.getX(i)&&p.getZ(i)===q.getZ(i),'Tile XZ changed');const delta=q.getY(i)-p.getY(i);assert(delta>=0&&delta<=32.00002,'Unbounded uplift');if(delta>0){changedVertices++;maximumRise=Math.max(maximumRise,delta);}if(shoreDistance(p.getX(i),p.getZ(i))<=45)assert(delta===0,'Coast changed');}
  const bytes=a=>new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength);
  terrainProof.push({name:oldTiles[j].name,beforePosition:await hash(bytes(p)),afterPosition:await hash(bytes(q)),beforeNormals:await hash(bytes(old.attributes.normal)),afterNormals:await hash(bytes(newG.attributes.normal)),index:await hash(bytes(old.index))});
  assert(await hash(bytes(old.index))===await hash(bytes(newG.index)),'Tile topology changed');
 }
 const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('world'),alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
 renderer.setPixelRatio(1);renderer.setSize(256,256,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
 const gl=renderer.getContext(),shaderErrors=[];renderer.debug.onShaderError=(g,p,v,f)=>shaderErrors.push([g.getProgramInfoLog(p),g.getShaderInfoLog(v),g.getShaderInfoLog(f)].filter(Boolean).join('\n'));
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x9daca7);scene.fog=new THREE.FogExp2(0x9daca7,.000065);
 const white=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);white.needsUpdate=true;cloudShadow.value=white;
 solarColor.value.set(0xffdfb6);solarIntensity.value=4.8;
 const sun=new THREE.DirectionalLight(0xffdfb6,4.8);sun.target.position.set(202,105,136);sun.position.copy(sun.target.position).addScaledVector(solarDirection.value,1000);
 sun.castShadow=true;sun.shadow.mapSize.set(512,512);Object.assign(sun.shadow.camera,{left:-95,right:95,top:95,bottom:-95,near:1,far:1800});sun.shadow.bias=-.00004;sun.shadow.normalBias=.25;
 scene.add(sun,sun.target,new THREE.HemisphereLight(0xa1c9ed,0x365842,.48),...oldTiles,...newTiles);
 for(const material of [ground,neutral]){withCloudLighting(material);withAerialPerspective(material);}
 const sky=clearSkyTexture(solarDirection.value),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(sky);scene.environment=environment.texture;scene.environmentIntensity=.55;
 const camera=new THREE.PerspectiveCamera(42,16/9,.4,22000),views=[{time:9,name:'flight-9',fullWidth:512,fullHeight:288,x:368,y:0,width:144,height:144},{time:10.5,name:'flight-10_5',fullWidth:512,fullHeight:288,x:280,y:0,width:144,height:144}],rows=[];
 await stage('One256px context ready: baseline/candidate existing two core tiles; no other scene geometry');
 try{
  for(const view of views){
   setStudyCamera(camera,sampleCamera(view.time),view);worldTime.value=view.time;
   for(const mode of ['neutral','pbr'])for(const enabled of [false,true]){
    const name=view.name+'-'+mode+'-'+(enabled?'on':'off');await stage('Render '+name);
    oldTiles.forEach(mesh=>{mesh.visible=!enabled;mesh.material=mode==='neutral'?neutral:ground;});newTiles.forEach(mesh=>{mesh.visible=enabled;mesh.material=mode==='neutral'?neutral:ground;});
    habitatUniform.value=enabled?candidateHabitat:habitatTexture;renderer.shadowMap.needsUpdate=true;renderer.info.reset();const before=performance.now();renderer.render(scene,camera);await waitForProfilingFence(gl,{timeoutMilliseconds:60000});
    assert(!gl.isContextLost(),'Context lost');assert(!shaderErrors.length,shaderErrors.join('\n'));assert(gl.getError()===gl.NO_ERROR,'GL error');
    await window.studySave(name+'.png',document.getElementById('world').toDataURL('image/png').split(',')[1]);rows.push({name,mode,enabled,view,position:camera.position.toArray(),fov:camera.fov,bank:sampleCamera(view.time).bank,renderMilliseconds:performance.now()-before,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls});
   }
  }
  const extension=gl.getExtension('WEBGL_debug_renderer_info');
  return{ok:true,label:'LOCAL NO-CANOPY ROUNDED SPUR TERRAIN PROOF — no production/ecology acceptance',renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),threeRevision:THREE.REVISION,rows,shaderErrors,settings:roundedSpurSettings,helperSHA256:window.studyConfig.helperSHA256,terrainProof,changedVerticesWithSharedTileBoundaryDuplicates:changedVertices,maximumFloat32Rise:maximumRise,habitatMethod:'Original private habitatData exported only by fixture server; current candidate height input; baseline original tree-canopy coverage retained because XZ/scale cohort is unchanged',
   lighting:{sunDirection:solarDirection.value.toArray(),sunIntensity:4.8,sunColor:'#ffdfb6',skyIntensity:.48,skyColor:'#a1c9ed',groundColor:'#365842',environmentIntensity:.55,exposure:1.08,fogDensity:.000065,environment:'tiny shared analytic clear sky, no clouds',shadow:{mapSize:512,span:190,texelWorldSize:190/512,bias:-.00004,normalBias:.25}},
   limits:['No forest/wood/other props/ocean, so occlusion/support/full-scene appearance remain unproved','Known local tree basal and steep-slope issues require explicit correction before any production use','256px outputs enlarge a144px crop1.778× of actual512-frame rays; camera and FOV unchanged','Two original tiles only, local shadow projection and analytic cloud-free environment approximate production lighting','Candidate habitat RGB follows altered terrain; canopy coverage uses unchanged original XZ/scale identities','No production or dist files changed']};
 }finally{
  habitatUniform.value=habitatTexture;oldTiles.concat(newTiles).forEach(mesh=>mesh.geometry.dispose());ground.dispose();neutral.dispose();candidateHabitat.dispose();Object.values(textures).forEach(t=>t.dispose());white.dispose();sky.dispose();environment.dispose();pmrem.dispose();sun.shadow.map?.dispose();sun.shadow.map?.depthTexture?.dispose();renderer.dispose();
 }
};
