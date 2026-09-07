import * as THREE from 'three';
import type {CoastalField} from './coastal-field';
import {rng,shoreDistance} from './math';
import {coastNormal,coastPhase,COAST} from './coastal';
import {worldTime,debugMode} from '../render/materials';
import {cloudLightingGLSL,cloudShadow,cloudShadowBounds,solarDirection} from '../render/sky-lighting';
import {diagnosticOutputShader} from '../render/diagnostics';
export function createRockSpray(field:CoastalField){
 const values=field.texture.image.data as Float32Array,n=field.diagnostics.resolution,b=field.bounds,dx=(b.z-b.x)/n,dz=(b.w-b.y)/n;
 const random=rng(247392),emitters:{x:number,z:number,nx:number,nz:number}[]=[];
 for(let row=1;row<n-1;row+=2)for(let col=1;col<n-1;col+=2){const i=row*n+col,distance=values[i*4+1];if(distance<0||distance>1.7)continue;
  const x=b.x+(col+.5)*dx,z=b.y+(row+.5)*dz,shore=shoreDistance(x,z);if(shore< -42||shore>1)continue;
  const gx=(values[(i+1)*4+1]-values[(i-1)*4+1])/(2*dx),gz=(values[(i+n)*4+1]-values[(i-n)*4+1])/(2*dz),len=Math.hypot(gx,gz);if(len<.1)continue;
  const normal=coastNormal(x),nx=gx/len,nz=gz/len;if(nx* -normal[0]+nz* -normal[1]<.45)continue;
  if(emitters.some(e=>Math.hypot(e.x-x,e.z-z)<8))continue;emitters.push({x,z,nx,nz});
 }
 const positions:number[]=[],velocities:number[]=[],seeds:number[]=[];
 for(const e of emitters)for(let j=0;j<16;j++){
  const side=(random()-.5)*2.8,out=.45+random()*1.7;
  positions.push(e.x+(random()-.5)*1.1,.22+random()*.18,e.z+(random()-.5)*1.1);
  velocities.push(e.nx*out-e.nz*side,2.1+random()*2.4,e.nz*out+e.nx*side);
  seeds.push((coastPhase(e.x,e.z,0)-Math.PI*.5)/COAST.angularSpeed+random()*.16,.35+random()*.58,.025+random()*.05);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('aVelocity',new THREE.Float32BufferAttribute(velocities,3));geometry.setAttribute('aSeed',new THREE.Float32BufferAttribute(seeds,3));geometry.computeBoundingSphere();if(geometry.boundingSphere)geometry.boundingSphere.radius+=5;
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:worldTime,uDebug:debugMode,uCloudShadow:cloudShadow,uCloudShadowBounds:cloudShadowBounds,uSolarDirection:solarDirection,uBufferHeight:{value:1},uPointLimit:{value:1}},vertexShader:`
 uniform float uTime,uBufferHeight,uPointLimit;attribute vec3 aVelocity,aSeed;varying float vOpacity;varying vec3 vWorld;
 void main(){float age=mod(uTime-aSeed.x,${(Math.PI*2/COAST.angularSpeed).toFixed(8)});vec3 p=position+aVelocity*age+vec3(0.,-4.905*age*age,0.);vWorld=p;vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;
 // aSeed.z is a world-space diameter. Capture resolution and camera FOV must
 // change pixel size exactly as they do for the surrounding rock geometry.
 float pixelDiameter=aSeed.z*.5*uBufferHeight*projectionMatrix[1][1]/max(-view.z,.1);
 gl_PointSize=clamp(pixelDiameter,.5,uPointLimit);
 float subpixelCoverage=pow(min(pixelDiameter/.5,1.),2.);
 vOpacity=(1.-smoothstep(aSeed.y*.4,aSeed.y,age))*smoothstep(-.1,.12,p.y)*subpixelCoverage;if(age>aSeed.y)gl_Position=vec4(2.,2.,2.,1.);}`,fragmentShader:diagnosticOutputShader(`
 uniform float uDebug;varying float vOpacity;varying vec3 vWorld;${cloudLightingGLSL}
 void main(){vec2 q=gl_PointCoord*2.-1.;float alpha=(1.-smoothstep(.2,1.,dot(q,q)))*vOpacity*.62;if(alpha<.01)discard;vec3 color=mix(vec3(.44,.54,.56),vec3(.92,.83,.65),atmosphericSunlight(vWorld));if(uDebug==10.)color=vec3(1.);if(uDebug!=0.&&uDebug!=10.)discard;gl_FragColor=vec4(color,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`)});
 const points=new THREE.Points(geometry,material),bufferSize=new THREE.Vector2();
 let graphicsContext:WebGLRenderingContext|WebGL2RenderingContext|undefined;
 points.onBeforeRender=renderer=>{
  renderer.getDrawingBufferSize(bufferSize);material.uniforms.uBufferHeight.value=bufferSize.y;
  const gl=renderer.getContext();
  if(graphicsContext!==gl){graphicsContext=gl;material.uniforms.uPointLimit.value=gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1]}
 };
 points.name='wave-triggered-rock-spray';points.userData.emitters=emitters.length;points.userData.droplets=positions.length/3;return points;
}
