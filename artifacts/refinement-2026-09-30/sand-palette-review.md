# Shore sediment palette proposal

Status: read-only art review; root subsequently integrated the reversible `sandChroma` control, default **0**. The variant is **not visually accepted**. No GPU render was started for this review. Exact source/image hashes and numeric measurements are saved in `sand-chroma-study/evidence.json`.

Reviewed actual `candidate-10-cloud-coverage/shore-cloud-09.png` (10.5 s) and `sunset-cloud-09.png` (19.5 s), both with cloud coverage 0.9. The near beach reads as a smooth gray-taupe road; the foreground shallows inherit some of this low-chroma substrate. The sunset view already has useful blue/teal water against copper light. Broad pale water reflection is consistent with the prior cloud diagnosis, so this proposal does not recolor reflection or foam.

## One bounded candidate

Change only the sediment base albedo in `src/render/ground-materials.ts`:

```glsl
// Before
sand=vec3(.58,.54,.445)*mix(1.,clamp(sandLuminance/.123,.62,1.38),sandGrain);
// Proposed
sand=vec3(.64,.53,.37)*mix(1.,clamp(sandLuminance/.123,.62,1.38),sandGrain);
```

This restores restrained warm mineral color at essentially unchanged luminance. It retains the existing source-grain signal, footprint filtering, macro variation, sediment masks, wet darkening, wet roughness and lighting. No terrain or ocean uniform needs to change.

The actual source `public/assets/textures/sand_03_diff_2k.webp` has mean linear RGB `(0.150743, 0.118724, 0.078845)`, measured by decoding each channel's full-resolution histogram from sRGB. Its luminance is `0.122652`, consistent with the shader's `.123` normalization. Scaling that mean chroma to the current base luminance would give `(0.665701, 0.524298, 0.348188)`. The proposal is less warm than that source-derived palette; it recovers much of the chroma currently replaced by a nearly neutral buff constant.

| Albedo quantity | Current | Proposed |
| --- | --- | --- |
| Dry linear RGB | `(0.58, 0.54, 0.445)` | `(0.64, 0.53, 0.37)` |
| Linear luminance | `0.541645` | `0.541834` (+0.035%) |
| Dry sRGB swatch, before lighting | `#c8c2b2` | `#d1c0a4` |
| Fully wet linear RGB, existing ×0.61 | `(0.3538, 0.3294, 0.27145)` | `(0.3904, 0.3233, 0.2257)` |

These are material swatches, not predicted rendered pixel colors. A representative actual mid-wet beach patch (x565–604, y240–279) averages approximately sRGB `(111,106,99)`; the rendered light and reflection strongly affect the result.

## Why this also reaches the shallows

`src/render/refraction.ts` renders the same ground material into the linear HDR coast buffer. The water then uses `bottom * exp(-vec3(.24,.065,.037) * path) + scattered * (1-absorption)`. Therefore the change reaches the actual submerged substrate, with the same water depth, occlusion, lighting and Fresnel response. Red transmission drops from 0.787 at a 1 m optical path to 0.147 at 8 m; no second shallow-water palette or painted turquoise band is introduced. The ocean's deep scattering color `(.01,.084,.12)` remains the same.

## Limit and visual decision

The current sand wetness persists over wave cycles and also lowers exposed wet roughness toward `.20`. Gray sky reflection may still dominate that strip even after this palette change. The smooth beach geometry and its large nearly uniform band also remain. Do not claim this single change removes every roadlike cue. A warmer bottom can read greener after differential absorption; reject the candidate if the shallow margin becomes olive or if sunset sand becomes orange. Acceptance requires the same two actual views to show a clearer buff/wet-beige distinction and natural shallow-water depth without changing exposure or lifting the whole coast.
