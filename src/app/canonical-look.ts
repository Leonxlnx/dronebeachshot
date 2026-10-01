/** Reviewed environment defaults. Capture mode keeps its explicit profile controls. */
export const canonicalLook={
 lighting:{
  sunIntensity:4.8,skyIntensity:.48,environmentIntensity:.55,exposure:1.08,
  sunColor:'#ffdfb6',skyColor:'#a1c9ed',groundColor:'#365842',
  fogDensity:.000065,cloudFogDensity:.00004,cloudCoverage:.4,cloudMorphology:true,
 },
 surfaceStudy:{grassPalette:1,sandChroma:1,sandRipple:.2,stoneBedding:1},
 islandDirectResponse:true,
 farCrownBlending:false,
 coastalReflection:true,
 coastalReflectionDistortion:1,
} as const;

export const canonicalIslandResponseManifest='/assets/studies/island-response/response-manifest.json';
