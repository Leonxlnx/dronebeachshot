import * as THREE from '/workspace/sites/last-light-bay/node_modules/three/build/three.module.js';
// Original deterministic periodic value-noise lattice sampled as a true 3D
// volume. Trilinear lookup replaces repeated trigonometric hashes.
export function createCloudNoiseTexture(){
 const size=128,data=new Uint8Array(size*size*size);let state=0x34a95c71;
 for(let i=0;i<data.length;i++){state^=state<<13;state^=state>>>17;state^=state<<5;data[i]=state>>>24;}
 const texture=new THREE.Data3DTexture(data,size,size,size);
 texture.name='deterministic-cloud-noise-volume';texture.format=THREE.RedFormat;
 texture.type=THREE.UnsignedByteType;texture.colorSpace=THREE.NoColorSpace;
 texture.wrapS=texture.wrapT=texture.wrapR=THREE.RepeatWrapping;
 texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;
 texture.unpackAlignment=1;texture.needsUpdate=true;return texture;
}
