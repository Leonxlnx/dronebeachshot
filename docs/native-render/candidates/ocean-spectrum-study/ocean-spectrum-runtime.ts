import * as THREE from '/workspace/sites/last-light-bay/node_modules/three/build/three.module.js';
import {WIND} from '/workspace/sites/last-light-bay/src/world/weather.ts';
import {noiseGLSL,shorelineGLSL,shoreDistance,terrainHeight} from '/workspace/sites/last-light-bay/src/world/math.ts';
import {coastalGLSL} from '/workspace/sites/last-light-bay/src/world/coastal.ts';
import {createTerrainHeightTexture,terrainSurfaceGLSL} from '/workspace/sites/last-light-bay/src/world/terrain-surface.ts';
import {worldTime,debugMode} from '/workspace/sites/last-light-bay/src/render/materials.ts';
import {diagnosticOutputShader} from '/workspace/sites/last-light-bay/src/render/diagnostics.ts';
import {refractionUniforms,refractionGLSL} from '/workspace/sites/last-light-bay/src/render/refraction.ts';
import {sunDirection} from '/workspace/sites/last-light-bay/src/world/atmosphere.ts';
import {reflectedSky,cloudShadow,cloudShadowBounds,solarDirection,cloudLightingGLSL,skyDecodeScale} from '/workspace/sites/last-light-bay/src/render/sky-lighting.ts';
import {coastalFieldGLSL,type CoastalField} from '/workspace/sites/last-light-bay/src/world/coastal-field.ts';
const waterFns=`${noiseGLSL}${shorelineGLSL}${coastalGLSL}${coastalFieldGLSL}${terrainSurfaceGLSL}
float coastalDistance(vec2 p){float original=shoreDist(p);float bound=1.-smoothstep(575.,600.,abs(p.x));return mix(min(original,-120.),original,bound);}
float swell(vec2 p,float t){
 float d=coastalDistance(p),shelter=mix(.45,1.,smoothstep(20.,150.,-d)),h=0.;
 for(int i=0;i<7;i++){float fi=float(i),a=fi*2.399963;vec2 dir=normalize(vec2(sin(a)*.45,1.+cos(a)*.18));float k=.045*pow(1.68,fi),amp=.36*pow(.60,fi);h+=amp*sin(dot(p,dir)*k-t*sqrt(9.81*k)+fi*1.7);}
 float fade=smoothstep(-4.,35.,-d),phase=coastPhase(p,t);
 float shallow=pow(.5+.5*sin(phase),3.)*.52*smoothstep(1.,8.,-d)*(1.-smoothstep(30.,60.,-d));
 float rockDamping=mix(1.,.30,coastalFieldSample(p).a);
 return (h*shelter*fade+shallow)*rockDamping*(1.-smoothstep(640.,840.,length(p-vec2(0.,-350.))));
}
float waterHeight(vec2 p,float t){float d=coastalDistance(p);float h=swell(p,t);if(d> -3.){float sand=renderedTerrainHeight(p);h=mix(h,sand+.028,smoothstep(-3.,0.,d));}return h;}
// A band disappears before it crosses the pixel Nyquist limit. Derivatives
// are supplied by fragment main; this shared block also compiles in vertex.
vec2 windRipple(vec2 p,float t,vec2 pixelDx,vec2 pixelDy,vec2 dir,
                float k,float slopeAmplitude,float phaseOffset){
 vec2 waveVector=dir*k;
 float phasePerPixel=max(abs(dot(waveVector,pixelDx)),abs(dot(waveVector,pixelDy)));
 float bandVisibility=1.-smoothstep(1.,3.,phasePerPixel);
 float phase=dot(p,waveVector)-t*sqrt(9.81*k)+phaseOffset;
 return dir*(slopeAmplitude*bandVisibility*cos(phase));
}
vec3 waterNormal(vec2 p,float t,float dist,vec2 pixelDx,vec2 pixelDy){
 float e=.2,dx=waterHeight(p+vec2(e,0.),t)-waterHeight(p-vec2(e,0.),t),dz=waterHeight(p+vec2(0.,e),t)-waterHeight(p-vec2(0.,e),t);
 vec2 slope=vec2(dx,dz)/(2.*e);
 float micro=(1.-smoothstep(250.,1400.,dist))*(1.-smoothstep(-2.,4.,coastalDistance(p)));
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
 return normalize(vec3(-slope.x,1.,-slope.y));
}
`;
function swashGeometry(){
 // Same grid vertices and triangle diagonals as the land. When a wave wets
 // positive-shore triangles, its surface stays exactly 28mm above that sand.
 const positions:number[]=[],indices:number[]=[],vertexMap=new Map<string,number>();
 function vertex(x:number,z:number){const key=x+','+z;if(vertexMap.has(key))return vertexMap.get(key)!;const i=positions.length/3;positions.push(x,terrainHeight(x,z),z);vertexMap.set(key,i);return i}
 for(let z=-798;z<550;z+=2)for(let x=-576;x<576;x+=2){
  const ds=[shoreDistance(x,z),shoreDistance(x+2,z),shoreDistance(x,z+2),shoreDistance(x+2,z+2)];if(Math.max(...ds)<-62||Math.min(...ds)>10)continue;
  const a=vertex(x,z),b=vertex(x,z+2),c=vertex(x+2,z+2),d=vertex(x+2,z);indices.push(a,b,d,b,c,d);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
export function createOcean(field:CoastalField){
 const terrainHeights=createTerrainHeightTexture();
 const material=new THREE.ShaderMaterial({polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,uniforms:{...refractionUniforms,uTerrainHeights:{value:terrainHeights},uTime:worldTime,uSurfaceMode:{value:0},uSun:{value:sunDirection},uDebug:debugMode,uReflectedSky:reflectedSky,uSkyDecodeScale:skyDecodeScale,uCloudShadow:cloudShadow,uCloudShadowBounds:cloudShadowBounds,uSolarDirection:solarDirection,uCoastalField:{value:field.texture},uCoastalBounds:{value:field.bounds}},vertexShader:`
 uniform float uTime;varying vec3 vWorld;${waterFns}
 void main(){vec3 p=position;p.y=waterHeight(p.xz,uTime);vWorld=p;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,fragmentShader:`
 precision highp float;uniform float uTime,uDebug,uSurfaceMode,uSkyDecodeScale;uniform vec3 uSun;uniform samplerCube uReflectedSky;varying vec3 vWorld;${waterFns}${cloudLightingGLSL}${refractionGLSL}
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
 // A slowly advecting interference envelope represents coherent wave groups.
 // It modulates breaking/foam energy only: coastPhase, runup, displaced water,
 // CPU wetness/spray, swash mesh and the thinning-film edge stay authoritative.
 float breakingGroup(vec2 p,float distanceToShore,float time){
  float groupTravel=distanceToShore-3.2*time;
  return clamp(.50+.24*sin(p.x*.035+groupTravel*.071)
    +.17*sin(p.x*.082-groupTravel*.043+1.8)
    +.09*sin(p.x*.017+groupTravel*.119+4.2),0.,1.);
 }
 void main(){
 vec2 p=vWorld.xz;
 // Evaluate before any nonuniform discard; values are world meters per pixel.
 vec2 waterPixelDx=dFdx(p),waterPixelDy=dFdy(p);
 float d=coastalDistance(p),t=uTime;
 if(uSurfaceMode>.5&&uSurfaceMode<1.5&&abs(p.x)<900.&&p.y>-1250.&&p.y<550.)discard;
 if(uSurfaceMode<.5&&abs(p.x)<575.&&d>=-60.)discard;
 if(uSurfaceMode>1.5&&(abs(p.x)>=575.||d< -60.))discard;
 float reach=runup(p.x,t);
 // Small connected fingers break the advancing front without teleporting foam.
 // The CPU wetness history includes a one-metre fringe, covering this 0.24 m offset.
 float fringe=(noise(vec2(p.x*.83,t*.07))-.5)*.32
             +(noise(vec2(p.x*2.1,t*.11))-.5)*.16;
 float filmReach=reach+fringe;if(d>filmReach)discard;
 vec4 coast=coastalFieldSample(p);if(coast.g<-.25&&coast.b>vWorld.y+.06)discard;
 vec3 V=normalize(cameraPosition-vWorld);float distanceToEye=length(cameraPosition-vWorld);vec3 N=waterNormal(p,t,distanceToEye,waterPixelDx,waterPixelDy);
 float fresnel=.025+.975*pow(1.-max(dot(V,N),0.),5.);vec3 reflection=textureCube(uReflectedSky,reflect(-V,N)).rgb*uSkyDecodeScale;
 float depth=max(-coast.r,0.);if(abs(p.x)>600.||p.y< -900.||p.y>650.)depth=max(-d*.095,0.);
 vec3 deep=vec3(.018,.075,.09),shallow=vec3(.08,.34,.28),water=mix(shallow,deep,1.-exp(-depth*.11));water*=.8+noise(p*.075)*.27+noise(p*.31)*.09;
 vec3 transmitted=transmittedCoast(vWorld,N,water,depth);vec3 col=mix(transmitted,reflection,fresnel);vec3 H=normalize(V+uSun);
 float glint=pow(max(dot(N,H),0.),520.)*.76+pow(max(dot(N,H),0.),65.)*.085;
 float sunlight=atmosphericSunlight(vWorld),sunPath=glint*max(dot(N,uSun),.08)*sunlight;col+=vec3(13.,8.,3.2)*sunPath;
 float travel=coastPhase(p,t),breakBand=pow(.5+.5*sin(travel),14.),breakerActivity=smoothstep(3.,9.,-d)*(1.-smoothstep(24.,42.,-d));
 float group=breakingGroup(p,d,t);
 float waveEnergy=smoothstep(.30,.68,group)*mix(1.,.20,coast.a);
 // Local shoaling and genuine rock shelter gate where a coherent crest breaks.
 float breakingRatio=(.65+.80*waveEnergy)/max(depth,.25);
 float depthBreaking=smoothstep(.28,.64,breakingRatio);
 float crest=breakBand*breakerActivity*waveEnergy*(.35+.65*depthBreaking);
 // Positive phase lag leaves residue seaward, behind the incoming crest.
 float previousEnergy=smoothstep(.30,.68,breakingGroup(p,d,t-1.1))*mix(1.,.20,coast.a);
 float residue=pow(.5+.5*sin(travel+1.1),3.)*breakerActivity*.24*previousEnergy;
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
 float foam=crest*(.18+.82*rafts)*(.30+.70*lace)
  +residue*rafts*(.45+.55*lace);
 float swashEdge=1.-smoothstep(.0,.75,abs(d-filmReach+.28));
 float washArea=smoothstep(-6.,-.5,d)*(1.-smoothstep(reach-2.,reach,d));
 float swashEnergy=smoothstep(.24,.66,breakingGroup(p,0.,t-.7))*mix(1.,.35,coast.a);
 foam+=swashEdge*(.015+.56*lace)*rafts*(.20+.80*swashEnergy)
  +washArea*lace*rafts*.20*(.30+.70*swashEnergy);
 // Rock foam is attached to the rasterized waterline of actual scene geometry.
 float rockEdge=(1.-smoothstep(.3,3.8,max(coast.g,0.)))*step(-.5,coast.g);
 vec2 obstacleGradient=vec2(coastalFieldSample(p+vec2(1.,0.)).g-coastalFieldSample(p-vec2(1.,0.)).g,coastalFieldSample(p+vec2(0.,1.)).g-coastalFieldSample(p-vec2(0.,1.)).g);
 float facing=max(dot(obstacleGradient/max(length(obstacleGradient),.001),-coastNormal(p.x)),0.);
 float impact=pow(.5+.5*sin(travel),5.)*facing*(.25+.75*waveEnergy);
 foam+=rockEdge*(.28+impact*.9)*(.5+lace*.5);foam=clamp(foam,0.,.98);
 vec3 foamColor=vec3(.68,.72,.665)*(1.+max(dot(uSun,N),0.)*.35*sunlight);col=mix(col,foamColor,foam);
 // A thinning swash front mixes coverage with the real opaque coast beneath it.
 // At zero thickness this tends exactly to the underlying ground color, removing
 // the former opaque, ruler-like reflection edge. No transparent sorting is used.
 float filmCoverage=smoothstep(0.,.55,filmReach-d);
 if(uUnderReady>.5&&d> -1.){
  vec2 underUv=gl_FragCoord.xy/uUnderResolution;
  vec3 underColor=texture2D(uUnderColor,underUv).rgb*uUnderDecodeScale;
  col=mix(underColor,col,filmCoverage);
 }
 col=mix(col,vec3(.59,.55,.46),1.-exp(-distanceToEye*.00016));
 if(uDebug==1.)col=water;if(uDebug==2.)col=N*.5+.5;if(uDebug==3.)col=vec3(.12);if(uDebug==4.)col=vec3(clamp(distanceToEye/800.,0.,1.));
 if(uDebug==5.)col=vec3(13.,8.,3.2)*sunPath;if(uDebug==6.)col=mix(water,reflection,fresnel*.85);if(uDebug==7.)col=vec3(sunlight);if(uDebug==8.)col=vec3(.3);
 if(uDebug==9.)col=vec3(clamp(depth/20.,0.,1.));if(uDebug==10.)col=vec3(foam);
 if(uDebug==12.)col=vec3(0.);
 if(uDebug==11.){float lum=dot(col,vec3(.2126,.7152,.0722));col=lum<.015?vec3(.1,.2,1.):lum>3.?vec3(1.,.1,.05):vec3(lum*.25);}
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 material.fragmentShader=diagnosticOutputShader(material.fragmentShader);
 const root=new THREE.Group();root.name='ocean-and-swash';
 const near=new THREE.PlaneGeometry(1800,1800,900,900);near.rotateX(-Math.PI/2);near.translate(0,0,-350);const mesh=new THREE.Mesh(near,material);root.add(mesh);
 function surfaceMaterial(mode:number){const m=material.clone();Object.assign(m.uniforms,refractionUniforms);m.uniforms.uTime=worldTime;m.uniforms.uDebug=debugMode;m.uniforms.uReflectedSky=reflectedSky;m.uniforms.uCloudShadow=cloudShadow;m.uniforms.uCoastalField.value=field.texture;m.uniforms.uTerrainHeights.value=terrainHeights;m.uniforms.uSurfaceMode.value=mode;return m}
 const swash=new THREE.Mesh(swashGeometry(),surfaceMaterial(2));swash.name='sand-following-swash';root.add(swash);
 const far=new THREE.PlaneGeometry(26000,26000,80,80);far.rotateX(-Math.PI/2);far.translate(0,0,-4000);const distant=new THREE.Mesh(far,surfaceMaterial(1));distant.renderOrder=-1;root.add(distant);
 return {group:root,material};
}
