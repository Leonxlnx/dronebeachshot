import fs from 'node:fs/promises';
import nodeGles from 'node-gles-webgl2';
import * as THREE from '/workspace/sites/last-light-bay/node_modules/three/build/three.module.js';
import {OutputPass} from '/workspace/sites/last-light-bay/node_modules/three/examples/jsm/postprocessing/OutputPass.js';
import {wrapNativeGL} from './native-gl-compat.mjs';
const width=128,height=64;
const gl=wrapNativeGL(nodeGles.createWebGLRenderingContext({width,height,majorVersion:3}));
const canvas={width,height,style:{},addEventListener(){},removeEventListener(){},getContext(){return gl}};gl.canvas=canvas;
const r=new THREE.WebGLRenderer({canvas,context:gl,alpha:false});r.setSize(width,height,false);r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.08;
const errors=[];r.debug.onShaderError=(g,p,v,f)=>errors.push([g.getProgramInfoLog(p),g.getShaderInfoLog(v),g.getShaderInfoLog(f)]);
const s=new THREE.Scene(),c=new THREE.Camera();
const m=new THREE.ShaderMaterial({vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`void main(){float n=floor(gl_FragCoord.x/16.);float v=pow(2.,n-3.);gl_FragColor=vec4(vec3(v,v*.4,v*.09),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`});
s.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),m));
const arrays=[],report={samples:[],shaderErrors:errors};
for(const samples of [null,0,4]){
 const target=samples===null?null:new THREE.WebGLRenderTarget(width,height,{samples,type:THREE.HalfFloatType,colorSpace:THREE.LinearSRGBColorSpace,generateMipmaps:false});
 r.setRenderTarget(target);r.render(s,c);r.setRenderTarget(null);
 if(target){const output=new OutputPass();output.renderToScreen=true;output.render(r,null,target);output.dispose();}
 gl.finish();const bytes=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);arrays.push(bytes);
 report.samples.push({samples,colors:Array.from({length:8},(_,i)=>[...bytes.slice(((height/2)*width+i*16+8)*4,((height/2)*width+i*16+8)*4+4)])});target?.dispose();
}
report.comparisons=arrays.slice(1).map((a,i)=>{let max=0,sum=0;for(let j=0;j<a.length;j++){const d=Math.abs(a[j]-arrays[0][j]);max=Math.max(max,d);sum+=d;}return {samples:i===0?0:4,maxByteDifference:max,meanByteDifference:sum/a.length};});
report.glError=gl.getError();await fs.writeFile('native-output-proof.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));r.dispose();gl.destroy();if(errors.length||report.glError||report.comparisons.some(x=>x.maxByteDifference>1))throw Error('Output mismatch');
