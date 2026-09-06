import * as THREE from 'three';

// Technical filtering correction only: the alpha byte and covered surface colors
// stay unchanged. RGB enters texture filtering premultiplied in linear light.
const derivedMaps = new WeakMap<THREE.Texture, THREE.DataTexture>();
const decodeSRGB = (v:number) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const encodeSRGB = (v:number) => v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055;
export function alphaWeightRGBA(data:ArrayLike<number>, width:number, height:number,
 colorSpace:THREE.ColorSpace, flipRows=false) {
 if(data.length !== width*height*4) throw new Error('Expected an uncompressed RGBA color image');
 if(colorSpace !== THREE.SRGBColorSpace && colorSpace !== THREE.LinearSRGBColorSpace && colorSpace !== THREE.NoColorSpace)
  throw new Error('Unsupported color space for alpha-weighted color filtering');
 const out=new Uint8Array(data.length), srgb=colorSpace===THREE.SRGBColorSpace;
 for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
  const source=(y*width+x)*4, target=((flipRows?height-1-y:y)*width+x)*4;
  const alpha=data[source+3]/255;
  for(let channel=0;channel<3;channel++) {
   const raw=data[source+channel]/255, linear=srgb?decodeSRGB(raw):raw;
   out[target+channel]=Math.round(255*(srgb?encodeSRGB(linear*alpha):linear*alpha));
  }
  out[target+3]=data[source+3];
 }
 return out;
}

// Call after the source image has loaded, and before prepareTreeMaterial clones
// the source. Works with native DataTextures and browser decoded image sources.
export function alphaWeightedColorTexture(source:THREE.Texture):THREE.DataTexture {
 if(source.userData.alphaWeightedLinearRGB) return source as THREE.DataTexture;
 const cached=derivedMaps.get(source); if(cached) return cached;
 if(source.premultiplyAlpha) throw new Error('Input must contain straight-alpha source color');
 const image=source.image as {data?:ArrayLike<number>;width:number;height:number};
 const width=image.width,height=image.height;
 let rgba:ArrayLike<number>;
 if(image.data) {
  if(source.type!==THREE.UnsignedByteType || source.format!==THREE.RGBAFormat)
   throw new Error('Expected an unsigned-byte RGBA color texture');
  rgba=image.data;
 } else {
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(width,height):Object.assign(document.createElement('canvas'),{width,height});
  const context=canvas.getContext('2d',{willReadFrequently:true}) as OffscreenCanvasRenderingContext2D|CanvasRenderingContext2D|null;
  if(!context) throw new Error('Cannot read decoded color texture');
  context.drawImage(source.image,0,0);
  rgba=context.getImageData(0,0,width,height).data;
 }
 const data=alphaWeightRGBA(rgba,width,height,source.colorSpace,source.flipY);
 const result=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.UnsignedByteType);
 result.copy(source);
 // Texture.copy shares Source; detach it before installing derived pixels.
 result.source=new THREE.Source({data,width,height});
 result.mipmaps=[]; result.generateMipmaps=source.generateMipmaps;
 result.flipY=false; result.premultiplyAlpha=false;
 result.userData={...source.userData,alphaWeightedLinearRGB:true};
 result.name=source.name+' / linear alpha-weighted RGB';
 result.needsUpdate=true;derivedMaps.set(source,result);return result;
}

// Run after prepareTreeMaterial's shader binding on both returned materials.
// The map alpha itself and the later color/depth coverage code are untouched.
export function bindAlphaWeightedColor(material:THREE.Material & {map?:THREE.Texture|null}) {
 if(!material.map?.userData.alphaWeightedLinearRGB || material.userData.alphaWeightedColorBound) return;
 const previous=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  previous(shader,renderer);
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
   THREE.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',
    'sampledDiffuseColor.rgb /= max(sampledDiffuseColor.a, 0.00001);\n diffuseColor *= sampledDiffuseColor;'));
 };
 material.customProgramCacheKey=()=>key()+'-linear-alpha-weighted-map-v1';
 material.userData.alphaWeightedColorBound=true;material.needsUpdate=true;
}
