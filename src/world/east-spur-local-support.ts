import {EAST_SPUR_SUPPORT_REGION} from './east-spur';
import {renderedTerrainHeight as currentHeight,renderedTerrainHeightBeforePrincipalFace as referenceHeight} from './terrain-surface';

/** Conservative complete-footprint contact: include every 2 m triangle vertex
 * underlying the X/Z box, including an unchanged centre crossing a changed cell.
 */
export function eastSpurTouchesBounds(minX:number,maxX:number,minZ:number,maxZ:number){
 const r=EAST_SPUR_SUPPORT_REGION;
 if(maxX<r.minX-2||minX>r.maxX+2||maxZ<r.minZ-2||minZ>r.maxZ+2)return false;
 for(let z=Math.floor(minZ/2)*2;z<=Math.ceil(maxZ/2)*2;z+=2)
  for(let x=Math.floor(minX/2)*2;x<=Math.ceil(maxX/2)*2;x+=2)
   if(currentHeight(x,z)!==referenceHeight(x,z))return true;
 return false;
}
export function currentTriangleSlope(x:number,z:number){
 const x0=Math.floor(x/2)*2,z0=Math.floor(z/2)*2,a=currentHeight(x0,z0),b=currentHeight(x0+2,z0),c=currentHeight(x0,z0+2),d=currentHeight(x0+2,z0+2);
 return x-x0+z-z0<=2?Math.hypot(b-a,c-a)/2:Math.hypot(d-c,d-b)/2;
}
