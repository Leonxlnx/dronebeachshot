# Last Light Bay asset sources and preparation

Retrieved 2026-09-05. Original downloads and optimized derivatives are separate. Every downloaded PBR/model resource used here returned HTTP 200. Source URLs, byte counts, and SHA-256 digests are recorded in `public/assets/manifest.json` for all production derivatives; original-source transfer records remain in the asset working directory.

## License evidence

All Poly Haven assets below are **CC0 1.0**. The asset pages link CC0; [Poly Haven's asset license](https://polyhaven.com/license) explicitly permits commercial use, modification, and redistribution without required attribution. [CC0 legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode). Poly Haven's example renders, website copy, and logos are not covered by the asset license; do not copy those into the product.

| Asset | Primary source | Credited creators | Original payload used |
|---|---|---|---:|
| Seaside Rock | https://polyhaven.com/a/seaside_rock | Dimitrios Savva | 2,753,561 B for 1K diffuse, OpenGL normal, ARM |
| Coast Sand 04 | https://polyhaven.com/a/coast_sand_04 | Dario Barresi; Rob Tuytel | 3,234,966 B for 1K diffuse, OpenGL normal, ARM |
| Palm Bark | https://polyhaven.com/a/palm_bark | Charlotte Baglioni | 2,756,092 B for 1K diffuse, OpenGL normal, ARM |
| Island Tree 02 | https://polyhaven.com/a/island_tree_02 | Rico Cilliers; Rob Tuytel | 46,172,406 B for 1K glTF, BIN, and nine JPEG maps; alpha PNG and diffuse PNG downloaded separately |
| Palm Tree v2 | https://opengameart.org/content/palm-tree-v2 | Yughues / Nobiax | 3,020,242 B archive |

**Palm Tree v2 license:** the original artist's OpenGameArt page explicitly declares **CC0**. The archive's readme also permits use/modification for personal and commercial work. The request to share a result link is not a restriction on the CC0 declaration. Source archive: https://opengameart.org/sites/default/files/palm_tree_v2.7z . SHA-256: `9c0b77935498cf51a9166cee91807fea71bdae1a9ad4b79f3ffa740b8c7cac69`.

## Download availability

Texture URLs were verified by actual download; the general pattern is `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{asset}/{asset}_{diff|nor_gl|arm}_1k.jpg`. All nine exact URLs are in the download manifest. Tree glTF: https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/island_tree_02/island_tree_02_1k.gltf ; its actual binary and all supporting URLs are in the tree manifest. All tree files match the MD5 checksums in Poly Haven's API response, in addition to recorded SHA-256 values.

The initial default Python request to Poly Haven's API was HTTP 403. The same public API worked with the identifying User-Agent `LastLightBay asset sourcing contact: research only`. No authenticated asset sources were used.

## Optimized derivatives

| Filename | Triangles | Payload |
|---|---:|---:|
| island-tree-hero.glb | 34,418 | 3,950,040 B |
| island-tree-medium.glb | 6,636 | 1,739,460 B |
| island-tree-far.glb | 1,003 | 1,304,260 B |
| palm-tree.glb | 1,032 | 490,580 B |

- Tree simplification used meshoptimizer's attribute-aware permissive simplification, preserving UVs and normals. Source geometry contains 1,072,213 triangles, despite the asset page's rounded 2M listing.
- Each LOD retains the source trunk/branch structure. Retained leaf components are enlarged around their own centers to maintain crown density: 1.2× hero, 2.7× medium, 6.5× far. This is an intentional LOD approximation, especially visible if the far model is inspected at close range.
- The original glTF used JPEG leaf diffuse and BLEND material. The optimized versions use the original RGBA diffuse PNG directly and use double-sided MASK with alpha cutoff 0.45.
- All GLB textures are embedded WebP, max 1024×1024. `EXT_texture_webp` support is required (supported by Three.js GLTFLoader). Geometry is ordinary glTF, with no Meshopt or Draco decoder required. Source branch texture transforms are retained.
- Palm conversion preserves the actual OBJ geometry, diffuse alpha, and normal texture; the material is double-sided MASK at 0.45 with roughness 0.88. OBJ coordinates are scaled by 0.025 and UV V is inverted for glTF's texture convention. Original specular TGA is kept with the source files, but no inferred PBR conversion was applied.
- Nine terrain/trunk WebPs are also in `optimized/`, with source resolution preserved at 1K. ARM channels are AO=R, roughness=G, metalness=B. Use diffuse as sRGB; normal/ARM as linear data.

## QA and limitations

All GLBs pass container length/header, embedded resource, texture-resolution, triangle-count, and re-read checks. Source and derivative file hashes are recorded. `optimized/silhouette-comparison.png` compares a common orthographic view of actual mesh geometry; hero/medium/far retain approximately 90%, 84%, and 80% of source projected coverage, with similar crown outlines.

The first simplification produced sparse medium/far crowns; that version was replaced before handoff. Final in-scene material/shadow evaluation belongs to parent integration. The local Chromium runtime was unavailable; an attempted download timed out. No screenshot of a textured render is claimed. The supplied silhouette is geometry QA, not a photo or rendered backdrop.

Changes were confined to the asset-candidates directory. No Site files were edited.

## Parent verification correction
The first returned broadleaf textures were RGB despite a MASK material. Root inspection caught this. The derivatives were rebuilt using the original RGBA PNG; `scripts/control/check-assets.py` independently decodes each MASK base-color image and requires nontrivial alpha 0–255. Shared source origin (0,0,0) is retained across LODs. Updated checksums are authoritative in public/assets/manifest.json.

## Third family added in continuation

Tree Small 02 (wild syringa / Burkea africana), Rico Cilliers, Poly Haven, CC0-1.0. Its seasonal broadleaf status is explicit; it is not described as an evergreen. Source: https://polyhaven.com/a/tree_small_02 . Integrated three independent mesh LODs at 24,913 / 5,987 / 974 triangles, preserving source ground origin with one scale of 14 / 4.556740965694189. The far spatial canopy cards are a distance approximation, not a panorama. Source download records, actual embedded alpha checks, and multiangle CPU diagnostics are in docs/syringa; scene visual acceptance remains pending. All 16 production assets are covered by the manifest.

## Scanned soil and moss

Forest Ground 05 (Charlotte Baglioni, Poly Haven) and Forest Leaves 02 (Rob Tuytel, Poly Haven), both CC0-1.0. Their 2K diffuse/OpenGL normal/ARM maps replace green-tinted stone as soil and add actual mossy litter. Production map scale is 2m and approximately 3m respectively. Diffuse is sRGB; normal and ARM remain linear data with lossless WebP storage. Full source/API MD5 and derivative SHA-256 records are in docs/ground-materials/provenance.json; the production manifest includes each file. Standalone texture inspection is not scene approval.


## Original-size near foliage and ground scans

The Island Tree 02 and wild syringa near GLBs retain the source trunks and every original leaf component at its original size. They add a fourth detail level, with 238,617 and 245,645 triangles respectively. Source credits, exact hashes, derivative geometry audit and CPU-only comparisons are in `docs/near-tree-assets/`. The scene has not been visually accepted.

The six Forest Ground 05 and Forest Leaves 02 diffuse/normal/ARM WebP files retain the official 2K maps; authors are Charlotte Baglioni and Rob Tuytel, CC0. `docs/ground-materials/provenance.json` records source URLs and conversions. Procedural snags, shrub leaf geometry, the habitat field and lee-wave field are original project code. User-supplied reference images are review inputs only and are not runtime backgrounds or scene assets.

## Native source-tree far impostors

Four PNG albedo/normal atlases under `public/assets/impostors/` are derived from the existing CC0 Island Tree02 and Wild Syringa source assets. They use eight azimuths and three elevations of the genuine near meshes; each cell is256px, integrated from4× linear supersampling and4× MSAA. Normals retain root-local shading directions for runtime light and shadow. The corrected bake changes filtered RGB only; all alpha bytes and normal pixels match the original bake. Exact source hashes, cameras and commands are preserved in `docs/native-render/candidates/tree-impostors-corrected/`. These are far-LOD tree proxies, not scene backdrops.

### Rock Moss Set 01 — original near outcrops

Creator: Kless Gyzen. [Source](https://polyhaven.com/a/rock_moss_set_01), [CC0 license](https://polyhaven.com/license). Downloaded 2026-09-05. Exact paths and SHA256 checksums are in the asset manifest. The 3,256,512-byte GLB repacks the original geometry and three 2K JPEG maps without decimation or image recompression. Five closed specimens replace 46 existing near outcrops using uniform scaling and embedded placement. The original fourth specimen has boundary defects and is excluded from visible placement. A 789,976-byte geometry-only pack copies all original positions, indices and node transforms for identical coastal-field generation in the worker; no texture downloads or DOM decoding are needed there. Full source provenance and equality audit are retained in docs/native-render/photogrammetry-rocks.

### Sand 03 — fine beach sediment

Charlotte Baglioni, [Poly Haven Sand03](https://polyhaven.com/a/sand_03), CC0. Official 2K diffuse, OpenGL normal and packed ARM source files were downloaded2026-09-05 and matched published size/MD5. Local WebP conversions retain2K resolution. Runtime maps the original grain luminance onto a pale buff sediment albedo with a2m texture scale. The exposed wet-film roughness is restricted near/above sea level; submerged sediment retains granular roughness. Exact source metadata/checksums are in docs/beach-materials and the asset manifest.

## Syringa near foliage restoration

Rico Cilliers, [Tree Small02](https://polyhaven.com/a/tree_small_02), CC0. Near mesh now preserves every source leaf component and the full trunk with original texture/UV values; compacted geometry, original bounds restored. Coverage and exact mesh audits are retained under docs/native-render/syringa-coverage-upgrade. The existing far atlas retains its recorded previous source hash.

## Exposed cliff surface

[Marble Cliff03](https://polyhaven.com/a/marble_cliff_03), Amal Kumar, [CC0](https://polyhaven.com/license). Matching source2K diffuse, OpenGL normal and ARM maps converted to quality95 WebP; physical tile5.7483m. Replaces the overly fine, dark seaside grain on continuous bedrock. Source variation remains; fresh faces are gently neutralized and lifted10% in the material. Metadata/checksums retained.

### Restored Syringa distant views (2026-09-05)
The 24-view Syringa albedo/normal atlases were regenerated from the restored `syringa-tree-near.glb` source geometry (CC0, Rico Cilliers, Poly Haven tree_small_02), preserving the source leaf silhouettes. Metadata now uses that geometry’s full bounds. The distant terrain forest instances the existing Island and Syringa source atlases and places roots on the actual annulus triangles; it introduces no third-party image background.

### Source-tree sunlight visibility (2026-09-05)
Island Tree02 (Rico Cilliers; Rob Tuytel) and restored Wild Syringa / Tree Small02 (Rico Cilliers), Poly Haven CC0, each contribute an original derived RG8 atlas of source cutout self-shadow visibility. The bake retains 24 camera views and 8 relative sun azimuths at the current 6.021654° sun elevation. Source albedo, normal and alpha atlas files are unchanged. The additional binaries encode coverage-weighted direct-sun visibility only, at 128 px per view, with shared yaw-aware interpolation in the far-tree shader. Each uses 6 MiB source bytes and 8 MiB logical GPU data with mips. This is a static source-occlusion approximation, not dynamic per-leaf occlusion under changing wind/tilt.

## Island Tree 02 fork-open derivative

The three `island-fork-open` production atlas files derive from the vendored Poly Haven Island Tree 02 near model (CC0-1.0). A continuous root-fixed growth field is applied to the source geometry, then 24 camera views and eight source sunlight directions are rendered. Source URL, source/model hashes, framing and encoding are documented in `tree-form-authoring/island-fork-open.json`; the matching runtime geometry is in `src/world/tree-form.ts`. These are runtime albedo, normal and visibility assets.
