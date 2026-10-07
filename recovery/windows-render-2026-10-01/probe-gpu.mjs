import fs from 'node:fs';
import {chromium} from './dronebeachshot/node_modules/playwright/index.mjs';
import {captureLaunchOptions,probeHardwareWebGL2,assertHardwareGraphics} from './dronebeachshot/scripts/control/progress-backend.mjs';
const results=[];
for(const angle of ['d3d11','gl']){
  let browser;
  try{
    const options=captureLaunchOptions({backend:'hardware'});
    browser=await chromium.launch({...options,args:[...options.args,'--use-angle='+angle]});
    const page=await browser.newPage();
    const graphics=await page.evaluate(probeHardwareWebGL2);
    const limits=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2');if(!gl)return null;return {fragmentTextureUnits:gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),vertexTextureUnits:gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),combinedTextureUnits:gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)}});
    assertHardwareGraphics(graphics);
    results.push({angle,graphics,limits,hardwareVerified:true});
  }catch(error){results.push({angle,error:String(error),hardwareVerified:false});}
  finally{await browser?.close();}
}
fs.writeFileSync(new URL('../outputs/gpu-capabilities.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
