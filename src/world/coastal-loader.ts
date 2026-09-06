import * as THREE from 'three';
import {COASTAL_FIELD_SIZE,type CoastalField} from './coastal-field';
/** Keep terrain rasterization off the UI thread and overlap it with asset fetches. */
export function loadCoastalField(){
 const worker=new Worker(new URL('./coastal-worker.ts',import.meta.url),{type:'module'});
 const promise=new Promise<CoastalField>((resolve,reject)=>{
  worker.onerror=event=>{worker.terminate();reject(Error('Coastal field could not be built: '+event.message))};
  worker.onmessage=event=>{
   worker.terminate();const result=event.data;if(result.error){reject(Error(result.error));return}
   const data=new Float32Array(result.data);
   if(data.length!==COASTAL_FIELD_SIZE*COASTAL_FIELD_SIZE*4){reject(Error('Coastal field buffer has invalid dimensions'));return}
   const texture=new THREE.DataTexture(data,COASTAL_FIELD_SIZE,COASTAL_FIELD_SIZE,THREE.RGBAFormat,THREE.FloatType);
   texture.name='coastal-terrain-rock-field';texture.internalFormat='RGBA32F';texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.flipY=false;texture.needsUpdate=true;
   resolve({texture,bounds:new THREE.Vector4(...result.bounds as [number,number,number,number]),diagnostics:result.diagnostics});
  };
  worker.postMessage({build:true});
 });
 return {promise,cancel:()=>worker.terminate()};
}
