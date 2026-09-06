# Leaf coverage: native evidence and integration candidate

Two independent coverage losses are confirmed. The island leaf atlas has mean alpha **0.24995**, while its cutoff is **0.45**: sufficiently minified mip texels fall below the cutoff and the entire small leaf disappears. Separately, r185's enabled alpha-to-coverage uses an edge interval starting at the cutoff, so filtered edge pixels lose additional coverage. Original GLTF materials already look sparse in `isolated-tree-lods.png`; production ATC adds another loss under multisampling.

## Measured coverage

Tests used the actual production GLBs, transforms, `prepareTreeMaterial`, cloud hook and wind shader. A white fragment output isolated leaf coverage without changing geometry, map sampling or discard logic. LOD distance uniforms were placed inside each LOD's full-coverage interval, so transition dithering did not contaminate the result. Values below are summed raw framebuffer RGB, in equivalent covered pixels, before alpha was removed for image display.

| Asset / nominal whole-tree height | Original GLTF, 4× MSAA | Current production, 4× MSAA | Proposed, 4× MSAA |
|---|---:|---:|---:|
| Island near, 128 px | 2,146.4 | 511.9 | 3,152.4 |
| Island near, 48 px | 0.0 | 0.0 | 352.4 |
| Island far, 128 px | 4,629.4 | 4,340.1 | 4,535.9 |
| Island far, 48 px | 591.7 | 462.0 | 573.0 |
| Island far, 16 px | 34.6 | 5.8 | 44.3 |
| Syringa near, 128 px | 1,978.6 | 968.9 | 1,799.3 |
| Syringa near, 48 px | 349.3 | 258.9 | 265.6 |
| Syringa near, 16 px | 42.0 | 41.1 | 29.1 |

The near asset at 48/16 px is a stress comparison, not a recommendation to render expensive near geometry at far distances. Island far at 16 px is representative of a distant crown. Different camera angles and overlapping geometry will change the counts.

For single-sample targets, island near at 48 px improves from **1 to 369 occupied pixels**, and at 16 px from **0 to 43**. Production far at 16 px has 55 occupied RGB pixels but only 6.6 alpha-equivalent pixels; these are distinct measurements. The proposed material writes opaque surviving pixels, avoiding that fractional framebuffer-alpha ambiguity.

Disabling mip sampling restored 675 island-near pixels at 48 px, proving the mip/cutoff failure; globally reducing the cutoff to .25 restored 637. Neither diagnostic is the proposed production solution. They introduce aliasing or alter silhouettes indiscriminately. A centered ATC edge alone helps but cannot recover a mip average below the cutoff. Feeding fractional mip alpha directly into ATC also undercovers overlapping leaves and does not provide a single-sample/depth solution.

## Proposed shared color/depth change

`vegetation-alpha-coverage.patch` is ready for root review. The complete proposed file is `vegetation-material-alpha-candidate.ts`; production was not edited by this task.

1. Keep geometry, UVs, leaf dimensions, alpha textures, anisotropy, mipmaps, material color/normal/roughness maps, and LOD selection unchanged.
2. Center high-detail edge smoothing on the original alpha cutoff. Under minification, smoothly use the sampled alpha as fractional area coverage, using UV derivatives and the actual texture dimensions to measure the pixel footprint.
3. Enable Three's stock `alphaHash` and disable alpha-to-coverage on masked materials. Three converts fractional alpha to position/derivative-based stochastic coverage. This works for single-sample targets and MSAA without changing the native EGL configuration.
4. Apply the same alpha reconstruction and `alphaHash` to the existing custom depth material. Keep stock `alphahash_fragment` and all current wind/LOD logic in both passes. Update the program cache key.

This neither enlarges leaves nor adds opaque canopy geometry. It reconstructs the existing minified mask's fractional coverage. It can reduce a species' coverage where binary thresholding previously made a mip artificially opaque: syringa's mean alpha is **0.52432**, above the old cutoff. The small syringa reduction in the table is therefore expected, not concealed by a universal density multiplier.

## Verification and limits

- All three tested assets rendered at 128, 48 and 16 px in single-sample and 4× MSAA targets with no shader or GL errors.
- **18 color/custom-depth mask comparisons are byte-identical** at the same camera and sample configuration. This verifies shared displacement and alpha coverage through both actual shader pipelines. Shadow maps use a different camera/resolution, so they necessarily have different sampling footprints; identical screen-pixel masks across two cameras are not claimed.
- Branch meshes were excluded only from the coverage measurement, not from the candidate. Opaque bark and branch material behavior remains unchanged.
- Hash coverage can show fine spatial noise without temporal antialiasing. Whole-scene moving-camera review remains necessary, especially LOD overlaps and shadow appearance. This is a coverage correction, not a closed-canopy visual acceptance or a density adjustment.
- The near-asset documentation already records incomplete syringa source silhouette recovery under its triangle budget. Material changes cannot reconstruct missing source geometry.

Evidence: `leaf-coverage-audit.json`, `leaf-coverage-comparison.png`, `leaf-coverage-candidate-audit.json` (rejected centered/filtered ATC alternatives), `leaf-coverage-hashed-audit.json`, and `leaf-coverage-hashed-comparison.png`. Reproduction scripts are saved beside them. Native software rendering is not browser/device performance evidence.
