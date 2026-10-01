# Reviewed application appearance

`src/app/canonical-look.ts` holds the reviewed lighting, cloud and surface settings used by ordinary and inspection startup. It matches those settings in `profiles/last-light-bay.json`: warmer sand, the revised grass palette, restrained sand ripples, aligned stone bedding, cloud coverage 0.4 with cloud morphology enabled, and the accepted sun/sky/fog values.

The app applies these settings before its first lighting update and shader compilation. It validates the Island source-response atlas before reporting readiness. Balanced and high quality enable that response for the base Island far crowns; low quality disables it. Every ordinary app tier downloads and retains the 24 MiB payload, including low, so later quality changes remain synchronous. If inspection explicitly loads a replacement atlas, quality changes leave its response disabled until loading finishes. Low has a deliberately simpler forest response.

Balanced and high quality also enable the accepted coastal reflection with wave distortion 1. This adds a mirrored scene pass at half the canvas dimensions. Low skips that pass. If the reflection capability check explicitly reports unsupported RGBA16F/MSAA4, ordinary startup or quality selection disables the optional pass. An explicit unsupported error during actual framebuffer validation can also disable it in the ordinary app, after the pass has restored its state and both a direct WebGL context-loss check and scene readiness pass. Arbitrary errors, restoration failures and failed graphics sessions still propagate; capture and inspection rendering remain strict.

Ordinary app output remains the native canvas at sample scale 1, preserving its existing device and performance policy. The explicit offline capture profile uses the separate linear output path at scale 1. The app does not enable 2× supersampling by default.

Capture startup retains its original baseline and does not automatically load or enable the response atlas. Capture profiles and comparisons remain explicit. Public lighting, surface and study setters retain their inspection-mode and readiness guards; only private startup helpers can apply the reviewed defaults before readiness.

Validation: TypeScript checking, the source check, six existing capture-state/readiness checks, and manual parity of all 19 canonical settings against the checked-in capture profile passed. Six source-extracted quality-policy checks also cover supported high/balanced, low disabled, explicit unsupported fallback, unrelated-error propagation and untouched capture behavior. A final ordinary-app image check is still required; these CPU checks do not establish visual or performance acceptance on a device.

The runtime fallback correction additionally passes all six reflection-pass tests and three readiness tests. Thirteen source-extracted main-policy checks cover pending atlas loads across all tiers, normal fallback, strict capture/inspection, restoration aggregation, sticky unsupported state, direct context loss before event delivery, failed readiness and successful rendering.

Final bounded visual review accepts the 15 m primary cloud-sampling correction
in actual 1280×720 shoreline and sunset frames at 10.5/19.5 seconds, using source
`2721cc2c50655dcfcf593925edd9322fc73ed56d75d540625161b8c13c53f5ce` and the
canonical capture profile. The conspicuous repeated cloud lines are largely
absent while composition, sun/reflection alignment, retained sand detail,
corrected coastal reflection and the enabled 16-tree young woodland remain
coherent. The original 14,000-tree cohort is unchanged. This does not establish
motion quality, full-route consistency, device performance or an 8/10 rating;
stylized cloud forms, smooth cliff faces and the broad wet band remain limits.

That final source passes 101 source-file checks, 143/143 tests, 43 asset checksum
checks, TypeScript and Vite. Actual ordinary-app startup defaults, guarded study
access and low/high quality switching passed on the preceding `301d9c…` source.
Its PNG readback timed out after 180 seconds without browser/load errors, so the
ordinary-app image smoke remains incomplete. Profile-driven final stills do not
replace it. Evidence is in
`artifacts/refinement-2026-09-30/final-environment-review/cloud-15m-art-review.json`
and `cloud-15m-source-checks.json`; actual laptop GPU/OS execution is unverified.
