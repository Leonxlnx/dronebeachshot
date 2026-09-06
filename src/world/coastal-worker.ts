import * as THREE from 'three';
import {createDetailedRocks,ROCK_GEOMETRY_URL} from './detailed-rocks';
import {decodeRockGeometrySource} from './rock-geometry';
import {createCoastalField} from './coastal-field';
import type {Textures} from '../render/materials';
// This worker builds the same seeded geometry as the visible world. Material
// textures do not participate in the rasterization and are never downloaded here.
self.onmessage=async()=>{
 const texture=new THREE.Texture();
 const textures=Object.fromEntries(['rock','rockNormal','rockARM','sand','sandNormal','sandARM','bark','barkNormal','soil','soilNormal','soilARM','moss','mossNormal','mossARM'].map(key=>[key,texture])) as Textures;
 try{
  const response=await fetch(ROCK_GEOMETRY_URL);
  if(!response.ok)throw new Error('Rock geometry fetch failed: '+response.status);
  const source=decodeRockGeometrySource(await response.arrayBuffer());
  const rocks=createDetailedRocks(textures,source),field=createCoastalField(rocks),data=field.texture.image.data as Float32Array;
  self.postMessage({data:data.buffer,bounds:field.bounds.toArray(),diagnostics:field.diagnostics},{transfer:[data.buffer]});
  rocks.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose()}});field.texture.dispose();texture.dispose();
 }catch(error){self.postMessage({error:String(error)})}
};
