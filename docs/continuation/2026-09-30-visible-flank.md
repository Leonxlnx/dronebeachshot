# Isolated visible-flank structural trial

Status: CPU-checked candidate, **not integrated or visually accepted**. Production
`math.ts` and `terrain-fractures.ts` remain unchanged. The root must finish the
normal/density comparison before integrating this separate trial.

## Reason and bounded shape

The real 768 px frame `candidate-02-lighting/corrected-10_5.png` still shows a
broad, smooth beige face. Production camera rays located most of it at X122–230,
outside the retained eastern fracture at X252–400. Larger repeating material
normals cannot produce actual channel shadows or a broken silhouette.

`src/world/visible-flank-fractures.ts` removes material along one asymmetric
trunk and one tributary. The trunk follows the inspected downhill route from
(212,185) through (181,166), (166,155), (151,141) to (134,123). One unequal
tributary joins from (223,172). Interior control depths are 8–14 m; endpoint
depths taper to zero. Nominal half-widths are 8–15 m, multiplied by .78 and 1.12
on the two banks. Maximum rather than summed branch depth prevents a deep pit
at the junction. There are no added caps, walls, scans, periodic grooves or
terrain-noise changes.

Hard region: X122–230/Z116–205 with smooth 8 m boundary collars. The cut is
exactly zero at shoreline distance ≤45 m, terrain height ≤14 m or ≥220 m. Coast,
toe and shoulder transitions are 45–63 m, 14–32 m and 185–220 m respectively.
The existing eastern cut and summit are outside the region. The helper is pure,
has no terrain dependency, and allocates nothing per height query.

This is intentionally one limited network. Of six previously located face
probes, (154.76,151.25) loses 5.368 m while the other five remain unchanged.
It may be too small or partly obscured by forest in the real camera. That is a
render decision, not evidence to expand the region without review.

## Actual CPU results

`scripts/control/check-visible-flank-fractures.mjs` compares the preceding
production heights to the candidate on all 481,401 Float32 core vertices:

| Check | Result |
| --- | --- |
| Changed vertices | 624 (146 cut by at least 8 m) |
| Maximum actual grid cut | 13.571762 m |
| Actual change bounds | X130–224/Z118–190 |
| Closest changed grid vertex to shore | 51.647024 m |
| Exact protected beach vertices | 210,261 at distance ≤45 m |
| Exact interpolated beach samples | 22,725, including swash and the full 45 m strip |
| Existing eastern-region vertices unchanged | 7,575 |
| Summit | 425 m, unchanged |
| Route | 1,201 exact unchanged authoritative and triangle heights |
| Minimum route clearance | 5.113556 m, unchanged |
| Actual touched tile triangles | 40,000; finite attributes, positive area/upward orientation |

3,000 additional off-grid points checked bounds, determinism and protection;
explicit threshold and smooth boundary-collar probes also passed. The independent
surface check casts onto actual Float32 triangles rather than calling the
production interpolation helper. Full candidate grid SHA256:
`322c611a4f7908eaa4b7b1a8f1312bf4217d8a27f5fadfcc25e8f0bf542679bb`.

## Regenerated ecology and rock support

`scripts/control/visible-flank-candidate-loader.mjs` changes only the Node
diagnostic response for `math.ts`, adding the cut after the preceding eastern
cut. It verifies the exact replacement point. No source file or browser bundle
is modified. `check-visible-flank-support.mjs` runs both with and without it;
an independent query-qualified preceding math module supplies expected heights.

Both runs produce 14,000 deterministic trees. Every root has exactly zero error
against the independent Float32 triangle surface, including 24 candidate roots
inside the incision (29 before). The seeded placement routine retains 13,976 X/Z
positions, removes 24 and adds 24; 19 removed and all 24 added positions lie
outside the cut because the existing rejection sampler advances its random
sequence. Fifty-five shared trees change properties; the five outside the region
change only habitat exposure/moisture from the existing wider habitat queries.
Do not claim the forest layout outside the cut is untouched.

