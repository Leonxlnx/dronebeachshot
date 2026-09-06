# Native visual diagnostic renderer

The managed browser cannot initialize even a 16×16 WebGL context: it reports
`GL_RENDERER = Disabled` and `BindToCurrentSequence failed`. The result is saved
in `artifacts/graphics-recovery/browser-context.json`. The same error occurs
before any scene resources load.

An independent **native graphics library**, `node-gles-webgl2@0.4.0`, can execute
WebGL2 through ANGLE → Mesa surfaceless EGL → llvmpipe. This starts no browser
and controls no alternate browser service. The 16×16 clear/readback probe passed
with RGBA `[51, 102, 153, 255]` and GL error 0. See `probe-result.json`.

This route is for visual and shader diagnosis of the same production modules.
It cannot establish browser compatibility, browser interaction behavior,
mobile performance, or consumer-GPU frame rates. It is not a substitute for
the final browser-rendered film and final browser acceptance.

## Reproduction

Use an isolated tooling directory outside production dependencies. Install the
exact package versions in the accompanying package lock. In this container,
node-gyp's automatic header extraction fails at `fchown`; downloading the
official Node 24.19.0 headers and extracting with `tar --no-same-owner` avoids
changing file ownership. Pass that directory as `npm_config_nodedir` for the
native package build.

Apply `surfaceless-angle.patch` to the installed package's
`binding/egl_context_wrapper.cc`, then rebuild the native addon with node-gyp.
This requests the surfaceless EGL platform explicitly; it changes only native
graphics initialization, not the scene or its production browser build.

Extract the two official Ubuntu packages identified by URL and SHA256 in
`egl-options.md` into `mesa/`. They match the already-installed Mesa gallium
25.2.8 library. Set process-local `LD_LIBRARY_PATH` to `mesa/usr/lib/x86_64-linux-gnu`
and `__EGL_VENDOR_LIBRARY_FILENAMES` to
`mesa/usr/share/glvnd/egl_vendor.d/50_mesa.json`. Set `LIBGL_ALWAYS_SOFTWARE=1`.
No system package installation or graphics setting change is required.

`native-asset-adapter.mjs` replaces image/file I/O only. Its audit passed all
14 standalone textures and nine GLBs, retaining actual material extensions,
alpha masks, UV transforms, sampling and color-space metadata.

Run `render-scene.mjs` with the project's `scripts/control/ts-resolve.mjs`
Node loader. The first argument is an evaluation camera name or `flight-N`
time, the second is width, and the third is diagnostic mode. It reads the real
`src/world`, `src/render` and `src/camera` modules, creates the actual coastal
field, and uses the real refraction, cloud, environment, shadow and foliage
passes. The native default framebuffer may differ from browser MSAA. The
saved metadata records renderer, source hashes, shader errors and draw counts.

Native framebuffer/resource identity and Boolean uniforms are now adapted by
`native-gl-compat.mjs`; real world frames have completed with zero shader/GL
errors. `render-scene-batch.mjs` is the current multi-camera harness. It reads
real production sources and records their hashes. The first real compile found
and fixed a reserved GLSL identifier in the ocean shader. The actual images
remain far below reference quality; see `cycles-02-07-review.md`.

## 2026-09-06 continuation

`render-scene-batch.mjs` now resolves its own repository root, adapts local raw
atlas fetches, supplies the terrain to ocean/vegetation construction, and calls
the production shadow/main foliage packing phases. These were harness defects;
old harness images cannot establish the current production scene composition.

Set `BAY_OUTPUT_DIR` to choose the evidence directory and `BAY_NATIVE_SAMPLES=4`
for explicit offscreen MSAA with the official Three.js OutputPass. The optional
`BAY_REVIEW_CAMERAS` JSON file accepts diagnostic camera names with finite
`position`, `target` triples and a `time` in 0–20. Reserved production evaluation
names cannot be overridden. Actual pose and override status are recorded with
each image; extra diagnostic views do not count as final-gallery cameras.

For isolated material diagnosis, `BAY_OMIT_VEGETATION=1` omits trees, ground cover,
forest floor and understory. Each image records these omissions explicitly;
such views cannot establish complete landscape quality. `BAY_OCEAN_CANDIDATE`
may select a frozen alternate ocean module by file URL. Its path and SHA-256 are
recorded separately from the full production source manifest, as are existing
terrain and fog candidate overrides. Use identical settings for both sides of
a material comparison.

The checked-in `artifacts/continuation/` comparison is 960×540 and is explicitly
not the required 4K browser gallery. Source hashes accompany each frame. See
`../continuation/REVIEW.md` for interpretation and unresolved visual defects.
