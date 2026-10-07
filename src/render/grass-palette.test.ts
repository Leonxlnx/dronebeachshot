import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import * as THREE from 'three';
import {createGroundCover} from '../world/plants.ts';
import {rng} from '../world/math.ts';
import {grassPaletteSRGB} from './grass-palette.ts';
import type {Textures} from './materials.ts';

// Exact pre-study file, not a baseline reconstructed by undoing the candidate.
const source=fs.readFileSync(new URL('./grass-palette-before.test-fixture.txt',import.meta.url),'utf8').replace(/\r\n/g,'\n');
assert.equal(createHash('sha256').update(source).digest('hex'),'944ac0c56aa7a17fe4551f2bd0efad44bb55325e167a9f6b6d4eb8e568989142');
const rewritten=source.replace(/(from\s*['"])([^'"]+)(['"])/g,(_,a,specifier,c)=>{
 const resolved=specifier==='three'?new URL('../../node_modules/three/build/three.module.js',import.meta.url):
  specifier.startsWith('three/addons/')?new URL('../../node_modules/three/examples/jsm/'+specifier.slice(13),import.meta.url):
  new URL(specifier+(specifier.endsWith('.ts')?'':'.ts'),new URL('../world/plants.ts',import.meta.url));
 return a+resolved.href+c;
});
const compiled=ts.transpileModule(rewritten,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {createGroundCover:before}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));

function bytes(array:ArrayBufferView){return Buffer.from(array.buffer,array.byteOffset,array.byteLength);}
function equalArray(a:ArrayBufferView,b:ArrayBufferView,label:string){assert.equal(a.constructor.name,b.constructor.name,label+' type');assert.equal(a.byteLength,b.byteLength,label+' length');assert.equal(Buffer.compare(bytes(a),bytes(b)),0,label+' bytes');}
function dispose(...groups:THREE.Group[]){
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 for(const group of groups)group.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);if(object instanceof THREE.InstancedMesh)object.dispose();}});
 for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
}

test('complete seeded grass/fern/log geometry, placements, wind and flags retain their pre-study bytes',()=>{
 const texture=new THREE.Texture(),keys=['rock','rockNormal','rockARM','sand','sandNormal','sandARM','bark','barkNormal','soil','soilNormal','soilARM','moss','mossNormal','mossARM'];
 const textures=Object.fromEntries(keys.map(key=>[key,texture])) as Textures,original=before(textures),candidate=createGroundCover(textures);
 try{
  assert.equal(grassPaletteSRGB.value,0);assert.equal(original.children.length,6);assert.equal(candidate.children.length,6);
  let additionalBytes=0;
  for(let i=0;i<6;i++){
   const a=original.children[i] as THREE.InstancedMesh,b=candidate.children[i] as THREE.InstancedMesh;
   assert.deepEqual([b.count,b.castShadow,b.receiveShadow,b.frustumCulled,b.name],[a.count,a.castShadow,a.receiveShadow,a.frustumCulled,a.name]);
   equalArray(a.instanceMatrix.array,b.instanceMatrix.array,'mesh '+i+' instance matrices');
   assert.equal(a.instanceColor,b.instanceColor);assert.deepEqual(a.matrix.elements,b.matrix.elements);
   assert.deepEqual(b.geometry.groups,a.geometry.groups);assert.deepEqual(b.geometry.drawRange,a.geometry.drawRange);
   for(const key of Object.keys(a.geometry.attributes)){
    const old=a.geometry.getAttribute(key),now=b.geometry.getAttribute(key);assert.equal(old.itemSize,now.itemSize);assert.equal(old.normalized,now.normalized);equalArray(old.array,now.array,'mesh '+i+' '+key);
   }
   if(a.geometry.index&&b.geometry.index)equalArray(a.geometry.index.array,b.geometry.index.array,'mesh '+i+' indices');else assert.equal(a.geometry.index,b.geometry.index);
   if(i<4){
    const alternate=b.geometry.getAttribute('grassPaletteColor');assert.equal(alternate.count,b.geometry.getAttribute('color').count);additionalBytes+=alternate.array.byteLength;
    assert.notEqual(alternate,b.geometry.getAttribute('color'));
   }else if(i===4)assert.equal(b.geometry.getAttribute('grassPaletteColor'),b.geometry.getAttribute('color'),'Fern reuses exact original BufferAttribute');
   else assert.equal(b.geometry.getAttribute('grassPaletteColor'),undefined,'Logs never enter the study');
  }
  assert.equal(additionalBytes,14256);
  const oldShader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader} as THREE.WebGLProgramParametersWithUniforms;
  const newShader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader} as THREE.WebGLProgramParametersWithUniforms;
  (original.children[0] as THREE.Mesh).material.onBeforeCompile(oldShader,{} as THREE.WebGLRenderer);
  (candidate.children[0] as THREE.Mesh).material.onBeforeCompile(newShader,{} as THREE.WebGLRenderer);
  assert.equal(newShader.fragmentShader,oldShader.fragmentShader,'Existing height darkening and fragment lighting are unchanged');
  assert.equal(newShader.uniforms.uGrassPaletteSRGB,grassPaletteSRGB);
  assert.ok(newShader.vertexShader.includes('if(uGrassPaletteSRGB>.5)vColor.rgb*=grassPaletteColor;'));
  assert.ok(newShader.vertexShader.includes('else vColor.rgb *= color;'));
  assert.ok(newShader.vertexShader.includes('vColor.rgb *= instanceColor.rgb;'));
  const wind=oldShader.vertexShader.slice(oldShader.vertexShader.indexOf('vLeafHeight=position.y;'),oldShader.vertexShader.indexOf('#include <morphtarget_vertex>'));
  assert.ok(wind.length>150,'Inspect the actual full wind block');
  assert.ok(newShader.vertexShader.includes(wind),'Existing wind path remains byte-identical');

  // The first blade's exact RNG values are known without replaying placements.
  // Conversion must precede the .84 root multiplier, not encode its shading.
  const random=rng(8278);random();random();random();const h=.225+random()*.06,l=.29+random()*.08;
  const color=new THREE.Color().setHSL(h,.33,l),linear=color.clone().convertSRGBToLinear(),wrong=color.clone().multiplyScalar(.84).convertSRGBToLinear();
  const alternative=(candidate.children[0] as THREE.Mesh).geometry.getAttribute('grassPaletteColor');
  for(const [index,value]of [linear.r,linear.g,linear.b].entries())assert.equal(alternative.array[index],Math.fround(value*.84));
  assert.ok(Math.abs(alternative.getY(0)-wrong.g)>.001,'Shade-then-decode must not accidentally pass');
  const currentY=color.r*.2126+color.g*.7152+color.b*.0722,nextY=linear.r*.2126+linear.g*.7152+linear.b*.0722;
  assert.ok(nextY<currentY&&nextY>0,'Candidate is a finite lower-albedo interpretation');
 }finally{dispose(original,candidate);texture.dispose();}
});
