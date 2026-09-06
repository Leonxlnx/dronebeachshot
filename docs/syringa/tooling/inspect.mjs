import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {weld} from '@gltf-transform/functions';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);const d=await io.read(new URL('../source/tree_small_02_1k.gltf',import.meta.url).pathname);await d.transform(weld());
for(const p of d.getRoot().listMeshes()[0].listPrimitives()) {
 const pos=p.getAttribute('POSITION').getArray(),idx=p.getIndices().getArray(),n=pos.length/3;
 const parent=Uint32Array.from({length:n},(_,i)=>i);const find=i=>{while(i!==parent[i]){parent[i]=parent[parent[i]];i=parent[i];}return i;};for(let i=0;i<idx.length;i+=3){parent[find(idx[i+1])]=find(idx[i]);parent[find(idx[i+2])]=find(idx[i]);}
 const groups=new Map();for(let i=0;i<n;i++){const k=find(i);groups.set(k,(groups.get(k)||0)+1);}const dist={};for(const s of groups.values())dist[s]=(dist[s]||0)+1;
 console.log(p.getMaterial().getName(),{tris:idx.length/3,vertices:n,groups:groups.size,dist,uvs:p.listSemantics(),bounds:[p.getAttribute('POSITION').getMin([]),p.getAttribute('POSITION').getMax([])]});
}
