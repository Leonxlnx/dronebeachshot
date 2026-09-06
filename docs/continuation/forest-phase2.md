# Distant canopy — phase 2 candidate

This pass addresses the homogeneous remote canopy in the existing full-scene
diagnostic views. It does not accept the complete forest, any production-browser
cycle, performance target or final image. Parent review of matched native views
is pending.

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
- Species tendency varies over coherent stands, with a higher probability of
  the smaller source form in open regeneration patches. Both source families
  remain present across the landscape.
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

The direct CPU check passes on the current production terrain. The retained
recovery placement algorithm is evaluated on that same terrain as its cost
control; its counts are not copied from an older render.

| Measurement | Recovery layout control | Candidate |
| --- | ---: | ---: |
| Distant source trees | 135,318 | 116,607 |
| Unique impostor triangles | 270,636 | 233,214 |
| Cell/family batches | 997 | 968 |

The candidate contains 24,765 regeneration trees, 85,261 main-canopy trees and
6,581 emergents. Its two source families contain 72,084 and 44,523 instances.
The rendered instance-matrix roots differ from the actual surface by at most
0.248 mm after float32 conversion. An independent set of 457 triangle-interior
probes has maximum height error `1.14e-13 m`.

On uniformly suitable test ground, the 90th/10th percentile of 112 m plot counts
is 3.94. Mean adjacent-plot difference is 10.08 trees, versus 19.04 for plots
896 m apart. Stand species fractions span 0.431; tree height percentiles 10/95
are 11.62/27.96 m. These controlled-fixture measurements verify grouping and
height variation, not a visual quality score.

Real-ground layout SHA-256:
`23224073c42e3028a250e8765d1dd6a4d3b3f1402e227595d8282afbb4ec7200`.
Matched-view review remains pending. The main remaining visual risks are
excessive opening of cover, visible grouping at the
new patch scale, abrupt height cohorts and the inherited pointillist silhouettes
at low output resolution. Unchanged source self-shadow still has no inter-tree
occlusion, and two source families cannot provide unlimited silhouette diversity.
