// Diagnostic-only module override. Never writes the production study flag.
// Run with ts-resolve.mjs and an explicit focused CPU support script.
export async function load(url,context,next){
 const result=await next(url,context);
 if(!url.endsWith('/src/world/broad-recess-planes.ts'))return result;
 const source=typeof result.source==='string'?result.source:Buffer.from(result.source).toString('utf8');
 const pattern=/export const BROAD_RECESS_STUDY_ENABLED=(?:false|true);/;
 if(!pattern.test(source))throw new Error('Broad-recess study flag declaration changed');
 return {...result,source:source.replace(pattern,'export const BROAD_RECESS_STUDY_ENABLED=true;')};
}
