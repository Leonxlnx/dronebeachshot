# Last Light Bay — incomplete implementation checkpoint

A true Three.js coastal environment with a deterministic 20-second route from the highest summit, down into the bay, along the beach and out toward the sunset. This checkpoint is **not visually accepted** and is **not the completed 24-hour deliverable**.

## Run the source

Use Node 22.12+ or 24, then run `npm ci` and `npm run dev`. Development and build commands automatically restore the vendored models and textures from the checked-in archive using Node, validating every SHA-256 checksum. Existing edited assets are preserved and reported instead of overwritten. No Python installation is needed to run or build the app. Open the local address reported by Vite in a WebGL2-capable browser. `npm run build` creates a self-contained static build in `dist/`; all runtime assets are local. Serving `dist/` requires a normal HTTP static server, not opening index.html through file://.

Controls: Begin flight; Space to pause/resume; R to replay; arrow keys to move by half a second; drag to look around while paused; touch controls, sound and quality settings are available. Reduced-motion users begin paused. `?inspect=1` exposes named evaluation cameras and diagnostic modes. `?capture=1&quality=high&t=0` hides the interface and fixes time.

## Current status — 2026-10-01

The current continuation works directly on `main`. Ordinary app startup now uses
reviewed warmer sand, a less chalky grass palette, clearer lighting and fog,
wind-shaped clouds at coverage 0.4, and source-based distant crown lighting in
balanced/high quality. [Application appearance](docs/canonical-look.md) explains
the defaults and their device costs. The same artistic settings are recorded in
`profiles/last-light-bay.json` for reproducible local capture.

Actual WebGL2/SwiftShader screenshots now exist: the 47-frame comparison series
checked grass, output sampling, crown response, sand, clouds and reflections.
The separate east-spur comparison was visually rejected; its smooth pale bulge
remains disabled. The old reflection produced hard bands. Its corrected
footprint removes those slits and was accepted in six frames at two shore poses.
Three later 1280×720 combined views at 9, 10.5 and 12 seconds also support a
narrow acceptance of 16 additional young woodland trees. That addition is now
enabled; the original 14,000-tree cohort is unchanged. The gain is modest and
does not establish full-route or motion acceptance.

The latest candidate stabilizes the primary cloud integration grid and retains
already mip-filtered sand albedo instead of fading its variation out a second
time. Its TypeScript/Vite build, 43 asset checks and all 143 tests passed. Actual
1280×720 shore and sunset images accept the retained sand detail as a bounded
improvement. Fine cloud contours remain visible, so their removal is not
accepted; a focused sky-only diagnosis is in progress. The normal app passed
startup defaults, study-access and low/high quality-switch checks, but its final
software PNG readback exceeded the 180-second test deadline. That smoke run is
recorded as incomplete, not a full pass.

The user cancelled further cloud video rendering in favour of environment work
and screenshots. The interrupted 24-fps prefix is preserved; no completed movie
is claimed. Use the [German local GPU handoff](docs/continuation/2026-10-01-local-render-handoff.md)
for four hardware screenshots followed by a 20-second 1440p60 master and 1080p60
copy. Hardware mode rejects known software renderers and supports verified PNG
checkpoint resume. Actual laptop hardware and OS execution remain unverified.

The cliff's broad smooth faces, the wet-sand ribbon and some procedural water/
canopy structure still limit realism. This is a refinement checkpoint, not an
8/10 acceptance, final gallery or completed media delivery. `npm run verify`
intentionally remains separate from source/build checks and will fail while
those final project gates are unfinished. See the
[screenshot refinement record](docs/continuation/2026-10-01-screenshot-refinement.md),
`GATES.md` and `RUN_STATE.json` for the evidence and remaining work.

Earlier continuation reports remain historical evidence, not current browser
availability or current acceptance decisions.

## Verification and capture

- `npm run verify:build`: source checks, automated tests (including fresh asset recovery), actual texture-alpha/license/checksum inspection, CPU world-geometry construction, TypeScript and production build.
- `npm run check:landscape`: independent terrain-fracture protection, grounding and route checks, plus offshore shelter/clearance controls. Rejected prototype checkers are archived separately.
- `node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-offshore.mjs`: independent dense route clearance, seabed contact, real wave-shelter rasterization and an empty-scene negative control for offshore rocks.
- `node scripts/control/check-worker.mjs`: after build/world checks, confirms the compiled worker transfers the exact same coastal atlas; CPU-only.
- `node scripts/control/active-time.mjs status`: honestly recorded active intervals. Python checks require Pillow; frame metrics also require NumPy.
- `node scripts/control/final-check.mjs`: full unfinished-deliverable ledger, with nonzero exit until complete.
- `scripts/capture.mjs`: authored Playwright/FFmpeg capture harness for a WebGL2-capable environment. It has not been executed or validated in this session. It accepts a production URL and `baseline`, `gallery` or `video`. Final gallery/video modes refuse to run before eight actual visual cycles and environment gates pass. Browser availability must be established in the environment's permitted way before running it.
- `python3 scripts/control/frame-metrics.py <capture folder>`: luminance, black/clipped percentage, saturation, detail density, duplicate diagnostics and contact sheet from real captured PNGs.

The GitHub workflow runs the build, landscape checks and compiled-worker parity
on pull requests and main updates. A passing source check does not claim the
unfinished browser, art, media or active-time gates.

## Provenance

Runtime Three.js is pinned to 0.185.1. Poly Haven materials/tree and Yughues palm are CC0. All optimized production assets, source pages, creators, modifications and SHA-256 checksums are in `public/assets/manifest.json` and `docs/ASSET_LICENSES.md`. Original environment geometry, shaders, ecology, camera and procedural ambience were authored for this project. No reference image is used as a scene backdrop.

Sites identity has been registered but no version was published. Preserve `.openai/hosting.json` when resuming; do not create a second Site. The user's fresh 2026-10-01 instruction authorizes pushing this unfinished checkpoint to main for the local-render handoff. That authorization does not mark the remaining visual and delivery gates complete.
