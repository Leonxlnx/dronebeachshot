import {noiseGLSL} from 'file:///workspace/sites/last-light-bay/src/world/math.ts';
import {weatherGLSL} from 'file:///workspace/sites/last-light-bay/src/world/weather.ts';
export const cloudFieldGLSL=`${noiseGLSL}${weatherGLSL}
float n3(vec3 p){float a=floor(p.y),f=fract(p.y);f=f*f*(3.-2.*f);return mix(noise(p.xz+a*vec2(7.7,19.3)),noise(p.xz+(a+1.)*vec2(7.7,19.3)),f);}
float density(vec3 p){
 // Separate weather-scale coverage from individual cumulus bodies. The first
 // native review exposed a continuous low ceiling when detail was only added.
 float weather=noise(p.xz*.00038+vec2(8.3,2.7))+.17*noise(p.xz*.00091);
 float coverage=smoothstep(.48,.68,weather);
 float shape=n3(p*vec3(.0032,.0045,.0032))*.72+n3(p*.009)*.23;
 float erosion=n3(p*.026)*.09;
 float edge=smoothstep(900.,1020.,p.y)*(1.-smoothstep(1360.,1630.,p.y));
 return smoothstep(.40,.65,shape-erosion)*coverage*edge;
}
`;
