# Stone projection orientation: binary inspection candidate

The investigation below led to an approved binary inspection candidate in
`ground-materials.ts`. It defaults OFF and has not yet been accepted in actual
paired renders. The separate geometric incision remains unreferenced.

## Direct source inspection

Inspected the actual `marble_cliff_03_diff_2k.webp`,
`marble_cliff_03_nor_gl_2k.webp` and `marble_cliff_03_arm_2k.webp` through image
viewing. Their broad horizontal joints and vertical cross-fractures coincide.
The long bed interfaces run predominantly along texture U (roughly constant V).
The normal's green-channel variations follow the up/down faces of these beds;
the red-channel variations describe their lateral and crossing fractures.

`src/world/assets.ts` loads the albedo as SRGB and normal/ARM as linear data,
with common wrapping and rock anisotropy 1. This proposal changes none of those
settings, textures, maps, provenance or scan dimensions.

## Actual mapping and the smallest correction

Let `p = worldPosition / L`, with L=5.7483 m for the existing stone maps and
L=23 m for the optional macro normal. Let the decoded normal slope be
`s = normal.xy / max(normal.z, .15)` after the current three-phase sampling.

| Projection weight | Current UV | Current world slope | Proposed UV | Proposed world slope |
| --- | --- | --- | --- | --- |
| abs(nx)^4 | (p.y,p.z) | (0,s.u,s.v) | **(p.z,p.y)** | **(0,s.v,s.u)** |
| abs(ny)^4 | (p.x,p.z) | (s.u,0,s.v) | unchanged | unchanged |
| abs(nz)^4 | (p.x,p.y) | (s.u,s.v,0) | unchanged | unchanged |

With the current X projection, a source constant-V bed becomes constant world
Z: it runs vertically on an X-facing wall. With the proposed X projection,
constant V means constant world Y, agreeing with the existing Z projection.

Changing the UV alone is insufficient. Under the proposal, increasing U moves
along world Z, so the normal's U slope belongs on world Z. Increasing V moves
along world Y, so its V slope belongs on Y. Leaving `(0,s.u,s.v)` would rotate
the colored fracture without rotating its lighting response. The shared swap
must apply to albedo, ARM and the normal sample/basis together.

The current shader accumulates a world-space detail vector D and uses
`normalize(n + strength * (D - n*dot(n,D)))`. It is not constructing a TBN normal
whose Z component is determined by `cross(T,B)`. The corrected X detail is
therefore simply `D = s.u*eZ + s.v*eY`. No extra normal sign flip is needed for
the component swap or for a negative X face: the original geometric normal n
still supplies the outward direction, and the detail is projected onto its
tangent plane. A component swap is a reflection of the UV basis, but the
matching slope permutation accounts for it. Adding a sign flip would change
the embossed/indented response. `render_review` independently checked and
agreed with this derivation.

Small analytic fixtures checked pure U→world +Z, pure V→world +Y, and a flat
normal→zero detail. Across 4,000 positive/negative X and oblique-normal cases,
the projected detail remained tangent and the perturbed normal stayed in the
original hemisphere. Swapping the components changed the slope length by
exactly zero. These fixtures validate basis math, not a rendered material.

## Implemented optional control

The shared export `stoneBeddingAligned={value:0}` binds the binary GLSL uniform
`uStoneBeddingAligned`. The root will expose `surfaceStudy.stoneBedding` for a
same-build 0/1 comparison. Keep `uDebug` in its
standalone declaration to preserve the existing diagnostics wrapper. A uniform
branch can select the two X-projection coordinates before `stoneSample`:

```glsl
vec2 stoneXUV(vec3 p) {
 return uStoneBeddingAligned > .5 ? p.zy : p.yz;
}
vec3 stoneXDetail(vec2 slope) {
 return uStoneBeddingAligned > .5
  ? vec3(0., slope.y, slope.x)
  : vec3(0., slope.x, slope.y);
}
```

`triStone` now calls `stoneSample(tex,stoneXUV(p))` for its X contribution.
`triStoneDetail` samples the same coordinates and passes decoded X slopes
through `stoneXDetail`. Y/Z contributions, three-phase offsets, normalized phase
weights, derivative sampling, slope clamps and material strengths stay intact.
Select endpoints 0/1, rather than interpolating UV coordinates through skewed
intermediate projections. There are no additional texture fetches, geometry
changes, new alpha paths or blending operations in the proposed normal path.

