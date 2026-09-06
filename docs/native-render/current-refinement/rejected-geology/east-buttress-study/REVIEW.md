# Rejected: local east-headland heightfield buttress

This bounded candidate creates a continuous tall face attached to the actual terrain, without a pasted wall, boulders or exposed mesh perimeter. It does improve the amount of exposed steep relief. **The shape remains artificial: a broad smooth curtain and a sinuous dark toe line. Do not integrate it as finished geology.**

## What changed

`buttress-height.ts` dependency-injects the original height and shore-distance functions. A compact, deterministic bay-facing coordinate compression samples existing relief farther inland to build an upper shoulder, and slightly toward the coast to lower the toe. An eight-metre transition connects the two. A manually authored irregular front path breaks the plan outline. There is no additional mesh, new source asset or flat plateau. The unchanged terrain material follows the new geometric normals.

This geometry reuses the existing heightfield's relief pattern. That proves useful for attachment, but the narrow compressed band still reads as an authored retaining face. It lacks separate large rock ribs, changes in face angle and natural breaks in the silhouette. The old base terrain's texture repetition is also visible in both controls; no albedo or lighting change was used to disguise it.

## Actual comparison

| View | Before | Candidate |
|---|---|---|
| Context | `buttress-context-before.png` | `buttress-context-candidate.png` |
| Detail | `buttress-detail-before.png` | `buttress-detail-candidate.png` |

Both variants use the current snapshotted production ground material, original texture bytes, same camera, time 14 sun, atmosphere and renderer. Only terrain heights and their computed geometric normals change. Each is a 520 by 520 m terrain crop on the real two-metre Float32 grid.

Trees, grass, scanned rocks, ocean and distant terrain are omitted. These are actual native ANGLE/Mesa llvmpipe renders, not browser screenshots or full-scene quality/performance proof. Four frames completed with exit 0, GL errors 0 and shader errors 0. Peak RSS was 1,097.184 MB.

## Geometry and route audit

| Measure | Result |
|---|---:|
| Audited core vertices | 601 by 801, two-metre spacing |
| Changed vertices | 8,687 |
| Incident changed triangles | 17,784 |
| Maximum rise / cut | +42.000008 / -16.000008 m (Float32 rounding) |
| Changed vertex X bounds | 210 to 456 m |
| Changed vertex Z bounds | -96 to 182 m |
| Changed vertex Y bounds | 7.578073 to 181.704788 m |
| Full affected triangle X bounds | 208 to 458 m |
| Full affected triangle Z bounds | -98 to 184 m |
| Full affected triangle Y bounds | 6.197073 to 182.173477 m |
| Nearest changed vertex shore distance | 39.597905 m inland |
| Nearest affected triangle vertex shore distance | 37.982325 m inland |
| Summit before and after | (-124, 425, 350) m |
| Current route samples | 1,201 |
| Maximum terrain change beneath sampled route | 0 m |
| Minimum sampled terrain clearance | 5.113556 m |
| Nearest changed vertex to sampled route in XZ | 125.576596 m |
| Surface area steeper than 65 degrees, before | 12,526.942 m² |
| Surface area steeper than 65 degrees, candidate | 21,293.272 m² |

The height function returns the original height exactly through shore distance 25 m, outside its compact support and in a 30 m core-boundary collar. Actual changed mesh triangles are farther than 37.98 m inland. No swash/seabed geometry changes. The 425 m summit was checked across the complete actual core grid and is unchanged. Route clearance uses the same indexed-triangle interpolation as the rendered terrain.

`changed-grid.json` lists every changed Float32 vertex with original and candidate height. `audit.json` includes exact unrounded bounds. `source-manifest.json` records SHA-256 for 41 snapshotted production modules before native import rewriting. All work is scratch-only.

No forest regeneration or production changes were performed. Any future accepted height change would need ecology/root regeneration and a full scene review; this rejected candidate should not trigger those costs.
