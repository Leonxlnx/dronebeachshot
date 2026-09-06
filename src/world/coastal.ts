import {shoreDistance,smooth} from './math.ts';
// Y-up; positive signed distance points inland. Phase travels in that direction.
export const COAST={waveNumber:.33,angularSpeed:1.5,meanRunup:1.0,runupAmplitude:3.8} as const;
export function coastNormal(x:number):[number,number]{const g=-.0047*x+.156*Math.cos(x*.013)+.16*Math.cos(x*.032),n=Math.hypot(g,1);return [-g/n,1/n]}
export function coastPhase(x:number,z:number,time:number){return shoreDistance(x,z)*COAST.waveNumber-COAST.angularSpeed*time+.5*Math.sin(x*.045)}
export function runup(x:number,time:number){const phase=-COAST.angularSpeed*time+.5*Math.sin(x*.045),amplitude=COAST.runupAmplitude+.6*Math.sin(time*.31+x*.012);return COAST.meanRunup+amplitude*Math.cos(phase)}
export function runupVelocity(x:number,time:number){const phase=-COAST.angularSpeed*time+.5*Math.sin(x*.045),mod=time*.31+x*.012;return .186*Math.cos(mod)*Math.cos(phase)+(COAST.runupAmplitude+.6*Math.sin(mod))*COAST.angularSpeed*Math.sin(phase)}
export function sandWetness(x:number,distance:number,time:number){let wet=0;for(let i=0;i<21;i++){const age=i*.6,reach=runup(x,time-age);wet=Math.max(wet,(1-smooth(reach-.3,reach+1,distance))*Math.exp(-age/18))}return wet}
export const coastalGLSL=`
vec2 coastNormal(float x){float g=-.0047*x+.156*cos(x*.013)+.16*cos(x*.032);return normalize(vec2(-g,1.));}
float coastPhase(vec2 p,float t){return shoreDist(p)*${COAST.waveNumber}-t*${COAST.angularSpeed}+.5*sin(p.x*.045);}
float runup(float x,float t){float phase=-t*${COAST.angularSpeed}+.5*sin(x*.045);return ${COAST.meanRunup.toFixed(1)}+(${COAST.runupAmplitude}+.6*sin(t*.31+x*.012))*cos(phase);}
float runupVelocity(float x,float t){float phase=-t*${COAST.angularSpeed}+.5*sin(x*.045),modulation=t*.31+x*.012;return .186*cos(modulation)*cos(phase)+(${COAST.runupAmplitude}+.6*sin(modulation))*${COAST.angularSpeed}*sin(phase);}
float sandWetness(float x,float d,float t){float wet=0.;for(int i=0;i<21;i++){float age=float(i)*.6;float reach=runup(x,t-age);wet=max(wet,(1.-smoothstep(reach-.3,reach+1.,d))*exp(-age/18.));}return wet;}
`;
