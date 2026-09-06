import {noiseGLSL} from '/workspace/sites/last-light-bay/src/world/math.ts';
import {weatherGLSL} from '/workspace/sites/last-light-bay/src/world/weather.ts';
export const cloudFieldGLSL=`${noiseGLSL}${weatherGLSL}
const float cloudBase=850.;
const float cloudTop=2200.;
const float cloudWorldRadius=36000.;
const float cloudExtinction=.007;
uniform highp sampler3D uCloudNoise;
float n3(vec3 p){vec3 lattice=floor(p),f=fract(p);f=f*f*(3.-2.*f);return textureLod(uCloudNoise,(lattice+f+.5)/128.,0.).r;}
vec2 cloudSegment(vec3 origin,vec3 direction){
 float lo=0.,hi=100000.;
 if(abs(direction.y)<.00001){if(origin.y<cloudBase||origin.y>cloudTop)return vec2(0.);}
 else {float a=(cloudBase-origin.y)/direction.y,b=(cloudTop-origin.y)/direction.y;lo=max(lo,min(a,b));hi=min(hi,max(a,b));}
 float a=dot(direction.xz,direction.xz),b=dot(origin.xz,direction.xz),c=dot(origin.xz,origin.xz)-cloudWorldRadius*cloudWorldRadius;
 if(a>.00001){float discriminant=b*b-a*c;if(discriminant<0.)return vec2(0.);float root=sqrt(discriminant);lo=max(lo,(-b-root)/a);hi=min(hi,(-b+root)/a);}
 else if(c>0.)return vec2(0.);
 return hi>lo?vec2(lo,hi):vec2(0.);
}
float density(vec3 p){
 if(p.y<cloudBase||p.y>cloudTop)return 0.;
 float radius=length(p.xz);if(radius>cloudWorldRadius)return 0.;
 float weather=noise(p.xz*.00038+vec2(8.3,2.7))+.17*noise(p.xz*.00091);
 float weatherCover=smoothstep(.50,.72,weather);
 if(weatherCover<.001)return 0.;
 vec3 warped=p+vec3(n3(p*.0017)*140.,0.,n3(p*.0017+31.7)*140.);
 float distantDetail=1.-smoothstep(8000.,18000.,radius);
 float body=n3(warped*vec3(.0018,.00135,.0018))*.77+mix(.5,n3(warped*.0047),.25+.75*distantDetail)*.23;
 float erosion=mix(.5,n3(p*.014),distantDetail)*.07;
 float shape=smoothstep(.43,.60,body-erosion)*weatherCover;
 float localBase=cloudBase+noise(p.xz*.0013+4.7)*190.;
 float vertical=smoothstep(localBase,localBase+130.,p.y)*(1.-smoothstep(cloudTop-550.,cloudTop,p.y));
 // A world-anchored weather clearing around the sunset sector. The same density
 // function applies to visible clouds, sky reflections, and terrain shadows.
 vec2 along=normalize(vec2(-.38,-.92)),across=vec2(-along.y,along.x);
 vec2 openingDelta=p.xz-along*11000.;
 float opening=length(vec2(dot(openingDelta,across)/3100.,dot(openingDelta,along)/7300.));
 float coverage=smoothstep(.70,1.05,opening);
 float distantFade=(1.-smoothstep(20500.,cloudWorldRadius,radius))*smoothstep(1600.,4200.,radius);
 return shape*vertical*coverage*distantFade*.80;
}
float cloudSunTransmission(vec3 point,vec3 sun){
 float depth=density(point+sun*95.)*135.+density(point+sun*275.)*250.+density(point+sun*620.)*380.;
 return exp(-depth*cloudExtinction);
}
`;
