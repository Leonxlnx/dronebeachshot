# Connected geology, phase 2 — v4 CPU-verified, visual review pending

## Current production candidate: bounded subtractive headland fracture

**V1, v2 and v3 were all rejected against the original scene.** Their additive
volumes are removed from `createDetailedRocks`, and the associated tree exclusion
is removed from ecology. Those two production files again match commit `462588e`
exactly. Their unchanged v3 source and checker are archived under
`docs/continuation/rejected/`; neither the old overlay nor its checker is active.

Contract revision 2 allows one different, bounded terrain attempt. New
`src/world/terrain-fractures.ts` describes one branching fracture in the eastern
headland, inside X 252–400 m and Z −58–143 m. The authoritative `terrainHeight`
subtracts its cut from the exact original height. It cannot raise terrain or
remove more than 20 m. The beach through 25 m inland, the protected calibrated
425 m summit and all terrain outside this compact region are unchanged by design.
No camera, seed, asset, material, separate mesh or distant-forest rule changes.
Existing terrain triangles, slope/habitat calculations, rock placement and tree
roots automatically use that one changed height source.

The new **read-only** CPU oracle is
`scripts/control/check-terrain-fractures.mjs`. It imports a byte-identical copy of
the pre-fracture math from commit `462588e855fc4773868321c73d1f703690344c5b`, saved as
`scripts/control/fixtures/terrain-before-fractures.ts`; its independently checked
SHA-256 is `fea9ca1ffb2581113be9fcb128076f503ee116a33327969d4b18b894e850ded8`
(9,067 bytes). Production never imports this fixture. No Git history or network
is required at check time, so shallow CI checkouts are supported.

Root inspected the complete oracle and approved its exact command before the
single self-check execution. **It passed** (`TERRAIN_FRACTURE_CHECK_PASS`, exit 0)
in 13.95 seconds. No limits were changed after the root's inspection.
It checks the full 601×801 Float32 grid against the frozen source, exact protected
areas and summit, a fixed 20 m cut limit and 250–3,000 changed vertices, actual
two-metre tile triangles/normals, off-grid ray intersections, the unchanged flight
and evaluation cameras, 14,000 deterministic terrain-bound roots and the absence
of active overlay integration. Negative controls raise terrain, alter shore or
summit, omit erosion, obstruct a camera and float a root. All six controls passed.

| Current v4 CPU measure | Result |
|---|---:|
| Actual core Float32 vertices inspected | 481,401 |
| Changed vertices | 866 |
| Maximum removal | 19.481102 m |
| Actual changed X / Z bounds | 284–384 m / −24–120 m |
| Highest summit | exactly 425 m |
| Protected shore and outside-region values | exact baseline equality |
| Actual triangles in the two touched production tiles | 40,000, unchanged |
| Regenerated terrain-bound trees | 14,000, deterministic |
| Minimum sampled flight ground clearance | 5.113556 m, unchanged |
| Minimum among named evaluation cameras and flight | 1.134144 m, unchanged |

The exact complete core surface SHA-256 is
`7da2df70cff89b5fd9977f7eb360e8182a64a16dfdc2b0f86888bbf989915a8c`.
Production source is frozen for root's independent rerun and matched images.
The first render and independent visual verdict are pending. Nothing in this
candidate is an accepted R1/G2 result.

## Historical record of the rejected additive studies

The measurements below describe the earlier v3 experiment at its recorded source
hash, **not current production**. Final parent and worker review rejected v3 too:
headland still became a smooth cap, and mountain-wide retained isolated convex
plates despite more legible seams. They are retained to explain the failed
approach and its technical evidence, not to recycle that evidence as acceptance.

This is a new implementation on `work/coast-completion`, not recovery of the
missing newer Site source. **Visual acceptance remains open.** The initial core
forest collision defect is now fixed and independently verified after parent
integration. No terrain, camera, final media or publication
gate has been changed.

**The first geometry candidate failed parent visual review.** Its actual matched
headland image showed regular tall pipes/fins, and mountain-wide showed repeated
triangular zigzag incisions. See the first batch under
`artifacts/phase2/landscape/`. Passing CPU checks did not establish natural geology.
The original 70,264-triangle version (geometry hash `68145d3b…f6596d`) is rejected;
the current source below replaces its continuous rib/bedding construction.

**The second candidate also failed visual acceptance.** In
`artifacts/phase2/landscape-v2/`, pipes were gone but headland became a smooth bare
bulb, while mountain-wide retained long convex patches. The measured headland
relief never reached its cap, so that cap was not its principal cause. The positive
bell-shaped shoulder and averaged shading softened small plane changes. The third
candidate removes that shoulder, shortens/widens the masses, and introduces a
sparse staggered network of actual terminating ledges/fractures. It still needs
fresh matched visual review; being better than either rejected study is insufficient.

## Diagnosis and chosen construction

