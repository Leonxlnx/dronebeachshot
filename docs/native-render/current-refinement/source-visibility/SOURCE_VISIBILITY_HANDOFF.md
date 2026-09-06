# Source cutout sunlight visibility candidate

The far proxies retain unlit source albedo and visible-face normals, but do not retain the geometric tree's alpha-cutout self-shadowing. Neither source GLB supplies an AO texture. This candidate measures the missing direct-sun visibility from the genuine source tree geometry; it does not recolor the source or paint dark regions.

The source RGB audit found no gamma or channel-conversion defect: all 48 published albedo cells reproduced byte-for-byte from retained native linear readbacks. Island source foliage is olive, while Syringa is greener. The identical-light near/far control is golden in both cases. Source self-occlusion, not saturation, is the corrected term.

## Deliverables

- Runtime helper: `src/render/source-sun-visibility.ts`.
- Island binary: `source-visibility-atlas/island-visibility.rg8`.
- Island atlas layout, all 192 source view statistics: `source-visibility-atlas/island-atlas.json`.
- Final Island regression: `source-visibility-atlas/neutral-padding-preview/`, six frames and `proof.json`.
- Island CPU audit: `source-visibility-audit.py` and `source-visibility-atlas/audit.json`.
- Restored Syringa preflight: `syringa-visibility-preflight.py` and `syringa-visibility-preflight.json`.
- Syringa binary and completed final regression: `syringa-source-visibility-atlas/`.
- Authoring scripts in the parent `native-render` directory: `bake-island-source-visibility.mjs`, `build-source-visibility-atlas-script.py`, `preview-island-source-visibility.mjs`, `bake-syringa-source-visibility.mjs`.

No Site files were edited by this study. Parent/root owns production integration and durable checkpointing.

## Exact encoding and budget

Eight camera azimuths × three camera elevations (0°, 35°, 70°), each 128², for eight local sun azimuths (0° through 315°). Sun elevation is fixed at the current scene's 6.021653966°. One 1024 × 3072 RG8 texture per family, bottom-first, `flipY=false`.

R is visibility multiplied by actual source cutout coverage; G is coverage. Both are integrated from a 512² HalfFloat, four-sample native render, downsampled 4 × 4 in linear light. Runtime interpolates four camera views and two source-relative sun directions, then divides weighted visibility by coverage. An empty sample returns neutral visibility 1. Source albedo and normal atlas bytes and all runtime alpha logic remain unchanged.

Logical GPU allocation including all 12 mip levels is **8,388,608 bytes = 8 MiB per family**, exactly; two families are **16 MiB**, not 16.8 MiB. Each texture additionally retains its 6,291,456-byte CPU typed array (6 MiB). Network/base binary cost is 6 MiB per family before any transport compression. Thus both families add 16 MiB logical GPU texture data plus 12 MiB retained CPU arrays. Driver allocation overhead is not measured. There is no RGBA decoded-image padding.

Eight extra RG texture samples are executed per far fragment with the scene's one directional light. Apply the helper once per family material and share the texture between instances. Dispose the family texture with other vegetation assets. This study has not measured consumer GPU or mobile frame time.

## Source and pose

- Island Tree 02: Rico Cilliers and Rob Tuytel, Poly Haven, CC0-1.0; https://polyhaven.com/a/island_tree_02 . Current near source: 238,617 triangles, SHA256 `c81e6ece28b7646aa59f2c2c68142619b2790d0db62c5d829278fec92e4373d7`, production normalization `18/3.4`.
- Wild Syringa / Tree Small 02: Rico Cilliers, Poly Haven, CC0-1.0; https://polyhaven.com/a/tree_small_02 . Restored near source: 689,139 triangles, SHA256 `cb794443092f8b4b7b257c4d86f42e6f2b0ec91a2f95d2d3f34043f0a3b49b07`, production normalization `14/4.556740965694189`. Preflight checks all referenced position/index arrays, no unused vertices, and exact normalized Float32 geometry bounds against current metadata.

The bake uses deterministic source alpha cutouts at world time zero, with the existing material's deformation and shadow rules. Sun shadow map: 1024² over a 50 m orthographic footprint, normal bias 0.025 m, depth bias −0.00002. This is a retained static source self-occlusion approximation. It is not dynamic per-leaf occlusion as wind, root position, nonuniform scale, or tree tilt changes. The validated remote placement uses yaw plus uniform scale; root should limit initial integration accordingly.

## Island evidence

At local sun 180° (exact sample) and 202.5° (halfway between samples), the corrected proxy has a darker inner crown with lit outer leaves. It remains a far proxy: the existing four-view blend has different coverage and can duplicate branch silhouettes at enlarged scale.

Far-before/far-after HalfFloat alpha arrays are byte-identical at both yaws. All 24 source coverage tiles are byte-identical across all eight sun directions, and no encoded visibility sample exceeds its source coverage. Final native regression has zero GL or shader errors. The defensive empty-padding fix produces exactly the same six PNGs as the initial run; initial evidence and helper are retained separately.

Island atlas SHA256: `511289cba41882d4d417c23b7081bfd5971242c879041f08ffb97bceeeb7017d`.
Final runtime SHA256: `308a7bdc337d4addf6099a329105e97391391cb6e262d2dd21c47a0e6a8d35bc`.

## Limits requiring integration review

This corrects one demonstrated lighting omission. It does not establish reference realism, fix four-view proxy geometry, add forest inter-tree shadows, or alter terrain. Source sun elevation is fixed. The helper attenuates the one direct sun and its leaf-transmission term; sky/environment fill and cloud modulation stay on the existing paths. Global mipmaps can blend adjacent view/sun cells at extreme minification, as in the existing far atlas. A real distant-scene comparison remains necessary. All images are actual Three.js native ANGLE/Mesa output, not browser/mobile validation.

## Syringa evidence

The restored 689,139-triangle source and current metadata passed preflight before baking. All 192 views and six native regression frames completed with no GL/shader errors. Highest logged RSS was 909,656,064 bytes, below the 1.2 GiB guard. At local sun angles 180° and 202.5°, before/after HalfFloat alpha is byte-identical. Coverage G is identical across all eight light directions for each of the 24 camera views; R never exceeds G. Source-weighted mean visibility over all views is 0.5162960 (Island 0.4099246); these are measured per-source results, not artist-selected darkness factors.

Syringa atlas SHA256: `fcc1b601ed813ced3b6a7016e5d8fafbc5000f7baf819a4dd706ff29d060d63b`.

All six Syringa images were inspected. Inner crowns gain depth under the existing green source albedo; outer leaves remain lit. The enlarged proxy retains its existing silhouette differences and duplicate trunks between camera views. This does not assert exact near/far image equivalence.
