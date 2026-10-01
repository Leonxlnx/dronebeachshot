# Rounded east spur: isolated proof and default-off full-scene candidate

Status: **rejected in the actual full-scene trial03 at 9 and 12 seconds; keep OFF**. The smooth pale bulge and exposed ground weakened the coast. See `trial03-art-review.md` for the current decision. The isolated results below are historical diagnostic evidence, not acceptance.

## Why this target

The real 9/10.5-second view sees the eastern coastal-rise envelope around X 120–300/Z 100–160. Its smooth shore-distance rise multiplies the connected ridge; adding small fracture normals or three tiny source scans did not change its broad pale bank form. The preceding subtractive planar spur discriminator exposed a conspicuous triangular excavation/collar and was rejected before GPU. The exact small three-scan group was also rejected from actual neutral/PBR crops: isolated mossy strip, or almost invisible under shared bedrock.

The rounded candidate adds one thick connected asymmetric spur, keeping all baseline small-scale relief. Its west-facing flank is broad enough to face the camera while receiving less sun. It adds no mesh slab, plane floor, trench, repeated rib or new noise field. Maximum authored addition is 32 m; changed 2 m grid vertices number 1,160, within X 154–256/Z 100–172. The +15 m contour has a median 46 m cross-wall width. Analytical coast distance≤45 m, all 1,201 route ground samples and the summit remain exact.

## Actual isolated images

Eight actual 256×256 WebGL frames compare neutral/PBR and OFF/ON at 9 and 10.5 seconds. They retain the actual camera/FOV/bank through `Camera.setViewOffset` from 512×288:

-9 s crop: X 368/Y 0/W 144/H 144.
-10.5 s crop: X 280/Y 0/W 144/H 144.

The output enlarges that crop by 1.778×. It contains two existing 2 m terrain tiles and shared lighting/ground material; no forest, wood, ocean, outside-tile shadows or full cloud system. Candidate habitat RGB was recomputed from candidate terrain. The actual source photographs supply the same PBR maps; no invented color grade was applied. All 8 captures completed without shader/page/request errors. Peak monitored memory 6.557 GiB; browser closed.

Root and independent art review agree the convex body/dim flank is a meaningful local gain over the rejected excavations. It remains a smooth rib; the broad pale wall is still present. The lower taper could read as an artificial dark stripe and canopy may hide the useful return. Do not enlarge or repeat it before full-scene review.

## Local ecology adaptation

The original ordered 14,000-tree reference remains authoritative for all selection/RNG decisions. Only after selection does the study omit 46 explicitly source-audited original trees and refit 20 remaining affected rootYs to the actual Float 32 triangle terrain. No refill occurs. Attributes and order of every retained tree remain original; outside trees remain exact.

The exclusion policy is actual triangle slope>3.4, or maximum source basal gap>.75 m with at least 25% of basal points>.3 m above terrain. The audit uses raw GLB positions, original node transforms, production normalization, wind lean/yaw/scale, and Float 32 instance transforms. It measures 66 touched source footprints and retains 20, with maximum retained gap.747123895 m. This is bounded static support evidence, not continuous wood/soil contact or an assertion that old bad roots are clean. The older loose 2 m rule would have left 25 unacceptable cases before correction.

Forest-floor roots/litter/seedlings keep their original shared RNG stream, original reference tree indices and original selection caps. Local omissions happen only after all original selection draws are consumed. Root tubes belonging to omitted tree 2114 are removed as a complete four-branch set. Whole touched tubes are re-grounded and their lower ring gaps checked; completely untouched primitives stay byte-exact. Litter keeps its original yaw/scale/color with current Y/normal. Seedlings retain angle/scale and receive current Y. Original physical slope eligibility is rechecked only locally.

| Cohort | Original selected | Emitted ON | Local retained | Outside bytes exact |
|---|---:|---:|---:|---:|
| Root tubes |600|596|12|584|
| Litter |3695|3690|15|3675|
| Seedlings |889|887|5|882|
| Standard shrubs/snags |267/24|267/24|0|all|
| Optional coastal shrubs/snags |420/24|419/24|4 shrubs|all other instances|

The optional coastal sampler is still default OFF. Of its five conservatively touched source footprints, one newly steep shrub is omitted. The other four retain embedded basal source rings; none receives a new random replacement.

Rock constraints now identify reference trees by unique original X/Z, with explicit errors on missing or duplicate identity. This fixes the old packed-index assumption after tree omissions. A complete current rock assembly audit finds all 521 procedural/scan/offshore instances exactly unchanged in source geometry, transform and color; all 484 local-refit candidates are untouched. Current terrain heights remain authoritative; the old full coastalRGBA hash is not asserted for the new terrain. Full atlas/GPU validation remains pending.

## Remaining composition risk

A deliberately approximate family crown-midpoint/terrain-ray check finds 11 removed local crowns in-frustum and terrain-ray-clear at 9 s,12 at 10.5 s, and 10 at 12 s. None of the affected crown midpoints is in-frustum at 6 or 7.5 s. This does not account for canopy/rock occlusion or exact crown silhouettes, but the ecological cost is visibly relevant: full-scene review must assess whether the new mass is worth opening those local gaps.

## Verification and reproduction

- `cohort-integration-check.json`: complete OFF geometry/matrix/color equality to pre-edit snapshot; original selection counts and ON outside identity/order proof.
- `integrated-core-support.json`: fresh actual emitted GLB basal check.
- `dependent-support-check.json`: actual emitted floor geometry support and bounded projection diagnostic.
- `integrated-shape-check.json`: exact match to the visually tested helper, shore/route/summit checks and 3,036 worker/main height/surface samples. This is not a full coastal atlas worker build.
- `rocks-integration-{off,on}.log`: all source rock instances exact; zero refits.
- `scripts/control/east-spur-study-loader.mjs`: Node-only flag override for CPU checks; source stays false.

After the renderer/bake owner releases a build window, root can run:

```sh
node scripts/control/build-east-spur-study.mjs --out-dir=dist-east-spur-study-trial03
```

The wrapper requires a fresh output name, copies source to a retained temporary stage, changes only the copied flag, builds normal Vite output in the separate directory and records its truthful staged source identity. Working source/flag hashes are verified unchanged; the ordinary `dist/` and pinned film are not touched. It was subsequently executed in the root-authorized build window as trial02 after the diagnostics fix. `trial02-build-verification.json` proves only the staged flag differs, the ordinary baseline remains intact, and all response assets copied exactly. Trial01 is stale. Full-scene WebGL validation remains pending.

Reject the candidate if the full scene turns the flank into a stripe, loses the useful side behind crowns, exposes implausible local plants, or costs more composition than it adds. Revert simply by keeping the production flag false; default-OFF output geometry has been proved exact.

The two-view full-scene comparison is saved in `fullscene-spur-plan.json`, with a byte-identical copy of the root source-response profile in `fullscene-spur-profile.json`. Use 640×360 at 9 and 10.5 seconds, response/blend OFF, sandChroma 0, SSAA 1×, terrain shadow chunks OFF. The baseline matrix lacks a 9-second OFF frame, so root must capture that matching view.
