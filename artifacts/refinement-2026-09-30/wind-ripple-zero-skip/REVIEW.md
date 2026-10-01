# Exact zero-visibility ripple skip: rejected performance candidate

Decision: **reject adoption for now; production ocean source remains untouched.** One authorized actual 128×128 GLSL fixture completed and closed. Outputs were bit-identical, but the driver query median rose from 1.5566755 ms OFF to 2.915566 ms ON (+87.29%) across eight samples per variant. Numeric equivalence alone does not justify this performance-only change. No rerun or broader benchmark is planned.

The only proposed insertion in `windRipple` is:

```glsl
unresolvedWaterSlopeVariance+=.5*slopeAmplitude*slopeAmplitude*(1.-bandVisibility*bandVisibility);
if(bandVisibility==0.)return vec2(0.);
float phase=dot(p,waveVector)-t*sqrt(9.81*k)+phaseOffset;
```

The variance update remains before the guard. For a finite zero-visibility band, the existing return already contributes zero slope, so phase/cos can be bypassed. Every nonzero band—including partially resolved transitions—executes the original arithmetic. This is an exact computed-zero test, not an epsilon/phase threshold. No change to frequencies, directions, amplitudes, count, derivative stencil, swell, displacement, contact film, foam, reflection or accumulated unresolved roughness is proposed.

`dFdx`/`dFdy` are evaluated in fragment main before discard and passed as values. The guarded function performs no derivatives or texture lookups. It returns from one function, not the fragment. The same shared function remains legal in the vertex shader. At individual zero returns, positive zero can replace an original signed zero; this is recorded explicitly. The deterministic Float32 model shows identical accumulated ripple slope and variance, including these cases. This is not a compiler/GPU proof.

## CPU proof and estimated opportunity

`cpu-proof.json` covers 6,536 deterministic inputs and 418,304 wave evaluations, including visibility boundaries, zero/tiny/large footprints, rotated/anisotropic footprints and varied world position/time. The guard skips 177,037 zero bands; all 241,267 nonzero evaluations remain unchanged, including 43,643 partial-band cases. Accumulated slope and variance are bit-identical in the Float32 JS model.

For the current 64-component spectrum, complete filtering begins when the footprint projected onto a wave direction reaches `3/k`: about 0.07488 m for the shortest band and 4.44052 m for the longest. Direction matters; the scalar maximum footprint alone is not the test.

The actual cinematic camera/FOV/bank was sampled on a 64×36 screen lattice. One-pixel sea-plane ray differences estimate the shader's XZ footprints. Samples are restricted to the water domain with shoreDistance <−12 m. These are **geometric estimates**, not measured derivatives: displaced near waves, wetfilm, terrain/rock/tree occlusion and real helper-fragment behavior are not rendered.

| Width | Time | Median max XZ footprint, m/pixel | Mean zero bands / 64 | Potential phase/cos evaluations skipped |
|---:|---:|---:|---:|---:|
| 384 | 9 s | 1.004 | 35.75 | 55.9% |
| 384 | 10.5 s | 0.662 | 30.80 | 48.1% |
| 640 | 9 s | 0.602 | 28.28 | 44.2% |
| 640 | 10.5 s | 0.400 | 24.12 | 37.7% |
| 1280 | 9 s | 0.299 | 18.70 | 29.2% |
| 1280 | 10.5 s | 0.203 | 16.47 | 25.7% |
| 1920 | 9 s | 0.201 | 14.22 | 22.2% |
| 1920 | 10.5 s | 0.136 | 12.79 | 20.0% |

This is an operation opportunity, **not a speedup claim**. Constant direction/sqrt expressions may already fold; branch instructions, SIMD divergence or compiler predication can reduce or eliminate the gain. The complete ocean shader performs other expensive work unaffected by this change.

## Actual GLSL fixture and negative timing result

`glsl-page.mjs` is raw WebGL2 at 128×128. It uses the exact extracted original/candidate function and all 64 original calls, two small Float32 input textures and an RGBA32F output. It has no Three scene, `createOcean`, terrain, GLB, environment map or full-scene load. Outputs are accumulated slope X/Z and unresolved variance; readbacks compare bits, signed-zero cases, nonfinite values and maximum differences. Alternating timings use disjoint timer queries if available, with wall/fence timings reported separately. Synthetic/data-texture inputs do not reproduce real ocean quad coherence, so isolated timings cannot establish full-frame savings.

Default invocation checks sources/data and **does not launch a browser**:

```sh
node scripts/control/check-wind-ripple-zero-skip.mjs
```

Historical invocation for the one root-authorized run (do not rerun this rejected candidate without a new task):

```sh
node scripts/control/check-wind-ripple-zero-skip.mjs --gpu --working-memory --output artifacts/refinement-2026-09-30/wind-ripple-zero-skip/glsl-run-01
```

Runner uses the shared `createCaptureMemoryGuard` without changing its default. Default total-memory thresholds remain 6144/7424 MiB. This fixture alone opts into the guarded working estimate with `--working-memory`: start below 7168 MiB, abort at 7424 MiB; raw totals, discount and effective totals remain recorded. The discount is a pressure estimate, not guaranteed immediately reclaimable memory. Chromium V8 is capped with `--js-flags=--max-old-space-size=256` (not a Node cap). A 120 s deadline closes only the owned browser. Cleanup attempts browser, guard and server independently and writes `memory.json` even if browser closure rejects, retaining primary and cleanup errors separately. It never launches a full scene. The single actual GPU test is complete; its browser/server closed with no cleanup errors. Working memory started at 7159.62 MiB and peaked at 7311.91 MiB, below the 7424 MiB limit. Raw peak was 7954.27 MiB; the guard did not abort.

The one-line `ocean-wind-ripple-zero-skip.patch` passes `git apply --check`; it has not been applied. `prepare-study.mjs` records source/input hashes and regenerates only study artifacts. The source validator checks both the exact function and every original spectrum call before any future fixture launch.

`glsl-run-01/results.json`, `glsl-run-01/memory.json` and `GPU-DECISION.json` hold the actual evidence. All 65,536 Float32 output components match bit-for-bit, with no nonfinite values or maximum difference. GPU-query means also worsened (1.889756875 ms OFF, 3.63752575 ms ON). Tiny wall medians were 0.80/0.65 ms, while their means worsened to 1.45/1.9625 ms; this noisy wall result does not establish a gain.

The synthesized texture inputs do not preserve the spatial coherence of real sea footprints; divergence could differ in a full ocean draw and has not been isolated. That caveat limits extrapolation, but does not supply evidence of a benefit. Root explicitly rejected integration rather than spending more GPU time on this branch. The patch is retained only as diagnostic history and must remain unapplied.
