# Coherent coastal cliff source comparison

**Coastal Cliff01 is the smaller feasible source for one grounded lower cliff band.** It supplies genuine connected ledges, undercuts, and a turf crest. It does not supply the tall pale fractured fins in reference01, and its current-light appearance is warm tan-brown rather than pale grey.

| Original source | Physical glTF size, width × height × depth | glTF triangle count | Original glTF package size | Available texture resolutions |
|---|---:|---:|---:|---|
| [Coastal Cliff01](https://polyhaven.com/a/coastal_cliff_01) | 91.98 × 10.33 × 10.97 m | 461,824, measured in downloaded mesh | 1K 15.38 MB; 2K 20.88 MB | 1K, 2K, 4K, 8K |
| [Coastal Cliff04](https://polyhaven.com/a/coastal_cliff_04) | 86.77 × 11.00 × 24.25 m | 1,537,926, from official glTF accessor metadata | 1K 46.48 MB; 2K 54.10 MB | 1K, 2K, 4K, 8K |

Counts differ from the website/API headline values (865,917 and 2,883,111); use the actual delivered glTF level for budgeting. Both list LOD availability, but Cliff01’s downloaded glTF contains one mesh level. The package sizes include geometry and all required original JPEG maps; they do not include optional Blender/USD/FBX exports. [Cliff01 files](https://api.polyhaven.com/files/coastal_cliff_01), [Cliff04 files](https://api.polyhaven.com/files/coastal_cliff_04).

Both assets are by Rob Tuytel (photography/processing) and Rico Cilliers (cleanup), licensed CC0. Poly Haven explicitly permits commercial use and redistribution of the asset files without required attribution. Attribution/provenance is retained here. This license statement concerns assets, not reuse of the website’s promotional preview renders. [Poly Haven asset license](https://polyhaven.com/license).

## Visible suitability

Cliff01’s inspected primary/orthographic previews show a long eroded wall with an irregular natural turf lip, relief below the crest, and open rear/ends. It is more coherent than combining a small scanned face with unrelated boulder caps. Its very low aspect ratio limits sensible use to a lower headland wall or exposed coastal band. A uniform scale of 1–2 yields roughly 92–184 m width and 10–21 m height; scaling cannot turn it into a steep mountain fin. [Source previews](https://polyhaven.com/a/coastal_cliff_01).

Cliff04’s orthographic previews show a deeper, more broken front with larger recesses, ground debris, and a grassy crest. That is useful secondary variation, but it has a similar low height and roughly 3.3 times the delivered glTF triangle count. Only its 2.8 KB glTF metadata was downloaded; closedness and connected topology have not been audited. [Source previews](https://polyhaven.com/a/coastal_cliff_04).

Reference01 has tall upright fractured pale-grey rock faces integrated into densely forested steep ridges. These two coastal scans can improve local geological detail; neither establishes a match for the reference’s overall mountain structure. This is visual comparison, not a geological identification of the reference.

## Actual Cliff01 mesh and specimen evidence

The original 2K package was downloaded into scratch and every file matched its official size and MD5. GLB conversion changed the container only: original positions, normals, UV, materials and compressed JPEG bytes are preserved. The packed GLB is 20,883,908 bytes.

The mesh has 238,686 vertices, 461,824 triangles, one connected component after positional seam welding, 2,558 open boundary edges, zero nonmanifold edges and zero degenerate triangles. This is an open environmental scan; rear/base/end boundaries need terrain embedding. The genuine turf crest is intact. Full bounds and binary hash are in `coastal-cliff-source-inspection.json`; all asset URLs/checksums are in `coastal-cliff-provenance.json`.

The two useful native views are `source-sunlit-wide.png` and `source-sunlit-detail.png`. Original geometry is at uniform scale 1, with one rigid 180° Y rotation so the front receives the existing sunlight. The source’s colors and maps are unchanged. The first three identity-orientation frames remain available but are backlit and are poor albedo evidence.

Native ANGLE/Mesa llvmpipe, Three production lighting snapshot, 960×540, linear half-float 4× MSAA and official OutputPass. Sunlit run: zero GL/shader errors, exit 0, peak RSS 601.62 MB. These are isolated source specimens, with no terrain, ocean, vegetation, added caps or retouching. They are not browser screenshots and do not validate terrain placement.

No production modifications, coastal worker changes, or large 4K+ downloads were made. Placement should preserve uniform scale, original visible geometry, UV and crest turf, and must bury the measured open perimeter into the actual terrain before acceptance.
