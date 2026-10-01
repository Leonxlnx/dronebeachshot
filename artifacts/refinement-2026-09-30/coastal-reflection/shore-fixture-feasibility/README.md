# Shore fixture feasibility: do not proceed

A faithful call through the current production terrain/ocean/material constructors does not fit an honest ~400 MiB incremental budget. A cheaper cropped scene could expose gross shoreline contact faults, but its changed illumination and texture response would not reliably decide the production sand or forest reflections. Root therefore stopped this fixture before implementation or browser launch; the existing full-scene comparison remains pending memory headroom.

## Source-backed allocations

| Retained resource | CPU/backing estimate | GPU estimate if fully uploaded |
| --- | ---: | ---: |
| Fourteen production texture images: twelve 2048² and two 1024² | 200.00 MiB RGBA8 | 266.67 MiB including complete mip chains |
| Core terrain: 48 tiles, 10,201 vertices each | 26.04 MiB | up to 26.04 MiB |
| Coastal continuation: 2,800 perimeter vertices × 292 rings; 1,629,600 triangles | 46.72 MiB | up to 46.72 MiB |
| Near ocean: 36 exact-grid tiles, position/index attributes only | 18.66 MiB | up to 18.66 MiB |
| Coastal collision/depth field: 1024² RGBA32F | 16.00 MiB | 16.00 MiB |

Textures alone total **466.67 MiB** under the ordinary decoded-RGBA8/full-mip model. The three listed geometry sets retain another **91.42 MiB CPU**, plus up to the same amount on the GPU. These are logical buffer calculations, not observed native RSS; culling can avoid some GPU uploads. Browser overhead, compilation, worker scratch, swash, rocks, shadow maps, cloud capture/PMREM and forest are excluded. Smaller canvas dimensions do not shrink these allocations.

Exact dimensions, byte formulas, source hashes and line anchors are recorded in `evidence.json`. The main dependencies are `world/assets.ts` (parallel full-size texture loading), `terrain.ts` (all core tiles and the full continuation), `ocean.ts`/`ocean-tiles.ts`, and the 1024² field in `coastal-loader.ts`.

## Why the obvious reductions are not an equivalent visual study

- `createDistantBathymetry` explicitly samples `continuous-coastal-extension`. Removing the continuation or substituting a generic bottom changes transmitted-water color. A faithful crop would need CPU-precomputed real field data plus conservative geometry for both main and mirrored views and sun-shadow receivers/casters.
- Omitting trees removes canopy reflections and shadows. Forcing near trees to the existing far atlases changes their shape and coverage; `vegetation.ts` provides no far-atlas branch for palms (`family===2`). Atlas source images, premultiplied derivatives and source-visibility maps also retain substantial memory.
- Reducing sand normal/ARM textures changes the same gloss/grain response being judged. Reducing albedo requires correct linear-light filtering to preserve its calibrated color. A matched low-resolution A/B would isolate a control in that reduced fixture, but would not establish the production preference.
- The geometry-only rock pack contains positions and indices; it omits the scan normals, UVs and original PBR images. It is authoritative for collision shape, not a visually equivalent replacement for the scans.

The previously completed tiny GPU fixture already tests the actual reflection helper, ocean reflection function, clipping, MSAA edges and state restoration. Another approximate scene would add limited contact evidence while leaving the requested appearance decision unresolved. Production textures, dimensions, scene code and the running film remain unchanged by this feasibility review.
