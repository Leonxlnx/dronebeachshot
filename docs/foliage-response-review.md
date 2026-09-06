# Foliage response proposal — source review, Three 0.185.1

Prepared 2026-09-05. This is a scratch integration candidate. No Site file was edited, no browser was run, and no GPU or scene appearance pass is claimed.

The recommended change is a continuous, world-directed bend field with an analytic normal correction, plus a small two-sided diffuse transmission term inside Three's existing direct-light evaluation. Preserve the existing LOD coverage code. Do not add an emissive glow or a second sun.

## Findings that affect integration

- Current wind bends only by height; the normal-offset flutter has no branch-scale coherence. The same bend must affect bark and leaves. A shared positional field achieves this without changing the imported geometry or leaf sizes.
- The imported assets do not provide branch IDs, branch pivots, petiole pivots, or stiffness attributes. The proposed branch response is a continuous approximation, not an articulated botanical rig. The millimeter-scale flutter is likewise an approximation; larger flutter would visibly distort the source leaves.
- Compute a single root-to-crown height from the complete, scaled **near asset** of each family and reuse its uniform across every primitive and every LOD. Do not use primitive bounds or independently normalize LODs. In particular, syringa's `14 / 4.556740965694189` scale is an anchor, **not a resulting 14 m height**; the actual crown is approximately 21.6 m. Do not change that scale here.
- Palm has a mixed bark/frond alpha-tested material. Alpha testing alone is insufficient to identify thin tissue. Set its leaf flutter and transmission to zero until the asset has a reliable leaf mask. Broadleaf masked leaf materials can enable these effects; their opaque bark cannot.
- Existing `localWindOffset` correctly handles the current orthogonal, nonuniform instance scales. Like Three's built-in instanced normal path, it does not support shear. Preserve the parent's world-space prevailing-wind lean fix.
- The existing weather oscillations use positive time and positive spatial phase. Such a traveling crest moves opposite the declared wind. The candidate below uses `root.xz - worldWind * time` for its gust field, without silently changing grass or other existing weather consumers. Modal branch oscillation may have its own time phase; that is not a transported weather feature.

## 1. Exact vegetation vertex replacement

Keep `weatherGLSL` and its existing `worldWind`, habitat lookup, and coordinate conversion. Replace `vertexUniforms` and `vertexDeform` with the following three constants. This avoids a second habitat lookup or a new weather dependency. All amplitudes below are world meters; `uTreeHeight` is measured before instance scaling.

```ts
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
  vec2 advected = root.xz - worldWind * uTime;
  float gust = 0.5 + 0.5 * sin(dot(advected, along2) * 0.20
              + 0.35 * sin(dot(advected, cross2) * 0.11));
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
```

This computes one displacement/Jacobian per vertex rather than evaluating the entire wind and habitat field several times for finite-difference normals. Its continuous field preserves mesh connectivity and source UVs. Root vertices at or below local Y=0 receive exactly zero displacement. At the current coefficients the simple worst-case offset bound is below 1.1 m for exposure ≤1.6 and h≤1.2; the existing +2 m bounding-sphere inflation covers this field. This bound does not cover future amplitude increases.

## 2. Exact thin-leaf direct-light wrapper

Add this fragment constant. It belongs after `lights_physical_pars_fragment`, where r185 has declared `PhysicalMaterial` and `RE_Direct_Physical`. It must not expand or replace `lights_fragment_begin`: the existing `withCloudLighting` wrapper owns that replacement.

```ts
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
```

Start `uLeafTransmission` at **0.18** on thin broadleaf materials and 0 elsewhere. This is a bounded Lambertian thin-sheet approximation: back-hemisphere incidence, color-dependent absorption, longer optical path at grazing angles, and a reserved direct diffuse fraction. It is not measured subsurface scattering or a fully energy-conserving combined direct/indirect leaf BSDF; existing hemisphere/IBL diffuse is unchanged. At zero transmission the standard direct-light result is unchanged. No view-dependent bright lobe, emissive term, scene-color refraction, or new render target is required.

