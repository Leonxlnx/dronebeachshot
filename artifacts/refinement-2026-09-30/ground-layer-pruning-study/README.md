# Exact-zero ground layer pruning — source proposal only

**Historical proposal record:** root has since integrated the combined controls,
both defaulting to 0. Do not reapply these archived patches to current source.
The builder now reconstructs the historical candidate from SHA-verified git
`c604d90`; current-source tests and the replay probe inspect the real integrated
implementation separately. See `../ground-layer-pruning-gpu/README.md` for the
narrow actual result: every tested PNG pair matched, but core mode2 retained
small unexplained Float32 differences and has no measured speedup claim.

Production source, the pinned film, and the active capture harness were not
changed. No GPU or browser was started. Both proposed patches pass
`git apply --check`; TypeScript transpilation reports no syntax errors. This is
not a shader compilation, pixel-equivalence, or performance acceptance result.

Use **one** of these unapplied patches:

- `proposed-ground-layer-pruning.patch`: this study alone.
- `proposed-ground-layer-pruning-with-ripple.patch`: this study plus the earlier,
  still-unaccepted sand-ripple filter proposal. It was composed in a temporary
  copy, preserves the ripple control/phase/filter, and avoids overlapping patch
  hunks. Do not additionally apply the standalone ripple patch to it.

The isolated builder is `scripts/control/studies/ground-layer-pruning-study.mjs`.
The `.proposed.ts` files are reviewable outputs, not imported production code.
`source-snapshot.json` records both original source identities. Root must add the
inspection setter/getter for `groundLayerPruning` if proceeding to the GPU study.

## Mask and gradient design

With `c=cliff`, `m=moss*.76`, and `s=sediment`, all three source responses use the
same nested mixes, whose effective mathematical weights are:

| Layer | Effective weight | Required source sample |
| --- | --- | --- |
| Soil | `(1-s)*(1-m)*(1-c)` | `s!=1 && m!=1 && c!=1` |
| Stone | `(1-s)*(1-m)*c` | `s!=1 && m!=1 && c!=0` |
| Moss | `(1-s)*m` | `s!=1 && m!=0` |
| Sand | `s` | `s!=0` |

The predicates compare exact individual factors. They neither use an epsilon
nor compute a product that could underflow and incorrectly erase a tiny positive
contribution. Skipped values are finite zero; the existing nested mixes and
downstream arithmetic remain in their original order. No triplanar axis or
source-phase sample is pruned independently.

Mode 0 retains original sampling. Mode 1 uses explicit gradients while sampling
every layer. Mode 2 adds the exact predicates. The shared control defaults to 0.
Separating modes 1 and 2 lets later pixel tests distinguish a texture-filtering
difference from an invalid mask. The existing rock material and shared original
projection helpers remain byte-identical in the proposal.

All prunable samples use `textureGrad`. Derivatives of the exact, already-scaled
source coordinates are evaluated before varying branches: `gp/5.7483`, `gp*.5`,
`gp/3`, `gp/23` and `gp.xz*.5`. This intentionally avoids reassociating
`dFdx(gp/scale)` into `dFdx(gp)/scale`. Stone bedding applies its same zy/yz
selection to the supplied gradients; the source-phase offsets keep using the
unshifted source gradients. None of the new branched sampling helpers contains
`dFdx`, `dFdy` or implicit `texture2D` calls. The existing sandFootprint derivative
is still unconditional after the albedo branches reconverge.

Mineral relief remains a separate additive path. Its original control,
normalization and full weight expression are unchanged; in modes 1/2 it receives
precomputed explicit gradients. This initial proposal does **not** prune mineral
relief beyond its existing strength-zero branch. Wetness, film roughness, AO,
macro modulation, sand grain, ripple phase, and debug outputs remain intact.

## Distant terrain exception

`createCoastalContinuation` consumes soil/living/stone/sand outside the core
mixes and rewrites cliff/moss/sediment before ARM and normals. Core predicates
are invalid for that wrapper. The constructor therefore defaults to no opt-in,
binding an independent mode-0 uniform. The continuation explicitly passes false;
only the central terrain explicitly passes true. Changing the shared study
uniform cannot activate pruning for the continuation. No texture or quality
savings are claimed for the distant terrain.

## Logical lookup opportunities

At mineralRelief=0, the source has 48 logical texture operations per ground
fragment: stone 27 (three phases × three projections × three response textures),
soil 9, moss 9, and sand 3.

| Core mask | Baseline | Proposed mode 2 | Logical reduction |
| --- | ---: | ---: | ---: |
| Fully mixed | 48 | 48 | 0% |
| Pure sediment `s=1` | 48 | 3 | 93.75% |
| Pure soil `s=0,c=0,m=0` | 48 | 9 | 81.25% |
| Pure stone `s=0,c=1,m=0` | 48 | 27 | 43.75% |
| No stone, other layers partial | 48 | 21 | 56.25% |
| No moss, other layers partial | 48 | 39 | 18.75% |

These are source-level counts, not measured GPU savings. They exclude habitat
and lighting textures, hardware anisotropic/trilinear taps, and helper-lane
execution. Mixed quads can execute both branch sides; extra registers/branches
and derivative work may offset savings. Positive mineral relief adds the same
nine logical source samples to both paths. Geometry and non-ground passes are
unaffected. Core pure-sand refraction is the main candidate for an actual benefit.

## Completed checks and remaining proof

Four focused CPU checks passed in 0.78 seconds total runner time:

- 512 combinations of float32 blend factors, including exact endpoints,
  minimum subnormals and near-one values, across three finite positive/negative
  source payloads: nested arithmetic is unchanged when zero layers are removed.
- Known layer mixtures produce the source counts above.
- A concrete continuation example proves core sediment=1 masks would corrupt its
  albedo and rewritten ARM/normal blend; the explicit opt-out is asserted.
- Original rock source and protected response paths are retained; all new
  sampling helpers consume explicit gradients and TypeScript syntax parses.

Reproduce with:

```sh
node --test scripts/control/studies/ground-layer-pruning-study.test.mjs
```

Before integration acceptance, use a tiny real WebGL2 fixture with production
material hooks/textures and mixed masks crossing 2×2 derivative quads. Compare
the original shader to mode 0, mode 0 to mode 1, then mode 1 to mode 2. Include
grazing/aniso source UVs, both stone-bedding modes, source-phase boundaries,
exact and tiny-positive weights, positive mineral relief, and the opted-out
continuation wrapper. Preserve failure pixels, not only aggregate statistics.
An actual core/refraction timing pair is separately required before making a
performance claim. No GPU work is authorized during the pinned film capture.
