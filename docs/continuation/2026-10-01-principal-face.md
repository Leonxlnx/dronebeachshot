# Principal-face planar cut: integrated render trial

Status: root approved integration of this refit for an actual render trial,
**not visual acceptance**. `math.ts` now subtracts `principalFacePlaneCut` after
the unchanged eastern cut. The earlier visible-flank helper remains unreferenced.
This worker performed no build or browser capture; root owns those operations.

## Agreed construction and rejected first fit

The real mountain-wide image shows one broad pale principal face. Art review
located it by actual camera rays around X−210…−90/Z145…285. Root approved a
piecewise-affine subtractive target with an oblique reverse-facing lip, rather
than another smooth cavity. Art direction supplied seven perimeter anchors,
five initial interior controls and the constrained triangle topology.

The first target used joint depths 32/36/18 m. Full-grid measurement found a
56.372 m removal between nodes on the old convex upper face. That variant was
rejected for this trial. Its control data, grid/support results and plot data
are preserved under `artifacts/refinement-2026-09-30/principal-face/initial-*`.
No H−36 cap was used: that would restore the old curvature inside the panel.

Root instead approved one retained upper-shoulder control and a shallower lip.
Art agreed U0=(−164,234,H−16), with a six-triangle upper fan replacing the four
prior upper triangles. A 30/32/16 joint fit passed the 2 m grid but exceeded the
budget at half-metre samples (36.328 m), so the final fit uses **29/32/16 m**.
This change was explicitly reported to root and art review. The fixed depth
gate remains ≤36 m, without a clamp or hidden tolerance increase.

## Final authored controls

H is the preceding production terrain height; the source stores its full
precision value and the audit asserts it has not changed.

| Node | X | Z | Target |
| --- | ---: | ---: | --- |
| P0 | −196 | 169 | H |
| P1 | −126 | 148 | H |
| P2 | −106 | 194 | H |
| P3 | −110 | 276 | H |
| P4 | −164 | 284 | H |
| P5 | −202 | 238 | H |
| P6 | −207 | 200 | H |
| J0 | −177 | 219 | H−29 m |
| J1 | −149 | 207 | H−32 m |
| J2 | −123 | 203 | H−16 m |
| R0 | −181 | 210 | H |
| R1 | −153 | 198 | H |
| U0 | −164 | 234 | H−16 m |

The 17 macro triangles tessellate the polygon exactly. Three constrained bank
triangles connect the intact R0/R1 rim to J0/J1/J2, across a 9.8489 m horizontal
bank. Their final normal-dot-sun values are **−0.16916, −0.35294, −0.20944**.
All face away from the current direct sun. The root preferred this shallower
resolved bank to exceeding the depth budget; the audit explicitly verifies
reverse-facing normals and actual microtriangle coverage, not the original
stronger nominal normal values.

Let T be the affine target inside its triangle and d be distance to the outer
polygon. The result is `H − smoothstep(0,10,d) * max(0,H−T)`, with exact zero
removal outside the polygon and at shore distance ≤45 m. Only the outer 10 m
collar is smooth. There is no Gaussian cavity, raised mesh, interior smoothing,
uniform staircase or cap that follows H−36. The target/query helper allocates
nothing per height call and imports no terrain implementation.

## Geometry, camera and depth evidence

`check-principal-face-planes.mjs` checks all 481,401 actual Float32 core vertices,
target manifold edges/area, all authored controls, actual triangle surfaces,
and four touched production tile topologies:

| Check | Result |
| --- | --- |
| Changed grid vertices | 2,015 |
| Vertices exactly on interior affine target | 1,432 |
| Maximum grid removal | 35.089989 m at X−166/Z214 |
| Half-metre sweep | 55,419 samples; maximum 35.703098 m |
| Local 5 cm sweep near dense maximum | maximum 35.800389 m |
| Grid vertices above 36 m removal | 0 |
| Actual change bounds | X−206…−108/Z150…282 |
| Closest changed grid vertex to shore | 85.964799 m |
| Exact protected beach vertices | 210,261 at distance ≤45 m |
| Exact interpolated beach/swash samples | 22,725 |
| Summit crest | unchanged; highest summit remains 425 m |
| Existing eastern fracture | unchanged |
| Route/evaluation terrain | all 1,201 route samples and all evaluation-camera triangles unchanged |
| Minimum route terrain clearance | unchanged 5.113556 m |
| Actual tested microtriangles | 80,000, finite/upward/nondegenerate |
| New reverse-facing microtriangles | 205 (222 total in affected triangles) |

