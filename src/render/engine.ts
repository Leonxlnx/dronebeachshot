import * as THREE from 'three';
export type Tier='high'|'balanced'|'low';
export const tiers={high:{dpr:1.5,shadow:2048,exposure:1.08},balanced:{dpr:1.1,shadow:1024,exposure:1.08},low:{dpr:.8,shadow:0,exposure:1.08}};
export function createEngine(canvas:HTMLCanvasElement){let renderer:THREE.WebGLRenderer;let contextFallback=false;try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false,preserveDrawingBuffer:true});}catch{contextFallback=true;const context=canvas.getContext('webgl2',{antialias:false,powerPreference:'default',alpha:false,preserveDrawingBuffer:true});if(!context)throw Error('WebGL2 is unavailable in this browser, including the low-resource context.');renderer=new THREE.WebGLRenderer({canvas,context,alpha:false,preserveDrawingBuffer:true});}renderer.info.autoReset=false;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;const shaderErrors:string[]=[];renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{shaderErrors.push([gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)].filter(Boolean).join("\n"));};const scene=new THREE.Scene();scene.background=new THREE.Color(0xa4a89a);scene.fog=new THREE.FogExp2(0x9daca7,.00014);const camera=new THREE.PerspectiveCamera(54,1,.4,22000);function resize(tier:Tier,capture=false){renderer.setPixelRatio(capture?1:Math.min(window.devicePixelRatio,tiers[tier].dpr));renderer.setSize(window.innerWidth,window.innerHeight);camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix()}return {renderer,scene,camera,resize,shaderErrors,contextFallback};}

/** Canvas exports require opaque alpha; leave multisample RGB coverage intact. */
export function sealOpaqueCanvas(renderer:THREE.WebGLRenderer){
 if(renderer.getRenderTarget()!==null)throw Error('Opaque canvas seal requires the default framebuffer');
 const gl=renderer.getContext(),mask=gl.getParameter(gl.COLOR_WRITEMASK) as boolean[],clear=gl.getParameter(gl.COLOR_CLEAR_VALUE) as Float32Array;
 const scissor=gl.isEnabled(gl.SCISSOR_TEST);
 try{gl.disable(gl.SCISSOR_TEST);gl.colorMask(false,false,false,true);gl.clearColor(clear[0],clear[1],clear[2],1);gl.clear(gl.COLOR_BUFFER_BIT);}
 finally{gl.colorMask(mask[0],mask[1],mask[2],mask[3]);gl.clearColor(clear[0],clear[1],clear[2],clear[3]);if(scissor)gl.enable(gl.SCISSOR_TEST);}
}
