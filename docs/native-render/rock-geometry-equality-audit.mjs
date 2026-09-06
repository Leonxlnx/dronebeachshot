import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import * as THREE from '/workspace/sites/last-light-bay/node_modules/three/build/three.module.js';
import {GLTFLoader} from '/workspace/sites/last-light-bay/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {decodeRockGeometrySource} from './rock-geometry-decoder-native.ts';
import {upgradeNearRockOutcrops} from './photogrammetry-rock-native.ts';
import {createRocks} from '/workspace/sites/last-light-bay/src/world/terrain.ts';
import {createCoastalField} from '/workspace/sites/last-light-bay/src/world/coastal-field.ts';
import {renderedTerrainHeight} from '/workspace/sites/last-light-bay/src/world/terrain-surface.ts';
import {evaluationCameras,pathPosition} from '/workspace/sites/last-light-bay/src/camera/cinematic.ts';
import {installNativeAssetLoaders} from './native-asset-adapter.mjs';
const root='/workspace/scratch/2b912ce37941/native-render';
const sha=v=>createHash('sha256').update(v).digest('hex');
const raw=v=>Buffer.from(v.buffer,v.byteOffset,v.byteLength);
const pack=await fs.readFile(root+'/hero-rock-source/rock_moss_set_01_geometry.bin');
const arrayBuffer=pack.buffer.slice(pack.byteOffset,pack.byteOffset+pack.byteLength);
assert.equal(typeof globalThis.document,'undefined');assert.equal(typeof globalThis.window,'undefined');
const decoded=decodeRockGeometrySource(arrayBuffer);
assert.throws(()=>decodeRockGeometrySource(arrayBuffer.slice(0,12)),/truncated header/);
assert.throws(()=>decodeRockGeometrySource(arrayBuffer.slice(0,-4)),/inconsistent length/);
const wrongMagic=arrayBuffer.slice(0);new Uint8Array(wrongMagic)[0]=0;assert.throws(()=>decodeRockGeometrySource(wrongMagic),/unsupported format/);
const adapter=installNativeAssetLoaders({THREE,GLTFLoader,publicRoot:'/workspace/sites/last-light-bay/public',sharp});
const full=(await new GLTFLoader().loadAsync(root+'/hero-rock-source/rock_moss_set_01_2k.glb')).scene;full.updateMatrixWorld(true);
function meshes(g){const a=[];g.traverse(o=>{if(o.isMesh)a.push(o)});return a.sort((a,b)=>a.name.localeCompare(b.name))}
const originals=meshes(full),restored=meshes(decoded),streams=[];assert.equal(originals.length,6);assert.equal(restored.length,6);
for(let i=0;i<originals.length;i++){
 const a=originals[i],b=restored[i];assert.equal(a.name,b.name);assert.deepEqual(a.matrixWorld.elements,b.matrixWorld.elements);
 const pa=raw(a.geometry.attributes.position.array),pb=raw(b.geometry.attributes.position.array),ia=raw(a.geometry.index.array),ib=raw(b.geometry.index.array);
 assert.deepEqual(pb,pa);assert.deepEqual(ib,ia);assert.deepEqual(Object.keys(b.geometry.attributes),['position']);
 streams.push({name:a.name,positionBytes:pa.length,positionSha256:sha(pa),indexBytes:ia.length,indexSha256:sha(ia),matrixWorldExact:true});
}
const focusPoints=[...Array.from({length:81},(_,i)=>pathPosition(i*.25)),...Object.values(evaluationCameras).map(c=>c.position)];
const states=[];
for(const [label,source]of [['full-glb',full],['geometry-only',decoded]]){
 const rocks=createRocks({}),upgrade=upgradeNearRockOutcrops(rocks,source,{terrainHeight:renderedTerrainHeight,focusPoints});
 const geometryHashes=[];rocks.traverse(o=>{if(!o.isInstancedMesh)return;geometryHashes.push({name:o.name,count:o.count,positionSha256:sha(raw(o.geometry.attributes.position.array)),indexSha256:o.geometry.index?sha(raw(o.geometry.index.array)):null,matrixSha256:sha(raw(o.instanceMatrix.array))})});
 const field=createCoastalField(rocks),data=raw(field.texture.image.data),digest=sha(data);
 states.push({label,stats:upgrade.stats,geometryHashes,fieldSha256:digest,fieldBytes:data.length,diagnostics:field.diagnostics,fieldData:Buffer.from(data)});field.texture.dispose();console.log(label,digest,upgrade.stats.upgraded);
}
assert.deepEqual(states[0].stats,states[1].stats);assert.deepEqual(states[0].geometryHashes,states[1].geometryHashes);assert.deepEqual(states[0].fieldData,states[1].fieldData);
const dependencies={};for(const [name,path]of Object.entries({terrain:'/workspace/sites/last-light-bay/src/world/terrain.ts',math:'/workspace/sites/last-light-bay/src/world/math.ts',terrainSurface:'/workspace/sites/last-light-bay/src/world/terrain-surface.ts',camera:'/workspace/sites/last-light-bay/src/camera/cinematic.ts',coastalField:'/workspace/sites/last-light-bay/src/world/coastal-field.ts',upgrade:root+'/photogrammetry-rock-candidate.ts',decoder:root+'/rock-geometry-decoder-candidate.ts'}))dependencies[name]={path,sha256:sha(await fs.readFile(path))};
for(const state of states)delete state.fieldData;
const report={pass:true,three:THREE.REVISION,pack:{bytes:pack.length,sha256:sha(pack)},sourceStreamsExact:streams,allUpgradedPositionsIndicesInstanceMatricesExact:true,coastalFieldsByteIdentical:true,coastalFieldSha256:states[0].fieldSha256,fieldBytes:states[0].fieldBytes,decoderEnvironment:{document:typeof globalThis.document,window:typeof globalThis.window,requires:'Three only; synchronous CPU decoder; no images, DOM, WebGL or GLTFLoader'},malformedChecks:['truncated header','inconsistent length','wrong magic'],geometryOnlyImageDecodes:0,fullGltfReferenceImageDecodes:adapter.metrics.gltfImages,focusPoints:focusPoints.map(p=>p.toArray()),dependencies,states};
await fs.writeFile(root+'/rock-geometry-equality-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,pack:report.pack,coastalFieldSha256:report.coastalFieldSha256,fieldBytes:report.fieldBytes}));
