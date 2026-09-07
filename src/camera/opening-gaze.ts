import type {Vector3} from 'three';

type CameraPose = {position:Vector3,target:Vector3,fov:number,bank:number};
const blendBetween=(start:number,end:number,time:number)=>{
 const u=Math.max(0,Math.min(1,(time-start)/(end-start)));
 return u*u*u*(10+u*(-15+6*u));
};
const softPlus=(x:number)=>Math.log1p(Math.exp(30*x))/30;

/** Keep the descending forest in view before the gradual bay reveal.
 * This changes gaze only. It does not establish a closer flight corridor.
 */
export function withOpeningGaze<T extends CameraPose>(pose:T,time:number,positionAt:(t:number)=>Vector3):T{
 const blend=blendBetween(.25,1.5,time)*(1-blendBetween(4.5,9.5,time));
 if(blend===0)return pose;
 const offset=pose.target.clone().sub(pose.position);
 const horizontal=Math.hypot(offset.x,offset.z);
 const pitch=Math.atan2(-offset.y,horizontal);
 const velocity=positionAt(Math.min(20,time+.6)).sub(positionAt(Math.max(0,time-.2)));
 const flightPitch=Math.atan2(-velocity.y,Math.hypot(velocity.x,velocity.z));
 const uncapped=pitch+softPlus(flightPitch+4*Math.PI/180-pitch);
 const desired=70*Math.PI/180-softPlus(70*Math.PI/180-uncapped);
 const nextPitch=pitch+(desired-pitch)*blend;
 const direction=offset.clone().set(offset.x/horizontal*Math.cos(nextPitch),-Math.sin(nextPitch),offset.z/horizontal*Math.cos(nextPitch));
 return {...pose,target:pose.position.clone().addScaledVector(direction,offset.length())};
}
