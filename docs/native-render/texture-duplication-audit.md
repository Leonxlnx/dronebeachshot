# Texture duplication and tree scale audit

The nine production GLBs contain **72 embedded image occurrences but 39 byte-distinct payloads**. Exact deduplication can remove 33 repeated decodes, saving **132 MiB decoded RGBA** and an estimated **176 MiB GPU texture storage with full mip chains** when all LOD image sets have uploaded. SHA256 values, exact encoded lengths, dimensions, source image indices, and every occurrence are recorded in `texture-duplication-audit.json`.

| Texture quantity | Current | Deduplicated | Avoidable |
|---|---:|---:|---:|
| Embedded compressed image payloads | 13.658 MiB | 8.419 MiB | 5.240 MiB |
| GLB decoded RGBA8 | 287.876 MiB | 155.876 MiB | 132.000 MiB |
| GLB RGBA8 full-mip GPU estimate | 383.834 MiB | 207.834 MiB | 176.000 MiB |
| All loaded material textures, including standalone textures, full-mip GPU estimate | 554.501 MiB | 378.501 MiB | 176.000 MiB |

The earlier 436,077,568-byte decode audit equals **415.876 MiB**, comprising 287.876 MiB GLB images plus 128 MiB standalone textures. The nine GLB files total 40.338 MiB; image externalization would save at most the 5.240 MiB duplicate encoded payload, excluding packaging changes and transfer compression. Runtime image sharing alone does not reduce GLB network bytes.

## Exact duplicate groups

All duplicate images are 1024×1024; their individual encoded sizes and full SHA256 hashes are in the JSON.

| Image set | Shared among | Unique payloads | Repeated occurrences |
|---|---|---:|---:|
| Island trunk, leaves and branches: albedo, normal, roughness | Hero, medium, far | 9 | 18 |
| Syringa trunk and branches: albedo, normal, roughness | Hero, medium, far | 6 | 12 |
| Syringa leaves: albedo/alpha, normal, roughness | Hero, medium | 3 | 3 |

**Near-model images are different encoded payloads despite matching image names.** Do not deduplicate by name or family. Palm images and the syringa far 1008×1008 PNG canopy bake are unique. This audit establishes byte identity only, without assuming visually similar images are interchangeable.

## Narrow production change to consider

Add one per-`createVegetation` GLTFLoader image-cache plugin that shares decoded `THREE.Source` objects by **embedded byte SHA256 plus MIME/decode semantics** across the nine loader parses. Intercept only `parser.loadImageSource`; on a cache miss, call the original r185 implementation, preserving its browser decoding. Cache its unmodified result promise, and return a **fresh `Texture.clone()` on every request**, including the first request. Those clones share the same Source while their sampler settings, color space, UV transforms and material bindings remain independent. Reapply source-specific metadata to each clone if necessary; remove failed cache promises so loading errors propagate normally.

Keep official `loadTextureImage`, `assignTexture`, EXT WebP, KHR texture transform, alpha modes, material extensions, geometry and LOD selection unchanged. `Texture.copy` shares `.source` in r185, and `WebGLTextures` already reuses a GPU allocation for the same Source and compatible sampler/upload state. Its cache key includes wrap, filters, anisotropy, format/type, mipmaps, premultiplication, orientation, alignment and color space; UV transforms are independent uniforms. The actual duplicate groups have compatible production upload states, so this image sharing predicts 72→39 GLB GPU allocations.

This is a proposed change, not implemented. It uses a private r185 parser method, so keep the Three version pinned and verify map presence, alpha thresholds, UV transforms, all LOD transitions and before/after pixels. Sharing only image bytes or an ImageBitmap without sharing `THREE.Source` does not guarantee GPU deduplication. Do not close a shared bitmap while any material still uses it.

## Geometry scale check

Every primitive was measured after its actual `matrixWorld`, then after the exact scaling in `createVegetation`. The JSON includes raw, transformed and production bounds for every primitive, plus matrices and triangle counts.

| GLB | Production scale | Width × height × depth, meters | Height / near |
|---|---:|---:|---:|
| Island near | 5.294118 | 22.276 × 18.033 × 21.549 | 1.0000 |
| Island hero | 5.294118 | 21.449 × 18.049 × 21.611 | 1.0009 |
| Island medium | 5.294118 | 20.343 × 18.111 × 21.705 | 1.0043 |
| Island far | 5.294118 | 20.963 × 18.180 × 21.682 | 1.0081 |
| Syringa near | 3.072371 | 8.938 × 14.000 × 13.188 | 1.0000 |
| Syringa hero | 3.072371 | 9.180 × 14.058 × 12.868 | 1.0041 |
| Syringa medium | 3.072371 | 9.447 × 14.372 × 13.109 | 1.0266 |
| Syringa far | 3.072371 | 9.141 × 14.015 × 13.341 | 1.0011 |
| Palm | 1.910223 | 9.478 × 21.000 × 9.440 | — |

There is no far/medium scale collapse. The 5,908 island placements have mean upright height 16.21 m, the 2,352 syringa placements 12.35 m, and 240 palms 21.03 m. These apply placement scale to the source height; wind/lean changes the rendered silhouette slightly.

At `mountain-wide`, all island/syringa cells enable their far LOD, with medium overlap covering 712 placements; none enable near/hero. The nearest tree roots are about 276 m away. At `descent-reveal`, near packing includes four island roots, while hero/medium/far cells remain active. LOD activation counts are conservative cell counts before camera-frustum culling and shader coverage; they do not establish visible coverage. The sparse forest appearance therefore needs draw/coverage or terrain-occlusion investigation rather than a scale correction.

## Limits

GPU estimates use exact RGBA8/SRGB8_ALPHA8 texel totals for every full mip chain, grouped by Source and actual production texture state. They are not measured driver/browser VRAM. A single frame may upload fewer LOD images. Estimates exclude geometry, shadow maps, environment/refraction targets, decoder overhead and driver padding. No production assets, source files, quality settings or shaders were changed.
