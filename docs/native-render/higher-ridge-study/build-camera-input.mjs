import fs from 'node:fs/promises';
import * as THREE from '/workspace/sites/last-light-bay/node_modules/three/build/three.module.js';
import {pathPosition,evaluationCameras} from '/workspace/sites/last-light-bay/src/camera/cinematic.ts';
import {treePlacements} from './src/world/ecology-unculled.ts';
import {renderedTerrainHeight} from './src/world/terrain-surface.ts';
import {terrainHeight,shoreDistance} from './src/world/math.ts';
import {createRocks} from './src/world/terrain.ts';
import {createCoastalField} from './src/world/coastal-field.ts';
import {WIND} from '/workspace/sites/last-light-bay/src/world/weather.ts';
const out='/workspace/scratch/2b912ce37941/native-render/higher-ridge-study';
const placements=treePlacements();console.log('unculled trees',placements.length);
const audit=JSON.parse(await fs.readFile('/workspace/scratch/2b912ce37941/native-render/tree-geometry-scale-audit.json','utf8'));
const families=['island','syringa','palm'].map(family=>{const box=new THREE.Box3();for(const m of audit.models.filter(m=>m.family===family))box.union(new THREE.Box3(new THREE.Vector3().fromArray(m.productionUnion.min),new THREE.Vector3().fromArray(m.productionUnion.max)));return box});
const windAxis=new THREE.Vector3(WIND[1],0,-WIND[0]).normalize(),up=new THREE.Vector3(0,1,0),tilt=new THREE.Quaternion(),dummy=new THREE.Object3D();
const bins=new Map();const boxes=[];
for(const p of placements){
 dummy.position.set(p.x,p.y,p.z);dummy.quaternion.setFromAxisAngle(up,p.angle).premultiply(tilt.setFromAxisAngle(windAxis,p.variant===2?.055*p.exposure:.016));dummy.scale.set(p.scale*(1+p.variant*.06),p.scale,p.scale);dummy.updateMatrix();
 const box=families[p.family].clone().applyMatrix4(dummy.matrix);box.min.x-=1;box.max.x+=1;box.min.z-=1;box.max.z+=1;box.max.y+=.05;
 const record={min:box.min.toArray(),max:box.max.toArray(),root:[p.x,p.y,p.z],family:p.family};boxes.push(record);
 for(let gx=Math.floor(box.min.x/25);gx<=Math.floor(box.max.x/25);gx++)for(let gz=Math.floor(box.min.z/25);gz<=Math.floor(box.max.z/25);gz++){const key=gx+','+gz;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(record)}
}
function boundsAt(x,z){const options=bins.get(Math.floor(x/25)+','+Math.floor(z/25))||[];let top=null;for(const b of options)if(x>=b.min[0]&&x<=b.max[0]&&z>=b.min[2]&&z<=b.max[2])top=Math.max(top??-Infinity,b.max[1]);return top}
const rocks=createRocks({});rocks.updateWorldMatrix(true,true);const rockBoxes=[];
const localMatrix=new THREE.Matrix4(),worldMatrix=new THREE.Matrix4();
rocks.traverse(mesh=>{if(!mesh.isInstancedMesh)return;mesh.geometry.computeBoundingBox();for(let i=0;i<mesh.count;i++){
 mesh.getMatrixAt(i,localMatrix);worldMatrix.multiplyMatrices(mesh.matrixWorld,localMatrix);const box=mesh.geometry.boundingBox.clone().applyMatrix4(worldMatrix);
 rockBoxes.push({min:box.min.toArray(),max:box.max.toArray()});
}});
function rocksAt(x,z){let top=null;for(const b of rockBoxes)if(x>=b.min[0]-.4&&x<=b.max[0]+.4&&z>=b.min[2]-.4&&z<=b.max[2]+.4)top=Math.max(top??-Infinity,b.max[1]);return top}
console.log('candidate rocks',rockBoxes.length);const field=createCoastalField(rocks);const coastalDiagnostics=field.diagnostics;field.texture.dispose();
const samples=[];
for(let i=0;i<=1200;i++){
 const time=i/60,p=pathPosition(time),ground=renderedTerrainHeight(p.x,p.z),canopy=boundsAt(p.x,p.z),inland=shoreDistance(p.x,p.z);
 samples.push({time,x:p.x,z:p.z,oldY:p.y,ground,canopy,inland,rockTop:rocksAt(p.x,p.z)});
}
const evaluation=Object.entries(evaluationCameras).map(([name,c])=>({name,position:c.position.toArray(),target:c.target.toArray(),time:c.time,ground:renderedTerrainHeight(c.position.x,c.position.z),canopy:boundsAt(c.position.x,c.position.z),rockTop:rocksAt(c.position.x,c.position.z)}));
const data={method:'Candidate terrain + immutable production ecology probabilities, tree flight exclusion disabled only for this conservative clearance audit; all nine audited LOD root-relative boxes transformed with exact production scale/rotation/lean; horizontal padding 1 m and vertical padding .05 m for world wind',placements:placements.length,boxes,rockBoxes,coastalDiagnostics,samples,evaluation};
await fs.writeFile(out+'/camera-input.json',JSON.stringify(data)+'\n');await fs.writeFile(out+'/unculled-placements.json',JSON.stringify(placements)+'\n');console.log('camera input saved',evaluation);
