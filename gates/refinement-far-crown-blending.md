# Inspection study: far crown blending and linear main output

Both controls are **default OFF**. This study is not visual acceptance. Source
atlas RGBA, geometry, instance transforms/colors, near tree materials and custom
hashed shadow depth are preserved. No density or lighting change belongs here.

## Actual source-atlas evidence

`scripts/control/check-far-crown-blending.mjs` used one closed 256×256 SwiftShader
WebGL2 context, actual island/syringa atlases, current impostor/material hooks,
normal atlas, source sun visibility, cloud and aerial hooks. There were no shader,
GL, browser or request errors. The run took 15.17 s and saved 110 PNGs plus
`artifacts/refinement-2026-09-30/far-crown-blending-probe/results.json`.

Across two families, whole-quad footprints 224/72/24 px and four overlapping roots,
ordinary blending's area error against `1-product(1-alpha_i)` was −0.0015% to
+0.0230%; original A2C lost about 27–46%. Expected alpha was sampled from the
same atlas/view/filtering, without threshold or opacity changes. Reference and
framebuffer quantization still limit subpixel precision.

All 12 original stock-depth state/hook/readback comparisons were identical.
All 40 motion poses repeated exactly. For four layers at the 24 px whole-quad
footprint, covered area over five quarter-pixel camera shifts was:

| Family | A2C area range, px² | Blended area range, px² |
|---|---:|---:|
| Island | 43.11–45.10 | 81.76–82.04 |
| Syringa | 34.85–36.85 | 65.93–66.02 |

The inspected blended crowns have continuous fractional edges without the binary
hash stipple. No broad halo appeared in these fixtures. A 24 px quad contains a
crown only roughly 10 px wide, limiting visual judgment. Camera-change metrics
include real silhouette movement and different mean coverage; they do not isolate
perceptual shimmer. No full forest, perspective LOD transition, animation, scene
shadow or environment-cubemap acceptance is implied.

### Color accumulation is a separate material issue

The default canvas blends already encoded fragment values: white at alpha .5 over
black read `[127,127,127]`, compared with about 188 for linear-light composition
followed by sRGB conversion. Current ACES also runs before canvas blending.

The same source scene was rendered into supported four-sample RGBA16F, then ACES
and sRGB were applied once. Within actual alpha support, ordinary versus this
reference differed by 8.08–11.34 display bytes RGB MAE; channel p95 was 31–33 and
maximum 37–40 bytes. Ordinary blending was darker by roughly 6–14 bytes/channel.
Both versions used the same scene-linear backdrop shader. These are fixture
measurements, not a calibrated scene-wide correction.

A far-only linear layer cannot exactly compose against a background already
tone-mapped into the canvas. The optional linear-main helper therefore renders
the existing complete main scene once into linear MSAA color, followed by one
fullscreen output draw. It adds no second scene-geometry pass. Compare it with
blending OFF before attributing a whole-scene change to the crown material.

### Ordering limit

Three 185 sorts transparent InstancedMesh draw items by transformed aggregate
bounding-sphere center. It does not sort their instances. The study sorts each
cell's matrix/color tuples by camera-space transformed crown-center depth, with
immutable tuple tie-breaks. Existing cell bounds and renderOrder remain unchanged.
This keeps ordinary transparent sorting coherent with other objects such as spray.

Existing 100 m core and 300 m remote family batches can have overlapping depth
intervals. Two batches cannot express `A_far, B_far, A_near, B_near` exactly. In a
four-layer actual mixed-family fixture, mean-center family ordering differed from
four correctly interleaved draws by maximum 5/3/1 bytes at 224/72/24 px; reversing
the two families raised maxima to 23/13/4 bytes. This mild fixture proves a defect,
not a bound on worst-case scene artifacts. Exact cross-family sorting would need
many split draws or a shared multi-family shader/texture architecture.

## Integration contract

`src/render/far-crown-blending.ts` exports:

- `setFarCrownBlending(boolean)` and `getFarCrownBlending()`.
- `prepareFarCrownBlending(camera)`: call **after** `vegetation.prepareMain(camera)`
  and **before** the main scene render. Always callable; OFF returns immediately.
- `disposeFarCrownBlending()`: call before normal scene mesh/material teardown.

