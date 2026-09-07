// The production water normal uses a 0.2 m central-difference stencil.
// Preserve amplitude gradients while filtering only oscillating wave phase.
export const waterSlopeFilterGLSL=`
float waterBandVisibility(vec2 waveVector,vec2 pixelDx,vec2 pixelDy){
 float phasePerPixel=max(abs(dot(waveVector,pixelDx)),abs(dot(waveVector,pixelDy)));
 return 1.-smoothstep(1.,3.,phasePerPixel);
}
// Stencil order: +x, -x, +z, -z. D(A*q) = D(A)*mean(q)+mean(A)*D(q).
vec2 filteredPhaseCorrection(vec4 phase,vec4 amplitude,float visibility,
 bool cosine,inout float variance){
 vec2 meanAmplitude=.5*vec2(amplitude.x+amplitude.y,amplitude.z+amplitude.w);
 vec4 s=sin(phase),c=cos(phase);
 vec2 ds=meanAmplitude*vec2(s.x-s.y,s.z-s.w)/.4;
 vec2 dc=meanAmplitude*vec2(c.x-c.y,c.z-c.w)/.4;
 variance+=.5*(dot(ds,ds)+dot(dc,dc))*(1.-visibility*visibility);
 return (visibility-1.)*(cosine?dc:ds);
}
`;
