import * as THREE from 'three';
import {alphaWeightedColorTexture,bindAlphaWeightedColor} from './alpha-weighted-color';
import {worldTime} from './materials';
import {enableMaterialDiagnostics} from './diagnostics';
import {weatherGLSL} from '../world/weather';
import {habitatUniform} from '../world/habitat';
import {lodRanges,type QualityTier} from '../world/lod';
export const lodCamera={value:new THREE.Vector3()};
// Far crown atlases contain the union of overlapping leaves, so multisampled
// color buffers can resolve their fractional area. Near layered leaf cards keep
// alpha hashing: shared A2C sample masks otherwise lose coverage through overlap.
// Shadow maps remain single-sample and keep alpha hashing in both cases.
let multisampledFoliage=false;
export function setFoliageMultisampling(enabled:boolean){multisampledFoliage=enabled}
const ranges={value:new THREE.Vector4(...lodRanges.balanced.slice(2) as [number,number,number,number])};
const heroRange={value:new THREE.Vector2(...lodRanges.balanced.slice(0,2) as [number,number])};
const forcedLod={value:-1};
export function setVegetationQuality(tier:QualityTier){ranges.value.set(...lodRanges[tier].slice(2) as [number,number,number,number]);heroRange.value.set(...lodRanges[tier].slice(0,2) as [number,number]);forcedLod.value=tier==='low'?3:-1}
const vertexUniforms = /* glsl */ `
uniform float uTime, uLeafMotion, uTreeHeight;
uniform vec3 uLodCamera;
varying float vTreeDistance;
${weatherGLSL}

vec3 treePhaseGradient(vec3 k, mat4 worldTransform) {
  return vec3(dot(k, worldTransform[0].xyz),
              dot(k, worldTransform[1].xyz),
              dot(k, worldTransform[2].xyz));
}

void treeWindFrame(vec3 p, mat4 worldTransform,
                   out vec3 localOffset, out mat3 localJacobian) {
  vec3 root = worldTransform[3].xyz;
  vec3 relativeWorld = (worldTransform * vec4(p, 0.0)).xyz;
  vec2 along2 = normalize(worldWind);
  vec2 cross2 = vec2(-along2.y, along2.x);
  vec3 along = vec3(along2.x, 0.0, along2.y);
  vec3 across = vec3(cross2.x, 0.0, cross2.y);

  float exposure = mix(0.35, 1.6, habitatAt(root.xz).r);
  float gust = regionalWindGust(root.xz,uTime);
  float seed = dot(root.xz, vec2(0.071, 0.113));

  float height = max(uTreeHeight, 0.1);
  float rawH = p.y / height;
  float h = clamp(rawH, 0.0, 1.2);
  float dh = (rawH > 0.0 && rawH < 1.2) ? 1.0 / height : 0.0;
  float bend = h * h;
  vec3 gBend = vec3(0.0, 2.0 * h * dh, 0.0);

  // Root and central stem are stiff; distal crown branches respond together.
  float r2 = dot(p.xz, p.xz) / (height * height);
  float radial = r2 / (r2 + 0.0324);
  vec3 gRadial = vec3(p.x, 0.0, p.z) *
    (2.0 * 0.0324 / (height * height * pow(r2 + 0.0324, 2.0)));
  float branch = bend * radial;
  vec3 gBranch = gBend * radial + bend * gRadial;

  vec3 bulk = exposure * (
    along * (0.16 + 0.12 * gust + 0.06 * sin(uTime * 0.87 + seed)) +
    across * (0.035 * sin(uTime * 0.69 + seed * 1.41)));

  vec3 kA = along * 0.80 + across * 0.31 + vec3(0.0, 0.37, 0.0);
  vec3 kB = along * 0.37 - across * 0.67 + vec3(0.0, 0.29, 0.0);
  float a = dot(relativeWorld, kA) + seed + uTime * 1.80;
  float b = dot(relativeWorld, kB) + seed * 1.37 + uTime * 1.27;
  vec3 branchA = along * (0.070 * exposure * (0.55 + 0.45 * gust));
  vec3 branchB = across * (0.045 * exposure * (0.55 + 0.45 * gust));
  vec3 gA = gBranch * sin(a) + branch * cos(a) * treePhaseGradient(kA, worldTransform);
  vec3 gB = gBranch * sin(b) + branch * cos(b) * treePhaseGradient(kB, worldTransform);

  // Continuous small-scale flutter. No quantized per-vertex random offsets.
  // The maximum oscillatory coefficient is 3.5 mm before exposure/crown masks.
  vec3 kF = along * 2.10 + across * 1.30 + vec3(0.0, 1.70, 0.0);
  vec3 kG = along * 1.40 - across * 1.90 + vec3(0.0, 2.20, 0.0);
  float f = dot(relativeWorld, kF) + seed + uTime * 15.7;
  float g = dot(relativeWorld, kG) + seed * 1.73 + uTime * 22.9;
  float flutterWave = 0.7 * sin(f) + 0.3 * sin(g);
  vec3 gFlutterWave = 0.7 * cos(f) * treePhaseGradient(kF, worldTransform)
                   + 0.3 * cos(g) * treePhaseGradient(kG, worldTransform);
  vec3 flutterAxis = normalize(across + vec3(0.0, 0.2, 0.0));
  float flutterAmplitude = 0.0035 * uLeafMotion * exposure * (0.4 + 0.6 * gust);
  vec3 gFlutter = gBranch * flutterWave + branch * gFlutterWave;

  vec3 worldOffset = bulk * bend
    + branch * (branchA * sin(a) + branchB * sin(b))
    + flutterAxis * (flutterAmplitude * branch * flutterWave);
  vec3 dx = bulk * gBend.x + branchA * gA.x + branchB * gB.x
          + flutterAxis * (flutterAmplitude * gFlutter.x);
  vec3 dy = bulk * gBend.y + branchA * gA.y + branchB * gB.y
          + flutterAxis * (flutterAmplitude * gFlutter.y);
  vec3 dz = bulk * gBend.z + branchA * gA.z + branchB * gB.z
          + flutterAxis * (flutterAmplitude * gFlutter.z);

  localOffset = localWindOffset(worldOffset, worldTransform);
  localJacobian = mat3(
    vec3(1.0, 0.0, 0.0) + localWindOffset(dx, worldTransform),
    vec3(0.0, 1.0, 0.0) + localWindOffset(dy, worldTransform),
    vec3(0.0, 0.0, 1.0) + localWindOffset(dz, worldTransform));
}
`;

