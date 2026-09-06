import {noiseGLSL} from '/workspace/sites/last-light-bay/src/world/math.ts';
import {weatherGLSL} from '/workspace/sites/last-light-bay/src/world/weather.ts';
export const cloudFieldGLSL=`${noiseGLSL}${weatherGLSL}
uniform highp sampler3D uCloudNoise;
const float cloudBase=1000.;
const float cloudTop=2250.;
const float cloudWorldRadius=36000.;
const float cloudExtinction=.009;
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
 float weather=noise(p.xz*.00021+vec2(8.3,2.7))*.8+.2*noise(p.xz*.00063);
 float cover=smoothstep(.26,.74,weather)*.61;
 if(cover<.001)return 0.;
 float height=(p.y-cloudBase)/(cloudTop-cloudBase);
 // Inverted cellular noise supplies rounded connected lobes in all axes.
 // Gradient Perlin noise joins those lobes; a higher frequency sample erodes edges.
 vec3 coord=p*.00032;
 vec4 n=texture(uCloudNoise,coord);
 float cellular=dot(n.gba,vec3(.625,.25,.125));
 float perlinWorley=clamp((n.r+cellular*.45-.18)/.72,0.,1.);
 float profile=smoothstep(0.,.13,height)*(1.-smoothstep(.45,1.,height));
 float base=clamp((perlinWorley-(1.-cover))/max(cover,.001),0.,1.);
 base*=profile;
 if(base<.001)return 0.;
 vec4 detail=texture(uCloudNoise,coord*5.+vec3(.18,.31,.13));
 float erosion=dot(detail.gba,vec3(.625,.25,.125));
 float amount=mix(1.-erosion,erosion,smoothstep(.05,.4,height));
 float shape=clamp((base-amount*.23)/.77,0.,1.);
 vec2 along=normalize(vec2(-.38,-.92)),across=vec2(-along.y,along.x);
 vec2 openingDelta=p.xz-along*14000.;
 float opening=length(vec2(dot(openingDelta,across)/3100.,dot(openingDelta,along)/10000.));
 float clearing=smoothstep(.65,1.15,opening);
 float distantFade=(1.-smoothstep(26000.,cloudWorldRadius,radius))*smoothstep(700.,2500.,radius);
 return shape*clearing*distantFade;
}
float cloudSunTransmission(vec3 point,vec3 sun){
 float depth=density(point+sun*95.)*135.+density(point+sun*275.)*250.+density(point+sun*620.)*380.;
 return exp(-depth*cloudExtinction);
}
`;
