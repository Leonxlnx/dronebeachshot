import {terrainFractureCut} from './terrain-fractures';
export const SEED=60829;
export const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
export function rng(seed=SEED){return ()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
export function hash(x:number,z:number){const n=Math.sin(x*127.1+z*311.7+SEED)*43758.5453;return n-Math.floor(n)}
export function noise(x:number,z:number){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);const a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1);return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v}
export function fbm(x:number,z:number,oct=5){let sum=0,a=.5;for(let i=0;i<oct;i++){sum+=noise(x,z)*a;const tx=x*1.83-z*.41;z=x*.41+z*1.83;x=tx;a*=.52}return sum}
// One curve drives sediment, terrain, wave refraction, foam and placement.
export function shoreZ(x:number){return 100-0.00235*x*x+12*Math.sin(x*.013)+5*Math.sin(x*.032)}
export function shoreDistance(x:number,z:number){const derivative=-.0047*x+.156*Math.cos(x*.013)+.16*Math.cos(x*.032);return (z-shoreZ(x))/Math.sqrt(1+derivative*derivative)}
type RidgeNode=readonly [x:number,z:number,height:number,width:number];
// Connected drainage divides, with authored summits and saddles. Width is the
// distance to a low shoulder, not a radial peak radius. Heights are relief above
// the unchanged coastal platform; the principal summit is calibrated below.
const ridgeSpines:readonly (readonly RidgeNode[])[]=[
 [[-535,510,170,132],[-415,448,207,110],[-292,412,218,106],[-203,386,257,115],[-157,366,296,125],[-126,350,301,128],[-101,329,294,125],[-58,397,240,112],[25,436,213,112],[130,420,248,99],[265,393,236,109],[410,416,224,123],[552,489,171,143]],
 [[-292,412,218,106],[-292,317,201,86],[-329,224,163,83],[-342,119,116,74],[-355,11,78,68],[-369,-107,39,56],[-388,-221,8,48]],
 [[-126,350,301,128],[-139,317,281,117],[-143,286,249,103],[-141,224,166,77],[-172,164,97,75],[-201,103,41,69],[-205,61,8,53]],
 [[-415,448,207,110],[-451,338,183,96],[-421,235,169,90],[-423,111,115,77],[-434,-51,68,70],[-461,-221,37,56],[-480,-382,7,46]],
 [[130,420,248,99],[183,330,211,84],[228,254,182,77],[273,174,143,75],[333,90,113,71],[363,-26,67,61],[383,-154,24,50],[387,-205,6,40]],
 [[410,416,224,123],[464,309,190,100],[483,198,141,92],[510,55,87,77],[531,-106,46,65],[556,-287,8,51]],
 [[-126,350,301,128],[-83,310,258,107],[-48,259,175,104],[-44,204,68,89]],
 [[-203,386,257,115],[-235,318,219,105],[-239,252,161,102],[-214,199,101,91],[-184,143,30,70]]
];
type ChannelNode=readonly [x:number,z:number,depth:number,width:number];
const drainageChannels:readonly (readonly ChannelNode[])[]=[
 [[-219,347,19,9],[-224,277,29,13],[-214,211,32,18],[-157,144,20,23],[-103,108,4,27]],
 [[-8,394,20,10],[13,314,31,15],[30,237,29,19],[47,171,22,24],[87,116,4,28]],
 [[-373,391,15,10],[-387,291,26,15],[-385,182,31,19],[-402,65,25,23],[-430,-69,9,29]],
 [[286,367,15,9],[300,292,26,14],[286,218,25,17],[245,157,19,22],[187,114,4,26]]
];
function compileLandformSegments(paths:readonly (readonly (RidgeNode|ChannelNode)[])[]){
 return paths.flatMap(path=>path.slice(1).map((b,i)=>{
  const a=path[i],dx=b[0]-a[0],dz=b[1]-a[1];
  const middleX=(a[0]+b[0])*.5,coastSlope=-.0047*middleX+.156*Math.cos(middleX*.013)+.16*Math.cos(middleX*.032);
  const inlandLength=Math.hypot(coastSlope,1),margin=Math.max(a[3],b[3])*6.0;
  return {x:a[0],z:a[1],dx,dz,minX:Math.min(a[0],b[0])-margin,maxX:Math.max(a[0],b[0])+margin,minZ:Math.min(a[1],b[1])-margin,maxZ:Math.max(a[1],b[1])+margin,saddle:.035+hash(a[0],a[1])*.10,inlandX:-coastSlope/inlandLength,inlandZ:1/inlandLength,inverseLengthSquared:1/(dx*dx+dz*dz),height:a[2],heightDelta:b[2]-a[2],width:a[3],widthDelta:b[3]-a[3]};
 }));
}
const ridgeSegments=compileLandformSegments(ridgeSpines);
const faceDrainage:ChannelNode[][]=[];
// Branching cuts start near each divide, grow through its steep face and merge
// into the low shoulder. They sculpt real ribs rather than noise on a silhouette.
for(let i=0;i<ridgeSegments.length;i++){
 const r=ridgeSegments[i],length=Math.hypot(r.dx,r.dz);
 if(length<65)continue;
 let nx=-r.dz/length,nz=r.dx/length;
 if(nx*r.inlandX+nz*r.inlandZ>0){nx=-nx;nz=-nz}
 for(let side=0;side<(i%3===0?2:1);side++){
  const t=.25+hash(r.x+side*17,r.z)*.5,qx=r.x+r.dx*t,qz=r.z+r.dz*t;
  const width=(r.width+r.widthDelta*t)*1.85,crest=r.height+r.heightDelta*t;
  const sign=side===0?1:-1,skew=(hash(r.z,r.x)-.5)*.38;
  const vx=nx*sign+r.dx/length*skew,vz=nz*sign+r.dz/length*skew;
  faceDrainage.push([[qx+vx*width*.1,qz+vz*width*.1,2,6],
   [qx+vx*width*.48,qz+vz*width*.48,Math.min(31,crest*.13),10+hash(qx,qz)*6],
   [qx+vx*width*1.23,qz+vz*width*1.23,4,22]]);
 }
}
const channelSegments=compileLandformSegments([...drainageChannels,...faceDrainage]);
function connectedRelief(x:number,z:number){
 // All perturbations have tens-of-metres support, resolved by the real 2 m grid.
 // Anisotropy follows each ridge rather than a repeating world-space sine.
 const rockWarp=(noise(x*.014+2.9,z*.013-7.1)-.5)*32;
 let mountain=0;
 for(const segment of ridgeSegments){
  if(x<segment.minX||x>segment.maxX||z<segment.minZ||z>segment.maxZ)continue;
  const px=x-segment.x,pz=z-segment.z,t=clamp((px*segment.dx+pz*segment.dz)*segment.inverseLengthSquared);
  const qx=segment.x+segment.dx*t,qz=segment.z+segment.dz*t;
  const dx=x-qx,dz=z-qz,distance=Math.hypot(dx,dz);
  const side=(dx*segment.inlandX+dz*segment.inlandZ)/Math.max(distance,1);
  const width=(segment.width+segment.widthDelta*t)*1.85*(1+.13*side);
  const roughDistance=Math.max(0,distance+rockWarp*smooth(0,50,distance));
  const radius=roughDistance/width;
  if(radius>2.8)continue;
  const profile=.74*Math.exp(-2.1*radius*radius)+.26*Math.exp(-.95*radius*radius);
  const saddle=1-segment.saddle*Math.pow(Math.sin(Math.PI*t),2);
  mountain=Math.max(mountain,(segment.height+segment.heightDelta*t)*saddle*profile);
 }
 let erosion=0;
 for(const segment of channelSegments){
  if(x<segment.minX||x>segment.maxX||z<segment.minZ||z>segment.maxZ)continue;
  const px=x-segment.x,pz=z-segment.z,t=clamp((px*segment.dx+pz*segment.dz)*segment.inverseLengthSquared);
  const dx=px-segment.dx*t,dz=pz-segment.dz*t,width=segment.width+segment.widthDelta*t;
  const distanceSquared=dx*dx+dz*dz;
  if(distanceSquared>width*width*9)continue;
  const cut=(segment.height+segment.heightDelta*t)*Math.exp(-.5*distanceSquared/(width*width));
  erosion=Math.max(erosion,cut);
 }
 // Cuts merge downslope into soil valleys and leave the authored summit intact.
 const exposure=smooth(35,105,mountain);
 const channelCut=erosion*exposure*(1-smooth(273,299,mountain));
 // Nested fracture scales break broad faces and divide crests at 15–70 m
 // wavelengths. Their amplitude is terrain relief, not a material normal trick.
 const fold=noise(x*.011+5.7,z*.009-2.3);
 const fracture=20*noise(x*.031+fold*1.9,z*.026-fold*.6)
  +12*noise(x*.077+1.4,z*.051+fold)
  +4*noise(x*.151-3.1,z*.119);
 return mountain-channelCut-fracture*exposure;
}
function coastalPlatform(x:number,z:number,d:number){return .045*d+.12*noise(x*.28,z*.28)*smooth(0,12,d)}
function fineGround(x:number,z:number,d:number){return smooth(35,90,d)*(noise(x*.3,z*.3)-.5)*1.6}
// Calibrate the actual 2 m summit crest, not a single protected vertex. This
// prevents the old point-only erosion exemption from creating a needle.
let ridgeReliefScale=Infinity;
for(let z=318;z<=384;z+=2)for(let x=-172;x<=-86;x+=2){
 const d=shoreDistance(x,z),relief=connectedRelief(x+12,z+10);
 ridgeReliefScale=Math.min(ridgeReliefScale,(425-coastalPlatform(x,z,d)-fineGround(x,z,d))/relief);
}
export function terrainHeight(x:number,z:number){
 const d=shoreDistance(x,z);
 if(d<0)return Math.max(-85,d*.10)+noise(x*.02,z*.02)*Math.min(-d*.01,.9);
 const sand=coastalPlatform(x,z,d);
 // Exact beach/seabed behavior is preserved through 25 m inland. All callers,
 // including CPU ecology and the GPU height atlas, use this one height function.
 if(d<=25)return sand;
 const foothill=9+20*fbm(x*.012,z*.012);
 const relief=Math.max(connectedRelief(x+12,z+10)*ridgeReliefScale,foothill);
 const base=sand+smooth(25,100,d)*relief+fineGround(x,z,d);
 return base-terrainFractureCut(x,z,base,d);
}
export function terrainSlope(x:number,z:number){const dx=(terrainHeight(x+1,z)-terrainHeight(x-1,z))*.5,dz=(terrainHeight(x,z+1)-terrainHeight(x,z-1))*.5;return Math.sqrt(dx*dx+dz*dz)}
export const shorelineGLSL=`float shoreZ(float x){return 100.-.00235*x*x+12.*sin(x*.013)+5.*sin(x*.032);}float shoreDist(vec2 p){float grad=-.0047*p.x+.156*cos(p.x*.013)+.16*cos(p.x*.032);return (p.y-shoreZ(p.x))/sqrt(1.+grad*grad);}`;
export const noiseGLSL=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+60829.)*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){float f=0.,a=.5;for(int i=0;i<4;i++){f+=a*noise(p);p=mat2(1.83,-.41,.41,1.83)*p;a*=.52;}return f;}`;
