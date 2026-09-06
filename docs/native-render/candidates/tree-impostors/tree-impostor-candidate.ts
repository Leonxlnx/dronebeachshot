import * as THREE from 'three';
import {prepareTreeMaterial} from '../render/vegetation-material';
import {excludeAboveWaterInstancesFromRefraction} from '../render/refraction';

export type TreeImpostorMetadata={
 family:number;center:number[];halfSize:number;
 bounds:{min:number[];max:number[]};columns:number;rows:number;
};

// Far LOD only. Caller supplies the same root instance matrices and colors as
// the source family. Near/hero/medium geometry and LOD distance bands are unchanged.
export function createTreeImpostor(metadata:TreeImpostorMetadata,
 albedo:THREE.Texture,normals:THREE.Texture,count:number){
 albedo.colorSpace=THREE.SRGBColorSpace;normals.colorSpace=THREE.NoColorSpace;
 for(const texture of [albedo,normals]){
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
 }
 const geometry=new THREE.PlaneGeometry(metadata.halfSize*2,metadata.halfSize*2);
 const center=new THREE.Vector3(...metadata.center as [number,number,number]);
 const radius=metadata.halfSize*Math.SQRT2+2;
 geometry.boundingSphere=new THREE.Sphere(center.clone(),radius);
 geometry.boundingBox=new THREE.Box3().setFromCenterAndSize(center,new THREE.Vector3().setScalar(radius*2));
 const source=new THREE.MeshStandardMaterial({map:albedo,alphaTest:.45,roughness:.95,metalness:0,side:THREE.DoubleSide});
 const {material,depth}=prepareTreeMaterial(source,3,{height:{value:metadata.bounds.max[1]},thinLeaf:true});source.dispose();
 function bindImpostor(target:THREE.Material,lit:boolean){
  const previous=target.onBeforeCompile.bind(target),key=target.customProgramCacheKey.bind(target);
  target.onBeforeCompile=(shader,renderer)=>{
   previous(shader,renderer);
   shader.uniforms.uImpostorCenter={value:center};shader.uniforms.uImpostorNormals={value:normals};
   shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
    uniform vec3 uImpostorCenter;
    varying vec3 vImpostorNX,vImpostorNY,vImpostorNZ;`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>
    vec3 impostorEye=(inverse(treeWorld)*vec4(cameraPosition,1.)).xyz;
    vec3 impostorDirection=normalize(impostorEye-uImpostorCenter);
    vec3 impostorUpReference=abs(impostorDirection.y)>.995?vec3(0.,0.,-1.):vec3(0.,1.,0.);
    vec3 impostorRight=normalize(cross(impostorUpReference,impostorDirection));
    vec3 impostorUp=normalize(cross(impostorDirection,impostorRight));
    transformed=uImpostorCenter+impostorRight*position.x+impostorUp*position.y;
    float impostorAzimuth=atan(impostorDirection.x,impostorDirection.z);
    float impostorColumn=mod(floor(impostorAzimuth*(8./6.28318530718)+.5)+8.,8.);
    float impostorElevation=asin(clamp(impostorDirection.y,-1.,1.))*57.295779513;
    float impostorRow=clamp(floor(impostorElevation/35.+.5),0.,2.);
    // Normal TextureLoader orientation: atlas PNG row0 is the lowest elevation.
    vMapUv=vec2((impostorColumn+uv.x)/8.,(2.-impostorRow+uv.y)/3.);
    vec3 impostorX=treeWorld[0].xyz,impostorY=treeWorld[1].xyz,impostorZ=treeWorld[2].xyz;
    vImpostorNX=impostorX/max(dot(impostorX,impostorX),.0001);
    vImpostorNY=impostorY/max(dot(impostorY,impostorY),.0001);
    vImpostorNZ=impostorZ/max(dot(impostorZ,impostorZ),.0001);`);
   if(lit){
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
     uniform sampler2D uImpostorNormals;varying vec3 vImpostorNX,vImpostorNY,vImpostorNZ;`)
     .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
     vec3 impostorNormal=normalize(texture2D(uImpostorNormals,vMapUv).rgb*2.-1.);
     vec3 impostorWorldNormal=normalize(vImpostorNX*impostorNormal.x+vImpostorNY*impostorNormal.y+vImpostorNZ*impostorNormal.z);
     normal=normalize(mat3(viewMatrix)*impostorWorldNormal);`);
   }
  };
  target.customProgramCacheKey=()=>key()+'-native-tree-impostor-v1-'+(lit?'lit':'depth');
 }
 bindImpostor(material,true);bindImpostor(depth,false);
 const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name='tree-impostor-family-'+metadata.family;
 mesh.customDepthMaterial=depth;mesh.castShadow=true;mesh.receiveShadow=true;
 excludeAboveWaterInstancesFromRefraction(mesh);
 // Apply the existing withCloudLighting once in the scene's normal material pass.
 // After setting matrices/colors, caller must recompute the instance bounds.
 return mesh;
}
