# Tall cliff source review

**No verified, ready-to-integrate CC0 source meets the tall broken coastal-face requirement in this bounded search.** One new lead has materially stronger visible macrogeometry: **Fort Rock Landscape**. Its creator preview shows a genuine tower and deep continuous cliff. The two smaller Poly Haven alternatives improve local rock structure but retain the open-shell problem and cannot supply the reference-scale height.

The uploaded references show tall narrow grey faces, deep vertical breaks and irregular forested ridges. This is a visual shape comparison, not a geological identification of the reference.

## Three-source shortlist

| Source | Actual downloadable mesh dimensions: width × height × depth | Triangles | Author / license | Feasibility and shape judgment |
|---|---|---|---|---|
| [Fort Rock Landscape](https://blendswap.com/blend/26674) | **Unpublished / unmeasured** | **Unpublished / unmeasured** | ogbog (Oscar Baechler); CC0 on original upload | Strongest tall-form lead. Creator preview has deep towers and a connected wall. Catalogue: Blender 2.9x/Cycles, 322 MB. Texture resolution, PBR completeness and topology unknown; author reports baked-shadow errors. |
| [Coastal Cliff02](https://polyhaven.com/a/coastal_cliff_02) | **40.9276 × 10.0532 × 8.6477 m**, from official glTF POSITION bounds, identity node | **943,284** in downloadable LOD0; catalogue **1,768,655** | Rob Tuytel; [CC0](https://polyhaven.com/license) | More coherent grey upright front than Cliff01, with less shelf emphasis. Still only ten metres tall; side/top previews clearly show an open back and ends. A local rock band, not a tall mountain wall. |
| [Namaqualand Cliff02](https://polyhaven.com/a/namaqualand_cliff_02) | **20.2275 × 7.1838 × 6.5934 m**, same metadata method | **194,080** in downloadable LOD0; catalogue **363,896** | Dario Barresi, photography; Rico Cilliers, modeling; [CC0](https://polyhaven.com/license) | Best individual block breakup: deep vertical fissures and changing face angles. Official side view shows an open scan shell; full depth is not solid rock thickness. Too small and too slab-like for principal cliffs. |

Triangle counts come from the official glTF index accessor count divided by three. No geometry buffer was downloaded or counted. Exact boundary-edge counts, manifold status and connected components are consequently **unknown**. `doubleSided: true` exists in the Poly Haven material metadata, but is not used as proof of openness; the official side previews supply that visible evidence.

## Stronger lead, with explicit limits

The original [Fort Rock upload](https://blendswap.com/blend/26674) identifies a drone scan and warns that moving sunlight produced inconsistent baked shadows. The [creator's own portfolio](https://ogbog.net/2021/08/06/3d-backlog/) corroborates the work and author identity. The preview gives a materially better *shape* basis than another rectangular coastal patch, but does not establish clean albedo, usable map resolution, mesh scale or geometry budget.

The real Fort Rock feature has roughly 60 m vertical relief according to [Oregon State University's geological description](https://volcano.oregonstate.edu/fort-rock). **That is real-world context, not a measurement of this model.** Its orange-brown tuff also differs from the grey, narrow reference ridges. No full download or integration is recommended solely from this preview; inspection of the original file would be a separate next step.

## Downloadable metadata, not downloads performed

| Poly Haven asset | Complete 1K glTF package | Complete 2K package | Available texture variants |
|---|---:|---:|---|
| Coastal Cliff02 | 29,157,838 bytes | 35,788,354 bytes | 1K, 2K, 4K, 8K |
| Namaqualand Cliff02 | 8,378,923 bytes | 15,517,993 bytes | 1K, 2K, 4K, 8K |

Packages include the glTF, geometry BIN and matching textures, derived from each official [Coastal Cliff02 files record](https://api.polyhaven.com/files/coastal_cliff_02) and [Namaqualand Cliff02 files record](https://api.polyhaven.com/files/namaqualand_cliff_02). Both assets advertise LODs; the inspected glTF contains only the named LOD0 mesh. Lower texture resolution does not imply fewer triangles.

The official catalogue dimensions use the source axes in millimetres; glTF exports are Y-up. The table deliberately reports glTF width/height/depth rather than mistaking source depth for vertical height.

## Coastal Cliff04 ruled out before the shortlist

Reinspection confirms **86.7720 × 10.9997 × 24.2474 m**, with **1,537,926** glTF triangles versus **2,883,111** catalogue triangles. Its official preview is a broad low terrace and rubble base. The extra depth does not provide taller relief. This would repeat the wrong source shape for the current goal. [Original source](https://polyhaven.com/a/coastal_cliff_04).

## Saved evidence and scope

- `shortlist.json`, each `*-metadata-summary.json`, and `fort-rock-metadata.json`: exact records and unknowns.
- `coastal_cliff_02-1k-metadata-only.gltf` (3,220 bytes) and `namaqualand_cliff_02-1k-metadata-only.gltf` (2,857 bytes): original metadata, no linked geometry BIN or texture payloads.
- `model-catalogue.json`: official Poly Haven model catalogue used to screen actual dimensions, not asset names alone.
- `preview-sources.json`: exact official/creator preview URLs and downloaded byte counts.
- `fort-rock-preview.png`, `coastal-cliff02-{preview,side,top}.png`, `namaqualand-cliff02-{preview,side}.png`: viewed original previews.
- `coastal_cliff_04-exclusion.json`: prior source metadata reevaluated, with official preview.

No source geometry, large GLB/Blend file, production edit, native render or new placement study was performed. All findings distinguish official preview evidence from unmeasured mesh properties.
