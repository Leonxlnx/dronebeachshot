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
 // Non-harmonic wavenumbers and independent phases break short repeating cells.
 // Directional spread follows the same prevailing wind as the coast's foliage.
 // Unfiltered slope RMS equals the previous six-band value (0.138564).
 vec2 ripples=vec2(0.);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-.43)+across*sin(-.43),1.31,.10475806,.71);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos( .29)+across*sin( .29),2.17,.09218709,4.11);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-.12)+across*sin(-.12),3.73,.07961612,2.39);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos( .67)+across*sin( .67),6.11,.06914032,5.77);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-.72)+across*sin(-.72),9.47,.05866451,1.31);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos( .08)+across*sin( .08),14.23,.04714113,3.83);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos( .44)+across*sin( .44),21.37,.03666532,.17);
 ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(-.29)+across*sin(-.29),32.11,.02828468,4.93);
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
 float crest=breakBand*breakerActivity*mix(1.,.35,coast.a),residue=(.5+.5*sin(travel-1.1))*breakerActivity*.30;
 // Swash displacement advects the foam in the coast-normal direction. The
 // derivative changes sign during retreat, so the same field flows back out.
 vec2 flow=(p-coastNormal(p.x)*reach)*1.6;flow+=vec2(sin(p.y*.3),sin(p.x*.24))*.23;
 float foamFootprint=max(length(waterPixelDx),length(waterPixelDy))*1.6;
 float cells=filteredFoamNoise(flow,foamFootprint)
  +mix(.5,noise(flow*3.875),1.-smoothstep(.35,1.25,foamFootprint*3.875))*.17;
 float lace=smoothstep(.43,.65,cells);
 float foam=(crest*.92+residue)*lace;
 float swashEdge=1.-smoothstep(.0,.75,abs(d-filmReach+.28));
 float washArea=smoothstep(-6.,-.5,d)*(1.-smoothstep(reach-2.,reach,d));
 foam+=swashEdge*(.08+.58*lace)+washArea*lace*.22;
 // Rock foam is attached to the rasterized waterline of actual scene geometry.
 float rockEdge=(1.-smoothstep(.3,3.8,max(coast.g,0.)))*step(-.5,coast.g);
 vec2 obstacleGradient=vec2(coastalFieldSample(p+vec2(1.,0.)).g-coastalFieldSample(p-vec2(1.,0.)).g,coastalFieldSample(p+vec2(0.,1.)).g-coastalFieldSample(p-vec2(0.,1.)).g);
 float facing=max(dot(obstacleGradient/max(length(obstacleGradient),.001),-coastNormal(p.x)),0.);
 float impact=pow(.5+.5*sin(travel),5.)*facing;
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
