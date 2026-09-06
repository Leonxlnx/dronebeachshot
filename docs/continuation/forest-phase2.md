# Distant canopy — phase 2 rejected experiments

This pass addresses the homogeneous remote canopy in the existing full-scene
diagnostic views. It does not accept the complete forest, any production-browser
cycle, performance target or final image. **All three candidates were rejected.**
The production forest file has been restored byte-for-byte from commit
`462588e855fc4773868321c73d1f703690344c5b`. The following implementation and CPU
records describe inactive experiments, not currently shipped forest changes.

## What changed

The remote layout is now a separate deterministic module. It samples the same
rendered annulus triangles used before; tree meshes still use the two original
24-view source impostors with their unchanged albedo, normal and source-sun
visibility data. Instance colour response, impostor material and near vegetation
are unchanged by this leaf.

- Broad stand boundaries combine two spatial scales with a slowly warped
  coordinate field. Open patches contain sparse regeneration rather than the
  same mature crown density everywhere.
- Four actual surface samples, 56 m from each root, distinguish a convex
  shoulder from a hollow. Shelter and slope affect density and stand maturity.
  These are art-directed ecological heuristics, not a measured botanical model.
- Regeneration, main canopy and a small emergent population have distinct height
  ranges. Shared stand maturity connects neighbouring heights; individual
  variation breaks repetition. Each source tree is uniformly scaled.
- Species tendency varies over coherent stands. Both original source families
  remain present across the landscape; the candidate history below records how
  mean crown footprint and regeneration placement were refined after review.
- The existing northern traversal boundary now thins over 680 m instead of
  ending in a straight final row. The original domain, 14 m candidate spacing,
  300 m culling cells, seed and inner/far distance bounds remain intact.
- A fixed seven random values are consumed for every candidate. An edit to one
  terrain patch cannot move unrelated trees by shifting the random stream.

## Expert pass

The prior source-colour studies found no major far-atlas colour-space error;
recolouring the forest would conceal the structural issue. This candidate leaves
the complete source lighting path intact. Increasing source-family draw batches,
adding crown spheres or replacing ground with skyline geometry was unnecessary.
The existing cell/family assembly and two-triangle impostor cost are preserved.

The habitat decisions are resolved in world metres and actual surface height.
They do not depend on the current camera, so a moving camera sees a stable forest.
Root burial remains 0.12 m below the sampled ground. Taller emergents use the
larger source family; no tree is stretched independently by axis.

## Defect and polish checks

`scripts/control/check-distant-forest.mjs` checks the exported layout and its
actual Three.js assembly. It includes:

- Repeat generation and a local missing-terrain edit that must preserve all
  distant, unaffected trees exactly.
- Missing ground, beach and over-steep negative controls; invalid source bounds.
- Population counts on independent 112 m plots, adjacent/distant population
  differences, stand species fractions and canopy height percentiles.
- A controlled convex/concave terrain comparison at identical stand coordinates.
- The real production terrain and both source-family definitions, with every
  submitted root checked after its instance-matrix float32 conversion.
- Independent plane-height checks at known indexed triangle interiors.
- Recovery-layout instance and batch budgets, source geometry triangle count,
  uniform scale, finite culling bounds and submitted/report count agreement.

The checker does not create a graphics context or replace production shaders.
Its tiny in-memory atlas images only allow CPU material/assembly construction;
they do not provide visual evidence. Full-scene diagnosis belongs to the parent
render using the actual runtime assets.

The first candidate's direct CPU check passed on the production terrain. The retained
recovery placement algorithm is evaluated on that same terrain as its cost
control; its counts are not copied from an older render.

| Measurement | Recovery layout control | First candidate |
| --- | ---: | ---: |
| Distant source trees | 135,318 | 116,607 |
| Unique impostor triangles | 270,636 | 233,214 |
| Cell/family batches | 997 | 968 |

The first candidate contains 24,765 regeneration trees, 85,261 main-canopy trees and
6,581 emergents. Its two source families contain 72,084 and 44,523 instances.
The rendered instance-matrix roots differ from the actual surface by at most
0.248 mm after float32 conversion. An independent set of 457 triangle-interior
probes has maximum height error `1.14e-13 m`.