The dense probes are measured evidence, not an analytic all-real-coordinate
proof. The rendered mesh itself uses the fully audited 2 m grid. Region and
target coverage also pass 4,000 deterministic off-grid samples.

Candidate grid SHA256:
`7796f49b3daca9a41d08566dcddf6e02c09f7357ea9657b5f8ca71628887f91b`.
Candidate helper SHA256:
`75724702bd4d0c4026ac2395c24c80eb2f810ddcaf92b7aa28bc2f5c3d1cdf13`
(after an integration-status comment change; shape unchanged).
Integrated math SHA256:
`7bdb409f01ee251cc7339d93bd837fbb618bfeceafed58646ed5e7bc57c9de9b`.
Preceding math SHA256:
`389cf335a0514b0d59088799498caca306714676ab5b3aec01d7cc8e8f25c7b2`.

## Regenerated roots, rocks and remaining contact risk

The preceding math and its eastern-fracture dependency are now frozen byte-for-byte
under `scripts/control/fixtures/principal-face-baseline/`, with both source hashes
asserted by the grid audit. The support audit compares integrated production with
this independent reference plus the candidate definition. The explicit
`principal-face-baseline-loader.mjs` redirects Node resolution only when rebuilding
the preceding reference world. The former candidate-injection loader was removed
to prevent accidentally applying the incision twice.

The refit produces 14,000 deterministic trees with zero root-height error;
56 roots lie inside the cut. It shares 13,802 X/Z positions with the baseline,
including 13,715 completely identical trees; 198 positions are replaced and 87
shared trees change properties. Seeded rejection sampling changes some positions
outside the edited region. Do not claim the wider forest layout is untouched.
The single conservative tree-route envelope warning at t=2.483333 s remains the
identical tree; only its array index changes 5288→5281. There is no new warning.

All 521 regenerated rock instances are supported by the measured minimum-vertex criterion. The audit measures 641,519
actual rock vertices with zero terrain-query error, versus 630,802 before;
selection/scan variants change despite the equal instance count. Ten instances
have vertices over changed terrain. Affected procedural outcrops can expose up
to 19.8129 m, which needs real visual review. The 21 inland and 37 offshore scan
counts remain. Minimum flight rock-box clearance stays 27.364770 m; evaluation
camera rock-box clearance stays 10.606786 m, with no <5 m flight warning.

The three touched procedural instances are authored fractured-bedrock
`ConvexGeometry` outcrops in `terrain.ts`, not photogrammetry scans. Position Y
below is the instance origin, not the exposed top. Maximum exposure is measured
against the new terrain at actual vertices; it is not an increase relative to
an identical old instance.

| Instance | Origin X/Y/Z (m) | World Y bounds (m) | Maximum vertex above terrain |
| --- | --- | --- | ---: |
| fractured-bedrock-4:3 | −174.65 / 72.17 / 155.66 | 41.00…105.00 | 6.2508 m |
| fractured-bedrock-4:10 | −171.04 / 297.63 / 262.47 | 272.43…324.18 | 14.0646 m |
| fractured-bedrock-5:13 | −185.15 / 300.79 / 268.70 | 275.57…325.17 | 19.8129 m |

The last two lie on the upper-left collar/shoulder. They remain deeply embedded
at lower vertices but may reveal artificial slabs. Full X/Y/Z bounds, scale and
rotation are recorded in `integrated-support.log`; no rock placement was changed
to hide this risk before the actual scene trial.

