/** Mean-sea-plane approximation for a reflection that hits neighbouring water.
 * This models one secondary bounce; it does not trace wave self-intersections.
 * Keep the sky probe's dark lower hemisphere for land/forest illumination.
 */
export const waterReflectionGLSL=`
vec4 neighbouringWaterReflection(vec3 ray){
 float cosine=max(-ray.y,0.);
 float reflectedFraction=.025+.975*pow(1.-cosine,5.);
 return vec4(ray.x,abs(ray.y),ray.z,reflectedFraction);
}
`;
