# Continuous distant terrain candidate

Candidate: `terrain-extension-candidate.ts`, a complete scratch replacement for `src/world/terrain.ts` for root review. No checkout file was changed.

## What changes

The five detached sine-wave plane strips are replaced by one real, indexed terrain annulus. Its inner perimeter follows the exact existing rectangle, x = ±600 m and z = ±800 m, with one vertex for every existing 2 m boundary sample. Successive rings share indices and close around all four corners, so there are no independently tiled borders, hanging strips, or mismatched coarse/fine edges.

The central `createTerrain` tile body and the entire `createRocks` function were verified byte-identical to the source snapshot. Central terrain heights, camera paths, shared shore helpers, vegetation placement, water math, and the coastal raster remain unchanged. The only new shared-helper import is `shoreZ`.

Within 28 m outside the rectangle, the extension uses `terrainHeight` exactly. From 28–180 m it blends into regional terrain. This preserves the existing edge's height and its immediate normal neighborhood without overlapping coplanar geometry.

Beyond x = ±600 m, the regional coast begins with the current shore position and derivative, then bends toward a bounded trend with irregular meanders. This is intentional: extending the existing negative x² coast indefinitely produces a huge enclosing land mass and increasingly elevated sediment field. Regional ridge spines follow the continued coast, with independent crest height, width, and lateral variation. They are connected 3D ridges, not images, cones pasted into a row, or disconnected background sheets.

The outer rectangle lies at x = ±6,600 m / z = ±8,800 m. Terrain fades irregularly toward -85 m before reaching it; every last-ring vertex is underwater. The primary ocean corridor remains open. No raised rectangular terminal edge should be geometrically available to silhouette.

The continuation keeps the exact existing ground shader near the join. Farther out it blends its diffuse surface to broad forest, pale cliff, and low beach colors. This avoids applying the original unbounded bay shoreline's sand classification to distant mountains. It does not add actual distant tree instances or claim to solve the central forest coverage problem.

## CPU geometry checks completed

`terrain-extension-check.json` records:

- 48 central tiles preserved.
- 2,800 / 2,800 unique central boundary vertices matched, with **0 m maximum height error** after Float32 storage.
- 425,600 extension vertices, 845,600 triangles, and 152 connected radial rings.
- Every coordinate finite; no downward or degenerate projected triangle winding.
- Entire terminal perimeter at exactly -85 m.
- The material's shader replacement anchor exists and is applied.

These checks ran the actual candidate's Three.js geometry creation in Node, using the source module imports. They establish numeric continuity and executable geometry creation. They are not a rendered visual pass or browser QA. The extension replaces about 96,000 triangles in the old strips with 845,600 triangles, so root should include the resulting render cost in its comparison.

## Root render checks still required

Use the same `flight-0` and `mountain-wide` native cameras before and after this candidate. Verify that both existing square coastal endpoints become continuous land/coast, that no rectangular closure is visible, that the distant ridges no longer read as floating facets, and that the 28–180 m transition does not create a visible ridge wall. Check the shader's color transition at the seam. If the opening is still mostly water, its camera direction is a separate composition issue; this candidate deliberately preserves that camera.

Because the shared coastal field/water code is unchanged, distant continuation shorelines do not gain new local rock obstacles, refraction detail, or individually computed breaking foam. The candidate addresses land continuity and distant geology only. Do not treat it as a completed coast-system or visual approval.
