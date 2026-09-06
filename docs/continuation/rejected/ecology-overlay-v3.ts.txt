import {renderedTerrainHeight} from './terrain-surface.ts';
import {rng,terrainSlope,shoreDistance} from './math.ts';
import {habitatAt} from './habitat.ts';
import {pathPosition} from '../camera/cinematic.ts';
import {isExposedCliff} from './cliff-buttresses.ts';
export type Placement={x:number,y:number,z:number,scale:number,angle:number,variant:number,family:number,exposure:number,moisture:number};
const flightSamples=Array.from({length:601},(_,i)=>pathPosition(i/30));
export function treePlacements(){
 const random=rng(86534),placements:Placement[]=[];
 for(let i=0;i<100000&&placements.length<14000;i++){
  const x=(random()-.5)*1150,z=random()*1040-280,d=shoreDistance(x,z),y=renderedTerrainHeight(x,z),slope=terrainSlope(x,z);
  if(d<27||y<1||slope>3.4)continue;
  const habitat=habitatAt(x,z),density=(.40+habitat.canopy*.60)*(.60+habitat.soil*.40);
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
  // Keep the seeded candidate sequence intact outside the new outcrops.
  // Exclude exposed rock instead of raising tree roots onto steep cliff faces.
  if(isExposedCliff(x,z,1))continue;
  placements.push({x,y:y-.06,z,scale,angle,variant,family,exposure:habitat.exposure,moisture:habitat.moisture});
 }
 return placements;
}