Use the already shadowed `directLight.color`. The directional loop calls `getDirectionalLightInfo`, applies `atmosphericSunlight(vLightingWorld)` through `withCloudLighting`, applies the shadow map, then calls `RE_Direct`. The wrapper therefore respects cloud and tree occlusion once. It does not multiply `getShadowMask()` again and does not add an unshadowed sun term. This term also works with Three's shadowed point/spot direct loops; rect-area and indirect lighting remain unchanged.

## 3. Exact binding changes

Keep the current `fragmentUniforms`, `coverage`, material alpha/depth settings, and diagnostics. Replace `bind` with this function and add the response type. The light code is installed only on MeshStandardMaterial, never on the depth material.

```ts
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
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + coverage);
    if (lit) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_physical_pars_fragment>',
        '#include <lights_physical_pars_fragment>\n' + leafLighting);
    }
  };
  m.customProgramCacheKey = () => 'asset-wind-lod-v5-' + lod + (lit ? '-lit' : '-depth');
}
```

Change the preparation function signature to:

```ts
export function prepareTreeMaterial(
  source: THREE.MeshStandardMaterial, lod: number, response: TreeResponse
)
```

Inside it, replace both `bind(material,lod,material.alphaTest>0)` and `bind(depth,lod,material.alphaTest>0)` with `bind(material,lod,response)` and `bind(depth,lod,response)` respectively. Preserve `enableMaterialDiagnostics(material)` after the material bind. Preserve the later `withCloudLighting` call. A program-key revision is required to invalidate the old source; numeric height and leaf strengths are uniforms and do not require per-species programs.

The installed depth shader always executes `uv_vertex`, but its `beginnormal_vertex` is conditional on `USE_DISPLACEMENTMAP`. That is safe: `vertexSetup` and `treeOffset` are unconditional, and the normal correction only runs if Three declares `objectNormal`. The shared displacement uses no material normal map and does not rely on the optional `objectNormal`. In the color shader the correction precedes Three's `defaultnormal_vertex`, so the normal then receives the standard instance/model inverse-transpose transform and feeds normal maps and shadow normal bias normally. These imported trees are static meshes without morphing, skinning, or displacement maps; moving such operations after this custom bend would require a separate ordering review.

## 4. Exact loader connection for shared family height

In `createVegetation`, immediately after `const parts:Part[][]=[];`, add:

```ts
const treeHeights = [{value:1}, {value:1}, {value:1}];
```

Inside the asset loop before `gltf.scene.traverse`, add:

```ts
const familyIndex = index === 8 ? 2 : index >= 4 ? 1 : 0;
const heightUniform = treeHeights[familyIndex];
const isHeightSource = index === 0 || index === 4 || index === 8;
let crownY = 0;
```

After the existing `geometry.scale(scale,scale,scale);`, replace the old preparation call with:

```ts
if (isHeightSource) {
  geometry.computeBoundingBox();
  crownY = Math.max(crownY, geometry.boundingBox!.max.y);
}
const response = {
  height: heightUniform,
  thinLeaf: index !== 8 && object.material.alphaTest > 0
};
const {material,depth} = prepareTreeMaterial(
  object.material, index === 8 ? -1 : index % 4, response);
```

Immediately after the traversal, before `parts.push(primitives)`, add:

```ts
if (isHeightSource) {
  if (!(crownY > 0)) throw Error('Missing root-relative tree crown height');
  heightUniform.value = crownY;
}
```

Every material receives the same live family uniform object before compilation, including materials constructed earlier in the traversal. Source root remains `[0,0,0]`. This derives height from the union of near primitives, not from a bark or leaf primitive individually. It does not translate, rescale, or edit any geometry.

## Integration checks and remaining limits

