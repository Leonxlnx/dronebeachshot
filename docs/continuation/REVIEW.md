# Continuation review — 2026-09-06

This is a tested continuation of the available GitHub recovery snapshot, **not
the completed 24-hour production or a release approval**. Root acceptance gates
remain open. The original film/gallery contract has not been reduced.

## Source and recovery

Base: `Leonxlnx/dronebeachshot`, main commit
`1406996ccab65e8d9cb149f341fd66ce5d30387b`. Read the original prompt, handoff,
conversation progress, art bible, timeline, prior rejected experiments and run
ledgers before this work. All archived runtime assets were restored and checked.

The owning Sites connector returns `NOT_FOUND` (404) for existing project
`appgprj_6a9b6e5ab4fc819189390e9ed1504847`. The later reported source on
`work/realism-recovered`, observed commit
`1badffc5176d623b1e2a770c12703f44dd980b73`, could not be retrieved. Library search
did not locate that source either. No replacement Site was created. These changes
are new implementations on the available snapshot, not a claim that the missing
later work was recovered.

## Implemented changes

- **Tidal geology:** 37 instances of the original rock scans in six headland
  clusters. Uniform scaling preserves scan shape; an actual terrain-sampled
  vertex quantile buries each scan in the seabed. The open-boundary source scan
  is excluded. Central beach and flight corridor remain clear. The same assembly
  feeds visible geometry and the worker's coastal collision/wave-shelter atlas.
- **Cloud lighting:** eight progressively wider sun-path segments account for
  distant clouds beyond the existing near samples. Primary view-ray density
  spacing stays unchanged. Sky geometry uses far depth and draws after opaque
  terrain so hidden sky fragments can fail the depth test.
- **Sand:** world-position derivatives determine whether the material's grains
  are resolved. Distant grain colour and normal strength fade toward mean sand
  response; resolved foreground detail remains present.
- **Image storage:** per-load embedded-image pooling uses full encoded-byte
  equality after a hash lookup. Texture objects retain their own transforms,
  colour space and sampling. Derived alpha-filtered foliage images also share
  pixel storage and avoid repeated canvas readback. The original alpha bytes and
  source pixels remain unchanged. Ocean surface variants now share live shader
  uniforms without cloning render-target textures.
- **Terrain queries:** exact float32 grid heights are memoized in about 1.84 MiB;
  barycentric interpolation and outside-grid behavior remain unchanged.
- **Runtime/capture:** nonfinite input rejection/clamping, final 20-second frame,
  replay/seek state, keyboard focus handling, paused free-look reset, background
  pause, isolated audio failure, fullscreen rejection handling, capture dimension
  and overlap guards, and exact size/DPR/aspect restoration. Capture takes
  precedence over inspect overlays. Keyboard focus keeps controls visible.
- **Reproducibility:** repaired native diagnostic harness terrain/atlas/foliage
  integration, portable root resolution, independent offshore checker, current
  evidence, asset restoration instructions and generated-file ignores.

## Verification and measured limits

`gates/continuation.md` records the exact automated oracles and their results.
The current source passes 22 tests, all 38 asset checks, full CPU world assembly,
TypeScript compilation and the Vite production build. The compiled worker's
16,777,216-byte coastal field equals the main-thread field exactly.

The independent offshore check visits every transformed scan vertex and 1,201
flight samples plus every evaluation camera. Minimum measured route/camera
clearance is **33.02 m**; every instance penetrates actual terrain and protrudes
above it. The new rocks produce 271 blocking atlas samples, 206 submerged samples
and 8,387 lee samples outside rock interiors. Removing all geometry removes the
collision and lee contribution. See `artifacts/continuation/offshore-check.json`.

Native comparisons use the actual source modules through ANGLE/Mesa llvmpipe,
960×540, four-sample offscreen MSAA and Three.js OutputPass. No shader errors or
GL errors occurred in the completed comparison batches. This is software/native
diagnosis, not browser validation, consumer FPS, VRAM profiling or final media.
Actual source hashes accompany each image.

