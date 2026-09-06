import nodeGles from 'node-gles-webgl2';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import * as THREE from '/workspace/sites/last-light-bay/node_modules/three/build/three.module.js';
import {GLTFLoader} from '/workspace/sites/last-light-bay/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {wrapNativeGL} from './native-gl-compat.mjs';
import {installNativeAssetLoaders} from './native-asset-adapter.mjs';
installNativeAssetLoaders({THREE,GLTFLoader,publicRoot:'/workspace/sites/last-light-bay/public',sharp});
const w=960,h=480,gl=wrapNativeGL(nodeGles.createWebGLRenderingContext({width:w,height:h,majorVersion:3}));
const canvas={width:w,height:h,style:{},addEventListener(){},removeEventListener(){},getContext(){return gl}};gl.canvas=canvas;
const renderer=new THREE.WebGLRenderer({canvas,context:gl});renderer.setSize(w,h,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x8ba0b4);const sun=new THREE.DirectionalLight(0xffdeb0,3);sun.position.set(-30,30,50);scene.add(sun,new THREE.HemisphereLight(0xb4d1ed,0x586437,2));
const loader=new GLTFLoader();let i=0;const bounds=[];
for(const name of ['island-tree-near','island-tree-hero','island-tree-medium','island-tree-far']){
 const gltf=await loader.loadAsync('/assets/models/'+name+'.glb');gltf.scene.scale.setScalar(18/3.4);gltf.scene.position.x=(i++-1.5)*25;gltf.scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(gltf.scene);bounds.push({name,min:box.min.toArray(),max:box.max.toArray()});scene.add(gltf.scene);
}
console.log(bounds);await fs.writeFile('isolated-tree-bounds.json',JSON.stringify(bounds,null,2));
const floor=new THREE.Mesh(new THREE.PlaneGeometry(120,80),new THREE.MeshStandardMaterial({color:0x606d48,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.1;scene.add(floor);
const camera=new THREE.PerspectiveCamera(45,w/h,.1,500);camera.position.set(0,24,115);camera.lookAt(0,9,0);renderer.render(scene,camera);gl.finish();const pix=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pix);await sharp(pix,{raw:{width:w,height:h,channels:4}}).flip().png().toFile('isolated-tree-lods.png');console.log('error',gl.getError(),renderer.info.render);renderer.dispose();gl.destroy();
