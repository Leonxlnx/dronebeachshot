# Direct-main continuation — 2026-09-07

The user explicitly requested continued iteration directly on main, with no PRs.
Main was first fast-forwarded to the previously verified `8238db1`;
[its push workflow passed](https://github.com/Leonxlnx/dronebeachshot/actions/runs/34082806575).
This amendment supersedes the old publication prerequisite in RUNBOOK/PLAN.
It does not change the original art, browser, media or active-time requirements.

## Accepted changes

- **Cloud density:** the erosion remap now uses its actual threshold, regional
  cloud maturity varies the ceiling, and the existing Perlin/Worley octaves give
  smaller billows more weight. The same density still drives visible sky,
  reflection and shadows. No extra texture sample or march step is added.
  The first remap-only trial was insufficient; a second turbulence-warp trial
  was not retained. V3 visibly reduces the oversized smooth cloud masses.
- **Shoaling packets:** the established breaking-group envelope now also controls
  the shallow displaced crest. Active crests retain the 0.52 m maximum; quiet
  packets retain approximately 0.221 m. Runup, contact-film positioning, CPU
  wetness and spray phase are unchanged.
- **Stone normals:** tangent-space XY/Z slopes replace raw XY in stone projection.
  This preserves steep detail from the actual scan. A Z floor bounds rare lossy
  texture outliers. Existing strengths, source scale, albedo and roughness remain.
  Independent image review accepted a small close-detail improvement, not a fix
  for pale large-scale rock faces.
- **Swell filtering:** the seven displaced swells and three coastal harmonics now
  receive footprint filtering in their shading normals. Only the phase part of
  the existing 0.2 m central difference is corrected; amplitude, field and contact
  gradients remain. Removed phase variance joins the existing micro-wave variance.
  Fully resolved waves take an equivalent early return. This is an antialiasing
  correction, not a solution to every dark grazing reflection.
- **Distant-water seam:** an extra summit review exposed a dotted open-water line.
  The coarse far mesh previously interpolated moving interior vertices across the
  fine mesh boundary and discarded its opening per fragment. It is now a flat
  geometric ring with an actual opening. Its inner edge matches the fine ocean;
  waves have already reached zero 60 m before that edge. The line disappears in
  the matched summit image. The far mesh uses eight triangles instead of 12,800.

Root owns all implementation, renderer and publication work. Two delegates did
read-only source, numerical and image reviews. No rejected additive cliff or
far-canopy prototype was reintroduced.

## Verification

The local source/build suite passed all 27 tests and checked 38 vendored assets.
Two new tests exercise far-ocean winding, area and coverage. Nine additional
checks execute the production wave-filter helper and verify identity, retained
amplitude gradients and variance transfer. Matching rendered controls cover the
individual changes and the near/far seam. A full-world random seek returned an
identical image, and the final static ring was checked in three further views.
The compiled worker retains exact parity with the main-thread coastal field.

Full diagnostic records, images and the latest active-time ledger are retained
in the private review archive, rather than included in this public repository.
Automatic publication review blocked the raw records because they contain
internal environment information. Only source changes and this sanitized
summary are published here.

## Remaining acceptance

Browser compatibility and deployment cannot be completed in the available
environment. Large pale/smooth rock masses, canopy grain, some cloud-edge
banding and dark water reflection bands remain visible. The current checks do
not establish final temporal quality or consumer frame rates. Eight actual
browser refinement cycles, sixteen final 4K stills, the requested films, final
art acceptance and the active-work minimum remain unmet. Direct-main commits
are progress records, not completion claims.
