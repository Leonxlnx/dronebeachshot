The geometry-only worker source is ready. It produces exactly the same upgraded rock positions, indices, instance matrices and 16 MiB coastal field as the fully loaded original GLB, using the same current terrain, focus points and upgradeNearRockOutcrops helper.

| Integration artifact | Purpose |
| --- | --- |
| `rock-geometry-decoder-candidate.ts` | Pure Three decoder; export decodeRockGeometrySource(buffer: ArrayBuffer): THREE.Group |
| `hero-rock-source/rock_moss_set_01_geometry.bin` | Self-describing 789,976-byte pack; all six original meshes |
| `hero-rock-source/rock_moss_set_01_geometry.json` | Readable metadata, source checksum and individual stream checksums; not required at runtime |
| `rock-geometry-equality-audit.json` | Exact comparison results and hashes of all current code dependencies |
| `pack-rock-collision.py` | Reproducible extraction from the original verified GLB |

Pack SHA256: `581b4f5b375b1eb2bed91178120d31811d09001904f43ee5f78e0168b61f6e42`.

Identical full-GLB and geometry-only coastal-field SHA256: `68a92d43bba7aac8e08c66a6ca418e1bce3c8ef2c3a0a0f1c9d14db1eb13e8ea`. Both contain 16,777,216 bytes and use 46 upgraded instances. The audit compared the actual byte arrays in addition to their SHA values; source positions/index streams, transformed geometry and complete instance-matrix arrays also match exactly. All six original mesh names and world transforms match. The original variant 04 is preserved in the pack; the shared upgrade helper excludes it exactly as in the main scene.

The pack copies 407,856 original Float32 position bytes and 378,762 original Uint16 index bytes. It performs no simplification, quantization, reordering or transform baking. Original node transforms and names are in the embedded metadata. Only normals, UVs, images and visual materials are omitted. Three creates one shared MeshStandardMaterial stub, which is sufficient for the unmodified upgrade helper's material clone. This group is a CPU geometry input, not a visual substitute for the main GLB.

The decoder imports only Three and uses ArrayBuffer, DataView and TextDecoder. It does not import GLTFLoader, image decoders, Node APIs or DOM/WebGL code. It decoded successfully with document and window absent before the reference GLB loader was installed. The test used no new worker or browser. Three header/length rejection checks also passed. The original source's three RGBA image decodes (48 MiB) are eliminated from the geometry-only path.

Worker/check-world integration:

```ts
const response = await fetch('/assets/rocks/rock_moss_set_01_geometry.bin');
if (!response.ok) throw new Error(`Rock geometry fetch failed: ${response.status}`);
const source = decodeRockGeometrySource(await response.arrayBuffer());
const rocks = createRocks(stubTextures);
const upgrade = upgradeNearRockOutcrops(rocks, source, {
  terrainHeight: renderedTerrainHeight,
  focusPoints: sharedRockFocusPoints(),
});
const field = createCoastalField(upgrade.group);
```

Keep sharedRockFocusPoints, terrain, selection settings and the upgrade implementation identical in main/worker/check-world. The equality test used the same 81 quarter-second route positions plus the 16 evaluation camera positions from the current camera module. Omit mediumIndices in the worker so the field always uses full geometry. Main can continue loading the original GLB and use its original material. The existing asynchronous coastal task can remain asynchronous.

The decoder makes independent exact stream copies, so its input ArrayBuffer can be transferred or released afterwards. After upgradeNearRockOutcrops clones the six source geometries, the temporary decoded source geometries and its single shared stub material can also be disposed if desired. No Site checkout or production files were edited.
