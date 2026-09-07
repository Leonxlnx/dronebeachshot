import {BufferAttribute,type BufferGeometry} from 'three';

export type IslandTreeForm='base'|'fork-open';
type V3=[number,number,number];
type M3=[number,number,number,number,number,number,number,number,number];
const IDENTITY:M3=[1,0,0,0,1,0,0,0,1];
// Metres in the existing normalized Island Tree 02 root coordinate system.
// These are measured cross-sections/centreline regions of the licensed source,
// not a reconstructed skeleton. A continuous field spans wood and foliage.
const PIVOT:V3=[1.1742759943,2,-1.0149005651];
const SECTIONS=[
 [2,-.2144347131,.6829079986,1.1742759943,-1.0149005651],
 [4.5,-.6330229640,2.123610735,.6099552512,-.4970112145],
 [8.5,-.4162618220,4.499632359,-3.652919531,.5499294996],
 [12.5,4.109073639,7.341424465,-3.028862238,-.8176803589],
] as const;
const smooth=(t:number)=>t*t*t*(10+t*(-15+6*t));
const smoothDerivative=(t:number)=>30*t*t*(1-t)*(1-t);


function sectionAt(y:number){
 const values=[0,0,0,0],derivatives=[0,0,0,0];
 let lo=0;
 while(lo<SECTIONS.length-2&&y>SECTIONS[lo+1][0])lo++;
 const a=SECTIONS[lo],b=SECTIONS[lo+1],span=b[0]-a[0],t=Math.max(0,Math.min(1,(y-a[0])/span));
 const s=smooth(t),ds=y>a[0]&&y<b[0]?smoothDerivative(t)/span:0;
 for(let i=0;i<4;i++){values[i]=a[i+1]+(b[i+1]-a[i+1])*s;derivatives[i]=(b[i+1]-a[i+1])*ds}
 return {values,derivatives};
}

/** Same C2 position field for every source material and geometric LOD. */
export function islandTreeForm(x:number,y:number,z:number,form:IslandTreeForm='fork-open'):{position:V3,jacobian:M3}{
 if(form!=='base'&&form!=='fork-open')throw new Error('Unknown Island tree form');
 if(form==='base'||y<=2)return {position:[x,y,z],jacobian:[...IDENTITY]};
 const {values:c,derivatives:d}=sectionAt(y);
 // Compose two smooth shears instead of blending rotated surfaces. Each
 // shear has determinant one, so their composition cannot fold the wood.
 // Both fields follow the measured fork separation at this source height.
 const h=y-PIVOT[1],t=Math.min(1,h/5),root=smooth(t),dy=y<7?smoothDerivative(t)/5:0;
 const reach=h*root,reachY=root+h*dy;
 const midZ=(c[1]+c[3])*.5,midZY=(d[1]+d[3])*.5;
 const wz=1/(1+Math.exp((z-midZ)/1.8)),dwz=wz*(1-wz)/1.8;
 const bend=-.19*reach*wz,fy=-.19*(reachY*wz+reach*dwz*midZY),fz=.19*reach*dwz;
 const bentX=x+bend;
 const midX=(c[0]+c[2])*.5,midXY=(d[0]+d[2])*.5;
 const wx=1/(1+Math.exp((bentX-midX)/1.8)),dwx=wx*(1-wx)/1.8;
 const twist=-.16*reach*wx,gx=.16*reach*dwx,gy=-.16*(reachY*wx+reach*dwx*midXY);
 return {position:[bentX,y,z+twist],jacobian:[1,fy,fz,0,1,0,gx,gx*fy+gy,1+gx*fz]};
}

export function formDeterminant(j:M3){
 return j[0]*(j[4]*j[8]-j[5]*j[7])-j[1]*(j[3]*j[8]-j[5]*j[6])+j[2]*(j[3]*j[7]-j[4]*j[6]);
}