- Color and custom depth use identical position code, `worldTime`, habitat, family height, leaf classification, instance transforms, and `lodCamera`. Keep the main camera in `lodCamera` during shadow/refraction renders. If point-light shadows are introduced, the same bind must also be applied to a custom distance material.
- Keep current alpha map/base-map alpha, alpha cutoff, and double-sided flags. No generated opacity or RGB-derived cutout is needed. Millimeter flutter preserves original UV coordinates.
- Existing screen-space LOD dither is complementary between color LODs, but shadow and color passes have different `gl_FragCoord` lattices. This candidate guarantees matching displacement, not identical pixel coverage between cameras. Do not misreport that existing dither limitation as fixed.
- `withCloudLighting` derives its world position from `transformed` after the bend, so atmospheric shadow projection tracks moved foliage. The direct wrapper leaves the light-loop include intact for that hook. Its added diffuse light is composed before `opaque_fragment`, scene capture scaling, tone mapping, and output color conversion.
- Diagnostics continue to override albedo, normals, roughness, depth, shadow/cloud visibility, and LOD as before. Normal debug should now show bending normals; albedo and shadow diagnostics should not show the new backlight. The existing HDR debug can reveal excessive leaf radiance before tone mapping. Do not add scattering after diagnostics.
- The positional field has no topology-aware attachments. Nearby bark and leaf vertices share branch motion; their tiny leaf-only flutter may move petioles by a few millimeters. True petiole rotation and species-specific branch stiffness need authored data. Far baked cards may show subtly different motion from individual leaves even with the same field.
- The proposed analytic Jacobian adds per-vertex trigonometry, especially on the two expensive near assets. It avoids repeated texture sampling but still requires an actual performance check in the scene. Do not increase near allocation merely because this source review is complete.
- Required visible follow-up belongs to the root: compile color/depth variants, check a near crown and branch junction against prevailing wind, inspect normal and shadow diagnostics, examine sun-facing/backlit/sun-occluded leaves at the same exposure, and measure performance. **No visual acceptance is asserted by this document.**

## Installed primary sources inspected

Project files: `src/render/vegetation-material.ts`, `src/world/weather.ts`, `src/world/vegetation.ts`, `src/render/sky-lighting.ts`, `src/render/diagnostics.ts`, `src/world/habitat.ts`, and the scene light configuration. Shader reference is the project's installed `three` package **0.185.1**, not a remembered older Three API.

All source paths below are relative to `/workspace/sites/last-light-bay/node_modules/three/`:

| Primary source | Relevant contract |
|---|---|
| `src/renderers/shaders/ShaderLib/meshphysical.glsl.js` | Normal computation precedes `begin_vertex`; physical light declaration precedes the light loop; output stages follow lighting. |
| `src/renderers/shaders/ShaderLib/depth.glsl.js` | Unconditional UV/begin/project vertex stages; conditional normal declaration; stock alpha-map/test chunks. |
| `src/renderers/shaders/ShaderChunk/lights_physical_pars_fragment.glsl.js` | r185 `PhysicalMaterial.diffuseContribution`, seven-argument `RE_Direct_Physical`, and `RE_Direct` macro. |
| `src/renderers/shaders/ShaderChunk/lights_physical_fragment.glsl.js` | Linear sampled base color populates diffuse fields; standard dielectric specular setup. |
| `src/renderers/shaders/ShaderChunk/lights_fragment_begin.glsl.js` | View-space light/normal directions; shadow attenuation occurs before `RE_Direct`. |
| `src/renderers/shaders/ShaderChunk/normal_fragment_begin.glsl.js` | `DOUBLE_SIDED` already applies `faceDirection`; do not flip again. |
| `src/renderers/shaders/ShaderChunk/defaultnormal_vertex.glsl.js` | Instanced nonuniform-scale normal handling; explicit no-shear assumption. |
| `src/renderers/shaders/ShaderChunk/shadowmap_vertex.glsl.js` | Displaced world position and transformed normal feed normal-biased shadow coordinates. |
| `src/renderers/shaders/ShaderChunk/project_vertex.glsl.js` | Instance/model/view transform ordering. |
| `src/renderers/webgl/WebGLProgram.js` | Built-in normal attribute and GLSL 300 ES conversion. |

The companion `foliage-response-source-check.mjs` executed the exact proposal constants/bind code against installed Three shader templates and the current diagnostics/cloud hooks: **22 source-composition assertions passed**. It checks injection order, shared height/displacement, alpha/coverage retention, the light wrapper, cloud/diagnostic/capture hooks, and resolution of every referenced Three chunk. Its JSON report records source SHA-256 hashes. This is not a GLSL compiler or numerical Jacobian test. `glslangValidator` is not installed; GPU compilation and scene appearance remain unverified.
