import * as THREE from 'three';

type Parser={json:{images:Array<{bufferView?:number;mimeType?:string}>,textures:Array<{source?:number;extensions?:{EXT_texture_webp?:{source:number}}}>};
 associations:Map<object,{textures?:number}>;getDependency:(kind:string,index:number)=>Promise<ArrayBuffer>};
type Entry={bytes:Uint8Array;source:THREE.Texture['source']};

/** Share only byte-identical embedded images; each Texture keeps its sampler,
 * colour space, transform and material binding. Compatible uploads can then
 * share Three's GPU allocation. The per-load pool releases encoded bytes. */
export class EmbeddedImagePool {
 private entries=new Map<string,Entry[]>();
 readonly stats={uniqueImages:0,sharedImages:0};
 async share(scene:THREE.Object3D,parser:Parser){
  const textures=new Set<THREE.Texture>();
  scene.traverse(object=>{if(object instanceof THREE.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])
   for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);
  });
  for(const texture of textures){
   const index=parser.associations.get(texture)?.textures;if(index===undefined)continue;
   const def=parser.json.textures[index],sourceIndex=def.extensions?.EXT_texture_webp?.source??def.source;
   if(sourceIndex===undefined)continue;const image=parser.json.images[sourceIndex];
   if(image.bufferView===undefined)continue;
   const bytes=new Uint8Array(await parser.getDependency('bufferView',image.bufferView));
   let hash=2166136261;for(const byte of bytes)hash=Math.imul(hash^byte,16777619);
   const key=`${image.mimeType}:${bytes.length}:${hash}`,bucket=this.entries.get(key)??[];
   // Hashes only select candidates. Full equality prevents accidental aliases.
   const match=bucket.find(entry=>entry.bytes.every((byte,i)=>byte===bytes[i]));
   if(match){if(texture.source!==match.source){texture.source=match.source;texture.needsUpdate=true;this.stats.sharedImages++}}
   else{bucket.push({bytes,source:texture.source});this.entries.set(key,bucket);this.stats.uniqueImages++}
  }
 }
 clear(){this.entries.clear()}
}