Read the continuation review, original fractured-geology and higher-relief
reviews, and the rejected tall-cliff-source and east-buttress studies. Inspected
the actual existing mountain-wide and headland PNGs. The large pale faces are
too smooth, and little independent change of plane interrupts their surfaces.
The already rejected approaches matter: low open scans become pasted shelves
when enlarged, and a compressed heightfield makes one smooth retaining curtain.

The third candidate adds six **closed, terrain-embedded bedrock masses** on
authored flanks. A staggered irregular fracture net defines broad planes anchored
to sampled heights of the real flank. The mesh interpolates their absolute plane
heights, instead of adding four rib peaks and shared bedding offsets to rounded
terrain. The positive bell profile is gone. Sparse oblique joints cut real ledges
into the attached volumes and terminate within the face; they do not repeat as
several full-height grooves or continuous horizontal bands. Relief is bounded
to 18–20 m, exposures are shorter/wider, and the perimeter/toe remain buried.
Shading normals retain actual edges above 36 degrees instead of averaging every
joint. A broad derivative of the actual terrain supplies
strike. Positions and normals are real 3D mesh
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
`cf747f48430266c0907c73f6d5ac32f435fd66d6e16b7bcdbe9a0272e186a0b5`.
This identifies the concatenated actual Float32 positions and indices, not a
manual description or cached placement record. A separate repeated construction
has byte-identical geometry.

| Exposure | Triangles | Maximum relief above terrain | Highest vertex | Minimum camera clearance |
|---|---:|---:|---:|---:|
| West coastal rib | 11,196 | 17.28 m | 162.62 m | 144.50 m |
| West gully wall | 12,764 | 19.00 m | 241.81 m | 123.83 m |
| Summit west shoulder | 12,988 | 20.00 m | 387.68 m | 69.78 m |
| Summit east shoulder | 10,900 | 18.67 m | 328.97 m | 29.87 m |
| East bay wall | 16,344 | 19.00 m | 237.62 m | 77.14 m |
| East headland face | 12,292 | 15.64 m | 149.67 m | 88.29 m |

The six extra static batches contain **76,484 triangles** in total. These are
unique emitted triangles, not accumulated renderer pass counters. The checker
limits this source to 110,000 triangles and six exposures. This is a geometry
budget, not measured consumer GPU performance.

After welding exact duplicate positions introduced by creased shading, every
edge has exactly two oppositely oriented incident faces; every face has
finite nonzero area and each volume has positive signed volume. Independent
subdivision samples across the full side-wall triangles remain at least 1.73 m
inside the actual terrain. More than half of each shell's vertices are buried;
substantial exposed vertices remain. Distance uses actual triangles, 1,201 flight
samples and all named evaluation cameras. It is a sampled route bound, not a
proof between all continuous samples.

A separate all-face normal inspection verifies finite unit normals and a maximum
28.82-degree deviation from their actual incident triangle normal. The checker
includes the same 36-degree maximum deviation bound, ensuring that shading does
not invent a plane absent from the real geometry. All earlier numeric geometry,
contact, route, forest and cost thresholds remain unchanged.

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
3. **Integration, visual failure and revision.** Six added batches and the
   initial 70,264 triangles were bounded,
   but neither full-scene shader compilation nor artistic improvement follows
   from CPU checks. Requested matched parent-owned native mountain-wide and
   headland rendering. Source was frozen for that comparison; native execution
   and final acceptance belong to the parent. Parent and worker both inspected
   the actual resulting images and rejected the pipe-like fins and repeated
   zigzags. Removed that entire rib/bedding formula for the second candidate;
   replaced it with lower, staggered planar fractures anchored to actual flank
   heights. Its 68,600 triangles passed CPU checks but parent and worker rejected
   the actual second images: headland was a smooth bulb and long convex patches
   remained in mountain-wide. The third candidate removes the bell profile,
   changes proportions, cuts sparse terminating joints and keeps actual creases.
   Its 76,484 triangles pass the original numeric thresholds unchanged. Exact
   position welding accounts for split shading normals in the topology oracle;
   closure and negative controls remain required. Source is frozen for new images.
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
   2,395 actual exposed hits passed for the first geometry and 1,976 for the second;
   **2,345 actual exposed hits pass for the current third candidate**, and unrelated beach/summit
   points remain eligible. A second independent raycast visits **every regenerated production
   tree root**: all **14,000 trees** are replenished, with **zero rock/root
   intersections**, even before applying the 0.3 m error threshold. The closest
   remaining cliff surface for the current source is **1.4400 m below** a tree root.
   Root height stays
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

## Final parent and independent v4 review

Parent re-verification passed the new terrain oracle, and all five current-source
native frames were reviewed by parent plus two reviewers. G2 passes only the
bounded local headland improvement. Three original matched named views show no
new dominant terrain/shore regression; flight-10/20 are supplementary checks
without original pairs. Regenerated trees/rocks are not pixel-identical outside
the cut. Large smooth pale faces, grainy crowns and wider scene-art defects remain
open. See PHASE2.md and artifacts/phase2/final-review.json. No browser cycle or
global reference-quality acceptance is inferred.
