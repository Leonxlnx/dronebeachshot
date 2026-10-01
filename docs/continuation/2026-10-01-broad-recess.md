# Reversible broad recess candidate

The rejected principal-face study produced a small hooked groove rather than
broad mass articulation. This separate study uses three planes forming one
open downslope recess, with a light inclined floor, broad western bank and
steeper eastern wall. It changes actual terrain height without extra slabs,
added meshes, repeated transverse steps or a global material grade.

The target is `max(F,E,W)`, where F=187+2.1(z−210), E=187+6(x+150), and
W=187−2(x+180)+3(z−210). Actual height is the preceding authoritative terrain
minus `max(0,H−target)` times the rectangular 10 m smoothstep collar.
The support is X[−235,−107], Z[145,290]. Shore distance ≤45 m is exact zero.
The 90 m removal budget is a measurement gate, not a clamp that would copy
the old curvature into the new planes.

The art proposal initially ended at Z295. Its first actual route-triangle
check failed: 18 samples at 2.05–2.333 s inherited lowering from vertices
X−118/−116,Z290–294; maximum surface change was 1.479533 m. The smaller
Z292 alternative still touched nine route samples. Z290 is the smallest
tested retreat preserving all route triangles, and only changes 32 fewer
vertices than the initial proposal. Planes and maximum depth are unchanged.
This was corrected before any browser trial rather than relaxing the gate.

The scoped audit checks 5,082 nearby 2 m vertices and 74,787 samples at 0.5 m.
It measures 1,838 changed vertices, 1,647 interior vertices reaching the
affine target, and an 86.544507 m maximum at (−160,224): H302.944507→216.4.
The dense maximum is 86.594638 m at (−160,224.5). Changed vertex bounds are
X[−230,−118], Z[146,288], at least 92.373 m shore distance.
All 1,201 route surface heights, all 16 evaluation-camera ground heights,
1,768 shore surface samples, the 425 m summit and existing eastern joint
support remain unchanged. Minimum route ground clearance remains 5.113556 m.

Run the pre-render audit with:

```
node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-broad-recess-planes.mjs
```

It writes `artifacts/refinement-2026-09-30/broad-recess/bounded-geometry.json`.
This is a bounded pre-render audit, not the full geometry/ecology gate.

Integration is deliberately minimal: `broad-recess-planes.ts` exports the
pure helper and `BROAD_RECESS_STUDY_ENABLED=false`; `math.ts` selects this
helper after its existing shared reference stage. The rejected principal
study remains false, and a module guard rejects enabling both together.
Root can toggle only the broad flag and rebuild for two controlled frames.
Worker and core geometry therefore select the same source without a mutable
runtime flag or worker message synchronization. Reference tree and rock
selection remains unchanged; current local Y/support and atlas R still use
actual selected geometry.

TypeScript and whitespace checks passed. Both flags remain false. No build
or browser was run by this worker. Enabled worker parity, basal tree support,
rock exposure and root clearance await actual image justification; the deep
cut may expose new local support defects despite stable reference cohorts.
Actual browser acceptance and the canyon/quarry appearance risk remain open.
