import {withOpeningGaze} from './opening-gaze.ts';
import {createFinalGlide} from './final-glide.ts';
import {renderedTerrainHeight} from '../world/terrain-surface.ts';
import * as THREE from 'three';
import {terrainHeight,shoreZ,clamp,smooth} from '../world/math.ts';
export const DURATION=20;
const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
// C2-continuous natural cubic splines in physical time avoid velocity jumps at phase boundaries.
export const flightKeys=[
 {t:0,p:V(-126,343,350)}, {t:1.5,p:V(-122,286,310)}, {t:3.0,p:V(-104,210,268)},
 {t:4.5,p:V(-75,117,208)}, {t:5.8,p:V(-90,54,149)}, {t:7.2,p:V(-125,15,96)},
 {t:9.0,p:V(-90,5.6,73)}, {t:10.8,p:V(-25,4.8,86)}, {t:12.8,p:V(62,4.8,69)},
 {t:14.7,p:V(112,5.0,21)}, {t:16.5,p:V(85,5.2,-42)}, {t:18,p:V(22,5.8,-150)}, {t:20,p:V(-46,6.6,-280)}
];
function spline(values:number[]){const n=values.length,second=Array(n).fill(0),u=Array(n).fill(0);for(let i=1;i<n-1;i++){const before=flightKeys[i].t-flightKeys[i-1].t,after=flightKeys[i+1].t-flightKeys[i].t,sig=before/(before+after),p=sig*second[i-1]+2;second[i]=(sig-1)/p;const change=(values[i+1]-values[i])/after-(values[i]-values[i-1])/before;u[i]=(6*change/(before+after)-sig*u[i-1])/p}for(let i=n-2;i>=0;i--)second[i]=second[i]*second[i+1]+u[i];return (t:number,order:0|1|2=0)=>{let i=0;while(i<n-2&&t>flightKeys[i+1].t)i++;const h=flightKeys[i+1].t-flightKeys[i].t,b=(t-flightKeys[i].t)/h,a=1-b;if(order===1)return (values[i+1]-values[i])/h+h*((1-3*a*a)*second[i]+(3*b*b-1)*second[i+1])/6;if(order===2)return a*second[i]+b*second[i+1];return a*values[i]+b*values[i+1]+((a*a*a-a)*second[i]+(b*b*b-b)*second[i+1])*h*h/6}}
const sx=spline(flightKeys.map(k=>k.p.x)),sy=spline(flightKeys.map(k=>k.p.y)),sz=spline(flightKeys.map(k=>k.p.z));
// C2 height correction for the connected ridge terrain; X/Z, gaze and the
// exact beach/sea path remain driven by the authored cinematic curve. These
// quintic coefficients fit the 1,201 terrain/tree/rock-bound clearance samples.
const ridgeHeightKnots=[0.0,0.0,0.0,0.0,0.0,0.0,0.4,0.8,1.2000000000000002,1.6,2.0,2.4,2.8000000000000003,3.2,3.6,4.0,4.4,4.800000000000001,5.200000000000001,5.6000000000000005,6.000000000000001,6.4,6.800000000000001,7.200000000000001,7.6000000000000005,8.0,8.4,8.8,9.200000000000001,9.600000000000001,10.000000000000002,10.4,10.5,10.5,10.5,10.5,10.5,10.5];
const ridgeHeightCoefficients=[108.52177579464978,111.29805470413193,116.73228897040659,124.56641666961134,134.56322439286114,146.70412329233454,158.5813409165828,169.71880436524577,179.0442865234464,185.75088572704894,190.34661337945437,192.56233205753122,191.75822710027475,187.84095853840356,180.10714344611185,169.31143708190783,155.97712889012988,140.50555390932922,123.15159257686493,104.35237466456955,84.5924766500614,64.67632442778452,46.30316588288565,30.41960082006043,17.600299007056343,8.412377740082555,2.822247698621398,0.5127992119928215,0.021897339282696573,0.0,0.0,0.0];
function ridgeHeightOffset(time:number){
 if(time>=10.5)return 0;
 const degree=5;let span=degree;
 while(span<ridgeHeightCoefficients.length-1&&time>=ridgeHeightKnots[span+1])span++;
 const d=Array.from({length:degree+1},(_,j)=>ridgeHeightCoefficients[span-degree+j]);
 for(let r=1;r<=degree;r++)for(let j=degree;j>=r;j--){
  const left=ridgeHeightKnots[span-degree+j],right=ridgeHeightKnots[span+j-r+1];
  const a=(time-left)/(right-left);d[j]=(1-a)*d[j-1]+a*d[j];
 }
 return d[degree];
}
function authoredPosition(time:number){const t=clamp(time,0,20);return V(sx(t),sy(t)+ridgeHeightOffset(t),sz(t))}
function sampleAuthoredCamera(time:number){const t=clamp(time,0,20),position=authoredPosition(t),forward=authoredPosition(Math.min(t+2.5,20)).sub(authoredPosition(Math.max(0,t-2.5)));forward.y=0;forward.normalize();const reveal=clamp(t/6),revealEase=reveal*reveal*reveal*(reveal*(reveal*6-15)+10);const heading=V(-104,0,-430).normalize().lerp(forward,revealEase).normalize();const target=position.clone().add(heading.multiplyScalar(100));target.y=position.y-((24.08965+47.91035*smooth(0,5,t))*(1-smooth(5,10.5,t))+1.0);const sunset=position.clone().add(V(-380,105,-920));target.lerp(sunset,smooth(14.8,19.8,t));const previous=authoredPosition(Math.max(0,t-.2)),next=authoredPosition(Math.min(20,t+.2));const bank=clamp((next.x-2*position.x+previous.x)*.007,-.015,.015)*(1-smooth(15,20,t));return {position,target,fov:42,bank};}
// Preserve the old lookahead as well as the route through 14.7 seconds.
// Otherwise replacing the final path also changes earlier gaze from 12.2 s.
export const GLIDE_START=14.7;
export const finalGlide=createFinalGlide(GLIDE_START,DURATION-GLIDE_START,
 authoredPosition(GLIDE_START),V(sx(GLIDE_START,1),sy(GLIDE_START,1),sz(GLIDE_START,1)),
 V(sx(GLIDE_START,2),sy(GLIDE_START,2),sz(GLIDE_START,2)));
