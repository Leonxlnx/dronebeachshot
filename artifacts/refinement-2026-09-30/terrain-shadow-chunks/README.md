# Terrain shadow partition study

Status: default-off inspection study. The recorded CPU audit and isolated browser probe support exact partitioning for the tested continuation geometry and shadow views. They do **not** establish full-scene performance, 2048 px shadow equality, or visual-quality acceptance.

The current source exposes a lazy `terrainChunks` capture/inspection toggle. Constructing the study does not build chunks or replace the original caster. The normal film path remains unchanged unless that toggle is explicitly enabled.

## What is partitioned

`src/render/terrain-shadow-chunks.ts` bins the existing indexed `continuous-coastal-extension` triangles into 512 m X/Z cells by triangle centroid. It retains each triangle's original three global vertex indices, winding and multiplicity. Every chunk shares the source attribute objects and owns a separate index buffer. Bounds include every referenced vertex, including vertices outside a triangle's centroid cell.

The main terrain geometry and material remain the original objects. When enabled, bounded child meshes cast the partitioned shadow triangles and the original mesh stops casting. Child draw ranges and layer masks are zero outside the shadow phase. Parenting preserves the actual source transform and visibility. Material and custom depth/distance-material references are refreshed by `beginFrame()`.

Immediately before the refraction pass that rebuilds the shared sun map, `prepareSunShadow()` arms only chunks intersecting the actual sun frustum. Each shadow callback restores its chunk to an empty draw range and layer mask zero; `finishSunShadow()` also disarms all chunks in a `finally` block. The installed Three renderer rechecks layers when drawing its previously collected render list, so those consumed shadow proxies do not issue empty color draws. The phase explicitly requires the current single visible PCF sun and skips disabled, cached, hidden-source or layer-excluded shadow work. A second active shadow light is rejected rather than silently losing its casters.

Cleanup detaches borrowed attributes before disposing chunk geometries, so Three's geometry disposal does not delete the still-live source attribute buffers. The original caster state is restored. Current application teardown disposes the study before its general geometry/material traversal.

## CPU evidence

See [actual-source-audit.json](actual-source-audit.json), produced by `scripts/control/check-terrain-shadow-chunks.mjs`.

- Actual continuation: 817,600 vertices and 1,629,600 triangles, from 2,800 boundary vertices and 292 radial rings.
- Partition: 932 chunks; exact original triangle identity and multiplicity verified, with unchanged source position, normal, color and index hashes.
- Every referenced vertex is inside its chunk box and sphere; reported maximum bound excess is zero.
- Every source triangle not excluded by any single light-frustum plane remains in a retained chunk. No incorrectly culled candidate triangle was found for either audited fit.

| Light fit | Retained chunks | Eligible shadow triangles | Source triangles | Incorrectly culled candidate triangles |
| --- | ---: | ---: | ---: | ---: |
| Production sun | 10 | 214,458 | 1,629,600 | 0 |
| Remote study sun | 61 | 457,802 | 1,629,600 | 0 |

These are conservative CPU eligibility counts, not measured GPU vertex execution or speedups. The partition itself took about 875 ms in the recorded CPU run; this is a one-time lazy construction measurement, not a per-frame cost.

The six passing CPU tests cover repeated triangles, long triangles crossing cell boundaries, shared attribute identity, inherited nonuniform transforms, empty color draw ranges, toggle reuse/restoration, disposal ownership, unsupported topology, and phase handling for disabled, cached, invisible, layer-excluded and multiple-light cases.

## Isolated browser evidence

The current successful run is [browser-03/results.json](browser-03/results.json). It contains source hashes, per-frame results and links by filename to all 12 PNGs. Historical `browser-02` established equality but exposed excessive empty color draws; `browser-03` includes the phase correction above. The earlier `browser-01` attempt failed to load its probe module with a 404 and is not equality evidence.

The probe uses the actual continuation geometry with a **substitute Lambert material**, a simple receiver, a directional light and hemisphere light. It renders at 256 by 256 pixels with a **256 by 256 PCF shadow map**. It does not include the production ground shader, vegetation, ocean, atmospheric passes or the full application render pipeline.

For each production, remote and transformed-source setup, the probe rendered `off`, `on`, repeated `on`, and restored `off`. It found byte-identical main-color RGBA and equal sampled native-PCF depth intervals for all compared states. The transformed setup includes translation, Y rotation and nonuniform scale.

The depth check uses `sampler2DShadow` at exact texel centers and 24 binary comparisons to recover deterministic depth intervals. It is **not** a raw hardware depth-buffer byte comparison. All fits contain nonempty shadows, so the comparisons are not vacuous.

| Probe setup | Occupied shadow texels | Enabled submitted shadow triangles | Enabled chunks | Total calls off / on |
| --- | ---: | ---: | ---: | ---: |
| Production | 659 | 214,458 | 10 | 3 / 12 |
| Remote | 10,522 | 457,802 | 61 | 3 / 63 |
| Transformed | 7,472 | 495,871 | 66 | 3 / 68 |

The probe recorded no shader errors. Equality applies only to these recorded views, materials, resolutions and source revisions.

## Corrected overhead and review limits

The installed Three version does not skip `drawCount === 0`: its indexed renderer still issues a zero-count `drawElements` call and increments the draw-call counter. This caused 252, 379 and 349 total calls in the earlier `browser-02` probe. The layer-phase correction reduces them to exactly the retained shadow chunks plus two actual color draws in `browser-03`; it does not rely on empty draw ranges preventing submissions.

The corrected probe took 66.4 seconds wall time. Warm enabled/restored-disabled render measurements were approximately 846/1,148 ms (production), 1,221/1,504 ms (remote) and 589/599 ms (transformed). These are isolated measurements under concurrent film work, not a reliable full-scene speedup claim. The probe does not measure production refraction, vegetation, atmosphere or shader cost. Shared memory stayed below the existing 7.25 GiB abort threshold (recorded peak approximately 6.75 GiB).

Independent source review found no blocking index, winding, bound, ownership, transform or visibility issue for the actual static single-material continuation with the current PCF sun. This is not certification for animated or morphing geometry, changing source topology, grouped materials, or a different shadow implementation.

Keep the study off by default. Production adoption requires checking the actual full scene at its 2048 px shadow resolution, including repeated refraction/main pass behavior and synchronized timings. No art improvement or final-film quality acceptance follows from this study.
