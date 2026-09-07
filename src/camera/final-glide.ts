import * as THREE from 'three';

/** Quintic Hermite motion in physical seconds. All six boundary conditions
 * are explicit; changing the preceding spline automatically refits the join.
 */
export function createFinalGlide(start:number,duration:number,position:THREE.Vector3,velocity:THREE.Vector3,acceleration:THREE.Vector3){
 const endPosition=new THREE.Vector3(85,5.8,-44);
 const endVelocity=new THREE.Vector3(-.38,0,-.92).normalize().multiplyScalar(5);
 const coefficients=position.toArray().map((p,i)=>{
  const c1=velocity.getComponent(i)*duration,c2=acceleration.getComponent(i)*duration*duration*.5;
  const remaining=endPosition.getComponent(i)-p-c1-c2;
  const speed=endVelocity.getComponent(i)*duration-c1-2*c2,curvature=-2*c2;
  return [p,c1,c2,10*remaining-4*speed+.5*curvature,-15*remaining+7*speed-curvature,6*remaining-3*speed+.5*curvature];
 });
 return (time:number,order:0|1|2=0)=>{
  const u=Math.max(0,Math.min(1,(time-start)/duration));
  const result=coefficients.map(c=>{
   let value=0;
   for(let k=5;k>=order;k--){let term=c[k];for(let j=0;j<order;j++)term*=k-j;value=value*u+term}
   return value/duration**order;
  });
  return new THREE.Vector3(result[0],result[1],result[2]);
 };
}
