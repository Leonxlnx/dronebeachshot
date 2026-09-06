import {noiseGLSL} from 'file:///workspace/sites/last-light-bay/src/world/math.ts';
import {weatherGLSL} from 'file:///workspace/sites/last-light-bay/src/world/weather.ts';
export const cloudFieldGLSL=`${noiseGLSL}${weatherGLSL}
const float cloudBase=900.;const float cloudTop=1630.;const float cloudWorldRadius=24000.;
vec2 cloudSegment(vec3 origin,vec3 direction){
 float lo=0.,hi=100000.;
 if(abs(direction.y)<.00001){if(origin.y<cloudBase||origin.y>cloudTop)return vec2(0.);}
 else {float a=(cloudBase-origin.y)/direction.y,b=(cloudTop-origin.y)/direction.y;lo=max(lo,min(a,b));hi=min(hi,max(a,b));}
 float a=dot(direction.xz,direction.xz),b=dot(origin.xz,direction.xz),c=dot(origin.xz,origin.xz)-cloudWorldRadius*cloudWorldRadius;
 if(a>.00001){float discriminant=b*b-a*c;if(discriminant<0.)return vec2(0.);float root=sqrt(discriminant);lo=max(lo,(-b-root)/a);hi=min(hi,(-b+root)/a);}
 else if(c>0.)return vec2(0.);
 return hi>lo?vec2(lo,hi):vec2(0.);
}

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
