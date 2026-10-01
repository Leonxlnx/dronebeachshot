// Historical shape audit. Passing does not accept the rejected visual study.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {terrainHeight as integratedHeight} from '../../src/world/math.ts';
import {terrainHeight,shoreDistance,shoreZ} from './fixtures/principal-face-baseline/math.ts';
import {pathPosition,evaluationCameras} from '../../src/camera/cinematic.ts';
import {solarDirection} from '../../src/render/sky-lighting.ts';
import {principalFacePlaneCut as cut,principalFaceTargetHeight as target,principalFaceBoundaryDistance as boundary,PRINCIPAL_FACE_NODES as nodes,PRINCIPAL_FACE_TRIANGLES as triangles,PRINCIPAL_FACE_BANK_TRIANGLES as bankTriangles,PRINCIPAL_FACE_STUDY_ENABLED} from '../../src/world/principal-face-planes.ts';
const began=performance.now();
for(const [file,expected] of [['math.ts','389cf335a0514b0d59088799498caca306714676ab5b3aec01d7cc8e8f25c7b2'],['terrain-fractures.ts','ebce2e7167cab9113c431bb1f4ad802312dfbb34bcc3f0d8e5bd9ea8935e16c8']])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('./fixtures/principal-face-baseline/'+file,import.meta.url))).digest('hex'),expected,'Frozen reference changed');
for(const [id,x,z,height,depth] of nodes){assert.equal(terrainHeight(x,z),height,'Stale node '+id);assert.ok(Math.abs(target(x,z)-(height-depth))<1e-9,'Wrong target '+id)}
const v=new THREE.Vector3(),n=new THREE.Vector3(),sun=solarDirection.value.clone().normalize(),planeRecords=[],edgeCounts=new Map();let triangleArea=0,polygonArea=0;
for(let i=0;i<7;i++){const a=nodes[i],b=nodes[(i+1)%7];polygonArea+=(a[1]*b[2]-a[2]*b[1])*.5}
for(const [index,indices] of triangles.entries()){
 const [a,b,c]=indices.map(i=>nodes[i]),p=[a,b,c].map(q=>new THREE.Vector3(q[1],q[3]-q[4],q[2]));
 const area=((b[1]-a[1])*(c[2]-a[2])-(c[1]-a[1])*(b[2]-a[2]))*.5;assert.notEqual(area,0);triangleArea+=Math.abs(area);
 new THREE.Triangle(...p).getNormal(n);if(n.y<0)n.negate();const centroid=p[0].clone().add(p[1]).add(p[2]).multiplyScalar(1/3);
 assert.ok(Math.abs(target(centroid.x,centroid.z)-centroid.y)<1e-9,'Target left affine plane');
 planeRecords.push({index,nodes:indices.map(i=>nodes[i][0]),area:Math.abs(area),normal:n.toArray(),sunDot:n.dot(sun),bank:bankTriangles.includes(index)});
 for(let k=0;k<3;k++){const edge=[indices[k],indices[(k+1)%3]].sort((a,b)=>a-b).join(',');edgeCounts.set(edge,(edgeCounts.get(edge)||0)+1)}
}
assert.ok(Math.abs(triangleArea-polygonArea)<1e-9);
for(const [edge,count] of edgeCounts){const [a,b]=edge.split(',').map(Number),perimeter=a<7&&b<7&&(b-a===1||(a===0&&b===6));assert.equal(count,perimeter?1:2,'Nonmanifold target')}
const bankDots=planeRecords.filter(p=>p.bank).map(p=>p.sunDot);assert.ok(bankDots.every(dot=>dot<-.15)&&Math.min(...bankDots)<-.3);
const columns=601,rows=801,count=columns*rows,before=new Float32Array(count),after=new Float32Array(count),changedIndices=[];
const bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};let maxCut=0,maxPoint,above36=0,beach=0,minimumShore=Infinity,interiorPlanar=0;
function candidateHeight(x,z){const h=terrainHeight(x,z),expected=h-cut(x,z,h,shoreDistance(x,z));assert.equal(integratedHeight(x,z),PRINCIPAL_FACE_STUDY_ENABLED?expected:h,'Production geometry/study switch disagrees with frozen source');return expected}
for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
 const x=-600+col*2,z=-800+row*2,i=row*columns+col,d=shoreDistance(x,z),h=terrainHeight(x,z),removal=cut(x,z,h,d);assert.ok(Number.isFinite(removal)&&removal>=0);before[i]=h;after[i]=candidateHeight(x,z);
 if(d<=45){assert.equal(removal,0);beach++}
 if(x>=252&&x<=400&&z>=-58&&z<=143)assert.equal(removal,0,'Eastern cut changed');
 if(z>=318&&z<=384&&x>=-172&&x<=-86)assert.equal(removal,0,'Summit changed');
 if(removal>maxCut){maxCut=removal;maxPoint={x,z,before:h,after:h-removal}}if(removal>36)above36++;
 if(boundary(x,z)>=10&&removal>1e-8){assert.ok(Math.abs(h-removal-target(x,z))<1e-9);interiorPlanar++}
 if(before[i]!==after[i]){assert.ok(boundary(x,z)>0);changedIndices.push(i);minimumShore=Math.min(minimumShore,d);bounds.minX=Math.min(bounds.minX,x);bounds.maxX=Math.max(bounds.maxX,x);bounds.minZ=Math.min(bounds.minZ,z);bounds.maxZ=Math.max(bounds.maxZ,z)}
}
assert.ok(changedIndices.length>500&&changedIndices.length<4000);assert.ok(interiorPlanar>500);assert.equal(candidateHeight(-124,350),425);assert.ok(maxCut<=36&&above36===0);
const ray=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3(0,-1,0)),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),d=new THREE.Vector3(),hit=new THREE.Vector3();
function surface(x,z,heights){const col=Math.floor((x+600)/2),row=Math.floor((z+800)/2),i=row*columns+col;assert.ok(col>=0&&col<600&&row>=0&&row<800);const x0=-600+col*2,z0=-800+row*2;a.set(x0,heights[i],z0);b.set(x0,heights[i+columns],z0+2);c.set(x0+2,heights[i+1],z0);d.set(x0+2,heights[i+columns+1],z0+2);ray.origin.set(x,500,z);assert.ok(ray.intersectTriangle(a,b,c,false,hit)||ray.intersectTriangle(b,d,c,false,hit));return hit.y}
const route=Array.from({length:1201},(_,i)=>pathPosition(i/60));let minimumClearance=Infinity;
for(const p of route){assert.equal(candidateHeight(p.x,p.z),terrainHeight(p.x,p.z));assert.equal(surface(p.x,p.z,after),surface(p.x,p.z,before));minimumClearance=Math.min(minimumClearance,p.y-surface(p.x,p.z,after))}
for(const {position:p} of Object.values(evaluationCameras))assert.equal(surface(p.x,p.z,after),surface(p.x,p.z,before));assert.ok(minimumClearance>=5);
let beachSurfaceSamples=0;for(let x=-212;x<=-100;x+=.5)for(let distance=-5;distance<=45;distance+=.5){const slope=-.0047*x+.156*Math.cos(x*.013)+.16*Math.cos(x*.032),z=shoreZ(x)+distance*Math.sqrt(1+slope*slope);assert.equal(surface(x,z,after),surface(x,z,before));beachSurfaceSamples++}
let state=47119;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
for(let i=0;i<4000;i++){const x=-217+random()*121,z=138+random()*156,h=terrainHeight(x,z),removal=cut(x,z,h,shoreDistance(x,z));assert.ok(Number.isFinite(removal)&&removal>=0);if(boundary(x,z)<=0)assert.equal(removal,0);else assert.ok(Number.isFinite(target(x,z)));candidateHeight(x,z)}
let denseMaximum=0,densePoint,denseSamples=0;
for(let z=148;z<=284;z+=.5)for(let x=-207;x<=-106;x+=.5){const h=terrainHeight(x,z),removal=cut(x,z,h,shoreDistance(x,z));if(removal>denseMaximum){denseMaximum=removal;densePoint=[x,z]}assert.ok(removal<=36);denseSamples++}
let localMaximum=0,localPoint;
for(let z=densePoint[1]-1;z<=densePoint[1]+1+1e-9;z+=.05)for(let x=densePoint[0]-1;x<=densePoint[0]+1+1e-9;x+=.05){const h=terrainHeight(x,z),removal=cut(x,z,h,shoreDistance(x,z));assert.ok(removal<=36);if(removal>localMaximum){localMaximum=removal;localPoint=[x,z]}}
let tileTriangles=0,reverseFacingTriangles=0,newReverseFacingTriangles=0;
for(const centerX of [-300,-100])for(const centerZ of [100,300]){
 const geometry=new THREE.PlaneGeometry(200,200,100,100);geometry.rotateX(-Math.PI/2);geometry.translate(centerX,0,centerZ);const p=geometry.attributes.position;
 for(let i=0;i<p.count;i++)p.setY(i,candidateHeight(p.getX(i),p.getZ(i)));geometry.computeVertexNormals();for(const attribute of Object.values(geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));
 for(let i=0;i<geometry.index.count;i+=3){a.fromBufferAttribute(p,geometry.index.getX(i));b.fromBufferAttribute(p,geometry.index.getX(i+1));c.fromBufferAttribute(p,geometry.index.getX(i+2));const tri=new THREE.Triangle(a,b,c);assert.ok(tri.getArea()>1.99);tri.getNormal(n);assert.ok(n.y>0);const changed=[a,b,c].some(p=>cut(p.x,p.z,terrainHeight(p.x,p.z),shoreDistance(p.x,p.z))>1e-6);if(changed&&n.dot(sun)<0){reverseFacingTriangles++;a.y=Math.fround(terrainHeight(a.x,a.z));b.y=Math.fround(terrainHeight(b.x,b.z));c.y=Math.fround(terrainHeight(c.x,c.z));if(new THREE.Triangle(a,b,c).getNormal(v).dot(sun)>=0)newReverseFacingTriangles++}tileTriangles++}
 geometry.dispose();
}
assert.ok(newReverseFacingTriangles>20);
const surfaceSha256=crypto.createHash('sha256').update(Buffer.from(after.buffer)).digest('hex');assert.equal(surfaceSha256,'7796f49b3daca9a41d08566dcddf6e02c09f7357ea9657b5f8ca71628887f91b');
console.log('PRINCIPAL_FACE_CPU_AUDIT '+JSON.stringify({scope:'Historical rejected study, current default-off switch independently checked; not visual acceptance',studyEnabled:PRINCIPAL_FACE_STUDY_ENABLED,vertices:count,changedVertices:changedIndices.length,interiorPlanarVertices:interiorPlanar,maxCut,maxPoint,verticesOver36m:above36,denseSamples,denseMaximum,densePoint,localMaximum,localPoint,changedBounds:bounds,minimumChangedShoreDistance:minimumShore,protectedBeachVertices:beach,beachSurfaceSamples,routeSamples:route.length,minimumFlightClearance:minimumClearance,polygonArea,tileTriangles,reverseFacingTriangles,newReverseFacingTriangles,planes:planeRecords,surfaceSha256,milliseconds:performance.now()-began}));
