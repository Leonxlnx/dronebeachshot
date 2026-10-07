# Gates: GPU cloud realism refinement

Scope: More believable connected cloud volumes, varied scale and internal shadow without stretched repeated forms, preserving shared density and the accepted 15 m integration grid. Own cloud density, morphology, noise and their checks only; driver owns builds, captures and visual integration.

Implemented first candidate after baseline review and driver authorization: alongScale .8, shear .12; weather frequencies .00016/.00024, fragment .00044/.00052, maturity .00010/.00014; lower top start/end .35/.70 with high .58/1 retained. Reuse raw weather, fragment and maturity values to offset macro coordinates by 1100 m along, 350 m across and 180 m vertically. No additional noise samples or texture reads. Base map plus warp has conservative maximum stretch 1.536622; footprint scale 1.54 bounds it. Independent fine erosion stays in world coordinates. Read-only reviewer confirmed the bound and shared-field approach; GPU assessment still required. Optional later local sunlight cells [0,80], [80,300], [300,810] would use midpoint positions 40/190/555 and weights 80/220/510 at the existing three-sample budget; only pursue after morphology imagery establishes a need.

- [x] A1: Trace shared density, morphology registration, noise, lighting consumers and canonical controls before selecting the change.
  EVIDENCE: Read clouds.ts, cloud-morphology.ts, cloud-noise.ts, cloud-quadrature.test.ts, atmosphere.ts, weather.ts, canonical-look.ts, profiles/last-light-bay.json, main.ts callers, morphology checker, README and canonical/current continuation handoffs. Canonical ON field stretches macro lobes 2.5 times and weather 3.53 times along wind; all visible/reflected/shadow density routes register the same field. Stable 15 m primary integration belongs to atmosphere.ts and is outside leaf ownership.

- [x] A2: Inspect driver-provided baseline GPU frames at matched route times before changing source.
  EVIDENCE: Viewed outputs/baseline-02/flight-0.000.png, flight-6.000.png, flight-10.500.png and flight-19.500.png. At 0 and 19.5 seconds the upper sky has long parallel layered folds; at 10.5 seconds rounded but smoothly stretched forms lack scale variety. The 6-second view looks down and provides no direct cloud silhouette evidence. Driver explicitly authorized cloud source edits after this baseline.

- [x] A3: Shared morphology composition, bounds and lifecycle checks pass, including bounded filtering and exact OFF restoration.
  CHECK: node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-cloud-morphology.mjs
  EXPECT: "ok": true
  EVIDENCE: artifacts/refinement-2026-10-02/cloud-morphology/cpu-proof-volume-03.json reports ok:true, identical density in three consumers, exact OFF restoration, 8481 bounded lobe support profiles, maximum warped coordinate stretch 1.5366217097 below footprint 1.54 and minimum bound .2659364725 above zero. Local bases 690..1410 m and maximum top 3010 m fit strictly inside 600..3200 m integration bounds; regional fade ends by 34000 m, before the 36000 m cylinder. Zero occupancy removes all density even for maximum texture values; the vertical surface threshold extinguishes even maximum lobes before the local bounds, and Perlin cannot bridge empty space outside both feature spheres. Local sunlight midpoint cells integrate constant/linear density exactly over 0..810 m. Still three scalar-noise calls and two volume texture reads per density. Earlier proofs remain preserved separately.

- [x] A4: Preserve the stable 15 m quadrature and its numerical continuity and energy checks.
  CHECK: node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs --test src/world/cloud-quadrature.test.ts
  EXPECT: # fail 0
  EVIDENCE: All three quadrature tests passed, covering exact ray partitions, analytic extinction/linear-density energy and tail-cell continuity. The primary integration shader in atmosphere.ts is unchanged by this leaf.

- [ ] A5: Driver-provided matched GPU captures show improved cloud volume, scale, edges and internal shadows without renewed sampling artifacts or repeated stretched silhouettes; expert and defect passes complete.
  EVIDENCE: First candidate's nine actual GPU views in outputs/cloud-01 and corresponding baseline-02/baseline-extra views were inspected. Reduced stretching was rejected as insufficient. The second pass in outputs/pass-02 was also rejected after inspecting 0/10.5/19.5/mountain-wide: the convex mixture filled weather islands, producing gray lids, rectangular lower silhouettes and feathered rims. Third true-lobe support pass awaits GPU review; no acceptance claimed.

- [x] A6: Final owned diff has no whitespace errors.
  CHECK: git diff --check -- src/world/clouds.ts src/world/cloud-morphology.ts src/world/cloud-noise.ts src/world/cloud-quadrature.test.ts scripts/control/check-cloud-morphology.mjs gates/refinement-2026-10-02-atmosphere.md
  EXPECT: /^\s*$/
  EVIDENCE: (no output)

- [ ] A7: Driver source/build integration result recorded; remaining cloud visual limits stated.
  EVIDENCE: pending

Second pass: review identified the prematurely clamped macro-noise plateau, which let weak weather retain opaque cores, and the shared visible slab underside. The ON shader now separates weather occupancy from within-cloud density, uses an unsaturated convex macro mixture, varies local base and thickness, sharpens independently eroded volume edges and begins near self-shadow sampling at 40 m. The opening gently suppresses weather rather than cutting a geometric hole. Regional systems fade at different distances before the conservative cylinder boundary. Source changes stay in the morphology module; the OFF cloud field and primary 15 m ray integrator are unchanged. A full curved horizon was deferred because at 36 km Earth sag is only about 102 m, while extending the volume to its roughly 113 km geometric horizon would coarsen long rays under the existing 512-sample cap.

Third pass: the second pass's wet threshold .25 was below the convex macro mixture's measured median .497, so the vertical envelope still defined a filled slab. The third pass uses the existing 3D Worley nearest-feature distance channels as actual geometric support: max(G,.85*B), with only bounded Perlin radius perturbation. The surface threshold never falls below .52 and increases quadratically toward local top/bottom. This contracts distinct large/small lobes rather than revealing a plane. Independent detail erosion removes .025..065 from support; the final density ramp is .18. No new texture reads or scalar noise calls were introduced. Acceptance requires curved lower silhouettes, visible internal billows and gaps in actual captures, not just less coverage.