The common `triStone` helper also supplies ARM, so changing it keeps color,
roughness and occlusion registered with the reoriented normal. Leave generic
soil/litter `triSample` and `triDetail` unchanged: those materials do not have the
same demonstrated bedding requirement.

## Affected surfaces and preserved contracts

| Surface | Effect |
| --- | --- |
| Core terrain stone contribution | X stone albedo/normal/ARM reoriented |
| Distant terrain stone contribution | Same correction through the retained shared shader; distant material override stays intact |
| Procedural fractured rocks/talus using createRockMaterial | Same X stone correction |
| Offshore scans instantiated by createOffshoreRocks | Same X stone correction: these use scanned geometry but createRockMaterial, not the source glTF material |
| Optional 23 m stone normal | Same corrected X basis if the layer is enabled |
| Imported inland/near scans with native glTF UVs/materials | No change |
| Soil, litter, sand, tree materials, water, foam, spray | No change |

There is no color multiplier or new grade. Source texels, physical scale, color
spaces, normalized projection weights and filter footprint magnitudes remain
the same. Constant albedo inputs are preserved exactly. Texture positions and
phase-cell choices move, so finite-frame average luminance is not guaranteed
bit-identical; it would be inaccurate to promise exact per-frame albedo energy.
The intended invariant is unchanged source radiometry and no artificial gain.

Coastal geometry, shore distance, wetness, film roughness, refraction and timing
are untouched. Wet **stone** can receive the same changed texture orientation;
this is not a promise of pixel-identical wet rock. The 37 offshore scans also
use createRockMaterial and therefore receive the orientation change, despite
their scanned geometry. Adding a separate dry-only
two-mapping blend would increase cost and complexity and is outside this minimal
proposal. Near and inland imported scans retain their native mapping.

## What it can and cannot repair

This fixes a real directional inconsistency, not continuous stratigraphy. Each
axis still uses different U coordinates and independently phased source tiles;
the random V offsets interrupt joints at phase boundaries and do not place
every bed at a common world height. Correcting that continuity would be a
separate, larger projection design, with repetition and seam risks.

Approximate central-difference normals at five measured visible face points
give X weights of 16–29%, versus Z weights of 57–71%. A farther X269/Z54 flank
has approximately 59% X weight. Therefore a meaningful improvement is more
likely on the side-facing headland than the middle of the broad beige face;
the dominant Z contribution is already oriented correctly there. These are
field-normal estimates, not exact interpolated mesh-normal measurements.

Inspect real matched camera views with `mineralReliefStrength=0` first so the
extra 23 m layer cannot obscure this mapping decision. Acceptance requires
coherent bed direction and matching albedo/normal fractures without cross-axis
seams, stretched texture, different wetness or a changed beach. Keep the same
geometry, lighting, exposure and camera. Source-composition checks should cover
the real core/distant/rock callbacks and all diagnostics wrappers before the
actual GPU render. Do not claim silhouette or new cast-shadow improvements:
this correction cannot supply either.

All three real 768 px mineral-off/on pairs were inspected: 10.5 s, headland and
mountain-wide. The added 23 m normal made no appreciable improvement in plane
readability at shot scale. In mountain-wide the central face remains a single
pale sheet, with only negligible grain changes. The root rejected the .12
default; `mineralReliefStrength` is now 0. The control remains available for
inspection, but the nine additional reads are skipped by default.

On 2026-10-01, `check-ground-shader-integration.mjs` passed for actual
core/distant/rock callbacks plus the diagnostics/cloud/aerial wrappers: unique
uniform declarations, live shared bedding bindings at 0/1, both studies default
off, and the distant override intact. `npx tsc --noEmit` and `git diff --check`
passed. Ground/rock cache keys advance to v15/v10. No build or browser was run
by this worker; actual corrected-bedding GPU compilation and image acceptance
remain pending.


## Actual paired render decision,2026-10-01

Candidate05 completed headland and mountain-wide0/1 pairs in the full production
browser without shader errors. Root and independent art review accept1 as a
coherent source-orientation correction at unchanged sample cost. No obvious new
cross-axis seam appeared in these views. The visual improvement is subtle and
does not resolve cliff mass, silhouette or the broad beige-face problem. The
binary off control remains available; the accepted default is now1. The callback
check asserts that deliberate default and still tests both live endpoints.
