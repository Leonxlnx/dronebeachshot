# Lower woodland pocket: accepted as a bounded addition

Default ON in `src/world/coastal-young-woodland.ts` after review of the actual combined trial02 images at 9, 10.5 and 12 seconds (1280×720). Sixteen uniformly scaled existing Syringa trees form three unequal groups of4/7/5, with open intervals along the eastern coastal edge. No new model, texture, shrub layer, palm or tree-shape deformation was introduced. The review accepted the lower cohort as grounded, with separated groups and no obvious floating trees, hedge effect or route obstruction in those three views. This is a narrow improvement in woodland height variation, not a large overall art gain or a claim of botanically calibrated juvenile models.

`ecology.ts` keeps `treePlacements()` unchanged. The separate render-cohort helper appends additions only when enabled. `vegetation.ts` renders the combined cohort through existing source materials, LOD/culling/shadow paths and updates habitat canopy from all rendered trees. It returns the original base placements to floor/shrub/rock consumers, retaining their selection inputs. `youngCount` and `group.userData.youngWoodland.count` expose the candidate count; `main.ts` also reports `youngTrees`.

The focused CPU check passes against actual near/hero/medium source GLBs, their node transforms, Float32 normalization/instance transforms and rendered terrain triangles. It also passes TypeScript `tsc --noEmit`.

| Check | Result |
| --- | --- |
| Original tree cohort |14000, exact SHA-256 `927ddf7d749c7c3ec4673acebd280e97dd02c0664d26c02225deb8fff7fb64e6` |
| OFF behavior |Same input array; no candidate generation |
| Added actual height across three geometric LODs |4.752–7.494 m |
| Largest basal gap |.1127 m, within the .20 m check |
| Highest lowest-foot vertex |−.0189 m below rendered terrain |
| Deepest basal vertex |−.2431 m, within the .25 m burial check |
| Closest existing trunk / young trunk |2.638 m /3.943 m |
| Minimum sampled route distance to full tree bounds |70.911 m |
| Route segment check |All60Hz segments clear full bounds expanded2 m |
| Terrain-clear crown midpoints in640×360 frame |16 at9 s;12 at12 s |

The first audit caught one basal vertex at−.2531 m. Raising the young-only common seating offset by1 cm (`.045→.035`) met the unchanged burial cap while keeping every lowest-foot vertex below terrain. No old tree moved.

`cpu-check.json` records all16 placements and source hashes. Reproduce the CPU checks with either flag setting; the report records the active default and verifies that the default render cohort follows it:

```sh
node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-coastal-young-woodland.mjs
```

The root review used the three actual full-scene PNGs recorded in `trial02-on/capture-status.json`, with source/build identity and the selected profile recorded in `trial02-build-verification.json` and `trial02-profile.json`. This was a combined-candidate still review, not a matched isolated ON/OFF measurement or an animation test. The first group legitimately exits right by 12 seconds. The CPU projection coordinates in `cpu-check.json` remain 640×360; multiply by two for the reviewed images. Terrain-only midpoint rays omit tree/rock occlusion. Static checks and the three stills do not prove every animated view, exact rock intersection clearance or botanical juvenile proportions. The flag promotion and audit rerun themselves used no GPU, browser or build.
