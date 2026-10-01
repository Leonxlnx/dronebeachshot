/** One bounded, subtractive fracture system in the eastern headland.
 * This operates on the authoritative terrain height, so terrain triangles,
 * roots, slope/habitat queries and the water field all see the same landform.
 * It never adds a separate cap, wall, displacement shader or collision proxy.
 */
type JointNode=readonly [x:number,z:number,depth:number,halfWidth:number];
const jointPaths:readonly (readonly JointNode[])[]=[
 // The principal joint opens into a broader eroded toe. Changes of strike and
 // asymmetrical banks leave connected buttresses in the original rock mass.
 [[358,100,0,7],[348,75,9,6],[338,58,15,7],[334,31,20,8],
  [315,15,14,11],[292,-9,7,15],[272,-25,0,18]],
 // Unequal tributaries join the same break; they do not form repeated parallel
 // channels or a periodic sawtooth around the entire mountain.
 [[380,65,0,6],[363,51,11,5],[350,39,15,6],[334,31,20,8]],
 [[374,119,0,6],[360,99,7,5],[348,75,9,6]],
 [[305,64,0,8],[318,49,8,6],[334,31,20,8]],
];

export const TERRAIN_FRACTURE_REGION={minX:252,maxX:400,minZ:-58,maxZ:143} as const;
const segments=jointPaths.flatMap(path=>path.slice(1).map((b,i)=>{
 const a=path[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
 const margin=Math.max(a[3],b[3])*1.12;
 return {x:a[0],z:a[1],dx,dz,inverseLength:1/length,inverseLengthSquared:1/(length*length),
  depth:a[2],depthDelta:b[2]-a[2],width:a[3],widthDelta:b[3]-a[3],
  minX:Math.min(a[0],b[0])-margin,maxX:Math.max(a[0],b[0])+margin,
  minZ:Math.min(a[1],b[1])-margin,maxZ:Math.max(a[1],b[1])+margin};
}));
const unit=(value:number)=>Math.max(0,Math.min(1,value));
function transition(a:number,b:number,value:number){const t=unit((value-a)/(b-a));return t*t*(3-2*t)}

/** Metres to remove, always in [0,20]. No terrain query or allocation occurs here. */
export function terrainFractureCut(x:number,z:number,baseHeight:number,shoreDistance:number){
 const r=TERRAIN_FRACTURE_REGION;
 if(x<=r.minX||x>=r.maxX||z<=r.minZ||z>=r.maxZ||shoreDistance<=25||baseHeight<=16||baseHeight>=385)return 0;
 let cut=0;
 for(const s of segments){
  if(x<s.minX||x>s.maxX||z<s.minZ||z>s.maxZ)continue;
  const px=x-s.x,pz=z-s.z,t=unit((px*s.dx+pz*s.dz)*s.inverseLengthSquared);
  const dx=px-s.dx*t,dz=pz-s.dz*t;
  const signedAcross=(s.dx*dz-s.dz*dx)*s.inverseLength;
  const halfWidth=(s.width+s.widthDelta*t)*(signedAcross<0?.72:1.10);
  // Distance to the finite segment gives rounded, tapering termini, while a
  // broken linear cross-section makes a narrow joint floor and a steeper bank.
  const radius=Math.hypot(dx,dz)/halfWidth;
  if(radius>=1)continue;
  const section=radius<.18?1-radius*(.12/.18):.88*Math.pow((1-radius)/.82,1.10);
  cut=Math.max(cut,(s.depth+s.depthDelta*t)*section);
 }
 if(cut===0)return 0;
 const coast=transition(25,45,shoreDistance),rock=transition(16,44,baseHeight);
 const summit=1-transition(355,385,baseHeight);
 const collar=transition(0,8,x-r.minX)*transition(0,8,r.maxX-x)
  *transition(0,8,z-r.minZ)*transition(0,8,r.maxZ-z);
 return Math.min(20,cut*coast*rock*summit*collar);
}
