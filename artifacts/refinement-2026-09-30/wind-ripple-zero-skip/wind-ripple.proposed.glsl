vec2 windRipple(vec2 p,float t,vec2 pixelDx,vec2 pixelDy,vec2 dir,
                float k,float slopeAmplitude,float phaseOffset){
 vec2 waveVector=dir*k;
 float phasePerPixel=max(abs(dot(waveVector,pixelDx)),abs(dot(waveVector,pixelDy)));
 float bandVisibility=1.-smoothstep(1.,3.,phasePerPixel);
 // A filtered wave still contributes surface roughness. Dropping its normal
 // without retaining this variance turns distant water into polished metal.
 unresolvedWaterSlopeVariance+=.5*slopeAmplitude*slopeAmplitude*(1.-bandVisibility*bandVisibility);
 if(bandVisibility==0.)return vec2(0.);
 float phase=dot(p,waveVector)-t*sqrt(9.81*k)+phaseOffset;
 return dir*(slopeAmplitude*bandVisibility*cos(phase));
}