On uniformly suitable test ground, the 90th/10th percentile of 112 m plot counts
is 3.94. Mean adjacent-plot difference is 10.08 trees, versus 19.04 for plots
896 m apart. Stand species fractions span 0.431; tree height percentiles 10/95
are 11.62/27.96 m. These controlled-fixture measurements verify grouping and
height variation, not a visual quality score.

First-candidate real-ground layout SHA-256:
`23224073c42e3028a250e8765d1dd6a4d3b3f1402e227595d8282afbb4ec7200`.

## Matched native review and second candidate

The parent and leaf inspected the full 960×540 `mountain-wide` and `wet-sand`
images in `artifacts/phase2/landscape` against their preceding
`artifacts/continuation/after` views. These contain other simultaneous scene
changes; the canopy judgment is limited to the remote terrain, especially the
left/background hillside in mountain-wide and the distant headland in wet-sand.
The nearby forest and new cliff geometry are not evidence for this leaf.

**First candidate rejected:** large smooth gray-brown gaps break the old carpet
but read as missing forest. Short sparse regeneration amplifies those openings.
No obvious rectangular culling-cell seams or stepped canopy bands were found,
but the grouping benefit does not compensate for the lost crown cover. The
wet-sand headland also has excessive visible bare substrate below its skyline.

The second candidate raises the open-stand density floor from 0.19 to 0.34 while
keeping mature-stand maximum density unchanged. It reduces open-stand
regeneration probability, preserving more full-height crowns across young stand
edges. Coherent species tendency, maturity, topographic shelter, source heights,
grounding, spacing and geometry are unchanged. These are two focused layout
changes; no material correction hides the first candidate's failure.

The second candidate passes all unchanged CPU assertions on actual production
terrain: **126,030 trees, 252,060 unique impostor triangles and 969 batches**.
It retains 20,426 regeneration trees, 98,897 main-canopy trees and 6,707 emergents;
the two source-family counts are 77,483 and 48,547. Root and independent triangle
errors remain unchanged. This adds 9,423 instances over v1 while remaining 9,288
below the recovery control, with 28 fewer batches than that control.

The controlled flat-ground population ratio is now 2.56, with adjacent/separated
plot differences 8.70/15.53 trees, species fraction range 0.392 and height
percentiles 10/95 of 12.03/27.71 m. All existing grounding, determinism,
population-coherence and geometry-budget assertions remain intact.

Second-candidate real-ground layout SHA-256:
`e069790f018b18d38158cf9052d190afc89f7b91e6ae5233ed5244f1ff6addd6`.
Its layout module SHA-256 is
`ae6abc88edea3a8454ea6379d7d86ce9abc22c8d33d65cb8d85c4ce34c46be21`.
The parent and leaf then inspected both corresponding native v2 views from
`artifacts/phase2/landscape-v2`, checking the sidecar's exact layout-module hash.
**Second candidate rejected:** it reduces v1's extreme openings but the left
background hillside remains smoother and more sparsely wooded than the original
baseline. The wet-sand view is broadly neutral at this resolution. Statistical
grouping and recovery from a rejected candidate are insufficient evidence of
better forest art. No obvious culling-grid seams or stepped height bands were
found, but G2 remains unmet.

## Third candidate: restore continuous forest mass

The density floor increases again to 0.44 while mature-stand maximum remains
0.98. Short regeneration now occurs preferentially within densely occupied
stands. It no longer compounds low placement density with the shortest crowns
in the same patch. The species field remains coherent but its mean shifts back
toward the original wider-crown family. Original height formulas, sampled
exposure/maturity, ground placement, geometry and shading are preserved.

All existing assertions are unchanged, including population contrast/coherence,
local-edit determinism, real-ground/root checks, uniform scales and the original
cost control. The first v3 preflight failed the unchanged population-contrast
assertion: its flat-ground P90/P10 plot ratio was 2.065. The mature/open stand
transition was then tightened while preserving the 0.44 continuity floor, giving
stands clearer cores without lowering that floor or adding a hard boundary.

