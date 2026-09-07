# Capture integrity and low-water reflection continuation

This is a tested continuation checkpoint, not final project acceptance. The original browser, art, gallery, film, refinement-cycle and active-work requirements remain in force. Progress is saved directly on main as requested.

## Changes retained

- Graphics readiness is terminal after scene/context failure. Capture entry points check health before and after rendering/PNG encoding, and expose the production build identity. Capture mode always uses high quality. Save-frame controls prevent concurrent exports and handle ordinary PNG failure locally.
- The capture runner stages each attempt separately, preserves the prior completed bundle on failure, checks late network/HTTP/console events, and rejects a page whose actual production identity differs from the local source. The identity includes Vite configuration. PNG dimensions, decoded scanlines and checksums are measured from real bytes.
- Video encoding has bounded writes and completion, process termination/reaping, bounded external encode/probe/decode operations, and per-frame timeline identities. Final checks validate actual images and both H.264 video streams/decodes, exact media checksums and their associated analysis/reviews. Missing or empty media cannot satisfy the former existence-only checks.
- Rock spray scales with drawing-buffer height and camera projection, keeping world-space droplet size consistent in exports.
- Downward water reflection directions now receive an explicitly approximate second bounce from horizontal neighbouring water. The lower cubemap hemisphere is unchanged. This removes the near-black ribbons in the reviewed low-water views without brightening land lighting. It does not implement first-facet masking or trace an actual secondary hit.
- Native diagnostic repeat captures preserve separate files and raw pixel hashes. Custom review cameras may specify their actual field of view. These diagnostics do not establish browser acceptance.

## Verification and limits

The retained checkpoint passes 43 tests, source validation, all 38 asset checksum checks, the full CPU world verification, TypeScript and the production Vite build.

The capture failure review used actual helpers with page doubles and isolated fake encoders. Healthy 1200-input-frame orchestration, stalled writes, stalled exits, SIGTERM resistance, missing executable and EPIPE were checked. Failures preserved previous output, recorded failed status and reaped children. These are failure-path tests, not actual browser or film evidence.

Native visual review confirmed the improvement at wet sand and final flight. Mountain-wide and headland were pixel-identical to their controls. The 19.95→20→19.95 sequence returned pixel-identical repeated frames. Sparse adjacent stills do not establish motion quality. The second-bounce model still assumes water at the secondary hit, uses a local water-color fallback, and retains the underlying analytic-normal visibility limitation.

A local tree-root support experiment and two bounded planar headland cuts were rejected after direct image review: they exposed broad smooth rock faces without sufficiently improving their shape. Both were removed from production; their private diagnostic evidence remains available.

The final camera phase still requires correction: the checkpoint route ends at approximately 67 m/s despite the requested slowing shoreline glide. A separate candidate is under numerical and visual review.

No new final gallery, accepted film, genuine browser cycle or completed art acceptance is asserted. Final checking must continue to report incomplete until the original evidence exists.
