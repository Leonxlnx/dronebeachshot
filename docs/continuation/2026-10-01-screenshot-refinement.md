# Screenshot refinement checkpoint

The user's latest instruction cancels cloud video work: continue improving the
environment, send screenshots, push the completed changes to main, and provide
a prompt for their local laptop agent to render. This is fresh direct publishing
authorization; the earlier rejected use of retrieved publishing permission is
not being reused. No scheduled task was created.

The owned video session was stopped through SIGINT at 08:23 UTC. Its 296 committed
frames through 12.29166667s remain intact. Do not resume or export that film merely
to satisfy the superseded eight-hour video request.

## Actual current-source comparisons

`post-film-review-01` is a 47-frame software/WebGL2 still batch at 640×360, using
source `5b3479529a796233889fd2de92d044f0aba207d73933c932ccb34c85b495e248`.
The name is historical; the work is now environment still review. It completed all 47 frames without browser/load errors in one
owned browser, with working-memory start 6144 / stop 7424 MiB and 384 MiB V8 old-space.
The complete profile and materialized frame states are recorded alongside the
plan. The browser closed successfully before the separate spur comparison started.

Decisions from the completed series and subsequent bounded comparisons:

- Grass palette 1: accepted at 12s. Removes the chalky pale fringe without losing
  readable blades. OFF restoration is exactly equal in decoded RGBA.
- Linear output with 2× internal samples: accepted at 4.083333s for finer crown
  coverage and clearer foam detail. Linear 1× alone has no decisive artistic
  gain. Native restoration is exact. Static stills do not prove shimmer removal.
- Island source direct response: accepted at 0s/5s as a modest crown-lighting
  improvement. It does not solve uniformly brown canopy color.
- Far-crown blending: rejected. It turns the distant headland into a soft
  continuous mound; the combined response/blend preset retains that weakness.
- Sand chroma 1: accepted at 10.5s/19.5s as a restrained warmer substrate. It does
  not fix the glossy road-like wet strip.

- Clouds: morphology ON at coverage .4 accepted across opening, shore and sunset;
  .65 ON is a denser fallback. OFF low coverage preserves busy repeated lobes.
- Coastal reflection: the first flat/wave variants were rejected for hard bright
  slits. The corrected footprint was then tested in six actual frames at 10.5 and
  10.75s: wave distortion 1 is accepted at both poses. OFF restoration and both
  prior controls match exactly in decoded RGBA. It also remains coherent without
  those slits in the later 1280×720 combined young-woodland views. This does not
  remove the separate broad wet-sand ribbon limitation.
- Short sand-film drying: visually unclear; remains OFF.
- Terrain shadow chunks: all four actual images match exactly. The small timing
  sample gives no decisive speed improvement; remains OFF.

These are bounded study decisions, not an 8/10 or complete-flight acceptance.
The canonical render profile is now `profiles/last-light-bay.json`; it selects
the accepted color, cloud and corrected reflection settings. Ordinary app
startup uses the same artistic settings, with native 1× output and quality-tier
policies documented in `docs/canonical-look.md`. The explicit capture profile
uses linear output at sample scale 1. It is present in the repository, not an
unselected placeholder.

## Young woodland and the final candidate

The 16-tree young woodland addition is narrowly accepted and its source flag is
now ON. The original 14,000-tree cohort remains unchanged. Actual 1280×720
software WebGL2 frames at 9, 10.5 and 12 seconds use the complete canonical
profile and linear sample scale 1. The lower trees retain open intervals below
the mature crowns; the reviewed images show no obvious oversized or floating
stems at this scale. There is no matching combined-profile OFF image, so the
result establishes a modest viable addition, not a strong isolated improvement
or a replacement for the source basal-support checks. See
`artifacts/refinement-2026-09-30/coastal-young-woodland/trial02-art-review.md`.

Those combined views still expose repeated contours across bright clouds, the
smooth brown wet-sand strip, and the broad pale cliff. Two further narrow source
corrections are implemented:

- Primary cloud integration now uses stable cells with a clipped final cell,
  avoiding the sample-grid redistribution caused by `ceil(span/30)`. The
  directional cloud-shadow integrator is unchanged.
- Sand albedo retains its existing mip-filtered source luminance ratio instead
  of applying a second footprint fade toward a constant. The ratio clamp and
  normal-grain filtering remain; palette, roughness and literal wet-band width
  are unchanged.

The final candidate's TypeScript/Vite production build passed, with source
identity `301d9c4541e7b48f82d7166345cd39f3ebc7b3fba4140549f0ab3d997a6b095f`
and entry `index-D4RZMWwx.js`. The build record and explicit 10.5/19.5-second plan
are in `artifacts/refinement-2026-09-30/final-environment-review/`. Both actual 1280×720 captures completed without browser/load errors. Root and
independent review accept the retained sand detail, with no conspicuous new
tile seam. The cloud contours are still visible; their removal is not accepted.
A small sky-only diagnosis is in progress. Source checking passed 101 files,
all 143 automated tests passed, and all 43 asset checksum checks passed.
`final-environment-review/source-checks.json` and `art-review.json` record the
exact source and decisions.

The ordinary-app check used this same normal build. Actual startup defaults,
public setter access protection and low/high quality switches passed, with zero
new resource requests during the switch. Its final native-canvas PNG readback
timed out after 180 seconds while the software renderer drained queued warmup
work. The manifest has no browser/load errors, but the harness reports
`verified:false`; this is not a completed image smoke or performance pass.
See `ordinary-app-01/ordinary-app-verification.json`.

The targeted sky review must establish the remaining cloud-contour cause.
The still comparison does not establish temporal shimmer behavior. These
changes cannot themselves resolve the cliff's large smooth shape or the width
of the wet ribbon. Overall 8/10 and complete-flight acceptance remain open.

In the 47-frame series, the grass-palette OFF PNG at 12s is also byte-identical
to the old film's frame 288. Its statistics record 18 closed orphan
ImageBitmaps, preserving all visible pixels at this pose. This is not a measured
whole-process memory-saving figure or an OFF control for the later woodland
addition.

## Structural and local-render work

`dist-east-spur-study-trial03` differs only in the enabled rounded east spur.
Its source is `5d7e83d11a91386a54d43155cde9852c5f97a37fb6779554930f2f9c8b7798f7`.
The normal source and bundle were restored/preserved exactly. Its 9s/12s ON
comparisons may reuse the matching normal-batch OFF images after checking their
recorded identities and complete settings. The actual full-scene trial was
rejected: a smooth pale bulge with exposed ground weakened the bank. The spur
remains OFF. See `east-wall-structure/trial03-art-review.md`.

Local hardware capture now has an explicit backend selector, pre-scene and
actual-scene GPU checks, and hardware-identity checks on resume. The software
default remains unchanged. Conservative macOS/Windows locks permit exclusive
capture without Linux procfs and never automatically reclaim an existing lock.
Focused tests pass; actual laptop GPU and OS execution is still unverified.

The German local handoff targets hardware stills first, then a 20s 1440p60 master
and 1080p60 copy. Its profile path is `profiles/last-light-bay.json`, with linear output and
1× internal samples at master resolution. The selected profile includes corrected wave reflection and all accepted
color/cloud settings. The new focused tests are registered in the package test command.

Review the final candidate screenshots and ordinary-app smoke result, record
the completed test outcome, then package the reviewed checkpoint for the
already-authorized main push. No fresh remote-head verification or completed
push is asserted by this document.