export function pathPosition(time:number){return time<=GLIDE_START?authoredPosition(time):finalGlide(time)}
const finalTargetOffset=V(-750,82,-650);
export function sampleCamera(time:number){
 const t=clamp(time,0,DURATION),original=sampleAuthoredCamera(t);
 if(t<=GLIDE_START)return withOpeningGaze(original,t,authoredPosition);
 const position=pathPosition(t),a=original.target.clone().sub(original.position),b=finalTargetOffset.clone();
 const distance=a.length(),finalDistance=b.length();a.normalize();b.normalize();
 const u=clamp((t-GLIDE_START)/(18.8-GLIDE_START)),blend=u*u*u*(u*(u*6-15)+10);
 const angle=Math.acos(clamp(a.dot(b),-1,1));
 const direction=angle<1e-8?a.lerp(b,blend).normalize():a.multiplyScalar(Math.sin((1-blend)*angle)/Math.sin(angle)).addScaledVector(b,Math.sin(blend*angle)/Math.sin(angle));
 const target=blend===1?position.clone().add(finalTargetOffset):position.clone().addScaledVector(direction,distance+(finalDistance-distance)*blend);
 return {position,target,fov:42,bank:original.bank*(1-blend)};
}
export function applyCinematic(camera:THREE.PerspectiveCamera,time:number){const s=sampleCamera(time);camera.position.copy(s.position);camera.up.set(Math.sin(s.bank),Math.cos(s.bank),0);camera.lookAt(s.target);camera.fov=s.fov;camera.updateProjectionMatrix();}
export const evaluationCameras:Record<string,{position:THREE.Vector3,target:THREE.Vector3,time:number}>={
'mountain-wide':{position:V(-465,395,-280),target:V(-35,160,160),time:2},
'canopy-high':{position:V(-165,renderedTerrainHeight(-165,340)+55,340),target:V(-65,145,180),time:3},
'canopy-close':{position:V(-105,renderedTerrainHeight(-105,270)+44.8,270),target:V(-45,terrainHeight(-45,220)+10,220),time:5},
'forest-opening':{position:V(-84,renderedTerrainHeight(-84,170)+45.5,170),target:V(-98,20,95),time:7},
'descent-reveal':{position:V(-100,114,152),target:V(-30,5,-35),time:8},
'beach-transition':{position:V(-55,7,113),target:V(-15,3,87),time:10},
'sand-detail':{position:V(30,2.4,shoreZ(30)+19),target:V(10,.2,shoreZ(10)+4),time:11},
'wet-sand':{position:V(8,1.1,102),target:V(-50,.5,65),time:11.5},
'low-wave':{position:V(55,1.8,60),target:V(-30,.2,27),time:12},
'breaking-wave-side':{position:V(-45,3.2,63),target:V(30,.4,75),time:12.8},
'shallow-water':{position:V(90,24,20),target:V(20,0,55),time:13},
'headland':{position:V(260,35,-120),target:V(335,60,10),time:14},
'sunset-reflection':{position:V(10,4,-28),target:V(-365,80,-940),time:17},
'shoreline-flight':{position:V(-150,8,30),target:V(130,2,30),time:11},
'final-wide':{position:V(-290,140,-295),target:V(5,62,70),time:20},
'mobile-proof':{position:V(-390,315,-260),target:V(10,150,150),time:4}};
export function cameraDiagnostics(){let minClearance=Infinity,maxSpeed=0,last=sampleCamera(0).position;const samples=[];for(let i=0;i<=1200;i++){const t=i/60,s=sampleCamera(t);const clear=s.position.y-renderedTerrainHeight(s.position.x,s.position.z);minClearance=Math.min(minClearance,clear);const speed=i?s.position.distanceTo(last)*60:0;maxSpeed=Math.max(maxSpeed,speed);if(i%30===0)samples.push({t,position:s.position.toArray(),look:s.target.toArray(),clearance:clear,speed});last=s.position}return {minClearance,maxSpeed,samples};}
