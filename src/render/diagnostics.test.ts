import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {enableMaterialDiagnostics,diagnosticFragment} from './diagnostics.ts';
import {createGroundMaterial} from './ground-materials.ts';
import {debugMode,type Textures} from './materials.ts';
import {withCloudLighting} from './sky-lighting.ts';
import {withAerialPerspective} from './aerial-perspective.ts';

function compose(material:THREE.MeshStandardMaterial){
 const shader={uniforms:THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms),vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader} as THREE.WebGLProgramParametersWithUniforms;
 material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);return shader;
}
function uniformCount(source:string,name:string){
 const code=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 return [...code.matchAll(/\buniform\b[^;{}]*;/g)].filter(match=>new RegExp('\\b'+name+'\\b').test(match[0])).length;
}
test('real ground plus diagnostics/cloud/aerial hooks declare uDebug once with pruning in the same declaration',()=>{
 const names=['rock','rockNormal','rockARM','sand','sandNormal','sandARM','bark','barkNormal','soil','soilNormal','soilARM','moss','mossNormal','mossARM'];
 const textures=Object.fromEntries(names.map(name=>[name,new THREE.Texture()])) as Textures;
 for(const allowPruning of [false,true]){
  const material=createGroundMaterial(textures,allowPruning);
  enableMaterialDiagnostics(material);enableMaterialDiagnostics(material);withCloudLighting(material);withAerialPerspective(material);
  const shader=compose(material);
  assert.match(shader.fragmentShader,/uniform float uDebug,uGroundLayerPruning;/);
  assert.equal(uniformCount(shader.fragmentShader,'uDebug'),1);assert.equal(uniformCount(shader.fragmentShader,'uLod'),1);
  assert.equal(shader.uniforms.uDebug,debugMode);assert.equal(shader.uniforms.uGroundLayerPruning.value,0);
  assert.equal(shader.fragmentShader.split(diagnosticFragment).length-1,1);
  assert.match(material.customProgramCacheKey(),/diagnostics-v3/);material.dispose();
 }
 for(const texture of Object.values(textures))texture.dispose();
});

test('diagnostic declarations handle comma order, precision and existing uLod without comment or suffix false positives',()=>{
 const cases=[
  'uniform highp float uDebug, existing;',
  'uniform float existing,\n uDebug ;',
  'uniform float uDebug; uniform mediump float uLod;',
  'uniform float uDebugExtra; // uniform float uDebug;\n/* uniform float uLod; */',
  '',
 ];
 for(const declarations of cases){
  const material=new THREE.MeshStandardMaterial();
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+declarations);};
  enableMaterialDiagnostics(material);const shader=compose(material);
  assert.equal(uniformCount(shader.fragmentShader,'uDebug'),1,declarations);assert.equal(uniformCount(shader.fragmentShader,'uLod'),1,declarations);
  assert.equal(shader.uniforms.uDebug,debugMode);material.dispose();
 }
});
