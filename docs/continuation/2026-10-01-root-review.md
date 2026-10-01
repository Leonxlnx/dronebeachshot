# Actual browser refinement checkpoint

This is ongoing work on the existing scene. It is not an 8/10 acceptance, the
eight-hour update, or the original final delivery. No scheduled task was created.
The user judged the preceding shot 2.5/10 and requests sustained improvement.

## Evidence and retained corrections

The production browser now runs WebGL2 in Chromium through ANGLE Vulkan
SwiftShader with four MSAA samples. The restored source began at
`b027d2abf86eaf4c1185f000c064ea9bea49d218`. Actual browser frames are rendered
offline after initial asset load, with source identity, pose, frame hashes and
errors recorded by `scripts/progress-capture.mjs`. Software render times are
not consumer GPU frame-rate measurements.

The first screenshot attempt failed while waiting for a stable canvas. Its
failure manifest remains in `baseline/`. Direct canvas export then produced
the four actual `baseline-direct/` frames at 0, 6, 10.5 and 19.5 seconds.

1. **Opaque output and sky.** The visible cloud shader stored transmittance in
   canvas alpha. PNG export unpremultiplied the already composited RGB and made
   the sky white. Visible sky now writes alpha one; the reflection cube still
   retains transmission. A final alpha-only canvas clear also preserves resolved
   fractional foliage coverage while making the completed image opaque. The
   isolated real WebGL check preserves all RGB bytes and GL state, including a
   four-sample foliage fixture; it rejects offscreen targets. All ten successful
   candidate-02 images have alpha 255 throughout.
2. **Water depth and light.** Removed duplicate bright green shallow scattering;
   the existing Beer–Lambert absorption now reveals the actual refracted bottom
   against a deeper blue-green water column. Terrain and tree shadows affect
   direct glint and foam. Solar overrides are shared by geometry, cloud light,
   reflection and water. Same-resolution 6, 10.5 and 19.5 second images show a
   clearer depth gradient without a new observed shoreline join defect. Isolated
   foam changes still need visual review.
3. **Exact geometry submission.** Noncasting ground cover uses conservative
   per-instance camera bounds. The original ocean grid is partitioned into exact
   tiles. All six culling on/off pairs at 0, 6, 7, 10.5, 11 and 19.5 seconds are
   identical in every RGBA byte. Four matching views are also identical to the
   preceding single-ocean-mesh frames. The entire 12-frame browser batch has no
   shader, page or asset errors. `culling-pixel-proof.json` records the comparison.

## Current visual judgment

The repaired output is more readable, but the scene still falls well below the
requested target. The root inspected the actual 768 × 432 frames, including
the opening ridge, low shoreline and final sunset. Major remaining defects:

- Canopies remain too porous, leaving a spotted, planted appearance instead of
  connected forest. A tiny real-renderer experiment proves correlated
  alpha-to-coverage masks prevent independent overlapping crowns from building
  expected coverage. It does not measure the full scene's contribution. A
  root-seeded alpha-hash candidate is being prepared, with source alpha retained.
- Exposed faces remain broad beige surfaces. Improved substrate blending alone
  does not supply fractures, silhouette detail or real channel shadows. A
  bounded source-normal layer is awaiting isolated comparison. A separate
  downhill terrain incision has passed CPU coast/route/root/rock checks and is
  deliberately not imported by production yet.
- Remote forest density is a separate candidate. It increases deterministic
  stems near the outer core while retaining spacing and an outward fade. Its
  full-scene comparison is pending, so tree counts are not quality evidence.
- Lighting studies are coherent controls, not accepted new defaults. The old
  default light balance remains. The gray/brown impression still needs judgment
  after canopy and exposed surface corrections, especially in the opening view.
- Motion, LOD transitions, continuous export and the final deliverable gates
  remain open. No new video is claimed at this checkpoint.

The first candidate-04 surfaces GPU run failed with duplicate `uDebug`. The new
ground declaration no longer matched the diagnostics declaration detector. The
land worker restored an explicit `uniform float uDebug;` and verified actual
composed shader declarations; browser retry is still required. The failed run
is retained and is not counted as visual evidence.

