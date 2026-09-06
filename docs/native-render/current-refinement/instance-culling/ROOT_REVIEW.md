# Accepted geometry-preserving submission optimization

The initial in-place packing prototype was rejected after actual native captures showed missing sun shadows and altered foliage. Two real defects were isolated: the sun projection had not been initialized before first culling, and Three's frame-based instance upload cache reused shadow matrices during the following color render.

The selected implementation explicitly initializes the sun projection and uses separate shadow-only instance buffers, sharing the unchanged vertex/index geometry, material, depth material and source values. No renderer frame counters or private upload caches are manipulated. Each pass culls against its own conservative source spheres. Offscreen shadow casters stay in the sun list. Shadow twins omit color draws through count-only callbacks and have explicit lifecycle disposal.

Root reran two complete production-module native comparisons. Both resulting 960×540 images are pixel-identical to their baselines: zero changed pixels, zero maximum channel error, zero GL/shader errors. This validates the two frozen views, not every possible view, consumer performance or final browser acceptance.

| View | Multipass triangles before | After | Draw calls before / after |
| --- | ---: | ---: | ---: |
| Summit start | 77,262,103 | 56,483,740 | 754 / 676 |
| Wet sand | 46,294,441 | 40,387,017 | 921 / 903 |

The independent CPU proof exercises source bounds, kept matrices/colors, LOD membership, repeated seeks, quality tiers, refraction restoration and the actual Three WebGLObjects upload order. The renderer remains native ANGLE/Mesa software graphics; no FPS claim is made.

Added storage: 10,534,360 bytes of CPU instance arrays and up to the same GPU attribute storage, plus 4,435,520 bytes of CPU sphere bounds and 2,260 scene objects. Immutable geometry/textures are shared. Main cleanup disposes twins before collecting shared scene resources, and also releases ordinary instance buffers and closure-owned texture data.
