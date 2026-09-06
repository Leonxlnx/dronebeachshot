# Ground material upgrade

Two official Poly Haven CC0 texture sets, prepared as 2048×2048 WebP. This is a material-source package, not a scene render.

| Role | Official source and creator | Tile footprint | Delivered prefix |
|---|---|---:|---|
| Brown forest soil with small litter | [Forest Ground 05](https://polyhaven.com/a/forest_ground_05), Charlotte Baglioni | 2 × 2m | `textures/forest_ground_05_` |
| Actual moss patches with leaf litter | [Forest Leaves 02](https://polyhaven.com/a/forest_leaves_02), Rob Tuytel | About 3 × 3m | `textures/forest_leaves_02_` |

Each prefix has `diff_2k.webp`, `nor_gl_2k.webp`, and `arm_2k.webp`.

- Diffuse: sRGB, WebP quality 94. Source colors are unchanged; an sRGB ICC profile is attached.
- Normal: official OpenGL +Y tangent-space map, linear data / `THREE.NoColorSpace`, lossless WebP. Do not invert green.
- ARM: R = ambient occlusion, G = roughness, B = metalness, linear data / `THREE.NoColorSpace`, lossless WebP. Source metalness is zero.
- Neither source has meaningful alpha. Both surfaces are opaque tileable materials; moss coverage should be controlled by the terrain's ecological blend mask. The moss scan includes leaf litter and twigs and is best suited to soil/low ledges rather than exposed vertical rock faces.

Use the forest soil as the neutral brown ground layer and the moss material locally in damp, sheltered patches. Suggested source-scale UV factors are `worldXZ / 2.0` and `worldXZ / 3.001`, respectively. These are physical scan scales, not a visual guarantee for the current scene.

`provenance.json` records creator, license, API URLs, exact source download URLs, source MD5 checks, source/output SHA256, color-space conventions, file sizes, modifications, and verification errors. `sources/` preserves the official API JSON and original PNGs. `SHA256SUMS.txt` covers the delivered maps and reports. Run `python3 prepare-materials.py` to reproduce outputs from those sources.

The forest-soil PNGs are 16-bit and are quantized to 8-bit RGB for WebP. The moss PNGs are already 8-bit. Normal and ARM outputs are byte-exact relative to that 8-bit decode; incidental PNG gamma/display metadata is stripped without applying a gamma transform to data channels. No image was resized, cropped, recolored, or generated for the material files.

The contact sheet uses the delivered diffuse/normal maps and the ARM green channel. It is for source inspection only. No material was visually verified inside Last Light Bay.

License: [Poly Haven asset license](https://polyhaven.com/license), [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
