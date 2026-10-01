import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {terrainHeight} from '../../src/world/math.ts';
import {terrainHeight as precedingHeight,shoreDistance} from './fixtures/principal-face-baseline/math.ts';
import {renderedTerrainHeight} from '../../src/world/terrain-surface.ts';
import {principalFacePlaneCut as cut,PRINCIPAL_FACE_REGION as region,PRINCIPAL_FACE_STUDY_ENABLED} from '../../src/world/principal-face-planes.ts';
import {treePlacements} from '../../src/world/ecology.ts';
import {pathPosition,evaluationCameras} from '../../src/camera/cinematic.ts';
import {createDetailedRocks,ROCK_GEOMETRY_URL} from '../../src/world/detailed-rocks.ts';
import {decodeRockGeometrySource} from '../../src/world/rock-geometry.ts';
const candidate=PRINCIPAL_FACE_STUDY_ENABLED&&!process.argv.includes('--baseline'),began=performance.now();
function authoritative(x,z){const h=precedingHeight(x,z);return h-(candidate?cut(x,z,h,shoreDistance(x,z)):0)}
assert.equal(terrainHeight(-149,207),authoritative(-149,207),'Runtime study/reference selection mismatch');
const cache=new Map();function vertex(x,z){const key=x+','+z;if(!cache.has(key))cache.set(key,Math.fround(authoritative(x,z)));return cache.get(key)}
function expectedSurface(x,z){const x0=Math.floor(x/2)*2,z0=Math.floor(z/2)*2,u=(x-x0)/2,v=(z-z0)/2,a=vertex(x0,z0),b=vertex(x0+2,z0),c=vertex(x0,z0+2),d=vertex(x0+2,z0+2);return u+v<=1?a*(1-u-v)+b*u+c*v:d*(u+v-1)+b*(1-v)+c*(1-u)}
const trees=treePlacements();assert.equal(trees.length,14000);assert.deepEqual(trees,treePlacements());let affectedRoots=0,maximumRootError=0;
for(const tree of trees){const error=Math.abs(tree.y+.06-expectedSurface(tree.x,tree.z));maximumRootError=Math.max(maximumRootError,error);assert.ok(error<1e-9,'Root differs from current triangles');if(candidate&&cut(tree.x,tree.z,precedingHeight(tree.x,tree.z),shoreDistance(tree.x,tree.z))>0)affectedRoots++}
const route=Array.from({length:1201},(_,i)=>pathPosition(i/60)),treeRouteWarnings=[];
for(let index=0;index<trees.length;index++){const tree=trees[index],y=tree.y+.06,height=(tree.family===2?21:tree.family===1?14.4:18.2)*tree.scale,radius=(tree.family===2?6:17)*tree.scale*(1+tree.variant*.06)+2;const sample=route.findIndex(p=>p.y>y-2&&p.y<y+height+3&&Math.hypot(p.x-tree.x,p.z-tree.z)<radius);if(sample>=0)treeRouteWarnings.push({tree:index,sample,time:sample/60})}
const textures=Object.fromEntries(['rock','rockNormal','rockARM','sand','sandNormal','sandARM','bark','barkNormal','soil','soilNormal','soilARM','moss','mossNormal','mossARM'].map(name=>[name,new THREE.Texture()]));
const packed=fs.readFileSync('public'+ROCK_GEOMETRY_URL),source=decodeRockGeometrySource(packed.buffer.slice(packed.byteOffset,packed.byteOffset+packed.byteLength)),rocks=createDetailedRocks(textures,source);rocks.updateMatrixWorld(true);
const matrix=new THREE.Matrix4(),world=new THREE.Matrix4(),point=new THREE.Vector3(),box=new THREE.Box3(),records=[],unsupported=[],touched=[],rootBoxOverlaps=[];
let vertices=0,maximumSupportError=0,minimumFlightRockBoxClearance=Infinity,closestFlightRock,minimumEvaluationRockBoxClearance=Infinity;const flightRockBoxWarnings=[];
rocks.traverse(mesh=>{
 if(!(mesh instanceof THREE.InstancedMesh))return;const position=mesh.geometry.attributes.position;
 for(let instance=0;instance<mesh.count;instance++){
  mesh.getMatrixAt(instance,matrix);world.multiplyMatrices(mesh.matrixWorld,matrix);box.makeEmpty();let minimumDelta=Infinity,maximumDelta=-Infinity,affectedVertices=0;
  for(let i=0;i<position.count;i++){
   point.fromBufferAttribute(position,i).applyMatrix4(world);box.expandByPoint(point);
   const expected=expectedSurface(point.x,point.z),actual=renderedTerrainHeight(point.x,point.z),error=Math.abs(actual-expected);maximumSupportError=Math.max(maximumSupportError,error);assert.ok(error<1e-9,'Rock queries disagree with independent current surface');
   const delta=point.y-expected;minimumDelta=Math.min(minimumDelta,delta);maximumDelta=Math.max(maximumDelta,delta);
   if(candidate&&cut(point.x,point.z,precedingHeight(point.x,point.z),shoreDistance(point.x,point.z))>0)affectedVertices++;vertices++;
  }
  const id=mesh.name+':'+instance;records.push({id,matrix:matrix.toArray(),minimumDelta,maximumDelta,affectedVertices});
  let instanceClearance=Infinity,closestSample=-1;for(let sample=0;sample<route.length;sample++){const distance=box.distanceToPoint(route[sample]);if(distance<instanceClearance){instanceClearance=distance;closestSample=sample}}
  if(instanceClearance<minimumFlightRockBoxClearance){minimumFlightRockBoxClearance=instanceClearance;closestFlightRock={id,sample:closestSample,time:closestSample/60}}
  if(instanceClearance<5)flightRockBoxWarnings.push({id,sample:closestSample,time:closestSample/60,distance:instanceClearance});
  for(const {position} of Object.values(evaluationCameras))minimumEvaluationRockBoxClearance=Math.min(minimumEvaluationRockBoxClearance,box.distanceToPoint(position));
  if(minimumDelta>.01)unsupported.push({id,gap:minimumDelta,affectedVertices});
  if(affectedVertices){const origin=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();world.decompose(origin,rotation,scale);touched.push({id,type:mesh.name.startsWith('fractured-bedrock')?'procedural fractured bedrock ConvexGeometry':'photogrammetry outcrop',origin:origin.toArray(),scale:scale.toArray(),rotation:rotation.toArray(),bounds:{min:box.min.toArray(),max:box.max.toArray()},geometryVertices:position.count,minimumDelta,maximumDelta,affectedVertices})}
  if(box.max.x>=region.minX&&box.min.x<=region.maxX&&box.max.z>=region.minZ&&box.min.z<=region.maxZ)for(let index=0;index<trees.length;index++){const tree=trees[index],r=2.75*tree.scale,dx=Math.max(box.min.x-tree.x,0,tree.x-box.max.x),dz=Math.max(box.min.z-tree.z,0,tree.z-box.max.z);if(dx*dx+dz*dz<=r*r&&box.max.y>tree.y-.4&&box.min.y<tree.y+2)rootBoxOverlaps.push({rock:id,tree:index,inlandScan:mesh.name.startsWith('inland-scanned'),heightAboveRoot:box.max.y-tree.y})}
 }
});
const result={scope:'CPU support only; conservative root boxes/tree envelopes are warnings; full ecology/visual acceptance separate',candidate,trees:trees.length,affectedRoots,maximumRootError,treeRouteWarnings,rockInstances:records.length,rockVertices:vertices,maximumSupportError,unsupported,touched,rootBoxOverlaps,minimumFlightRockBoxClearance,closestFlightRock,minimumEvaluationRockBoxClearance,flightRockBoxWarnings,inlandScans:rocks.userData.inlandRocks?.accepted,offshoreRocks:rocks.userData.offshoreRocks?.instances,localRefit:rocks.userData.localRockRefit,treeSha256:crypto.createHash('sha256').update(JSON.stringify(trees)).digest('hex'),rockSha256:crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex'),milliseconds:performance.now()-began};
const placementsPath=process.argv.find(arg=>arg.startsWith('--placements='))?.slice('--placements='.length);if(placementsPath)fs.writeFileSync(placementsPath,JSON.stringify(trees)+'\n');console.log('PRINCIPAL_FACE_SUPPORT_AUDIT '+JSON.stringify(result));
const geometries=new Set(),materials=new Set();rocks.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const material of Array.isArray(o.material)?o.material:[o.material])materials.add(material)});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());Object.values(textures).forEach(t=>t.dispose());
