import {renderedTerrainHeight,renderedTerrainHeightBeforePrincipalFace} from './terrain-surface.ts';
import {rng,terrainSlopeBeforePrincipalFace,shoreDistance} from './math.ts';
import {habitatAtBeforePrincipalFace} from './habitat.ts';
import {pathPosition} from '../camera/cinematic.ts';
export type Placement={x:number,y:number,z:number,scale:number,angle:number,variant:number,family:number,exposure:number,moisture:number};
const flightSamples=Array.from({length:601},(_,i)=>pathPosition(i/30));
export function treePlacementsBeforePrincipalFace(){
 const random=rng(86534),placements:Placement[]=[];
 for(let i=0;i<100000&&placements.length<14000;i++){
  const x=(random()-.5)*1150,z=random()*1040-280,d=shoreDistance(x,z),y=renderedTerrainHeightBeforePrincipalFace(x,z),slope=terrainSlopeBeforePrincipalFace(x,z);
  if(d<27||y<1||slope>3.4)continue;
  const habitat=habitatAtBeforePrincipalFace(x,z),density=(.40+habitat.canopy*.60)*(.60+habitat.soil*.40);
  // The first full-scene review showed almost barren mountains: the old 26%
  // survival above slope 1.4 combined with the soil mask removed most crowns.
  // Woodland follows soil pockets up slopes; the steepest faces remain open.
  if(random()>density||slope>2.5&&random()>.24||slope>1.4&&slope<=2.5&&random()>.82)continue;
  const palm=d<110&&y<38&&slope<.65&&habitat.moisture>.38&&random()>.65;
  const family=palm?2:random()<.12+habitat.exposure*.34?1:0;
  const variant=habitat.exposure>.7||habitat.soil<.3?2:random()<.25?0:1;
  const scale=family===2?(variant===0?.58:variant===2?.8:1)+random()*.24:variant===0?.65+random()*.25:variant===2?.75+random()*.28:1.+random()*.30;
  const angle=random()*Math.PI*2,height=(family===2?21:family===1?14.4:18.2)*scale,radius=(family===2?6:17)*scale*(1+variant*.06)+2;
  if(flightSamples.some(p=>p.y>y-2&&p.y<y+height+3&&Math.hypot(p.x-x,p.z-z)<radius))continue;
  placements.push({x,y:y-.06,z,scale,angle,variant,family,exposure:habitat.exposure,moisture:habitat.moisture});
 }
 return placements;
}

// Keep the reviewed cohort and every random identity stable. Only the actual
// root height follows the local terrain edit; no rejection/refill moves trees
// elsewhere. Steep-face/basal support is a separate explicit geometry review.
export function treePlacements(){return treePlacementsBeforePrincipalFace().map(tree=>({...tree,y:renderedTerrainHeight(tree.x,tree.z)-.06}))}
