# Internal 2× linear resolve: CPU checks

`cpu-lifecycle-check.mjs` exercises the real source APIs and Three CPU objects with a mock renderer. The saved `cpu-lifecycle-check.json` records the passing checks and source hashes. Reproduce from the repository root:

```sh
node --no-warnings --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs artifacts/refinement-2026-09-30/ssaa-internal2x/cpu-lifecycle-check.mjs
```

The check covers default-OFF laziness; enabled-aware sample scale; 640×360 versus 1280×720 main/refraction dimensions; the existing 4× MSAA request; resolve uniform; resize and hardware-limit rejection; main renderer-state restoration; refraction visibility/fog/debug restoration; disposal; and spray's active viewport height. GL capability and framebuffer responses are mocked. It does **not** establish actual allocation, GLSL compilation, pixel equality, speed, or visual improvement.

## Read-only wiring review

No concrete resolution mismatch was found in the source reviewed for this report.

| Path | Resolution behavior |
| --- | --- |
| Main and refraction | `frameWork` passes `linearMain.getSampleScale()` to refraction. Both targets use canvas physical dimensions times that effective scale. Requested 2× while linear output is OFF still gives 1×. |
| Opaque-coast sampling | Both `transmittedCoast` and the ocean swash coverage mix divide `gl_FragCoord.xy` by the shared, scaled `uUnderResolution`. Main and opaque-coast buffers therefore retain matching normalized screen coordinates. |
| Linear resolve | At the zero-origin canvas viewport, `ivec2(gl_FragCoord.xy)*2` addresses the corresponding exact 2×2 source block. Four HDR texels are averaged before the existing tone mapping and color conversion. The 1× branch retains the previous texture sample. |
| Spray | Offscreen draws use `getCurrentViewport().w`. Installed Three assigns render-target viewport dimensions in physical pixels before draw callbacks. Canvas draws retain drawing-buffer height. |
| Ocean and sky | Foam/water filtering and visible-sky ray footprints use derivatives at the current raster resolution. The water reflection's `128` constant describes the unchanged 128-pixel cube texture, not the canvas. |
| Foliage | LOD dither runs on the finer fragment grid. Alpha/hash and source texture footprints use current derivatives; world-distance LOD selection is unchanged. This does not imply sixteen independent leaf-opacity samples per final pixel. |
| Fixed auxiliary maps | The 128-pixel reflection cube, 256-pixel cloud shadow and authored sun shadow map are unchanged. Camera aspect, world time and geometry selection are unchanged by internal scaling. |

This review assumes the existing full-frame canvas path with no view-offset/crop experiment. GPU captures must compare native output OFF, linear output ON at 1×, and linear output ON at 2× with all other scene settings fixed. The pending full-scene matrix remains the visual and GPU validation gate. No production default or quality acceptance follows from this CPU report.
