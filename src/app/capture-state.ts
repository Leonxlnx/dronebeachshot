import {DURATION} from '../camera/cinematic.ts';

/** URL parameters and external capture callers must never send NaN into a shader. */
export function timelineTime(value:number):number {
 return Number.isFinite(value)?Math.max(0,Math.min(DURATION,value)):0;
}

export function captureDimensions(width:number,height:number,maximum:number):void {
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>maximum||height>maximum) {
  throw new RangeError('Capture dimensions must be positive integers within the graphics limit');
 }
}
