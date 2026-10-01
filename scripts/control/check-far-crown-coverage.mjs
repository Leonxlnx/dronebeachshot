// CPU composition of the real current impostor, source-light, cloud and aerial hooks.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTreeImpostor} from '../../src/world/tree-impostor.ts';
import {treeImpostorDefinitions} from '../../src/world/tree-impostor-data.ts';
import {prepareTreeMaterial,setFoliageMultisampling} from '../../src/render/vegetation-material.ts';
import {setFarCrownCoverage,getFarCrownCoverage} from '../../src/render/far-crown-coverage.ts';
import {withCloudLighting} from '../../src/render/sky-lighting.ts';
import {withAerialPerspective} from '../../src/render/aerial-perspective.ts';
function compile(material){
 const source=material.isMeshDepthMaterial?THREE.ShaderLib.depth:THREE.ShaderLib.standard;
 const shader={vertexShader:source.vertexShader,fragmentShader:source.fragmentShader,uniforms:{}};
 material.onBeforeCompile(shader,{});return{vertexShader:shader.vertexShader,fragmentShader:shader.fragmentShader};
}
function flags(m){return{alphaHash:m.alphaHash,alphaToCoverage:m.alphaToCoverage,key:m.customProgramCacheKey(),defines:JSON.stringify(m.defines??{}),opacity:m.opacity};}
const pixels=new Uint8Array([90,120,40,255,150,180,60,128,40,60,20,0,70,100,30,64]);
const albedo=new THREE.DataTexture(pixels,2,2,THREE.RGBAFormat);albedo.colorSpace=THREE.SRGBColorSpace;
const normals=new THREE.DataTexture(new Uint8Array([128,255,128,255,128,255,128,128,128,255,128,0,128,255,128,64]),2,2,THREE.RGBAFormat);
const visibility=new THREE.DataTexture(new Uint8Array([255,255]),1,1,THREE.RGFormat);
const input=pixels.slice();setFoliageMultisampling(true);assert.equal(getFarCrownCoverage().enabled,false);
const meshes=treeImpostorDefinitions.map(def=>createTreeImpostor(def,albedo,normals,2,visibility));
for(const mesh of meshes){withCloudLighting(mesh.material);withAerialPerspective(mesh.material);}
const materials=meshes.flatMap(mesh=>[mesh.material,mesh.customDepthMaterial]);
const initial=materials.map(m=>({shader:compile(m),flags:flags(m)}));
const source=new THREE.MeshStandardMaterial({map:albedo,alphaTest:.45});
const near=prepareTreeMaterial(source,0,{height:{value:18},thinLeaf:true});
const nearInitial=[near.material,near.depth].map(m=>({shader:compile(m),flags:flags(m)}));
assert.equal(getFarCrownCoverage().pairs,2);
for(let cycle=0;cycle<4;cycle++){
 setFarCrownCoverage(true);
 materials.forEach(material=>{
  const shader=compile(material);
  assert.equal(material.alphaHash,true);assert.equal(material.alphaToCoverage,false);
  assert.equal(material.defines.BAY_ROOT_SEEDED_CROWN_HASH,1);
  assert.match(shader.vertexShader,/flat varying vec3 vRootCrownSalt/);
  assert.match(shader.fragmentShader,/floor\( pixScales\.x \* position\.xyz \) \+ vRootCrownSalt/);
  assert.match(shader.fragmentShader,/floor\( pixScales\.y \* position\.xyz \) \+ vRootCrownSalt/);
  assert.match(shader.fragmentShader,/dFdx\( position\.xyz \)/);
  assert.match(shader.fragmentShader,/if \(diffuseColor\.a <= 0\.0\) discard/);
 });
 [near.material,near.depth].forEach((m,i)=>assert.deepEqual({shader:compile(m),flags:flags(m)},nearInitial[i]));
 setFarCrownCoverage(false);
 materials.forEach((m,i)=>assert.deepEqual({shader:compile(m),flags:flags(m)},initial[i]));
 assert.deepEqual(pixels,input);
}
for(const mesh of meshes){mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();mesh.customDepthMaterial.dispose();}
near.material.dispose();near.depth.dispose();source.dispose();albedo.dispose();normals.dispose();visibility.dispose();
assert.equal(getFarCrownCoverage().pairs,0);
console.log(JSON.stringify({ok:true,integratedPairs:2,pairedMaterials:4,toggleCycles:4,nearMaterialsUntouched:2,
 restoredShadersPerCycle:4,sourceAlphaUnchanged:true,disposedRegistryPairs:0,
 constraints:['CPU actual shader-hook composition; GLSL compile and full-scene image/motion remain separate']}));