// Inject immediately after uv_vertex, before Three computes object normals.
const vertexSetup = /* glsl */ `
mat4 treeWorld = modelMatrix;
#ifdef USE_INSTANCING
  treeWorld = modelMatrix * instanceMatrix;
#endif
vTreeDistance = length(treeWorld[3].xyz - uLodCamera);
vec3 treeOffset;
mat3 treeJacobian;
treeWindFrame(position, treeWorld, treeOffset, treeJacobian);
`;

// Cofactor(J) * normal is det(J) * inverse-transpose(J) * normal.
// Small, orientation-preserving bends permit normalization without a division.
const vertexNormal = /* glsl */ `
objectNormal = normalize(
    cross(treeJacobian[1], treeJacobian[2]) * objectNormal.x
  + cross(treeJacobian[2], treeJacobian[0]) * objectNormal.y
  + cross(treeJacobian[0], treeJacobian[1]) * objectNormal.z);
#ifdef USE_TANGENT
  objectTangent = normalize(treeJacobian * objectTangent);
#endif
`;
const leafLighting = /* glsl */ `
uniform float uLeafTransmission;

void RE_Direct_Foliage(
  const in IncidentLight directLight,
  const in vec3 geometryPosition,
  const in vec3 geometryNormal,
  const in vec3 geometryViewDir,
  const in vec3 geometryClearcoatNormal,
  const in PhysicalMaterial material,
  inout ReflectedLight reflectedLight
) {
  float transmission = clamp(uLeafTransmission, 0.0, 0.25);
  PhysicalMaterial surface = material;
  // Reserve part of the direct diffuse budget; leave the GGX specular unchanged.
  surface.diffuseContribution *= 1.0 - transmission;
  RE_Direct_Physical(directLight, geometryPosition, geometryNormal,
    geometryViewDir, geometryClearcoatNormal, surface, reflectedLight);

  // Three has already oriented double-sided normals toward the visible side.
  float backCosine = max(-dot(geometryNormal, directLight.direction), 0.0);
  // Albedo-derived absorption is a restrained proxy, not measured leaf optics.
  // Longer grazing paths absorb more; cap that path near the tangent singularity.
  vec3 absorptionProxy = clamp(material.diffuseContribution, vec3(0.02), vec3(0.95));
  vec3 transmittance = pow(absorptionProxy, vec3(0.55 / max(backCosine, 0.25)));
  reflectedLight.directDiffuse += directLight.color * RECIPROCAL_PI
    * backCosine * transmission * transmittance;
}

#undef RE_Direct
#define RE_Direct RE_Direct_Foliage
`;
// Preserve alpha area after minification. A mip texel is fractional coverage,
// not a new binary silhouette; testing its average against .45 erases thin leaves.
// Stock Three alphaHash applies the same position/derivative-based coverage rule
// in color and custom depth, including render targets with no MSAA samples.
const leafAlphaCoverage = /* glsl */ `
#ifdef USE_ALPHATEST
  float leafRawAlpha = diffuseColor.a;
  float leafEdgeWidth = max(fwidth(leafRawAlpha), 0.00001);
  float leafCoverage = smoothstep(alphaTest - 0.5 * leafEdgeWidth,
    alphaTest + 0.5 * leafEdgeWidth, leafRawAlpha);
  #ifdef USE_MAP
    vec2 leafTextureSize = vec2(textureSize(map, 0));
    float leafFootprint = max(length(dFdx(vMapUv) * leafTextureSize),
      length(dFdy(vMapUv) * leafTextureSize));
    float leafMinification = smoothstep(1.0, 8.0, leafFootprint);
    leafCoverage = mix(leafCoverage, leafRawAlpha, leafMinification);
  #endif
  diffuseColor.a = leafCoverage;
  if (diffuseColor.a <= 0.0) discard;
#endif
`;
const fragmentUniforms=`uniform vec4 uLodRanges;uniform vec2 uHeroRange;uniform float uLodIndex,uForcedLod;varying float vTreeDistance;`;
const coverage=`
if(uLodIndex>=0.){
 if(uForcedLod>=0.){if(abs(uLodIndex-uForcedLod)>.1)discard;}
 else{
 float heroFade=smoothstep(uHeroRange.x,uHeroRange.y,vTreeDistance);
 float nearFade=smoothstep(uLodRanges.x,uLodRanges.y,vTreeDistance);
 float farFade=smoothstep(uLodRanges.z,uLodRanges.w,vTreeDistance);
 // Static screen-space threshold. Complementary intervals avoid transparent double-lighting.
 float threshold=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
 if(uLodIndex<.5&&threshold>=1.-heroFade)discard;
 if(uLodIndex>.5&&uLodIndex<1.5&&(threshold<1.-heroFade||threshold>=1.-nearFade))discard;
 if(uLodIndex>1.5&&uLodIndex<2.5&&(threshold<1.-nearFade||threshold>=1.-farFade))discard;
 if(uLodIndex>2.5&&threshold<1.-farFade)discard;
 }
}
`;
type TreeResponse = {
  height: { value: number };
  thinLeaf: boolean;
};

