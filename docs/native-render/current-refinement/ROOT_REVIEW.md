# Current refinement — incomplete native review

The root inspected all three integrated 1920×1080 frames at full resolution. These are actual production Three.js modules rendered through native ANGLE/Mesa software graphics, using a linear HalfFloat MSAA4 target and the official ACES/sRGB OutputPass. They are diagnostic evidence, not production-browser/mobile/offline acceptance or consumer performance measurements. All three frames report no shader errors and GL error 0. Final art acceptance remains open.

## Accepted narrow corrections

- Source-derived Island and Syringa sunlight visibility atlases add orientation-aware interior canopy shading. Their RGB/normal/coverage source atlases are unchanged. Fixed source pose and roughly 6° local sun elevation remain approximations; there is no distant inter-tree occlusion.
- Cloud density uses mip-filtered three-dimensional noise and 30 m midpoint integration. The original density mass and sun/exposure are retained. Noise is reduced, but visible edge bands and overly soft masses remain.
- The cinematic uses a 42° vertical lens (26.38 mm full-frame equivalent at 16:9), preserves the highest-summit → bay → beach → open-water route, and smooths tangent sampling. Measured maximum angular speed fell from 100.98 to 53.22°/s. Temporal acceptance remains open.
- The retreating swash coverage fade now applies across the actual runup front, including negative shore distances. A proposed moving height-contact adjustment created a reflective crease and was rejected.
- Independent main-camera and shadow instance buffers reduce submitted core-tree work while preserving native control images exactly. Both 960 px paired views had zero changed pixels. A prior in-place packer lost shadows and was rejected. Separate buffers add about 10.05 MiB CPU plus possible matching GPU attributes and 4.23 MiB CPU bounds; no FPS claim.
- Rock triplanar sampling uses three translated source phases with consistent derivatives and material channels. The coherent grid is removed in the bounded material probe while measured detail is retained. Rock anisotropy is 1 because the tested native driver produced phase-dependent mip rows at 4; grazing-angle tradeoffs need browser review.
- Concurrent atlas loads and explicit disposal cover shared shader textures, ground textures and instance buffers. Browser lifecycle behavior is not yet verified.

## Integrated evidence

| Image | Multipass triangles | Calls | GL / shader errors |
| --- | ---: | ---: | --- |
| integrated-refinement-1920/flight-0-mode-0-1920.png | 56,483,740 | 676 | 0 / 0 |
| integrated-refinement-1920/flight-10.5-mode-0-1920.png | 37,043,856 | 901 | 0 / 0 |
| integrated-refinement-1920/wet-sand-mode-0-1920.png | 40,387,017 | 903 | 0 / 0 |

Sidecars record the exact production source and loaded asset hashes, camera, renderer and submissions. These counts include multiple passes and do not mean unique visible geometry. Native peak cgroup usage was roughly 12.35 GB; no browser memory/FPS claim follows.

## Five largest visible defects, in priority order

1. Geology is still dominated by rounded heightfield slopes and obvious rectangular outcrop strips in the shoreline frame. The source material correction does not solve the silhouette.
2. Water has excessively hard, mercury-like reflections at low angles; distant water remains visually uniform. Shore coverage is improved but water art is not accepted.
3. Remote tree crowns form a repetitive golden blanket; near foliage remains sparse and pointillist in places. Source visibility improves depth but not ecological structure or silhouette variety.
4. Cloud edges show residual bands, and the cloud masses lack convincing layered scale and structure.
5. Sand reads gray/flat over broad zones and its transition into sparse grass is too generic. Pale dry sediment, wet sediment and rooted vegetation need a coherent visible transition.

## Rejections and remaining gates

The Coastal Cliff01 cap/backing, buried crest, albedo-calibrated bridge-like placements and compressed east-buttress heightfield were rejected. No tall scan from later research was ready to integrate. Texture canonicalization and the next connected geology prototype are scratch studies, not included as accepted production changes.

Source checks, 17 unit tests, 38 asset records, CPU world checks and TypeScript/Vite build pass. The current built coastal worker again exactly matches the main-thread field (16,777,216 bytes, SHA256 1a0a8e16e9c6b1339be7f1a2bfc9ef972c8dc1ee0a0a6b79f8db1a269439b6c3).

The managed browser cannot create even a 16×16 WebGL context. There are still zero accepted production-browser refinement cycles, no final 4K gallery, no final film, no final mobile/offline/FPS proof, no final main commit/push, and no publication. The 24-hour minimum and all final gates remain intact. This review does not label the world AAA or complete.
