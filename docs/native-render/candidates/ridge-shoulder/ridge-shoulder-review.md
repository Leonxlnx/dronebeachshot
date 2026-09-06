The updated terrain and restrained camera are ready for root's full-scene trial. The terrain source already matches root's integrated shoulder version exactly (SHA256 218fb0c13f64bea6d4ff3bf3bd53f9a7bb79f7f6c73d808cbd1df3950854c3e0); this subagent edited scratch only. The camera patch passes application checking against the current checkout.

The needle had two geometric causes: steep narrow ridge sections, and a single protected summit point exempt from erosion. The candidate replaces that with a short high crest, broader shoulders, two extra attached buttresses, a rounded crest/shoulder profile and stronger broad lateral deformation. It normalizes the actual sampled 2 m crest instead of preserving one vertex. The highest core vertex remains 313 m at (-120,354), 7.2 m from the original summit anchor; the original anchor (-126,350) is 311.554 m. `ridge-shoulder-comparison.png` shows the previous integrated ridge above and wider shoulders below. This is geometry evidence under neutral clay, not palette or full-scene acceptance. Native shader and GL errors are zero.

`ridge-shoulder-camera.patch` changes camera height only and ends the correction at the approved 11.5 s rejoin. X/Z, gaze logic, and the original beach/sea curve after that time are retained. The quintic offset and its first/second derivatives end at zero. A stronger jerk penalty deliberately permits greater clearance rather than following each abrupt crown bound.

| Continuous or sampled check | Result |
| --- | ---: |
| Maximum descent speed | 54.950020 m/s |
| Maximum absolute vertical acceleration | 24.031741 m/s² |
| Maximum absolute vertical jerk | 35.870938 m/s³ |
| Starting camera height | 391.948 m |
| Minimum terrain clearance, 1,201 route points | 4.895 m |
| Minimum regenerated tree-bound clearance | 3.200 m |
| Minimum regenerated rock-bound clearance | 27.210 m |
| Maximum total 3D route speed | 88.215 m/s |
| Position difference from original after 11.5 s | 0 m |

Velocity, acceleration and jerk extrema were solved at the exact polynomial stationary points and spline interval endpoints, including both sides of knot discontinuities. Thus the 55 m/s descent and 25 m/s² acceleration checks do not rely only on frame sampling. The 3D speed includes the unchanged X/Z travel; it is not capped at 55 m/s. The start is approximately 49 m above the original 343 m camera start; that extra clearance is the visible tradeoff for smoother motion. `ridge-shoulder-motion.png` shows the height and motion profiles.

For the previous narrow terrain, an 11 s rejoin was mathematically impossible at 25 m/s²: the crown required Y>=22.126 m at 10.1167 s while the backward reachable height from the fixed 11 s endpoint/velocity was only 15.460 m. That proof is retained in `ridge-camera-restrained-fit.json`. The wider terrain changes the placement constraints: no feasible fit in the chosen quintic basis was found at 11 s, 11.25 s was feasible but jerkier, and the approved 11.5 s candidate was chosen for smoothness. Do not apply the old narrow-terrain feasibility numbers to the wider field.

The final candidate was rechecked against 14,000 regenerated production placements, with candidate math driving terrain-surface, habitat, ecology, rocks and the coastal field consistently. Tree bounds use all nine audited original GLB bounds transformed with production scale/yaw/lean and a 1 m horizontal / 0.05 m vertical wind allowance. Rock bounds use the actual 340 generated instances with 0.4 m horizontal padding. The coastal builder rasterized 118 coastal instances without degenerate triangles. All 16 evaluation positions are recorded in `ridge-shoulder-audit.json`; the patch raises canopy-close and forest-opening to their derived canopy clearance, and descent-reveal from 95 to 98.5 m (3.298 m above its conservative crown bound).

The two ground-detail evaluation flags were whole-tree-box false positives. Their actual near+hero GLTF triangles, with exact production object and instance transforms, were inspected after the final shoulder/placement update:

| Pose | Original camera | Nearest static tree triangle | Nearby same-height alternative | Alternative target |
| --- | --- | ---: | --- | --- |
| beach-transition | (-55,7,113) | 3.790 m | (-55,7,115) | (-15,3,89) |
| sand-detail | (30,2.4,125.5432) | at least 12 m | (28,2.4,125.5432) | (8,0.2,106.8934) |

Both alternatives have at least 4 m static triangle clearance, and the first metre along their view direction has at least 3 m. Their heights are unchanged. Transparent margins of leaf cards were included conservatively; the closest beach triangle is a leaf card. The original poses are already clear with a 1 m wind allowance plus near-camera margin, so those alternatives are proposals, not necessary collision fixes. `beach-shoulder-geometry-audit.json` contains three alternatives per pose and the exact closest geometry/material/root records.

Contract checks: 14,615 sampled shore/seabed points through signed distance 25 m remain identical; 1,000 height-atlas samples match exact Float32 candidate grid heights; 100 ray hits on actual 2 m triangles agree with renderedTerrainHeight within 1.14e-13 m. The native comparison uses all original 48 core tiles. Changing this terrain or camera again requires regenerating tree/rock transforms, habitat and canopy fields, terrain height atlas, coastal field, LOD cell bounds and clearance evidence together.

Current integration files are `ridge-shoulder-landform.patch` and `ridge-shoulder-camera.patch`, with source review copies `math-ridge-shoulder-candidate.ts` and `cinematic-ridge-shoulder-candidate.ts`. Older ridge/camera candidates are superseded. Full-scene visual and motion acceptance remains with root's integration review.
