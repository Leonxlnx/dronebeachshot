# Third tree family: wild syringa

Prepared from **Tree Small 02** by Rico Cilliers / Poly Haven. The source identifies Burkea africana / wild syringa and classifies it as broadleaf. This candidate is an independent tree mesh and compound-leaf atlas, with a narrow curved trunk and open branching. It is distinct from Island Tree 02 and the Yughues palm. Botanical evergreen status is not claimed.

Primary source: https://polyhaven.com/a/tree_small_02
License: CC0 1.0 Universal. See LICENSE.md and source-evidence.json.

## Integration files

All three GLBs embed their materials and textures. No external image is required by the scene.

| File | Triangles | Bytes | SHA-256 |
|---|---:|---:|---|
| syringa-tree-hero.glb | 24,913 | 3,114,880 | df11a6b9f0a2bf51b8ffd5bb12e4a18a864b47d767177cd53ad263996d8a5f2f |
| syringa-tree-medium.glb | 5,987 | 2,254,268 | c4ef49e31bf9fb6565ccfdfa7dfa05b84ca6a9054401f2362c81c6f2538770de |
| syringa-tree-far.glb | 974 | 2,048,168 | e0ed4e55345c21765804531340a285c2d10dddcb21f2a690fbb77cbfbd659523 |

The asset is in source meters, about 4.56 m tall. Source ground-root origin is **[0,0,0]**; node transforms are identity. All three LODs preserve the exact same 67 unique source positions below Y=0.01 (69 vertices before duplicate position removal). Lowest Y is -0.02410384640097618 in every LOD. Do not re-center individual LODs by their separate canopy bounding boxes.

Hero and medium retain real source bark/branches and UV-mapped leaf geometry. Reduction uses attributes for normals and both UV sets, with locked root vertices. Surviving connected leaf components are enlarged locally by 2.05× / 3.8× to recover foliage coverage at their budgets; this is a documented LOD approximation.

Far retains a 177-triangle source trunk and 101 branch triangles. Its 696 foliage triangles form two crossed source-albedo cards per 174 spatial source-canopy cells. The leaf atlas was baked only from source geometry and source RGBA diffuse, with 2-pixel RGB border dilation. Deterministic source-alpha thinning (seed 82461, keep 0.68) matches its coverage to the closer LODs without opening straight gaps between voxel cells. Far cards remain at source cell coordinates and original size.

Materials use alpha MASK / cutoff 0.45 / double-sided foliage. All images are at most 1024×1024; the far canopy atlas is 1008×1008. Hero and medium leaf WebP alpha is pixel-identical to the original source RGBA PNG alpha. The source's separate alpha PNG is 16-bit and is not substituted or incorrectly cast to an 8-bit channel. The exporter declares required EXT_texture_webp and KHR_texture_transform extensions. Preserve imported UV sets, texture transforms, material alpha modes, and image color spaces during scene integration.

Hero/medium foliage material: tree_small_02_leaves. Far foliage material: tree_small_02_canopy_bake. Detect foliage by alpha mode or both names when adding wind; matching only the word “leaves” misses the far atlas.

## Verification and review limits

verification.json is produced by an independent raw GLB parser and image decoder. It follows each actual material slot → texture → embedded image, verifies meaningful alpha, dimensions, finite positions, index bounds, file sizes, source root equality, and SHA-256. CPU raster images use the actual base color UV sets and texture transforms. The source comparison explicitly replaces the provider's alpha-losing JPEG leaf map with its authoritative RGBA PNG.

400×400 CPU raster coverage as a share of the source, with common cameras:

| View | Hero | Medium | Far |
|---|---:|---:|---:|
| front | 78.6% | 78.3% | 81.0% |
| side | 72.7% | 71.6% | 76.1% |
| elevated | 72.4% | 73.1% | 83.1% |

The requested far 75–85% target passes front, side, and elevated views. The additional diagonal view at 650×650 is 87.8%; it remains slightly denser than the nearer LODs in that direction. Raw source geometry has 2,062,487 triangles.

Review optimized/lod-comparison.png and optimized/multiangle-comparison.png. These are **standalone CPU diagnostics, not scene quality acceptance**. They do not simulate the live scene's PBR lighting, shadows, mip selection, instancing, wind, LOD blending, or draw distance. In particular, verify the far cutout's mip coverage and LOD transition in the actual scene; a near-overhead camera is beyond the tested elevated view and may reveal the crossed-card approximation.

## Rebuild and source evidence

- download-manifest.json records exact original source URLs, byte counts, and SHA-256 for every downloaded file.
- source/ holds the unchanged source glTF, geometry buffer, and maps.
- tooling/package.json pins Node dependencies; tooling/requirements.txt pins Python dependencies.
- tooling/rebuild.sh runs the preparation sequence. The current tooling/node_modules symlink reuses the existing asset-candidates dependencies. For an independent checkout, install the pinned Node and Python dependencies in tooling first.
- tooling/prepare.mjs creates hero/medium and the temporary reduced trunk for far.
- tooling/bake_far.py bakes the source canopy; tooling/finalize_far.mjs replaces far foliage; tooling/finalize_format.mjs ensures WebP extension declaration.
- tooling/verify_render.py and tooling/multiangle.py perform independent decoding and diagnostics.
- far-canopy.json records cell locations and unscaled card geometry; optimized/far-canopy-unthinned.png preserves the complete albedo bake; optimized/far-canopy-atlas.png is the exported thinned cutout.

No Site checkout was edited, no Sites tool was invoked, and no browser was used by this asset task.
