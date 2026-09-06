# Bounded lighting candidate — three parameter edits only

Recommended candidate from this study is `balance-neutral`:

| Parameter | Baseline | Candidate |
|---|---:|---:|
| Sun intensity | 3.6 | 4.4 |
| Hemisphere intensity | 1.15 | 0.65 |
| Directional sunlight color | `0xffbd75` | `0xffd1a1` |
| Shadow depth bias | −0.00025 | −0.00004 |
| Shadow normal bias | 1.1 m | 0.25 m |

`lighting-parameter-patch.mjs` is a pure source transform containing three exact find/replace pairs. It performs no filesystem writes. Root can apply those edits to the current `atmosphere.ts` without replacing the module. The transform was checked against the current source: reversing its three changes restores every original byte, and reapplying is idempotent. Evolving cloud imports, uniforms, samplers and shaders remain untouched.

## Actual native comparison

`native-before-after.png` compares baseline and candidate in the full production scene at fixed `headland` and `mountain-wide` cameras. All geometry, source assets, source colors, tree placement, LOD, material shaders, cloud field, scene environment, fog, exposure and tone mapping remain the same between variants. The engine's actual default framebuffer was read with sRGB output and ACES exposure 1.08; there is no offscreen display-conversion ambiguity. Resolution is 768×432, native samples 0.

Eight actual scene renders cover four controls in each camera: baseline, smaller bias only, direct/hemisphere balance with the original sunlight color, and the same balance with less orange sunlight. Every frame metadata file records shader errors `[]` and GL error `0`.

Visual result: lower bias modestly tightens contact shadows; it is not the main remedy for the broad flat appearance. The direct/fill rebalance separates lit crown tops and rock faces from shaded interiors more clearly. The less orange sunlight preserves the warmer highlights while reducing the brown/yellow cast on lit stone and foliage. Original source RGB and all material multipliers are unchanged. No exposure change or whole-forest darkening multiplier is used.

The native crop in `headland-shadow-crop.png` shows baseline, bias-only and candidate at identical pixels, enlarged with nearest sampling. No obvious new large-area shadow acne or detached shadows appeared in these two views. Fine leaf stippling remains; these views do not establish acne-free behavior across every camera or the lower-resolution shadow tiers.

## Measured separation, without global darkening

`lighting-measurements.json` uses fixed tree/terrain image ROIs. sRGB output is decoded to display-linear luminance for comparison; these are display-referred measurements, not physically calibrated irradiance or semantic canopy masks.

| ROI | Mean luminance, before→candidate | P90/P10 contrast, before→candidate |
|---|---|---|
| Headland | 0.0694 → 0.0820 | 5.34 → 7.58 |
| Mountain-wide | 0.0843 → 0.0933 | 5.19 → 9.03 |

The candidate keeps the average scene region brighter while lowering shaded values and raising illuminated values. Keeping the original more orange light with the same intensity rebalance also improves contrast, but accentuates the warm cast; that control remains saved as `*-balance-mode-0-768.png`.

## Shadow findings and remaining limits

The directional shadow's 1799 m depth interval turns the old normalized bias into about **0.45 m along light depth**, before the **1.1 m surface-normal offset**. Its 760 m width at 2048 pixels is **0.371 m per shadow texel**. These allowances are large compared with leaf/branch detail. Candidate depth allowance is about 0.072 m plus the 0.25 m normal offset. The reduced bias improves local contacts but cannot create information missing from the shadow map or source proxy.

`shadow-frustum.json` contains a separate read-only check. Using conservative spheres around the current source roots, 1164 of 5366 potentially camera-visible crowns in headland and 2962 of 11334 in mountain-wide do not intersect the static directional shadow frustum. These are approximate frustum counts, not occlusion-query counts. No frustum, resolution or cascade redesign is included: widening coverage trades away detail and should be handled independently.

The forest still falls short of the reference's closed, volumetric crowns. Source crown geometry/coverage, the far proxy's planar geometry and absence of true internal crown occlusion remain structural limits that lighting parameters cannot repair. Distant gray haze is also unchanged. This candidate is a modest lighting improvement with valid native evidence, not a complete realism fix or browser visual approval.

## Reproduction

From `/workspace/scratch/2b912ce37941`:

```sh
BAY_OUTPUT_DIR=/workspace/scratch/2b912ce37941/native-render/lighting-study \
BAY_NATIVE_SAMPLES=0 \
LD_LIBRARY_PATH=/workspace/scratch/2b912ce37941/native-render/mesa/usr/lib/x86_64-linux-gnu \
__EGL_VENDOR_LIBRARY_FILENAMES=/workspace/scratch/2b912ce37941/native-render/mesa/usr/share/glvnd/egl_vendor.d/50_mesa.json \
LIBGL_ALWAYS_SOFTWARE=1 \
node --experimental-strip-types --loader /workspace/sites/last-light-bay/scripts/control/ts-resolve.mjs native-render/render-lighting-study.mjs headland,mountain-wide 768 0
```

The harness loads the production scene once and changes only the listed sun/hemi/shadow parameters between captures. It does not edit production. Geometry and atmosphere work committed later by root will naturally change subsequent rerenders; the saved metadata records the source hashes observed for this batch.

Run `node native-render/lighting-study/measure-lighting.mjs` for image measurements. Use the same TypeScript loader with `native-render/lighting-study/check-shadow-frustum.mjs` for the independent geometry/frustum counts.
