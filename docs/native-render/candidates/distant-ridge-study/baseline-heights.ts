import {terrainHeight,shoreZ,noise,fbm} from './src/world/math.ts';
const continuationClamp = (v:number) => Math.max(0, Math.min(1, v));
const continuationSmooth = (a:number,b:number,v:number) => {
 const t=continuationClamp((v-a)/(b-a));return t*t*(3-2*t);
};
function continuationOutsideDistance(x:number,z:number) {
 return Math.hypot(Math.max(0,Math.abs(x)-600),Math.max(0,Math.abs(z)-800));
}
function continuationShore(x:number) {
 // shoreZ is intentionally parabolic inside the authored bay. Continuing its
 // x² term forever would turn distant water into an enormous rising land wall.
 if(Math.abs(x)<=600)return shoreZ(x);
 const side=Math.sign(x),edge=side*600,u=Math.abs(x)-600;
 const edgeSlope=(-.0047*edge+.156*Math.cos(edge*.013)+.16*Math.cos(edge*.032))*side;
 const bendLength=620;
 const tangentBend=edgeSlope*bendLength*(1-Math.exp(-u/bendLength));
 const outerTrend=.075*(u-bendLength*(1-Math.exp(-u/bendLength)));
 const meander=(noise(x*.0008,side*7.13)-noise(edge*.0008,side*7.13))*320
  *continuationSmooth(50,700,u);
 return shoreZ(edge)+tangentBend+outerTrend+meander;
}
function continuationRegionalHeight(x:number,z:number) {
 const coast=continuationShore(x);
 const coastSlope=(continuationShore(x+2)-continuationShore(x-2))*.25;
 const inland=(z-coast)/Math.sqrt(1+coastSlope*coastSlope);
 if(inland<0)return Math.max(-85,inland*.16);
 const distance=continuationOutsideDistance(x,z);
 const warp=(fbm(x*.0019,z*.0017,3)-.5)*95;
 let mountain=0;
 // Continuous ridge spines follow the coast through many coves. Their height,
 // width, and lateral position vary independently, rather than repeating cones.
 for(let ridge=0;ridge<3;ridge++){
  const seed=11.3+ridge*17.9;
  const center=250+ridge*520+(fbm(x*.00115,seed,3)-.5)*210;
  const width=240+ridge*105+noise(x*.0009,seed+3.1)*115;
  const crest=140+noise(x*.00132,seed+6.8)*335
   +noise(x*.0031,seed+1.2)*115+ridge*55;
  const across=(inland-center+warp)/(width*1.55);
  // Round only the narrow crest, preserving steep flank character. Smoothing
  // the whole profile inflated the remote ranges into broad artificial domes.
  const flank=Math.max(0,1-(Math.sqrt(across*across+.0025)-.05));
  mountain=Math.max(mountain,crest*Math.pow(flank,1.55));
 }
 const foothills=16+33*fbm(x*.0023,z*.0021,3);
 const detail=(noise(x*.0071+noise(z*.0017,9.7)*3,z*.0059)-.5)*42
  *(1-continuationSmooth(3500,6500,distance));
 const coastalRise=continuationSmooth(10,100,inland);
 return Math.min(inland*.022,28)+coastalRise*Math.max(foothills,mountain+detail);
}
function continuationHeight(x:number,z:number) {
 const distance=continuationOutsideDistance(x,z);
 const core=terrainHeight(x,z);
 // Exact values (and an undisturbed normal neighborhood) at all existing edges.
 if(distance<=28)return core;
 const transition=continuationSmooth(28,180,distance);
 const fullRegional=continuationRegionalHeight(x,z);
 // Actual wide views exposed a wall when a 500 m regional ridge was blended
 // only 180 m beyond the core. Build foothills first; major relief belongs far
 // behind the authored bay, with a broad natural rise into those ranges.
 const regional=fullRegional<0?fullRegional:Math.min(fullRegional,28)
  +Math.max(0,fullRegional-28)*continuationSmooth(250,1600,distance);
 const joined=core+(regional-core)*transition;
 const ringDistance=(Math.max(Math.abs(x)/600,Math.abs(z)/800)-1)*800;
 const fadeStart=6350+noise(x*.00065,z*.00065)*350;
 const edgeFade=continuationSmooth(fadeStart,7900,ringDistance);
 // Every final perimeter vertex lies at -85 m. The rectangle never silhouettes.
 return joined+(-85-joined)*edgeFade;
}

export {continuationHeight,continuationRegionalHeight,continuationShore,continuationOutsideDistance};
