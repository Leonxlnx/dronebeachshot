# Rejected: Coastal Cliff01 material calibration

The calibration reduces the dark brown source / pale grey terrain mismatch, but does not fix the long projecting shelf, undercuts, or terrain posts beneath the wall. The contextual frame still reads as a bridge inserted into the hillside. **Do not integrate this placement or calibration. Stop this source iteration.**

## Controlled comparison

Both variants contain exactly the same source wall and bounded terrain cut. Only the source albedo correction changes. Camera, time 14 lighting, atmosphere, geometry, source UV, normal maps and roughness are identical. Source geometry is the intact 461,824-triangle Coastal Cliff01 scan, uniformly scaled 1x. The previous cut and tree/camera/coastal audits remain in `../coastal-cut-study/`; this material experiment introduces no additional height or placement changes.

| View | Original source albedo | Calibrated source albedo |
|---|---|---|
| Context | `cut-context-before.png` | `cut-context-candidate.png` |
| Detail | `cut-detail-before.png` | `cut-detail-candidate.png` |

The detail reveals lighter grey/taupe scanned faces and a reduced albedo discontinuity. Dark upper surfaces, warm grazing light and the source's overhangs remain. The very bright mottled faces now make the separate horizontal shelf especially easy to read. Neither view reaches the intended coherent coastal geology.

## Measured albedo, independent of illumination

The diagnostic outputs the actual source and terrain `diffuseColor.rgb` into a linear RGBA32F target after overriding the light/fog/output result. Alpha identifies the selected material and region. No tone mapping, shadows or sun intensity enter these samples.

| Selection across the two cameras | Pixels | Median linear luminance |
|---|---:|---:|
| Source rock: world geometric normal Y < 0.57, G < 1.1 R | 42,697 | 0.040846665 |
| Adjacent terrain: normal Y < 0.57, height > 35 m, within 12 m of source XZ bounds | 66,670 | 0.233355047 |

The target is actual exposed terrain material, including its weathering/moss mixes, not a pure laboratory rock reflectance. Samples from two cameras overlap in world space, so counts describe visible pixels, not independent surface measurements.

Measured median luminance ratio: **5.71295227**. Median-chroma ratios: **[0.93207816, 1.00022771, 1.38491602]**. Combined RGB gains: **[5.32491805, 5.71425317, 7.91195912]**. This is a substantial, explicitly artistic brightening/white balance of the dark scan; it is not source-original color. Absolute target median albedo remains moderate.

The shader preserves local source variation with channel gains and softly compresses values above 0.55 toward 0.65. Coverage fades from full correction at world geometric normal Y <= 0.57 to zero at Y >= 0.85. Green/red ratios from 1.03 to 1.20 further suppress correction. These are geometric/color proxies for turf and upward surfaces, not a perfect semantic turf mask. Geometry, UV, source image bytes, normal and roughness maps remain unchanged.

## Evidence and scope

- Four actual native ANGLE/Mesa llvmpipe 768 x 432 images, exit 0, all GL errors 0, no shader errors.
- Peak RSS: 1,370.949 MB.
- The isolated crop uses actual snapshot terrain and source PBR. Vegetation, ocean and distant terrain are omitted. No browser/mobile/performance claim.
- `albedo-measurements.json`, `calibration.json`, `probe-albedo.mjs` and the two RGBA32F buffers record measurement inputs/masks.
- `cliff-albedo-calibration.ts` and `render-calibrated.mjs` reproduce the rejected artistic experiment.
- `render-proof.json` records the matched cameras and audited geometry. A stale inherited description was corrected after rendering; no image pixels changed.

Source: [Poly Haven Coastal Cliff01](https://polyhaven.com/a/coastal_cliff_01), [CC0 license](https://polyhaven.com/license). Exact self-contained source GLB and provenance are retained in `../cliff-source-research/`; the original source asset itself is unmodified.
