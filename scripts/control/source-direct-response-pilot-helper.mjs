// Isolated authoring experiment. Nothing in the production renderer imports it.
export const pilotViews=[0,1,8,9];
export const pilotSuns=[0,1,4,5];
export const pilotPoses=[
 {name:'level-front',azimuth:0,elevation:0,sunAzimuth:0},
 {name:'level-back',azimuth:0,elevation:0,sunAzimuth:180},
 {name:'high-front',azimuth:0,elevation:35,sunAzimuth:0},
 {name:'high-back',azimuth:0,elevation:35,sunAzimuth:180},
 {name:'between-front',azimuth:22.5,elevation:17.5,sunAzimuth:22.5},
 {name:'between-back',azimuth:22.5,elevation:17.5,sunAzimuth:202.5},
];
export function responseLayer(view,sun){
 const v=pilotViews.indexOf(view),s=pilotSuns.indexOf(sun);
 if(v<0||s<0)throw Error('Unbaked pilot view/sun');
 return s*pilotViews.length+v;
}

/** Resolved input RGB is already coverage-premultiplied. Preserve that integral. */
export function integrateResponseTile(data,width,height,factor){
 if(!Number.isInteger(factor)||factor<1||width%factor||height%factor||data.length!==width*height*4)
  throw Error('Invalid response integration dimensions');
 const w=width/factor,h=height/factor,result=new Float32Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const sum=[0,0,0,0];
  for(let dy=0;dy<factor;dy++)for(let dx=0;dx<factor;dx++){
   const offset=((y*factor+dy)*width+x*factor+dx)*4;
   for(let c=0;c<4;c++){
    const value=data[offset+c];
    if(!Number.isFinite(value)||value<-.00001||c===3&&value>1.0001)throw Error('Invalid response sample');
    sum[c]+=value;
   }
  }
  for(let c=0;c<4;c++)result[(y*w+x)*4+c]=sum[c]/(factor*factor);
 }
 return result;
}

/** Exact box-area reduction of one fixed source raster, placed on a centered
 * integer-pixel quad. Unlike rerendering source at low resolution, this keeps
 * its leaf texture footprints, coverage decisions and lighting samples fixed.
 * It is an authoring reference, not the runtime source renderer. */
export function fixedRasterAreaReference(data,size,footprint,outputSize=128){
 if(data.length!==size*size*4||!Number.isInteger(footprint)||footprint<=0||footprint>outputSize||(outputSize-footprint)%2)
  throw Error('Invalid fixed-raster area dimensions');
 const scale=size/footprint,tmp=new Float64Array(size*footprint*4),result=new Float32Array(outputSize*outputSize*4);
 for(let y=0;y<size;y++)for(let x=0;x<footprint;x++){
  const left=x*scale,right=(x+1)*scale;
  for(let sx=Math.floor(left);sx<Math.ceil(right);sx++){
   const weight=Math.max(0,Math.min(right,sx+1)-Math.max(left,sx))/scale;
   for(let c=0;c<4;c++)tmp[(y*footprint+x)*4+c]+=data[(y*size+sx)*4+c]*weight;
  }
 }
 const offset=(outputSize-footprint)/2;
 for(let y=0;y<footprint;y++)for(let x=0;x<footprint;x++){
  const bottom=y*scale,top=(y+1)*scale,sum=[0,0,0,0];
  for(let sy=Math.floor(bottom);sy<Math.ceil(top);sy++){
   const weight=Math.max(0,Math.min(top,sy+1)-Math.max(bottom,sy))/scale;
   for(let c=0;c<4;c++)sum[c]+=tmp[(sy*footprint+x)*4+c]*weight;
  }
  for(let c=0;c<4;c++)result[((y+offset)*outputSize+x+offset)*4+c]=sum[c];
 }
 return result;
}

