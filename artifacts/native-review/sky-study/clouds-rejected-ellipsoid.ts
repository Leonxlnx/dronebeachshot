import {noiseGLSL} from './math';
import {weatherGLSL} from './weather';
export const cloudFieldGLSL=`${noiseGLSL}${weatherGLSL}
const float cloudBase=850.;
const float cloudTop=1900.;
const float cloudWorldRadius=24000.;
const float cloudExtinction=.007;
float n3(vec3 p){float a=floor(p.y),f=fract(p.y);f=f*f*(3.-2.*f);return mix(noise(p.xz+a*vec2(7.7,19.3)),noise(p.xz+(a+1.)*vec2(7.7,19.3)),f);}
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
 const float cellSize=2600.;
 vec2 cell=floor(p.xz/cellSize),cellCenter=(cell+.5)*cellSize;
 float seed=hash(cell+vec2(8.3,2.7));if(seed<.30)return 0.;
 vec2 jitter=(vec2(hash(cell+17.3),hash(cell-9.7))-.5)*380.;
 vec2 center=cellCenter+jitter;
 float level=1190.+hash(cell+3.1)*125.;
 vec3 q=p-vec3(center.x,level,center.y);
 float yaw=hash(cell+7.2)*6.283185;
 q.xz=mat2(cos(yaw),-sin(yaw),sin(yaw),cos(yaw))*q.xz;
 float body=1.-length(q/vec3(850.,290.,690.));
 body=max(body,1.-length((q-vec3(-310.,150.,80.))/vec3(440.,330.,410.)));
 body=max(body,1.-length((q-vec3(290.,205.,-150.))/vec3(430.,355.,420.)));
 body=max(body,1.-length((q-vec3(10.,300.,120.))/vec3(330.,290.,330.)));
 float erosion=(n3(p*.009)-.5)*.15+(n3(p*.021)-.5)*.055;
 float shape=smoothstep(-.045,.20,body-erosion);
 float vertical=smoothstep(cloudBase,cloudBase+95.,p.y)*(1.-smoothstep(cloudTop-100.,cloudTop,p.y));
 // A world-anchored weather clearing around the sunset sector. The same density
 // function applies to visible clouds, sky reflections, and terrain shadows.
 vec2 along=normalize(vec2(-.38,-.92)),across=vec2(-along.y,along.x);
 vec2 openingDelta=p.xz-along*11000.;
 float opening=length(vec2(dot(openingDelta,across)/3100.,dot(openingDelta,along)/7300.));
 float coverage=smoothstep(.70,1.05,opening);
 float distantFade=1.-smoothstep(19000.,cloudWorldRadius,radius);
 return shape*vertical*coverage*distantFade*.80;
}
float cloudSunTransmission(vec3 point,vec3 sun){
 float depth=density(point+sun*95.)*135.+density(point+sun*275.)*250.+density(point+sun*620.)*380.;
 return exp(-depth*cloudExtinction);
}
`;
