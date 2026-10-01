# Base Island direct-response scene study

This is an OFF-by-default inspection path. It is not an accepted visual change. Only base Island far crowns are eligible; the family-0 fork-open form is explicitly excluded by its different source framing. Near geometry, Syringa, raw atlas alpha, custom depth, normals, indirect light and specular remain unchanged.

## Bake contract and output

The retained original Island metadata in `docs/native-render/candidates/tree-impostors-corrected/island-metadata.json` records 256-pixel cells, 4× linear supersampling, 4× MSAA, the current near-source SHA, and matching bounds/framing. Published alpha area matches those 24 recorded views within 0.026%. This supports **1024-pixel source renders**. The missing original baker means it does not guarantee exact old alpha reproduction.

One source render per 24 view × 8 relative sun directions produces unit-white-sun `reflectedLight.directDiffuse`, with actual source albedo, normal maps, source self-shadow and per-material transmission included once. Preserve resolved linear raw RGBA16F losslessly with gzip. Derive 256-pixel cells by 4× area integration and 128-pixel cells by a further 2× integration of the same source samples. Keep RGB coverage-premultiplied and A from those same samples.

Runtime storage is a 128×128×192 RGBA16F array, sun-major then camera-view-major, with each layer bottom-first. It is 24 MiB base / approximately 32 MiB including mip levels. Full 256-pixel tiles are retained as authoring evidence, not uploaded. The shader interpolates four views and two sun directions in premultiplied RGBA, then divides RGB by its own filtered A. **Existing map alpha remains the sole runtime opacity.** No old-alpha division, opacity gain, dilation or normal-based compensation is applied.

The conditional response transfer is not automatically energy preserving when old alpha differs from new source coverage. Per-view old/new area, absolute alpha error, mismatched support and old-alpha/own-alpha RGB energy transfer are recorded. Coverage must be exactly invariant across sun directions. All source/import/tool hashes are pinned and checked; incompatible resumed data is rejected.

Authoring output:

`artifacts/refinement-2026-09-30/normal-response-audit/island-response-1024/`

Only after artifact validation, stage these two runtime files:

- `public/assets/studies/island-response/response-manifest.json`
- `public/assets/studies/island-response/island-direct-response.rgba16f`

The intended preload URL is `/assets/studies/island-response/response-manifest.json`.

## GPU execution boundary and recovery

No GPU may start until root releases the tiny-context slot. The driver checks shared memory both before setup and immediately before Chromium launch: below 6 GiB to start, stop its own context above 7.25 GiB. There is one 128-pixel canvas and one reused 1024-pixel 4-sample RGBA16F target, plus the existing 1024-pixel source shadow target. Estimated time is 3–6 minutes; the page budget is 8 minutes and total wall budget 10 minutes. These are estimates, not measured completion time. The larger color target costs about 60 MiB including MSAA color/depth/resolve storage; total process/context overhead is expected to be roughly 0.7–1.0 GiB while the film continues.

```sh
node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-source-direct-response.mjs --gpu --bake-island --output artifacts/refinement-2026-09-30/normal-response-audit/island-response-1024
```

After every completed layer, its compressed raw data and 256/128-pixel response files are saved, hashed, and recorded through an atomic `layer-checkpoints.json` replacement. Repeating the same command resumes validated finished layers. The driver checks pinned source hashes and each checkpoint file before opening Chromium. It refuses modified dependencies or data. An already completed `results.json` is not overwritten; completed source evidence must not be silently replaced. Final `manifest.json` is written only after all 192 layers and browser checks succeed.

## Main and capture integration — root-owned

Import these functions from `src/render/island-direct-response.ts`:

```ts
loadIslandDirectResponseStudy
setIslandDirectResponseStudy
getIslandDirectResponseStudy
disposeIslandDirectResponseStudy
```

There is **no per-frame preparation function and no extra render pass**. `createTreeImpostor` already registers eligible color materials after their source-visibility binding; cloud and aerial hooks remain in their existing order.

For a query explicitly requested in capture/inspection mode, await `loadIslandDirectResponseStudy('/assets/studies/island-response/response-manifest.json')` **before scene readiness and the capture harness's network drain/offline switch**. Loading validates manifest/source identity, payload SHA/length, finite data, nonempty layers, and sun-invariant coverage. It leaves the effect disabled. Ordinary application startup must not invoke this loader. A preload error should fail that explicitly requested study, without substituting another atlas.

Expose a synchronous guarded API alongside the other study controls:

```ts
setIslandDirectResponse: (value: boolean) => {
  inspection();
  return setIslandDirectResponseStudy(boolean(value, 'Island direct response'));
},
getIslandDirectResponse: getIslandDirectResponseStudy,
```

The boolean toggle performs no network work. It requires a validated preloaded atlas. It recompiles only registered Island far color materials through a dedicated program define; OFF retrieves the original shader. Include `getIslandDirectResponseStudy()` in captured settings/stats so the manifest records enabled state, atlas digest and registered-material count. Do not toggle while an inspected frame is active. Call `disposeIslandDirectResponseStudy()` in final application teardown before material disposal; registry entries remove themselves when materials dispose. The helper owns its response texture exclusively.

## Scene comparison gate

At flight times **0 and 5 seconds**, capture this four-way matrix using the same pinned build, camera, quality, atmosphere, exposure, shadow settings and final-output path:

