# Cloud sampling diagnosis

The six-frame, sky-only probe supports changing the nominal primary step from 30 m to 15 m. The actual 15 m crop removes the conspicuous repeated cloud contours; the 7.5 m control adds little obvious visual benefit at higher cost. This diagnostic remains evidence from one camera crop. A subsequent two-view full-scene review now accepts the targeted 15 m correction within the bounds described below; neither study establishes full-flight acceptance.

## Historical source and fidelity

Historical local commit IDs are mapped to their published equivalents in `docs/continuation/2026-10-01-github-transfer.json`. For a fresh GitHub checkout, use published baseline `2c3bc7eec0ede6e06116c82003df3e94e2dfb76a` in place of local `4f773c7`; their complete Git trees are identical. The authenticated transfer changed commit metadata, not the recorded source or evidence.

The probe preserves the **30 m baseline** from commit `4f773c7`, whose full-scene source identity is `301d9c4541e7b48f82d7166345cd39f3ebc7b3fba4140549f0ab3d997a6b095f`. Its frozen atmosphere source SHA-256 matches that commit exactly: `8062216960907d9e2de8bd808366860d3d8f7d22ec5374dcdcdbe45e30e8967b`.

The physical 256×128 crop uses the actual 1280×720 camera at 10.5 seconds, offset (220, 0), the production atmosphere, and the production RGBA16F/MSAA4 linear output path. Its first **84 rows match the full-scene baseline byte for byte: 21,504 RGB pixels, zero differences**. The initial top-96 assumption included 104 tree pixels; tree occlusion starts at local row 84. Whole-crop differences therefore do not indicate camera mismatch.

The later 15 m production source is `2721cc2c50655dcfcf593925edd9322fc73ed56d75d540625161b8c13c53f5ce`. It is not the frozen baseline. Its separate 1280×720 shoreline/sunset comparison at 10.5/19.5 seconds completed without reported errors and was independently accepted as a targeted correction. The conspicuous repeated shoreline cloud lines are largely absent, with smoother light gradients and preserved composition. Sunset retains sun/reflection alignment; sand detail, corrected reflection and young woodland remain coherent.

The actual current/control images, states and hashes are recorded in `../final-environment-review/cloud-15m/manifest.json` and `../final-environment-review/cloud-15m-art-review.{json,md}`. Final 101-source-file, 143-test, 43-asset and TypeScript/Vite checks passed. The earlier ordinary-app check passed three functional checks on the 30 m source but timed out during PNG readback; it remains incomplete. No final-pair restored image, zero-aliasing claim, motion/performance proof or 8/10 acceptance is inferred. Clouds remain somewhat stylized, and the smooth cliff and broad wet band remain limitations.

## Component evidence

| Fixed cloud region | 15 m reduction in linear-radiance high-frequency power | Reduction in transmittance power |
| --- | ---: | ---: |
| Lobe A | 89.8% | 86.5% |
| Lobe B | 92.7% | 91.3% |

Constant illumination leaves transmittance bit-identical to the 30 m baseline and still shows the lines. Lobe B's minimum transmittance is 0.060, well above the 0.008 early-exit threshold. Finer primary integration reduces both components, demonstrating density-integration aliasing rather than solely sunlight or final-output quantization. Doubling the density footprint without changing sample spacing provides no meaningful improvement in these regions.

These measurements use fixed regions, vertical mean removal, a Hanning window, and Fourier power at ≥0.2 cycles/pixel. They include genuine cloud edges and are comparative evidence, not quality scores. Exact formulas and region coordinates are in [component-metrics.json](probe-01/component-metrics.json).

## Cost and limits

The 15 m crop uses 243–394 theoretical cells per ray (mean 304.3), compared with 122–197 (mean 152.4) at 30 m. No 15 m rays hit the 512-cell cap; 91.6% of the nominal 7.5 m rays do. Measured render/readback times were 1.205 s, 1.425 s, and 2.383 s respectively, including compilation/readback effects. These tiny-fixture timings do not establish full-flight performance.

Production changes only the nominal visible/cube primary step. The 12–512 limits, density field, lighting, noise, cloud-shadow integration, and output remain unchanged. Three numerical integration tests pass. Baseline restoration was exact in both displayed RGB and raw RGBA16F; the owned browser/server closed without cleanup errors.

