# Stable core tree and rock cohorts

Status: source correction for local terrain studies. It fixes measured remote
placement propagation; it does **not** accept the principal-face shape. Root and
art review rejected that shape after candidate06 images. The cut is reversible
and root will disable or replace it separately. This worker made no build,
browser, capture, distant-forest or vegetation-renderer changes.

## Cause and source contract

Live terrain rejection consumed different draws from procedural rock RNG 978.
Near scans then changed their 3D distance ranking and ordinal-selected source
variants. Inland exposure ranking and tree-root constraints caused another
remote cohort change. Even with reference rocks/heights, substituting the
uncontrolled current tree list replaced inland `fractured-bedrock-1:50` with
`fractured-bedrock-2:23` at X105.80/Z289.86. Freezing only rock randomness was
insufficient.

`math.ts` now exposes `terrainHeightBeforePrincipalFace` and its slope from one
shared stage of the existing live implementation. `terrainHeight` applies the
reversible local edit afterwards. Production does not import frozen fixtures or
duplicate the terrain algorithm. `terrain-surface.ts` uses one sampler algorithm
with independent lazy Float32 caches for these two height queries.

`habitat.ts` similarly runs one field algorithm with either query. Current GPU
habitat, material, shelter and wind data still use the current terrain. Only
cohort decisions use the lazy reference field. `ecology.ts` produces the exact
reviewed reference 14,000 core trees, then re-grounds their actual Y. X/Z, family,
variant, dimensions, angle, exposure/moisture attributes and order stay fixed.
No rejection, removal or refill is hidden in this mapping. This does not freeze
forest-floor, forest-structure or distant-vegetation generators.

`terrain.ts` constructs the reference procedural rock cohort and transforms.
`inland-outcrops.ts` invokes the existing near/inland selection and fitting
against reference terrain/roots, preserving the reviewed rank, source ordinal,
dimensions and excluded IDs. `photogrammetry-rocks.ts` and these stages carry
stable original IDs through instance compaction. `detailed-rocks.ts` then calls
`refitRockCohort` before adding independently generated offshore rocks.

The new `rock-local-refit.ts` tests all transformed source vertices, including
footprints crossing an edit whose centre lies outside. Existing inland scans
also check changed roots near their protected cylinders. Untouched transforms
stay bit-identical. Touched shapes preserve X/Z, scale and orientation; only Y
may decrease. Procedural rocks preserve original embed/exposure bounds; near
scans retain their 60% burial rule; inland scans retain 60% burial, 12 m exposure
and actual current root corridors. A supported fit that becomes fully buried is
reported/omitted locally without admitting a replacement elsewhere. Float32 Y
rounds toward the ground, preventing nearest rounding from breaking the embed
quantile by a few micrometres.

## Measured correction with the principal-face study active

- Original reference tree hash remains `927ddf7d749c7c3ec4673acebd280e97dd02c0664d26c02225deb8fff7fb64e6`.
- All 14,000 core tree identities/attributes/order match; 58 actual Y values change.
  Current full-tree hash correctly differs: `fa282bf1474526b02496568e73fad5c27ea47a64cdf23deaedd0b7aeb5668c07`.
- All 521 rock identities, source geometry, colors, batch order and non-Y matrix
  bits match the independently rebuilt frozen world. Ten footprints touch edited
  terrain; five Y transforms change; no omissions or new instances occur.
- All 21 inland scan transforms remain exact, retaining original cohort hash
  `d14b6e9c75b5981424f50aecb8b69bd71e7129d136a5cd9f64959bc56a124a2b`.
- The full support audit visits 630,802 source vertices, finds zero unsupported
  instances, and verifies exact current surface queries. The original single
  conservative tree-route envelope warning remains at index 5288 / t=2.483333 s.
- Actual source-worker transport equals main-thread atlas construction. Every
  one of 1,048,576 current R texels follows current terrain; 4,559 change versus
  the frozen reference. **G/B/A changed-texel counts are 0/0/0 globally.** Protected
  shore terrain is unchanged. No field channels are hardcoded or copied.
- Frozen reference RGBA hash is still
  `6fbe6e10c4769b2d2fd00c3a8219d2816194189327fc01394ee831cc1234de11`.
  Current RGBA correctly differs:
  `cb9ffcfba763c7d12ecd602486d27b13ddf3d17ab29de5b701568724a0eaf972`.
  Both worlds' packed G/B/A hash is
  `870b02822c58ff33974af39ec99450265fe9dd69849a6d073e79dda461360828`.

The source-worker checker permits a disabled terrain study: actual R and tree Y
must follow actual geometry, whether an edit is enabled or not. It never demands
old geometry solely to satisfy old hashes. The rejected shape's grid/shape audits
remain historical study evidence, not a condition for accepting this correction.

## Tests and remaining review

TypeScript, whitespace/source checks, the exact identity audit and 16 targeted
math, terrain-surface, cinematic and inland tests pass.

The existing inland tests now retain old tree/cohort hashes on reference data,
check current roots and actual scan support directly, and compare protected
coastal G/B/A while checking every current R texel. The old reference RGBA proof
remains an explicit assertion in `check-principal-face-worker.mjs`. New current
full-tree/field hashes are evidence, not replacement acceptance snapshots.

`check-stable-rock-cohort.mjs` independently rebuilds a frozen-world record set
through the diagnostic baseline loader, then compares stable source IDs, geometry
hashes, ordered batches, colors and exact Float32 matrix bits. It preserves signed
zero in those records rather than losing it through JSON number serialization.

Logs are under `artifacts/refinement-2026-09-30/principal-face/cohort-*`.
The separate basal-wood audit explicitly reconstructs the archived active study
after root disabled it. It decodes actual source GLB positions and node matrices,
uses production normalization, lean, scale and Float32 instance matrices, then
compares unique normalized basal vertices below0.3m against exact old/new terrain
triangles. The island fork-open field is identity below2m, so it does not alter
these basal source positions. This is a conservative source-vertex diagnostic,
not a complete continuous wood/soil intersection or ecological law.

It finds62 affected basal footprints:58 lowered roots and4 whose centres never
move. Using maximum gap>2m and at least25% of basal vertices>0.3m above ground,
the affected set goes from22 flagged roots to32. Twelve are newly flagged and
two old flags resolve. New IDs are870,2782,4412,6375,6892,7695,7866,8022,11100,
12651,12700,13740. Tree6892 demonstrates why a centre-only test is insufficient:
its centre stays exact while its basal footprint crosses the cut. Existing-bad
tree468 worsens from3.73m to8.35m maximum gap and actual triangle slope2.70→4.01.
Full before/after records and source hashes are in `cohort-basal-support.json`.

No affected tree was removed/refilled to hide these findings. They reinforce the
rejection of the old shape; they are not current scene defects introduced while
the study is disabled. Actual appearance and subsequent geometry candidates
remain root acceptance gates. Root-centre equality alone never accepts ecology.

Production files: math.ts, terrain-surface.ts, habitat.ts, ecology.ts, terrain.ts,
photogrammetry-rocks.ts, inland-outcrops.ts, detailed-rocks.ts, rock-local-refit.ts.
Focused verification changes: inland-outcrops.test.ts,
check-stable-rock-cohort.mjs, check-principal-face-worker.mjs and the diagnostic
principal-face-baseline-loader.mjs aliases for the byte-frozen old source.
The read-only historical basal audit is check-principal-face-basal-support.mjs.
