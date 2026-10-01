import type {ShaderMaterial} from 'three';

// One bounded inspection variant. It changes density support, not radiance or
// opacity scaling. Equal coverage controls do not imply equal occupied volume.
export const cloudBankParameters=Object.freeze({
 alongScale:.4,shear:.30,footprintScale:1.02,
 weatherAlong:.000085,weatherAcross:.00030,
 fragmentAlong:.000255,fragmentAcross:.00063,
 maturityAlong:.000065,maturityAcross:.00016,
 lowTopStart:.28,highTopStart:.58,lowTopEnd:.56,highTopEnd:1,
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
 let bankField=replace(originalField,
  'float weather=noise(p.xz*.00021+vec2(8.3,2.7))*.8+.2*noise(p.xz*.00063);',
  `vec2 bankAlong=normalize(worldWind),bankAcross=vec2(-bankAlong.y,bankAlong.x);
 vec2 bankXZ=vec2(dot(p.xz,bankAlong),dot(p.xz,bankAcross));
 float weather=noise(bankXZ*vec2(${float(p.weatherAlong)},${float(p.weatherAcross)})+vec2(8.3,2.7))*.8
  +.2*noise(bankXZ*vec2(${float(p.fragmentAlong)},${float(p.fragmentAcross)}));`);
 bankField=replace(bankField,'float cloudType=noise(p.xz*.00013+vec2(47.2,-11.8));',
  `float cloudType=noise(bankXZ*vec2(${float(p.maturityAlong)},${float(p.maturityAcross)})+vec2(47.2,-11.8));`);
 bankField=replace(bankField,
  'mix(.42,.58,cloudType),mix(.80,1.,cloudType),height)',
  `mix(${float(p.lowTopStart)},${float(p.highTopStart)},cloudType),mix(${float(p.lowTopEnd)},${float(p.highTopEnd)},cloudType),height)`);
 bankField=replace(bankField,'vec3 coord=p*.00032;',
  `// Macro banks stretch along the actual shared wind. Upper lobes lean downwind.
 vec3 coord=vec3((bankXZ.x-${float(p.shear)}*(p.y-cloudBase))*${float(p.alongScale)},p.y,bankXZ.y)*.00032;`);
 bankField=replace(bankField,'float baseLod=max(0.,log2(max(footprint,1.)*.00032*64.));',
  `// 1.02 bounds the sheared coordinate map's largest singular value (~1.0085).
 float baseLod=max(0.,log2(max(footprint,1.)*.00032*64.*${float(p.footprintScale)}));`);
 bankField=replace(bankField,'textureLod(uCloudNoise,coord*5.+vec3(.18,.31,.13),detailLod)',
  'textureLod(uCloudNoise,p*.00032*5.+vec3(.18,.31,.13),detailLod)');
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
