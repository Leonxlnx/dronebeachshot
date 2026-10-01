// Read-only reference-world construction using the exact preceding math source.
const target=new URL('../../src/world/math.ts',import.meta.url).href;
const reference=new URL('./fixtures/principal-face-baseline/math.ts',import.meta.url).href;
export async function resolve(specifier,context,next){
 const result=await next(specifier,context);
 return result.url===target?{...result,url:reference}:result;
}
export async function load(url,context,next){
 const result=await next(url,context);
 return url===reference?{...result,source:String(result.source)+'\nexport const terrainHeightBeforePrincipalFace=terrainHeight;\nexport const terrainSlopeBeforePrincipalFace=terrainSlope;\n'}:result;
}
