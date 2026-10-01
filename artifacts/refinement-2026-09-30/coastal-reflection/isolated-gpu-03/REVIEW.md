# Isolated coastal reflection: actual GPU fixture

The corrected fixture passed on 2026-10-01. It uses the actual `createCoastalReflectionPass` and the exact `coastalReflectionGLSL` declaration extracted from the current ocean source, with hashes in `results.json`. No production source was modified by this fixture.

The scene is deliberately small: PBR planes, a procedural alpha-to-coverage cutout, and an 8px rendered sky cube whose alpha is .35. A 128×128 physical canvas feeds the helper's 64×64 RGBA16F, four-sample reflection and resolved depth. The production opaque-canvas seal is used for correct PNG export. These synthetic objects test the rendering path; they are not a full-scene art comparison.

## Observed results

- Seven real images completed: off/on/off-restored at DPR 1 and 2, plus actual ocean wave-ray reprojection with a tilted normal. The physical canvas size stays constant across DPR.
- Both off-restored images are byte-identical to their preceding off images. DPR 1 and 2 off/on pairs are also byte-identical. Turning reflection on changes 3,341 pixels, so the comparison is not empty.
- All 4,096 sampled HDR reflection texels are finite. Hiding the cutout changes 162 reflection texels; 148 have partial resolved alpha. Alpha is never used as geometric coverage by the ocean function.
- Oblique depth contains 735 geometry and 3,361 sky texels. Minimum reconstructed geometry height is .07116 above the mean sea plane; the entirely submerged diagnostic plane is clipped.
- A resolved MSAA depth sample need not belong to the pixel centre. The largest centre-to-known-plane error is retained as evidence: .37985 world units. Every sample's inverse-VP half-texel interval intersects one of the two known planes (`z=-6` or `z=-5`), with zero misses and zero interval violation. The test allows only .002 world units for float roundoff; it does not increase an arbitrary centre-error tolerance.
- Five preparation/restoration callback pairs balance. The reflection never consumes the pending main shadow update. Shader errors, page errors, console errors, request failures and GL readback errors are absent.

The off, on and perturbed PNGs were visually inspected. The planar reflection is recognizable beneath the coast, the partial edge is present, and the perturbed reflection shifts coherently. No blank frame or export-alpha whitening remains.

## Limits

This does not accept the reflection's full-scene quality, shoreline contact, roughness, foreground disocclusion or motion. It does not benchmark throughput. The float-finiteness check covers captured reflection color and reconstructed depth; the actual ocean function is compiled and rendered into the visible PNGs, rather than separately instrumented for a float output-finiteness proof. MSAA depth remains a resolved sample rather than conservative coverage. The fixture does not recreate production forest geometry, textures or aerial fog.

The first attempt stopped before WebGL because the fixture route root had a trailing slash; CPU route checks now prevent that mistake. The second exercised the GPU but rejected the crude centre-depth tolerance. Its raw failure and measured error remain in `isolated-gpu-02`; this successful attempt uses the explicit sample-footprint test above.

## Resource closure

Working-memory guard remained 7,168 MiB preflight / 7,424 MiB runtime. Working start/peak: **7,091.58 / 7,236.80 MiB**. Raw cgroup start/peak: **7,731.68 / 7,879.66 MiB**. No guard abort occurred. The process exited successfully after awaiting closure of its own browser and HTTP server, stopping the owned guard timer and writing `memory.json`. No other browser/process was inspected or controlled. The GPU slot was returned to root; no further render was launched.
