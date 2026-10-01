/** Exact rounded coastal-spur visual study. OFF in production.
 * Shared 2m terrain, normals, root heights and coastal field must all consume
 * this same height addition if explicitly enabled for a controlled trial.
 * Shape frozen after the 9/10.5s local neutral/PBR comparison; no repeated ribs.
 */
export const EAST_SPUR_STUDY_ENABLED=false;
export const EAST_SPUR_SETTINGS=Object.freeze({maximumUplift:32,centerX:190,centerZ:125,strike:.6,kneeShift:3,
 westCore:12,westOuter:28,eastCore:18,eastOuter:36,toeStart:98,toeFull:118,crownStart:143,crownEnd:173});
export const EAST_SPUR_SUPPORT_REGION=Object.freeze({minX:145,maxX:260,minZ:97,maxZ:174});
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
export function eastSpurUplift(x:number,z:number,d:number){
 const p=EAST_SPUR_SETTINGS;
 if(z<=p.toeStart||z>=p.crownEnd||d<=45)return 0;
 const center=p.centerX+p.strike*(z-p.centerZ)+p.kneeShift*smooth(125,150,z),across=x-center;
 const core=across<0?p.westCore:p.eastCore,outer=across<0?p.westOuter:p.eastOuter;
 const side=1-smooth(core,outer,Math.abs(across));if(side===0)return 0;
 const toe=smooth(p.toeStart,p.toeFull,z),crown=1-smooth(p.crownStart,p.crownEnd,z),coast=smooth(45,60,d);
 const weight=side*toe*crown*coast;
 return p.maximumUplift*weight;
}
