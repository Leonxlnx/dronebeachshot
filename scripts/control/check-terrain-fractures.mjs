import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {terrainHeight,shoreDistance,SEED} from '../../src/world/math.ts';
import {renderedTerrainHeight,TERRAIN_GRID} from '../../src/world/terrain-surface.ts';
import {treePlacements} from '../../src/world/ecology.ts';
import {pathPosition,evaluationCameras} from '../../src/camera/cinematic.ts';
import * as baseline from './fixtures/terrain-before-fractures.ts';

// Read-only CPU oracle. The independent pre-fracture implementation is frozen
// byte-for-byte from commit 462588e855fc4773868321c73d1f703690344c5b. No Git history,
// network, browser, asset decoder, full distant world or artifact writes are used.
const fixture=fs.readFileSync(new URL('./fixtures/terrain-before-fractures.ts',import.meta.url));
assert.equal(crypto.createHash('sha256').update(fixture).digest('hex'),
 'fea9ca1ffb2581113be9fcb128076f503ee116a33327969d4b18b894e850ded8','Baseline fixture changed');
assert.equal(SEED,60829);assert.equal(SEED,baseline.SEED);
assert.deepEqual(TERRAIN_GRID,{minX:-600,maxX:600,minZ:-800,maxZ:800,step:2,columns:601,rows:801});
const columns=601,rows=801,count=columns*rows;
const before=new Float32Array(count),after=new Float32Array(count);
const protectedIndices=[],changedIndices=[];
const began=performance.now();
for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
 const x=-600+col*2,z=-800+row*2,i=row*columns+col;
 const original=baseline.terrainHeight(x,z),current=terrainHeight(x,z);
 assert.ok(Number.isFinite(current),'Nonfinite authoritative terrain height');
 assert.ok(current<=original+1e-10,'Authoritative terrain rises above the baseline');
 assert.ok(original-current<=20+1e-8,'Authoritative erosion exceeds 20 metres');
 const protectedPoint=x<=252||x>=400||z<=-58||z>=143||baseline.shoreDistance(x,z)<=25
  ||(x>=-172&&x<=-86&&z>=318&&z<=384);
 if(protectedPoint){assert.equal(current,original,'Protected authoritative terrain changed');protectedIndices.push(i)}
 before[i]=original;after[i]=current;
 if(before[i]!==after[i])changedIndices.push(i);
}
function inspectGrid(reference,candidate){
 let changed=0,maximumCut=0,maximumHeight=-Infinity;
 const changedBounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
 for(let i=0;i<count;i++){
  assert.ok(Number.isFinite(candidate[i]),'Nonfinite rendered grid height');
  const cut=reference[i]-candidate[i];assert.ok(cut>=0,'Rendered grid raises terrain');
  assert.ok(cut<=20.0001,'Rendered grid erosion exceeds 20 metres');
  maximumCut=Math.max(maximumCut,cut);maximumHeight=Math.max(maximumHeight,candidate[i]);
  if(cut>0){
   changed++;const x=-600+(i%columns)*2,z=-800+Math.floor(i/columns)*2;
   assert.ok(x>252&&x<400&&z>-58&&z<143,'Erosion escaped the agreed headland region');
   changedBounds.minX=Math.min(changedBounds.minX,x);changedBounds.maxX=Math.max(changedBounds.maxX,x);
   changedBounds.minZ=Math.min(changedBounds.minZ,z);changedBounds.maxZ=Math.max(changedBounds.maxZ,z);
  }
 }
 for(const i of protectedIndices)assert.equal(candidate[i],reference[i],'Protected rendered grid changed');
 assert.ok(changed>=250&&changed<=3000,'Missing or unbounded fracture footprint');
 assert.ok(maximumCut>=14,'No substantial real fracture relief');
 assert.equal(maximumHeight,425,'The calibrated highest summit changed');
 return {changed,maximumCut,maximumHeight,changedBounds};
}
const grid=inspectGrid(before,after);
assert.equal(terrainHeight(-124,350),425);assert.equal(renderedTerrainHeight(-124,350),425);

