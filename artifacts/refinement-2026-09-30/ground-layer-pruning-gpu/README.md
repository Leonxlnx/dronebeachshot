# Actual tiny ground material differential

The one-context 128×128 WebGL2 run completed 52 frames and 38 adjacent variant
comparisons in 8.18 seconds. The browser and local server are closed. No
production source, build, film or capture harness was changed. Source hashes
were checked again on exit. The start guard required less than 6 GiB cgroup
memory, and a 500 ms monitor would abort above 7.25 GiB; the sampled peak was
6.142 GiB. There were no shader, page, console or request failures.

This run does **not** establish universal float-exact equivalence:

| Comparison | Pairs | Linear Float32 result | Encoded PNG result |
| --- | ---: | --- | --- |
| Original ground → candidate mode 0 | 12 | All exact | All byte-identical |
| Candidate mode 0 → mode 1 | 12 | All exact | All byte-identical |
| Core mode 1 → mode 2 | 8 | Small differences | All byte-identical |
| Opted-out continuation mode 1 → mode 2 | 4 | All exact | All byte-identical |
| Original rock → candidate rock | 2 | All exact | All byte-identical |

The eight core pruning pairs differed in 251–946 of 16,384 linear pixels. The
largest absolute component difference was 0.00000721216 for synthetic pure
sand, or 0.00000530481 with the source-derived sand textures. Other core cases
were at most 0.000000238419. **Not one encoded PNG component changed** across
all 38 pairs; the entire paired PNG files were byte-identical.

Mode 1 converts implicit texture sampling to explicit source gradients while
retaining every layer; those comparisons are exact here. Mode 2 substitutes
finite zeros for mathematically zero-weight source layers. Endpoint evaluation
of GLSL `mix` in finite precision is a plausible source of its tiny differences,
amplified by the near-sand specular response. The driver lowering was not traced,
so this is an inference, not a proven cause. Do not describe mode 2 as universally
float-identical based on this run, or silently relax the raw comparison.

The source256 original/candidate pure-sand previews, mixed-mask checker and
continuation preview were visually inspected. They contain visible lit texture
variation, with no observed pair difference or seam. Every frame separately
asserted finite RGBA, over 99% lit/opaque surface coverage, nonconstant luminance
and a bounded lighting range. Blank renders cannot satisfy these checks.

## Inputs and actual implementation

`scripts/control/check-ground-layer-pruning-gpu.mjs` serves the unchanged actual
ground material and the isolated candidate through separate transpiled virtual
TS routes. It extracts and runs the actual continuation shader wrapper from
terrain.ts, including its later layer reads and mask rewrites. The continuation
candidate binds its independently locked mode-0 uniform. Both variants have
distinct fixture program keys; the continuation's production key override
therefore cannot accidentally make the candidate reuse the original program.
The actual rock material is also exercised separately.

The shader math/noise/coast GLSL is source-derived. A diagnostic 2×2 habitat
texture avoids generating the full terrain ecology field. The tiny plane supplies
controlled world positions, normals, and per-pixel layer masks across 2×2
derivative quads. Cases cover pure sand, fully and partially mixed layers,
source-phase boundaries, elongated grazing footprints, both stone bedding modes,
positive mineral relief and two actual continuation-wrapper configurations.
The minimum-subnormal mask case may be flushed to zero by a GPU; the CPU checks
separately cover exact tiny-positive predicates. This run does not establish
cross-driver subnormal behavior.

There are two input sets: synthetic diagnostic textures and 256px copies of all
twelve production ground textures. `source256/manifest.json` records original
and copy hashes and the downsampling method. Sampler wrapping, min/mag filters,
mip generation, color space, flipY and anisotropy match the production settings
(rock=1, other layers=4). The downsampled inputs are clearly **not** the full
production 2k textures, and the plane is not a full-scene capture.

Rendering uses a real MeshStandardMaterial with directional/hemisphere lighting
into a linear Float32 target. PNG previews apply only standard sRGB encoding to
those captured pixels. `results.json` retains every linear difference count,
maximum, RMS and first differing pixel. `.f32` files preserve both raw buffers
where differences occurred. `png-comparisons.json` contains the stricter
file-byte check on every encoded pair.

## Remaining scope

This is a bounded material equivalence study, not a performance measurement.
Per-frame wall times include startup, compilation and readback and must not be
used as speedup claims. The full production texture set, actual scene/refraction
output, other drivers, and final capture settings remain untested. Root
subsequently accepted this evidence narrowly and integrated both inspection
controls, with `groundLayerPruning=0` and `sandRippleFilter=0` by default. The
recorded GPU run tested the isolated pruning candidate before that combined
integration; no repeat render is claimed for the newly integrated source. Any
follow-up GPU use must be coordinated with the team's active probe/film slots.

## Reproduction after integration

`scripts/control/studies/ground-study-baseline.mjs` loads the original ground
material and terrain wrapper from git commit
`c604d9004ccecce4a27fc7b99d4a629458022536` and verifies their recorded SHA-256
hashes. Both are exact matches for this run's original source. Historical
proposal builders now default to that frozen source and reject an already
integrated input. The CPU tests inspect the actual current integrated code
separately; they do not apply the patch to it again.

The GPU harness now serves this frozen original and the **actual current**
ground/terrain candidate through virtual TS routes. It explicitly holds the
independent sandRippleFilter control at 0. Future output goes to a new
timestamped `replays/` folder, or a fresh `out=...` folder; it refuses to overwrite
this original evidence directory or any completed replay. Existing `results.json`
and `prepared.json` here still describe the original run and were not rewritten.

CPU preparation only (no browser/context):

```sh
node scripts/control/check-ground-layer-pruning-gpu.mjs
node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs --test scripts/control/studies/sand-ripple-filter-study.test.mjs scripts/control/studies/ground-layer-pruning-study.test.mjs
```

A future authorized `--gpu` invocation uses the same source256 diagnostic inputs
under this folder. Their source/copy identities and exact downsampling recipe
are retained in `source256/manifest.json`; they remain distinct from full 2k
production maps. Preparing the current candidate is not an additional GPU proof.