Across identical three-view batches, renderer texture allocations dropped from
94 to 76 (**18 fewer; about 19%**) while 20 duplicate embedded images shared
storage. This combined change includes foliage pooling and ocean-uniform reuse;
it is not an isolated benchmark of either. Decoding still occurs for each GLTF
load. Rock geometry adds five batches and about 1.18 million counted triangles
across the recorded render passes. No consumer performance target is claimed.

| View | Before calls / triangles | After calls / triangles |
|---|---:|---:|
| Headland | 965 / 37,679,840 | 980 / 38,859,776 |
| Wet sand | 903 / 40,387,017 | 918 / 41,566,953 |
| Mountain wide | 1,016 / 22,079,029 | 1,031 / 23,258,965 |

These are renderer counters over the harness passes, not unique scene triangles.

## Visual review

Matched views were inspected individually at full output size. The sand change
reduces unresolved repetition on the middle-distance exposed shore while keeping
foreground bottom texture. Additional cloud occlusion darkens connected cloud
bodies; it does not repair their still overly sculpted silhouette. Grounding and
wave coupling have independent geometry evidence. These are local improvements,
not overall artistic acceptance.

| View | Before | After |
|---|---|---|
| Wet sand | [PNG](../../artifacts/continuation/before/wet-sand-mode-0-960.png) | [PNG](../../artifacts/continuation/after/wet-sand-mode-0-960.png) |
| Mountain wide | [PNG](../../artifacts/continuation/before/mountain-wide-mode-0-960.png) | [PNG](../../artifacts/continuation/after/mountain-wide-mode-0-960.png) |
| Headland | [PNG](../../artifacts/continuation/before/headland-mode-0-960.png) | [PNG](../../artifacts/continuation/after/headland-mode-0-960.png) |

The `after` batch precedes the far-depth sky optimization; per-frame hashes
identify that exact source. The separate `final-diagnostics` batch tests the
final render source and adds an explicitly labelled offshore diagnostic camera.
That extra camera is not one of the sixteen required final evaluation cameras.

The final wet-sand and mountain-wide images are **pixel-identical** to the
preceding after images despite the sky draw/depth change. All final world,
render and camera source hashes match the checked-in modules, with zero
shader/GL errors; see `artifacts/continuation/final-source-comparison.json`.
The [offshore close view](../../artifacts/continuation/final-diagnostics/offshore-west-mode-0-960.png)
shows the new scans intersecting the water, with submerged surfaces and foam
around emergent rock. Existing block-like shoreline slabs and sparse foreground
ground cover are still visible and need further art work.

Remaining visible failures: pale, repeated cliff faces with insufficient connected
geological structure; homogeneous distant canopy; sparse/noisy leaf silhouettes;
sculpted cloud shapes; regular surf and overly metallic low-angle water. No
reference-quality score or final approval is assigned.

## Browser and completion blockers

The managed source preview shows only the expected unavailable-graphics error:
`GL_VENDOR = Disabled`, `GL_RENDERER = Disabled`, `BindToCurrentSequence failed`.
Both renderer configurations fail before asset loading. The built preview URL
attempt is blocked by the browser client. See
`artifacts/continuation/browser-check.json`. Therefore playback/capture changes
are code- and unit-checked but remain unverified in a working browser scene.

Still required under the original contract:

1. Restore access to the existing Site and compare its newer source, without
   replacing the registered project.
2. Complete connected cliffs, distant forest, cloud form, shoreline and water
   refinement against the real references in a working production browser.
3. Complete eight genuine accepted browser refinement cycles and 86,400 verified
   active seconds; recorded history is preserved, no synthetic time/cycles added.
4. Verify the whole route, controls, capture, offline use, fallback, mobile and
   consumer GPU behavior; resolve P0/P1 review findings.
5. Produce and inspect sixteen UI-free 3840×2160 stills, the 1,200-frame 1440p60
   master and 1080p60 copy, manifests, metrics and complete final reviews.
6. Pass the unchanged final checker, then complete final main acceptance and
   publication of the existing Site. No public deployment is claimed here.

`node scripts/control/final-check.mjs` must continue to report
`LAST_LIGHT_BAY_INCOMPLETE` while these obligations remain unmet. The continuation
is preserved as reviewable source and evidence; it must not be labelled finished.