Actual impostor meshes register through `createTreeImpostor`; sun-only twins do
not. Registration occurs before population, so remote source buffers are copied
lazily on their first visible sorted frame. Core prefixes are copied after current
frustum packing. Matrices and colors always move together. Opt-out restores the
last core prefix and original remote order, but never overwrites a newer external
core upload. Bounds, count, callbacks, source buffers and custom depth are kept.

The material registry in `far-crown-coverage.ts` makes the two experiments mutually
exclusive. Enabling blend disables seeded hash; enabling seeded hash disables
blend and restores its buffers. Blending changes only registered far color flags:
transparent/NormalBlending, depthWrite false, alphaHash/A2C false. Stock custom
depth remains hashed. Source opacity is never changed.

`scripts/control/check-far-crown-blend-sorting.mjs` passed 88 sequential/random
seeks on transformed parent geometry, empty-first then visible packing, exact
matrix/color tuple retention, off restoration, preservation of a newer external
core pack, untouched shadow buffers, and mutually exclusive toggles. The existing
coverage shader-composition regression also passed. Focused TypeScript checking
passed. No full build or full-scene browser was launched for implementation.

Next actual-scene comparison must hold camera/time/world/lighting fixed:
direct default; linear main with blend OFF; linear main with blend ON. Judge
canopy structure, color, edge stability, ordering boundaries and shadow continuity,
then motion and final browser output. Keep both controls OFF until accepted.

## Linear main output API

`src/render/linear-main-output.ts` exports
`createLinearMainOutput(renderer)`, returning:

- `setEnabled(boolean)`: default OFF. Enabling checks exact four-sample RGBA16F
  color and depth support. Unsupported configurations throw a descriptive error;
  there is no byte-color or reduced-sample fallback.
- `getState()`: enabled/support/error, allocated physical width/height, requested
  samples/format/color space, framebuffer validation, extra resolve draw count,
  and disposal state. Initial OFF creates no GPU resources or context queries.
- `render(scene, camera, debugMode = 0)`: OFF delegates directly to the renderer.
  ON requires the default canvas target and renders the whole main scene once to
  an RGBA16F, four-sample, linear-sRGB target matching the drawing-buffer size.
  One fullscreen triangle resolves it to canvas. This is a whole-frame output
  helper, not a sub-viewport compositor. Caller viewport/scissor, automatic clear
  setting and renderer-info automatic reset are restored, including on failure.
- `compile(scene, camera)`: optional asynchronous warmup. OFF delegates to normal
  `compileAsync`; ON warms the offscreen scene and final output programs while
  restoring the caller's state. Call it in place of the main compile, not in
  addition to another identical scene compile.
- `dispose()`: idempotently releases the target, output geometry and material.

Call `render` after the normal main visibility preparation and optional far-crown
sort. Keep the existing `sealOpaqueCanvas(renderer)` after this helper. The
refraction pass remains separate and precedes main output. Controls are independent:
linear main may be ON while far blending is OFF. No source material, custom depth,
shader hook, opacity, light setting or scene callback is modified.

Output diagnostics follow the existing material/ocean convention: modes 0/5/6
apply the caller's tone mapping/exposure and output color conversion, mode 1 only
converts output color, and modes 2/3/4/7/8/9/10/11/12 bypass both. Production uses
ACES and sRGB; the helper retains the caller's configured values. The offscreen
scene receives Three's normal linear/no-tone-mapping target behavior.

Renderer statistics retain the existing scene reset behavior and include the
additional one-triangle resolve draw. The resolve does not erase preceding scene,
shadow or refraction totals. Allocation completeness and actual four-sample count
are checked on target creation/resize, avoiding per-frame synchronous GL queries.

Focused regression command:
`node --experimental-strip-types scripts/control/check-linear-main-output.mjs`.
It uses real Three CPU objects and a mocked renderer, creating no browser or GL
context. It checks state restoration on success/failure, exact target settings,
diagnostic guards, resize/reuse, capability failures, both info-reset modes,
unchanged source/depth hooks and disposal. A GPU compile/visual comparison is still
required; CPU validation alone does not accept the rendered result.

Current validation status: helper and regression script pass Node syntax checks.
The implementation is checkpointed in `artifacts/refinement-2026-09-30/blend-source-recovery/`
while the unexpectedly empty source directories and missing dependencies are
restored. Focused TypeScript checking and CPU regression execution are pending;
no new browser context or full build has been launched.
