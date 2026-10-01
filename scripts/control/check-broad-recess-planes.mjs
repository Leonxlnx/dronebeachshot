// Bounded pre-render checks, not full scene or ecological acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {terrainHeight,terrainHeightBeforePrincipalFace as baseline,shoreDistance,shoreZ} from '../../src/world/math.ts';
import {pathPosition,evaluationCameras} from '../../src/camera/cinematic.ts';
import {PRINCIPAL_FACE_STUDY_ENABLED} from '../../src/world/principal-face-planes.ts';
import {broadRecessPlaneCut as cut,broadRecessTargetHeight as target,BROAD_RECESS_STUDY_ENABLED as enabled,BROAD_RECESS_REGION as region,BROAD_RECESS_DEPTH_BUDGET as budget} from '../../src/world/broad-recess-planes.ts';
const began=performance.now();
assert.equal(PRINCIPAL_FACE_STUDY_ENABLED,false,'The rejected principal-face study must remain disabled');
const height=(x,z)=>{const h=baseline(x,z);return h-cut(x,z,h,shoreDistance(x,z))};
const vertexCache=new Map();
function vertex(x,z){
 const key=x+','+z;let pair=vertexCache.get(key);
 if(!pair){pair=[Math.fround(baseline(x,z)),Math.fround(height(x,z))];vertexCache.set(key,pair)}
 return pair;
}
function surface(x,z,index){
 const x0=Math.floor(x/2)*2,z0=Math.floor(z/2)*2,u=(x-x0)/2,v=(z-z0)/2;
 const a=vertex(x0,z0)[index],b=vertex(x0+2,z0)[index],c=vertex(x0,z0+2)[index],d=vertex(x0+2,z0+2)[index];
 return u+v<=1?a*(1-u-v)+b*u+c*v:d*(u+v-1)+b*(1-v)+c*(1-u);
}
let vertices=0,changedVertices=0,maximum=0,maximumPoint,minimumChangedShore=Infinity,affineVertices=0;
const changedBounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
for(let z=144;z<=296;z+=2)for(let x=-236;x<=-106;x+=2){
 const h=baseline(x,z),d=shoreDistance(x,z),removal=cut(x,z,h,d);vertices++;
 assert.ok(Number.isFinite(removal)&&removal>=0&&removal<=budget);
 assert.equal(terrainHeight(x,z),enabled?h-removal:h,'Integrated study switch differs from pure candidate');
 if(removal>maximum){maximum=removal;maximumPoint={x,z,before:h,after:h-removal}}
 const distance=Math.min(x-region.minX,region.maxX-x,z-region.minZ,region.maxZ-z);
 if(Math.fround(h)!==Math.fround(h-removal)){
  changedVertices++;minimumChangedShore=Math.min(minimumChangedShore,d);
  changedBounds.minX=Math.min(changedBounds.minX,x);changedBounds.maxX=Math.max(changedBounds.maxX,x);
  changedBounds.minZ=Math.min(changedBounds.minZ,z);changedBounds.maxZ=Math.max(changedBounds.maxZ,z);
  if(distance>=10){assert.ok(Math.abs(h-removal-target(x,z))<1e-9);affineVertices++}
 }
}
assert.ok(changedVertices>1000&&changedVertices<3000,'Candidate unexpectedly absent or expanded');
assert.ok(affineVertices>1000,'Broad planar interior was lost');
let denseSamples=0,denseMaximum=0,densePoint;
for(let z=region.minZ;z<=region.maxZ;z+=.5)for(let x=region.minX;x<=region.maxX;x+=.5){
 const h=baseline(x,z),removal=cut(x,z,h,shoreDistance(x,z));denseSamples++;
 assert.ok(Number.isFinite(removal)&&removal>=0&&removal<=budget);
 if(removal>denseMaximum){denseMaximum=removal;densePoint=[x,z]}
}
let minimumFlightClearance=Infinity;
for(let i=0;i<=1200;i++){
 const p=pathPosition(i/60);
 assert.equal(height(p.x,p.z),baseline(p.x,p.z),'Continuous terrain beneath route changed');
 assert.equal(surface(p.x,p.z,1),surface(p.x,p.z,0),'Actual Float32 terrain triangle beneath route changed');
 minimumFlightClearance=Math.min(minimumFlightClearance,p.y-surface(p.x,p.z,1));
}
assert.ok(minimumFlightClearance>=5);
for(const [name,{position:p}] of Object.entries(evaluationCameras))assert.equal(surface(p.x,p.z,1),surface(p.x,p.z,0),'Camera ground changed: '+name);
let protectedShoreSamples=0;
for(let x=-238;x<=-104;x+=2)for(let distance=-5;distance<=45;distance+=2){
 const slope=-.0047*x+.156*Math.cos(x*.013)+.16*Math.cos(x*.032),z=shoreZ(x)+distance*Math.sqrt(1+slope*slope);
 assert.equal(cut(x,z,baseline(x,z),distance),0);
 assert.equal(surface(x,z,1),surface(x,z,0),'Shore-adjacent terrain triangle changed');protectedShoreSamples++;
}
// Check the boundary/collar and protection branch independently of whether H<T.
for(const [x,z] of [[-235,220],[-107,220],[-170,145],[-170,290],[-236,220],[-106,220],[-170,144],[-170,291]])assert.equal(cut(x,z,10000,100),0);
for(const d of [-20,0,25,45])assert.equal(cut(-165,210,10000,d),0);
assert.equal(cut(-230,220,target(-230,220)+20,100),10,'Half-collar smoothstep must be 0.5');
assert.equal(cut(-225,220,target(-225,220)+20,100),20,'Interior must be fully affine');
assert.equal(cut(-165,210,target(-165,210)-1,100),0,'The candidate cannot raise terrain');
assert.equal(height(-124,350),425,'Calibrated summit changed');
for(let z=318;z<=384;z+=2)for(let x=-172;x<=-86;x+=2)assert.equal(cut(x,z,10000,100),0);
for(let z=-58;z<=144;z+=2)for(let x=252;x<=400;x+=2)assert.equal(cut(x,z,10000,100),0,'Existing eastern joints overlap');
const report={scope:'Bounded pre-render geometry audit only; tree/rock support, actual pixels and visual acceptance pending',studyEnabled:enabled,depthBudget:budget,vertices,changedVertices,affineVertices,maximum,maximumPoint,changedBounds,minimumChangedShore,denseSamples,denseMaximum,densePoint,routeSamples:1201,minimumFlightClearance,evaluationCameras:Object.keys(evaluationCameras).length,protectedShoreSamples,milliseconds:performance.now()-began};
const output=new URL('../../artifacts/refinement-2026-09-30/broad-recess/',import.meta.url);fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(new URL('bounded-geometry.json',output),JSON.stringify(report,null,2)+'\n');
console.log('BROAD_RECESS_BOUNDED_AUDIT '+JSON.stringify(report));