The corrected v3 passes the full unchanged check on actual terrain:
**129,969 trees, 259,938 unique impostor triangles and 969 batches**. This is
5,349 fewer trees and 28 fewer batches than the same-terrain recovery control.
The three layer counts are 25,318 regeneration, 97,964 canopy and 6,687 emergents;
source-family counts are 94,207 and 35,762. Grounding errors remain unchanged.
Flat-ground population contrast is 2.207, adjacent/separated plot differences
8.20/14.29 trees, species fraction range 0.319 and height percentiles 10/95
11.68/27.53 m. No assertions were edited or relaxed.

Corrected v3 layout SHA-256:
`91706bd830877dd92434147414a376668f2092c2f341986aaf4b2ef6ca9fe780`.
Its layout-module SHA-256 is
`9d55c0eaad0c244279fbfc947f1e427599d9bf7797fc7526160fc19db7eb5ac2`.
## Final v3 visual judgment: REJECT

The leaf independently inspected all five requested completed v3 frames in
`artifacts/phase2/landscape-v3`: headland, mountain-wide, wet-sand, flight-10 and
flight-20. Every sidecar records the corrected layout-module hash above, GL
error zero and no shader errors. These are native software diagnostic frames.

| View | Forest-only judgment |
| --- | --- |
| Mountain wide | Rejected against the original matched frame in `artifacts/continuation/after`. The left background around x=70–240, y=150–260 remains a conspicuously smooth gray-brown slope with scattered canopy points. V3 reduces v1/v2 gaps but the original image conveys the more continuous forest mass. |
| Wet sand | Broadly neutral against the original matched frame. The distant headland supplies no clear new canopy-depth advantage. |
| Headland | Mostly near vegetation and geology; it cannot establish an improvement in the distant layout. |
| Flight 10 | Remote slopes remain strongly speckled. No matching original frame is present in the specified baseline directories, so this is an additional inspection rather than a before/after claim. |
| Flight 20 | No decisive additional crown depth. The same lack of an exact original comparison applies. |

No obvious culling-cell grid seams or stepped canopy-height bands were found.
Those absence checks do not outweigh the remaining loss of forest continuity.
Lower submission counts, statistical grouping and improvement over previously
rejected versions do not establish a visual improvement over the original.
G2 remains explicitly rejected/unmet. There is no production-browser cycle,
reference-level forest acceptance or global completion claim.

## Withdrawal and exact production restoration

Before rollback, v3 source and checker were copied byte-for-byte into clearly
inactive text files under `docs/continuation/rejected`:

| Inactive archive | SHA-256 |
| --- | --- |
| `distant-forest-v3.ts.txt` | `2401cc54ec59e518c2fa823059ebdd9e417c1728f70c6c841ff7eec2664eb2ff` |
| `distant-forest-layout-v3.ts.txt` | `9d55c0eaad0c244279fbfc947f1e427599d9bf7797fc7526160fc19db7eb5ac2` |
| `check-distant-forest-v3.mjs.txt` | `fbf45f0935f499f4bc5bbfb1d8d922d8a5cf6eb2ac147cab660ead5231ce4688` |

The production `src/world/distant-forest.ts` now exactly equals the file from
commit `462588e855fc4773868321c73d1f703690344c5b`, verified by byte equality and
matching SHA-256:
`3209c7eb3183d8fd115a5d32f954aa7ef1876e94926a98e1a4256969dec08d70`.
The prototype-only `src/world/distant-forest-layout.ts` and
`scripts/control/check-distant-forest.mjs` have been removed. The parent owns the
corresponding package-script cleanup. Historical G1 evidence is retained as an
attempt record; it is not a live check or certification of the restored layout.
The baseline's unresolved distant-forest art limitations remain open.
The remaining visual risks are excessive opening, visible patch-scale grouping
and inherited pointillist silhouettes at low output resolution. Unchanged source
self-shadow still has no inter-tree occlusion, and two source families cannot
provide unlimited silhouette diversity.
