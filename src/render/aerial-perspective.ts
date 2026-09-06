import * as THREE from 'three';

// Shared scene-linear radiance fit. The same directional sky colors illuminate
// visible air, distant land and the ocean; this is an artistic scattering model.
export const aerialPerspectiveGLSL=`
vec3 bayClearSky(vec3 ray,vec3 sun){
 float h=max(ray.y,0.);
 vec2 horizontalRay=ray.xz/max(length(ray.xz),.0001);
 float solarHorizon=pow(max(dot(horizontalRay,normalize(sun.xz)),0.),4.);
 vec3 horizon=mix(vec3(.30,.36,.43),vec3(.72,.40,.19),solarHorizon);
 vec3 radiance=mix(horizon,vec3(.065,.13,.23),pow(smoothstep(0.,.8,h),.42));
 return radiance+vec3(.26,.16,.075)*pow(max(dot(ray,sun),0.),12.)*exp(-h*3.);
}
vec3 bayAerialPerspective(vec3 radiance,vec3 origin,vec3 point,vec3 sun,float extinction){
 vec3 ray=point-origin;float distanceToEye=length(ray);
 ray/=max(distanceToEye,.001);
 float cameraHeight=max(origin.y,0.),pointHeight=max(point.y,0.);
 float delta=(pointHeight-cameraHeight)/850.;
 float averageDensity=abs(delta)<.001?1.-delta*.5:(1.-exp(-delta))/delta;
 averageDensity*=exp(-cameraHeight/850.);
 float opacity=1.-exp(-extinction*distanceToEye*averageDensity);
 return mix(radiance,bayClearSky(ray,sun),opacity);
}
`;

/** Apply after withCloudLighting, which supplies the world position and sun. */
export function withAerialPerspective(material:THREE.MeshStandardMaterial){
 const prior=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey();
 material.onBeforeCompile=(shader,renderer)=>{
  prior(shader,renderer);
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>','#include <common>\n'+aerialPerspectiveGLSL)
   .replace('#include <fog_fragment>','')
   .replace('#include <tonemapping_fragment>',`
    #if defined(USE_FOG) && defined(FOG_EXP2)
     // Respect the refraction pass setting fogDensity=0. Mix radiance before
     // display tone mapping, and preserve that pass's HDR storage scale.
     gl_FragColor.rgb=bayAerialPerspective(gl_FragColor.rgb/uSceneCaptureScale,
      cameraPosition,vLightingWorld,uSolarDirection,fogDensity)*uSceneCaptureScale;
    #endif
    #include <tonemapping_fragment>`);
 };
 material.customProgramCacheKey=()=>key+'-height-aerial-v1';
}
