# Cloud sampling review — incremental improvement

The production 3D density field remains original procedural scalar data. Its authored weather, cloud shape, sun and albedo/radiance colors are unchanged in this refinement.

The old 60 m / 256-step visible march used a different deterministic random offset in every pixel. Actual views showed grain on bright cloud edges. A mipmapped density texture with explicit sample footprints alone did little to fix it. Fixed midpoint sampling at the old count removed random grain but exposed regular bands. The selected 30 m / 512-step midpoint march resolves those bands much more finely and retains rounded edge structure. The sample footprint uses both pixel-ray width and half a ray segment, with explicit 3D mip selection outside implicit derivative assumptions in the divergent loop.

Seven 3D mip levels use 1,198,372 logical RGBA8 bytes, up from 1,048,576; original base bytes remain unchanged. Visible sky and its reflection probe share the new march. The separate cloud shadow map retains its original 60 m / 256-step integration and the same physical density function. Native GL/shader errors are zero. Native software timings are diagnostic only; no browser/mobile/FPS gate is passed.

The first integrated full-scene study (`camera-framing-cloud`) contains three views using the candidate cloud module, with exact candidate source hash and actual asset hashes. It also changes camera framing, so those images are not a controlled cloud-only comparison. The sky-only four-way comparison above isolates the sampling change. Full production framing and reflection are being checked separately.

The cloud masses are still too uniform and soft relative to the final references. This is a sampling correction, not final sky acceptance.

Primary API reference: [Three.js Data3DTexture](https://threejs.org/docs/pages/Data3DTexture.html), specifically the explicit mip-generation and minification filter settings.
