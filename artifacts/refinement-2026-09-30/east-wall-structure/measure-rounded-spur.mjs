// CPU proof of shape reach, branch visibility and root impact; no GPU/production.
import fs from 'node:fs';
import * as THREE from 'three';
import {terrainHeight as H,shoreDistance as D} from '../../../src/world/math.ts';
import {treePlacements} from '../../../src/world/ecology.ts';
import {sampleCamera,pathPosition} from '../../../src/camera/cinematic.ts';
import {roundedSpurSample as coastalSpurSample,roundedSpurSettings} from './rounded-spur-study.mjs';
const spurVariants={roundedSpur:roundedSpurSettings};
const out=new URL('./',import.meta.url),sun=new THREE.Vector3(-.38,.105,-.92).normalize(),trees=treePlacements();
const cache=new Map(),vertex=(x,z)=>{const key=x+','+z;if(!cache.has(key))cache.set(key,Math.fround(H(x,z)));return cache.get(key)};
function makeSurface(p){const memo=new Map();const v=(x,z)=>{const key=x+','+z;if(!memo.has(key)){const y=vertex(x,z);memo.set(key,p?Math.fround(coastalSpurSample(x,z,H(x,z),D(x,z),p).height):y);}return memo.get(key)};
 return (x,z)=>{const x0=Math.floor(x/2)*2,z0=Math.floor(z/2)*2,u=(x-x0)/2,w=(z-z0)/2,a=v(x0,z0),b=v(x0+2,z0),c=v(x0,z0+2),d=v(x0+2,z0+2),lower=u+w<=1,dx=lower?(b-a)/2:(d-c)/2,dz=lower?(c-a)/2:(d-b)/2;return{height:lower?a*(1-u-w)+b*u+c*w:d*(u+w-1)+b*(1-w)+c*(1-u),normal:new THREE.Vector3(-dx,1,-dz).normalize(),slope:Math.hypot(dx,dz)}};
}
const before=makeSurface(null),stats=values=>{const a=values.toSorted((x,y)=>x-y);return{n:a.length,min:a[0],median:a[Math.floor(a.length*.5)],p90:a[Math.floor(a.length*.9)],max:a.at(-1)}};
function trace(camera,px,py,surface){const ray=new THREE.Vector3(px/512*2-1,1-py/288*2,.5).unproject(camera).sub(camera.position).normalize(),point=new THREE.Vector3();let low=0;
 for(let distance=4;distance<=1700;distance+=4){point.copy(camera.position).addScaledVector(ray,distance);if(Math.abs(point.x)>600||Math.abs(point.z)>800){low=distance;continue;}if(point.y<surface(point.x,point.z).height){let high=distance;for(let i=0;i<10;i++){const mid=(low+high)/2;point.copy(camera.position).addScaledVector(ray,mid);if(point.y<surface(point.x,point.z).height)high=mid;else low=mid;}point.copy(camera.position).addScaledVector(ray,(low+high)/2);return{point:point.toArray(),distance:(low+high)/2,...surface(point.x,point.z)}}low=distance;}return null;
}
const cameras=[9,10.5].map(time=>{const s=sampleCamera(time),c=new THREE.PerspectiveCamera(s.fov,16/9,.4,22000);c.position.copy(s.position);c.up.set(Math.sin(s.bank),Math.cos(s.bank),0);c.lookAt(s.target);c.updateMatrixWorld();return{time,c}});
const baseline=cameras.map(({time,c})=>({time,pixels:Array.from({length:41*61},(_,i)=>{const px=272+i%61*4,py=Math.floor(i/61)*4;const hit=trace(c,px,py,before);return{px,py,hit:hit?{...hit,normal:hit.normal.toArray()}:null}})}));
const reports=[];
for(const [name,p]of Object.entries(spurVariants)){
 const surface=makeSurface(p),grid=[],changed=[];
 for(let z=60;z<=220;z+=2)for(let x=90;x<=330;x+=2){const h=vertex(x,z),sample=coastalSpurSample(x,z,H(x,z),D(x,z),p),now=surface(x,z);const record={x,z,before:h,...sample,normal:now.normal.toArray(),slope:now.slope};grid.push(record);if(sample.changeMagnitude>0)changed.push(record);}
 const views=cameras.map(({time,c},cameraIndex)=>{const pixels=baseline[cameraIndex].pixels.map(old=>{const hit=trace(c,old.px,old.py,surface);let details=null;if(hit){const [x,,z]=hit.point,reference=H(x,z),s=coastalSpurSample(x,z,reference,D(x,z),p);details={...s,sunDot:hit.normal.dot(sun),viewerDot:hit.normal.dot(c.position.clone().sub(new THREE.Vector3(...hit.point)).normalize())};}return{px:old.px,py:old.py,before:old.hit,after:hit?{...hit,normal:hit.normal.toArray()}:null,details};});
  const affected=pixels.filter(v=>v.details?.changeMagnitude>0.05),terms={};for(const term of ['coast-join','rounded-toe','crown-join','west-flank','knee-return','east-return','retained-rough-body']){const rows=affected.filter(v=>v.details.term===term);terms[term]={rays:rows.length,projectedAreaEstimate:rows.length*16,pixelBounds:rows.length?[Math.min(...rows.map(v=>v.px)),Math.min(...rows.map(v=>v.py)),Math.max(...rows.map(v=>v.px)),Math.max(...rows.map(v=>v.py))]:null,sunDot:stats(rows.map(v=>v.details.sunDot)),viewerDot:stats(rows.map(v=>v.details.viewerDot))};}return{time,affectedRays:affected.length,projectedAreaEstimate:affected.length*16,terms,pixels};});
 const roots=[];for(const [index,t]of trees.entries()){
  if(t.x<100||t.x>310||t.z<65||t.z>215)continue;const a=before(t.x,t.z),b=surface(t.x,t.z),radius=2.2*t.scale*(1+t.variant*.06),ring=[];
  for(let k=0;k<8;k++){const angle=k*Math.PI/4,x=t.x+radius*Math.cos(angle),z=t.z+radius*Math.sin(angle);ring.push({before:before(x,z).height,after:surface(x,z).height});}
  const touched=Math.abs(a.height-b.height)>1e-6||ring.some(r=>Math.abs(r.before-r.after)>1e-6);if(!touched)continue;
  roots.push({index,x:t.x,z:t.z,family:t.family,scale:t.scale,oldY:t.y,newY:b.height-.06,rootRise:b.height-a.height,beforeSlope:a.slope,afterSlope:b.slope,footprintRadius:radius,beforeRingRange:Math.max(...ring.map(r=>r.before))-Math.min(...ring.map(r=>r.before)),afterRingRange:Math.max(...ring.map(r=>r.after))-Math.min(...ring.map(r=>r.after))});
 }
 const route=[];for(let i=0;i<=1200;i++){const q=pathPosition(i/60),a=before(q.x,q.z).height,b=surface(q.x,q.z).height;if(a!==b)route.push({time:i/60,point:q.toArray(),before:a,after:b});}
 reports.push({name,p,grid,summary:{vertices:changed.length,bounds:{x:[Math.min(...changed.map(r=>r.x)),Math.max(...changed.map(r=>r.x))],z:[Math.min(...changed.map(r=>r.z)),Math.max(...changed.map(r=>r.z))]},heightAdded:stats(changed.map(r=>r.changeMagnitude)),slopeDegrees:stats(changed.map(r=>Math.atan(r.slope)*180/Math.PI)),minimumShoreDistance:Math.min(...changed.map(r=>D(r.x,r.z))),routeChanged:route.length,rootFootprintsTouched:roots.length,rootYsChanged:roots.filter(r=>r.rootRise>1e-6).length,maxRootRise:Math.max(...roots.map(r=>r.rootRise)),newRootsOver34:roots.filter(r=>r.beforeSlope<=3.4&&r.afterSlope>3.4).map(r=>r.index)},views,roots,route});
}
const report={scope:'CPU-only shape discriminator: exact2m Float32 triangles,4px screen lattice raymarch4m/bisect; no vegetation/rock occlusion or artistic acceptance. Root ring is diagnostic, not actual source basal geometry.',baseline,reports};
fs.writeFileSync(new URL('rounded-spur-measurement.json',out),JSON.stringify(report)+'\n');console.log(JSON.stringify(reports.map(r=>({name:r.name,summary:r.summary,views:r.views.map(v=>({...v,pixels:undefined}))})),null,2));
