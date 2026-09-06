# Near-camera tree upgrades

Two additional near-camera LOD candidates were prepared from the existing CC0 sources, preserving actual source leaf dimensions and leaf placement. All source leaf components are represented, with **no leaf-component enlargement**. Original main trunks retain every source triangle. Both exports fit the 250,000-triangle cap.

| GLB | Triangles | Bytes | SHA-256 |
|---|---:|---:|---|
| island-tree-near.glb | 238,617 | 13,299,192 | c81e6ece28b7646aa59f2c2c68142619b2790d0db62c5d829278fec92e4373d7 |
| syringa-tree-near.glb | 245,645 | 14,096,532 | 28cd16b21b8d422566e3d4c76f0f94e5d9938b9624dd96ee791864e159ac9761 |

## What changed

The earlier broadleaf LOD workflow simplified the whole foliage mesh, removed leaf components, then enlarged the survivors. The near workflow simplifies each source leaf component independently, using only original source positions, normals, and UV values. It keeps all 29,781 Island leaf components and all 30,250 syringa components at scale 1.0. Its foliage geometry is retriangulated; exact full-source leaf surface shape is still approximated where tessellation is reduced.

Island: 27,298 original trunk triangles, 37,413 branch triangles, 173,906 foliage triangles. Syringa: 28,293 original trunk triangles, 14,446 branch triangles, 202,906 foliage triangles. Island leaf components use 5–6 triangles. Syringa allocates triangles by source component topology, using the measured retained surface-area proxy recorded in syringa-triangle-allocation.json. Every source component remains; the pipeline never scales, displaces, or rotates its leaves.

## Verification

The independent raw GLB audit in geometry-audit.json checks every exported position/normal/UV row against the source, proves that all source leaf components are represented, and compares the original trunk triangle positions exactly. UV channel renumbering is explicitly accounted for: syringa branches use source TEXCOORD_1, which the final material and geometry refer to as TEXCOORD_0 after unused channels are pruned. The sampled coordinates themselves are unchanged.

visual-verification.json follows each material → texture → embedded image, verifies alpha extrema and exact source leaf alpha, and records the camera frames, image dimensions, triangle counts, root vertices, and file hashes. Both GLBs keep source root [0,0,0], scale [1,1,1], identity node transforms, and exact original ground-root vertices. Do not normalize individual LODs by their separate canopy bounds.

Textures remain at most 1024×1024 and embedded. Leaf diffuse uses lossless RGBA WebP from the original RGBA PNG; other maps use WebP quality 92. Leaf materials use double-sided MASK at cutoff 0.45. Required EXT_texture_webp and KHR_texture_transform are explicitly declared. Geometry uses ordinary glTF accessors; no Meshopt/Draco decoder is required.

## Source → current → upgrade comparisons

- qa/island-whole-tree-comparison.png: front, side, three-quarter.
- qa/island-close-comparison.png: two canopy/branch close-ups.
- qa/syringa-whole-tree-comparison.png: front, side, three-quarter.
- qa/syringa-close-comparison.png: two canopy/branch close-ups.

Each triptych uses common source-derived camera framing and the actual texture UV set and texture transform. Close-ups are telephoto diagnostic views of the same source-space canopy region. Separate full-resolution frames are also in qa/.

600×600 alpha-aware silhouette measurements:

| Tree / view | Current coverage / source | Near coverage / source | Near silhouette IoU |
|---|---:|---:|---:|
| island / front | 86.9% | 98.2% | 96.2% |
| island / side | 84.9% | 97.8% | 95.4% |
| island / threequarter | 87.2% | 98.1% | 96.0% |
| syringa / front | 79.1% | 81.3% | 79.0% |
| syringa / side | 73.0% | 76.2% | 72.8% |
| syringa / threequarter | 73.6% | 77.4% | 74.3% |

Island retains roughly 98% of source coverage and 95–96% silhouette IoU while keeping authentic small leaves and full trunk detail. Syringa removes the visibly enlarged leaves and restores fine branch structure, but remains **19–24% below source canopy coverage** in these views. Its 250k budget still requires substantial local foliage simplification. This limitation is visible in the source comparison and is not treated as a reference-realism pass.

These are **asset-only CPU diagnostics, not scene quality acceptance**. The renderer uses textured diffuse plus simple lighting; it does not simulate the scene's PBR normal maps, subsurface lighting, shadows, wind, mipmapping, camera motion, or LOD transitions. Root integration must judge the visible preview and close-camera transition. No Site checkout, Sites tool, or browser was used.

## Sources and reproduction

The original sources were reused in place. Exact local paths, original URLs, and verified SHA-256 values are in source-manifest.json; licenses and credits are in LICENSE.md and license-reference.json. Existing sources remain unchanged.

Run tooling/rebuild.sh in the shared workspace with the pinned Node/Python dependencies. The current node_modules symlink reuses asset-candidates tooling. The rebuild analyzes source components, calculates the syringa allocation, creates both GLBs, performs the independent geometry audit, and renders the comparisons. Preparation statistics are in preparation-stats.json. The first syringa allocation and its comparison metrics are preserved only as intermediate evidence in intermediate/.
