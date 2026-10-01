// Browser selection only: scene quality, passes, assets and export are unchanged.
export function validateCaptureBackend(value='software'){
 if(!['software','hardware'].includes(value))throw Error('backend must be software or hardware');
 return value;
}

export function captureLaunchOptions({backend='software',executablePath,jsHeapMiB}={}){
 validateCaptureBackend(backend);
 const jsFlags=jsHeapMiB===undefined?[]:[`--js-flags=--max-old-space-size=${jsHeapMiB}`];
 if(backend==='software')return {executablePath,headless:true,timeout:120000,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--force-color-profile=srgb',...jsFlags]};
 // Playwright disables Chromium's sandbox by default. Enable it explicitly for
 // the local route, and use its installed full Chromium/new-headless channel.
 return {executablePath,...(executablePath?{}:{channel:'chromium'}),chromiumSandbox:true,headless:true,timeout:120000,
  ignoreDefaultArgs:['--enable-unsafe-swiftshader'],
  args:['--force-color-profile=srgb',...jsFlags]};
}

// This self-contained function runs in an empty browser page BEFORE scene load.
// Release the tiny context before navigating to the full production scene.
export function probeHardwareWebGL2(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
 let gl;
 try{
  gl=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance'});
  if(!gl)return {available:false,reason:'WebGL2 context creation returned null'};
  const extension=gl.getExtension('WEBGL_debug_renderer_info');
  return {available:true,version:gl.getParameter(gl.VERSION),
   renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
   vendor:extension?gl.getParameter(extension.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),
   unmaskedRendererAvailable:!!extension,samples:gl.getParameter(gl.SAMPLES)};
 }catch(error){return {available:false,reason:String(error)};}
 finally{gl?.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();}
}

export function assertHardwareGraphics(graphics){
 const advice='Use a local hardware-accelerated Chromium with a working GPU driver; hardware mode will not fall back to software.';
 if(graphics?.available===false||!/^WebGL\s+2(?:\.0)?\b/i.test(graphics?.version??''))throw Error('Hardware capture requires WebGL2: '+(graphics?.reason??graphics?.version??'unavailable')+'. '+advice);
 if(graphics.unmaskedRendererAvailable!==true||typeof graphics.renderer!=='string'||!graphics.renderer.trim()
  ||/^(unknown|unavailable|disabled|webkit webgl|webgl|angle|generic)$/i.test(graphics.renderer.trim()))throw Error('Hardware capture cannot verify the unmasked WebGL renderer. '+advice);
 if(/swiftshader|llvmpipe|softpipe|lavapipe|swrast|software|basic render|microsoft basic|\bwarp\b|disabled/i.test(graphics.renderer))throw Error('Hardware capture rejected software renderer: '+graphics.renderer+'. '+advice);
 if(!Number.isInteger(graphics.samples)||graphics.samples<0)throw Error('Hardware capture could not verify the framebuffer sample count. '+advice);
 return graphics;
}

export function assertHardwareGraphicsMatch(graphics,expected){
 assertHardwareGraphics(graphics);assertHardwareGraphics(expected);
 if(graphics.backend!=='hardware'||expected.backend!=='hardware')throw Error('Hardware checkpoint graphics require an explicit hardware backend');
 for(const key of ['renderer','version','samples','backend'])if(graphics[key]!==expected[key])throw Error('Hardware checkpoint graphics mismatch for '+key+': expected '+JSON.stringify(expected[key])+', received '+JSON.stringify(graphics[key])+'. Start a new output directory for a different GPU/browser configuration.');
 return graphics;
}