| Variant | Island response | Far blending |
| --- | --- | --- |
| A | OFF | OFF |
| B | ON | OFF |
| C | OFF | ON |
| D | ON | ON |

Compare A/B and C/D first: within each pair, response must preserve alpha, depth masks and all non-Island material behavior. Keep root-seeded alpha hashing off so the third coverage study does not enter the comparison. Prefer one fixed linear-main setting for the whole matrix; when blending is evaluated, linear main output avoids blending tone-mapped sRGB. Do not change linear output only for the blended pair and then attribute its changes solely to coverage.

The opening hill is the principal visual gate: it is backlit, remote Island roots are upright/uniform, and the current canopy is brown, flat and stippled. Judge crown volume, color distribution, continuity, edge halos and visible noise in actual images. Error reductions in isolated unit-sun cutouts do not constitute acceptance. The 5-second view checks whether near/far transitions and other tree families become visibly inconsistent.

## Explicit approximation limits

- The response multiplies current direct-light color once, retaining external scene shadows and cloud attenuation. Its source self-visibility is already baked. The known sun-facing depth/view-facing quad self-shadow artifact is unchanged.
- Instance/material tint is applied once to baked RGB. Forward diffuse tint is linear; source leaf transmission has a nonlinear albedo power, so this is an approximation for backlit transmission. Actual core and remote tints must be in the scene gate.
- Source sun elevation is fixed at 6.021653966 degrees. Current core root lean is approximately 0.9–3.2 degrees and some roots have nonuniform width. Those transformed-normal effects and animated source wind are not rebaked. Remote roots are upright with uniform scale, making them the cleaner initial target.
- Four camera-view and two sun-frame interpolation retain the demonstrated intermediate-angle errors. There is no artistic darkening factor to conceal those errors.
- Shader composition and loader lifecycle are CPU-validated. The complete atlas is validated; the actual ON shader and full scene still require their GPU/visual gate.

## Completed CPU validation

TypeScript `tsc --noEmit` passes. `check-island-direct-response.mjs` passes 22 checks covering actual material-chain composition, exact OFF shader restoration, unchanged depth/flags, source/form exclusion, loader validation and cancellation. The retained pilot math/composition checks pass 17 checks. `check-island-bake-checkpoints.mjs` passes 10 checks using one synthetic 1024-pixel source raster and 191 resumed layers, verifying integration, layer placement, checkpoint completion and final runtime payload validation without a GPU.

## Live authoring recovery

The first run completed 48 layers in about184seconds and then stopped cleanly when a transitive, unrelated `math.ts` dependency changed in the shared working tree. All48 records and file hashes are preserved in `island-response-1024/recovery-evidence.json`. The exact old math bytes were recovered from git657b5c8. All33 pinned dependencies are verified under `island-response-1024/authoring-source/`; resume runs the unchanged driver there, with an absolute output path pointing to the original checkpoint folder. Current production edits no longer affect those authoring inputs. The observed render/save rate is roughly3–4seconds perlayer, making the original3–6minute estimate optimistic; bounded checkpointed resumes retain the original8/10minute limits.

A loader lifecycle guard now rejects enabling the study while an atlas replacement is pending, even if an older atlas is ready. The normal explicit preload-before-ready flow is unchanged. The added ready-A/pending-B regression check passes.

The runtime manifest is named `response-manifest.json` so root can include both it and the binary in the exhaustive public asset catalog and a derived recovery archive. Root owns that catalog/archive integration and main/capture URL change. Runtime asset/restoration acceptance is pending those changes; authoring `manifest.json` keeps its original name.

## Completed source bake

All192 layers are complete and staged at the runtime paths above. The source bake used four bounded contexts totaling768.163seconds: the first stopped on an unrelated source hash change; frozen-source resume stopped at its480-second page cap; the next stopped at the7.25GiB shared-memory guard with191layers saved; the last completed the remaining layer and assembly in19.97seconds. No guard was raised. Final browser closed2026-10-01T06:51:42Z. Per-attempt memory/time records, unchanged original48records, exact frozen-source hashes and staged asset identities are in `island-response-1024/recovery-evidence.json`. Old failure/held files remain historical evidence and do not override successful `results.json`/`manifest.json`.

The comprehensive serial audit checked all192 raw1024rasters through256/128integration and final layer ordering: **zero different half-float words**, finite/nonnegative/nonempty data, no RGB without coverage, exact per-view alpha across all8suns, all compressed/raw/tile/payload hashes valid. Peak CPU audit memory44.55MiB,29.51seconds. The actual production manifest/payload validator passed and remainsOFF.

Final coverage-area ratio is1.001859–1.005156; pixelwise absolute alpha error remains4.1339–6.1824%of old coverage. Transferring conditional response through unchanged old alpha gives0.990988–0.998709of unit-source luminance (mean0.996067); half encoding adds0.0339–0.0372%loss. These are white-tint base-cell metrics, not actual-scene or interpolated-view acceptance. Payload is25,165,824bytes, SHA256`9f1e04acf3995292adb4a7bba6c28ba28088cd37a3e7e90374a4fac3d564f63f`. The runtime manifest is335,275bytes, SHA256`1935e1b8bd002959861fb97b768f8e9e184a71e08a5906f5eaa5987e65144601`. Water/root own master catalog and recovery archive integration.
