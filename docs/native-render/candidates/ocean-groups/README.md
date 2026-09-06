# Ocean breaking groups — scratch shader candidate

`ocean-breaking-groups.patch` changes only the ocean fragment shader in `src/world/ocean.ts`. The complete source is `ocean-candidate.ts`; `ocean-before.ts` freezes the original for paired native evidence. Root owns integration.

## Diagnosed cause and change

The previous narrow crest sine extends around the whole coastal curve. Its high-frequency foam texture becomes an almost constant average when viewed from the air, leaving two continuous bright rails. The existing broad residue phase (`travel−1.1`) also places its maximum shoreward of the incoming crest, ahead of the crest rather than behind it.

The candidate adds a slow, continuous interference envelope in along-coast position and inward travel distance. It advects at 3.2 m/s as a **breaking-energy proxy** and gates foam against local bathymetry and actual rock shelter. It does not change the wave displacement spectrum. Foam is still anchored to the original crest phase; no additional displaced or phase-shifted wave mesh is invented.

A second, coarser filtered foam field forms connected metre-scale rafts inside those active breaking sections, using the same original swash advection as the fine bubbles. Its structure remains resolved when distant small bubbles average away. Residue shifts behind the crest and uses a short lag of the same group energy. The advancing swash edge and rock impacts inherit the local energy rather than remaining equally white along the entire coast.

## Native visual evidence

The paired `aerial-{before,after}-mode-0.png` images show the coast-wide uniform rails replaced by interrupted, connected whitewater sections. The `low-{before,after}-mode-0.png` pair shows quieter water between localized breaking stretches, retaining ragged foam rafts on the active wave. Debug mode 10 images isolate the foam field. The candidate has less total foam than the baseline; the reduction is concentrated between active groups, not a uniform color or opacity adjustment.

The harness renders the genuine production terrain, rocks, coastal field, sky/reflection, and refraction passes at 768×432. Vegetation is omitted to isolate the water surface. No backdrop, texture asset, or generated imagery was introduced. Both pairs use the same source geometry, camera, and absolute time. `native-comparison.json` records shader errors `[]`, GL error `0`, and ocean source hashes. Its triangle counter is cumulative across calls and is not a performance result.

Cameras:

| View | Position | Target | Time |
|---|---|---|---:|
| Aerial | `(0,225,-180)` | `(0,0,70)` | 5.0 s |
| Low | Production `breaking-wave-side` | Production `breaking-wave-side` | 12.8 s |

This is isolated native rendering evidence, not browser QA or a complete-scene visual approval. Some curvature still follows the common coastal crest, deliberately preserving phase and geometry consistency.

## Mathematical preservation and continuity

`mathematical-check.json` verifies exact source equality of the shared water-height/normal functions, swash geometry, vertex shader, geometry construction, and thinning-film/refraction edge block. `coastal.ts`, CPU runup, wetness history and spray phase are untouched. There is no frame counter, mutable foam state or accumulated delta time in the added functions.

The scalar CPU transcription samples 3015 nearshore positions at four absolute times. As temporal epsilon halves from 0.0001 to 0.00005 seconds, maximum foam change halves from 0.00026090 to 0.00013044; group-envelope change halves from 0.000011207 to 0.000005604. Seeking through unrelated times and returning produces bit-identical results. This is continuity evidence for the added smooth fields; it does not replace the shared CPU/GPU coast implementation.

A diagnostic along one common crest, with subpixel bubble noise averaged and no rock mask, measures the effect of the added large-scale structure. Across times 0,5,12.8,20 s, the old foam exceeds 0.12 continuously along the full sampled 1001 m arc. The candidate's longest continuous sections are 109–116 m, while 54–65% of that arc exceeds the same threshold. This confirms spatial fragmentation rather than merely lowering an otherwise uniform band.

## Exact reproduction

From `/workspace/scratch/2b912ce37941`:

```sh
LD_LIBRARY_PATH=/workspace/scratch/2b912ce37941/native-render/mesa/usr/lib/x86_64-linux-gnu \
__EGL_VENDOR_LIBRARY_FILENAMES=/workspace/scratch/2b912ce37941/native-render/mesa/usr/share/glvnd/egl_vendor.d/50_mesa.json \
LIBGL_ALWAYS_SOFTWARE=1 \
node --experimental-strip-types --loader /workspace/sites/last-light-bay/scripts/control/ts-resolve.mjs native-render/render-ocean-groups.mjs
```

For the source-preservation, stateless-time and continuity audit:

```sh
node --experimental-strip-types --loader /workspace/sites/last-light-bay/scripts/control/ts-resolve.mjs native-render/check-ocean-groups.mjs
```

For a production-scene candidate render without editing the checkout, the existing `render-scene-batch.mjs` can redirect only its `world/ocean` module import to `ocean-candidate-runtime.ts`; every other module stays in production. That runtime file only rewrites import paths for native loading. The source patch leaves all runtime imports and source geometry intact.
