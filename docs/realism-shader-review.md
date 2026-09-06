# Realism shader review

Bounded read-only review of the latest ground materials, habitat field, refraction scale, sky-lighting wrapper and vegetation material composition, including the completed four-LOD wiring visible at the end of the review. No Site edits, browser or GPU rendering were performed. CPU shader assembly and numerical source checks were used where useful.

## Remaining concrete finding

### P2 — Static exposed-tree lean rotates with random tree yaw

**File:** `src/world/vegetation.ts`, instance transform construction.

The animated displacement in `vegetation-material.ts` is correctly specified in world space, but the static lean uses `Euler(lean*.24, p.angle, -lean*.97)`. Combining tilt and random yaw in that Euler rotation changes the world-space tilt direction. A CPU check of 360 yaw values at lean=0.04 found 173 projected trunk tilts opposing the prevailing `(1.6,0.4)` wind. This defeats the intended common exposure-driven lean on exposed trees while their animated branches bend in the common wind direction.

**Minimal fix:** construct the random yaw quaternion first, then premultiply a world-space tilt quaternion whose target up vector leans toward the prevailing wind. Keep natural random lean as a separate smaller variation if desired.

## Placement defect found and corrected during this review

The initial `treePlacements()` snapshot used analytic `terrainHeight` rather than the actual rendered triangle interpolation. Among 8,500 placements, 443 root positions were more than 0.10 m above rendered terrain, with a maximum 2.041 m; 197 were more than 0.30 m below it, with a minimum -1.253 m. These were CPU comparisons against `renderedTerrainHeight`, not observations from a frame.

Root changed tree placement, ground cover, logs, root tubes, litter and seedlings to use `renderedTerrainHeight` while this audit was active. The latest inspected source uses the shared function for these contact positions and the litter normal samples. The originally reported analytic-vs-triangle mismatch is therefore addressed in source. Rendered contact acceptance remains separate.

## Shader composition and sampler budget

I assembled `createGroundMaterial` and `createRockMaterial` with the current diagnostics and cloud-lighting hooks against the installed `THREE.ShaderLib.standard` source. No duplicate custom uniform declarations were found. Ground/ARM values are declared before roughness and normal use. `uSceneCaptureScale` multiplication is inserted after opaque color output and before diagnostic overrides. The world-lighting varying and `atmosphericSunlight` definition are supplied before the diagnostics use them.

The ground material's HDR, environment-lit, one-PCF-shadow configuration uses **16 active fragment samplers**:

| Source | Samplers |
| --- | ---: |
| Rock, sand, soil, moss: color + normal + ARM | 12 |
| Habitat | 1 |
| Cloud shadow | 1 |
| PMREM environment | 1 |
| Directional PCF shadow | 1 |
| Total | 16 |

This fits WebGL2's minimum fragment texture-unit budget exactly, with no spare sampler. It is a capacity constraint, not a current over-budget finding. Adding another texture-backed feature to this material requires packing/reuse or a quality fallback. The shared canopy alpha update correctly reuses the existing habitat sampler.

`createRockMaterial` declares habitat helpers but does not call `habitatAt`; that sampler is unused in its current shader call graph. The cloud shaders inherit habitat declarations through `weatherGLSL` but only use the wind constant, so the habitat sampling function is likewise outside their executed call graph.

## Habitat placement and swatch consistency

- The CPU bilinear sampler uses the same texel-center convention, clamp-to-edge behavior and normalized byte values as the GLSL texture sampler. Exposure, moisture and soil therefore come from the same stored field used by placement and wind; no independent CPU/GPU noise reproduction is required for those channels.
- The latest `habitatTexture` owns a copy of the CPU data. `updateHabitatCanopy` changes only GPU alpha and flags `needsUpdate`, preserving deterministic CPU ecology probabilities.
- After that update, CPU `habitatAt(...).canopy` means the original placement-density field, whereas GPU `habitatAt(...).a` means accumulated coverage from placed-tree circles. This difference is intentional in the latest code and should remain explicit in names/diagnostic descriptions.
- The new coverage swatch represents a family-radius approximation at 6.25 m × 8.33 m texel spacing, not a rasterization of leaf/crown geometry. It is suitable as a coarse coverage diagnostic; it should not be described as exact canopy occupancy.

## HDR offscreen state and four-LOD integration

- The opaque refraction pass now encodes byte-target RGB with `sceneCaptureScale=1/4`, and water decodes with `uUnderDecodeScale=4`. Standard meshes are wrapped with the matching output scale; the visible sky shader also receives it. Fog density, water/spray visibility, shared debug mode, render target and capture scale are restored in `finally` for the current call pattern.
- Atmosphere/PMREM generation runs before the refraction pass while `sceneCaptureScale=1`, so the refraction scale does not contaminate the reflected sky. The sky cube has its own independent encode scale. HDR PMREM is only generated in the half-float-capable path.
- The factor-four byte fallback preserves a bounded linear range up to four; it is not unlimited HDR. No new scale-composition error was found.
- Four complementary LOD intervals match the four model slots for each broadleaf family. Low quality selects index 3, which is now present. Palms retain the intentional negative LOD index and bypass the four-way dither.
- Packed near-instance matrices and colors come from immutable full-cell source arrays, and the original cell bounds remain conservative. The same world-wind, leaf-motion and LOD uniforms are bound to the depth material. No missing uniform or index mismatch was found in this source pass.
