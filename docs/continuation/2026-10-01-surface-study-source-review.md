# Candidate 08 surface study: source review

Scope: read-only review of `src/render/ground-materials.ts` and the surface-study controls in `src/main.ts`. No production edits, build, GPU execution, or visual acceptance. CPU terrain samples below are diagnostic approximations, not rendered coverage measurements.

## Isolation and controls

- Defaults remain `sandRipple = 1`, `rockWeathering = 0`. Baseline appearance is intended to be preserved; exact pixel equivalence has not been demonstrated by this review.
- The setter validates every key and finite number in [0, 1] before changing any uniform. It retains the inspection/capture guard. Unknown keys and nonfinite/out-of-range values cannot partially update a study.
- Ground material passes its existing habitat sample to `bedrockAlbedo`; it does not fetch habitat twice for weathering. Rock material adds one unconditional `habitatAt` call, including when weathering is zero. Actual GPU cost has not been measured.

## Sand ripple

The control scales only the existing procedural coast-normal perturbation. Source texture grain, sediment masks, wetness, roughness, wave geometry and shoreline motion are unchanged. The phase has an approximately 0.84 m fundamental period. Its maximum added normal slope after the final 0.38 scale is about 0.0133, or 0.76 degrees, before interaction with other normal detail.

No new normal orientation problem is introduced by the multiplier. The existing approximation points the ripple perturbation along `coastNormal` rather than differentiating the full modulated phase; this is unchanged by the study. The procedural ripple also lacks derivative footprint filtering, although sampled sand detail is filtered. Its existing distance envelope remains fully active seaward over submerged sediment. Reducing strength is therefore a bounded art comparison, not proof of resolved sampling behavior.

Candidate 08 comparison: at cinematic time 10.5, compare `sandRipple: 1` with `sandRipple: 0`, keeping weathering zero and all lighting, linear-output, crown and geometry settings identical. Add 0.2 only if the true pair establishes that these ripples cause the visible rails. Review wet-sand reflections as well as the dry shoreline. A later footprint filter should be a separate change.

## Rock weathering

Weathering changes mineral albedo only. At maximum mask and strength, RGB factors are (0.79, 0.83, 0.86): restrained darkening with modest cooling, no added energy. It does not alter normals, roughness, shadow visibility, source alpha, or illumination. This is plausible as a dry weathering/retention proxy; it does not model current liquid water or an actual drainage network.

The mask is continuous: it combines smooth moisture/exposure thresholds, a height transition from 8 to 35 m, and a normal-orientation envelope. It suppresses near-horizontal surfaces, including ledges, and principally addresses sheltered inclined faces. Habitat is a coarse, bilinearly sampled world field; watch for broad mask-shaped patches or discontinuity where independently modeled rock normals meet terrain normals. There is no new hard threshold or UV seam in this term.

A 4 m CPU grid using current terrain heights, finite-difference normals, and the same mask gives:

| Region | Eligible samples | Nonzero mask | Mask > 0.1 | Mean mask | 95th percentile |
| --- | ---: | ---: | ---: | ---: | ---: |
| Principal face: x -250…-60, z 145…320 | 2,080 | 5 | 1 | 0.000274 | 0 |
| Headland: x 230…420, z -90…150 | 2,288 | 394 | 296 | 0.083684 | 0.782547 |

Eligibility here means terrain height at least 8 m and normal Y at most 0.96. These are region samples, not camera-visible pixels; trees, rocks and terrain occlusion can further limit the effect. The current mask has essentially no coverage on the principal face and should not be represented as a fix for that face's pale appearance.

Candidate 08 comparison: use the named `headland` camera with weathering 0 versus 1, identical other settings. Judge whether material variation becomes legible without flat cool stains or dark collars at rock/terrain joins. If the beauty pair is ambiguous, an albedo diagnostic can distinguish a weak or occluded material mask from lighting. Do not compensate for an ineffective mask by increasing exposure or claiming broader improvement.

Status: source-level study isolation is reasonable. Appearance and performance remain unverified. No acceptance or quality-score claim.
