import type {Placement} from './ecology';
import {shoreDistance,shoreZ} from './math';
import {habitatAt} from './habitat';
import {renderedTerrainHeight} from './terrain-surface';
import {pathPosition} from '../camera/cinematic';

/** Small lower-canopy composition study. Existing mature and shrub cohorts stay
 * unchanged. Uses the existing Syringa source at uniform scale, never palms.
 * Source proportions and actual full-scene appearance still require review. */
export const COASTAL_YOUNG_WOODLAND_ENABLED=true;
// [group, X, signed shore distance, uniform source scale, yaw radians].
// Unequal 4/7/5 groups leave substantial open intervals along the coast.
export const COASTAL_YOUNG_WOODLAND_SITES:readonly (readonly [number,number,number,number,number])[]=[
 [0,108.3,37.5,.37,.38],[0,112.7,43.1,.49,2.16],
 [0,120.1,45.0,.43,4.73],[0,118.2,38.9,.34,1.29],
 [1,151.8,37.6,.39,5.14],[1,155.6,42.4,.50,2.68],
 [1,161.5,39.3,.35,.91],[1,164.3,43.1,.46,4.08],
 [1,168.2,37.9,.41,1.83],[1,172.3,43.5,.52,3.37],
 [1,174.1,37.0,.33,5.72],
 [2,207.7,38.0,.36,2.41],[2,210.5,43.0,.48,.17],
 [2,214.0,38.0,.40,4.54],[2,216.8,43.1,.51,1.66],
 [2,221.0,38.7,.34,3.68],
];

function triangleSlope(x:number,z:number){
 const x0=Math.floor(x/2)*2,z0=Math.floor(z/2)*2;
 const a=renderedTerrainHeight(x0,z0),b=renderedTerrainHeight(x0+2,z0);
 const c=renderedTerrainHeight(x0,z0+2),d=renderedTerrainHeight(x0+2,z0+2);
 return x-x0+z-z0<=2?Math.hypot(b-a,c-a)/2:Math.hypot(d-c,d-b)/2;
}

export function createCoastalYoungWoodland(base:readonly Placement[]):Placement[]{
 const additions:Placement[]=[],flight=Array.from({length:601},(_,i)=>pathPosition(i/30));
 for(const [,x,d,scale,angle] of COASTAL_YOUNG_WOODLAND_SITES){
  const coast=shoreZ(x),z=coast+d/shoreDistance(x,coast+1),habitat=habitatAt(x,z);
  if(triangleSlope(x,z)>.82||habitat.soil<.25||habitat.moisture<.36)continue;
  if(base.some(p=>Math.hypot(x-p.x,z-p.z)<2.3+p.scale*.2))continue;
  if(additions.some(p=>Math.hypot(x-p.x,z-p.z)<3.5))continue;
  // All three Syringa geometric LODs have basal radius <= .29219 m after
  // production normalization. Seat that entire small footprint in the actual
  // rendered triangles, rather than balancing only its centre on the slope.
  const radius=.293*scale;
  let floor=renderedTerrainHeight(x,z);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;floor=Math.min(floor,renderedTerrainHeight(x+Math.cos(a)*radius,z+Math.sin(a)*radius));}
  const y=floor-.035,height=14.4*scale,crownRadius=17*scale+2;
  if(flight.some(p=>p.y>y-2&&p.y<y+height+3&&Math.hypot(p.x-x,p.z-z)<crownRadius))continue;
  additions.push({x,y,z,scale,angle,variant:0,family:1,exposure:habitat.exposure,moisture:habitat.moisture});
 }
 return additions;
}
