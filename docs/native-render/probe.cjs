const nodeGles = require('node-gles-webgl2');
const fs = require('node:fs');
const result = { method: 'native ANGLE WebGL2, no browser process', package: 'node-gles-webgl2@0.4.0', at: new Date().toISOString() };
let gl;
try {
  gl = nodeGles.createWebGLRenderingContext({width:16,height:16,majorVersion:3,minorVersion:0});
  result.version=gl.getParameter(gl.VERSION);
  result.renderer=gl.getParameter(gl.RENDERER);
  result.vendor=gl.getParameter(gl.VENDOR);
  result.extensions=gl.getSupportedExtensions();
  gl.viewport(0,0,16,16);
  gl.clearColor(.2,.4,.6,1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const pixel=new Uint8Array(4);
  gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
  result.pixel=Array.from(pixel);
  result.error=gl.getError();
  result.success=pixel.every((v,i)=>Math.abs(v-[51,102,153,255][i])<=1)&&result.error===gl.NO_ERROR;
} catch(e) { result.success=false; result.failure=String(e); }
finally { if(gl)gl.destroy(); }
fs.writeFileSync(__dirname+'/probe-result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
process.exitCode=result.success?0:1;
