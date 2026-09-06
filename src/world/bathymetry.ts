import * as THREE from 'three';
import {createLandscapeSampler} from './landscape-sampler';
import {renderedTerrainHeight} from './terrain-surface';

/** Broad water depth is sampled from the same triangles as the visible land. */
export function createDistantBathymetry(terrain:THREE.Group){
 const mesh=terrain.getObjectByName('continuous-coastal-extension');
 if(!(mesh instanceof THREE.Mesh))throw Error('Missing coastal continuation');
 const sample=createLandscapeSampler(mesh),size=512,bounds=new THREE.Vector4(-6600,-8800,6600,8800);
 const data=new Float32Array(size*size);
 for(let row=0;row<size;row++)for(let col=0;col<size;col++){
  const x=bounds.x+(col+.5)/size*(bounds.z-bounds.x),z=bounds.y+(row+.5)/size*(bounds.w-bounds.y);
  data[row*size+col]=Math.abs(x)<=600&&Math.abs(z)<=800
   ?renderedTerrainHeight(x,z):sample(x,z)?.height??-85;
 }
 const texture=new THREE.DataTexture(data,size,size,THREE.RedFormat,THREE.FloatType);
 texture.name='visible-land-bathymetry';texture.internalFormat='R32F';
 texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;
 texture.flipY=false;texture.needsUpdate=true;
 return {texture,bounds};
}

export const bathymetryGLSL=`
uniform sampler2D uDistantBathymetry;
uniform vec4 uBathymetryBounds;
float distantSeabedHeight(vec2 p){
 vec2 grid=(p-uBathymetryBounds.xy)/(uBathymetryBounds.zw-uBathymetryBounds.xy)*512.-.5;
 vec2 base=floor(grid),f=fract(grid),uv=(base+.5)/512.;
 float a=texture2D(uDistantBathymetry,uv).r,b=texture2D(uDistantBathymetry,uv+vec2(1./512.,0.)).r;
 float c=texture2D(uDistantBathymetry,uv+vec2(0.,1./512.)).r,d=texture2D(uDistantBathymetry,uv+vec2(1./512.)).r;
 return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
`;
