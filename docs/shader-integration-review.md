# Shader integration review — read-only source audit

Reviewed the current project files against the installed Three.js 0.185.1 implementation. No browser, WebGL context, rendered frame, or GPU shader compilation was used. The pending `coastal-field` import and its unfinished caller integration are intentionally excluded.

## 1. P1 — HDR cube target has no supported-format fallback

**Files:** `src/world/atmosphere.ts:16–22`, `src/render/engine.ts`, `src/main.ts:34`.

Every quality tier allocates an RGBA half-float cube render target. WebGL2 availability alone does not guarantee RGBA16F color-renderability. Three's `WebGLTextures.js` chooses RGBA16F and requests `EXT_color_buffer_float`; it does not replace the target type when that request fails. A browser can therefore pass the application's context fallback and still produce an incomplete reflection framebuffer. The shader-error callback only catches compilation/linking errors, so `ready=true` can still be reached with this failure.

**Minimal fix:** pass the renderer into atmosphere creation, gate HDR target creation on `EXT_color_buffer_float` / supported half-float renderability, and use a deliberately scaled RGBA8 linear fallback when unavailable. Preserve the alpha transmittance channel; do not repurpose it for RGBM. Validate framebuffer completeness once after target initialization and turn a failed fallback into a clear failure state.

## 2. P1 — Terrain does not cast directional shadows

**Files:** `src/world/terrain.ts:4`, `src/world/atmosphere.ts:12`.

Primary terrain tiles set `receiveShadow=true`, but never `castShadow=true`. In Three, `Object3D.castShadow` defaults to false, and `WebGLShadowMap.renderObject` excludes such meshes from PCF shadow rendering. Rocks and trees cast shadows, but the actual mountains cannot occlude the low sun. This prevents the requested ridge/forest/beach light relationships regardless of shadow map resolution.

**Minimal fix:** enable shadow casting on the primary terrain tiles. Keep distant continuation terrain outside the main shadow pass unless it is actually needed as a caster. Once this is enabled, fit or expand the light-space caster/receiver bounds for the route; the current fixed ±380 m frustum should not be assumed to include the whole 1,200 m primary terrain.

## 3. P2 — Cloud illumination changes with camera position at fixed time

**Files:** `src/world/atmosphere.ts:11,18,22`, `src/render/sky-lighting.ts:11`, `src/world/ocean.ts` (`sunlight`).

The cube's cloud transmittance is integrated from `uEye`, which is updated to the current viewing camera. Every standard material and the entire ocean then use the same cube alpha sample at `uSolarDirection`. Moving between evaluation cameras at the same scene time therefore changes direct illumination everywhere according to the cloud in front of the new viewing camera. It also applies one uniform shadow factor to all world positions instead of a cloud shadow field.

**Minimal fix:** separate reflective sky capture from direct-light occlusion. For the smallest stable correction, compute the direct-light scalar from a fixed, documented world-space probe, independent of the view camera. For actual moving cloud shadows, sample a world-space transmittance field projected along the sun direction using the same density/time function. Keep the visible and reflected sky using their existing common atmospheric function.

## 4. P2 — Diagnostic outputs are transformed by beauty tone mapping and fog

**Files:** `src/render/diagnostics.ts:3–20`, `src/render/materials.ts` (terrain debug branch), `src/world/ocean.ts` (debug branches), `src/main.ts:46`.

The debug values replace `gl_FragColor` immediately after `opaque_fragment`, before Three's ACES tone mapping, color-space conversion, and fog. Thus a black shadow mask becomes fog-colored with distance; encoded roughness/depth/LOD colors are altered by exposure and fog. The normal view is additionally inconsistent: standard-material `normal` is view-space, whereas ocean `N` is world-space.

**Minimal fix:** give numeric diagnostic modes a separate output path that bypasses tone mapping and fog, with an explicit agreed display encoding. Transform normals to one common coordinate system before encoding. Keep beauty/direct/environment modes on the beauty pipeline. This is needed before screenshots of these modes are valid diagnostic evidence.

## 5. P2 — Back/forward-cache restoration returns a disposed, unscheduled scene

**File:** `src/main.ts:49`.

The unconditional `pagehide` listener cancels the animation frame and disposes the renderer, atmosphere, materials, and geometry even when `PageTransitionEvent.persisted` is true. There is no `pageshow` resume/rebuild handler. A page restored from the browser's back/forward cache does not rerun `start()`, so the retained UI still advertises readiness while the render loop has been cancelled and its renderer resources have been disposed.

**Minimal fix:** on persisted pagehide, pause animation/audio without disposing; on persisted pageshow, reset the frame clock and resume the loop as appropriate. Use full disposal only on a non-persisted teardown, or explicitly rebuild the complete scene on restored pages.

## 6. P3 — Frame draw-call metrics omit the six sky-capture renders

**Files:** `src/main.ts:34`, `src/world/atmosphere.ts:22`.

`draw()` calls the cube capture first and the main scene render second, then records `renderer.info.render.calls` and `triangles`. Three's renderer info resets automatically for each `render()` by default. The reported counters therefore only describe the last main render, omitting the six atmosphere cube-face renders performed in the same frame.

**Minimal fix:** set `renderer.info.autoReset=false`, reset once at the beginning of the application's complete frame, and read counters after all passes. If both main-scene and total counters are useful, label and retain both explicitly.
