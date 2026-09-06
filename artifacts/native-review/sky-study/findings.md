# Native sky investigation

The native control supports undersampled ray marching as a cause of the horizontal striations. It does **not** implicate the sine hash: the sampling-only control keeps the existing hash, `n3`, coverage, density, and lighting expressions intact.

No production file was edited. The candidate and all execution copies are scratch artifacts. This is actual Three.js/ANGLE shader output, not a generated backdrop, browser QA, or a visual approval.

## Concrete source findings

1. The cycle-01 visible sky starts its march at 900 m, but its cloud-shadow shader still starts at 350 m. Density is zero below 900 m. That mismatch samples a different vertical region and weakens/shifts the shared shadow result.
2. The original 24 steps use `34 / max(ray.y, .08)` metres. At the approximately 6° sun elevation, each step is about 324 m along the ray, comparable with or larger than the cloud bodies/detail being sampled. Near the horizon, the unbounded field also accumulates many remote cloud structures into a noisy continuous band.
3. A 128-step control with a finite ray interval visibly removes most fine horizontal striations while keeping the original density and hash. Its continuous cloud coverage still hides the solar disk. Sampling and weather coverage are separate problems.

## Reviewable files

| File | Purpose |
| --- | --- |
| `sky-before-960.png` | Original production atmosphere snapshot, same sunset camera, sky only |
| `sky-before-480.png` | Matching control resolution for the sampling comparison |
| `sky-sampling-480.png` | Original density/hash/lighting; bounded interval and 128 march samples |
| `sky-final-960.png` | Final irregular-cloud candidate, same camera and time |
| `clouds-candidate.ts` | Proposed shared density, volume bounds, and optical helpers |
| `atmosphere-candidate.ts` | Proposed visible/reflected sky and matching cloud-shadow march |
| `../sky-only.mjs` | Native execution harness |

Each native PNG has a JSON sidecar with camera, time, dimensions, module hash, shader-error results, and GL error. The final PNG also records the exact cloud-module hash. Source-compatible candidate files retain relative production imports; `*-runtime.ts` copies only remap those imports for execution from scratch.

## Candidate behavior

- One `cloudSegment` function intersects the 850–2,200 m cloud slab and a finite, world-anchored 36 km cloud domain. Visible sky, reflected sky, and the ground-shadow pass use these same bounds and the same `density` function.
- Both marches target 60 m spacing with `ceil(intervalLength / 60)`, a 12-sample minimum, and a 128-sample maximum. Higher rays use roughly 23 samples through the full slab; low rays reach the cap. The target is **not** a guarantee of at-most-60 m spacing once that cap is reached.
- Weather coverage separates the larger groups; warped multiscale 3D noise forms irregular cloud volumes. Spatially varying cloud bases and reduced remote detail help avoid a uniformly flat edge and unresolved high-frequency erosion.
- A finite, world-space weather clearing opens the sunset sector. It acts on the shared density, including terrain shadows and reflections. It is not a screen-space cutout or a separately painted sun.
- The existing solar disk remains in the visible sky and remains omitted from the reflection cube, preserving the water shader's analytic sun-glitter convention. A narrow warm scattering halo accompanies it.
- Extinction and a short density-based sun transmission calculation provide dark cloud interiors and warm illuminated margins.

## Visual judgment and limits

The final candidate reveals the low sun, creates a warm scattering region, and replaces the original fine striations with much more coherent cloud volumes. It is suitable for a root full-scene comparison. It is **not reference-level cumulus yet**: the lowest cloud groups still look horizontally layered, and some nearby forms remain soft. The earlier explicit ellipsoid-cell attempt was rejected because its repeated blobs looked cartoon-like; its files and `sky-candidate-480.png` are historical evidence, not the recommended candidate.

The main reliable improvements are the bounded/adaptive interval and the corrected shadow bounds. The larger density and color changes need judgment in the full scene, especially against the forest, the reflected sky, and the final water glare. Root can integrate those two parts separately if the new cloud art direction is not suitable.

All completed native runs reported no shader errors and GL error 0. Recorded wall times include shader compilation, sky-cube capture, cloud-shadow rendering, and environment convolution; they are not consumer frame-rate measurements. No browser, Sites, additional agent, image-generation, or production-write action was used.