function bind(m: THREE.Material, lod: number, response: TreeResponse) {
  const lit = m instanceof THREE.MeshStandardMaterial;
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      uLeafMotion: { value: response.thinLeaf ? 1 : 0 },
      uTreeHeight: response.height,
      uLeafTransmission: { value: response.thinLeaf ? 0.18 : 0 },
      uHeroRange: heroRange, uHabitat: habitatUniform,
      uTime: worldTime, uLodCamera: lodCamera, uLodRanges: ranges,
      uForcedLod: forcedLod, uLodIndex: { value: lod }
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + vertexUniforms)
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n' + vertexSetup)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + vertexNormal)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += treeOffset;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + fragmentUniforms)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + coverage)
      .replace('#include <alphatest_fragment>', leafAlphaCoverage);
    if (lit) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_physical_pars_fragment>',
        '#include <lights_physical_pars_fragment>\n' + leafLighting);
    }
  };
  m.customProgramCacheKey = () => 'asset-wind-lod-v6-filtered-alpha-' + lod + (lit ? '-lit' : '-depth');
}
export function prepareTreeMaterial(source:THREE.MeshStandardMaterial,lod:number,response:TreeResponse){const material=source.clone();if(material.alphaTest>0&&material.map)material.map=alphaWeightedColorTexture(material.map);material.roughness=Math.max(material.roughness,.75);material.metalness=0;if(material.map)material.map.anisotropy=4;if(material.alphaTest>0){material.alphaTest=Math.max(material.alphaTest,.4);material.alphaToCoverage=multisampledFoliage&&lod===3;material.alphaHash=!material.alphaToCoverage;material.side=THREE.DoubleSide;material.forceSinglePass=true}material.userData.lod=Math.max(0,lod);bind(material,lod,response);enableMaterialDiagnostics(material);const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:material.map,alphaMap:material.alphaMap,alphaTest:material.alphaTest,side:material.side});depth.alphaHash=material.alphaTest>0;bind(depth,lod,response);bindAlphaWeightedColor(material);bindAlphaWeightedColor(depth);return {material,depth}}
