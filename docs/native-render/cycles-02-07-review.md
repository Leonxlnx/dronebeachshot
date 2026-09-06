# Native visual iterations 02–07 — acceptance remains incomplete

These are actual ANGLE/Mesa executions of production Three.js modules. They are diagnostic iterations, **not completed browser refinement cycles**, final 4K stills, or consumer performance measurements. Camera/frame JSON sidecars record exact source hashes, dimensions and shader/GL results. Root inspected every listed frame at its native resolution.

| Iteration | Actual review | Visible result and remaining defect |
| --- | --- | --- |
| 02 | mountain-wide, canopy-close, 960×540 | Denser 14,000-tree ecology improves coverage, but leaf geometry still resolves as granular sparse crowns. Near canopy submits about189M triangles across passes before further packing. |
| 03 | mountain-wide, flight-0, 960×540 | Continuous terrain annulus removes disconnected terrain strips. First regional blend creates giant nearby walls: rejected; next iteration moves major relief farther away. |
| 04 | mountain-wide, canopy-close, flight-0, 960×540 | Softer regional rise removes walls. Filtered fractional-alpha foliage preserves area and matching depth masks. Scene remains sparse, brown and stippled; rounded geology and sky banding remain prominent. |
| 05 | mountain-wide, flight-0, sunset-reflection, wet-sand, 960×540 | Shared cloud intervals fix different visible/shadow heights. Bounded adaptive marching reveals a warm solar disk. Non-harmonic footprint-filtered water normals remove the strongest quilt pattern. Initial76m look-down target shows the bay and foreground slope. Clouds remain soft/layered; terrain and canopy do not meet reference quality. |
| 06 | wet-sand, low-wave, breaking-wave-side, flight-0, 960×540 | Thinning swash coverage blends into actual terrain, replacing the hard diagonal sheet edge. Filtered foam no longer produces dense distant stipple, but coherent bands remain overly uniform in the aerial view. Low wave framing shows little breaking action and needs adjustment. |
| 07 | mountain-wide, flight-0, wet-sand, headland, 960×540 | Embedded fracture slabs replace scattered round rocks. Dry elevated cliffs read lighter. Core radial cone silhouettes, sparse leaf crowns and coarse distant hills remain automatic visual failures. No final approval. |

## Verified optimizations

- Packed roots across all contributing broadleaf LODs: mountain-wide rendered RGB is byte-for-byte identical. Submitted triangles 64,316,358→55,834,837; calls 2,053→2,017 in that comparison.
- Excluding above-water forest from the refraction **color** pass preserves forest shadows. Wet-sand and flight-0 are both byte-for-byte identical before/after. Submitted triangles decrease 70,832,169→59,128,653 and 56,918,415→46,822,967 respectively. Details: refraction-culling-comparison.json.
- Distant cloud lighting uses absolute-time snapshots. Sixty update calls over the first second produce 2 cubemap/PMREM updates and 4 cloud-shadow updates. Random seek 17→3.1→17 gives exact sky-frame equality; zero shader and GL errors. Visible sky and scene animation remain continuous. Details: sky-cache-check.png.json.
- Geology changes 2,349,000 rock triangles to 14,168 while removing the pebble-covered appearance. All 322 new instances intersect the actual terrain, but near hero-rock quality still requires full-scene judgment.

These statistics count actual native rendering work; they do not measure consumer GPU FPS.

## Defects ranked for the next pass

1. Core landforms are still radial cones, not branching eroded ridges.
2. Far crowns lose aerial leaf area; Syringa's two vertical card directions collapse at elevated views. Bright transparent padding also contaminates ordinary RGB mips.
3. Distant ridges have coarse radial sampling and insufficient crown structure.
4. Clouds remain visibly procedural and layered; sun glitter occasionally tends pale/cyan.
5. Breakers are too uniform around the bay; wet-sand and sand color/detail still require art refinement.

The minimum 24h verified work, eight accepted production-browser cycles, final 16×4K gallery, films, full motion review, offline/mobile/consumer-hardware checks and final main push remain open. The managed browser still cannot initialize WebGL, even at 16×16, independent of scene content.
