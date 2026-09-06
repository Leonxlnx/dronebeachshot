# Environment radiance color study (scratch candidate)

This is an isolated visual study of actual Three.js shaders and assets through native ANGLE on software Mesa. It is not browser QA, a consumer frame-rate measurement, or acceptance of the overall scene.

## Bounded atmosphere candidate

`atmosphere-environment-color.patch` changes only the visible sky/probe radiance fit and cloud sunlit RGB. The visible dome and reflected cubemap continue using the same shader. Cloud density, extinction, sun direction, sun disk radiance/size, shadow density pass, geometry, world time, and update cadence are unchanged. Engine exposure, tone mapping, terrain fog, and ocean fog are untouched.

The horizon now depends on horizontal angle from the sun: restrained gold toward the sun, blue-gray away from it. The previous bright brown lower hemisphere becomes a low-radiance dark green-gray bounce approximation. Cloud lighting shifts from saturated orange to warm sunlight of similar linear luminance. These remain artistic scene-linear radiance fits, not a spectral physical atmosphere model.

## Paired render evidence

`render-comparison.mjs` uses the immutable `source/` snapshot recorded by `snapshot-manifest.json`. It renders real terrain, detailed photogrammetry rocks, the coastal field, water, atmosphere, and refraction. Vegetation is omitted deliberately to isolate environment color. All three paired views use fixed cameras/time and the same renderer, 768×432, linear HalfFloat 4× MSAA followed by the official Three OutputPass with ACES/sRGB.

`comparison.json` contains six successful captures with zero shader errors and GL error 0. `contact-sheet.png` was visually inspected.

- Aerial: the uniform orange reflection blanket becomes muted gray-gold near the horizon and cooler water away from the sun. The remaining visible blue/cyan sun stripe is unchanged.
- Low shore view facing away from the sun: the pink sky and orange water streaks become a blue-gray sky and subdued neutral reflections. The land still has its warm directional illumination, which was not changed.
- Sunset horizon: gold remains around the sun, while upper cloud shadows lose much of their pink cast. The cloud slabs and visibly layered cloud formations remain a major geometry/density quality limitation. The result is calmer but does not meet the requested photorealistic standard.

Fixed display-space sky ROI HSV saturation falls from 0.393 to 0.137 in the aerial view, 0.296 to 0.109 in the low view, and 0.270 to 0.102 in the horizon view (`sky-roi.json`). These numbers demonstrate reduced tint, not improved realism by themselves.

## Independent water defect isolated

`render-diagnostics.mjs` captures the horizon with the candidate sky while changing one diagnostic control at a time:

- `horizon-glint-candidate.png`: actual analytic sun term alone is warm and contains no cyan stripe.
- `horizon-reflection-candidate.png`: actual cubemap reflection/scattered water debug term contains no cyan stripe.
- `horizon-without-transmission-candidate.png`: normal water with only `uUnderReady=0` after the coast pass removes the stripe.

All three were visually inspected, with zero shader/GL errors. This establishes that the prominent cyan stripe enters through the transmitted-coast path. It does not establish which source pixel alone is responsible. The initial clear-depth sky rejection was tested and rejected as a solution: it leaves the blue stripe visible. `source-skyguard/`, `refraction-skyguard.patch`, and its frames are diagnostic evidence only, not the proposed fix.

The ocean also retains its own hardcoded distance fog toward linear RGB (0.59, 0.55, 0.46), separate from terrain fog and the sky fit. A consistent horizon requires that contract to be reconciled by the root renderer/fog work.


## Underlying buffer inspection and revised candidate

The direct refraction color buffer (`under-color.png`, `under-color-half.bin`) contains a bright specular stripe on the submerged terrain. Its actual finite linear RGB maximum is (1135, 724, 404.75), while color away from the stripe is typically near 0.2. The depth buffer confirms these are opaque terrain pixels, not clear-depth sky. Sample at display pixel (370,300): linear RGB (916.5,584.5,326.75), depth 0.9987233, view distance 308.92 m. `under-buffer-analysis.json` contains the samples, dimensions and readback scope. This explains why sky-only depth rejection cannot remove the artifact.

The ground shader treats every permanently submerged sand point as wet sediment and reduces its roughness to 0.20, which creates a second glossy interface underneath the ocean. Its strong warm specular signal becomes cyan after the water's wavelength-dependent absorption. The bounded revised candidate (`ground-exposed-wetfilm.patch`) leaves the existing granular sand roughness below -0.25 m, transitions smoothly to the exposed wet-film roughness at +0.10 m, and preserves color, normal details, wetness history and all refraction. It introduces no texture or uniform. Its paired result is described below.


## Revised candidate result and recommendation

The three `*-wetfilm.png` images and `wetfilm-contact-sheet.png` were visually inspected. All three completed with zero shader errors and GL error 0 (`wetfilm-comparison.json`).

The cyan/blue sun stripe is removed in both aerial and sunset-horizon views. A warm, irregular water-surface highlight remains, and true shallow-water transmission remains enabled. The low shore view retains the underwater pattern and foam without an obvious new edge. Above +0.10 m, the wet-film formula is algebraically identical to the original, so exposed wet sand retains its previous roughness response.

Recommend integrating the bounded atmosphere color patch and the exposed-wet-film ground roughness patch, then reviewing the complete scene alongside the root's fog and coastal material changes. Do not integrate the failed sky guard as a stripe fix. The roughness patch should receive the root's next ground shader cache-key version when integrated. This candidate does not fix cloud shape, excessive terrain smoothness, tree geometry, surf shape, or unified distance fog.

No Site files were changed, and nothing was published. Native render evidence is only an intermediate correctness/art diagnostic.
