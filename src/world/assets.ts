import * as THREE from 'three';
import type {Textures} from '../render/materials';
const textureFiles={rock:'marble_cliff_03_diff_2k.webp',rockNormal:'marble_cliff_03_nor_gl_2k.webp',rockARM:'marble_cliff_03_arm_2k.webp',sand:'sand_03_diff_2k.webp',sandNormal:'sand_03_nor_gl_2k.webp',sandARM:'sand_03_arm_2k.webp',bark:'palm_bark_diff_1k.webp',barkNormal:'palm_bark_nor_gl_1k.webp',soil:'forest_ground_05_diff_2k.webp',soilNormal:'forest_ground_05_nor_gl_2k.webp',soilARM:'forest_ground_05_arm_2k.webp',moss:'forest_leaves_02_diff_2k.webp',mossNormal:'forest_leaves_02_nor_gl_2k.webp',mossARM:'forest_leaves_02_arm_2k.webp'};
export async function loadTextures(progress:(p:number,label:string)=>void):Promise<Textures>{const loader=new THREE.TextureLoader();let loaded=0;const entries=await Promise.all(Object.entries(textureFiles).map(async([key,path])=>{const tex=await loader.loadAsync('/assets/textures/'+path);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=['rock','rockNormal','rockARM','sand','sandNormal'].includes(key)?1:4;tex.colorSpace=['rock','sand','bark','soil','moss'].includes(key)?THREE.SRGBColorSpace:THREE.NoColorSpace;tex.name=path;progress(++loaded/Object.keys(textureFiles).length*40,'Loading coastal materials');return [key,tex] as const}));const textures=Object.fromEntries(entries) as Omit<Textures,'groundARM'>;return {...textures,groundARM:createGroundARMArray([textures.sandARM,textures.soilARM,textures.mossARM])};}

/** Three's DFG lookup makes the old ground shader exceed the 16-sampler floor.
 * These three linear scans share filtering; rock keeps its distinct anisotropy.
 * Retain CPU pixels for normal context re-upload and preserve every RGBA byte. */
export function createGroundARMArray(sources:readonly THREE.Texture[]):THREE.DataArrayTexture{
 if(sources.length!==3)throw Error('Ground ARM requires sand, soil and moss layers');
 const first=sources[0],{width,height}=first.image as {width:number;height:number};
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw Error('Ground ARM images must be loaded');
 const stride=width*4,layerBytes=stride*height,data=new Uint8Array(layerBytes*3);
 const settings=['wrapS','wrapT','magFilter','minFilter','anisotropy','generateMipmaps'] as const;
 for(const [layer,source]of sources.entries()){
  const image=source.image as {width:number;height:number;data?:Uint8Array|Uint8ClampedArray};
  if(image.width!==width||image.height!==height||source.format!==THREE.RGBAFormat||source.type!==THREE.UnsignedByteType
   ||source.colorSpace!==THREE.NoColorSpace||source.premultiplyAlpha||settings.some(key=>source[key]!==first[key]))throw Error('Ground ARM layers must share dimensions and linear RGBA sampler state');
  let rgba=image.data;
  if(!rgba){
   const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(width,height):Object.assign(document.createElement('canvas'),{width,height});
   const context=canvas.getContext('2d',{willReadFrequently:true}) as OffscreenCanvasRenderingContext2D|CanvasRenderingContext2D|null;
   if(!context)throw Error('Cannot read decoded ground ARM image');
   context.drawImage(source.image as CanvasImageSource,0,0);rgba=context.getImageData(0,0,width,height).data;
  }
  if(rgba.length!==layerBytes)throw Error('Ground ARM requires complete RGBA pixels');
  // Array uploads cannot flip typed rows. Match each original 2D upload here.
  for(let row=0;row<height;row++)data.set(rgba.subarray(row*stride,(row+1)*stride),layer*layerBytes+(source.flipY?height-1-row:row)*stride);
 }
 const texture=new THREE.DataArrayTexture(data,width,height,3);
 for(const key of settings)(texture[key] as number|boolean)=first[key];
 texture.name='sand-soil-moss ARM';texture.colorSpace=THREE.NoColorSpace;texture.flipY=false;texture.needsUpdate=true;
 return texture;
}
