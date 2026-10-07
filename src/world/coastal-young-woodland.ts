import type {Placement} from './ecology';
import {rng,shoreDistance,shoreZ} from './math';
import {habitatAt} from './habitat';
import {renderedTerrainHeight} from './terrain-surface';
import {pathPosition} from '../camera/cinematic';

/** Uneven lower-canopy pockets use the two existing broadleaf sources at uniform
 * scale. Mature trees and the separate shrub cohort keep their original identities. */
export const COASTAL_YOUNG_WOODLAND_ENABLED=true;
// Small young stems colonize a lower shelf than the mature cohort. Unequal
// separated pockets create a feathered edge while preserving long clear gaps.
const edgeRandom=rng(671204),edgePockets=[[-183,32.8,16],[-126,33.6,13],[59,32.1,14],
 [93,34.1,11],[130,31.8,18],[171,33.2,13],[215,32.4,16],[262,33.5,11]];
const edgeSites=edgePockets.flatMap(([x,distance,count],group)=>Array.from({length:count},()=>{
 const a=edgeRandom()*Math.PI*2,r=Math.sqrt(edgeRandom());
 return [30+group,x+Math.cos(a)*r*14,distance+Math.sin(a)*r*3.5,
  .16+edgeRandom()*.16,edgeRandom()*Math.PI*2,1] as const;
}));
// [group, X, signed shore distance, uniform source scale, yaw, source family].
// The first 16 reviewed sites are retained. Later pockets vary age and depth,
// leaving open intervals instead of making another continuous coastal row.
export const COASTAL_YOUNG_WOODLAND_SITES:readonly (readonly [number,number,number,number,number,(0|1)?])[]=[
 [0,108.3,37.5,.37,.38],[0,112.7,43.1,.49,2.16],
 [0,120.1,45.0,.43,4.73],[0,118.2,38.9,.34,1.29],
 [1,151.8,37.6,.39,5.14],[1,155.6,42.4,.50,2.68],
 [1,161.5,39.3,.35,.91],[1,164.3,43.1,.46,4.08],
 [1,168.2,37.9,.41,1.83],[1,172.3,43.5,.52,3.37],
 [1,174.1,37.0,.33,5.72],
 [2,207.7,38.0,.36,2.41],[2,210.5,43.0,.48,.17],
 [2,214.0,38.0,.40,4.54],[2,216.8,43.1,.51,1.66],
 [2,221.0,38.7,.34,3.68],
 [3,-167.8,37.8,.32,5.12],
 [4,-127.4,38.2,.29,2.43],[4,-115.3,38.7,.34,4.78],
 [5,61.8,38.3,.32,.56],
 [6,84.1,39.1,.31,.93],[6,88.8,42.6,.43,3.21],
 [7,128.5,35.2,.25,1.61,0],[7,132.6,42.2,.53,4.28],
 [7,138.4,35.7,.21,5.84,0],
 [8,182.7,35.5,.20,4.55,0],[8,193.0,38.4,.25,3.77],
 [9,226.4,38.5,.29,5.19],[9,235.7,38.0,.25,.68],
 [10,258.2,37.8,.23,1.48],[10,262.7,40.6,.43,4.69],
 [10,268.2,38.8,.33,3.02],
 [11,-206.1,39.1,.34,3.18],[11,-196.3,37.8,.25,5.41],
 [12,-149.3,38.5,.31,1.09],
 [16,99.1,42.4,.49,3.63],[16,103.5,35.3,.20,.17,0],
 [17,147.3,43.7,.44,2.67],[19,198.8,41.9,.46,4.06],
 ...edgeSites,
];

function triangleSlope(x:number,z:number){
 const x0=Math.floor(x/2)*2,z0=Math.floor(z/2)*2;
 const a=renderedTerrainHeight(x0,z0),b=renderedTerrainHeight(x0+2,z0);
 const c=renderedTerrainHeight(x0,z0+2),d=renderedTerrainHeight(x0+2,z0+2);
 return x-x0+z-z0<=2?Math.hypot(b-a,c-a)/2:Math.hypot(d-c,d-b)/2;
}

export function createCoastalYoungWoodland(base:readonly Placement[]):Placement[]{
 const additions:Placement[]=[],flight=Array.from({length:601},(_,i)=>pathPosition(i/30));
 for(const [group,x,d,scale,angle,family=1] of COASTAL_YOUNG_WOODLAND_SITES){
  const coast=shoreZ(x),z=coast+d/shoreDistance(x,coast+1),habitat=habitatAt(x,z);
  const edge=group>=30;
  if(triangleSlope(x,z)>(edge?.55:family===0?.42:.82)||habitat.soil<(edge?.08:family===0?.20:.25)||habitat.moisture<.36)continue;
  if(base.some(p=>Math.hypot(x-p.x,z-p.z)<2.3+p.scale*.2))continue;
  if(additions.some(p=>Math.hypot(x-p.x,z-p.z)<(edge?Math.max(1.8,(scale+p.scale)*4):3.5)))continue;
  // Measured basal radii across all three geometric LODs, after production
  // normalization. Wider Island roots only occupy the flatter outer shelf.
  const radius=(family===0?2.157:.293)*scale;
  let floor=renderedTerrainHeight(x,z);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;floor=Math.min(floor,renderedTerrainHeight(x+Math.cos(a)*radius,z+Math.sin(a)*radius));}
  const y=floor-.035,height=(family===0?18.2:14.4)*scale,crownRadius=17*scale+2;
  if(flight.some(p=>p.y>y-2&&p.y<y+height+3&&Math.hypot(p.x-x,p.z-z)<crownRadius))continue;
  additions.push({x,y,z,scale,angle,variant:0,family,exposure:habitat.exposure,moisture:habitat.moisture});
 }
 return additions;
}
