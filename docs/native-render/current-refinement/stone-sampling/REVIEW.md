# Stone repetition: recommended bounded correction

**The repeated waffle pattern comes from repeated source texture phases, not the terrain grid.** The candidate replaces the existing slowly varying two-offset sampler with three deterministic translations on a triangular lattice. In the actual unchanged-terrain comparison, the regular rows disappear while source fracture detail remains. This is a useful material correction; it does not fix the rounded macrogeometry or establish final scene realism.

## Diagnostic evidence

| Control | Visible result |
|---|---|
| Original current ground material | Strong repeated waffle rows on exposed faces |
| Same material with normal perturbation disabled | Pattern remains; normal maps are not required to produce it |
| Unlit actual diffuse albedo | Pattern remains independently of light and shadow |
| Constant material on identical terrain | No waffle grid; terrain topology is not its source |
| Original sampler with rock anisotropy 1 | Pattern remains; disabling anisotropy alone does not fix repetition |
| Candidate sampler with the same anisotropy 1 | Regular rows removed; irregular source grain retained |

The downloaded Marble Cliff03 source contains pronounced horizontal and vertical fractures. Repeating that 5.7483 m square at coherent UV phases creates the visible motif. The old `stoneSample` changes phase only over broad, low-frequency regions. A direct single-projection sampler control reproduces the repetition, proving that triplanar mixing is not necessary for the artifact, although its multiple orientations can emphasize the grid appearance.

Diagnostic controls: `control-context-{original,normal-off,unlit-albedo,plain-geometry}.png`.

## Final matched terrain frames

| View | Current baseline | Filter-only control | Candidate |
|---|---|---|---|
| Context | `final-stone-context-before.png` | `final-stone-context-original-aniso1.png` | `final-stone-context-candidate.png` |
| Detail | `final-stone-detail-before.png` | `final-stone-detail-original-aniso1.png` | `final-stone-detail-candidate.png` |

The final pair uses identical baseline terrain, vertex colors, normals, lighting, camera, source texture bytes and existing exposed-rock color calibration. The candidate changes the rock sampling phases and rock-map anisotropy only. No new source downloads, geometry changes, texture resizing or global recolor.

## Periodicity versus blur

The direct GPU diagnostic samples an unchanged CC0 source albedo over 8 by 8 physical tiles, recording actual linear RGBA32F values. Both entries below use anisotropy 1, so this measures the sampler change independently of the filtering change. One source period is 128 pixels = 5.7483 m.

| Metric | Original sampler | Candidate |
|---|---:|---:|
| Correlation at one tile, X | 0.83808 | 0.05780 |
| Correlation at one tile, Y | 0.90882 | 0.03585 |
| Mean linear luminance | 0.241156 | 0.240698 |
| Luminance standard deviation | 0.079029 | 0.077202 |
| Adjacent-pixel gradient RMS | 0.033274 | 0.034036 |
| Laplacian RMS | 0.068557 | 0.072186 |

The candidate retains **97.69% of luminance variation and 102.29% of gradient energy**, with mean luminance changing **-0.19%**. The new result is not merely a blurred version of the old repetition. These metrics and the visible paired probe support this bounded conclusion; they are not comprehensive perceptual or performance validation.

Use `aniso1-sampler-{before,candidate}.png`, matching raw linear buffers, `aniso1-sampler-measurements.json` and `final-measurement-summary.json`. The older `sampler-*` files retain the anisotropy-4 diagnostic that exposed the separate boundary defect.

## Filtering defect and exact correction

The initial stochastic prototype with anisotropy 4 showed a few flat mip rows at phase boundaries on the native ANGLE/Mesa renderer. Moving derivative evaluation before the lattice selection, and then making selection branchless, left the output unchanged: the initial branch hypothesis was disproved. Changing only the rock texture's anisotropy to 1 removed those rows. The final implementation therefore uses rock-only anisotropy 1, with ordinary trilinear mip filtering and the original explicit UV derivatives. Soil, sand, bark and moss retain anisotropy 4.

This is an observed renderer interaction with discontinuous phase coordinates; no claim is made that every browser GPU has the same problem. Anisotropy 1 can reduce detail at grazing viewing angles. The final close/context controls do not show broad blurring, but browser/mobile filtering and performance still need root's full-scene review.

Three translated source samples use normalized barycentric weights sharpened to the sixth power. Each cell mostly preserves one source sample; transitions blend adjacent source regions. The original albedo, OpenGL normal and ARM always share coordinates, phase offsets, weights and derivatives. No rotation, rescaling, new noise albedo or per-channel gains are introduced. Triplanar axes and the 5.7483 m physical scale remain unchanged.

The stone portion increases from two to three texture taps per projection, or 18 to 27 rock-map taps for the three-map triplanar evaluation. This is a material cost to check in the production scene; native timings are not browser FPS evidence.

## Package and scope

- `stochastic-stone-review.patch`: review-ready changes for `src/render/ground-materials.ts` and rock-only filtering in `src/world/assets.ts`.
- `ground-materials-candidate.ts`, `assets-candidate.ts`: complete candidate copies, scratch only.
- `stochastic-stone.ts`: native study hook and actual GLSL.
- `provenance.json`: source metadata, original file hashes and modifications. All three current source hashes match the production manifest.
- `render-final.mjs`, `final-proof.json`: six actual native ANGLE/Mesa llvmpipe frames, all GL errors 0, shader errors 0, exit 0. Peak RSS **1,287.566 MB**.
- `render-controls.mjs`, `render-proof.json`: initial four controlled terrain frames.
- `render-sampler-probe.mjs`, `measure-isotropic-sampler.py`: reproducible direct-sampler evidence.

Source: [Poly Haven Marble Cliff03](https://polyhaven.com/a/marble_cliff_03), Amal Kumar, [CC0](https://polyhaven.com/license). Original source extent from retained official metadata: 5748.308659 mm square. Existing production 2K WebP conversions are retained byte-for-byte.

All terrain views are isolated actual 520 by 520 m native geometry crops on the production two-metre grid. Vegetation, separate rocks, ocean and distant terrain are omitted. No browser or full-scene QA is claimed. No production files were modified.
