// Isolated CPU/GLSL study. Nothing under src imports this file.
// Derivatives are of the unwrapped phase, in radians per screen pixel.
export const RIPPLE_PASS_BAND=Math.PI/2;
export const RIPPLE_STOP_BAND=Math.PI;

export function sandRipplePhaseWeight(phaseDx,phaseDy){
 const width=Math.max(Math.abs(phaseDx),Math.abs(phaseDy));
 const t=Math.min(1,Math.max(0,(width-RIPPLE_PASS_BAND)/(RIPPLE_STOP_BAND-RIPPLE_PASS_BAND)));
 return 1-t*t*(3-2*t);
}

// GLSL smoothstep divides only by its two fixed, distinct bounds, never by a
// derivative. The L-infinity norm matches the screen's rectangular sample grid:
// either axis above Nyquist is rejected; diagonal frequencies are not mistaken
// for an axis-aligned frequency whose magnitude is their sum.
export const sandRipplePhaseWeightGLSL=`
float sandRipplePhaseWeight(float phase){
 vec2 phaseGradient=vec2(dFdx(phase),dFdy(phase));
 float frequency=max(abs(phaseGradient.x),abs(phaseGradient.y));
 return 1.-smoothstep(1.57079632679,3.14159265359,frequency);
}`;
