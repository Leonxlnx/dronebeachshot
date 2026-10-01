/** Authored principal-face target, rejected after actual candidate06 views.
 * Retained as a default-off historical study; the shared pre-edit terrain stage
 * remains the source for stable placement cohorts and subsequent candidates.
 */
export const PRINCIPAL_FACE_STUDY_ENABLED=false;
export const PRINCIPAL_FACE_COLLAR=10;
export const PRINCIPAL_FACE_REGION=Object.freeze({minX:-207,maxX:-106,minZ:148,maxZ:284});
// [id,x,z,precedingHeight,removalAtNode]. The independent fixture asserts heights.
export const PRINCIPAL_FACE_NODES=[
 ['P0',-196,169,128.7486420130699,0],
 ['P1',-126,148,81.93705236155026,0],
 ['P2',-106,194,210.33937286837212,0],
 ['P3',-110,276,355.37885548614554,0],
 ['P4',-164,284,343.4521592240984,0],
 ['P5',-202,238,271.7561867095556,0],
 ['P6',-207,200,182.64387013862097,0],
 ['J0',-177,219,272.40277332737276,29],
 ['J1',-149,207,256.30177625652874,32],
 ['J2',-123,203,231.86355869460021,16],
 ['R0',-181,210,249.2033580735109,0],
 ['R1',-153,198,227.65116248329207,0],
 ['U0',-164,234,312.8161509732029,16],
] as const;
export const PRINCIPAL_FACE_TRIANGLES=[
 [0,1,11],[0,11,10],[0,10,6],[1,2,9],[1,9,11],
 [10,11,8],[10,8,7],[11,9,8],
 [6,5,7],[6,7,10],[3,2,9],
 [5,4,12],[4,3,12],[3,9,12],[9,8,12],[8,7,12],[7,5,12],
] as const;
export const PRINCIPAL_FACE_BANK_TRIANGLES=[5,6,7] as const;
const perimeter=PRINCIPAL_FACE_NODES.slice(0,7);
const edges=perimeter.map((a,index)=>{
 const b=perimeter[(index+1)%perimeter.length],dx=b[1]-a[1],dz=b[2]-a[2];
 return {x:a[1],z:a[2],dx,dz,inverseLength:1/Math.hypot(dx,dz)};
});
const planes=PRINCIPAL_FACE_TRIANGLES.map(indices=>{
 const [a,b,c]=indices.map(index=>PRINCIPAL_FACE_NODES[index]);
 const dx1=b[1]-a[1],dz1=b[2]-a[2],dx2=c[1]-a[1],dz2=c[2]-a[2];
 const inverseDeterminant=1/(dx1*dz2-dx2*dz1),height=a[3]-a[4];
 const dh1=b[3]-b[4]-height,dh2=c[3]-c[4]-height;
 const slopeX=(dh1*dz2-dh2*dz1)*inverseDeterminant;
 const slopeZ=(dx1*dh2-dx2*dh1)*inverseDeterminant;
 return {x:a[1],z:a[2],height,dx1,dz1,dx2,dz2,inverseDeterminant,slopeX,slopeZ,
  minX:Math.min(a[1],b[1],c[1]),maxX:Math.max(a[1],b[1],c[1]),
  minZ:Math.min(a[2],b[2],c[2]),maxZ:Math.max(a[2],b[2],c[2])};
});
export function principalFaceTargetHeight(x:number,z:number){
 for(const plane of planes){
  if(x<plane.minX||x>plane.maxX||z<plane.minZ||z>plane.maxZ)continue;
  const dx=x-plane.x,dz=z-plane.z;
  const u=(dx*plane.dz2-dz*plane.dx2)*plane.inverseDeterminant;
  const v=(plane.dx1*dz-plane.dz1*dx)*plane.inverseDeterminant;
  if(u< -1e-10||v< -1e-10||u+v>1+1e-10)continue;
  return plane.height+plane.slopeX*dx+plane.slopeZ*dz;
 }
 return Infinity;
}
export function principalFaceBoundaryDistance(x:number,z:number){
 let distance=Infinity;
 for(const edge of edges)distance=Math.min(distance,(edge.dx*(z-edge.z)-edge.dz*(x-edge.x))*edge.inverseLength);
 return distance;
}
export function principalFacePlaneCut(x:number,z:number,currentHeight:number,shoreDistance:number){
 const r=PRINCIPAL_FACE_REGION;
 if(x<=r.minX||x>=r.maxX||z<=r.minZ||z>=r.maxZ||shoreDistance<=45)return 0;
 const distance=principalFaceBoundaryDistance(x,z);if(distance<=0)return 0;
 const removal=Math.max(0,currentHeight-principalFaceTargetHeight(x,z));
 if(removal===0)return 0;
 const t=Math.min(1,distance/PRINCIPAL_FACE_COLLAR),collar=t*t*(3-2*t);
 return removal*collar;
}
