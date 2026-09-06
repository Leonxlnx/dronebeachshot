import * as THREE from 'three';
import {terrainHeight,shoreDistance,noise,clamp,smooth} from './math.ts';
const size=192,minX=-600,minZ=-800,spanX=1200,spanZ=1600;
const data=new Uint8Array(size*size*4);
// Precompute the terrain's exposure and drainage once; placement and wind use
// these same world fields. One byte per channel is sufficient for slow gradients.
for(let row=0;row<size;row++)for(let col=0;col<size;col++){
 const x=minX+(col+.5)*spanX/size,z=minZ+(row+.5)*spanZ/size,y=terrainHeight(x,z),d=shoreDistance(x,z);
 const east=terrainHeight(x+3,z),west=terrainHeight(x-3,z),north=terrainHeight(x,z+3),south=terrainHeight(x,z-3);
 const slope=Math.hypot(east-west,north-south)/6,rise=terrainHeight(x-67.91,z-16.98)-y;
 const shelter=smooth(1,42,rise),hollow=clamp(((east+west+north+south)*.25-y)*.18+.5);
 const exposure=clamp(.3+y/410+slope*.12-shelter*.55+.13*noise(x*.028,z*.028));
 const moisture=clamp(.40+shelter*.33+hollow*.22-exposure*.24-y*.0003);
 const soil=clamp((1-smooth(.55,2.2,slope))*smooth(22,63,d)*(.65+hollow*.35));
 const gaps=smooth(.20,.59,noise(x*.026,z*.026)+noise(x*.071+8,z*.071)*.22);
 const offset=(row*size+col)*4;data.set([exposure,moisture,soil,gaps].map(v=>Math.round(v*255)),offset);
}
export const habitatTexture=new THREE.DataTexture(new Uint8Array(data),size,size,THREE.RGBAFormat);habitatTexture.minFilter=habitatTexture.magFilter=THREE.LinearFilter;habitatTexture.generateMipmaps=false;habitatTexture.flipY=false;habitatTexture.needsUpdate=true;
export const habitatUniform={value:habitatTexture};
export function habitatAt(x:number,z:number){const u=clamp((x-minX)/spanX)*size-.5,v=clamp((z-minZ)/spanZ)*size-.5,c=Math.floor(u),r=Math.floor(v),fx=u-c,fz=v-r;const get=(column:number,row:number,k:number)=>data[(Math.max(0,Math.min(size-1,row))*size+Math.max(0,Math.min(size-1,column)))*4+k]/255;const values=Array.from({length:4},(_,k)=>(get(c,r,k)*(1-fx)+get(c+1,r,k)*fx)*(1-fz)+(get(c,r+1,k)*(1-fx)+get(c+1,r+1,k)*fx)*fz);return {exposure:values[0],moisture:values[1],soil:values[2],canopy:values[3]}}
export const habitatGLSL=`uniform sampler2D uHabitat;vec4 habitatAt(vec2 p){return texture2D(uHabitat,clamp((p-vec2(-600.,-800.))/vec2(1200.,1600.),vec2(0.),vec2(1.)));}`;

/** Replace only GPU canopy coverage with the actual tree crowns. CPU ecology
 * probabilities remain immutable, so regenerating placements stays deterministic. */
export function updateHabitatCanopy(trees:readonly {x:number,z:number,scale:number,family:number}[]){
 const pixels=habitatTexture.image.data as Uint8Array,coverage=new Float32Array(size*size);
 for(const tree of trees){
  const radius=(tree.family===2?5.5:tree.family===1?9.5:10.5)*tree.scale;
  const c0=Math.max(0,Math.floor((tree.x-radius-minX)/spanX*size)),c1=Math.min(size-1,Math.ceil((tree.x+radius-minX)/spanX*size));
  const r0=Math.max(0,Math.floor((tree.z-radius-minZ)/spanZ*size)),r1=Math.min(size-1,Math.ceil((tree.z+radius-minZ)/spanZ*size));
  for(let row=r0;row<=r1;row++)for(let col=c0;col<=c1;col++){
   const x=minX+(col+.5)*spanX/size,z=minZ+(row+.5)*spanZ/size,d=Math.hypot(x-tree.x,z-tree.z)/radius;
   if(d>=1)continue;const i=row*size+col,leafCover=(1-smooth(.55,1,d))*(tree.family===2?.48:.85);coverage[i]=1-(1-coverage[i])*(1-leafCover);
  }
 }
 for(let i=0;i<coverage.length;i++)pixels[i*4+3]=Math.round(coverage[i]*255);habitatTexture.needsUpdate=true;
}
