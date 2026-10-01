// Node-only candidate override. The production source flag stays false on disk.
export async function load(url,context,next){
 const result=await next(url,context);if(!url.endsWith('/src/world/east-spur.ts'))return result;
 const source=typeof result.source==='string'?result.source:Buffer.from(result.source).toString('utf8');
 const pattern=/export const EAST_SPUR_STUDY_ENABLED=(?:false|true);/;
 if(!pattern.test(source))throw Error('East-spur study flag declaration changed');
 return{...result,source:source.replace(pattern,'export const EAST_SPUR_STUDY_ENABLED=true;')};
}
