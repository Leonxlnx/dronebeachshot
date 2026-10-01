import {smooth} from './math.ts';
export type QualityTier='high'|'balanced'|'low';
export const lodRanges:Record<QualityTier,readonly[number,number,number,number,number,number]>={high:[24,48,80,135,245,325],balanced:[15,32,55,100,180,245],low:[0,1,2,3,4,5]};
/** Four complementary coverage intervals, including original-size near foliage. */
export function lodWeights(distance:number,tier:QualityTier):[number,number,number,number]{if(tier==='low')return [0,0,0,1];const [a,b,c,d,e,f]=lodRanges[tier],hero=smooth(a,b,distance),near=smooth(c,d,distance),far=smooth(e,f,distance);return [1-hero,hero-near,near-far,far]}
export function activeLods(min:number,max:number,tier:QualityTier):boolean[]{if(tier==='low')return [false,false,false,true];const [a,b,c,d,e,f]=lodRanges[tier];return [min<b,max>a&&min<d,max>c&&min<f,max>e]}
