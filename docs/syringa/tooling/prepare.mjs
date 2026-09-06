import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {weld,dedup,prune,compactPrimitive,cloneDocument} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
const require=createRequire(import.meta.url),sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp':'sharp');
const ROOT=path.resolve(import.meta.dirname,'..'),io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
const source=await io.read(path.join(ROOT,'source/tree_small_02_1k.gltf'));
source.createExtension(EXTTextureWebP).setRequired(true);
const foliage=source.getRoot().listMaterials().find(m=>m.getName().endsWith('_leaves'));
// Source diffuse PNG carries the authored alpha; never removeAlpha+joinChannel.
const rgba=await fs.readFile(path.join(ROOT,'source/textures/tree_small_02_leaves_diff_1k.png'));
foliage.getBaseColorTexture().setImage(rgba).setMimeType('image/png');
foliage.setAlphaMode('MASK').setAlphaCutoff(.45).setDoubleSided(true);
for(const t of source.getRoot().listTextures()){
 const image=await sharp(t.getImage()).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).webp({quality:88,alphaQuality:100,lossless:t===foliage.getBaseColorTexture()}).toBuffer();
 t.setImage(image).setMimeType('image/webp');
}
await source.transform(weld(),dedup());
function coverage(p,factor){
 if(factor===1)return;
 const pos=p.getAttribute('POSITION').getArray(),idx=p.getIndices().getArray(),n=pos.length/3,parent=Uint32Array.from({length:n},(_,i)=>i);
 const find=i=>{while(i!==parent[i]){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(let i=0;i<idx.length;i+=3){parent[find(idx[i+1])]=find(idx[i]);parent[find(idx[i+2])]=find(idx[i]);}
 const groups=new Map();for(let i=0;i<n;i++){const k=find(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}
 for(const g of groups.values()){const center=[0,0,0];for(const i of g)for(let a=0;a<3;a++)center[a]+=pos[i*3+a]/g.length;for(const i of g)for(let a=0;a<3;a++)pos[i*3+a]=center[a]+(pos[i*3+a]-center[a])*factor;}
 p.getAttribute('POSITION').setArray(pos);return groups.size;
}
const log=[];
for(const [lod,targets,error,scale] of [['hero',[2200,21000,1800],.25,2.05],['medium',[600,4500,900],.5,3.8],['far',[140,720,180],.8,5.0]]){
 const d=cloneDocument(source);const out={lod,primitives:[],origin:[0,0,0],sourceRootPreserved:true};
 for(const p of d.getRoot().listMeshes()[0].listPrimitives()){
 const name=p.getMaterial().getName(),target=targets[name.endsWith('branches')?0:name.endsWith('leaves')?1:2],pos=p.getAttribute('POSITION').getArray(),n=pos.length/3;
 const attrs=p.listSemantics().filter(s=>s!=='POSITION' && s!=='TANGENT').map(s=>p.getAttribute(s));const stride=attrs.reduce((a,b)=>a+b.getElementSize(),0),attr=new Float32Array(n*stride);
 for(let i=0;i<n;i++){let offset=0;for(const a of attrs){const s=a.getElementSize(),arr=a.getArray();for(let c=0;c<s;c++)attr[i*stride+offset+c]=arr[i*s+c];offset+=s;}}
 const lock=new Uint8Array(n);if(name.endsWith('trunk'))for(let i=0;i<n;i++)if(pos[i*3+1]<.01)lock[i]=1;
 const old=p.getIndices().getArray();const [idx,e]=MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(old),pos,3,attr,stride,new Array(stride).fill(.015),lock,target*3,error,['Permissive','Prune']);
 p.setIndices(d.createAccessor().setBuffer(d.getRoot().listBuffers()[0]).setType('SCALAR').setArray(idx));compactPrimitive(p);
 const clusters=name.endsWith('leaves')?coverage(p,scale):undefined;
 out.primitives.push({material:name,sourceTriangles:old.length/3,targetTriangles:target,triangles:idx.length/3,error:e,leafScale:name.endsWith('leaves')?scale:1,leafComponents:clusters,lockedRootVertices:lock.reduce((a,b)=>a+b,0)});
 }
 d.getRoot().listNodes()[0].setName(`Wild Syringa ${lod}`);d.getRoot().listNodes()[0].setExtras({source:'https://polyhaven.com/a/tree_small_02',license:'CC0-1.0',groundRoot:[0,0,0],lod});
 await d.transform(prune());const file=path.join(ROOT,'optimized',`syringa-tree-${lod}.glb`);await io.write(file,d);out.triangles=out.primitives.reduce((a,b)=>a+b.triangles,0);out.bytes=(await fs.stat(file)).size;log.push(out);console.log(JSON.stringify(out));
}
await fs.writeFile(path.join(ROOT,'optimization-stats.json'),JSON.stringify(log,null,2)+'\n');
