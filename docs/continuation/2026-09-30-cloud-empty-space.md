# Exact cloud empty-space rejection

This is a bounded evaluation-order optimization in `src/world/clouds.ts`, not
a cloud-quality reduction or a measured GPU performance claim. Graphics
acceptance remains pending the coordinator's actual paired captures.

## Change

The existing clearing mask and inner/outer radius fade are now evaluated
immediately after the cloud volume bounds. When either exact multiplier equals
zero, density is exactly zero for every finite sampled shape, so the function
returns before weather noise and volume-texture reads. Values merely close to
zero still execute the complete original density calculation.

The unchanged regional-height profile is evaluated before the first 3D texture
read. If it equals zero, the former `base *= profile` would produce zero and
the existing `base < .001` branch would return zero. That exact case can also
return before the lookup. Nonzero profile values retain the original operations.

The final nonzero expression remains `shape*clearing*distantFade`. Cloud cover,
erosion, thresholds, the number/location of march samples, lighting cadence,
noise texture, mip selection and filtering are unchanged.

## Validation

- Source comparison against Git HEAD confirmed eight important expressions
  are byte-for-byte unchanged, including the final multiplication order.
  Removing the relocated declarations, the two new exact-zero branches and
  comments leaves the preceding and candidate source identical.
- A deterministic CPU differential probe used seed 60829, 12,000 random points
  plus 538 explicit radius, height and opening boundary points. Four bounded
  texture fixtures per point covered zero, one, midpoint and deterministic
  varying RGBA samples. The probe ran **50,152 comparisons with zero changed
  finite outputs**. There were 9,691 positive results, including 165 with a
  positive mask below .001, guarding against an accidental small-value cutoff.
- The CPU probe counted 728 exact-mask early returns and 3,216 exact-profile
  early returns. Logical texture lookups changed from 40,374 to 36,291 in that
  synthetic sample distribution. These are probe counters, not GPU timing,
  production frame statistics or an image-equivalence result.
- `tsc --noEmit` and `git diff --check` pass.

The CPU probe models the unchanged equations using JavaScript arithmetic and
bounded synthetic texture samples. It does not claim to reproduce hardware
interpolation or GLSL float rounding. Actual before/after pixels and graphics
errors remain the required integration check.

## Expert review

The two rejections cannot discard a finite nonzero result: an exact final
factor is zero, or the original pre-erosion base is exactly zero. No epsilon
test was introduced. Every expression affecting surviving points retains its
operation ordering. The profile noise lookup was moved, not duplicated, and
the volume texture still uses explicit LOD in the divergent march.
