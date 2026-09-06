# Refraction and terrain-contact review

Bounded read-only audit of `src/render/refraction.ts`, `src/world/terrain-surface.ts`, `src/world/ocean.ts`, and their current `src/main.ts` integration against installed Three.js 0.185.1. The numerical check below evaluated source equations on the CPU; it is not a rendered-frame or GPU result. No Site files were edited.

## P2 — Refraction applies atmospheric fog twice

`createRefractionPass.render()` renders the normal scene with `scene.fog` active. Standard terrain and rock materials therefore write already fogged color into `uUnderColor`. `transmittedCoast()` absorbs that color, after which the ocean shader applies a second camera-distance fog blend:

`col = mix(col, vec3(.59,.55,.46), 1. - exp(-distanceToEye*.00016));`

The first contribution integrates fog for the camera-to-bottom path, and the second adds fog for the camera-to-water path again. They also use different fog colors and extinction functions. This can wash out transmitted sand/rocks and make their air/water transition inconsistent.

**Minimal fix:** make the opaque refraction color pass fog-free, restoring the original fog state in `finally`, and apply the atmosphere once for the camera-to-surface segment in the water shader. Keep underwater attenuation as the separate water path. Three's `ShaderChunk/fog_fragment.glsl.js` confirms that standard materials apply fog during the opaque color render.

## P2 — Near-ocean and swash surfaces are not watertight at their discard boundary

The new swash vertices correctly use the same 2 m grid and triangle diagonal as the terrain. However, the near ocean still uses a 5 m grid. Each mesh samples the nonlinear wave function only at its own vertices. The shader clips the near ocean at signed distance -60 m and starts the swash at that same distance, but the two interpolated geometric heights at that boundary differ.

A bounded CPU evaluation of the current swell equations and the two exact grid/triangle layouts sampled 5,716 points at times 0, 6, 12 and 18 s. Mean absolute boundary separation was 0.00828 m; the largest sampled separation was 0.04268 m at `(x,z,t) = (495.4, -627.861267, 0)`. At that point the near grid interpolated `y=-0.0175119` and the swash grid `y=-0.0601935`. This demonstrates a geometric discontinuity; its visible severity remains to be assessed in frames.

**Minimal fix:** use shared boundary vertices/triangles, or a seam band that makes both sides evaluate the same coarse-grid interpolant before switching. Calling the same analytic height function on unrelated tessellations does not produce a watertight join.

## P2 — The 28 mm sand offset is smaller than distant depth resolution

The geometric contact construction is correct for triangles whose vertices are all on the positive-shore side: both meshes use Float32 heights and the same triangle diagonal, with the swash vertices raised by 0.028 m. This does not ensure that the depth buffer can distinguish them.

The explicit `UnsignedIntType` refraction depth target selects `DEPTH_COMPONENT24` in Three's `WebGLTextures.js`. With near/far planes 0.15/22,000 m, one quantized depth increment is approximately 0.0010 m at 50 m, 0.0040 m at 100 m, 0.0358 m at 300 m, and 0.0994 m at 500 m, measured along camera Z. The view-Z component of a 28 mm vertical separation is smaller still at a grazing angle. Accordingly, the current depth reconstruction cannot reliably resolve the water-film thickness at distant/grazing beach samples; it may clamp the reconstructed path to zero or mistake the sample for foreground. The main canvas may have the same limitation depending on its depth format.

**Minimal fix:** use the known terrain/surface separation for near-contact attenuation rather than subtracting two distant perspective depths. Raise the camera near plane as far as the route permits, or adopt a verified reversed-depth strategy if needed for the main depth test. Do not increase the film's world height merely to hide precision loss.

## P2 — The new byte-color fallback clips opaque HDR radiance

The refraction target switches from half-float to `UnsignedByteType` when `EXT_color_buffer_float` is absent. The offscreen color remains unscaled linear scene radiance. Three intentionally disables output tone mapping for ordinary render targets, so values above 1 are clamped by RGBA8 before water absorption and final ACES mapping. This is a new occurrence of the same issue previously corrected for the sky cube.

**Minimal fix:** introduce an explicit RGB encode/decode scale for the byte refraction target, or a documented alternate bounded-radiance fallback. Preserve physically useful linear radiance through water attenuation; do not ACES-map the opaque target and then ACES-map it again in the final frame.

## Integration checks that passed source inspection

- The opaque pass hides both the ocean group and spray, so their refraction samplers do not create framebuffer feedback during the target render.
- Its `try/finally` restores the render target, water/spray visibility, and shared debug mode for the current call site. The application invokes it from the default framebuffer, so omitted cube-face/mipmap restoration is not a present call-site defect.
- The positive view-distance reconstruction matches the non-reversed perspective depth formula in Three's `packing.glsl.js`; the engine currently uses neither reversed nor logarithmic depth.
- `RenderTarget.setSize()` disposes storage, and Three's depth attachment setup updates the existing depth texture dimensions and upload state. The uniforms keep valid texture objects after resize.
- `uUnderColor`, `uUnderDepth`, resolution, clip planes, and readiness uniforms are provided to the main ocean material and rebound to both clones. Terrain height and coastal-field samplers are also present. No missing refraction GLSL declaration was found.
- The land now spans `x=-600..600`, `z=-800..800` in 2 m increments, matching `TERRAIN_GRID`. `PlaneGeometry` uses triangles `(a,b,d)` and `(b,c,d)` after the rotation; the CPU height function, GLSL interpolator, and swash indices use that same diagonal. The new contact texture uses nearest R32F samples and performs the correct triangle interpolation explicitly.
- Swash cells that cross the negative-to-positive shoreline transition still interpolate vertices from the blended wave/sand branch. Therefore the exact +28 mm statement applies to fully positive-shore triangles, not every positive-distance fragment in a crossing triangle.
