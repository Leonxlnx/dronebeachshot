import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {terrainHeight,terrainHeightBeforePrincipalFace,shoreDistance,shoreZ,SEED} from '../../src/world/math.ts';
import {renderedTerrainHeight,TERRAIN_GRID} from '../../src/world/terrain-surface.ts';
import {treePlacements} from '../../src/world/ecology.ts';
import {pathPosition,evaluationCameras} from '../../src/camera/cinematic.ts';
import * as baseline from './fixtures/terrain-before-fractures.ts';
import {terrainFractureCut as originalEasternCut} from './fixtures/principal-face-baseline/terrain-fractures.ts';
import {PRINCIPAL_FACE_STUDY_ENABLED} from '../../src/world/principal-face-planes.ts';

// Read-only CPU oracle. The independent pre-fracture implementation is frozen
// byte-for-byte from commit 462588e855fc4773868321c73d1f703690344c5b. No Git history,
// network, browser, asset decoder, full distant world or artifact writes are used.
// Git may check this frozen text out as CRLF on Windows; verify its canonical
// repository bytes without changing the fixture or accepting a different source.
const fixture=fs.readFileSync(new URL('./fixtures/terrain-before-fractures.ts',import.meta.url),'utf8').replace(/\r\n/g,'\n');
assert.equal(crypto.createHash('sha256').update(fixture).digest('hex'),
 'fea9ca1ffb2581113be9fcb128076f503ee116a33327969d4b18b894e850ded8','Baseline fixture changed');
const easternFixture=fs.readFileSync(new URL('./fixtures/principal-face-baseline/terrain-fractures.ts',import.meta.url),'utf8').replace(/\r\n/g,'\n');
assert.equal(crypto.createHash('sha256').update(easternFixture).digest('hex'),
 'ebce2e7167cab9113c431bb1f4ad802312dfbb34bcc3f0d8e5bd9ea8935e16c8','Original eastern joint fixture changed');
assert.equal(SEED,60829);assert.equal(SEED,baseline.SEED);
assert.deepEqual(TERRAIN_GRID,{minX:-600,maxX:600,minZ:-800,maxZ:800,step:2,columns:601,rows:801});
// Keep the old twenty-metre joint and broad eastern80m/western90m budgets separate,
// including where their independently authored regions overlap.
const principal=(x,z)=>PRINCIPAL_FACE_STUDY_ENABLED&&x> -207&&x< -106&&z>148&&z<284;
const eastern=(x,z)=>x>252&&x<400&&z> -58&&z<143;
const coastal=(x,z)=>x>203&&x<387&&z> -90&&z<181;
const western=(x,z)=>x> -244&&x< -115&&z>165&&z<286;
const face=(x,z)=>coastal(x,z)||western(x,z);
const faceBudget=(x,z)=>western(x,z)?90:80;
const allowed=(x,z)=>principal(x,z)||eastern(x,z)||face(x,z);
const budget=(x,z)=>principal(x,z)?36:(eastern(x,z)?20:0)+(face(x,z)?faceBudget(x,z):0);
const columns=601,rows=801,count=columns*rows;
// This axis beyond a nonzero bend exposed a 5.32 m discontinuity when finite
// endcaps switched bank width by sign. Probe both sides independently of the grid.
const capX=219.73076923076923,capZ=92.15384615384616,epsilon=.00001;
assert.ok(Math.abs(terrainHeight(capX+12/13*epsilon,capZ-5/13*epsilon)
 -terrainHeight(capX-12/13*epsilon,capZ+5/13*epsilon))<.001,'Asymmetric fracture endcap is discontinuous');
