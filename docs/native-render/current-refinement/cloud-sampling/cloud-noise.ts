import * as THREE from '/workspace/sites/last-light-bay/node_modules/three/build/three.module.js';

// Original deterministic, periodic 3D scalar fields. These are density controls,
// not cloud photographs, an environment map or prerendered sky imagery.
function hash(x:number,y:number,z:number,seed:number){let n=Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791)^seed;n=Math.imul(n^(n>>>16),2246822519);n=Math.imul(n^(n>>>13),3266489917);return ((n^(n>>>16))>>>0)/4294967296;}
const wrap=(n:number,p:number)=>(n%p+p)%p;
const fade=(v:number)=>v*v*v*(v*(v*6-15)+10);
function perlin(x:number,y:number,z:number,period:number){
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=x-ix,fy=y-iy,fz=z-iz;
 const ux=fade(fx),uy=fade(fy),uz=fade(fz);let sum=0;
 for(let k=0;k<2;k++)for(let j=0;j<2;j++)for(let i=0;i<2;i++){
  const h=Math.floor(hash(wrap(ix+i,period),wrap(iy+j,period),wrap(iz+k,period),57031)*12);
  const a=fx-i,b=fy-j,c=fz-k;
  const gradients=[a+b,-a+b,a-b,-a-b,a+c,-a+c,a-c,-a-c,b+c,-b+c,b-c,-b-c];
  sum+=gradients[h]*(i?ux:1-ux)*(j?uy:1-uy)*(k?uz:1-uz);
 }
 return Math.max(0,Math.min(1,.5+sum*.65));
}
function worleyFactory(period:number){
 const features=new Float32Array(period**3*3);
 for(let z=0;z<period;z++)for(let y=0;y<period;y++)for(let x=0;x<period;x++){
  const n=((z*period+y)*period+x)*3;
  for(let c=0;c<3;c++)features[n+c]=.15+.7*hash(x,y,z,19763+c*1913);
 }
 return (x:number,y:number,z:number)=>{
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let closest=10;
  for(let k=-1;k<=1;k++)for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
   const ax=ix+i,ay=iy+j,az=iz+k,n=((wrap(az,period)*period+wrap(ay,period))*period+wrap(ax,period))*3;
   const dx=ax+features[n]-x,dy=ay+features[n+1]-y,dz=az+features[n+2]-z;
   closest=Math.min(closest,dx*dx+dy*dy+dz*dz);
  }
  return Math.max(0,1-Math.sqrt(closest));
 };
}
export function createCloudNoiseTexture(){
 const size=64,data=new Uint8Array(size**3*4),w4=worleyFactory(4),w8=worleyFactory(8),w16=worleyFactory(16);
 for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)/size,v=(y+.5)/size,w=(z+.5)/size,n=((z*size+y)*size+x)*4;
  data[n]=Math.round(255*(.625*perlin(u*4,v*4,w*4,4)+.25*perlin(u*8,v*8,w*8,8)+.125*perlin(u*16,v*16,w*16,16)));
  data[n+1]=Math.round(255*w4(u*4,v*4,w*4));data[n+2]=Math.round(255*w8(u*8,v*8,w*8));data[n+3]=Math.round(255*w16(u*16,v*16,w*16));
 }
 const texture=new THREE.Data3DTexture(data,size,size,size);texture.name='original-perlin-worley-density';
 texture.format=THREE.RGBAFormat;texture.type=THREE.UnsignedByteType;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
 texture.wrapS=texture.wrapT=texture.wrapR=THREE.RepeatWrapping;texture.unpackAlignment=1;texture.needsUpdate=true;
 return texture;
}