Forty conservative rock/root bounding-box overlaps remain in this region,
versus 46 before. These are not exact wood/rock intersections, and changed
instance/placement identities prevent treating the lower count as proof of no
new contact problem. Full ecology, actual wood contact, apparent slab exposure,
canopy occlusion and regenerated coastal-field appearance are pending root
inspection. Grounded roots and supported rocks alone do not accept those gates.

## Shape review and integration limits

`principal-face/elevation-sun-review.png` compares old terrain, rejected first
fit and refit; `cross-sections.png` shows actual Float32 triangle sections.
The refit keeps the oblique reverse slope, joins a lower plane to an upper face,
and retains mass at the upper shoulder instead of cutting through the whole
convex boss. The sun-direction map shows resolved dark-facing bank cells.

The strongest art risk is the right exterior return in the transverse section:
it rises fairly sharply to meet the old terrain and could read as a quarry
edge. Several upper-fan directions may also become conspicuous. A bank facing
away from the sun may be hidden from a low seaward camera or obscured by crowns;
it may register as an occluding ledge rather than an exposed dark plane. These
CPU plots omit materials, vegetation, perspective and cast shadows, so they
cannot resolve those questions. Actual matched principal-face/wide/flight views
must decide whether this yields two or three readable masses or artificial
polygonal cutting.

Run the focused checks from the repository root:

```sh
node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-principal-face-planes.mjs
node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-principal-face-support.mjs
node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs --loader ./scripts/control/principal-face-baseline-loader.mjs scripts/control/check-principal-face-support.mjs --baseline
node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-principal-face-worker.mjs
node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-terrain-fractures.mjs
npx tsc --noEmit
git diff --check
```

All passed on 2026-10-01. Logs, tree comparison and diagnostic plot sources live
under `artifacts/refinement-2026-09-30/principal-face/`. Optional full tree arrays
are reproducible intermediates and need not be committed.

## Integrated-source verification

Integrated checks reproduce the isolated candidate's exact grid SHA and its tree
and rock hashes. Every core vertex is compared with the frozen preceding source
plus the one approved cut. The older eastern-fracture check was deliberately
adapted for the second disjoint region: its eastern 20 m bound remains unchanged,
while the principal-face region has a strict 36 m bound. It still verifies exact
protected areas, route, roots and six damaged-data negative controls. It finds
866 original eastern changed vertices and 2,015 principal-face changed vertices.

The actual `coastal-worker.ts` source entry runs inside a Node worker with only
browser transport and its exact geometry-asset fetch adapted. Its transferred
16,777,216-byte field equals main-thread `createDetailedRocks/createCoastalField`
byte for byte. Atlas SHA256:
`d927ac2a575141d681197ef004ae7cb4b3b471f5c7e869a731343ef317851e53`.
The test independently compares 8,277 face-region terrain texels against the
frozen baseline and cut, with 4,564 changed texels. It also compares the complete
frozen-world worker field to expose any seeded rock changes at the shore.
The complete reference-field comparison exposes a real downstream difference:
R/G/B/A changed-texel counts are **4,559 / 2,019 / 91 / 56,623**. Protected shore
terrain changes are exactly zero, but seeded rock rejection changes later coastal
rocks, their signed-distance mask and the lee-amplitude field. Maximum G delta
is 7.2565 m and maximum A delta is 0.92; maximum B delta 101.5539 m includes
appearance/disappearance relative to the −100 no-rock sentinel. The distinction
between 4,564 nonzero removals and 4,559 changed R texels is Float32 rounding.
This is an explicit shore appearance risk, not a passed shoreline visual gate.
Root was notified; this candidate does not alter rock streams to hide the issue.

This validates the actual source worker, not the subsequently bundled worker
or GPU consumption; those remain the root's next gates.

TypeScript and 14 targeted math, terrain-surface and cinematic tests pass.
No build or scene capture was performed by this worker. Rebuild all dependent
terrain, habitat, ecology, rocks and coastal data together, and leave actual
full-scene, shadow, contact and video acceptance open.
