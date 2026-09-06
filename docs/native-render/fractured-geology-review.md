The first geology correction removes the scattered round-boulder treatment and exposes connected fracture faces. It intentionally does not fix the eight radial mountain silhouettes; that needs the next landform pass.

Observed causes in cycle-04/mountain-wide and the two coastal references:

- `terrainHeight` uses the maximum of eight elliptical radial power cones. Texture or extra rocks cannot turn those cone silhouettes into long, branching ridges.
- The old `createRocks` adds 1,450 smooth superellipsoids, including 3–13 m scale rocks across essentially every inland slope above 0.8. Centers sit only 0.24 scale below terrain, leaving isolated round shapes all over the faces.
- Ground transitions from soil to stone over approximately 39–70 degrees of incline. Consequently much of the conspicuous exposed relief remains brown soil.
- The scanned seaside-rock albedo is dark brown/gray, and old instance colors multiply it by roughly 0.55–0.76. The reference's dry exposed cliffs are appreciably lighter than its coastal weathered blocks.

The candidate in `fractured-geology.patch` changes only `createRocks`, one helper/import in terrain.ts, and ground/rock material code:

- 212 fractured slabs form 62 coherent steep-face patches. Adjacent slabs share a downslope-facing strike, overlapping widths and varied oblique joints. Real convex hull geometry supplies flat fracture planes and the silhouette. The existing scanned color, normal and ARM maps supply grain.
- 110 smaller angular talus blocks occur in clusters at the coastal headlands. No independent round boulders are scattered through inland forest or across the central beach.
- Slabs are embedded by 0.82 of their vertical half scale, talus by 0.62. All 322 instances have actual vertices beneath the exact rendered terrain. This verifies intersection, not complete burial/contact along every perimeter edge.
- Ground stone exposure moves to approximately 30–55 degrees. The same mask continues to choose color, normal and ARM, so the visible material remains coherent.
- Dry elevated fracture faces smoothly reveal a lighter, partly desaturated version of the scanned mineral grain. This preserves spatial texture variation and caps reflectance at 0.65; it is an albedo adjustment under normal lighting. The effect starts at 15 m elevation, reaches full strength at 65 m, and fades out on upward-facing surfaces. Low coastal rock, moss, wetness and their roughness behavior remain intact.
- Instance color is nearly neutral 0.88–0.98, avoiding the old extra darkening. Geometry remains instanced, shadow casting and shadow receiving.

Native Three r185 shader compilation/rendering completed with zero shader errors and zero GL errors, and `git apply --check` passes against the current checkout. Validation is in `geology-native-audit.json`; `geology-comparison.png` is before above / candidate below. The render uses exact production terrain and texture assets with a fixed sun and sky fill, omitting vegetation, atmosphere, ocean and shadows to isolate geology. It is not full-scene visual acceptance or performance evidence.

| Geometry / field check | Before | Candidate |
| --- | ---: | ---: |
| Instances | 1,450 | 322 |
| Rock triangles | 2,349,000 | 14,168 |
| Instances intersecting terrain | 1,450 sampled | 322 all vertices checked |
| Shallowest maximum terrain penetration | 0.94 m sampled | 1.74 m |
| Largest vertex height above local terrain | 34.44 m sampled | 26.67 m |

The exact production coastal-field builder visits all 322 instances and rasterizes 109 coastal instances, with 2,345 triangles contributing and zero degenerate triangles. Its terrain source, dimensions, rock silhouette rasterization and wave-shelter calculation are unchanged. Shoreline, core tile vertices, continuation vertices, terrain height texture and camera terrain-clearance values are unchanged by this patch. Full-scene shadow, forest intersection and water appearance still require root's integration render.

Next landform pass, not implemented here:

1. Replace radial distance from isolated peaks with signed distance to two or three connected, branching ridge spines. Use short curved/polyline segments, a closest point along each segment, interpolated crest elevation and independently varying flank widths. Existing peak anchors can define high points along those chains rather than each generating an entire cone. An illustrative local section is `crest(s) * exp(-pow(abs(crossDistance)/width(side,s), 1.45))`, with a narrower seaward flank and wider inland flank. Smooth transitions between adjacent segments; a hard max can retain unintended creases at joins.
2. Cut a sparse network of nonperiodic drainage channels from crest shoulders toward the coast. Subtract bounded troughs such as `depth(s) * exp(-0.5 * pow(distanceToChannel / width(s), 2))`, with channels widening downslope and dying out near the shore. This carves large readable rock ribs and valleys; repeating sine grooves or high-frequency height noise will not supply that structure.
3. Keep the current exact shore/seafloor/low-beach function and blend new relief only inland. Put the height formula in the authoritative `terrainHeight` path, so rendered terrain, tree roots, habitat, coastal field, camera diagnostics and terrain texture regenerate from one shape. After a change, check the flight path and visible cliff/forest intersections using that same heightfield.
4. Distant silhouettes also need sufficient geometric samples across their crest and shoulder curvature. The current continuation has 64/128 m radial spacing far out. Refine only ridge-crossing/high-curvature radial spans (or use a continuous nested terrain grid); do not try to hide visibly faceted long-distance crests with haze or material noise. Preserve the exact existing core seam collar.

Integrate the patch hunks, not the entire saved terrain candidate: root is concurrently editing other terrain/scene work. `terrain-fractured-geology-candidate.ts` and `ground-materials-geology-candidate.ts` are review copies. The corresponding `*-native.ts` files only rewrite imports for the isolated native process.