const before=new Float32Array(count),reference=new Float32Array(count),after=new Float32Array(count);
const protectedIndices=[],changedIndices=[];
const began=performance.now();
for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
 const x=-600+col*2,z=-800+row*2,i=row*columns+col;
 const original=baseline.terrainHeight(x,z),preceding=terrainHeightBeforePrincipalFace(x,z),current=terrainHeight(x,z);
 assert.equal(preceding,original-originalEasternCut(x,z,original,baseline.shoreDistance(x,z)),'Stable reference terrain changed');
 const newCut=preceding-current;
 assert.ok(newCut>=0&&newCut<=faceBudget(x,z),'New face incision exceeds its separate depth budget');
 if(!face(x,z)||shoreDistance(x,z)<=45)assert.equal(current,preceding,'New face incision changed protected terrain');
 assert.ok(Number.isFinite(current),'Nonfinite authoritative terrain height');
 assert.ok(current<=original+1e-10,'Authoritative terrain rises above the baseline');
 assert.ok(original-current<=budget(x,z)+1e-8,'Authoritative erosion exceeds its regional budget');
 const protectedPoint=!allowed(x,z)||baseline.shoreDistance(x,z)<=25
  ||(x>=-172&&x<=-86&&z>=318&&z<=384);
 if(protectedPoint){assert.equal(current,original,'Protected authoritative terrain changed');protectedIndices.push(i)}
 before[i]=original;reference[i]=preceding;after[i]=current;
 if(before[i]!==after[i])changedIndices.push(i);
}
function inspectGrid(original,candidate){
 let changed=0,easternChanges=0,principalChanges=0,coastalChanges=0,westernChanges=0,maximumCut=0,maximumCoastalCut=0,maximumWesternCut=0,maximumHeight=-Infinity,minimumCoastalShoreDistance=Infinity;
 const changedBounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
 for(let i=0;i<count;i++){
  assert.ok(Number.isFinite(candidate[i]),'Nonfinite rendered grid height');
  const x=-600+(i%columns)*2,z=-800+Math.floor(i/columns)*2;
  const cut=original[i]-candidate[i];assert.ok(cut>=0,'Rendered grid raises terrain');
  const newCut=reference[i]-candidate[i];
  assert.ok(newCut>=0&&newCut<=faceBudget(x,z)+.0001,'Rendered new face incision violates its separate depth budget');
  if(newCut>0){
   assert.ok(face(x,z),'New incision escaped its agreed region');
   if(western(x,z)){westernChanges++;maximumWesternCut=Math.max(maximumWesternCut,newCut)}
   else{coastalChanges++;maximumCoastalCut=Math.max(maximumCoastalCut,newCut)}
   minimumCoastalShoreDistance=Math.min(minimumCoastalShoreDistance,shoreDistance(x,z));
  }
  assert.ok(cut<=budget(x,z)+.0001,'Rendered grid erosion exceeds its regional budget');
  maximumCut=Math.max(maximumCut,cut);maximumHeight=Math.max(maximumHeight,candidate[i]);
  if(cut>0){
   changed++;if(eastern(x,z))easternChanges++;if(principal(x,z))principalChanges++;
   assert.ok(allowed(x,z),'Erosion escaped the agreed regions');
   changedBounds.minX=Math.min(changedBounds.minX,x);changedBounds.maxX=Math.max(changedBounds.maxX,x);
   changedBounds.minZ=Math.min(changedBounds.minZ,z);changedBounds.maxZ=Math.max(changedBounds.maxZ,z);
  }
 }
 for(const i of protectedIndices)assert.equal(candidate[i],original[i],'Protected rendered grid changed');
 assert.ok(easternChanges>=250&&easternChanges<=6500,'Missing or unbounded eastern fracture footprint');
 assert.ok(coastalChanges>=3500&&coastalChanges<=8000,'Missing or unbounded coastal face footprint');
 assert.ok(westernChanges>=2000&&westernChanges<=4000,'Missing or unbounded western face footprint');
 assert.ok(maximumCoastalCut>=40,'No substantial new face incision');
 assert.ok(maximumWesternCut>=70,'No substantial western face relief');
 assert.ok(minimumCoastalShoreDistance>=48,'New incision approaches protected shore triangle support');
 if(PRINCIPAL_FACE_STUDY_ENABLED)assert.ok(principalChanges>=500&&principalChanges<=4000,'Missing or unbounded principal-face footprint');else assert.equal(principalChanges,0);
 assert.ok(maximumCut>=14,'No substantial real fracture relief');
 assert.equal(maximumHeight,425,'The calibrated highest summit changed');
 return {changed,easternChanges,principalChanges,coastalChanges,westernChanges,maximumCut,maximumCoastalCut,maximumWesternCut,minimumCoastalShoreDistance,maximumHeight,changedBounds};
}
const grid=inspectGrid(before,after);
assert.equal(terrainHeight(-124,350),425);assert.equal(renderedTerrainHeight(-124,350),425);
// Large affine surfaces must survive both boundary blending and overlapping
// patches. Independent authored targets check actual Float32 vertices, not the
// presence of a small slit or a named geometry helper.
function through(a,b,c){
 const dx1=b[0]-a[0],dz1=b[1]-a[1],dx2=c[0]-a[0],dz2=c[1]-a[1];
 const dh1=b[2]-a[2],dh2=c[2]-a[2],det=dx1*dz2-dx2*dz1;
 return [a[0],a[1],a[2],(dh1*dz2-dh2*dz1)/det,(dx1*dh2-dx2*dh1)/det];
}
const expectedPlanes=[
 [340,-40,48,1,.5],[340,-40,89,1.2,.02],
 [260,115,120,1.4,1.3],[260,115,138,.85,.12],
 through([-210,274,287.1836989306747],[-193,238,285.8420395491123],[-165,249,260.28207689778003]),
 through([-193,238,285.8420395491123],[-170,197,221.2568529589553],[-148,216,207.75573390830357]),
 through([-165,249,260.28207689778003],[-148,216,207.75573390830357],[-118,210,249.70401088464945]),
 through([-244,286,256.28012313835364],[-240,238,184.18533106909652],[-193,238,285.8420395491123]),
];
const planeVertices=expectedPlanes.map(([cx,cz,height,slopeX,slopeZ])=>{
 let onPlane=0;
 for(let i=0;i<count;i++){
  if(reference[i]-after[i]<=1)continue;
  const x=-600+(i%columns)*2,z=-800+Math.floor(i/columns)*2;
  if(Math.abs(after[i]-Math.fround(height+slopeX*(x-cx)+slopeZ*(z-cz)))<.00003)onPlane++;
 }
 assert.ok(onPlane>=35,'A broad authored face disappeared behind a mask');return onPlane;
});
// Count substantial changes to real-grid normal directions. A deep, narrow cut
// can pass a removal-only test while leaving the broad Gaussian sheet intact.
const normalChanges={east:0,west:0};
for(let row=1;row<rows-1;row++)for(let col=1;col<columns-1;col++){
 const i=row*columns+col;if(reference[i]-after[i]<=1)continue;
 const x=-600+col*2;
 const ax=(reference[i+1]-reference[i-1])*.25,az=(reference[i+columns]-reference[i-columns])*.25;
 const bx=(after[i+1]-after[i-1])*.25,bz=(after[i+columns]-after[i-columns])*.25;
 const cosine=(ax*bx+az*bz+1)/(Math.hypot(ax,az,1)*Math.hypot(bx,bz,1));
 if(cosine<Math.cos(Math.PI/12))normalChanges[x<0?'west':'east']++;
}
assert.ok(normalChanges.east>=1500&&normalChanges.west>=1000,'Broad face normal topology remains unchanged');

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
// Changing a vertex just beyond45m can still move a triangle sampled inside
// that boundary. Audit the protected rendered strip, not only analytic points.
let protectedShoreSamples=0;
for(let x=203;x<=387;x++)for(const distance of [43,44,45]){
 const derivative=-.0047*x+.156*Math.cos(x*.013)+.16*Math.cos(x*.032);
 const z=shoreZ(x)+distance*Math.hypot(derivative,1);
 assert.equal(gridSurface(x,z,after),gridSurface(x,z,reference),'New face changed protected shore triangle support');
 protectedShoreSamples++;
}
let randomState=41791;
const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296};
for(let i=0;i<3000;i++){
 const x=i<750?-244+random()*129:i<1500?203+random()*184:i<2250?252+random()*148:-598+random()*1196;
 const z=i<750?165+random()*121:i<1500?-90+random()*271:i<2250?-58+random()*201:-798+random()*1596;
 const sampled=gridSurface(x,z,after),current=terrainHeight(x,z),previous=baseline.terrainHeight(x,z);
 assert.ok(Math.abs(sampled-renderedTerrainHeight(x,z))<1e-9,'Rendered helper differs from actual Float32 triangles');
 assert.equal(current,terrainHeight(x,z),'Fracture height is nondeterministic');
 assert.ok(current<=previous+1e-10&&previous-current<=budget(x,z)+1e-8,'Off-grid erosion violates fixed depth bounds');
 assert.equal(shoreDistance(x,z),baseline.shoreDistance(x,z),'Authoritative shoreline formula changed');
 const preceding=terrainHeightBeforePrincipalFace(x,z);
 assert.ok(preceding-current>=0&&preceding-current<=faceBudget(x,z),'Off-grid new incision violates separate depth budget');
 if(!face(x,z)||shoreDistance(x,z)<=45)assert.equal(current,preceding,'Protected off-grid face terrain changed');
 if(!allowed(x,z)||baseline.shoreDistance(x,z)<=25)assert.equal(current,previous,'Protected off-grid terrain changed');
}
// Exact production tile geometry for the seven touched tiles. No huge distant
// terrain construction: this visits all real positions, indices and normals here.
let tileTriangles=0;
for(const [centerX,centerZ] of [[300,-100],[300,100],[100,100],[-100,100],[-100,300],[-300,100],[-300,300]]){
 const geometry=new THREE.PlaneGeometry(200,200,100,100);geometry.rotateX(-Math.PI/2);geometry.translate(centerX,0,centerZ);
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
assert.equal(tileTriangles,140000,'Actual terrain topology or geometry cost changed');

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
assert.throws(()=>inspectGrid(before,before),/footprint|depth budget/);
assert.throws(()=>inspectGrid(before,reference),/coastal face footprint/);
const withoutWest=after.slice();for(let i=0;i<count;i++)if(western(-600+(i%columns)*2,-800+Math.floor(i/columns)*2))withoutWest[i]=reference[i];
assert.throws(()=>inspectGrid(before,withoutWest),/western face footprint/);
assert.throws(()=>inspectRoute(()=>500),/camera/);
assert.throws(()=>inspectRoots([{...trees[0],y:trees[0].y+1}]),/Root/);

console.log('TERRAIN_FRACTURE_CHECK_PASS '+JSON.stringify({
 scope:'Independent frozen-baseline CPU terrain, exact protected regions, actual two-metre surface, route and roots; visual acceptance pending',
 baselineCommit:'462588e855fc4773868321c73d1f703690344c5b',baselineMathSha256:'fea9ca1ffb2581113be9fcb128076f503ee116a33327969d4b18b894e850ded8',
 vertices:count,...grid,planeVertices,normalChanges,protectedShoreSamples,tileTriangles,trees:trees.length,minimumCameraClearance,flightMinimumClearance,
 surfaceSha256:crypto.createHash('sha256').update(Buffer.from(after.buffer)).digest('hex'),
 negativeControls:['terrain rise','shore change','summit change','no erosion','no coastal incision','no western incision','camera collision','floating root'],
 elapsedMilliseconds:performance.now()-began}));