The 1,201-sample conservative tree envelope audit finds the same single existing
warning in both runs at t=2.483333 s, X−112.418421/Z300.684943. The complete tree
record is identical; only its array index moves 5288→5287. This is an envelope
warning, not a measured visible branch collision. No new warning appears.

All 521 actual rock instances (including 21 inland scans and 37 offshore rocks)
and 630,802 vertex support queries have identical baseline/candidate records,
zero terrain-query error and no unsupported rocks. No rock vertices intersect
the candidate cut, and no conservative rock/root box warnings occur around it.
Rock record SHA256 is identical in both runs:
`a81b4de86485ac0eda223a4547d15069fb8be04799c8888b4df4a366237007a7`.

Full ecology, canopy/shadow changes, true wood contact and scene acceptance are
still pending actual rendered inspection. Grounded roots alone do not prove
those properties.

## Reproduction and integration

Run from the repository root:

```sh
node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-visible-flank-fractures.mjs
node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-visible-flank-support.mjs
node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs --loader ./scripts/control/visible-flank-candidate-loader.mjs scripts/control/check-visible-flank-support.mjs --candidate
npx tsc --noEmit
git diff --check
```

These passed on 2026-10-01. Logs and the tree-comparison summary are under
`artifacts/refinement-2026-09-30/visible-flank-*`. The optional support argument
`--placements=<path>` saves the reproducible full tree records for comparison.

Preceding math SHA256:
`389cf335a0514b0d59088799498caca306714676ab5b3aec01d7cc8e8f25c7b2`.
Candidate helper SHA256:
`d3a8013c889bbee826daa8183e205f6a8c01b1e4fc86de76af8f11c5a5064f04`.

The root can integrate after its current material comparison by importing
`visibleFlankFractureCut`, computing the preceding authoritative height, then
subtracting the new helper with that height and existing shoreline distance.
The diagnostic loader demonstrates the exact expression. Adapt the focused
baseline checks deliberately when integration happens; they currently assert
that production imports remain unchanged. Regenerate every dependent terrain,
habitat, roots, rocks and coastal field together, then compare real frames at
the same settings, especially 6, 10.5 and 19.5 seconds. No build, browser,
commit or publication was performed by this worker.

## CPU shape review while the material comparison renders

Diagnostic plots are in
`artifacts/refinement-2026-09-30/visible-flank-plots/elevation-slope.png` and
`cross-sections.png`. Their data comes from production heights minus the isolated
helper, rounded to the real 2 m Float32 vertices. Cross-sections interpolate the
same triangle layout; slope maps show the steeper actual triangle in each cell.
`plot.py` and `data.json` in that directory reproduce the plots. These views omit
materials, tree occlusion, perspective and cast shadows and cannot accept the
actual 3D appearance.

The central junction reads as a broad, unequal trough with a short rounded
floor, rather than a razor slot. Its banks join the original grade over several
grid cells. The lower section merges into the prior toe without leaving an
added berm, and the downhill profile continues falling through both termini.
At the upper fork, the section crosses two unequal troughs separated by a
retained rib; it does not create the rejected additive pipes or caps.

The main artistic reservation is the smooth, spoon-like central depression.
It supplies one coherent drainage form, but does not yet establish angular
marble bedding or overhanging coastal joints. Most of the original broad face
also remains intact. The actual camera may hide the upper form behind crowns
or show only a shallow part of the bank. Keep this a bounded render trial before
expanding coverage or increasing depth; reject or reshape it if the actual view
reads as a rounded scoop rather than connected erosion.

The slope map supports the absence of new near-vertical knives: the maximum
affected-cell slope goes from 77.84° to 78.91°, with no newly >80° cells. The
median changes from 60.51° to 62.58°, so the candidate redistributes face planes
rather than making the entire cliff steeper. This is geometric evidence only.
