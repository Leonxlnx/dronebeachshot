// Execute the production GLSL helper in a float framebuffer and check its
// mathematical invariants independently in Float64. No browser is started.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import nodeGles from 'node-gles-webgl2';
import * as THREE from 'three';
import {wrapNativeGL} from './native-gl-compat.mjs';
import {waterSlopeFilterGLSL} from '../../src/world/water-slope-filter.ts';
const gl=wrapNativeGL(nodeGles.createWebGLRenderingContext({width:1,height:1,majorVersion:3,minorVersion:0}));
const canvas={width:1,height:1,style:{},addEventListener(){},removeEventListener(){},setAttribute(){},getContext(type){return type==='webgl2'?gl:null;}};
gl.canvas=canvas;
const renderer=new THREE.WebGLRenderer({canvas,context:gl});
const shaderErrors=[];
renderer.debug.onShaderError=(g,p)=>shaderErrors.push(g.getProgramInfoLog(p));
const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false});
const uniforms={phase:{value:new THREE.Vector4()},amplitude:{value:new THREE.Vector4()},visibility:{value:1},cosine:{value:false}};
const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:false,
 vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`precision highp float;uniform vec4 phase,amplitude;uniform float visibility;uniform bool cosine;${waterSlopeFilterGLSL}
 void main(){float variance=0.;vec2 correction=filteredPhaseCorrection(phase,amplitude,visibility,cosine,variance);gl_FragColor=vec4(correction,variance,1.);}`});
const scene=new THREE.Scene(),plane=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);plane.frustumCulled=false;scene.add(plane);
const camera=new THREE.Camera(),pixel=new Float32Array(4),results=[];
function sample(phase,amplitude,visibility,cosine){
 uniforms.phase.value.fromArray(phase);uniforms.amplitude.value.fromArray(amplitude);
 uniforms.visibility.value=visibility;uniforms.cosine.value=cosine;
 renderer.setRenderTarget(target);renderer.render(scene,camera);
 renderer.readRenderTargetPixels(target,0,0,1,1,pixel);
 if(shaderErrors.length||gl.getError()!==gl.NO_ERROR)throw Error('Native shader/GL failure '+shaderErrors.join(';'));
 return Array.from(pixel).slice(0,3);
}
function close(label,a,b,tolerance=3e-5){
 const error=Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
 if(!Number.isFinite(error)||error>tolerance)throw Error(label+': '+JSON.stringify({a,b,error}));
 results.push({label,maximumError:error,tolerance});
}
try{
 const phase=[.31,.15,1.2,.72],constant=[.52,.52,.52,.52];
 close('resolved identity and zero added variance',sample(phase,constant,1,false),[0,0,0]);
 for(const cosine of [false,true])for(const amplitude of [constant,[.13,.08,.19,.07]]){
  const q=phase.map(cosine?Math.cos:Math.sin);
  const full=[(amplitude[0]*q[0]-amplitude[1]*q[1])/.4,(amplitude[2]*q[2]-amplitude[3]*q[3])/.4];
  const amplitudeOnly=[(amplitude[0]-amplitude[1])*(q[0]+q[1])/.8,(amplitude[2]-amplitude[3])*(q[2]+q[3])/.8];
  const correction=sample(phase,amplitude,0,cosine);
  close((cosine?'cosine':'sine')+' suppressed phase preserves amplitude gradient',full.map((v,i)=>v+correction[i]),amplitudeOnly);
 }
 // Across a complete common phase cycle, retained slope energy plus reported
 // unresolved variance must equal the original finite-difference phase energy.
 for(const visibility of [0,.35,.8,1]){
  let original=0,retained=0,variance=0;
  for(let i=0;i<64;i++){
   const p=phase.map(v=>v+i*Math.PI*2/64),q=p.map(Math.sin);
   const raw=[.52*(q[0]-q[1])/.4,.52*(q[2]-q[3])/.4];
   const out=sample(p,constant,visibility,false);
   original+=raw.reduce((s,v)=>s+v*v,0)/64;
   retained+=raw.reduce((s,v,j)=>s+(v+out[j])**2,0)/64;variance+=out[2]/64;
  }
  close('energy transfer at visibility '+visibility,[retained+variance],[original]);
 }
 const sourceSHA256=crypto.createHash('sha256').update(await fs.readFile(new URL('../../src/world/water-slope-filter.ts',import.meta.url))).digest('hex');
 const report={method:'Actual production GLSL via native ANGLE float framebuffer; independent Float64 invariant checks, not browser QA',at:new Date().toISOString(),sourceSHA256,renderer:gl.getParameter(gl.RENDERER),shaderErrors,glError:0,passed:true,results};
 const output=process.argv[2]||'artifacts/phase3/swell-filter/slope-proof.json';
 await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{renderer.setRenderTarget(null);material.dispose();plane.geometry.dispose();target.dispose();renderer.dispose();gl.destroy();}
