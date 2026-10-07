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

// Broad exposed faces need different surface normals across their whole mass.
// A small channel subtracted from a Gaussian slope leaves that slope intact on
// either side. These connected affine faces instead retain a resistant oblique
// buttress between broad eroded banks. They replace the rejected narrow slots
// and transverse bench strips; the original reference-stage joint stays above.
type FaceNode=readonly [x:number,z:number,height:number];
const westernNodes:readonly FaceNode[]=[
 [-244,286,256.28012313835364],[-240,238,184.18533106909652],
 [-226,197,117.29622476938215],[-212,165,115.97729118007562],
 [-210,274,287.1836989306747],[-193,238,285.8420395491123],
 [-170,197,221.2568529589553],[-159,174,162.54901207836537],
 [-177,286,334.83653647570145],[-165,249,260.28207689778003],
 [-148,216,207.75573390830357],[-135,179,157.2506562905682],
 [-119,286,380.8299675769232],[-115,251,316.78103848499813],
 [-118,210,249.70401088464945],[-123,174,142.58307269670817],
];
const westernTriangles=[
 [0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],
 [4,5,9],[4,9,8],[5,6,10],[5,10,9],[6,7,11],[6,11,10],
 [8,9,13],[8,13,12],[9,10,14],[9,14,13],[10,11,15],[10,15,14],
 [0,4,8],[7,15,11],[3,15,7],
].map(indices=>{
 const [a,b,c]=indices.map(index=>westernNodes[index]);
 const dx1=b[0]-a[0],dz1=b[1]-a[1],dx2=c[0]-a[0],dz2=c[1]-a[1];
 const inverseDeterminant=1/(dx1*dz2-dx2*dz1),dh1=b[2]-a[2],dh2=c[2]-a[2];
 return {x:a[0],z:a[1],height:a[2],dx1,dz1,dx2,dz2,inverseDeterminant,
  slopeX:(dh1*dz2-dh2*dz1)*inverseDeterminant,
  slopeZ:(dx1*dh2-dx2*dh1)*inverseDeterminant,
  minX:Math.min(a[0],b[0],c[0]),maxX:Math.max(a[0],b[0],c[0]),
  minZ:Math.min(a[1],b[1],c[1]),maxZ:Math.max(a[1],b[1],c[1])};
});
function westernTarget(x:number,z:number){
 for(const p of westernTriangles){
  if(x<p.minX||x>p.maxX||z<p.minZ||z>p.maxZ)continue;
  const dx=x-p.x,dz=z-p.z;
  const u=(dx*p.dz2-dz*p.dx2)*p.inverseDeterminant;
  const v=(p.dx1*dz-p.dz1*dx)*p.inverseDeterminant;
  if(u>=-1e-10&&v>=-1e-10&&u+v<=1+1e-10)return p.height+p.slopeX*dx+p.slopeZ*dz;
 }
 return Infinity;
}
export const COASTAL_FACE_REGION={minX:203,maxX:387,minZ:-90,maxZ:181} as const;
export const WESTERN_FACE_REGION={minX:-244,maxX:-115,minZ:165,maxZ:286} as const;
const facePatches=[
 {outline:[0,1,2,3,15,14,13,12,8].map(index=>westernNodes[index]),target:westernTarget,collars:[]},
 // This convex nose faces the headland camera south of the earlier incisions.
 // Two inclined faces meet on an oblique break; both face the review camera.
 // The upper return catches less low sunlight, exposing depth across the mass.
 {outline:[[320,-90],[365,-75],[387,-30],[383,62],[355,110],[310,100],[285,38],[300,-35]],
  target:(x:number,z:number)=>Math.min(48+(x-340)+.50*(z+40),89+1.2*(x-340)+.02*(z+40)),collars:[10,10,10,10,25,25,10,10]},
 {outline:[[203,86],[240,67],[284,78],[319,128],[292,181],[237,171]],
  target:(x:number,z:number)=>Math.min(120+1.4*(x-260)+1.3*(z-115),138+.85*(x-260)+.12*(z-115)),collars:[10,10,25,25,20,10]},
].map(patch=>({...patch,edges:patch.outline.map((a,i)=>{
 const b=patch.outline[(i+1)%patch.outline.length],dx=b[0]-a[0],dz=b[1]-a[1];
 return {x:a[0],z:a[1],endX:b[0],endZ:b[1],dx,dz,inverseLengthSquared:1/(dx*dx+dz*dz),collar:patch.collars[i]??10};
}),minX:Math.min(...patch.outline.map(p=>p[0])),maxX:Math.max(...patch.outline.map(p=>p[0])),
 minZ:Math.min(...patch.outline.map(p=>p[1])),maxZ:Math.max(...patch.outline.map(p=>p[1]))}));

/** Applied after cohort selection; actual roots, rocks and water share this cut. */
export function coastalFaceFractureCut(x:number,z:number,baseHeight:number,shoreDistance:number){
 const r=x<0?WESTERN_FACE_REGION:COASTAL_FACE_REGION;
 if(x<=r.minX||x>=r.maxX||z<=r.minZ||z>=r.maxZ||shoreDistance<=50||baseHeight<=22)return 0;
 let cut=0;
 for(const patch of facePatches){
  if(x<patch.minX||x>patch.maxX||z<patch.minZ||z>patch.maxZ)continue;
  let inside=false,collar=1;
  for(const edge of patch.edges){
   if((edge.z>z)!==(edge.endZ>z)&&x<edge.x+(z-edge.z)*edge.dx/edge.dz)inside=!inside;
   const px=x-edge.x,pz=z-edge.z,t=unit((px*edge.dx+pz*edge.dz)*edge.inverseLengthSquared);
   collar=Math.min(collar,transition(0,edge.collar,Math.hypot(px-edge.dx*t,pz-edge.dz*t)));
  }
  if(!inside)continue;
  // Deep outer returns use a broader weathered transition, avoiding a narrow
  // excavated rim. Only the perimeter rejoins the original surface; the interior keeps
  // the authored plane normals, with shared heights along every internal edge.
  const removal=Math.max(0,baseHeight-patch.target(x,z));
  cut=Math.max(cut,removal*collar);
 }
 return cut*transition(50,70,shoreDistance)*transition(22,48,baseHeight);
}
