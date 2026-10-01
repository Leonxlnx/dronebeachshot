import {habitatGLSL} from './habitat';
// Shared prevailing wind in world X/Z; features drift with, not against, this vector.
export const WIND=[1.6,.4] as const;
export const weatherGLSL=`${habitatGLSL}

const vec2 worldWind=vec2(${WIND[0]},${WIND[1]});
vec3 localWindOffset(vec3 worldOffset,mat4 worldTransform){
 vec3 x=worldTransform[0].xyz,y=worldTransform[1].xyz,z=worldTransform[2].xyz;
 return vec3(dot(worldOffset,x)/max(dot(x,x),.00001),dot(worldOffset,y)/max(dot(y,y),.00001),dot(worldOffset,z)/max(dot(z,z),.00001));
}
float regionalWindGust(vec2 root,float t){vec2 along=normalize(worldWind),across=vec2(-along.y,along.x),advected=root-worldWind*t;return .5+.5*sin(dot(advected,along)*.20+.35*sin(dot(advected,across)*.11));}
vec2 windDisplacement(vec3 root,float t){
 vec2 along=normalize(worldWind),crossWind=vec2(-along.y,along.x);
 float phase=dot(root.xz,along)*.033;
 float gust=regionalWindGust(root.xz,t);
 float exposure=mix(.35,1.6,habitatAt(root.xz).r);return (along*(.11+sin(t*.87+phase)*.09+gust*.19)+crossWind*sin(t*.69+phase*1.41)*.06)*exposure;
}
`;
