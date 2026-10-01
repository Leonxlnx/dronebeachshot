import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {runup,runupVelocity,sandWetness} from '../world/coastal.ts';
import {sandFilmWetness} from './sand-film.ts';
import {createGroundMaterial,sandFilmDrying} from './ground-materials.ts';
import type {Textures} from './materials.ts';

test('film shares actual wetting events, preserves freshly covered/dry endpoints and never outlasts dampness',()=>{
 let drainedRetreats=0;
 for(let x=-450;x<=450;x+=75)for(let t=-3;t<=23;t+=.137){
  const reach=runup(x,t);
  assert.equal(sandFilmWetness(x,reach-.31,t),1);
  assert.equal(sandFilmWetness(x,7,t),0);
  for(const d of [-5,0,2,4,reach+1.3]){
   const film=sandFilmWetness(x,d,t),damp=sandWetness(x,d,t);
   assert.ok(film>=0&&film<=damp+1e-14&&damp<=1);
   if(runupVelocity(x,t)<-1&&d>reach+1&&damp>.4&&film<damp*.7)drainedRetreats++;
   const repeated=sandFilmWetness(x,d,t);assert.equal(repeated,film);
   assert.ok(Math.abs(sandFilmWetness(x,d,t+1e-5)-sandFilmWetness(x,d,t-1e-5))<.001);
  }
 }
 assert.ok(drainedRetreats>100,'Study must actually reduce gloss behind receding waves');
});

test('surface study defaults off and changes only the composed roughness response, not damp albedo or displacement',()=>{
 const keys=['rock','rockNormal','rockARM','sand','sandNormal','sandARM','bark','barkNormal','soil','soilNormal','soilARM','moss','mossNormal','mossARM'];
 const textures=Object.fromEntries(keys.map(key=>[key,new THREE.Texture()])) as Textures;
 const material=createGroundMaterial(textures,true),shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader} as THREE.WebGLProgramParametersWithUniforms;
 material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
 assert.equal(sandFilmDrying.value,0);assert.equal(shader.uniforms.uSandFilmDrying,sandFilmDrying);
 assert.ok(!shader.vertexShader.includes('sandFilm'));
 assert.ok(shader.fragmentShader.includes('wet=sandWetness(gp.x,d,uTime)'));
 assert.ok(shader.fragmentShader.includes('ground*=macro*mix(1.,.61,wet*sediment);'));
 assert.ok(shader.fragmentShader.includes('float exposedFilm=wet*sediment*smoothstep(-.25,.10,gp.y);'));
 const use=shader.fragmentShader.indexOf('float drainedFilm=sandFilmWetness(');
 assert.ok(use>shader.fragmentShader.indexOf('#include <roughnessmap_fragment>'));
 assert.ok(use<shader.fragmentShader.indexOf('roughnessFactor=mix(roughnessFactor,.20,exposedFilm)'));
 assert.ok(shader.fragmentShader.includes('if(uSandFilmDrying>0.)'));
 material.dispose();for(const texture of Object.values(textures))texture.dispose();
});
