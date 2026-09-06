import * as THREE from 'three';
import {createRocks} from './terrain';
import {renderedTerrainHeight} from './terrain-surface';
import {upgradeNearRockOutcrops} from './photogrammetry-rocks';
import {pathPosition,evaluationCameras} from '../camera/cinematic';
import type {Textures} from '../render/materials';
export const ROCK_VISUAL_URL='/assets/rocks/rock_moss_set_01_2k.glb';
export const ROCK_GEOMETRY_URL='/assets/rocks/rock_moss_set_01_geometry.bin';
/** Shared visible and CPU geometry assembly, including exactly the same selection. */
export function createDetailedRocks(textures:Textures,source:THREE.Group){
 const rocks=createRocks(textures);
 upgradeNearRockOutcrops(rocks,source,{
  terrainHeight:renderedTerrainHeight,
  focusPoints:[...Array.from({length:81},(_,i)=>pathPosition(i*.25)),...Object.values(evaluationCameras).map(c=>c.position)]
 });
 // The final scans clone geometry/materials but share the original image maps.
 const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 source.traverse(o=>{if(o instanceof THREE.Mesh){geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)}});
 geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 return rocks;
}
