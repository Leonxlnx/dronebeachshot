# Syringa near foliage replacement

The new near mesh retains **97.30% side /97.11% overhead** of the original source silhouette coverage. The previous near retained80.55% /78.51% at identical native cameras. At a512px crown with production alpha hashing the new mesh retains97.65% /97.52%, versus82.32% /80.76% previously. Larger native paired views visibly show more of the source leaf surfaces and less exposed branch grain. This does not make the whole forest photorealistic by itself.

Use only `delivery/syringa-tree-near.glb` for the existing near slot. Leave current hero/medium assets unchanged until their actual camera ranges demonstrate a concrete issue.

| Asset | Triangles | GLB bytes | Compact geometry bytes | Coverage side /70° | Recommendation |
|---|---:|---:|---:|---:|---|
| New near |689,139 |38,586,500 |30,720,266 |97.30% /97.11% |Near integration candidate |
| Experimental hero |445,894 |28,644,932 |20,778,706 |90.73% /89.99% |Do not integrate by default |
| Experimental medium |343,270 |24,139,692 |16,273,460 |81.27% /79.97% |Reject for medium runtime density |

The strict preliminary candidates are retained as diagnostic evidence, not runtime recommendations. Their extra geometry was unnecessary to meet the95% near gate.

## Geometry and textures

Every one of30,250 original leaf components survives. Simplification adapts its local error to preserve oriented surface area, instead of assigning a few triangles to both simple leaves and much larger compound leaves. It only selects original vertex indices. It never expands leaves, recolors textures, moves leaf vertices, invents canopy surfaces or thins alpha.

The full original28,293-triangle trunk is retained. Detailed branches use14,746triangles; foliage uses646,100triangles. `compactPrimitive` removes unreferenced vertices and remaps indices after reduction. Independent parsing confirms zero unused vertices:13,545branch vertices,680,169leaf vertices and15,937trunk vertices, all referenced.

All output vertex positions, normals and effective UV values exactly match original source values. Source branch material usedUV1; after pruning the unusedUV0 set, the matching originalUV1 values are renamedUV0 along with material references. All embedded image payload bytes, including the author's leaf RGBA PNG alpha, remain unchanged. About7.86MB of the GLB is original image payload. The size is actual compact geometry and textures, not leftover unused source buffers.

## Placement compatibility

The asset remains in source metres, with ground-root origin[0,0,0] and identity node transforms. Keep the exact production scale `14/4.556740965694189`. No additional centering or normalization is required.

Whole-tree and leaf bounds are exactly equal to the original source. Bounds are:

- min `[-1.3089934587478638,-0.02410384640097618,-1.3826267719268799]`
- max `[1.6077065467834473,4.532637119293213,2.9098503589630127]`
- dimensions `[2.916700005531311,4.556740965694189,4.292477130889893]`

Relative to the previous reduced near asset, the original minimum-X leaf tip is restored: minX extends by0.007694m in source units (0.02364m at production scale). All other whole-tree bounds, including height, are identical to the previous near. Detailed branch-only bounds shrink slightly during reduction; the enclosing whole-tree bounds exactly match the original source.

## Evidence and limits

`verification.json` independently decodes the finalGLBs, checks source vertex/attribute membership, exact image payload hashes, finite coordinates, valid indices, no degenerate triangles, compaction and unchanged whole-tree bounds. `native-coverage-comparison.json` compares actual native original/current/new models at identical framing.

`final-specimens/` contains12 native controls. `large-final/` contains six768px paired views of current near, proposed near and original source at0° and70°. All report0shader andGL errors. The imagery is produced by actual production Three materials under nativeANGLE/Mesa; it is not browser, mobile or consumer-GPU performance evidence.

The replacement increases near triangle and vertex traffic. Its existing short camera range bounds the cost. The experimental hero/medium meshes are not recommended for broad deployment, since hundreds of those instances would become too expensive. No Site code or hosting state was changed by this study.

[Original source: Tree Small02](https://polyhaven.com/a/tree_small_02), by Rico Cilliers / Poly Haven. [CC0 licence](https://polyhaven.com/license). Original image and geometry provenance is recorded in the existing source download manifest and `dense-tree-study/packaging-manifest.json`.
