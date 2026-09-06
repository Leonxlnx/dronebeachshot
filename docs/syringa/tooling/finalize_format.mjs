import fs from 'node:fs/promises';import path from 'node:path';import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
const root=path.resolve(import.meta.dirname,'..'),io=new NodeIO().registerExtensions(ALL_EXTENSIONS);const stats=JSON.parse(await fs.readFile(path.join(root,'optimization-stats.json'),'utf8'));
for(const lod of ['hero','medium','far']){const p=path.join(root,`optimized/syringa-tree-${lod}.glb`),d=await io.read(p);d.createExtension(EXTTextureWebP).setRequired(true);await io.write(p,d);stats.find(s=>s.lod===lod).bytes=(await fs.stat(p)).size;}
await fs.writeFile(path.join(root,'optimization-stats.json'),JSON.stringify(stats,null,2)+'\n');
