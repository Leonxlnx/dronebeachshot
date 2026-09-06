# Continued implementation and independent review — 2026-09-06

This extends the earlier continuation in [REVIEW.md](REVIEW.md). It is a real
implementation and diagnostic checkpoint, not the completed original 24-hour
contract. No browser cycle, final 4K gallery, final film or consumer-GPU result
is inferred from native images or passing CPU checks.

## Build and runtime corrections

Fresh deployment previously required a separate Python restoration step that
the normal build did not invoke. `predev`, `prebuild` and `preverify:build` now
invoke a dependency-free Node restorer. It checks the bundled archive parts,
joined archive and every unpacked asset against SHA-256 manifests before writing.
It preserves modified existing assets and rejects symlink destinations. Three
real-archive tests cover fresh recovery, idempotence, preservation and malformed
input. An isolated source folder initially containing only the public asset
manifest built successfully and produced all 38 exact assets in `dist`.
See [clean-build.json](../../artifacts/phase2/clean-build.json); dependencies were
reused from the locked installation, not downloaded again in that local check.

The new GitHub workflow independently installs dependencies and runs source,
25-test, asset, production-world, TypeScript, build, landscape and worker checks.
Its first actual run passed on candidate commit
`a07783849d17d289089682041dc89e3511f80b57`:
[GitHub run 34024903073](https://github.com/Leonxlnx/dronebeachshot/actions/runs/34024903073).
Vercel also reported successful automatic preview deployment for that commit.
Neither success establishes browser rendering or artistic acceptance.

Further runtime review fixed inherited-property names accepted as quality or
camera options, a coastal worker left running after a sibling resource failed,
background audio remaining active, and resize/quality events being overwritten
by asynchronous PNG capture restoration. Capture applies the latest deferred
viewport and quality after encoding; it restores logical size before DPR to
avoid temporarily enlarging a 4K canvas by the old pixel ratio. The independent
review exercised the actual capture closure with mocked renderer/encoder calls;
this is source-level evidence, not a browser interaction test. A final
[independent source review](runtime-phase2.md) found no additional concrete
regression in the retained fixes and records every reviewed file hash.

The worker checker also exposed a stale-build selection defect locally. Multiple
hashed worker files could exist in a preview output directory; selecting the
first filename compared an old worker with current geometry. The checker now
follows the actual HTML entry and its referenced worker. With both old and new
bundles present, it passes the exact 16,777,216-byte field comparison.

## Material and landscape work

New phase-2 PNGs/contact sheets are private review attachments. Their public
upload was blocked by automatic approval review pending explicit image-sharing
authorization. They are available in the private review bundle; paths below are
bundle paths, not links to files committed to this public repository. Technical
JSON/source records remain separate from image publication.

Water now retains the variance of filtered small-wave slopes as reflection
roughness. The existing two solar lobes broaden with matching energy scaling;
normal displacement, shore foam, refraction and colours are unchanged. The
64-component slope spectrum has variance approximately 0.0192. This is a limited
approximation, not a new complete ocean BRDF. References are in
[REFERENCES.md](../REFERENCES.md).

The isolated `water-before/wet-sand-mode-0-960.png`
and `water-after/wet-sand-mode-0-960.png` images have
identical cameras, sampling and non-overridden sources, with vegetation omitted
on both sides and recorded as such. The after view reduces hard metallic
reflection bands while retaining the shallow-water detail and sun reflection.
All shader/GL error counts are zero. To reproduce the old ocean, extract
`src/world/ocean.ts` from commit `462588e855fc4773868321c73d1f703690344c5b`
into a temporary adjacent source file and select its file URL through
`BAY_OCEAN_CANDIDATE`; the recorded original control used the same module with
absolute imports in an ignored scratch candidate directory.

The first connected-cliff and distant-forest candidates passed independent CPU
checks but failed image review. Cliff ribs looked like repeated pointed pipes
with triangular seams; distant forest exposed large smooth holes. Their actual
eight-view evidence is preserved in
the private `landscape/contact-sheet.jpg`.
The views include flight times 0, 5, 10, 15 and 20. All eight are distinct
960×540 native frames, with complete source hashes and zero shader/GL errors.
They are rejected candidate evidence, not final gallery selections.

All three additive cliff variants were rejected by parent and independent
image review. V1 made pointed pipes and triangular seams; v2 made a smooth bulb;
v3's shortened terminating joints and creased normals improved that bulb but
still looked like separate caps over the unchanged convex terrain. CPU topology,
all 14,000 tree-root raycasts and continuous-route checks passed. Those checks
establish technical properties and do not reverse the visual rejection.

All three distant-forest variants were also rejected against the original
matched views. V3 restored 129,969 trees and passed the unchanged population and
grounding thresholds, but left a conspicuous smooth grey-brown patch on the left
background. Production therefore restores the stronger original canopy from
`462588e855fc4773868321c73d1f703690344c5b`. Rejected source and checker text is
preserved under `rejected/`; it is not imported by the application or claimed as
a production integration check. See [forest-phase2.md](forest-phase2.md).

The fourth cliff attempt operates directly on the authoritative terrain height.
It removes at most 19.4811 m at 866 of 481,401 actual two-metre grid points, within
one eastern-headland fracture system. The beach band through 25 m inland, the
425 m crest and all terrain outside the fixed region are exactly equal to a
byte-identical frozen baseline fixture. The independent oracle tests the emitted
Float32 triangles, all 14,000 regenerated roots, 1,201 flight samples, evaluation
cameras and six damaged negative controls. Flight ground clearance remains
5.1136 m. No extra overlay or special root-exclusion rule remains active.

Parent re-verification passed. The current complete source/world/assets/25-test/
TypeScript/build run passed, as did offshore geometry and the actual compiled
worker's 16,777,216-byte field parity. See the text transcripts in
`artifacts/phase2/checks/` and [final-review.json](../../artifacts/phase2/final-review.json).
The first remote CI result above is historical; the PR reports the final head's
separate GitHub result after publication.

**V4 visual decision: accept the limited terrain improvement.** Parent and two
reviewers inspected all five native views. Headland gains a real branching
crease and clearer rock flanks without the earlier applied caps. Mountain-wide
retains a plausible connected mass and the restored distant canopy; wet-sand
shows no visible terrain/shore regression. Those three cameras have original
matched controls. Flight-10 and flight-20 provide supplementary inspection for
holes, detached masses and camera obstruction, with no original matching pair.
Individual tree/rock placements also change through regeneration; this is not a
pixel-identical change outside the carved region. All five frames have zero
shader/GL errors, are distinct, and match every current world/render/camera
source hash. Their private bundle directory is `landscape-v4/`.

This local acceptance does not establish the original reference quality. Large
pale smooth faces, grainy crowns, some straight cuts, sculpted cloud shapes and
water/surf patterns remain visible weaknesses. The source archives preserve the
rejected approaches so they are not mistaken for completed features on resume.

## Environment and original acceptance

The permitted Sites preview starts at `http://terminal.local:4173/`. A fresh
managed-browser check still reports `GL_VENDOR = Disabled`,
`GL_RENDERER = Disabled` and `BindToCurrentSequence failed`; both ordinary and
low-resource WebGL2 initialization fail before scene assets load. The preserved
Site project `appgprj_6a9b6e5ab4fc819189390e9ed1504847` still returns `NOT_FOUND`.
No replacement Site was created and no successful recovery is claimed.

The original completion checker and acceptance requirements remain intact.
Real browser/offline/mobile checks, reference-level art acceptance, eight
accepted browser refinement cycles, sixteen 4K stills, a validated 1200-frame
1440p60 film and 1080p60 copy, and 86,400 verified active seconds remain required.
Final main publication remains conditional on those actual results.
