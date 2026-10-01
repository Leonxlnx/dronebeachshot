import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {createTerrain} from '../../src/world/terrain.ts';
import {partitionTerrainShadowGeometry} from '../../src/render/terrain-shadow-chunks.ts';
import {solarDirection} from '../../src/render/sky-lighting.ts';

const started=performance.now(),terrain=createTerrain({}),source=terrain.getObjectByName('continuous-coastal-extension');
assert.ok(source instanceof THREE.Mesh);const geometry=source.geometry,index=geometry.index,position=geometry.attributes.position;
const sha=array=>crypto.createHash('sha256').update(Buffer.from(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
const sourceHashes={position:sha(position.array),normal:sha(geometry.attributes.normal.array),color:sha(geometry.attributes.color.array),index:sha(index.array)};
const periphery=source.userData.centralBoundaryVertices,rings=source.userData.radialRings;
assert.equal(index.count,(rings-1)*periphery*6);
const partitionStarted=performance.now(),chunks=partitionTerrainShadowGeometry(geometry,512),partitionMilliseconds=performance.now()-partitionStarted;
const seen=new Uint8Array(index.count/3),point=new THREE.Vector3();let count=0,maxBoundExcess=0;
for(const chunk of chunks){
 for(const [name,attribute]of Object.entries(geometry.attributes))assert.equal(chunk.attributes[name],attribute);
 const indices=chunk.index.array;
 for(let i=0;i<indices.length;i+=3){
  const [a,b,c]=indices.subarray(i,i+3);
  // Original annular topology identifies each exact winding without a large
  // hash map. Verify all three original indices, then its unique multiplicity.
  const first=c===a+periphery,cell=first?a:a-periphery,triangle=cell*2+(first?0:1);
  assert.ok(triangle>=0&&triangle<seen.length);
  for(let k=0;k<3;k++)assert.equal(indices[i+k],index.array[triangle*3+k]);
  assert.equal(seen[triangle],0,'An original triangle was duplicated');seen[triangle]=1;count++;
  for(const vertex of [a,b,c]){
   point.fromBufferAttribute(position,vertex);assert.ok(chunk.boundingBox.containsPoint(point));
   maxBoundExcess=Math.max(maxBoundExcess,point.distanceTo(chunk.boundingSphere.center)-chunk.boundingSphere.radius);
  }
 }
}
assert.equal(count,seen.length);assert.ok(seen.every(v=>v===1));assert.ok(maxBoundExcess<1e-9);
const sun=new THREE.DirectionalLight();sun.target.position.set(0,80,150);sun.position.copy(sun.target.position).addScaledVector(solarDirection.value,1000);
Object.assign(sun.shadow.camera,{left:-380,right:380,top:380,bottom:-380,near:1,far:1800});
function countFit(name){
 sun.updateWorldMatrix(true,false);sun.target.updateWorldMatrix(true,false);sun.shadow.camera.updateProjectionMatrix();sun.shadow.updateMatrices(sun);
 const frustum=sun.shadow.getFrustum();let retainedChunks=0,retainedTriangles=0;
 for(const chunk of chunks)if(frustum.intersectsSphere(chunk.boundingSphere)){retainedChunks++;retainedTriangles+=chunk.index.count/3;}
 // Stronger conservative check: every source triangle whose vertices are not
 // all outside any one light clip plane must be in a retained chunk. This
 // includes triangles spanning the frustum with all vertices outside it.
 let potentiallyVisibleTriangles=0,incorrectlyCulledTriangles=0;
 const points=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
 for(const chunk of chunks){const retained=frustum.intersectsSphere(chunk.boundingSphere),a=chunk.index.array;
  for(let i=0;i<a.length;i+=3){for(let k=0;k<3;k++)points[k].fromBufferAttribute(position,a[i+k]);
   const outside=frustum.planes.some(plane=>points.every(p=>plane.distanceToPoint(p)<0));
   if(!outside){potentiallyVisibleTriangles++;if(!retained)incorrectlyCulledTriangles++;}
  }
 }
 assert.equal(incorrectlyCulledTriangles,0);
 return{name,retainedChunks,retainedTriangles,totalTriangles:count,potentiallyVisibleTriangles,incorrectlyCulledTriangles,
  retainedFraction:retainedTriangles/count};
}
const fits=[countFit('production-sun')];
sun.target.position.set(-1350,150,-1100);sun.position.copy(sun.target.position).addScaledVector(solarDirection.value,2600);
Object.assign(sun.shadow.camera,{left:-1450,right:1550,bottom:-420,top:500,near:600,far:4400});fits.push(countFit('remote-study-sun'));
assert.deepEqual(sourceHashes,{position:sha(position.array),normal:sha(geometry.attributes.normal.array),color:sha(geometry.attributes.color.array),index:sha(index.array)});
const report={method:'Actual createTerrain continuation; exact source index identity and multiplicity; shared immutable attributes; complete referenced-vertex bounds; source-triangle plane exclusion audit',cellSize:512,sourceHashes,sourceVertices:position.count,sourceTriangles:count,periphery,rings,chunks:chunks.length,partitionMilliseconds,maxBoundExcess,fits,totalMilliseconds:performance.now()-started,rss:process.memoryUsage().rss,
 limits:['CPU source/bounds evidence only; actual rendered shadow/color equality and timings still required','Submitted triangle counts are conservative eligible bounds, not measured GPU vertex execution or speedups','Production study is not integrated or enabled by this audit']};
const output='artifacts/refinement-2026-09-30/terrain-shadow-chunks';fs.mkdirSync(output,{recursive:true});fs.writeFileSync(output+'/actual-source-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