// Cast onto the two actual triangles of each Float32 two-metre cell. This does
// not use the production terrain-surface interpolation implementation or its cache.
const ray=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),d=new THREE.Vector3(),hit=new THREE.Vector3();
function gridSurface(x,z,heights){
 const col=Math.floor((x+600)/2),row=Math.floor((z+800)/2),i=row*columns+col;
 assert.ok(col>=0&&col<600&&row>=0&&row<800,'Ray outside core terrain');
 const x0=-600+col*2,z0=-800+row*2;
 a.set(x0,heights[i],z0);b.set(x0,heights[i+columns],z0+2);
 c.set(x0+2,heights[i+1],z0);d.set(x0+2,heights[i+columns+1],z0+2);
 ray.origin.set(x,500,z);
 const result=ray.intersectTriangle(a,b,c,false,hit)||ray.intersectTriangle(b,d,c,false,hit);
 assert.ok(result,'Missing actual two-metre triangle under sample');return result.y;
}
let randomState=41791;
const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296};
for(let i=0;i<3000;i++){
 const x=i<2000?252+random()*148:-598+random()*1196;
 const z=i<2000?-58+random()*201:-798+random()*1596;
 const sampled=gridSurface(x,z,after),current=terrainHeight(x,z),previous=baseline.terrainHeight(x,z);
 assert.ok(Math.abs(sampled-renderedTerrainHeight(x,z))<1e-9,'Rendered helper differs from actual Float32 triangles');
 assert.equal(current,terrainHeight(x,z),'Fracture height is nondeterministic');
 assert.ok(current<=previous+1e-10&&previous-current<=20+1e-8,'Off-grid erosion violates fixed depth bounds');
 assert.equal(shoreDistance(x,z),baseline.shoreDistance(x,z),'Authoritative shoreline formula changed');
 if(x<=252||x>=400||z<=-58||z>=143||baseline.shoreDistance(x,z)<=25)assert.equal(current,previous,'Protected off-grid terrain changed');
}
// Exact production tile geometry for the only two touched tiles. No huge distant
// terrain construction: this visits all real positions, indices and normals here.
let tileTriangles=0;
for(const centerZ of [-100,100]){
 const geometry=new THREE.PlaneGeometry(200,200,100,100);geometry.rotateX(-Math.PI/2);geometry.translate(300,0,centerZ);
 const p=geometry.attributes.position;
 for(let i=0;i<p.count;i++)p.setY(i,terrainHeight(p.getX(i),p.getZ(i)));
 geometry.computeVertexNormals();
 for(const attribute of Object.values(geometry.attributes))assert.ok(attribute.array.every(Number.isFinite),'Nonfinite actual tile attribute');
 for(let i=0;i<geometry.index.count;i+=3){
  a.fromBufferAttribute(p,geometry.index.getX(i));b.fromBufferAttribute(p,geometry.index.getX(i+1));c.fromBufferAttribute(p,geometry.index.getX(i+2));
  const triangle=new THREE.Triangle(a,b,c);assert.ok(triangle.getArea()>1.99,'Degenerate actual terrain triangle');
  assert.ok(triangle.getNormal(hit).y>0,'Folded or inverted actual terrain triangle');tileTriangles++;
 }
 geometry.dispose();
}
assert.equal(tileTriangles,40000,'Actual terrain topology or geometry cost changed');

const route=[...Array.from({length:1201},(_,i)=>pathPosition(i/60)),...Object.values(evaluationCameras).map(camera=>camera.position)];
function inspectRoute(surface){
 let minimumClearance=Infinity;
 for(const point of route){
  const height=surface(point.x,point.z),original=gridSurface(point.x,point.z,before);
  assert.ok(Math.abs(height-original)<1e-9,'Terrain beneath an authored camera changed');
  minimumClearance=Math.min(minimumClearance,point.y-height);
 }
 assert.ok(minimumClearance>=1,'Terrain intersects an authored camera');return minimumClearance;
}
const minimumCameraClearance=inspectRoute((x,z)=>gridSurface(x,z,after));
const flightMinimumClearance=Math.min(...route.slice(0,1201).map(point=>point.y-gridSurface(point.x,point.z,after)));
assert.ok(flightMinimumClearance>=5,'Flight lost its five-metre ground clearance');
const trees=treePlacements();assert.equal(trees.length,14000,'Regenerated forest was not replenished');
assert.deepEqual(trees,treePlacements(),'Regenerated forest is nondeterministic');
function inspectRoots(placements){
 for(const tree of placements)assert.ok(Math.abs(tree.y+.06-gridSurface(tree.x,tree.z,after))<1e-9,'Root is not bound to actual rendered terrain');
}
inspectRoots(trees);
for(const file of ['../../src/world/detailed-rocks.ts','../../src/world/ecology.ts']){
 const source=fs.readFileSync(new URL(file,import.meta.url),'utf8');
 assert.ok(!/createCliffButtresses|isExposedCliff/.test(source),'Rejected additive overlay is still active');
}

// Negative controls use damaged real grids/roots and the same independent oracle.
const damaged=after.slice(),changed=changedIndices[0];damaged[changed]=before[changed]+1;
assert.throws(()=>inspectGrid(before,damaged),/raises/);
damaged.set(after);const shoreIndex=protectedIndices.find(i=>baseline.shoreDistance(-600+(i%columns)*2,-800+Math.floor(i/columns)*2)<=25);
damaged[shoreIndex]-=1;assert.throws(()=>inspectGrid(before,damaged),/region|Protected/);
damaged.set(after);const summitIndex=((350+800)/2)*columns+(-124+600)/2;
damaged[summitIndex]-=1;assert.throws(()=>inspectGrid(before,damaged),/region|Protected|summit/);
assert.throws(()=>inspectGrid(before,before),/footprint/);
assert.throws(()=>inspectRoute(()=>500),/camera/);
assert.throws(()=>inspectRoots([{...trees[0],y:trees[0].y+1}]),/Root/);

console.log('TERRAIN_FRACTURE_CHECK_PASS '+JSON.stringify({
 scope:'Independent frozen-baseline CPU terrain, exact protected regions, actual two-metre surface, route and roots; visual acceptance pending',
 baselineCommit:'462588e855fc4773868321c73d1f703690344c5b',baselineMathSha256:'fea9ca1ffb2581113be9fcb128076f503ee116a33327969d4b18b894e850ded8',
 vertices:count,...grid,tileTriangles,trees:trees.length,minimumCameraClearance,flightMinimumClearance,
 surfaceSha256:crypto.createHash('sha256').update(Buffer.from(after.buffer)).digest('hex'),
 negativeControls:['terrain rise','shore change','summit change','no erosion','camera collision','floating root'],
 elapsedMilliseconds:performance.now()-began}));
