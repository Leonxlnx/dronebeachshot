// Actual production near assets and far atlases: fractional leaf area must
// survive a color resolve while single-sample shadow coverage remains defined.
import fs from 'node:fs/promises';
import nodeGles from 'node-gles-webgl2';
import sharp from 'sharp';
import * as THREE from '/workspace/sites/last-light-bay/node_modules/three/build/three.module.js';
import {GLTFLoader} from '/workspace/sites/last-light-bay/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {prepareTreeMaterial,setFoliageMultisampling,setVegetationQuality,lodCamera} from '/workspace/sites/last-light-bay/src/render/vegetation-material.ts';
import {createTreeImpostor} from '/workspace/sites/last-light-bay/src/world/tree-impostor.ts';
import {withCloudLighting} from '/workspace/sites/last-light-bay/src/render/sky-lighting.ts';
import {wrapNativeGL} from './native-gl-compat.mjs';
import {installNativeAssetLoaders} from './native-asset-adapter.mjs';
const output='foliage-msaa-proof';await fs.mkdir(output,{recursive:true});
await installNativeAssetLoaders({THREE,GLTFLoader,publicRoot:'/workspace/sites/last-light-bay/public',sharp});
const size=256,gl=wrapNativeGL(nodeGles.createWebGLRenderingContext({width:size,height:size,majorVersion:3}));
const canvas={width:size,height:size,style:{},addEventListener(){},removeEventListener(){},getContext(){return gl}};gl.canvas=canvas;
const renderer=new THREE.WebGLRenderer({canvas,context:gl,alpha:false});renderer.setSize(size,size,false);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
const errors=[];renderer.debug.onShaderError=(g,p,v,f)=>errors.push([g.getProgramInfoLog(p),g.getShaderInfoLog(v),g.getShaderInfoLog(f)]);
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-20,20,20,-20,.1,1000);scene.add(new THREE.HemisphereLight(0xffffff,0xffffff,1));setVegetationQuality('high');
const target=new THREE.WebGLRenderTarget(size,size,{samples:4,type:THREE.UnsignedByteType});
const report={method:'Actual production leaf-only coverage with output RGB white; alpha untouched; raw RGB fractional sample area',rows:[],shaderErrors:errors};
for(const family of ['island','syringa']){
 const meta=JSON.parse(await fs.readFile('tree-impostors-corrected/'+family+'-metadata.json','utf8'));
 const source=await new GLTFLoader().loadAsync('/assets/models/'+family+'-tree-near.glb');source.scene.updateMatrixWorld(true);
 const albedo=await new THREE.TextureLoader().loadAsync('/assets/impostors/'+family+'-albedo.png'),normal=await new THREE.TextureLoader().loadAsync('/assets/impostors/'+family+'-normal.png');
 for(const kind of ['near','atlas'])for(const multisample of [false,true]){
  setFoliageMultisampling(multisample);const group=new THREE.Group();
  if(kind==='atlas'){const mesh=createTreeImpostor(meta,albedo,normal,1);mesh.setMatrixAt(0,new THREE.Matrix4());group.add(mesh);}
  else source.scene.traverse(o=>{if(!o.isMesh||o.material.alphaTest<=0)return;const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);geometry.scale(meta.scale,meta.scale,meta.scale);const {material,depth}=prepareTreeMaterial(o.material,0,{height:{value:meta.bounds.max[1]},thinLeaf:true});const mesh=new THREE.InstancedMesh(geometry,material,1);mesh.customDepthMaterial=depth;mesh.setMatrixAt(0,new THREE.Matrix4());group.add(mesh);});
  for(const mesh of group.children){mesh.frustumCulled=false;const m=mesh.material;withCloudLighting(m);const previous=m.onBeforeCompile.bind(m),key=m.customProgramCacheKey.bind(m);m.onBeforeCompile=(s,r)=>{previous(s,r);s.fragmentShader=s.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\ngl_FragColor.rgb=vec3(1.);');};m.customProgramCacheKey=()=>key()+'-coverage-only';}
  scene.add(group);const center=new THREE.Vector3(...meta.center);lodCamera.value.set(0,0,kind==='atlas'?1500:12);
  for(const projectedHeight of [16,48,128])for(const angle of [10,70]){
   const span=(meta.bounds.max[1]-meta.bounds.min[1])*size/projectedHeight;camera.left=-span/2;camera.right=span/2;camera.top=span/2;camera.bottom=-span/2;camera.position.copy(center).add(new THREE.Vector3(0,Math.sin(angle*Math.PI/180)*150,Math.cos(angle*Math.PI/180)*150));camera.lookAt(center);camera.updateProjectionMatrix();
   renderer.setRenderTarget(target);renderer.render(scene,camera);if(errors.length)throw Error(JSON.stringify(errors));const p=new Uint8Array(size*size*4);renderer.readRenderTargetPixels(target,0,0,size,size,p);let area=0,partial=0;for(let i=0;i<p.length;i+=4){area+=p[i]/255;if(p[i]>0&&p[i]<255)partial++;}
   const name=`${family}-${kind}-${projectedHeight}-${angle}-${multisample?'a2c':'hash'}.png`;await sharp(p,{raw:{width:size,height:size,channels:4}}).flip().removeAlpha().png().toFile(output+'/'+name);
   report.rows.push({family,kind,projectedHeight,angle,multisample,area,partial,name,depthHash:group.children.every(o=>o.customDepthMaterial.alphaHash),colorHash:group.children.every(o=>o.material.alphaHash)});
  }
  scene.remove(group);for(const mesh of group.children){mesh.geometry.dispose();mesh.material.dispose();mesh.customDepthMaterial.dispose();}
 }
}
report.comparisons=report.rows.filter(x=>x.multisample).map(a=>{const b=report.rows.find(b=>!b.multisample&&b.family===a.family&&b.kind===a.kind&&b.projectedHeight===a.projectedHeight&&b.angle===a.angle);return {family:a.family,kind:a.kind,projectedHeight:a.projectedHeight,angle:a.angle,areaRatio:a.area/b.area,a2cArea:a.area,hashArea:b.area,partialPixels:a.partial};});
report.glError=gl.getError();await fs.writeFile(output+'/proof.json',JSON.stringify(report,null,2));console.log(JSON.stringify({comparisons:report.comparisons,shaderErrors:errors,glError:report.glError}));target.dispose();renderer.dispose();gl.destroy();if(errors.length||report.glError)throw Error('Foliage graphics error');
