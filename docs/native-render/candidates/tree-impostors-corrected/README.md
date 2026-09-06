# Corrected native far-tree atlas handoff

Use this corrected atlas set for integration. It is the same native full-source 8-azimuth × 3-elevation bake documented in `../tree-impostors/README.md`, with one narrow change: masked source color textures enter mip filtering with RGB alpha-weighted in linear space, then the sampled RGB is unpremultiplied before diffuse multiplication. This removes transparent-padding color contamination without repainting the source or changing coverage.

The two original detailed GLBs, exact source SHA-256 values, source CC0 provenance, normalization, all cell cameras, atlas bounds, and normal space are recorded in `bake-manifest.json`, `island-metadata.json`, and `syringa-metadata.json`. Raw native RGBA albedo and normal readbacks remain in the species `*-raw/` folders. Original uncorrected atlases and readbacks remain separately in `../tree-impostors/`.

`before-after-atlas-audit.json` proves the two albedo atlases have **zero changed alpha bytes** across all 3,145,728 texels. Both complete normal atlases are byte-identical, including alpha. Only source-filtered albedo RGB changed. The corrected source alpha-weighted sRGB averages are island `.384/.392/.216` and syringa `.391/.442/.272`; these are measured source-derived colors under the projection pipeline, not new art colors.

`native-source-far-impostor-comparison.png` compares corrected full near geometry, corrected current far geometry, and the corrected impostor under the same light and camera. `island-patch-impostor.png` and `syringa-patch-impostor.png` show the same 441 source-root matrices used in each species' far comparison. `native-candidate-test.json` records shader errors `[]` and GL error `0`, with 2 proxy triangles per source root.

The factory remains `../tree-impostors/tree-impostor-candidate.ts`. It is designed for `src/world/` imports and replaces only family 0/1 level 3. Root integration now applies the alpha-weighted map preprocessing and shader binder inside production `prepareTreeMaterial`, so the factory needs no additional albedo correction. Continue the normal shared cloud-lighting pass once; the factory already includes above-water refraction exclusion. Source hero/near/medium geometry, all root placement/scales/rotations/colors, palms, and complementary LOD intervals remain with the existing scene construction.

Native custom-depth evidence is in `../tree-impostors/color-filter-proof/proof.json`: all 8 source/atlas before/after cases have exactly identical surviving color/depth pixel masks, and all 4 correction pairs have zero changed coverage pixels. It verifies the current camera-facing atlas shader compiles in both color and custom depth. It does not constitute browser QA or a complete-scene visual approval.

Remaining limitations: nearest baked views can pop at cell boundaries; the far proxy has no depth parallax; aggregate normal lighting is less rich than fully shaded multilayer geometry. These are bounded far-LOD limitations. The small syringa source crown at 9m spacing still forms a more open canopy than island; increasing source density or width was not part of this candidate.

Reproduce corrected bake from `/workspace/scratch/2b912ce37941`:

```sh
LD_LIBRARY_PATH=/workspace/scratch/2b912ce37941/native-render/mesa/usr/lib/x86_64-linux-gnu \
__EGL_VENDOR_LIBRARY_FILENAMES=/workspace/scratch/2b912ce37941/native-render/mesa/usr/share/glvnd/egl_vendor.d/50_mesa.json \
LIBGL_ALWAYS_SOFTWARE=1 \
node --experimental-strip-types --loader /workspace/sites/last-light-bay/scripts/control/ts-resolve.mjs native-render/bake-tree-impostors-corrected.mjs
```

Use the same environment with `native-render/test-corrected-tree-impostors.mjs` for corrected source/far/proxy comparisons. Run `node native-render/compare-atlas-alpha.mjs` for exact pixel preservation. The earlier uncorrected baker/test/proof scripts now point to a frozen scratch pre-correction vegetation module so a future rerun cannot silently replace the before baseline with live corrected production material behavior.
