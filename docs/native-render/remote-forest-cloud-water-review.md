# Remote forest, cloud and coastal continuity review

This is an incomplete development review. It does not pass final art, browser, mobile, performance or film gates.

## Incorporated

- The camera now joins its low shoreline segment by 10.5 seconds, retaining the 425 m summit start, continuous position/velocity/acceleration and the mountain → bay → beach → horizon route. The production camera tests pass; maximum total speed is 93.23 m/s, and the flight still requires artistic/temporal review.
- The connected distant annulus uses resolved drainage and measured normals. A smooth upper-relief remap reduces its maximum from 483.43 to 409.29 m, leaving the 425 m core summit highest. Exhaustive vertex checks preserve submerged terrain, the collar, and all heights at/below 360 m exactly. No clipped flat summit plane is introduced.
- Remote forest roots use exact annulus triangles; the sampler's 11,895 centroid checks have sub-picometre numerical error. The forest adds over 100,000 actual source-tree impostors. Source-derived crown self-shadow now increases depth, but its broadly golden appearance and proxy silhouette quality still require art refinement.
- Restored Syringa far albedo/normal views now match the full restored near geometry: 24 views, unchanged source colors, paired alpha coverage, approximately 18.2% more mean covered area than the old far atlas. Atlas bounds and manifest hashes were updated together.
- The cloud field now uses an original periodic 64³ Perlin/Worley density texture, rather than sliced 2D noise. Visible clouds, reflected sky and cloud shadows share it. Deterministic construction is verified (1 MiB). Ray integration includes per-pixel sampling offsets and height-dependent atmospheric attenuation. Actual full-scene images show more spatial cloud structure; softness and grain still fail the final target.
- A demonstrated false shore contact at x=575–600 m no longer pulls water toward inland terrain height. Far coarse ocean triangles do not follow sand height.
- Broad water depth now derives from the actual rendered core/annulus terrain and blends into the detailed coastal field, removing the old unrelated constant-depth fallback. Only the outside depth uses the coarser 512² field; detailed inner-bay depth remains authoritative.

## Actual visual evidence and its limits

`frames/volume-summit-forest` contains two 960×540 full-scene frames from real production modules plus the now-integrated cloud candidate, with explicit linear HalfFloat MSAA and official ACES/sRGB output. Both finished with no GL or shader errors. The module graph hashes and loaded asset file hashes are recorded. These frames precede the latest broad bathymetry and swash-extent corrections.

All `ocean-*` and `bathymetry-continuity` frames deliberately omit vegetation/understory to diagnose the coast. They are not finished-world screenshots. A coordinate-output GPU control confirms sampled apparent strips lie near sea level; remaining straight artifacts are not evidence of vertical water walls. The swash mesh is now extended across the complete near-ocean domain. The `swash-domain-continuity` native frame removes the remaining exposed triangular seabed gap at the outer crescent; this was a missing water-coverage region, not a vertical sheet.

## Rejected or unfinished

- Small RockFace02 faces with caps and terrain backing were rejected: they looked like pasted plates, piled boulders, or raised ramps. They are not in production.
- Coastal Cliff01 is a newly researched genuine 92 m lower-wall source; its source shape is promising, but its first rigid placements were rejected as disconnected brown patches. A bounded terrain-cut study is separate and unaccepted.
- Color reconstruction finds no major sRGB conversion defect in the far trees. The original Island tree is olive and turns golden under the existing light. No saturation patch was applied.
- Both tree families now use 24-view, 8-sun-azimuth RG8 atlases of direct-sun visibility from the source geometry. The full-scene summit and wet-sand native views load the exact reviewed binaries and finish with GL/shader errors zero. RGB/normal/alpha assets are unchanged. Each family adds 6 MiB CPU and 8 MiB logical mipmapped GPU storage. The fixed 6.02° sun-elevation bake approximates leaning/wind-deformed trees and supplies no inter-tree occlusion. Deep mip filtering and silhouettes remain limitations. Explicit teardown now includes these closure-owned textures.

No final browser refinement cycle, final gallery, film, main commit/push, public deployment or AAA-quality claim is made. The current `source-visibility-world` pair includes the broad bathymetry and complete swash coverage fixes, unlike the older cloud/forest pair. Its files and actual asset hashes are staged in `current-refinement/source-visibility`. Full source, 16 tests, all 38 assets, world CPU checks and production build pass.

The strict final checker and the 86,400-second active-work requirement remain in force.