export const responseGLSL=/* glsl */`
uniform highp sampler2DArray uPilotDirectResponse;
uniform sampler2D uPilotExactResponse;
uniform float uPilotDirectResponseEnabled;
uniform float uPilotResponseOwnCoverage;
// Only 0/45-degree views at 0/35 elevation and two independent sun brackets
// are baked. Exact end points can fetch an unused next frame: clamp that fetch
// to its valid endpoint; its interpolation weight is zero in the declared poses.
float pilotSunSlot(float sunFrame){
 return sunFrame<3.5?clamp(sunFrame,0.,1.):clamp(sunFrame-2.,2.,3.);
}
vec4 pilotViewResponse(vec2 cellUV,vec4 frames,vec2 blend,float sunFrame){
 vec2 localUV=cellUV*vec2(8.,3.);
 float base=pilotSunSlot(sunFrame)*4.;
 float x0=clamp(frames.x,0.,1.),x1=clamp(frames.y,0.,1.);
 float y0=clamp(frames.z,0.,1.),y1=clamp(frames.w,0.,1.);
 vec4 a=texture(uPilotDirectResponse,vec3(localUV,base+y0*2.+x0));
 vec4 b=texture(uPilotDirectResponse,vec3(localUV,base+y0*2.+x1));
 vec4 c=texture(uPilotDirectResponse,vec3(localUV,base+y1*2.+x0));
 vec4 d=texture(uPilotDirectResponse,vec3(localUV,base+y1*2.+x1));
 return mix(mix(a,b,blend.x),mix(c,d,blend.x),blend.y);
}
vec4 pilotResponseSample(vec2 cellUV,vec4 frames,vec2 blend){
 if(uPilotDirectResponseEnabled>1.5)return texture(uPilotExactResponse,cellUV*vec2(8.,3.));
 vec4 a=pilotViewResponse(cellUV,frames,blend,vSourceSunFrames.x);
 vec4 b=pilotViewResponse(cellUV,frames,blend,vSourceSunFrames.y);
 return mix(a,b,vSourceSunFrames.z);
}
vec3 pilotDirectResponse(vec2 cellUV,vec4 frames,vec2 blend){
 vec4 value=pilotResponseSample(cellUV,frames,blend);
 return value.a>.00001?value.rgb/value.a:vec3(0.);
}
`;

/** Actual far material chain, preserving alpha, normal, depth and indirect paths.
 * The pilot requires a white instance tint and the scene's one directional sun.
 * Response contains source RGB and transmission: neither is reapplied here.
 */
export function bindPilotDirectResponse(material,texture,enabled={value:0},diagnostics={exactTexture:null,ownCoverage:{value:0}}){
 const previous=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  previous(shader,renderer);
  const start='IncidentLight sourceOccludedLight=directLight;';
  const end='* backCosine * transmission * transmittance;';
  for(const anchor of [start,end,'varying vec3 vSourceSunFrames;','if (diffuseColor.a <= 0.0) discard;'])
   if(shader.fragmentShader.split(anchor).length!==2)throw Error('Pilot requires one actual source-light hook: '+anchor);
  shader.uniforms.uPilotDirectResponse={value:texture};shader.uniforms.uPilotDirectResponseEnabled=enabled;
  shader.uniforms.uPilotExactResponse={value:diagnostics.exactTexture};shader.uniforms.uPilotResponseOwnCoverage=diagnostics.ownCoverage;
  // Place functions after the actual source-sun varying declaration so its
  // existing vertex computation remains the authority for local sun frames.
  shader.fragmentShader=shader.fragmentShader
   .replace('varying vec3 vSourceSunFrames;','varying vec3 vSourceSunFrames;\n'+responseGLSL)
   .replace('if (diffuseColor.a <= 0.0) discard;','if(uPilotResponseOwnCoverage>.5)diffuseColor.a=pilotResponseSample(vMapUv,vImpostorFrames,vImpostorBlend).a;\nif (diffuseColor.a <= 0.0) discard;')
   .replace(start,'vec3 pilotPriorDiffuse=reflectedLight.directDiffuse;\n'+start)
   .replace(end,end+'\nif(uPilotDirectResponseEnabled>.5) reflectedLight.directDiffuse=pilotPriorDiffuse+directLight.color*pilotDirectResponse(vMapUv,vImpostorFrames,vImpostorBlend);');
 };
 material.customProgramCacheKey=()=>key()+'-isolated-source-direct-response-v2-diagnostic-coverage';material.needsUpdate=true;
 return enabled;
}
