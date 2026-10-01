// Isolated proposal builder and CPU mask oracle. Nothing under src imports this.
import {readGroundStudyBaseline} from './ground-study-baseline.mjs';
export function activeGroundLayers(cliff,mossBlend,sediment){
 return {
  soil:sediment!==1&&mossBlend!==1&&cliff!==1,
  stone:sediment!==1&&mossBlend!==1&&cliff!==0,
  moss:sediment!==1&&mossBlend!==0,
  sand:sediment!==0,
 };
}
export function logicalGroundLookups(active){
 // Three channels: albedo, normal and ARM. These are source texture operations,
 // not hardware texel taps, lane execution counts or measured GPU milliseconds.
 return 3*(9*Number(active.stone)+3*Number(active.soil)+3*Number(active.moss)+Number(active.sand));
}
function replaceOnce(source,before,after){
 const i=source.indexOf(before);
 if(i<0)throw Error('Source changed; review proposal anchor: '+before.slice(0,100));
 return source.slice(0,i)+after+source.slice(i+before.length);
}

export function proposeGroundLayerPruning(source=readGroundStudyBaseline().ground){
 if(source.includes('export const groundLayerPruning='))throw Error('Layer pruning is already integrated; use the frozen ground-study baseline, not current production');
 let result=source;
 result=replaceOnce(result,'export const rockWeatheringStrength={value:0};',`export const rockWeatheringStrength={value:0};
// Inspection study: 0 original, 1 explicit gradients, 2 exact-zero pruning.
export const groundLayerPruning={value:0};`);
 result=replaceOnce(result,'export function createGroundMaterial(t:Textures){',`export function createGroundMaterial(t:Textures,allowLayerPruning=false){
 // Wrappers may read all source layers or rewrite masks later. They stay on an
 // independent mode-0 uniform unless their caller explicitly opts in.
 const layerPruningMode=allowLayerPruning?groundLayerPruning:{value:0};`);

 // Copy the existing source-phase computation verbatim, changing only its
 // interface so derivative evaluation happens before any varying branch.
 const sampleStart=source.indexOf('vec3 stoneSample(sampler2D tex,vec2 uv){');
 const sampleEnd=source.indexOf('vec3 triWeights(',sampleStart);
 if(sampleStart<0||sampleEnd<0)throw Error('Cannot locate original stone sampler');
 const stoneSample=source.slice(sampleStart,sampleEnd)
  .replace('vec3 stoneSample(sampler2D tex,vec2 uv){','vec3 groundStoneSampleGrad(sampler2D tex,vec2 uv,vec2 dx,vec2 dy){')
  .replace(' vec2 dx=dFdx(uv),dy=dFdy(uv);\n','');
 const helpers=stoneSample+`
vec3 groundTriSampleGrad(sampler2D tex,vec3 p,vec3 n,vec3 dx,vec3 dy){vec3 w=triWeights(n);return textureGrad(tex,p.yz,dx.yz,dy.yz).rgb*w.x+textureGrad(tex,p.xz,dx.xz,dy.xz).rgb*w.y+textureGrad(tex,p.xy,dx.xy,dy.xy).rgb*w.z;}
vec3 groundTriStoneGrad(sampler2D tex,vec3 p,vec3 n,vec3 dx,vec3 dy){vec3 w=triWeights(n);return groundStoneSampleGrad(tex,stoneXUV(p),stoneXUV(dx),stoneXUV(dy))*w.x+groundStoneSampleGrad(tex,p.xz,dx.xz,dy.xz)*w.y+groundStoneSampleGrad(tex,p.xy,dx.xy,dy.xy)*w.z;}
vec3 groundTriStoneDetailGrad(sampler2D tex,vec3 p,vec3 n,vec3 dx,vec3 dy){
 vec3 w=triWeights(n),a=groundStoneSampleGrad(tex,stoneXUV(p),stoneXUV(dx),stoneXUV(dy))*2.-1.,b=groundStoneSampleGrad(tex,p.xz,dx.xz,dy.xz)*2.-1.,c=groundStoneSampleGrad(tex,p.xy,dx.xy,dy.xy)*2.-1.;
 a.xy/=max(a.z,.15);b.xy/=max(b.z,.15);c.xy/=max(c.z,.15);
 return stoneXDetail(a.xy)*w.x+vec3(b.x,0.,b.y)*w.y+vec3(c.x,c.y,0.)*w.z;
}
vec3 groundTriDetailGrad(sampler2D tex,vec3 p,vec3 n,vec3 dx,vec3 dy){vec3 w=triWeights(n),a=textureGrad(tex,p.yz,dx.yz,dy.yz).xyz*2.-1.,b=textureGrad(tex,p.xz,dx.xz,dy.xz).xyz*2.-1.,c=textureGrad(tex,p.xy,dx.xy,dy.xy).xyz*2.-1.;return vec3(0.,a.x,a.y)*w.x+vec3(b.x,0.,b.y)*w.y+vec3(c.x,c.y,0.)*w.z;}
`;
 result=replaceOnce(result,'function attachWorld(shader:',`const groundLayerProjection=\`${helpers}\`;
function attachWorld(shader:`);
 result=replaceOnce(result,'uRockWeathering:rockWeatheringStrength,uDebug:debugMode','uRockWeathering:rockWeatheringStrength,uGroundLayerPruning:layerPruningMode,uDebug:debugMode');
 result=replaceOnce(result,'uniform float uDebug;','uniform float uDebug,uGroundLayerPruning;');
 result=replaceOnce(result,'${habitatGLSL}${projection}`)','${habitatGLSL}${projection}${groundLayerProjection}`)');
 const coordinates=`
 // Derive the exact already-scaled source coordinates in uniform control flow.
 // Do not replace dFdx(gp/scale) with dFdx(gp)/scale: rounding can change LOD.
 vec3 groundRockP=gp/5.7483,groundSoilP=gp*.5,groundMossP=gp/3.,groundMineralP=gp/23.;
 vec2 groundSandUV=gp.xz*.5;
 vec3 groundRockDx=dFdx(groundRockP),groundRockDy=dFdy(groundRockP),groundSoilDx=dFdx(groundSoilP),groundSoilDy=dFdy(groundSoilP);
 vec3 groundMossDx=dFdx(groundMossP),groundMossDy=dFdy(groundMossP),groundMineralDx=dFdx(groundMineralP),groundMineralDy=dFdy(groundMineralP);
 vec2 groundSandDx=dFdx(groundSandUV),groundSandDy=dFdy(groundSandUV);
 // Predicates inspect exact factors, never their product or an epsilon.
 bool groundPrune=uGroundLayerPruning>1.;
 bool groundNeedSoil=!groundPrune||(sediment!=1.&&moss*.76!=1.&&cliff!=1.);
 bool groundNeedStone=!groundPrune||(sediment!=1.&&moss*.76!=1.&&cliff!=0.);
 bool groundNeedMoss=!groundPrune||(sediment!=1.&&moss*.76!=0.);
 bool groundNeedSand=!groundPrune||sediment!=0.;
`;
 const oldAlbedo=' vec3 stone=bedrockAlbedo(triStone(uRock,gp/5.7483,gn),gp,gn,habitat),soil=triSample(uSoil,gp*.5,gn),living=triSample(uMoss,gp/3.,gn),sand=texture2D(uSand,gp.xz*.5).rgb;';
 result=replaceOnce(result,oldAlbedo,coordinates+` vec3 stone,soil,living,sand;
 if(uGroundLayerPruning==0.){
  stone=bedrockAlbedo(triStone(uRock,gp/5.7483,gn),gp,gn,habitat);soil=triSample(uSoil,gp*.5,gn);living=triSample(uMoss,gp/3.,gn);sand=texture2D(uSand,gp.xz*.5).rgb;
 }else{
  stone=vec3(0.);soil=vec3(0.);living=vec3(0.);sand=vec3(0.);
  if(groundNeedStone)stone=bedrockAlbedo(groundTriStoneGrad(uRock,groundRockP,gn,groundRockDx,groundRockDy),gp,gn,habitat);
  if(groundNeedSoil)soil=groundTriSampleGrad(uSoil,groundSoilP,gn,groundSoilDx,groundSoilDy);
  if(groundNeedMoss)living=groundTriSampleGrad(uMoss,groundMossP,gn,groundMossDx,groundMossDy);
  if(groundNeedSand)sand=textureGrad(uSand,groundSandUV,groundSandDx,groundSandDy).rgb;
 }`);
 const oldARM=` vec3 surfaceARM=mix(triSample(uSoilARM,gp*.5,gn),triStone(uRockARM,gp/5.7483,gn),cliff);
 surfaceARM=mix(surfaceARM,triSample(uMossARM,gp/3.,gn),moss*.76);surfaceARM=mix(surfaceARM,texture2D(uSandARM,gp.xz*.5).rgb,sediment);`;
 result=replaceOnce(result,oldARM,` vec3 surfaceARM;
 if(uGroundLayerPruning==0.){
  surfaceARM=mix(triSample(uSoilARM,gp*.5,gn),triStone(uRockARM,gp/5.7483,gn),cliff);
  surfaceARM=mix(surfaceARM,triSample(uMossARM,gp/3.,gn),moss*.76);surfaceARM=mix(surfaceARM,texture2D(uSandARM,gp.xz*.5).rgb,sediment);
 }else{
  vec3 soilARM=vec3(0.),stoneARM=vec3(0.),mossARM=vec3(0.),sandARM=vec3(0.);
  if(groundNeedSoil)soilARM=groundTriSampleGrad(uSoilARM,groundSoilP,gn,groundSoilDx,groundSoilDy);
  if(groundNeedStone)stoneARM=groundTriStoneGrad(uRockARM,groundRockP,gn,groundRockDx,groundRockDy);
  if(groundNeedMoss)mossARM=groundTriSampleGrad(uMossARM,groundMossP,gn,groundMossDx,groundMossDy);
  if(groundNeedSand)sandARM=textureGrad(uSandARM,groundSandUV,groundSandDx,groundSandDy).rgb;
  surfaceARM=mix(soilARM,stoneARM,cliff);surfaceARM=mix(surfaceARM,mossARM,moss*.76);surfaceARM=mix(surfaceARM,sandARM,sediment);
 }`);
 const oldNormal=` vec3 detail=mix(triDetail(uSoilN,gp*.5,gn),triStoneDetail(uRockN,gp/5.7483,gn),cliff);detail=mix(detail,triDetail(uMossN,gp/3.,gn),moss*.76);
 vec3 sandNormal=texture2D(uSandN,gp.xz*.5).xyz*2.-1.;detail=mix(detail,vec3(sandNormal.x,0.,sandNormal.y)*sandGrain,sediment);`;
 result=replaceOnce(result,oldNormal,` vec3 detail,sandNormal;
 if(uGroundLayerPruning==0.){
  detail=mix(triDetail(uSoilN,gp*.5,gn),triStoneDetail(uRockN,gp/5.7483,gn),cliff);detail=mix(detail,triDetail(uMossN,gp/3.,gn),moss*.76);
  sandNormal=texture2D(uSandN,gp.xz*.5).xyz*2.-1.;
 }else{
  vec3 soilDetail=vec3(0.),stoneDetail=vec3(0.),mossDetail=vec3(0.);sandNormal=vec3(0.);
  if(groundNeedSoil)soilDetail=groundTriDetailGrad(uSoilN,groundSoilP,gn,groundSoilDx,groundSoilDy);
  if(groundNeedStone)stoneDetail=groundTriStoneDetailGrad(uRockN,groundRockP,gn,groundRockDx,groundRockDy);
  if(groundNeedMoss)mossDetail=groundTriDetailGrad(uMossN,groundMossP,gn,groundMossDx,groundMossDy);
  if(groundNeedSand)sandNormal=textureGrad(uSandN,groundSandUV,groundSandDx,groundSandDy).xyz*2.-1.;
  detail=mix(soilDetail,stoneDetail,cliff);detail=mix(detail,mossDetail,moss*.76);
 }
 detail=mix(detail,vec3(sandNormal.x,0.,sandNormal.y)*sandGrain,sediment);`);
 result=replaceOnce(result,'  vec3 mineral=triStoneDetail(uRockN,gp/23.,gn);mineral-=gn*dot(gn,mineral);',`  vec3 mineral;
  if(uGroundLayerPruning==0.)mineral=triStoneDetail(uRockN,gp/23.,gn);
  else mineral=groundTriStoneDetailGrad(uRockN,groundMineralP,gn,groundMineralDx,groundMineralDy);
  mineral-=gn*dot(gn,mineral);`);
 // A separate key suffix composes with the unaccepted ripple-filter proposal.
 const key=result.match(/material\.customProgramCacheKey=\(\)=> '(soil-rock-moss-sediment-[^']+)';return material;/)?.[1];
 if(!key)throw Error('Cannot locate ground material cache key');
 result=replaceOnce(result,"'"+key+"'","'"+key+"-layer-pruning'");
 return result;
}

export function proposeGroundLayerPruningCallers(source=readGroundStudyBaseline().terrain){
 if(source.includes('createGroundMaterial(t,false)')||source.includes('createGroundMaterial(t,true)'))throw Error('Layer pruning callers are already integrated; use the frozen ground-study baseline');
 // Deliberately exclude the continuation wrapper: its source-layer reads and
 // later mask mutation do not obey the core material's data-flow predicates.
 let result=replaceOnce(source,' const material=createGroundMaterial(t);\n const baseCompile=',` // This wrapper consumes all layers and rewrites masks: keep original sampling.
 const material=createGroundMaterial(t,false);
 const baseCompile=`);
 result=replaceOnce(result,"export function createTerrain(t:Textures){const group=new THREE.Group();group.name='land';const material=createGroundMaterial(t);","export function createTerrain(t:Textures){const group=new THREE.Group();group.name='land';const material=createGroundMaterial(t,true);");
 return result;
}
