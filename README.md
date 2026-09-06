# Last Light Bay — incomplete implementation checkpoint

A true Three.js coastal environment with a deterministic 20-second route from the highest summit, down into the bay, along the beach and out toward the sunset. This checkpoint is **not visually accepted** and is **not the completed 24-hour deliverable**.

## Run the source

Use Node 22.12+ or 24, then run `npm ci` and `npm run dev`. Development and build commands automatically restore the vendored models and textures from the checked-in archive using Node, validating every SHA-256 checksum. Existing edited assets are preserved and reported instead of overwritten. No Python installation is needed to run or build the app. Open the local address reported by Vite in a WebGL2-capable browser. `npm run build` creates a self-contained static build in `dist/`; all runtime assets are local. Serving `dist/` requires a normal HTTP static server, not opening index.html through file://.

Controls: Begin flight; Space to pause/resume; R to replay; arrow keys to move by half a second; drag to look around while paused; touch controls, sound and quality settings are available. Reduced-motion users begin paused. `?inspect=1` exposes named evaluation cameras and diagnostic modes. `?capture=1&quality=high&t=0` hides the interface and fixes time.

## Current status

The 2026-09-06 continuation adds 37 grounded tidal rock instances, distant cloud
occlusion, sand minification filtering, shared embedded texture images and exact
terrain-height memoization. Playback and capture state handling were repaired.
See [the continuation review](docs/continuation/REVIEW.md) for current evidence,
before/after frames, limitations and the remaining acceptance work.

The TypeScript/source checks, deterministic terrain and camera tests, GLB resource checks and production build are verified separately from completion. `npm run verify` intentionally exits nonzero until every completion condition is met. It is not appropriate to weaken its conditions to label this checkpoint finished.

The managed browser cannot create even a 16×16 WebGL context. An independent native
ANGLE/Mesa renderer now executes the actual production Three.js modules and has
produced a baseline and repeated diagnostic iterations. It starts no browser.
Native images exposed and helped correct real shader, geometry, foliage, sky and
water defects. The scene is still visibly below the supplied reference quality.
No accepted browser refinement cycle, final gallery, final film, consumer FPS,
mobile/offline browser result or final main push is claimed.

The largest remaining art problems are the radial cone landforms, sparse/pale
far canopy, procedural cloud shapes, remote terrain and overly uniform surf.
See `RUN_REPORT.md`, `docs/native-render/cycles-02-07-review.md`, `GATES.md` and
`RUN_STATE.json`. Authored ridge and source-tree impostor candidates are in active
review and are not represented as completed production features.

## Verification and capture

- `npm run verify:build`: source checks, 25 tests (including fresh asset recovery), actual texture-alpha/license/checksum inspection, CPU world-geometry construction, TypeScript and production build.
- `npm run check:landscape`: independent cliff topology/contact and tree intersection checks, deterministic distant canopy/grounding checks, and offshore shelter/clearance controls.
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

Sites identity has been registered but no version was published. Preserve `.openai/hosting.json` when resuming; do not create a second Site. Final commit/push to main remains conditional on complete acceptance.
