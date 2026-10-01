import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {createForestFloor} from '../../src/world/forest-floor.ts';
import {createForestStructure} from '../../src/world/forest-structure.ts';
import {treePlacements} from '../../src/world/ecology.ts';
import {EAST_SPUR_STUDY_ENABLED} from '../../src/world/east-spur.ts';
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const packed=array=>({type:array.constructor.name,data:Buffer.from(array.buffer,array.byteOffset,array.byteLength).toString('base64')});
const textures=Object.fromEntries(['rock','rockNormal','rockARM','sand','sandNormal','sandARM','bark','barkNormal','soil','soilNormal','soilARM','moss','mossNormal','mossARM'].map(name=>[name,new THREE.Texture()]));
const trees=treePlacements(),floor=createForestFloor(textures,trees),structure=createForestStructure(textures,trees),coastal=createForestStructure(textures,trees,{coastalSampling:true});
function mesh(m){return{name:m.name,count:m.count,attributes:Object.fromEntries(Object.entries(m.geometry.attributes).map(([key,a])=>[key,packed(a.array)])),index:m.geometry.index?packed(m.geometry.index.array):null,matrix:m.instanceMatrix?packed(m.instanceMatrix.array.slice(0,m.count*16)):null,color:m.instanceColor?packed(m.instanceColor.array.slice(0,m.count*3)):null,sourceOrdinals:m.userData.sourceOrdinals??null}}
function group(g){return{meshes:g.children.map(mesh),data:g.userData}}
const result={studyEnabled:EAST_SPUR_STUDY_ENABLED,treeSha:sha(JSON.stringify(trees)),trees,floor:group(floor),structure:group(structure.group),coastal:group(coastal.group),sources:Object.fromEntries(['forest-floor','forest-structure','rock-local-refit','east-spur','math','ecology'].map(name=>[name,sha(fs.readFileSync('src/world/'+name+'.ts'))]))};
const out=process.argv[2];if(!out)throw Error('Supply output JSON path');const json=JSON.stringify(result)+'\n';fs.writeFileSync(out,out.endsWith('.gz')?gzipSync(json):json);
console.log(JSON.stringify({out,studyEnabled:EAST_SPUR_STUDY_ENABLED,trees:trees.length,floor:floor.userData.counts,structure:structure.group.userData.counts,coastal:coastal.group.userData.counts}));
