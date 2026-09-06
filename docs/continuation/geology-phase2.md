# Connected geology, phase 2 — candidate under review

This is a new implementation on `work/coast-completion`, not recovery of the
missing newer Site source. **Visual acceptance remains open.** The initial core
forest collision defect is now fixed and independently verified after parent
integration. No terrain, camera, final media or publication
gate has been changed.

## Diagnosis and chosen construction

Read the continuation review, original fractured-geology and higher-relief
reviews, and the rejected tall-cliff-source and east-buttress studies. Inspected
the actual existing mountain-wide and headland PNGs. The large pale faces are
too smooth, and little independent change of plane interrupts their surfaces.
The already rejected approaches matter: low open scans become pasted shelves
when enlarged, and a compressed heightfield makes one smooth retaining curtain.

The candidate adds six **closed, terrain-embedded bedrock masses** on authored
flanks. Each mass has four unequal buttresses, recessed seams, leaning divisions,
oblique bedding breaks, varying shoulders and a tapered toe. A broad derivative
of the actual terrain supplies strike. Positions and normals are real 3D mesh
attributes; lighting uses the existing matching rock albedo/normal/ARM material.
There is no backdrop, painted fracture, stretched photogrammetry source, fake
shadow, or terrain-height edit.

All perimeter vertices are 2.5 m beneath the actual terrain, and the back surface
is 9 m beneath it. The full exposed top is a continuous, nonfolding surface with
closed sides and back. Each volume stays attached to its host flank. Relief fades
below the existing upper summit shoulder; the actual 425 m summit is untouched.
The shared `createDetailedRocks` assembly adds identical static instances to the
visible and image-free worker paths.

## Source and independent CPU check

- `src/world/cliff-buttresses.ts`: geometry, material and six authored exposures.
- `src/world/detailed-rocks.ts`: three-line shared assembly integration.
- `scripts/control/check-cliffs.mjs`: independent emitted-triangle inspection.

The pure `isExposedCliff(x, z, clearance = 1)` API is in the same production module.
It derives a conservative footprint from the actual immutable emitted surface
triangles, using a 0.5 m buried contact allowance and exact projected-triangle
distance for the requested root clearance. It does not introduce another cliff
formula. Visible/worker geometry clones those same cached CPU buffers. No image,
DOM, asynchronous load or GPU is needed, and the imported material/habitat modules
do not import ecology, so ecology can safely import this query without a cycle.

Reviewed and executed:

```sh
node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-cliffs.mjs
```

Result: `CLIFF_CHECK_PASS`. Geometry SHA-256:
`68145d3bad72e9dadd2186ab6eaa94435e5c1d6cbf15d7d815ce7b85f7f6596d`.
This identifies the concatenated actual Float32 positions and indices, not a
manual description or cached placement record. A separate repeated construction
has byte-identical geometry.

| Exposure | Triangles | Maximum relief above terrain | Highest vertex | Minimum camera clearance |
|---|---:|---:|---:|---:|
| West coastal rib | 9,932 | 22.34 m | 167.92 m | 137.28 m |
| West gully wall | 10,812 | 24.33 m | 245.70 m | 132.75 m |
| Summit west shoulder | 11,644 | 29.46 m | 394.54 m | 62.06 m |
| Summit east shoulder | 9,628 | 27.81 m | 348.57 m | 21.85 m |
| East bay wall | 15,356 | 28.02 m | 249.92 m | 75.70 m |
| East headland face | 12,892 | 21.05 m | 163.27 m | 86.80 m |

The six extra static batches contain **70,264 triangles** in total. These are
unique emitted triangles, not accumulated renderer pass counters. The checker
limits this source to 110,000 triangles and six exposures. This is a geometry
budget, not measured consumer GPU performance.

Every edge has exactly two oppositely oriented incident faces; every face has
finite nonzero area and each volume has positive signed volume. Independent
subdivision samples across the full side-wall triangles remain at least 1.91 m
inside the actual terrain. More than half of each shell's vertices are buried;
substantial exposed vertices remain. Distance uses actual triangles, 1,201 flight
samples and all named evaluation cameras. It is a sampled route bound, not a
proof between all continuous samples.

Negative controls remove one triangle (closed-shell check fails), translate an
actual shell upward (contact check fails), and put a real triangle exactly through
a sampled camera (the distance oracle returns zero). The checker does not read
the production metadata's claimed bounds to establish any of these properties.

## Four-pass self-review

1. **Contract and provenance.** Confirmed that missing newer source is not
   available, the previously rejected scan/curtain approaches are understood,
   and all current changes remain inside the owned geometry/integration files.
   The terrain height function, 425 m summit, route, textures and existing asset
   licenses are unchanged.
2. **Implementation and geometry.** Read the new mesh construction and checker
   before execution. Checked surface winding, side and back closure, projected
   mapping without folding, deterministic fracture profiles, finite normals,
   material reuse, worker assembly and bounded geometry. The independent
   checker and all three negative controls pass.
3. **Integration and cost.** Six added batches and 70,264 triangles are bounded,
   but neither full-scene shader compilation nor artistic improvement follows
   from CPU checks. Requested matched parent-owned native mountain-wide and
   headland rendering. Source was frozen for that comparison; native execution
   and final acceptance belong to the parent.
4. **Hostile visual/forest hypothesis.** Tested the plausible regression that
   unchanged core tree roots become embedded in added rock. Raycast downward
   against the actual six meshes at the actual 14,000 production tree placements.
   **The regression is real:** 537 roots have more than 0.3 m new rock above them;
   241 have more than 5 m penetration but remain below nominal tree height; 152
   have rock above nominal full tree height. Maximum overlap is 25.91 m.
   Communicated these values to the parent before visual acceptance. Raising
   trees onto the new steep faces would be the wrong fix; deterministic ecology
   should reject exposed-rock roots and replenish eligible soil locations.
   Added the requested pure exclusion query after reporting the defect. Against
   those same old production placements it rejects all 537 actual intersections
   with **zero misses**, plus 117 roots in the conservative boundary collar
   (**654 total exclusions**). The parent integrated rejection in `ecology.ts`
   after all candidate RNG draws and existing route checks, preserving the
   unchanged candidate sequence outside the new exposures. The checker now
   independently raycasts 6,000 seeded points
   against the actual meshes and checks the exclusion query at every exposed hit;
   2,395 actual exposed hits pass and unrelated beach/summit points remain
   eligible. A second independent raycast visits **every regenerated production
   tree root**: all **14,000 trees** are replenished, with **zero rock/root
   intersections**, even before applying the 0.3 m error threshold. The closest
   remaining cliff surface is **1.4616 m below** a tree root. Root height stays
   exactly `renderedTerrainHeight(x, z) - 0.06`; no tree is moved up a rock face.
   Repeated regeneration is deep-equal. These checks are part of the owned
   `check-cliffs.mjs` command and require no browser or visible-world renderer.

## Remaining acceptance

Geometry and core-forest integration pass independent CPU inspection. Parent review
must also decide whether the actual shaded changes of plane break up the target
faces naturally or still read as repeated ribs. Full-scene matched rendering,
production-browser inspection and unchanged original
completion gates remain required. Do not label this candidate finished or claim
that native diagnostic images satisfy final media or browser cycles.
