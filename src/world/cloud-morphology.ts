import type {ShaderMaterial} from 'three';

// One shared volume variant for visible sky, reflection and ground shadows.
// Coverage controls regional occupancy separately from within-cloud density.
export const cloudBankParameters=Object.freeze({
 alongScale:.8,shear:.12,footprintScale:1.54,
 weatherAlong:.00016,weatherAcross:.00024,
 fragmentAlong:.00044,fragmentAcross:.00052,
 maturityAlong:.00010,maturityAcross:.00014,
 warpAlong:1100,warpAcross:350,warpHeight:180,
 lowerBound:600,upperBound:3200,
 baseHeight:750,baseRange:600,baseFragmentRange:120,
 minimumDepth:500,depthRange:1100,
});
const defineName='BAY_CLOUD_WIND_BANKS';
const float=(value:number)=>Number.isInteger(value)?value+'.':String(value);

/** The unchanged field is retained as the OFF shader, including all arithmetic. */
export function createCloudMorphologyStudy(originalField:string){
 const p=cloudBankParameters;
 const replace=(source:string,from:string,to:string)=>{
  if(source.split(from).length!==2)throw Error('Cloud morphology source anchor changed: '+from);
  return source.replace(from,to);
 };
 function buildBankField(){
 const start=originalField.indexOf('float filteredDensity('),end=originalField.indexOf('\nfloat density(');
 if(start<0||end<start)throw Error('Cloud morphology source anchor changed: density function');
 let bankField=replace(originalField,originalField.slice(start,end),`float filteredDensity(vec3 p,float footprint){
 if(p.y<cloudBase||p.y>cloudTop)return 0.;
 float radius=length(p.xz);if(radius>cloudWorldRadius)return 0.;
 float distantFade=smoothstep(700.,2500.,radius);
 if(distantFade==0.)return 0.;
 vec2 bankAlong=normalize(worldWind),bankAcross=vec2(-bankAlong.y,bankAlong.x);
 vec2 bankXZ=vec2(dot(p.xz,bankAlong),dot(p.xz,bankAcross));
 float bankMass=noise(bankXZ*vec2(${float(p.weatherAlong)},${float(p.weatherAcross)})+vec2(8.3,2.7));
 float bankFragment=noise(bankXZ*vec2(${float(p.fragmentAlong)},${float(p.fragmentAcross)}));
 float cloudType=noise(bankXZ*vec2(${float(p.maturityAlong)},${float(p.maturityAcross)})+vec2(47.2,-11.8));
 // The sunset opening biases weather, rather than cutting an ellipse out of a slab.
 vec2 along=normalize(vec2(-.38,-.92)),across=vec2(-along.y,along.x);
 vec2 openingDelta=p.xz-along*14000.;
 float opening=length(vec2(dot(openingDelta,across)/3100.,dot(openingDelta,along)/10000.));
 float clearing=smoothstep(.65,1.15,opening);
 float weather=bankMass*.8+bankFragment*.2+.30*(uCloudCoverageScale-.4)-.12*(1.-clearing);
 float occupancy=smoothstep(.50,.70,weather);
 if(occupancy==0.)return 0.;
 // End separate weather systems at different distances, before the integration cylinder.
 distantFade*=1.-smoothstep(14000.+6000.*bankFragment,24000.+10000.*cloudType,radius);
 if(distantFade==0.)return 0.;
 float localBase=${float(p.baseHeight)}+${float(p.baseRange)}*cloudType+${float(p.baseFragmentRange)}*(bankFragment-.5);
 float thickness=(${float(p.minimumDepth)}+${float(p.depthRange)}*bankMass)*mix(.55,1.,occupancy);
 float height=(p.y-localBase)/thickness;
 if(height<=0.||height>=1.)return 0.;
 // The vertical envelope raises the lobe surface threshold; it does not fill
 // a slab above a common floor. Mature bodies can grow farther upward.
 float vertical=height<.42?(height-.42)/.42:(height-.42)/.58;
 // Regional distortion breaks texture repetition without stretching every lobe.
 vec3 coord=vec3((bankXZ.x-${float(p.shear)}*(p.y-cloudBase)+(bankMass-.5)*${float(p.warpAlong)})*${float(p.alongScale)},
  p.y+(cloudType-.5)*${float(p.warpHeight)},bankXZ.y+(bankFragment-.5)*${float(p.warpAcross)})*.00032;
 // Bounds shear plus the regional warp Jacobian (maximum stretch < 1.54).
 float baseLod=max(0.,log2(max(footprint,1.)*.00032*64.*${float(p.footprintScale)}));
 vec4 n=textureLod(uCloudNoise,coord,baseLod);
 // G/B are inverted 3D nearest-feature distances. Their threshold is actual
 // rounded support: a union of large and smaller billows, not density paint
 // inside a weather slab. Perlin perturbs their radius without filling gaps.
 float lobes=max(n.g,.85*n.b)+(n.r-.5)*.12;
 float surface=mix(.67,.52,occupancy)+.72*vertical*vertical;
 float base=max(lobes-surface,0.);
 if(base<.001)return 0.;
 float detailLod=max(0.,log2(max(footprint,1.)*.00032*5.*64.));
 vec4 detail=textureLod(uCloudNoise,p*.00032*5.+vec3(.18,.31,.13),detailLod);
 float erosion=dot(detail.gba,vec3(.625,.25,.125));
 float amount=mix(1.-erosion,erosion,smoothstep(.05,.4,height));
 float edgeWeight=1.-smoothstep(.08,.22,base);
 float threshold=amount*mix(.025,.065,edgeWeight);
 float shape=clamp((base-threshold)/.18,0.,1.);
 return shape*occupancy*distantFade;
}`);
 bankField=replace(bankField,'const float cloudBase=1000.;',`const float cloudBase=${float(p.lowerBound)};`);
 bankField=replace(bankField,'const float cloudTop=2250.;',`const float cloudTop=${float(p.upperBound)};`);
 bankField=replace(bankField,
  'float depth=density(point+sun*95.)*135.+density(point+sun*275.)*250.+density(point+sun*620.)*380.;',
  '// Contiguous midpoint cells cover 0..810 m and resolve nearby self-shadow.\n float depth=density(point+sun*40.)*80.+density(point+sun*190.)*220.+density(point+sun*555.)*510.;');
 return bankField;
 }

 let enabled=false,bankField:string|null=null;
 const materials=new Set<ShaderMaterial>(),registered=new WeakSet<ShaderMaterial>();
 function register(material:ShaderMaterial){
  if(enabled)throw Error('Disable cloud morphology before registering materials');
  if(registered.has(material))throw Error('Cloud morphology material already registered');
  if(material.defines[defineName]!==undefined)throw Error('Cloud morphology define is reserved');
  if(material.fragmentShader.split(originalField).length!==2)throw Error('Register a material containing the shared cloud field');
  const previous=material.onBeforeCompile.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
   previous(shader,renderer);
   if(!enabled)return;
   shader.fragmentShader=replace(shader.fragmentShader,originalField,bankField!);
  };
  registered.add(material);materials.add(material);
  const dispose=()=>{if(enabled)set(false);materials.delete(material);material.removeEventListener('dispose',dispose);};
  material.addEventListener('dispose',dispose);
  return material;
 }
 function set(value:boolean){
  if(typeof value!=='boolean')throw Error('Cloud morphology study expects a boolean');
  // This fails closed if one of visible sky, reflected sky or shadow was omitted.
  if(value&&materials.size!==3)throw Error('Register all three cloud materials before enabling morphology');
  if(enabled===value)return enabled;
  // Changed anchors reject only the requested study, never ordinary OFF use.
  if(value&&bankField===null)bankField=buildBankField();
  enabled=value;
  for(const material of materials){
   if(value)material.defines={...material.defines,[defineName]:1};
   else delete material.defines[defineName];
   material.needsUpdate=true;
  }
  return enabled;
 }
 return {register,set,get:()=>enabled};
}
