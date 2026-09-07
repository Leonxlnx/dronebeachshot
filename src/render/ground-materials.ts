import * as THREE from 'three';
import {worldTime,debugMode,type Textures} from './materials';
import {noiseGLSL,shorelineGLSL} from '../world/math';
import {coastalGLSL} from '../world/coastal';
import {habitatGLSL,habitatUniform} from '../world/habitat';
const projection=`
// A dry, exposed fracture reveals lighter mineral grain. Preserve the scan's
// variation and leave low coastal/weathered rock unchanged; this is albedo,
// so the material still responds to the same sunlight, sky fill and shadows.
vec3 bedrockAlbedo(vec3 stone,vec3 p,vec3 n){
 float fresh=smoothstep(15.,65.,p.y)*(1.-smoothstep(.72,.96,abs(n.y)));
 float gray=dot(stone,vec3(.2126,.7152,.0722));
 vec3 mineral=min(mix(stone,vec3(gray),.72)*vec3(1.04,1.055,1.07),vec3(.65));
 return mix(stone,mineral,fresh);
}

// Three deterministic source phases remove coherent tile repetition. Matching
// albedo/normal/ARM use the same offsets, weights and original UV derivatives.
// Source geometry scale and grain stay intact; rock maps use anisotropy 1 to
// avoid flat mip rows observed at phase boundaries in native ANGLE/Mesa.
vec2 stonePhase(vec2 cell){
 return vec2(hash(cell+vec2(17.7,9.2)),hash(cell+vec2(72.5,31.9)))*13.;
}
vec3 stoneSample(sampler2D tex,vec2 uv){
 // Preserve the original source-UV gradients; phase offsets must not enlarge the footprint.
 vec2 dx=dFdx(uv),dy=dFdy(uv);
 // Equilateral lattice in source UV units. One source tile remains 5.7483 m.
 vec2 skew=vec2(uv.x-uv.y*.57735026919,uv.y*1.15470053838);
 vec2 cell=floor(skew),f=fract(skew);float upper=step(1.,f.x+f.y);
 vec2 a=cell+vec2(upper),b=cell+vec2(1.-upper,upper),c=cell+vec2(upper,1.-upper);
 vec3 w=mix(vec3(1.-f.x-f.y,f.x,f.y),vec3(f.x+f.y-1.,1.-f.x,1.-f.y),upper);
 // Most of each cell keeps one intact source sample; only boundaries blend.
 w=pow(max(w,vec3(0.)),vec3(6.));w/=max(dot(w,vec3(1.)),.000001);
 return textureGrad(tex,uv+stonePhase(a),dx,dy).rgb*w.x
  +textureGrad(tex,uv+stonePhase(b),dx,dy).rgb*w.y
  +textureGrad(tex,uv+stonePhase(c),dx,dy).rgb*w.z;
}
vec3 triWeights(vec3 n){vec3 w=pow(abs(n),vec3(4.));return w/max(dot(w,vec3(1.)),.0001);}
vec3 triSample(sampler2D tex,vec3 p,vec3 n){vec3 w=triWeights(n);return texture2D(tex,p.yz).rgb*w.x+texture2D(tex,p.xz).rgb*w.y+texture2D(tex,p.xy).rgb*w.z;}
vec3 triStone(sampler2D tex,vec3 p,vec3 n){vec3 w=triWeights(n);return stoneSample(tex,p.yz)*w.x+stoneSample(tex,p.xz)*w.y+stoneSample(tex,p.xy)*w.z;}
vec3 triStoneDetail(sampler2D tex,vec3 p,vec3 n){
 vec3 w=triWeights(n),a=stoneSample(tex,p.yz)*2.-1.,b=stoneSample(tex,p.xz)*2.-1.,c=stoneSample(tex,p.xy)*2.-1.;
 // Tangent-space normals encode slopes as XY/Z. Using XY alone flattened
 // the scan's steep fractures. Bound the rare lossy near-zero Z texels.
 a.xy/=max(a.z,.15);b.xy/=max(b.z,.15);c.xy/=max(c.z,.15);
 return vec3(0.,a.x,a.y)*w.x+vec3(b.x,0.,b.y)*w.y+vec3(c.x,c.y,0.)*w.z;
}
vec3 triDetail(sampler2D tex,vec3 p,vec3 n){vec3 w=triWeights(n),a=texture2D(tex,p.yz).xyz*2.-1.,b=texture2D(tex,p.xz).xyz*2.-1.,c=texture2D(tex,p.xy).xyz*2.-1.;return vec3(0.,a.x,a.y)*w.x+vec3(b.x,0.,b.y)*w.y+vec3(c.x,c.y,0.)*w.z;}
`;
function attachWorld(shader:THREE.WebGLProgramParametersWithUniforms){
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGroundWorld,vGroundNormal;').replace('#include <begin_vertex>',`#include <begin_vertex>
 mat4 groundTransform=modelMatrix;
 #ifdef USE_INSTANCING
 groundTransform=modelMatrix*instanceMatrix;
 #endif
 vGroundWorld=(groundTransform*vec4(position,1.)).xyz;
 // Instance scale can be nonuniform. Inverse squared basis lengths give the
 // inverse transpose for the orthogonal instance bases used by this scene.
 vec3 gx=groundTransform[0].xyz,gy=groundTransform[1].xyz,gz=groundTransform[2].xyz;
 vGroundNormal=normalize(gx*normal.x/max(dot(gx,gx),.0001)+gy*normal.y/max(dot(gy,gy),.0001)+gz*normal.z/max(dot(gz,gz),.0001));`);
}
export function createGroundMaterial(t:Textures){
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,vertexColors:true});
 material.onBeforeCompile=shader=>{
  attachWorld(shader);Object.assign(shader.uniforms,{uHabitat:habitatUniform,uTime:worldTime,uDebug:debugMode,uRock:{value:t.rock},uRockN:{value:t.rockNormal},uRockARM:{value:t.rockARM},uSand:{value:t.sand},uSandN:{value:t.sandNormal},uSandARM:{value:t.sandARM},uSoil:{value:t.soil},uSoilN:{value:t.soilNormal},uSoilARM:{value:t.soilARM},uMoss:{value:t.moss},uMossN:{value:t.mossNormal},uMossARM:{value:t.mossARM}});
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
 varying vec3 vGroundWorld,vGroundNormal;uniform float uTime,uDebug;
 uniform sampler2D uRock,uRockN,uRockARM,uSand,uSandN,uSandARM,uSoil,uSoilN,uSoilARM,uMoss,uMossN,uMossARM;
 ${noiseGLSL}${shorelineGLSL}${coastalGLSL}${habitatGLSL}${projection}`)
  .replace('#include <map_fragment>',`#include <map_fragment>
 vec3 gp=vGroundWorld,gn=normalize(vGroundNormal);float d=shoreDist(gp.xz);
 float slope=1.-gn.y,cliff=smoothstep(.13,.43,slope),sediment=1.-smoothstep(22.,53.,d);
 vec4 habitat=habitatAt(gp.xz);float moisture=clamp(habitat.g+habitat.a*.15,0.,1.);
 float patches=smoothstep(.43,.69,fbm(gp.xz*.19)+noise(gp.xz*.68)*.18);
 float moss=patches*moisture*(.55+.45*habitat.a)*smoothstep(.32,.88,gn.y)*(1.-sediment);
 vec3 stone=bedrockAlbedo(triStone(uRock,gp/5.7483,gn),gp,gn),soil=triSample(uSoil,gp*.5,gn),living=triSample(uMoss,gp/3.,gn),sand=texture2D(uSand,gp.xz*.5).rgb;
 // Calibrated pale sediment retains the scan's relative grain variation.
 // This changes substrate albedo; sunset lighting and wetness remain separate.
 float sandLuminance=dot(sand,vec3(.2126,.7152,.0722));
 // Keep close grain, but average sub-pixel contrast at grazing/aerial angles.
 // Use the footprint on the ground, not camera distance, so a steep aerial
 // view retains the detail it can actually resolve.
 float sandFootprint=max(length(dFdx(gp.xz)),length(dFdy(gp.xz)));
 float sandGrain=1.-smoothstep(.025,.18,sandFootprint);
 sand=vec3(.52,.465,.355)*mix(1.,clamp(sandLuminance/.142,.62,1.38),sandGrain);
 vec3 ground=mix(soil,stone,cliff);ground=mix(ground,living,moss*.76);ground=mix(ground,sand,sediment);
 float macro=.91+.18*fbm(gp.xz*.027),wet=sandWetness(gp.x,d,uTime);
 // Darkening is bounded. Shaded ground must remain readable under sky fill.
 ground*=macro*mix(1.,.61,wet*sediment);diffuseColor.rgb*=ground;
 vec3 surfaceARM=mix(triSample(uSoilARM,gp*.5,gn),triStone(uRockARM,gp/5.7483,gn),cliff);
 surfaceARM=mix(surfaceARM,triSample(uMossARM,gp/3.,gn),moss*.76);surfaceARM=mix(surfaceARM,texture2D(uSandARM,gp.xz*.5).rgb,sediment);`)
  .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 roughnessFactor=clamp(surfaceARM.g,.42,.98);// A reflective water film exists on exposed wet sand. Submerged sediment
 // keeps its granular roughness; the separate ocean owns the air/water interface.
 float exposedFilm=wet*sediment*smoothstep(-.25,.10,gp.y);
 roughnessFactor=mix(roughnessFactor,.20,exposedFilm);`)
  .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 vec3 detail=mix(triDetail(uSoilN,gp*.5,gn),triStoneDetail(uRockN,gp/5.7483,gn),cliff);detail=mix(detail,triDetail(uMossN,gp/3.,gn),moss*.76);
 vec3 sandNormal=texture2D(uSandN,gp.xz*.5).xyz*2.-1.;detail=mix(detail,vec3(sandNormal.x,0.,sandNormal.y)*sandGrain,sediment);
 // Fine tidal ripples affect the normal, not metres of geometry displacement.
 float ripple=cos(d*7.5+sin(gp.x*.09)*2.2+noise(gp.xz*.14)*1.4)*.035*sediment*(1.-smoothstep(5.,24.,d));vec2 inland=coastNormal(gp.x);detail+=vec3(inland.x,0.,inland.y)*ripple;
 vec3 detailed=normalize(gn+(detail-gn*dot(gn,detail))*.38);normal=normalize(mat3(viewMatrix)*detailed);`)
  .replace('#include <aomap_fragment>',`#include <aomap_fragment>
 reflectedLight.indirectDiffuse*=mix(.72,1.,surfaceARM.r);`)
  .replace('#include <opaque_fragment>',`#include <opaque_fragment>
 if(uDebug==9.)gl_FragColor.rgb=vec3(clamp(d/100.,0.,1.));if(uDebug==12.)gl_FragColor.rgb=mix(vec3(.06,.12,.4),vec3(.3,.9,.18),habitat.a);`);
 };
 material.customProgramCacheKey=()=> 'soil-rock-moss-sediment-v10-stone-slopes';return material;
}
export function createRockMaterial(t:Textures){
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.86});
 material.onBeforeCompile=shader=>{
  attachWorld(shader);Object.assign(shader.uniforms,{uHabitat:habitatUniform,uTime:worldTime,uRock:{value:t.rock},uRockN:{value:t.rockNormal},uRockARM:{value:t.rockARM},uMoss:{value:t.moss},uMossN:{value:t.mossNormal},uMossARM:{value:t.mossARM}});
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
 varying vec3 vGroundWorld,vGroundNormal;uniform float uTime;uniform sampler2D uRock,uRockN,uRockARM,uMoss,uMossN,uMossARM;${noiseGLSL}${shorelineGLSL}${coastalGLSL}${habitatGLSL}${projection}`)
  .replace('#include <map_fragment>',`#include <map_fragment>
 vec3 gp=vGroundWorld,gn=normalize(vGroundNormal);float d=shoreDist(gp.xz);float splash=1.-smoothstep(.3,1.9,gp.y);float shoreWet=sandWetness(gp.x,d,uTime);float wet=splash*shoreWet;
 float moss=smoothstep(.35,.9,gn.y)*smoothstep(9.,35.,d)*(1.-smoothstep(60.,140.,gp.y))*smoothstep(.48,.68,fbm(gp.xz*.32));
 vec3 stone=bedrockAlbedo(triStone(uRock,gp/5.7483,gn),gp,gn),living=triSample(uMoss,gp/3.,gn);float grain=.94+.12*noise(gp.xz*.045);
 diffuseColor.rgb*=mix(stone,living,moss*.82)*grain*mix(1.,.64,wet);
 vec3 rockARM=mix(triStone(uRockARM,gp/5.7483,gn),triSample(uMossARM,gp/3.,gn),moss*.82);`)
  .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 roughnessFactor=mix(clamp(rockARM.g,.5,.99),.27,wet);`)
  .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 vec3 detail=mix(triStoneDetail(uRockN,gp/5.7483,gn),triDetail(uMossN,gp/3.,gn),moss*.82);normal=normalize(mat3(viewMatrix)*normalize(gn+(detail-gn*dot(gn,detail))*.45));`)
  .replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=mix(.72,1.,rockARM.r);');
 };
 material.customProgramCacheKey=()=> 'world-rock-wet-moss-v7-stone-slopes';return material;
}
