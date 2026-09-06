# Distant coastal ridge candidate — rejected for integration

Both requested native views completed successfully and were visually inspected. The candidate is **not ready to integrate**: wet-sand shows unacceptable broad white terraces across the far slopes, while flight-0 retains smooth bare sidewalls and a fine-grain transition at their bases. The fewer isolated cone silhouettes do not offset these defects. See `visual-review.json` for exact images, source hashes and limitations.

This is a scratch-only modification to the annulus in `src/world/terrain.ts`. The 425 m core, camera positions, coastline, central mesh topology and camera-clearance geometry are unchanged. No new asset downloads or distant tree instances were added.

The former narrow independent ridge profiles are replaced with broader connected divides, smooth saddle joins, tributaries that merge downslope, and 20–80 m geometric fractures. Regional inland relief follows a 320 m shoreline tangent, preventing fine beach-normal wiggles from being amplified kilometres inland. Existing underwater heights are preserved separately.

The old extension shader replaced distant stone with constant grey. This candidate uses the existing shared rock/moss/soil/sand samples and keeps normal, roughness and occlusion classification on those same substrates. It adds no sampler. The latest MarbleCliff03 ground material and upward-adjusted opening gaze were copied before native review.

## Quantitative continuity

`seam-proof.json` records:

- 2,800 core-perimeter vertices: height error 0.
- 11,200 collar samples: difference 0 from the preceding continuation.
- Every rendered Float32 outer-perimeter vertex: exactly −85 m.
- 1,621 sampled regional underwater points: difference 0.
- Sampled central heights: difference 0.
- No non-finite heights.

The 32 m second-difference metric increases from 11.36 to 33.32 m on sampled distant land. That measures added relief, not realism. Maximum sampled height is 498.66 m outside the core; annulus topology and vertex count are unchanged.

## Native review

The two 960 × 540 frames use actual Three.js modules through ANGLE/Mesa with linear HalfFloat 4× MSAA and the official OutputPass. Both report no shader errors and GL error 0; process exit 0. Native rendering does not establish browser compatibility or consumer device performance.

The suspected cause of the visible terraces is under-resolved cuts/fractures relative to the 16/32/48 m radial mesh intervals, possibly amplified by mesh normals and material thresholds. This is an inference, not a proved diagnosis. A bounded followup could examine larger geometric support and smooth finite-difference normals from the continuous height. No additional candidate or render iteration was performed.

## Files

- `distant-ridge.patch`: rejected terrain-only patch, retained for reproducibility.
- `src/world/terrain.ts`: complete candidate in its frozen dependency tree.
- `baseline-terrain.ts`: preceding production terrain for comparison.
- `candidate-heights.ts` and `baseline-heights.ts`: extracted exact CPU height functions.
- `seam-check.mjs`: quantitative seam and finite-height checks.
- `visual-review.json`: rejection findings and exact evidence.
- `frames/`: wet-sand and opening-flight native views, with source hashes and GL diagnostics.

No Site source or hosting state was modified by this study.
