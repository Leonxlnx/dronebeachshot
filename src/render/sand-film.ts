import {runup} from '../world/coastal';
import {smooth} from '../world/math';

// Same sampled wetting events as sandWetness; only surface-film persistence
// differs. The 1.5 s drainage time is an inspection study, not measured sand data.
const samples=21,step=.6,drainSeconds=1.5;
export function sandFilmWetness(x:number,d:number,time:number){
 let film=0;
 for(let i=0;i<samples;i++){
  const age=i*step,reach=runup(x,time-age);
  film=Math.max(film,(1-smooth(reach-.3,reach+1,d))*Math.exp(-age/drainSeconds));
 }
 return film;
}
export const sandFilmGLSL=`
float sandFilmWetness(float x,float d,float t){
 float film=0.;
 for(int i=0;i<${samples};i++){
  float age=float(i)*${step},reach=runup(x,t-age);
  film=max(film,(1.-smoothstep(reach-.3,reach+1.,d))*exp(-age/${drainSeconds}));
 }
 return film;
}
`;
