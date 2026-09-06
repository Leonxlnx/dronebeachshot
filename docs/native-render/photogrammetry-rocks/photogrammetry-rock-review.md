The scratch candidate replaces a bounded set of existing nearby primitives with actual photogrammetry from [Rock Moss Set 01](https://polyhaven.com/a/rock_moss_set_01), by Kless Gyzen. The original downloaded glTF, binary buffer and three JPEG maps match every official API size and MD5. The GLB is a container-only repack: no geometry decimation, normal rebuilding, UV edits or image recompression. Poly Haven publishes the assets under [CC0](https://polyhaven.com/license). Full source URLs, SHA256 values and published checksums are in `hero-rock-source/rock-moss-provenance.json`.

`hero-rock-source/rock_moss_set_01_2k.glb` is 3,256,512 bytes; SHA256 `864ece45cf6cafeb7fab5ab65704b1810622ba411da2026ebad847a0a08eab2f`. A unique identifying User-Agent worked for the official public API and downloads. Production uses local files and does not need the API.

| Original specimen | Actual glTF bounds X × Y × Z, metres | Full triangles | Optional medium triangles | Candidate use |
| --- | --- | ---: | ---: | --- |
| rock01 | 2.238 × 1.473 × 3.369 | 11,000 | 6,876 | closed; used |
| rock02 | 2.655 × 1.262 × 3.264 | 10,996 | 5,982 | closed; used |
| rock03 | 2.109 × 1.100 × 2.080 | 5,000 | 4,016 | closed; used |
| rock04 | 2.128 × 1.768 × 1.965 | 10,589 | 6,823 | excluded: original boundary defects |
| rock05 | 1.817 × 1.205 × 2.999 | 16,548 | 8,274 | closed; used |
| rock06 | 2.126 × 1.262 × 2.757 | 8,994 | 4,550 | closed; used |

Five specimens are closed after welding coincident positions at 0.00001 m solely for the audit. Specimen 04 has 18 original boundary and 9 non-manifold edges and is excluded. Normals are unit length to roughly 1e-7. The source supplies one shared material with base color, OpenGL normal map and packed metallic/roughness map; it specifies metalness zero, roughness one and double-sided rendering. The GLTFLoader material and its normal convention are retained exactly, including normalScale=(1,-1) in Three r185. No extra AO map is invented. The three 2048² maps use about 64 MiB including full RGBA mip chains in the native adapter; all instances share them.

`rock-moss-source-inspection.png` shows the unmodified six-piece showroom from four native views. `photogrammetry-rock-comparison.png` shows original primitives on the left and the candidate on the right, using the actual production positions, current shared terrain height, real PBR maps, and an isolated local terrain patch. The upper pair is a steep flank and the lower pair is coastal talus. The source's irregular edges, corners and fissures improve the near silhouettes. The steep flank still reads as separate exposed blocks; this bounded replacement is not a finished continuous cliff treatment. Full-scene lighting and geological continuity still need root's art review.

The placement helper `upgradeNearRockOutcrops(geology, gltf.scene, options)` replaces existing instances only. It selects up to 48 existing placements within 180 m of the authored route/evaluation focus positions. It removes the glTF showroom translations, centers each specimen, keeps uniform scale, rotates its base toward the actual local slope, and buries 60% of its vertices. Each final horizontal bounding box and upper Y bound is constrained inside the previous primitive's conservative bounds. Two fully buried proposals are skipped. No terrain or camera changes are included.

| Native candidate check | Result |
| --- | ---: |
| Existing instances upgraded | 46 |
| Original primitives retained | 294 |
| Full-detail upgraded triangles | 477,842 |
| Medium upgraded triangles | 271,298 |
| Uniform scale range | 0.933–4.800 |
| Smallest deepest terrain penetration | 1.117 m |
| Largest vertex protrusion above local terrain | 5.635 m |
| New X/Z boxes contained by prior boxes | True |
| New top bounds at/below prior tops | True |
| Shader / GL errors | 0 / 0 |

The optional medium LOD changes only index buffers. It uses the existing meshoptimizer package with normal/UV attributes, seam borders locked, 50% target and .004 reported normalized error. The error limit prevents aggressive reduction: resulting meshes retain 50–80% of original triangles. It does not alter original positions, normals, UVs, or hero geometry. At the largest allowed scale, the reported error converts to at most 0.064 m; at 180 m distance this is below half a pixel for a 1080-high, 54-degree camera. Treat this as the simplifier's error estimate, not a Hausdorff proof. Native full and medium geometry/material passes compile and render without errors. No forced low-poly near tier exists. Omitting mediumIndices keeps every upgraded stone at full detail.

Minimal integration, in root's code only:

```ts
const gltf = await new GLTFLoader().loadAsync('/assets/rocks/rock_moss_set_01_2k.glb');
const rocks = createRocks(textures);
const heroRocks = upgradeNearRockOutcrops(rocks, gltf.scene, {
  terrainHeight: renderedTerrainHeight,
  focusPoints: [
    ...Array.from({length:81}, (_,i) => pathPosition(i*.25)),
    ...Object.values(evaluationCameras).map(c => c.position),
  ],
  // mediumIndices is optional; leave out for the first full-scene art trial.
});
scene.add(rocks);
// Run the existing material diagnostics/cloud-lighting traversal afterwards.
// In draw(), before refraction and final rendering:
heroRocks.update(camera.position);
```

Regenerate the coastal field from `rocks` after the upgrade and before any LOD update; `restoreFullDetail()` restores all hero instances for geometry-derived fields. The current worker independently calls unmodified createRocks, so its cached mask is not valid for changed coastal silhouettes. Root must route the same upgrade into its field-generation path, or build the field from the upgraded group for the first trial. The native check did exactly that: 340 instances visited, 118 coastal instances rasterized and zero degenerate triangles. The prior conservative camera rock envelopes contain every new horizontal footprint/top, so this candidate does not enlarge those envelopes; a new full scene should still be inspected normally.

The integration helper expects the ordinary identity-transform geology root from createRocks. It mutates that scratch/test group and compacts retained instance arrays; it does not dispose shared geometry/materials. Selection and transforms are deterministic for the given current terrain and focus points. Loading or rotating a different source family requires a new audit.

Rock Face 02 was downloaded first and retained separately with provenance. Native inspection revealed it is an open cliff scan rather than a solid outcrop. It was deliberately excluded from this candidate; it could be considered later only as a genuinely embedded scanned cliff face whose open perimeter is hidden by terrain. No source files were changed and no Site checkout files were edited by this subagent.