## Continuation

The candidate-04 retry subsequently completed all 12 frames with no browser,
shader or asset errors and opaque output throughout. The root retained the
remote density change and the foam-energy/depth gate as modest static visual
improvements. The additional .12 mineral-normal layer was rejected as a default:
10.5-second, headland and mountain-wide pairs showed negligible gains in plane
readability. Its default is now zero. `surface-review-proof.json` records this.

Candidate-05 is now rendering isolated crown coverage, 2048/4096 shadow maps,
clearer air/light balance and stone projection orientation. Crown coverage and
stone orientation are default-off experiments. Tiny actual-source atlas tests
show more accurate overlapping crown coverage with seeded hashing, but stronger
stipple under camera movement; whole-scene motion remains essential. Default
light values are unchanged. Cloud aerial extinction and water extinction now
follow the inspection settings coherently, including reflected sky refresh.
The new empty-foam fast path and shared default haze were checked against the
preceding 6 and 10.5 second foam-on images: every RGBA byte is identical in both
actual browser pairs (`foam-fast-path-pixel-proof.json`). Candidate-05's full
art-study batch is still running; that distinction is recorded in the proof.

The mountain-wide view confirms that the dominant main cliff needs larger
organized structural breaks. A read-only art review locates its main exposed
face at approximately X−210 to−90, Z145–285, below the protected summit. A new
isolated planar-cut study is being designed; the earlier small positive-X
incision has not been integrated or accepted.

Finish the crown, shadow, air and bedding comparisons, then evaluate actual
motion and the principal-face structural trial. Review actual frames and short motion before
accepting each. Preserve meaningful work prospectively in `RUN_STATE.json`; do
not credit idle time or claim the user's approximate eight-hour point early.
The original 24-hour and final media gates remain unchanged.


## Completed crown, light and surface study

Candidate-05 completed all28 real768×432 frames with opaque alpha and no page,
shader or asset errors. `crown-light-review-proof.json` records that completed
batch and paired pixel differences. Pixel differences are not quality scores.
The seeded crown hash remains default OFF: opening woodland becomes denser but
also visibly stippled and flatter. The 4096 shadow comparison produces finer
small shadows without a decisive broad improvement, so2048 remains the default.
Air-balanced is the next study base: water is richer blue, exposed rock reads
more neutrally and the haze veiling the landscape is reduced. The woodland is
still brown/flat; clarity also slightly reduces atmospheric separation at19.5s.
No new light default or8/10 acceptance has been declared. Bedding has actual
GPU-compiled headland and mountain-wide pairs, pending its narrow final review.

The principal-face refit is now integrated for an actual render trial. Only
this chosen helper is imported; the smaller visible-flank incision remains
unused. Core/worker terrain data agree, but the initial regeneration propagated
random selection into distant trees and shoreline rocks. This is a real scoped
regression to correct by stable source-cohort selection and local refitting,
not by preserving stale geometry or changing expected hashes without review.

A fixed remote-shadow inspection helper selects83 original distant batches
(29,109 trees), preserves their atlas/depth materials, and fits the existing sun
camera around the opening hill. Conservative caster bounds have max absolute
NDC0.939619 within the selected fit; disabling restores original fit/caster
flags. The paired test changes only remote casting within the same fit. This
is a local mutual-shadow diagnostic, not a complete terrain-horizon solution.

The first candidate-06 process disappeared after scene readiness with zero
committed images. Its failed manifest is retained; the cause was not established,
and the cgroup showed no OOM kill. A separate retry is running against the same
built bundle. This is not counted as completed visual evidence.

Intermediate video capture now pins the build and settings, commits every PNG
before encoding, and strictly validates the existing prefix on resume. Focused
real-encoder tests cover replay, failure and timeout. No new scene video has yet
completed; actual moving-scene verification is still required.

The local checkpoint commit3b2d3cc is not remotely published. Automatic review
rejected both main-branch push attempts, including the retry after recovering
the earlier user instruction for this exact repository. No alternate transport,
refspec or other workaround was attempted; continuing work is local.
