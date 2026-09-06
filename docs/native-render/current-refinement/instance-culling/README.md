# Per-pass core tree culling with independent shadow twins

This scratch candidate removes only core tree instances whose unchanged, conservative source sphere is outside the current rendering pass. Main-camera and directional-sun lists are independent. It does not simplify geometry or change LOD thresholds, source attributes, alpha/depth materials, wind, source visibility, or distant-tree population.

## Integration files

- `src/render/instance-frustum-packing.ts`: new helper.
- `src/world/vegetation.ts`: candidate production module; `vegetation-caller.patch` records its small diff against `vegetation-before.ts`.
- `vegetation-runtime.ts`: same candidate with ordinary dependencies remapped to canonical production modules for a native scratch override. This prevents duplicate LOD/wind/material uniforms.

The initial same-object in-place candidate was **rejected by the native comparison**. Its archive remains `inplace-rejected.tar.gz`. It used an uninitialized shadow projection on the first frame, and Three's upload cache kept the shadow matrix prefix on the later main color pass. The earlier CPU set-only proof did not test renderer upload ordering. The corrected candidate addresses both defects.

Each registered main mesh stops casting. A shadow-only `InstancedMesh` twin shares its immutable geometry, standard material and custom depth material, with independent matrix/color attributes. Both live under the same LOD group. The twin uses public color callbacks to set only its draw count to zero and restore it afterward; it still renders into the sun shadow map. Core LOD packing skips twins via `userData.sourceShadowTwin`.

Preferred order after choosing the actual camera:

```ts
vegetation.update(camera.position);
vegetation.prepareSunShadow(atmosphere.sun);
vegetation.prepareMain(camera);
renderer.shadowMap.needsUpdate = true;
refraction.render(scene, camera, ocean.group, spray);
renderer.render(scene, camera);
```

Keep `renderer.shadowMap.autoUpdate=false`. Both lists can now be prepared before any rendering because they use separate objects/buffers. The existing native caller order (prepare sun, refraction, prepare main, main render) is also covered by the targeted upload-order proof. Do not alter `renderer.info.frame` or private caches.

`prepareSunShadow` initializes the configured shadow camera projection before calculating its frustum; waiting for the renderer's first map allocation is too late for a CPU cull. Both methods take the real explicit camera/light and update their world matrices.

For final teardown, call `vegetation.disposeVisibility()` **before** the existing scene resource traversal. It removes and disposes only the twins' instance buffers, restores the main meshes' previous caster flags, and clears CPU caches. It never disposes shared geometry/material/depth or textures. This is a teardown method, not a live optimization toggle; a disposed packer should not receive later updates.

For the native harness, route `world/vegetation` to `vegetation-runtime.ts`, call the preparation methods in either tested order, and record candidate/helper hashes. Ordinary runtime imports still use the canonical production modules, preserving shared LOD/wind/material uniforms. Compare with exactly the same camera, source and material snapshot.

## Bounds and determinism

Each core non-palm primitive uses the actual normalized source geometry's bounding sphere, transformed by its immutable Float32 instance matrix. The cache adds the existing two-metre deformation margin and stores four doubles per primitive instance to avoid inward rounding. Any mesh world transform is applied at query time. Original full-cell aggregate bounds remain conservative for both lists.

Only immutable source matrices/colors are copied into each pass's prefix. Stable source-index order is retained. LOD membership comes from the existing `vegetation.update` selection; the helper never recomputes distance bands or uses the sun camera for LOD choice. Source foliage alpha hashing/wind phase does not depend on the packed instance ordinal.

This first candidate targets expensive core non-palm meshes. Palms and the distant two-triangle proxies keep their existing submission paths. Added sphere cache: **4,435,520 bytes (4.23 MiB)**. The **2,260 additional scene meshes** have independent matrix arrays of **8,871,040 bytes** and color arrays of **1,663,320 bytes**, totaling **10,534,360 bytes (10.05 MiB)** on CPU and up to the same logical GPU attribute storage. Scene-object/attribute-wrapper overhead is additional and unmeasured. Source vertex/index geometry and textures are shared; no duplicate geometry or texture data is created.

## CPU validation

`packing-proof.json` comes from the actual helper in `audit-packing.mjs`. The independent oracle reconstructs source spheres and checks every plane directly. It verifies exact membership for each pass, exact kept matrix/color bytes, unchanged LOD weights, stable repeated seeks across high/balanced/low quality, and the real refraction count callbacks/restoration in a no-GPU renderer stub. All corrected checks pass. The helper and the native runtime candidate both typecheck successfully. The revised audit also verifies 2,260 twin disposal events, zero shared geometry/material disposal events, and 5,736 main/twin refraction color-omission callbacks.

`upload-order-proof.json` uses the installed Three `WebGLObjects` implementation with a mock attribute uploader and the actual projectObject → frame increment → shadow-update order. It first reproduces the rejected stale same-object upload, then verifies distinct main/sun GPU prefixes with twins, in both supported caller orders. It also verifies cold shadow projection initialization and explicit twin attribute disposal. No native renderer was used for this proof; the corrected full-scene native comparison remains pending.

The final audit freezes camera source SHA `1729a9a1c5505bd1dfe074db21e5f558c8b81634e47029863e1af58b36bb171b`: 42° cinematic FOV and 54° evaluation FOV. At its high flight-0 frame, 12,797 primitive instances outside the main frustum remain in the sun list. This is an explicit check against losing offscreen shadow casters.

The earlier submission profile used the previous 54° flight camera. It estimated core main/shadow totals of 56.153M triangles at flight-0 and 25.045M at wet-sand. Per-instance culling estimated savings of 17.872M and 5.908M respectively. Those counts include palms and must not be compared numerically with the new 42° proof. Actual full-scene native before/after under identical camera/material state is still required. This is not a consumer FPS or visual acceptance claim.

Source geometry metadata and original CPU profiling are retained in `source-geometry-profile.json` and `profile-vegetation-submission.mjs`. The audit checks current source GLB hashes before using those bounds.

## Other profiling findings

The production sidecars contain one shadow pass, not duplicate shadows per refraction/main render: `autoUpdate=false`, and Three clears `needsUpdate` after shadow rendering. Tree refraction color is already omitted. All seven current tree GLBs are genuinely used; obsolete Island/Syringa far GLBs are skipped and absent from the native loaded-files list. Their nine filename slots are not nine loads. The seven loaded geometry sets contain zero unused indexed vertices and about 44.60 MiB of geometry arrays. No geometry removal is recommended.

A separate safe memory opportunity is exact texture reuse across hero/medium GLBs. `vegetation-image-duplication.json` identifies 54 embedded core-tree image references but 36 distinct encoded images. Eighteen redundant 1024² RGBA copies represent **72 MiB of decoded image data** before GPU mipmaps/derived alpha-weighted copies. Reuse only images/textures with equal hashes and sampler/UV/color-space state, before `prepareTreeMaterial`, so its derived alpha-weighted map cache can also reuse them. This opportunity is documented only; no texture loader change is included in this candidate.
