// Tiny raw WebGL2 fixture: two source-function variants, 128 square, no scene.
window.runWindRippleStudy=async()=>{
 const fixture=await fetch('/fixture.json').then(r=>r.json()),packed=new Float32Array(await fetch('/inputs.bin').then(r=>r.arrayBuffer()));
 const size=fixture.size;if(size>128)throw Error('Fixture exceeds128 square');
 const canvas=document.querySelector('canvas');canvas.width=canvas.height=size;
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});if(!gl)throw Error('WebGL2 unavailable');
 if(!gl.getExtension('EXT_color_buffer_float'))throw Error('Float target unavailable');
 const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2'),textures=[],programs=[],queries=[];let fbo,vao;
 const shader=(kind,source)=>{const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
 const vertex=shader(gl.VERTEX_SHADER,'#version 300 es\nprecision highp float;const vec2 p[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));void main(){gl_Position=vec4(p[gl_VertexID],0.,1.);}');
 function program(fn){const source=`#version 300 es
precision highp float;precision highp sampler2D;
uniform sampler2D inputs0,inputs1;out vec4 result;
float unresolvedWaterSlopeVariance=0.;
${fn}
void main(){ivec2 cell=ivec2(gl_FragCoord.xy);vec4 a=texelFetch(inputs0,cell,0),b=texelFetch(inputs1,cell,0);vec2 p=a.xy;float t=a.z;vec2 pixelDx=vec2(a.w,b.x),pixelDy=b.yz;
vec2 along=normalize(vec2(${fixture.wind[0]},${fixture.wind[1]})),across=vec2(-along.y,along.x);vec2 ripples=vec2(0.);unresolvedWaterSlopeVariance=0.;
${fixture.calls}
result=vec4(ripples,unresolvedWaterSlopeVariance,1.);}`;
  const fragment=shader(gl.FRAGMENT_SHADER,source),p=gl.createProgram();gl.attachShader(p,vertex);gl.attachShader(p,fragment);gl.linkProgram(p);gl.deleteShader(fragment);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));programs.push(p);return p;
 }
 function texture(data){const t=gl.createTexture();textures.push(t);gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,size,size,0,gl.RGBA,gl.FLOAT,data);return t}
 try{
  const a=program(fixture.original),b=program(fixture.candidate),data0=new Float32Array(size*size*4),data1=new Float32Array(data0.length);for(let i=0;i<size*size;i++){data0.set(packed.subarray(i*8,i*8+4),i*4);data1.set(packed.subarray(i*8+4,i*8+8),i*4)}
  const input0=texture(data0),input1=texture(data1),target=texture(null);fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Float framebuffer incomplete');
  vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.viewport(0,0,size,size);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
  for(const p of [a,b]){gl.useProgram(p);gl.uniform1i(gl.getUniformLocation(p,'inputs0'),0);gl.uniform1i(gl.getUniformLocation(p,'inputs1'),1)}
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,input0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,input1);
  const draw=p=>{gl.useProgram(p);gl.drawArrays(gl.TRIANGLES,0,3);gl.finish();if(gl.getError()!==gl.NO_ERROR||gl.isContextLost())throw Error('GL draw failure')};
  for(let i=0;i<2;i++){draw(a);draw(b)}
  const timings=[];for(let i=0;i<8;i++)for(const key of i%2?['on','off']:['off','on']){
   const q=timer?gl.createQuery():null;if(q){queries.push(q);gl.beginQuery(timer.TIME_ELAPSED_EXT,q)}const began=performance.now();gl.useProgram(key==='on'?b:a);gl.drawArrays(gl.TRIANGLES,0,3);if(q)gl.endQuery(timer.TIME_ELAPSED_EXT);gl.finish();if(gl.getError()!==gl.NO_ERROR||gl.isContextLost())throw Error('Timed GL draw failure');const wallMilliseconds=performance.now()-began;
   let nanoseconds=null;if(q){const deadline=performance.now()+5000;while(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){if(performance.now()>deadline)throw Error('Timer query deadline');await new Promise(requestAnimationFrame)}if(!gl.getParameter(timer.GPU_DISJOINT_EXT))nanoseconds=gl.getQueryParameter(q,gl.QUERY_RESULT)}
   timings.push({variant:key,wallMilliseconds,gpuNanoseconds:nanoseconds});
  }
  const read=p=>{draw(p);const pixels=new Float32Array(size*size*4);gl.readPixels(0,0,size,size,gl.RGBA,gl.FLOAT,pixels);if(gl.getError()!==gl.NO_ERROR)throw Error('Float readback failure');return pixels};
  const off=read(a),on=read(b),offBits=new Uint32Array(off.buffer),onBits=new Uint32Array(on.buffer),maxAbsolute=[0,0,0,0];let bitDifferences=0,signedZeroDifferences=0,nonfinite=0;
  for(let i=0;i<off.length;i++){if(!Number.isFinite(off[i])||!Number.isFinite(on[i]))nonfinite++;if(offBits[i]!==onBits[i]){bitDifferences++;if(off[i]===0&&on[i]===0)signedZeroDifferences++}maxAbsolute[i%4]=Math.max(maxAbsolute[i%4],Math.abs(off[i]-on[i]))}
  return{ok:nonfinite===0&&bitDifferences===signedZeroDifferences,size,pixels:size*size,sourceSHA256:fixture.sourceSHA256,inputSHA256:fixture.inputSHA256,outputs:['rippleSlopeX','rippleSlopeZ','unresolvedVariance','one'],bitDifferences,signedZeroDifferences,nonfinite,maxAbsolute,timerAvailable:!!timer,timings,limits:['Only exact64-component ripple GLSL; not a water/scene image or full-frame speedup.','Synthetic/data-texture inputs prevent measuring real quad divergence or complete ocean shader scheduling.','Wall timing includes CPU synchronization; GPU query timing is reported only when available and not disjoint.']};
 }finally{for(const q of queries)gl.deleteQuery(q);for(const p of programs)gl.deleteProgram(p);gl.deleteShader(vertex);for(const t of textures)gl.deleteTexture(t);if(fbo)gl.deleteFramebuffer(fbo);if(vao)gl.deleteVertexArray(vao);gl.getExtension('WEBGL_lose_context')?.loseContext();}
};
