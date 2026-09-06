# Alpha-weighted source color filtering: bounded proof

The white/yellow stipples are not a source flowering layer. The actual detailed GLBs contain trunk, branches and leaves, with no flower material or emissive component. Bright RGB values in transparent leaf-map padding enter ordinary RGB mipmaps even where source alpha is zero. This is a color filtering error.

## Quantitative native GPU test

A 64 × 64 source texture contains 25% fully opaque known leaf color sRGB `[52,126,31]`, with the remaining 75% fully transparent bright padding `[235,255,189]`. The final mip is sampled on the real native GL pipeline, read back as linear RGBA bytes.

| Result | Linear RGBA |
|---|---|
| Expected leaf color and fractional coverage | `[9,53,3,64]` |
| Existing straight RGB mip filtering | `[161,203,99,64]` |
| Linear alpha-weighted RGB filtering, then unpremultiply | `[9,54,3,64]` |

The corrected result differs by one green byte from the ideal because of 8-bit storage / GPU mip rounding. Alpha is exactly unchanged. The 64 × 64 base texture has zero changed alpha bytes.

## Actual source and atlas tests

`before-after.png` uses actual source GLBs and atlas geometry with the same native camera, source maps, lights, and production material hook. The corrected near syringa removes the pale yellow/white speckling while preserving every surviving alpha-hashed pixel. The island improvement is smaller but also visible. Existing already-baked atlases change little because the original source RGB contamination was already baked into their covered RGB; they need a new native bake using the corrected source filtering.

Both species × near/atlas × before/after were rendered through their real custom depth material as well as color. There are zero differing color/depth mask pixels in all 8 cases. Corrected-vs-original color masks also differ by zero pixels in all 4 pairs. The candidate's custom depth shader compiled successfully. `proof.json` records these results, shader errors `[]` and GL error `0`.

## Narrow runtime candidate

`../alpha-weighted-color-candidate.ts` creates a cached derived texture from loaded source pixels. RGB is decoded from sRGB if applicable, multiplied by its alpha in linear light, and re-encoded for sRGB storage. Alpha bytes do not change. The derived DataTexture copies source UV transforms, channel, wrap, filter, anisotropy, and color-space metadata. Conventional source row flip is baked into its pixels and `flipY` is then false, matching native typed-array and browser image conventions without double flipping. The original Texture and image stay unchanged.

After `prepareTreeMaterial` installs its hooks, `bindAlphaWeightedColor` expands the stock map fragment and unpremultiplies the sampled RGB immediately before diffuse multiplication. It does not alter sampled alpha or the shared later color/depth coverage and LOD logic. Bind it to both returned materials. The same derived map must be passed to color and depth.

Suggested integration inside `prepareTreeMaterial`:

```ts
const material = source.clone();
if (material.alphaTest > 0 && material.map) {
  material.map = alphaWeightedColorTexture(material.map);
}
// existing material setup and bind(material, ...)
bindAlphaWeightedColor(material);
// create depth using material.map, then existing bind(depth, ...)
bindAlphaWeightedColor(depth);
```

This is a filtering correction to the source texture pipeline; it does not repaint the source or increase canopy coverage. Unsupported compressed/non-RGBA input throws instead of silently applying an unpremultiply to an unmodified source. Current native source GLBs use supported RGBA8 maps. Browser Canvas image decoding is included as implementation code but has not been browser-tested in this bounded task.

Reproduce with the successful native environment and loader documented in `../README.md`, running `native-render/test-alpha-weighted-color.mjs`. Original atlases and raw bake images remain preserved; the corrected native rebake goes to `native-render/tree-impostors-corrected/`.
