import {noiseGLSL} from '/workspace/sites/last-light-bay/src/world/math.ts';
import {weatherGLSL} from '/workspace/sites/last-light-bay/src/world/weather.ts';
export const cloudFieldGLSL=`${noiseGLSL}${weatherGLSL}
const float cloudBase=450.;
const float cloudTop=2800.;
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
 // Sparse world-anchored cumulus groups. Each union contains a wide lower
 // condensation body and unequal upper lobes, with 3D boundary erosion.
 vec2 cell=floor(p.xz/2700.);float shape=0.;
 for(int iz=-1;iz<=1;iz++)for(int ix=-1;ix<=1;ix++){
  vec2 id=cell+vec2(float(ix),float(iz));
  float seed=hash(id+12.7);if(seed<.32)continue;
  vec2 center=(id+vec2(.22+hash(id+7.1)*.56,.22+hash(id+19.3)*.56))*2700.;
  float base=520.+hash(id+51.8)*410.;
  float tall=450.+hash(id+24.5)*1250.;
  vec2 radii=vec2(600.+hash(id+4.2)*740.,520.+hash(id+5.9)*760.);
  vec3 q=(p-vec3(center.x,base+tall*.27,center.y))/vec3(radii.x,tall*.40,radii.y);
  float body=1.-dot(q,q);
  vec3 top=(p-vec3(center.x+radii.x*.12,base+tall*.60,center.y-radii.y*.18))/vec3(radii.x*.63,tall*.48,radii.y*.60);
  body=max(body,1.-dot(top,top));
  vec3 shoulder=(p-vec3(center.x-radii.x*.48,base+tall*.44,center.y+radii.y*.12))/vec3(radii.x*.48,tall*.34,radii.y*.56);
  body=max(body,1.-dot(shoulder,shoulder));
  shape=max(shape,body*smoothstep(base-50.,base+65.,p.y));
 }
 if(shape<=0.)return 0.;
 float erosion=(n3(p*.0054)*.68+n3(p*.0137)*.24+n3(p*.032)*.08)*.48;
 float body=smoothstep(.035,.27,shape-erosion);
 vec2 along=normalize(vec2(-.38,-.92)),across=vec2(-along.y,along.x);
 vec2 openingDelta=p.xz-along*11000.;
 float opening=length(vec2(dot(openingDelta,across)/2900.,dot(openingDelta,along)/6500.));
 float coverage=smoothstep(.68,1.05,opening);
 float distantFade=(1.-smoothstep(26000.,cloudWorldRadius,radius))*smoothstep(1600.,4000.,radius);
 return body*coverage*distantFade*.65;
}
float cloudSunTransmission(vec3 point,vec3 sun){
 float depth=density(point+sun*95.)*135.+density(point+sun*275.)*250.+density(point+sun*620.)*380.;
 return exp(-depth*cloudExtinction);
}
`;