[review.json](probe-01/review.json), [results.json](probe-01/results.json), [memory.json](probe-01/memory.json), the original PNGs, and the raw little-endian RGBA16F files retain the evidence. The frozen probe SHA-256 is `157a0b361c1a261d1bebcb91fecc74f57d392bdaaba08babce4371c890cca5b7`; replay uses its prepared routes, since current production source now uses 15 m.

## Reproduction constraints

This is a historical 30 m diagnostic, not a generic probe of current main. `cloud-sampling-probe-page.mjs` deliberately requires the exact `clamp(30.,span/512.,span/12.)` anchor. Current production has advanced to 15 m; preparing fresh routes from current main does not reproduce this experiment and its page rejects that changed anchor.

To prepare it again, use a detached worktree at `4f773c7c721b2ed01917f6dc5396303e269121df` and copy in only `scripts/control/check-cloud-sampling-browser.mjs` and `scripts/control/cloud-sampling-probe-page.mjs` from the later diagnostic commit. Install that worktree's locked Node dependencies with `npm ci`. The recorded run used Node 24.19.0; the driver also needs Python 3 with Pillow for the full-scene PNG comparison, an absolute `BAY_BROWSER_EXECUTABLE`, and the Linux cgroup memory files used by its guard. No browser is launched by `--prepare-only` or `--server-check`.

The reference `final-environment-review/capture/coast-refined-10_5.png` is a private intermediate, not a Git dependency supplied with these compact records. Its required SHA-256 is `6bd5ca6553f43a43574bc8634bfa6227a79b2e917a527f6d4ebdbff3fcaa9f34`. Recover the saved image, or recreate it in the baseline worktree with restored assets, the pinned capture browser/software backend, `scripts/progress-capture.mjs`, `final-environment-review/plan.json`, and `profiles/last-light-bay.json` at 1280×720. The profile SHA-256 is `c52fde34e833e3e7a50865a3960e5a5a970373f46418647a76c8583c6877d8d2`. The historical renderer was Chromium/ANGLE SwiftShader, MSAA4. A different browser/backend may change pixels; the probe verifies the historical PNG hash and must not silently relabel a different image as that reference.

From that prepared baseline worktree, choose a new output directory:

```sh
node scripts/control/check-cloud-sampling-browser.mjs --prepare-only out=artifacts/cloud-sampling-replay
node scripts/control/check-cloud-sampling-browser.mjs run-prepared=artifacts/cloud-sampling-replay/frozen-routes.json --server-check out=artifacts/cloud-sampling-replay
node scripts/control/check-cloud-sampling-browser.mjs run-prepared=artifacts/cloud-sampling-replay/frozen-routes.json out=artifacts/cloud-sampling-replay
```

Alternatively, reuse the locally retained `probe-01/frozen-routes.json` and its `.sha256` sidecar with the same driver and a new output directory. Those saved routes contain the historical browser modules, so replay does not import current production TypeScript. It still requires the exact reference PNG, Node/Playwright, Python/Pillow and the browser executable. The guard starts below 7168 MiB, stops at 7424 MiB working memory, polls every 750 ms and imposes a 120-second total browser deadline.

| Variant | Diagnostic purpose |
| --- | --- |
| `step-30` | Historical production baseline |
| `step-15` | Halve nominal primary spacing, retaining 12–512 cells |
| `step-7p5` | Finer convergence control under the same 512-cell cap |
| `constant-light` | Replace secondary sun transmittance by 1; leave primary density integration unchanged |
| `full-cell-footprint` | Use one full primary cell as the density footprint instead of half a cell |
| `step-30-restore` | Require exact displayed RGB and raw half-float restoration |

Keep the two diagnostic scripts, this README, and compact `probe-01/{preparation,results,component-metrics,review,memory,baseline-comparison,server-check}.json` in the source checkpoint. `frames.json` repeats per-variant rows already in `results.json` and is optional. Keep generated PNGs, `.rgba16f.bin` buffers, copied `source/`, `frozen-routes.json` and its sidecar as untracked local intermediates; they are not needed to review the compact evidence, but saved routes and the reference image are required for replay without reconstructing the historical baseline. No raw pixel or source dump is represented as a fresh-main runnable dependency.
