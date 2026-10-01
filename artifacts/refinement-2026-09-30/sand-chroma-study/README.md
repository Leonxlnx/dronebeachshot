# Sand chroma: measured proposal evidence

`evidence.json` records the actual source asset SHA-256, full-resolution sRGB-decoded means, luminance normalization, current/proposed albedo, reviewed PNG hashes, and five explicitly located image regions. It describes existing candidate10 renders; no new render was made for this evidence.

The source scan's mean linear luminance is **0.122651665**, closely matching the shader's `.123` normalization. Its chroma scaled to the current sand-base luminance is approximately `(.665701,.524298,.348188)`. The proposed `(.64,.53,.37)` restores restrained warmth relative to the existing `(.58,.54,.445)` while changing luminance by only **+0.035%**.

Root has added this as the reversible `sandChroma` control, default **0**. All wet physics stay unchanged for its paired visual study. The variant is **not visually accepted** by these measurements.

ROI coordinates use the original 640×360 PNG, top-left origin, exclusive right/bottom bounds. Their RGB statistics include real rendered shading and reflection and are not isolated albedo measurements. In particular, the persistent glossy wet strip may remain gray even with a warmer substrate. Reject olive shallows or orange sunset sand in the actual comparison.

See `../sand-palette-review.md` for the source-math diagnosis and proposed visual decision.
