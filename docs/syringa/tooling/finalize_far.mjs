import fs from 'node:fs/promises';import path from 'node:path';import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {prune} from '@gltf-transform/functions';
const root=path.resolve(import.meta.dirname,'..'),io=new NodeIO().registerExtensions(ALL_EXTENSIONS),file=path.join(root,'optimized/syringa-tree-far.glb'),d=await io.read(file),mesh=d.getRoot().listMeshes()[0],buffer=d.getRoot().listBuffers()[0];
for(const p of mesh.listPrimitives())if((p.getMaterial().getName().endsWith('leaves')||p.getMaterial().getName().endsWith('canopy_bake')))mesh.removePrimitive(p);
const bake=JSON.parse(await fs.readFile(path.join(root,'far-canopy.json'),'utf8'));
const cardScale=1.0;
for(let i=0;i<bake.positions.length;i+=4){const center=[0,0,0];for(let k=0;k<4;k++)for(let a=0;a<3;a++)center[a]+=bake.positions[i+k][a]/4;for(let k=0;k<4;k++)for(let a=0;a<3;a++)bake.positions[i+k][a]=center[a]+(bake.positions[i+k][a]-center[a])*cardScale;}
const tex=d.createTexture('Source canopy albedo bake').setImage(await fs.readFile(path.join(root,'optimized/far-canopy-atlas.png'))).setMimeType('image/png');
const mat=d.createMaterial('tree_small_02_canopy_bake').setBaseColorTexture(tex).setAlphaMode('MASK').setAlphaCutoff(.45).setDoubleSided(true).setMetallicFactor(0).setRoughnessFactor(.92);
const p=d.createPrimitive().setMaterial(mat);
for(const [field,semantic,type] of [['positions','POSITION','VEC3'],['normals','NORMAL','VEC3'],['uvs','TEXCOORD_0','VEC2']])p.setAttribute(semantic,d.createAccessor().setBuffer(buffer).setType(type).setArray(new Float32Array(bake[field].flat())));
p.setIndices(d.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(new Uint32Array(bake.indices)));mesh.addPrimitive(p);
d.getRoot().listNodes()[0].setExtras({...d.getRoot().listNodes()[0].getExtras(),canopyBakeCells:bake.cellCount,canopyCardScale:cardScale,canopyAlphaKeep:.68,canopyBakeSource:'Original source, two orthogonal albedo renders per spatial cell'});
await d.transform(prune());await io.write(file,d);
const stats=JSON.parse(await fs.readFile(path.join(root,'optimization-stats.json'),'utf8'));let far=stats.find(s=>s.lod==='far');far.primitives=far.primitives.filter(s=>!s.material.endsWith('leaves')&&!s.material.endsWith('canopy_bake'));far.primitives.push({material:'tree_small_02_canopy_bake',triangles:bake.indices.length/3,sourceTriangles:1939380,method:'Spatial canopy albedo cards',cardScale,alphaKeep:.68,cells:bake.cellCount});far.triangles=far.primitives.reduce((s,p)=>s+p.triangles,0);far.bytes=(await fs.stat(file)).size;await fs.writeFile(path.join(root,'optimization-stats.json'),JSON.stringify(stats,null,2)+'\n');console.log(far);
