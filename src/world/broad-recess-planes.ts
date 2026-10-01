/** Reversible three-plane face study. Actual scene acceptance is pending.
 * This is a separate candidate from the rejected transverse principal-face lip.
 * Change the single flag, then rebuild, to compare identical camera frames.
 */
export const BROAD_RECESS_STUDY_ENABLED=false;
export const BROAD_RECESS_COLLAR=10;
// The proposed upper bound 295 touched route triangles at 2.05–2.333 seconds.
// Retreating only that boundary to 290 preserves every route-support triangle.
export const BROAD_RECESS_REGION=Object.freeze({minX:-235,maxX:-107,minZ:145,maxZ:290});
// An audited design budget, deliberately not a per-query curvature-restoring cap.
export const BROAD_RECESS_DEPTH_BUDGET=90;
export function broadRecessTargetHeight(x:number,z:number){
 const floor=187+2.1*(z-210);
 const eastWall=187+6*(x+150);
 const westWall=187-2*(x+180)+3*(z-210);
 return Math.max(floor,eastWall,westWall);
}
export function broadRecessPlaneCut(x:number,z:number,currentHeight:number,shoreDistance:number){
 const r=BROAD_RECESS_REGION;
 if(x<=r.minX||x>=r.maxX||z<=r.minZ||z>=r.maxZ||shoreDistance<=45)return 0;
 const removal=Math.max(0,currentHeight-broadRecessTargetHeight(x,z));
 if(removal===0)return 0;
 const distance=Math.min(x-r.minX,r.maxX-x,z-r.minZ,r.maxZ-z);
 const t=Math.min(1,distance/BROAD_RECESS_COLLAR),collar=t*t*(3-2*t);
 return removal*collar;
}