/** Mutate an owned, normalized geometry once during asset preparation. */
export function applyIslandTreeForm(geometry:BufferGeometry,form:IslandTreeForm='fork-open'){
 if(form==='base')return geometry;
 if(form!=='fork-open')throw new Error('Unknown Island tree form');
 if(!geometry.getAttribute('position')||!geometry.getAttribute('normal'))throw new Error('Tree form requires positions and normals');
  refineBentWood(geometry,form);
 const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
 if(positions.count!==normals.count)throw new Error('Tree form requires matching positions and normals');
 for(let i=0;i<positions.count;i++){
  const {position:p,jacobian:j}=islandTreeForm(positions.getX(i),positions.getY(i),positions.getZ(i),form);
  if(formDeterminant(j)<=.05)throw new Error('Tree form folds source geometry');
  // Cofactor(J) is det(J) J^-T; normalization cancels its positive scale.
  const nx=normals.getX(i),ny=normals.getY(i),nz=normals.getZ(i);
  const x=(j[4]*j[8]-j[5]*j[7])*nx+(j[5]*j[6]-j[3]*j[8])*ny+(j[3]*j[7]-j[4]*j[6])*nz;
  const y=(j[2]*j[7]-j[1]*j[8])*nx+(j[0]*j[8]-j[2]*j[6])*ny+(j[1]*j[6]-j[0]*j[7])*nz;
  const z=(j[1]*j[5]-j[2]*j[4])*nx+(j[2]*j[3]-j[0]*j[5])*ny+(j[0]*j[4]-j[1]*j[3])*nz;
  const length=Math.hypot(x,y,z);
  if(!p.every(Number.isFinite)||!Number.isFinite(length)||length<1e-10)throw new Error('Invalid tree form output');
  positions.setXYZ(i,...p);normals.setXYZ(i,x/length,y/length,z/length);
 }
 positions.needsUpdate=true;normals.needsUpdate=true;
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

function cross(a:V3,b:V3):V3{return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function sub(a:V3,b:V3):V3{return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
function transformedArea(a:V3,b:V3,c:V3,form:IslandTreeForm){
 const before=cross(sub(b,a),sub(c,a)),q=islandTreeForm((a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3,(a[2]+b[2]+c[2])/3,form),j=q.jacobian;
 if(Math.hypot(...before)<1e-12)return 1;
 const after=cross(sub(islandTreeForm(...b,form).position,islandTreeForm(...a,form).position),sub(islandTreeForm(...c,form).position,islandTreeForm(...a,form).position));
 const expected:V3=[0,0,0];
 const cols:V3[]=[[j[0],j[3],j[6]],[j[1],j[4],j[7]],[j[2],j[5],j[8]]];
 for(let i=0;i<3;i++){const cofactor=cross(cols[(i+1)%3],cols[(i+2)%3]);for(let k=0;k<3;k++)expected[k]+=cofactor[k]*before[i]}
 return (after[0]*expected[0]+after[1]*expected[1]+after[2]*expected[2])/(Math.hypot(...after)*Math.hypot(...expected));
}

// Coarse source triangles can span a whole curved bough. Refine only triangles
// whose straight transformed edges reverse orientation, plus their shared
// neighbours. Midpoints remain on the original source surface before bending;
// conforming edge splits preserve UV seams and avoid cracks/T-junctions.
export function refineBentWood(geometry:BufferGeometry,form:IslandTreeForm){
 const sourcePosition=geometry.getAttribute('position'),sourceNormal=geometry.getAttribute('normal'),sourceUV=geometry.getAttribute('uv');
 if(!sourceUV||!geometry.index)throw new Error('Tree wood refinement requires indexed UV geometry');
 // GLTFLoader commonly returns interleaved P/N/UV attributes. Their .array is
 // the entire shared buffer, so extract through accessors before refining.
 const positions:number[]=[],normals:number[]=[],uvs:number[]=[];
 for(let i=0;i<sourcePosition.count;i++){
  positions.push(sourcePosition.getX(i),sourcePosition.getY(i),sourcePosition.getZ(i));
  normals.push(sourceNormal.getX(i),sourceNormal.getY(i),sourceNormal.getZ(i));
  uvs.push(sourceUV.getX(i),sourceUV.getY(i));
 }
 let indices=Array.from(geometry.index.array);
 const initial=indices.length;
 const point=(id:number):V3=>[positions[id*3],positions[id*3+1],positions[id*3+2]];
 const key=(a:number,b:number)=>{
  const pa=point(a).map(v=>Math.round(v*1e6)).join(','),pb=point(b).map(v=>Math.round(v*1e6)).join(',');
  return pa<pb?pa+'|'+pb:pb+'|'+pa;
 };
 for(let iteration=0;iteration<12;iteration++){
  const marked=new Set<string>();
  for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3);if(transformedArea(point(a),point(b),point(c),form)<.1){marked.add(key(a,b));marked.add(key(b,c));marked.add(key(c,a))}}
  if(!marked.size){
   if(indices.length!==initial){
    geometry.setAttribute('position',new BufferAttribute(Float32Array.from(positions),3));
    geometry.setAttribute('normal',new BufferAttribute(Float32Array.from(normals),3));
    geometry.setAttribute('uv',new BufferAttribute(Float32Array.from(uvs),2));geometry.setIndex(indices);
   }
   geometry.userData.treeFormAddedTriangles=(indices.length-initial)/3;
   return;
  }
  const midpoints=new Map<string,number>(),next:number[]=[];
  const midpoint=(a:number,b:number)=>{
   const edge=a<b?a+','+b:b+','+a,existing=midpoints.get(edge);if(existing!==undefined)return existing;
   const id=positions.length/3;for(let k=0;k<3;k++){positions.push((positions[a*3+k]+positions[b*3+k])*.5);normals.push((normals[a*3+k]+normals[b*3+k])*.5)}
   const n=Math.hypot(normals[id*3],normals[id*3+1],normals[id*3+2]);for(let k=0;k<3;k++)normals[id*3+k]/=n;
   for(let k=0;k<2;k++)uvs.push((uvs[a*2+k]+uvs[b*2+k])*.5);
   midpoints.set(edge,id);return id;
  };
  for(let i=0;i<indices.length;i+=3){
   const v=indices.slice(i,i+3),m=v.map((a,k)=>marked.has(key(a,v[(k+1)%3]))?midpoint(a,v[(k+1)%3]):-1),count=m.filter(x=>x!==-1).length;
   if(count===0){next.push(...v);continue}
   if(count===3){const [a,b,c]=v,[ab,bc,ca]=m;next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);continue}
   if(count===1){const k=m.findIndex(x=>x!==-1),a=v[k],b=v[(k+1)%3],c=v[(k+2)%3],ab=m[k];next.push(a,ab,c,ab,b,c);continue}
   const k=m.findIndex((x,j)=>x!==-1&&m[(j+1)%3]!==-1),a=v[k],b=v[(k+1)%3],c=v[(k+2)%3],ab=m[k],bc=m[(k+1)%3];
   next.push(b,bc,ab,a,ab,c,ab,bc,c);
  }
  indices=next;
 }
 throw new Error('Tree wood refinement did not converge');
}

