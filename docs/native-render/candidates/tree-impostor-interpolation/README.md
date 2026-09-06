# Continuous far-atlas factory patch

`tree-impostor-four-view.patch` changes only `src/world/tree-impostor.ts`. `tree-impostor-candidate.ts` is the complete replacement source. Mesh geometry, source instance transforms, existing wind binding, root-distance complementary LOD bands, shared alpha coverage/hash, refraction exclusion, and cloud-lighting hooks are unchanged.

The factory now selects the surrounding two azimuths and two elevations, wrapping the azimuth seam, and linearly blends their premultiplied RGBA samples. The production alpha-weighted map binder unpremultiplies the final blended albedo before diffuse multiplication. Both color and custom depth use the same four-view sample, so alpha and LOD remain consistent. UV derivatives stay in atlas units for the existing minification coverage logic.

The normal atlas is independently passed through the existing `alphaWeightedColorTexture` helper with **NoColorSpace**. The same four-view interpolation mixes encoded normal RGB times alpha and alpha; the shader unpremultiplies before decoding and normalizing the root-local normal. This prevents empty atlas padding from rotating mip normals upward. No atlas file changes or new art are required.

## Native evidence

`native-proof.json` records actual source near geometry plus the original and patched far proxies at azimuth 22.4→22.6°, elevation 17.4→17.6°, and wrap 359.9→0.1°. Both species use the corrected genuine-source atlases and live production material pipeline. All **24 color/custom-depth mask comparisons have zero differing pixels**. Native shader errors are `[]`, GL error is `0`.

The following counts measure screen pixels whose largest RGB-channel change exceeds 8/255 across the 0.2° camera motion. The far test projects the full tree to approximately 16 pixels high inside the unchanged 320-square render.

| Species | Boundary | Original far | Patched far |
|---|---|---:|---:|
| Island | Azimuth 22.4→22.6° | 115 | 3 |
| Island | Elevation 17.4→17.6° | 101 | 2 |
| Syringa | Azimuth 22.4→22.6° | 77 | 0 |
| Syringa | Elevation 17.4→17.6° | 55 | 0 |

At enlarged source scale, changed pixels fall from 11928→79 / 11380→54 for island, and 9448→103 / 7711→36 for syringa. The old tile silhouette switch is visible in `island-boundary-contact.png` and `syringa-boundary-contact.png`; the patched pair changes continuously. Those contact sheets include actual full-source near renders for comparison.

A native known-normal test uses 25% coverage with +X surface normals and fully transparent +Y padding. Ordinary mip filtering tilts the recovered normal by 71.42°. Alpha weighting reduces that error to 0.32°, consistent with RGBA8 rounding, with unchanged sampled alpha 64/255.

`actual-normal-mip-proof.json` additionally samples mip 6 of both real source-derived normal atlases. Six partially covered texels (chosen to expose the worst padding contamination, not to represent an average) are compared with CPU alpha-weighted integration of their original 64×64 blocks. Original normal direction errors are 46.55–84.14°; the candidate gives 2.34–4.88°. Alpha readbacks match before/after exactly. The remaining few-degree error includes repeated 8-bit GPU mip rounding. Shader and GL errors remain zero.

## Cost and limits

Far geometry stays at two triangles per root. Covered lit fragments now sample four albedo and four normal texels instead of one each; depth samples four albedo texels. The additional normal texture is a cached derived RGBA8 copy per family. No rebake is needed.

Four-view blending removes abrupt tile switches, but the different baked projections are not depth-reprojected. Enlarged midpoint views visibly soften or double some trunks/branches; this is a far-only proxy and does not replace nearby 3D source trees. Native isolated evidence does not constitute full-scene/browser visual approval. The factory still assumes the existing 8×3 atlas layout at 0/35/70° elevation.

## Reproduce

From `/workspace/scratch/2b912ce37941`:

```sh
LD_LIBRARY_PATH=/workspace/scratch/2b912ce37941/native-render/mesa/usr/lib/x86_64-linux-gnu \
__EGL_VENDOR_LIBRARY_FILENAMES=/workspace/scratch/2b912ce37941/native-render/mesa/usr/share/glvnd/egl_vendor.d/50_mesa.json \
LIBGL_ALWAYS_SOFTWARE=1 \
node --experimental-strip-types --loader /workspace/sites/last-light-bay/scripts/control/ts-resolve.mjs native-render/test-tree-impostor-interpolation.mjs
```

Use the same environment/loader with `native-render/test-impostor-normal-mips.mjs` for the actual normal-atlas mip proof. The before factory is retained in `native-render/tree-impostors/tree-impostor-runtime.ts`; the candidate native import adapter is local to this folder, so root integration does not overwrite this before comparison.
