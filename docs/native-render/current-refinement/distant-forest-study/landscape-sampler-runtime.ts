import * as THREE from 'three';

/** Exact vertical intersections with the indexed, rectangular annulus. */
export function createLandscapeSampler(mesh:THREE.Mesh){
 const position=mesh.geometry.attributes.position;
 const count=Number(mesh.userData.centralBoundaryVertices);
 const rings=Number(mesh.userData.radialRings);
 if(count!==2800||position.count!==count*rings)throw Error('Unexpected coastal annulus topology');
 const radii=Array.from({length:rings},(_,i)=>Math.abs(position.getX(i*count))/600);
 const triangle=(a:number,b:number,c:number,x:number,z:number)=>{
  const ax=position.getX(a),az=position.getZ(a),ay=position.getY(a);
  const bx=position.getX(b)-ax,bz=position.getZ(b)-az,by=position.getY(b)-ay;
  const cx=position.getX(c)-ax,cz=position.getZ(c)-az,cy=position.getY(c)-ay;
  const determinant=bx*cz-bz*cx;
  const u=((x-ax)*cz-(z-az)*cx)/determinant;
  const v=(bx*(z-az)-bz*(x-ax))/determinant;
  const dx=(by*cz-bz*cy)/determinant,dz=(bx*cy-by*cx)/determinant;
  return {height:ay+u*by+v*cy,slope:Math.hypot(dx,dz),inside:u>=-.00001&&v>=-.00001&&u+v<=1.00001};
 };
 return (x:number,z:number)=>{
  const radial=Math.max(Math.abs(x)/600,Math.abs(z)/800);
  if(radial<1||radial>=radii[radii.length-1])return null;
  let lo=0,hi=rings-1;
  while(hi-lo>1){const mid=(lo+hi)>>>1;if(radii[mid]<=radial)lo=mid;else hi=mid;}
  const px=x/radial,pz=z/radial;
  let edge:number;
  if(Math.abs(z)/800>=Math.abs(x)/600)edge=z<0?Math.floor((px+600)/2):1400+Math.floor((600-px)/2);
  else edge=x>0?600+Math.floor((pz+800)/2):2000+Math.floor((800-pz)/2);
  edge=((edge%count)+count)%count;
  const a=lo*count+edge,b=lo*count+(edge+1)%count,c=(lo+1)*count+edge,d=(lo+1)*count+(edge+1)%count;
  const first=triangle(a,b,c,x,z);
  return first.inside?first:triangle(c,b,d,x,z);
 };
}
