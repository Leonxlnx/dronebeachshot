type V3=readonly[number,number,number];

/** A compact, variance-matched box is the inspection filter, not an exact
 * microfacet distribution. Return its positive fraction and conditional mean. */
export function positiveBox(center:number,halfWidth:number):[number,number]{
 if(halfWidth===0)return [center>0?1:0,Math.max(center,0)];
 const fraction=.5+.5*Math.max(-halfWidth,Math.min(halfWidth,center))/halfWidth;
 return [fraction,center>=halfWidth?center:Math.max(center+halfWidth,0)*.5];
}

/** Integrate a uniform footprint against the finite capture interval. */
export function captureBox(center:number,halfWidth:number):[number,number]{
 if(halfWidth===0)return [center>=0&&center<=1?1:0,Math.max(0,Math.min(1,center))];
 const low=Math.max(0,center-halfWidth),high=Math.min(1,center+halfWidth);
 return [Math.max(0,Math.min(1,(high-low)/(2*halfWidth))),high>low?(low+high)*.5:Math.max(0,Math.min(1,center))];
}

/** Phase-independent second-moment bound for box mip texels plus bilinear
 * interpolation, continuously mixed across the selected trilinear levels. */
export function reconstructionVariance(size:number,lod:number){
 const level=Math.floor(lod),fraction=lod-level;
 const lower=Math.max(1,Math.floor(size/2**level)),upper=Math.max(1,Math.floor(size/2**(level+1)));
 return (1-fraction)/(3*lower*lower)+fraction/(3*upper*upper);
}

/** Diameter of the principal axis of the same moment-matched footprint. */
export function footprintWidth(variance:readonly[number,number],cross:number,resolution:readonly[number,number]){
 const a=variance[0]*resolution[0]**2,b=variance[1]*resolution[1]**2;
 const limit=Math.sqrt(Math.max(a*b,0)),c=Math.max(-limit,Math.min(limit,cross*resolution[0]*resolution[1]));
 const largest=.5*(a+b+Math.hypot(a-b,2*c));
 return 2*Math.sqrt(3*Math.max(largest,0));
}

/** Pixel-box covariance plus an isotropic reflected-angle approximation.
 * The scalar ocean variance cannot recover the original directional spectrum.
 * It is not a bound on every possible directional distribution. */
export function positiveRayFootprint(ray:V3,dx:V3,dy:V3,slopeVariance:number){
 const angular=2*Math.max(slopeVariance,0);
 const covarianceY=ray.map((r,i)=>(dx[i]*dx[1]+dy[i]*dy[1])/12+angular*((i===1?1:0)-r*ray[1]));
 const variance=Math.max(covarianceY[1],0);
 const [coverage,mean]=positiveBox(ray[1],Math.sqrt(3*variance));
 const representative=ray.map((r,i)=>r+(variance>0?covarianceY[i]*(mean-ray[1])/variance:0));
 representative[1]=Math.max(0,representative[1]);
 const length=Math.hypot(...representative);
 return {coverage,mean,variance,covarianceY,ray:length>0?representative.map(v=>v/length):[1,0,0]};
}

export const coastalReflectionFilterGLSL=`
float coastalFootprintWidth(vec2 variance,float crossTerm,vec2 resolution){
 vec2 diagonal=variance*resolution*resolution;
 float limit=sqrt(max(diagonal.x*diagonal.y,0.));
 float crossPixel=clamp(crossTerm*resolution.x*resolution.y,-limit,limit);
 float largest=.5*(diagonal.x+diagonal.y+length(vec2(diagonal.x-diagonal.y,2.*crossPixel)));
 return 2.*sqrt(3.*max(largest,0.));
}
vec2 coastalPositiveBox(float center,float halfWidth){
 if(halfWidth==0.)return vec2(center>0.?1.:0.,max(center,0.));
 float fraction=.5+.5*clamp(center,-halfWidth,halfWidth)/halfWidth;
 return vec2(fraction,center>=halfWidth?center:max(center+halfWidth,0.)*.5);
}
vec2 coastalCaptureBox(float center,float halfWidth){
 if(halfWidth==0.)return vec2(center>=0.&&center<=1.?1.:0.,clamp(center,0.,1.));
 float low=max(0.,center-halfWidth),high=min(1.,center+halfWidth);
 return vec2(clamp((high-low)/(2.*halfWidth),0.,1.),high>low?(low+high)*.5:clamp(center,0.,1.));
}
vec4 coastalPositiveRay(vec3 ray,vec3 dx,vec3 dy,float slopeVariance){
 // A pixel box has variance 1/12. The unresolved model assigns 2*S to each
 // reflected tangent axis. Scalar S cannot recover the directional spectrum;
 // this is an isotropic approximation, not a guaranteed covariance bound.
 vec3 covarianceY=(dx*dx.y+dy*dy.y)/12.
  +2.*max(slopeVariance,0.)*(vec3(0.,1.,0.)-ray*ray.y);
 float variance=max(covarianceY.y,0.);
 vec2 support=coastalPositiveBox(ray.y,sqrt(3.*variance));
 vec3 representative=ray;
 if(variance>0.)representative+=covarianceY*((support.y-ray.y)/variance);
 // Zero-coverage rays also use a nonnegative dummy representative, so no
 // below-water geometry projection is evaluated or extrapolated.
 representative.y=max(representative.y,0.);
 float magnitude=length(representative);
 representative=magnitude>0.?representative/magnitude:vec3(1.,0.,0.);
 return vec4(representative,support.x);
}
`;
