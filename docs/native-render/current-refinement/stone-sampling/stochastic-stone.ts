// Original deterministic triangular translation sampler. Only phase selection changes.
// Source albedo/normal/ARM use identical UVs, weights and original explicit derivatives.
export const stochasticStoneGLSL=`
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
`;
export function applyStochasticStone(material:any){
 const base=material.onBeforeCompile.bind(material),oldKey=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader:any,renderer:any)=>{
  base(shader,renderer);
  const pattern=/vec3 stoneSample\(sampler2D tex,vec2 uv\)\{[\s\S]*?\n\}/;
  if(!pattern.test(shader.fragmentShader))throw Error('Expected original stoneSample function absent');
  shader.fragmentShader=shader.fragmentShader.replace(pattern,stochasticStoneGLSL);
 };
 material.customProgramCacheKey=()=>oldKey()+'-triangular-source-phases-v1';
}
