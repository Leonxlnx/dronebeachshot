import {createDistantBathymetry,bathymetryGLSL} from './bathymetry';
import {aerialPerspectiveGLSL,aerialDensity} from '../render/aerial-perspective';
import * as THREE from 'three';
import {WIND} from './weather';
import {waterSlopeFilterGLSL} from './water-slope-filter';
import {waterReflectionGLSL} from './water-reflection';
import {createDistantWaterGeometry} from './ocean-geometry';
import {createOceanTiles} from './ocean-tiles';
import {noiseGLSL,shorelineGLSL,shoreDistance,terrainHeight} from './math';
import {coastalGLSL} from './coastal';
import {createTerrainHeightTexture,terrainSurfaceGLSL} from './terrain-surface';
import {worldTime,debugMode} from '../render/materials';
import {diagnosticOutputShader} from '../render/diagnostics';
import {refractionUniforms,refractionGLSL} from '../render/refraction';
import {coastalReflectionUniforms,coastalReflectionSeaLevel} from '../render/coastal-reflection';
import {coastalReflectionFilterGLSL} from '../render/coastal-reflection-filter';
import {sunDirection} from './atmosphere';
import {reflectedSky,cloudShadow,cloudShadowBounds,solarDirection,cloudLightingGLSL,skyDecodeScale,solarColor,solarIntensity} from '../render/sky-lighting';
import {coastalFieldGLSL,type CoastalField} from './coastal-field';
export const foamDepthGate={value:1};
const coastalReflectionGLSL=`
uniform sampler2D uCoastalReflectionColor,uCoastalReflectionDepth;
uniform vec2 uCoastalReflectionResolution;
uniform mat4 uCoastalReflectionInverseViewProjection,uCoastalReflectionTextureMatrix;
uniform float uCoastalReflectionReady,uCoastalReflectionDistortion,uCoastalReflectionSeaLevel;
${coastalReflectionFilterGLSL}
float coastalSignedDenominator(float w){return (w<0.?-1.:1.)*max(abs(w),.00001);}
vec4 coastalReflectionSample(vec3 surface,vec3 ray,float slopeVariance){
 vec3 planePoint=vec3(surface.x,uCoastalReflectionSeaLevel,surface.z);
 vec3 mirrorEye=vec3(cameraPosition.x,2.*uCoastalReflectionSeaLevel-cameraPosition.y,cameraPosition.z);
 vec3 flatRay=normalize(planePoint-mirrorEye);
 // The flat control is genuinely mean-plane based. In wave mode, filter the
 // horizon over the actual pixel/angular footprint, never an arbitrary angle.
 vec3 footprintRay=normalize(mix(flatRay,ray,uCoastalReflectionDistortion));
 vec3 rayDx=dFdx(footprintRay),rayDy=dFdy(footprintRay);
 // Flat mode retains a mean-plane horizon; unresolved wave angles belong to
 // the wave study. Its existing roughness/texture filtering remains below.
 vec4 positive=coastalPositiveRay(footprintRay,rayDx,rayDy,slopeVariance*uCoastalReflectionDistortion);
 vec4 flatProjection=uCoastalReflectionTextureMatrix*vec4(planePoint,1.);
 vec2 flatUv=flatProjection.xy/coastalSignedDenominator(flatProjection.w);
 vec2 texel=1./uCoastalReflectionResolution;
 vec2 flatDx=dFdx(flatUv),flatDy=dFdy(flatUv);
 vec2 depthUv=clamp(flatUv,texel*.5,vec2(1.)-texel*.5);
 float coastDepth=texture2D(uCoastalReflectionDepth,depthUv).r;
 vec4 coastH=uCoastalReflectionInverseViewProjection*vec4(depthUv*2.-1.,coastDepth*2.-1.,1.);
 vec3 coast=coastH.xyz/coastalSignedDenominator(coastH.w);
 float coastRange=length(coast-planePoint);
 bool coastHit=coastDepth<.999999;
 // One depth-guided reprojection approximates a wave reflection using real
 // captured geometry. At an empty sky texel only direction matters. No main
 // color-buffer image, target-alpha mask or reconstructed coverage is used.
 vec4 distorted=coastHit
  ?uCoastalReflectionTextureMatrix*vec4(planePoint+positive.xyz*coastRange,1.)
  :uCoastalReflectionTextureMatrix*vec4(positive.xyz,0.);
 vec4 projected=mix(flatProjection,distorted,uCoastalReflectionDistortion);
 float denominator=coastalSignedDenominator(projected.w);
 vec2 uv=projected.xy/denominator;
 // Recombine before derivatives: depth and validity can vary within a quad.
 vec2 uvDx=dFdx(uv),uvDy=dFdy(uv);
 // Small normal-angle variance becomes about four times that reflection-ray
 // variance. Project the angular cone through the same capture Jacobian.
 // Sky uses a direction (unit range); finite coast uses its measured range.
 float rayScale=coastHit?coastRange:1.;
 vec4 flatReference=coastHit?uCoastalReflectionTextureMatrix*vec4(coast,1.)
  :uCoastalReflectionTextureMatrix*vec4(flatRay,0.);
 // The flat control has the same UV at the water plane and coast, but a
 // different projective distance. Its cone must use the coast distance too.
 float coneDenominator=coastalSignedDenominator(mix(flatReference.w,distorted.w,uCoastalReflectionDistortion));
 vec2 jx=(uCoastalReflectionTextureMatrix[0].xy-uv*uCoastalReflectionTextureMatrix[0].w)/coneDenominator;
 vec2 jy=(uCoastalReflectionTextureMatrix[1].xy-uv*uCoastalReflectionTextureMatrix[1].w)/coneDenominator;
 vec2 jz=(uCoastalReflectionTextureMatrix[2].xy-uv*uCoastalReflectionTextureMatrix[2].w)/coneDenominator;
 // One shared angular approximation drives color LOD and capture coverage.
 vec3 ju=vec3(jx.x,jy.x,jz.x),jv=vec3(jx.y,jy.y,jz.y);
 vec3 coneRay=normalize(mix(flatRay,positive.xyz,uCoastalReflectionDistortion));
 vec2 projectedDot=vec2(dot(ju,coneRay),dot(jv,coneRay));
 // Explicit products keep signed Jacobian projections valid on every GLSL backend.
 vec2 angularVariance=2.*max(slopeVariance,0.)*rayScale*rayScale*max(vec2(0.),
  vec2(dot(ju,ju),dot(jv,jv))-projectedDot*projectedDot);
 vec2 pixelVariance=(uvDx*uvDx+uvDy*uvDy)/12.;
 float crossVariance=(uvDx.x*uvDx.y+uvDy.x*uvDy.y)/12.
  +2.*max(slopeVariance,0.)*rayScale*rayScale*(dot(ju,jv)-projectedDot.x*projectedDot.y);
 float footprint=coastalFootprintWidth(pixelVariance+angularVariance,crossVariance,uCoastalReflectionResolution);
 float maximumLod=floor(log2(max(uCoastalReflectionResolution.x,uCoastalReflectionResolution.y)));
 float lod=clamp(log2(max(footprint,1.)),0.,maximumLod);
 // Project the same isotropic angular approximation for capture coverage.
 // A separable, moment-matched box and its clipped centroid approximate the
 // joint footprint; neither the joint distribution nor a ray trace is exact.
 // A box-prefiltered mip texel contributes 1/12 variance; bilinear centers
 // contribute at most 1/4. Blend these phase-independent moment bounds between
 // the actual (possibly NPOT) mip sizes. This is not a strict support bound.
 float lowerLod=floor(lod),upperLod=min(lowerLod+1.,maximumLod);
 vec2 lowerSize=max(vec2(1.),floor(uCoastalReflectionResolution/exp2(lowerLod)));
 vec2 upperSize=max(vec2(1.),floor(uCoastalReflectionResolution/exp2(upperLod)));
 vec2 textureVariance=mix(1./(3.*lowerSize*lowerSize),1./(3.*upperSize*upperSize),fract(lod));
 vec2 halfWidth=sqrt(3.*(pixelVariance+angularVariance+textureVariance));
 vec2 captureU=coastalCaptureBox(uv.x,halfWidth.x),captureV=coastalCaptureBox(uv.y,halfWidth.y);
 vec2 sampleUv=clamp(vec2(captureU.y,captureV.y),texel*.5,vec2(1.)-texel*.5);
 vec3 captured=textureLod(uCoastalReflectionColor,sampleUv,lod).rgb;
 // The wave proxy needs a real source depth footprint as well as a valid
 // destination. Flat mode already accounts for this same footprint once.
 vec2 sourceHalf=sqrt((flatDx*flatDx+flatDy*flatDy)*.25+texel*texel*.25);
 float sourceCoverage=coastalCaptureBox(flatUv.x,sourceHalf.x).x
  *coastalCaptureBox(flatUv.y,sourceHalf.y).x;
 float destinationCoverage=captureU.x*captureV.x;
 // Treat the source depth as limiting availability, not an independent mask:
 // coincident source/destination edges must not accidentally square coverage.
 // This remains an approximation to their correlated joint footprint.
 float captureCoverage=mix(destinationCoverage,min(sourceCoverage,destinationCoverage),uCoastalReflectionDistortion);
 float coverage=positive.w*captureCoverage;
 if(flatProjection.w<=.00001||projected.w<=.00001)coverage=0.;
 return vec4(captured,coverage);
}
// Kept for the isolated production-function fixture. Main computes this sample
// before varying discards, then combines it with the unchanged water fallback.
vec3 coastalReflectedRadiance(vec3 surface,vec3 ray,vec3 fallback,float slopeVariance){
 vec4 sampleValue=coastalReflectionSample(surface,ray,slopeVariance);
 return mix(fallback,sampleValue.rgb,sampleValue.a);
}
`;
const waterFns=`${noiseGLSL}${shorelineGLSL}${coastalGLSL}${coastalFieldGLSL}${terrainSurfaceGLSL}
float coastalDistance(vec2 p){float original=shoreDist(p);float bound=1.-smoothstep(575.,600.,abs(p.x));return mix(min(original,-120.),original,bound);}
// Coherent wave groups control both shoaling geometry and its breaking foam.
 float breakingGroup(vec2 p,float distanceToShore,float time){
  float groupTravel=distanceToShore-3.2*time;
  return clamp(.50+.24*sin(p.x*.035+groupTravel*.071)
    +.17*sin(p.x*.082-groupTravel*.043+1.8)
    +.09*sin(p.x*.017+groupTravel*.119+4.2),0.,1.);
 }
float swell(vec2 p,float t){
 float d=coastalDistance(p),shelter=mix(.45,1.,smoothstep(20.,150.,-d)),h=0.;
 for(int i=0;i<7;i++){float fi=float(i),a=fi*2.399963;vec2 dir=normalize(vec2(sin(a)*.45,1.+cos(a)*.18));float k=.045*pow(1.68,fi),amp=.36*pow(.60,fi);h+=amp*sin(dot(p,dir)*k-t*sqrt(9.81*k)+fi*1.7);}
 float fade=smoothstep(-4.,35.,-d),phase=coastPhase(p,t);
 // Energy controls amplitude, with residual swell in the quiet packets.
 float packetEnergy=smoothstep(.30,.68,breakingGroup(p,d,t));
 float packetAmplitude=sqrt(.18+.82*packetEnergy);
 float shallow=pow(.5+.5*sin(phase),3.)*.52*packetAmplitude*smoothstep(1.,8.,-d)*(1.-smoothstep(30.,60.,-d));
 float rockDamping=mix(1.,.30,coastalFieldSample(p).a);
 return (h*shelter*fade+shallow)*rockDamping*(1.-smoothstep(640.,840.,length(p-vec2(0.,-350.))));
}
float waterHeight(vec2 p,float t){
 float h=swell(p,t),actualDistance=shoreDist(p);
 // The outer-domain wave fade is not a real shoreline. Its remapped distance
 // must never pull the sea up onto the elevated inland terrain at x=575–600 m.
 if(abs(p.x)<600.&&actualDistance> -3.&&actualDistance<12.){
  float contact=smoothstep(-3.,0.,actualDistance)*(1.-smoothstep(6.,12.,actualDistance));
  h=mix(h,renderedTerrainHeight(p)+.028,contact);
 }
 return h;
}
${waterSlopeFilterGLSL}
// The displaced mesh, contact film and their full FD gradient remain unchanged.
// These envelopes reproduce the existing phase amplitudes at the same stencil.
vec2 swellSlopeAmplitude(vec2 p,float t){
 float d=coastalDistance(p),actualDistance=shoreDist(p),contact=0.;
 if(abs(p.x)<600.&&actualDistance> -3.&&actualDistance<12.)
  contact=smoothstep(-3.,0.,actualDistance)*(1.-smoothstep(6.,12.,actualDistance));
 float attenuation=mix(1.,.30,coastalFieldSample(p).a)*(1.-contact)
  *(1.-smoothstep(640.,840.,length(p-vec2(0.,-350.))));
 float deep=mix(.45,1.,smoothstep(20.,150.,-d))*smoothstep(-4.,35.,-d);
 float shallow=.52*sqrt(.18+.82*smoothstep(.30,.68,breakingGroup(p,d,t)))
  *smoothstep(1.,8.,-d)*(1.-smoothstep(30.,60.,-d));
 return vec2(deep,shallow)*attenuation;
}
vec2 filteredSwellCorrection(vec2 p,float t,vec2 pixelDx,vec2 pixelDy,inout float variance){
 vec2 px=p+vec2(.2,0.),mx=p-vec2(.2,0.),pz=p+vec2(0.,.2),mz=p-vec2(0.,.2);
 vec4 phase=vec4(coastPhase(px,t),coastPhase(mx,t),coastPhase(pz,t),coastPhase(mz,t));
 vec2 waveVector=vec2(phase.x-phase.y,phase.z-phase.w)/.4;
 // Cauchy bounds every deep-wave direction. Avoid amplitude/texture work
 // when all seven swells and all three coastal harmonics are fully resolved.
 if(max(length(pixelDx),length(pixelDy))*.045*pow(1.68,6.)<=1.
  &&waterBandVisibility(waveVector*3.,pixelDx,pixelDy)==1.)return vec2(0.);
 vec2 ax=swellSlopeAmplitude(px,t),bx=swellSlopeAmplitude(mx,t);
 vec2 az=swellSlopeAmplitude(pz,t),bz=swellSlopeAmplitude(mz,t);
 vec4 deep=vec4(ax.x,bx.x,az.x,bz.x),shallow=vec4(ax.y,bx.y,az.y,bz.y);
 vec2 correction=vec2(0.);
 for(int i=0;i<7;i++){
  float fi=float(i),a=fi*2.399963;
  vec2 dir=normalize(vec2(sin(a)*.45,1.+cos(a)*.18));
  float k=.045*pow(1.68,fi),amp=.36*pow(.60,fi);
  vec4 swellPhase=vec4(dot(px,dir),dot(mx,dir),dot(pz,dir),dot(mz,dir))*k-t*sqrt(9.81*k)+fi*1.7;
  correction+=filteredPhaseCorrection(swellPhase,deep*amp,waterBandVisibility(dir*k,pixelDx,pixelDy),false,variance);
 }
 // Exact harmonics of (.5+.5*sin(phase))^3; the 5/16 DC term stays intact.
 correction+=filteredPhaseCorrection(phase,shallow*(15./32.),waterBandVisibility(waveVector,pixelDx,pixelDy),false,variance);
 correction+=filteredPhaseCorrection(phase*2.,shallow*(-3./16.),waterBandVisibility(waveVector*2.,pixelDx,pixelDy),true,variance);
 correction+=filteredPhaseCorrection(phase*3.,shallow*(-1./32.),waterBandVisibility(waveVector*3.,pixelDx,pixelDy),false,variance);
 return correction;
}
// A band disappears before it crosses the pixel Nyquist limit. Derivatives
// are supplied by fragment main; this shared block also compiles in vertex.
float unresolvedWaterSlopeVariance=0.;
vec2 windRipple(vec2 p,float t,vec2 pixelDx,vec2 pixelDy,vec2 dir,
                float k,float slopeAmplitude,float phaseOffset){
 vec2 waveVector=dir*k;
 float phasePerPixel=max(abs(dot(waveVector,pixelDx)),abs(dot(waveVector,pixelDy)));
 float bandVisibility=1.-smoothstep(1.,3.,phasePerPixel);
 // A filtered wave still contributes surface roughness. Dropping its normal
 // without retaining this variance turns distant water into polished metal.
 unresolvedWaterSlopeVariance+=.5*slopeAmplitude*slopeAmplitude*(1.-bandVisibility*bandVisibility);
 float phase=dot(p,waveVector)-t*sqrt(9.81*k)+phaseOffset;
 return dir*(slopeAmplitude*bandVisibility*cos(phase));
}
vec3 waterNormal(vec2 p,float t,float dist,vec2 pixelDx,vec2 pixelDy){
 unresolvedWaterSlopeVariance=0.;
 float e=.2,dx=waterHeight(p+vec2(e,0.),t)-waterHeight(p-vec2(e,0.),t),dz=waterHeight(p+vec2(0.,e),t)-waterHeight(p-vec2(0.,e),t);
 vec2 slope=vec2(dx,dz)/(2.*e);
 float baseVariance=0.;
 slope+=filteredSwellCorrection(p,t,pixelDx,pixelDy,baseVariance);
 float distanceVisibility=1.-smoothstep(250.,1400.,dist);
 float shoreAmplitude=1.-smoothstep(-2.,4.,coastalDistance(p));
 float micro=distanceVisibility*shoreAmplitude;
 vec2 along=normalize(vec2(${WIND[0]},${WIND[1]})),across=vec2(-along.y,along.x);
 // Deterministic broad directional spectrum: many independent components
 // remain within each visible band after footprint filtering. Total unfiltered
 // slope RMS is preserved at0.138564; height/runup/foam geometry is unchanged.
 vec2 ripples=vec2(0.);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.02756127)+across*sin(0.02756127),0.67559677,0.03792800,1.20338495);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.31899184)+across*sin(-0.31899184),0.72254978,0.03727118,3.27971963);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.26732261)+across*sin(0.26732261),0.74776538,0.03694024,0.65978172);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.44703722)+across*sin(-0.44703722),0.81668070,0.03610315,6.24552185);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.07438122)+across*sin(0.07438122),0.86621660,0.03555460,3.32562575);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.46504733)+across*sin(0.46504733),0.92817111,0.03492170,0.45648223);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-1.15000000)+across*sin(-1.15000000),0.99077773,0.03433404,3.25978989);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(1.04868349)+across*sin(1.04868349),1.04592965,0.03385385,0.28246143);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.16378296)+across*sin(0.16378296),1.14047190,0.03310066,2.56751516);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.12713244)+across*sin(0.12713244),1.22789232,0.03247110,3.47372174);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.58101178)+across*sin(0.58101178),1.28188905,0.03210980,3.69696939);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.22499666)+across*sin(0.22499666),1.36528418,0.03158790,1.72157167);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.36658404)+across*sin(-0.36658404),1.46374913,0.03102111,4.07105544);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.37107319)+across*sin(0.37107319),1.54011450,0.03061364,1.94819831);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.43152178)+across*sin(0.43152178),1.68121590,0.02992379,5.12787812);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.03987464)+across*sin(-0.03987464),1.78780881,0.02944932,2.30110846);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.00468216)+across*sin(0.00468216),1.87346982,0.02909314,4.88876770);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.25186282)+across*sin(0.25186282),2.05035977,0.02841861,0.98042989);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.87237683)+across*sin(-0.87237683),2.13320373,0.02812745,4.20706179);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.17035413)+across*sin(-0.17035413),2.32575797,0.02750248,4.09147976);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.03024241)+across*sin(0.03024241),2.49837089,0.02699528,2.67483386);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.85343077)+across*sin(0.85343077),2.66730037,0.02653994,5.64115833);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.90865091)+across*sin(-0.90865091),2.85138360,0.02608340,3.15094691);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.48280804)+across*sin(-0.48280804),2.94380903,0.02586796,3.43367154);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.22952608)+across*sin(-0.22952608),3.16080343,0.02539401,5.50828512);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.80233752)+across*sin(0.80233752),3.42744984,0.02486487,0.26746054);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.76630838)+across*sin(-0.76630838),3.58489699,0.02457620,3.72516011);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.56581384)+across*sin(0.56581384),3.93780333,0.02398351,0.13800588);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.12441231)+across*sin(-0.12441231),4.17085510,0.02362763,1.06336558);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.54077507)+across*sin(-0.54077507),4.38243781,0.02332559,1.12283413);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.28067230)+across*sin(-0.28067230),4.64346417,0.02297734,0.73469477);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.57398913)+across*sin(-0.57398913),4.99488648,0.02254561,4.64678044);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.55669376)+across*sin(0.55669376),5.49186358,0.02199640,3.83604935);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.57686947)+across*sin(0.57686947),5.86873447,0.02162007,3.86463543);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.02491289)+across*sin(0.02491289),6.18550202,0.02132658,0.86393088);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.50681112)+across*sin(0.50681112),6.69540023,0.02089185,5.40076366);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.04359932)+across*sin(-0.04359932),6.98125686,0.02066598,4.40758164);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.26747338)+across*sin(0.26747338),7.31150940,0.02041911,5.60207009);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.38357158)+across*sin(-0.38357158),7.90390439,0.02000967,0.19663109);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.25307867)+across*sin(0.25307867),8.52097616,0.01962237,0.40402096);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.68849423)+across*sin(-0.68849423),9.24310915,0.01921171,2.70670607);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(1.02832032)+across*sin(1.02832032),9.74027251,0.01895179,4.88012124);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.76393150)+across*sin(-0.76393150),10.54980292,0.01856244,4.98980278);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.00554071)+across*sin(0.00554071),11.26182476,0.01824990,3.78892321);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.69559875)+across*sin(-0.69559875),11.75929572,0.01804594,5.99055197);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.08223346)+across*sin(-0.08223346),12.43482973,0.01778576,2.41556447);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.39224710)+across*sin(-0.39224710),13.34443804,0.01746227,4.59539973);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.03166400)+across*sin(-0.03166400),14.64958714,0.01704371,1.73611887);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.02580024)+across*sin(-0.02580024),15.61623425,0.01676289,2.62328515);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.94540874)+across*sin(0.94540874),16.00789402,0.01665528,4.62239673);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.09939251)+across*sin(0.09939251),17.16952068,0.01635466,2.77835804);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.21554376)+across*sin(-0.21554376),18.38505525,0.01606637,3.13793317);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.43054444)+across*sin(0.43054444),20.01706664,0.01571501,4.26414234);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.03368063)+across*sin(0.03368063),21.04956310,0.01551085,6.26573073);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.60451820)+across*sin(0.60451820),22.47867952,0.01524819,5.34901182);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.15579710)+across*sin(-0.15579710),24.25954937,0.01494890,2.33895087);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.04716960)+across*sin(0.04716960),25.21917580,0.01479887,1.52733453);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.33764909)+across*sin(0.33764909),27.48734953,0.01447119,4.16654767);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-0.57628848)+across*sin(-0.57628848),28.91931134,0.01428137,4.01373315);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.24068568)+across*sin(0.24068568),31.10415399,0.01401348,5.47753309);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(1.15000000)+across*sin(1.15000000),33.45052427,0.01375099,1.47193518);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.19634900)+across*sin(0.19634900),36.10375574,0.01348078,3.23108303);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.13567020)+across*sin(0.13567020),38.82962688,0.01322806,6.28171019);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(0.07673339)+across*sin(0.07673339),40.06179143,0.01312106,2.47744021);
 slope+=micro*ripples;
 // Sum of .5*A^2 over the fixed 64-wave spectrum is 0.0192. Distance LOD
 // transfers the remaining resolved variance too; shore damping is physical.
 unresolvedWaterSlopeVariance=baseVariance+shoreAmplitude*shoreAmplitude*(
  .0192*(1.-distanceVisibility*distanceVisibility)
  +unresolvedWaterSlopeVariance*distanceVisibility*distanceVisibility);
 return normalize(vec3(-slope.x,1.,-slope.y));
}
`;
function swashGeometry(){
 // Same grid vertices and triangle diagonals as the land. When a wave wets
 // positive-shore triangles, its surface stays exactly 28mm above that sand.
 const positions:number[]=[],indices:number[]=[],vertexMap=new Map<string,number>();
 function vertex(x:number,z:number){const key=x+','+z;if(vertexMap.has(key))return vertexMap.get(key)!;const i=positions.length/3;positions.push(x,terrainHeight(x,z),z);vertexMap.set(key,i);return i}
 // Cover the entire near-ocean domain: the outer crescent reaches beyond
 // the core terrain's southern edge, where the near mesh still yields to swash.
 for(let z=-1250;z<550;z+=2)for(let x=-576;x<576;x+=2){
  const ds=[shoreDistance(x,z),shoreDistance(x+2,z),shoreDistance(x,z+2),shoreDistance(x+2,z+2)];if(Math.max(...ds)<-62||Math.min(...ds)>10)continue;
  const a=vertex(x,z),b=vertex(x,z+2),c=vertex(x+2,z+2),d=vertex(x+2,z);indices.push(a,b,d,b,c,d);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
export function createOcean(field:CoastalField,terrain:THREE.Group){
 const bathymetry=createDistantBathymetry(terrain);
 const terrainHeights=createTerrainHeightTexture();
 const material=new THREE.ShaderMaterial({lights:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),...refractionUniforms,...coastalReflectionUniforms,uCoastalReflectionSeaLevel:coastalReflectionSeaLevel,uFoamDepthGate:foamDepthGate,uAerialDensity:aerialDensity,uSunColor:solarColor,uSunIntensity:solarIntensity,uDistantBathymetry:{value:bathymetry.texture},uBathymetryBounds:{value:bathymetry.bounds},uTerrainHeights:{value:terrainHeights},uTime:worldTime,uSurfaceMode:{value:0},uSun:{value:sunDirection},uDebug:debugMode,uReflectedSky:reflectedSky,uSkyDecodeScale:skyDecodeScale,uCloudShadow:cloudShadow,uCloudShadowBounds:cloudShadowBounds,uSolarDirection:solarDirection,uCoastalField:{value:field.texture},uCoastalBounds:{value:field.bounds}},vertexShader:`
#include <common>
#include <shadowmap_pars_vertex>
 uniform float uTime,uSurfaceMode;varying vec3 vWorld;${waterFns}
 void main(){vec3 p=position;p.y=uSurfaceMode>.5&&uSurfaceMode<1.5?0.:waterHeight(p.xz,uTime);vWorld=p;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
 #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
 #pragma unroll_loop_start
 for(int i=0;i<NUM_DIR_LIGHT_SHADOWS;i++){
  vDirectionalShadowCoord[i]=directionalShadowMatrix[i]*vec4(p+vec3(0.,directionalLightShadows[i].shadowNormalBias,0.),1.);
 }
 #pragma unroll_loop_end
 #endif
 }`,fragmentShader:`
 precision highp float;
#include <common>
#include <packing>
#include <shadowmap_pars_fragment>
uniform bool receiveShadow;
#include <shadowmask_pars_fragment>
${aerialPerspectiveGLSL}${bathymetryGLSL}${waterReflectionGLSL}${coastalReflectionGLSL}
uniform float uTime,uDebug,uSurfaceMode,uSkyDecodeScale,uSunIntensity,uAerialDensity,uFoamDepthGate;uniform vec3 uSun,uSunColor;uniform samplerCube uReflectedSky;varying vec3 vWorld;${waterFns}${cloudLightingGLSL}${refractionGLSL}
 // Average unresolved foam octaves instead of turning distant bubbles into
 // unstable white pixels. The phase/advection field remains world anchored.
 float filteredFoamNoise(vec2 point,float footprint){
  float sum=0.,weight=.5;
  for(int octave=0;octave<4;octave++){
   float visible=1.-smoothstep(.35,1.25,footprint);
   sum+=weight*mix(.5,noise(point),visible);
   point=mat2(1.83,-.41,.41,1.83)*point;footprint*=1.875;weight*=.52;
  }
  return sum;
 }
 void main(){
 vec2 p=vWorld.xz;
 // Evaluate before any nonuniform discard; values are world meters per pixel.
 vec2 waterPixelDx=dFdx(p),waterPixelDy=dFdy(p);
 float d=coastalDistance(p),t=uTime;
 // The study is a uniform branch. All of its ray/UV derivatives must execute
 // before varying shoreline/domain discards. Cache the normal to evaluate the
 // spectrum only once; the disabled study retains the original normal path.
 vec3 coastalNormal=vec3(0.,1.,0.);vec4 coastalSample=vec4(0.);
 if(uCoastalReflectionReady>.5){
  vec3 coastalView=normalize(cameraPosition-vWorld);
  coastalNormal=waterNormal(p,t,length(cameraPosition-vWorld),waterPixelDx,waterPixelDy);
  coastalSample=coastalReflectionSample(vWorld,reflect(-coastalView,coastalNormal),unresolvedWaterSlopeVariance);
 }
 if(uSurfaceMode<.5&&abs(p.x)<575.&&d>=-60.)discard;
 if(uSurfaceMode>1.5&&(abs(p.x)>=575.||d< -60.))discard;
 float reach=runup(p.x,t);
 // Small connected fingers break the advancing front without teleporting foam.
 // The CPU wetness history includes a one-metre fringe, covering this 0.24 m offset.
 float fringe=(noise(vec2(p.x*.83,t*.07))-.5)*.32
             +(noise(vec2(p.x*2.1,t*.11))-.5)*.16;
 float filmReach=reach+fringe;if(d>filmReach)discard;
 vec4 coast=coastalFieldSample(p);if(coast.g<-.25&&coast.b>vWorld.y+.06)discard;
 vec3 V=normalize(cameraPosition-vWorld);float distanceToEye=length(cameraPosition-vWorld);vec3 N;
 if(uCoastalReflectionReady>.5)N=coastalNormal;
 else N=waterNormal(p,t,distanceToEye,waterPixelDx,waterPixelDy);
 float fresnel=.025+.975*pow(1.-max(dot(V,N),0.),5.);
 // Cubemap mip footprint approximates the unresolved reflected-normal cone.
 // Keep ordinary gradient-selected mip filtering when it is already broader.
 vec3 reflected=reflect(-V,N);
 // Below-horizon probe rays meet the adjacent water surface. A secondary
 // reflection supplies sky radiance; its transmitted share uses local water.
 // Above-horizon rays are unchanged, including their Fresnel/roughness response.
 vec4 bounce=neighbouringWaterReflection(reflected);reflected=bounce.xyz;
 float reflectionPixels=max(length(dFdx(reflected)),length(dFdy(reflected)))*128.;
 float reflectionLod=.5*log2(max(1.,reflectionPixels*reflectionPixels+unresolvedWaterSlopeVariance*128.*128.*.35));
 vec3 reflection=textureLod(uReflectedSky,reflected,clamp(reflectionLod,0.,7.)).rgb*uSkyDecodeScale;
 // The detailed coast field ends at a rectangle; water depth must not jump
 // from its measured seabed to an unrelated constant along that rectangle.
 vec2 edgeDistance=min(p-uCoastalBounds.xy,uCoastalBounds.zw-p);
 float detailWeight=smoothstep(0.,90.,min(edgeDistance.x,edgeDistance.y));
 float depth=max(-mix(distantSeabedHeight(p),coast.r,detailWeight),0.);
 vec3 water=vec3(.01,.084,.12);
 reflection=mix(water,reflection,bounce.w);
 if(uCoastalReflectionReady>.5)reflection=mix(reflection,coastalSample.rgb,coastalSample.a);
 vec3 transmitted=transmittedCoast(vWorld,N,water,depth);vec3 col=mix(transmitted,reflection,fresnel);vec3 H=normalize(V+uSun);
 // Broaden the existing solar lobes by the same unresolved variance, conserving
 // their integrated energy instead of inventing extra light at lower detail.
 float sharpPower=max(1.,2./(2./522.+unresolvedWaterSlopeVariance)-2.);
 float broadPower=max(1.,2./(2./67.+unresolvedWaterSlopeVariance)-2.);
 float glint=pow(max(dot(N,H),0.),sharpPower)*.76*(sharpPower+2.)/522.
  +pow(max(dot(N,H),0.),broadPower)*.085*(broadPower+2.)/67.;
 float sunlight=atmosphericSunlight(vWorld)*getShadowMask(),sunPath=glint*max(dot(N,uSun),.08)*sunlight;col+=uSunColor*(uSunIntensity/4.4)*13.*sunPath;
 float travel=coastPhase(p,t),breakBand=pow(.5+.5*sin(travel),14.),breakerActivity=smoothstep(3.,9.,-d)*(1.-smoothstep(24.,42.,-d));
 float group=breakingGroup(p,d,t);
 float waveEnergy=smoothstep(.30,.68,group)*mix(1.,.20,coast.a);
 // Local shoaling and genuine rock shelter gate where a coherent crest breaks.
 float breakingRatio=(.65+.80*waveEnergy)/max(depth,.25);
 float depthBreaking=smoothstep(.28,.64,breakingRatio);
 float crest=breakBand*breakerActivity*waveEnergy*mix(.35+.65*depthBreaking,depthBreaking,uFoamDepthGate);
 // Positive phase lag leaves residue seaward, behind the incoming crest.
 float previousEnergy=smoothstep(.30,.68,breakingGroup(p,d,t-1.1/1.5))*mix(1.,.20,coast.a);
 float previousBreaking=smoothstep(.28,.64,(.65+.80*previousEnergy)/max(depth,.25));
 float residue=pow(.5+.5*sin(travel+1.1),3.)*breakerActivity*.24*previousEnergy*mix(1.,previousBreaking,uFoamDepthGate);
 float swashEdge=1.-smoothstep(.0,.75,abs(d-filmReach+.28));
 float washArea=smoothstep(-6.,-.5,d)*(1.-smoothstep(reach-2.,reach,d));
 float rockEdge=(1.-smoothstep(.3,3.8,max(coast.g,0.)))*step(-.5,coast.g);
 float foam=0.;
 if(crest>0.||residue>0.||swashEdge>0.||washArea>0.||rockEdge>0.){
 // Swash displacement advects the foam in the coast-normal direction. The
 // derivative changes sign during retreat, so the same field flows back out.
 vec2 flow=(p-coastNormal(p.x)*reach)*1.6;flow+=vec2(sin(p.y*.3),sin(p.x*.24))*.23;
 float foamFootprint=max(length(waterPixelDx),length(waterPixelDy))*1.6;
 float cells=filteredFoamNoise(flow,foamFootprint)
  +mix(.5,noise(flow*3.875),1.-smoothstep(.35,1.25,foamFootprint*3.875))*.17;
 float lace=smoothstep(.43,.65,cells);
 // Metre-scale rafts stay resolved in aerial views after subpixel bubbles average
 // away. They share the original swash flow, so foam connects and drains with it.
 float raftNoise=filteredFoamNoise(flow*.0625,foamFootprint*.0625);
 float rafts=smoothstep(.34,.57,raftNoise);
 foam=crest*(.18+.82*rafts)*(.30+.70*lace)
  +residue*rafts*(.45+.55*lace);
 float swashEnergy=smoothstep(.24,.66,breakingGroup(p,0.,t-.7))*mix(1.,.35,coast.a);
 foam+=swashEdge*(.015+.56*lace)*rafts*(.20+.80*swashEnergy)
  +washArea*lace*rafts*.20*(.30+.70*swashEnergy);
 // Rock foam is attached to the rasterized waterline of actual scene geometry.
 vec2 obstacleGradient=vec2(coastalFieldSample(p+vec2(1.,0.)).g-coastalFieldSample(p-vec2(1.,0.)).g,coastalFieldSample(p+vec2(0.,1.)).g-coastalFieldSample(p-vec2(0.,1.)).g);
 float facing=max(dot(obstacleGradient/max(length(obstacleGradient),.001),-coastNormal(p.x)),0.);
 float impact=pow(.5+.5*sin(travel),5.)*facing*(.25+.75*waveEnergy);
 foam+=rockEdge*(.28+impact*.9)*(.5+lace*.5);foam=clamp(foam,0.,.98);
 }
 vec3 foamColor=vec3(.68,.72,.665)*(vec3(.58)+uSunColor*(uSunIntensity/4.4)*max(dot(uSun,N),0.)*.77*sunlight);col=mix(col,foamColor,foam);
 // A thinning swash front mixes coverage with the real opaque coast beneath it.
 // At zero thickness this tends exactly to the underlying ground color, removing
 // the former opaque, ruler-like reflection edge. No transparent sorting is used.
 float filmCoverage=smoothstep(0.,.55,filmReach-d);
 if(uUnderReady>.5){
  vec2 underUv=gl_FragCoord.xy/uUnderResolution;
  vec3 underColor=texture2D(uUnderColor,underUv).rgb*uUnderDecodeScale;
  col=mix(underColor,col,filmCoverage);
 }
 col=bayAerialPerspective(col,cameraPosition,vWorld,uSun,uAerialDensity);
 if(uDebug==1.)col=water;if(uDebug==2.)col=N*.5+.5;if(uDebug==3.)col=vec3(.12);if(uDebug==4.)col=vec3(clamp(distanceToEye/800.,0.,1.));
 if(uDebug==5.)col=uSunColor*(uSunIntensity/4.4)*13.*sunPath;if(uDebug==6.)col=mix(water,reflection,fresnel*.85);if(uDebug==7.)col=vec3(sunlight);if(uDebug==8.)col=vec3(.3);
 if(uDebug==9.)col=vec3(clamp(depth/20.,0.,1.));if(uDebug==10.)col=vec3(foam);
 if(uDebug==12.)col=vec3(0.);
 if(uDebug==11.){float lum=dot(col,vec3(.2126,.7152,.0722));col=lum<.015?vec3(.1,.2,1.):lum>3.?vec3(1.,.1,.05):vec3(lum*.25);}
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 material.fragmentShader=diagnosticOutputShader(material.fragmentShader);
 const root=new THREE.Group();root.name='ocean-and-swash';
 const tiles:THREE.Mesh[]=[];
 for(const geometry of createOceanTiles()){
  const [x,z]=geometry.userData.oceanTile;const tile=new THREE.Mesh(geometry,material);tile.name=`ocean-tile-${x}-${z}`;tile.receiveShadow=true;tiles.push(tile);root.add(tile);
 }
 function setTiledCulling(enabled:boolean){for(const tile of tiles)tile.frustumCulled=enabled;}
 function surfaceMaterial(mode:number){
  // These surfaces share the same world uniforms, including live render targets.
  // ShaderMaterial.clone() drops render-target textures and duplicates atlas
  // Sources. Keep bindings shared; only the surface mode belongs to the mesh.
  return new THREE.ShaderMaterial({lights:true,vertexShader:material.vertexShader,fragmentShader:material.fragmentShader,
   polygonOffset:material.polygonOffset,polygonOffsetFactor:material.polygonOffsetFactor,polygonOffsetUnits:material.polygonOffsetUnits,
   uniforms:{...material.uniforms,uSurfaceMode:{value:mode}}});
 }
 const swash=new THREE.Mesh(swashGeometry(),surfaceMaterial(2));swash.name='sand-following-swash';swash.receiveShadow=true;root.add(swash);
 const distant=new THREE.Mesh(createDistantWaterGeometry(),surfaceMaterial(1));distant.renderOrder=-1;distant.receiveShadow=true;root.add(distant);
 return {group:root,material,setTiledCulling};
}
