# LAST LIGHT BAY — 24-Hour Three.js Environment Build

Work autonomously for an extended long-horizon run.

Build a complete, highly polished, realistic real-time Three.js coastal world called LAST LIGHT BAY.

The final result must include:

- a finished interactive Three.js world that runs from the production build
- a dense forested coastal mountain and crescent bay
- convincing terrain, trees, beach, ocean, breaking waves, sunset, wind and atmosphere
- one deterministic cinematic drone camera path through the world
- a final approximately 20-second professional drone video rendered from the real Three.js build
- professional still screenshots and visual-review evidence
- complete verification
- the final finished work committed and pushed to main

The experience must be true browser-rendered 3D. Do not use a prerendered background, panorama, matte painting, video plane or image sequence to fake the environment.

The visual target is not “good for a coding demo.” It should approach high-end real-time environment art and briefly look like offline CGI while remaining an interactive Three.js scene.

# Active Work Requirement

Spend at least 24 verified hours on actual:

- implementation
- environment construction
- asset integration
- material work
- shader work
- animation
- debugging
- profiling
- optimization
- visual inspection
- adversarial review
- defect correction
- cinematography refinement

Do not count:

- dependency installation
- downloads
- network waiting
- idle workers
- artificial delays
- sleeping
- unchanged repeated commands
- final frame capture
- video rendering
- video encoding
- uploading
- writing the final response

Video capture and encoding happen after the environment is finished and do not count toward the 24 hours.

Create WORKLOG.md, RUN_STATE.json and scripts/control/active-time.mjs at the beginning. Log UTC start/end times, category, exact work performed, affected files or systems, verification evidence and related gate IDs.

No interval may be backdated. Reject overlapping intervals and excluded categories. An interval longer than 45 minutes requires intermediate proof such as a meaningful diff, test, screenshot set, visual review or completed gate.

Completion requires at least 86,400 seconds of honestly verified implementation and review work. Never satisfy this with waiting or padding.

If the execution environment ends early, preserve the exact incomplete state and remaining gates. Do not report success.

# Unlazy Execution

Locate and fully read the latest available /unlazy skill before implementation.

Apply Unlazy v2 in orchestrated mode with approximately Tree 6 depth or an equivalent natural decomposition.

I explicitly authorize installation of Unlazy’s repository-local Stop hook when supported. Verify that the hook is active and document its removal command.

If hooks are unavailable, preserve the same enforcement with gate files and a runnable final checker. Do not pretend enforcement is active when it is not.

Before scene implementation create:

- ART_BIBLE.md
- PLAN.md
- RUNBOOK.md
- RUN_STATE.json
- WORKLOG.md
- CINEMATIC_TIMELINE.md
- GATES.md
- gates/ with leaf and branch gates
- scripts/control/active-time.mjs
- scripts/control/final-check.mjs

The control system must remain compact. It protects the art and engineering work; it must not become the main deliverable.

Create real work leaves for:

- current Three.js API research
- reference analysis and art direction
- runtime architecture
- asset sourcing and licensing
- terrain and coastline
- geology and rocks
- trees and canopy
- understory and forest floor
- beach and wet sand
- ocean surface
- breaking waves, foam, swash and backwash
- sky and sunset
- atmosphere and lighting
- wind animation
- drone camera
- interaction and loading
- LOD and performance
- deterministic screenshots
- deterministic video capture
- technical review
- hostile visual review
- final cleanup and verification

Each leaf and integration branch requires evidence. A checked box with pending, missing or irrelevant evidence remains incomplete.

Use at most 2–3 concurrent implementation workers. Give each worker narrow ownership and non-overlapping files or systems. The coordinating agent owns the final composition, lighting, camera, integration and approval.

Workers cannot approve their own work. The coordinating agent must rerun checks and inspect visual output.

Before saying that workers are still active, inspect the actual worker registry. After any resumed session, assume previous workers and shell processes are dead until proven otherwise. Recover through files and gates.

# Research and Art Direction

Research current official Three.js documentation before choosing renderer and material APIs. Pin an exact current version.

Inspect current official examples relevant to:

- ocean rendering
- sky and atmosphere
- WebGPU and WebGL2
- TSL or node materials
- shadows
- postprocessing
- instancing
- LOD
- compressed textures
- GLTF loading

Research real coastal references for:

- temperate forest structure
- tree silhouettes and spacing
- coastal mountain erosion
- headland geology
- beach sediment zones
- shallow-water color
- wave shoaling and breaking
- foam breakup
- swash and backwash
- wet-sand reflections
- low-sun exposure
- haze and aerial perspective
- real drone flight movement

Create a compact reference board and docs/REFERENCES.md. Use only legally reusable images in committed reference material.

Define one coherent fictional location: a remote temperate bay in late summer, with a forested mountain, asymmetric rocky headlands, mixed sand and pebbles, active surf and the sun setting over open water.

ART_BIBLE.md must define:

- climate and season
- geological character
- terrain scale
- tree and plant families
- beach composition
- ocean palette
- sun direction and height
- sky and haze colors
- exposure range
- saturation limits
- roughness ranges
- wind direction
- prohibited visual shortcuts
- camera language

Do not combine unrelated asset-pack styles.

# Technical Foundation

Use Vite, TypeScript and pinned Three.js.

Build a responsive production experience with:

- loading progress
- asset readiness
- shader warm-up
- error handling
- quality tiers
- adaptive DPR
- reduced-motion behavior
- keyboard and touch support
- clean cinematic mode

Research the renderer architecture instead of assuming stale APIs.

Prefer WebGPURenderer and TSL/node materials only if the current stable version supports the complete scene reliably. Test the WebGL2 fallback. If WebGLRenderer is more reliable for the required result, use it and document the evidence.

Use metres as world units.

Separate systems into maintainable modules:

- application lifecycle
- renderer and quality
- asset registry
- terrain
- vegetation
- beach
- ocean
- shoreline
- atmosphere
- lighting
- wind
- camera
- cinematic timeline
- interaction
- capture
- diagnostics

Do not place the whole world in one giant source file.

Use a deterministic seed for placement, environmental animation and capture.

# World Layout

Create a world approximately 500–900 metres across, with enough depth that the drone path never exposes a map edge.

Required composition:

- a forested coastal mountain or large hill
- a recognizable, asymmetric ridge
- a natural saddle or valley guiding the camera to the sea
- dense canopy close enough for a fast treetop flight
- several controlled openings through the trees
- a curved beach long enough for the final shoreline pass
- two unequal rocky headlands
- shallow water continuing naturally from the terrain
- distant open ocean
- a clear sunset direction
- foreground, middle-ground and background depth

Avoid:

- circular islands
- symmetric bays
- mountain-shaped noise cones
- perfectly smooth slopes
- straight coastlines
- visible world boundaries
- random rocks without geological structure
- terrain ending beneath the water

Terrain should show believable ridge formation, drainage, erosion, ledges, exposed rock, talus, soil accumulation, sediment and underwater continuation.

# Terrain and Materials

Use sufficient terrain geometry for both aerial and low views.

Combine:

- large-scale authored landforms
- erosion-informed medium detail
- local shoreline geometry
- small surface detail

Terrain materials must blend according to:

- slope
- height
- moisture
- canopy
- sediment
- water distance
- rock exposure
- recent wave reach

Use macro color breakup, detail normals, roughness variation, distortion-resistant mapping and appropriate decals or overlays.

Avoid stretched textures, huge flat-color regions, near-black ground, green procedural clay and smooth ramps disguised with normal maps.

Cliffs and rocks require:

- coherent geological families
- fractures and erosion
- embedded placement
- transition stones
- wetness near water
- moss only where appropriate
- correct material scale
- non-faceted hero silhouettes

# Forest

The opening flight crosses close above the canopy, so trees are a primary visual system.

Use a hybrid asset workflow:

- highest-quality trees near the camera
- optimized variants in the middle distance
- simplified meshes or impostors in the far distance
- procedural logic for distribution and variation, not as an excuse for primitive hero assets

Source only CC0, public-domain or clearly compatible permissive assets. CC-BY is acceptable only when attribution and redistribution are practical.

For every external asset record:

- name
- creator
- exact source page
- direct source when available
- license
- attribution
- download date
- modifications
- final path
- checksum

Create docs/ASSET_LICENSES.md and public/assets/manifest.json.

Use at least:

- 3 major tree families
- 3 meaningful variants per major family
- young and mature forms
- dead or damaged trees
- fallen wood
- shrubs
- ferns
- grasses
- moss
- seedlings
- litter
- roots
- twigs
- small rocks

Placement must respond to slope, exposure, soil depth, moisture, altitude, wind and canopy gaps.

Create ecological clusters and negative space instead of uniform random scatter.

Required tree quality:

- believable taper
- grounded roots
- correct bark scale
- varied lean and crown
- no identical rotations
- no obvious repeated branch layers
- no visible alpha-card rectangles
- stable foliage at distance
- restrained natural color variation
- no floating bases

Wind must contain several scales:

- slow canopy movement
- branch response
- quicker leaf motion
- gusts moving across regions
- stronger motion on exposed slopes
- calmer movement in sheltered areas

Trunks must not bend like rubber, and the entire forest must not share one sine wave.

# Beach

Build believable beach zones:

- dry upper sand
- compact transition sand
- dark wet sand
- active swash
- shallow submerged sand
- gravel and stones near headlands
- sparse coastal vegetation
- restrained driftwood and natural debris

Wetness must follow recent wave reach rather than a fixed dark stripe.

Add subtle ripple patterns, channels, sediment streaks, pebbles and foam residue.

The forest-to-beach transition must include changing soil, roots, grasses, exposed sand and increasing wind exposure.

# Ocean

The ocean is a hero system.

Do not use:

- a flat blue plane
- one scrolling normal map
- repeated identical sine waves
- uniform turquoise
- mirror reflections everywhere
- foam sliding independently of the water

Build a stable physically informed system using an appropriate combination of:

- directional Gerstner waves
- spectral or FFT-inspired displacement
- low-frequency swell
- mid-frequency wind waves
- high-frequency detail normals
- Fresnel
- sun glitter
- sky reflection
- depth absorption
- shallow-water coloration
- distance-based detail

Wave direction must match the bay. Open-ocean swell should reduce and redirect inside the protected bay.

Avoid obvious tiling and repeating peaks.

# Breaking Waves and Shoreline

Do not solve the shore with a static foam strip.

Implement a separate depth-aware shoreline system using shoreline masks, depth fields, signed-distance fields, flow maps or another reliable solution.

Required visible behavior:

- waves steepen in shallow water
- crests brighten before breaking
- breakers travel toward shore
- foam forms from wave or depth conditions
- foam stretches and fragments
- swash advances over sand
- backwash retreats
- residual foam fades
- wet sand updates
- waves respond near rocks
- water color changes with depth

The simulation may be an optimized artistic approximation, but it must behave coherently from aerial, side and water-level views.

Use spray sparingly at real impacts. Do not fill the frame with white particles.

# Sunset and Atmosphere

Create one consistent sun direction shared by:

- direct light
- shadows
- visible sun disk
- ocean reflection
- wet-sand reflection
- cloud illumination
- atmospheric scattering

The final section of the camera path must align the low sun over the ocean.

Use:

- warm low-angle direct light
- cooler sky fill
- readable shaded forest
- horizon aerosol scattering
- aerial perspective
- layered haze
- restrained grading
- exposure adaptation between forest and beach

Clouds require varied scale, directional structure, believable shadowed volume and illuminated edges where physically justified.

Avoid:

- flat panorama skies
- obvious cloud billboards
- pure orange grading
- magenta/cyan styling
- clipped white sun
- black forest silhouettes hiding missing detail
- uniform fog walls
- exaggerated god rays
- bloom masking poor materials

Provide debug views for albedo, normals, roughness, depth, direct light, environment light, shadows, LOD, vegetation density, shoreline depth, foam generation and exposure.

# Drone Cinematic

Create one continuous, uncut, deterministic camera flight lasting approximately 20 seconds.

The shot must feel like a professionally piloted FPV/drone movement rather than mouse controls or a debug fly camera.

## 0–5 seconds: Fast canopy flight

- begin above or just behind the forested ridge
- immediately establish mountain, dense trees and a distant glimpse of ocean
- accelerate into a fast pass roughly 3–8 metres above nearby treetops
- create strong near-field parallax
- maintain safe clearance
- show convincing canopy detail and wind

## 5–9 seconds: Descent and reveal

- enter a natural saddle or opening
- descend smoothly toward the bay
- progressively reveal beach, headland and ocean
- anticipate the coastline turn
- do not teleport, clip trees or hide transitions behind fog

## 9–15 seconds: Low beach and wave pass

- arrive 2–5 metres above beach or shallow water
- reduce speed with believable inertia
- turn parallel to the shoreline
- pass foreground stones, driftwood or vegetation for scale
- show breaking waves, foam, swash, backwash and wet-sand reflections
- allow waves to move close beneath or beside the camera

## 15–20 seconds: Sunset alignment

- flatten the trajectory
- slow into a clean shoreline glide
- rotate naturally toward the sunset
- align the sun reflection across ocean and wet sand
- finish with waves in the foreground, curved bay, forested mountain, headland and layered sky
- hold the final composition long enough to read without stopping abruptly

Camera implementation requires:

- a stable centripetal or equivalent spline
- arc-length-aware speed
- separate position and look-target curves
- quaternion smoothing
- acceleration and braking
- look-ahead behavior
- terrain and tree clearance
- stable horizon
- restrained banking
- no sudden roll
- no camera collision
- no geometry clipping
- no mouse jitter
- no extreme FOV
- approximately 24–40mm full-frame-equivalent lens language
- properly selected near and far planes

Create CINEMATIC_TIMELINE.md containing exact timing, phase boundaries, coordinates, speeds, altitudes, look targets, focal choices, scene state and intended reveal.

Add a developer mode showing the camera path, samples, speed, look direction and clearance. Disable it in final mode.

# Interaction

Provide:

- Start cinematic
- pause and resume
- replay
- mute
- fullscreen
- quality selection
- optional timeline scrubber
- optional free-look after the film
- reduced-motion behavior

The interface must disappear during playback.

Avoid a generic game HUD, giant glass panels or UI covering the environment.

# Sound

Use only original, CC0 or clearly licensed audio.

Use restrained layers of:

- forest wind
- canopy movement
- distant ocean
- closer waves during descent
- detailed shoreline sound at beach level

Do not use unlicensed commercial music, vocals or trailer impacts.

The final mix must not clip and must have no obvious loop seams.

If suitable licensed audio cannot be sourced, use silence rather than questionable material.

# Performance

Implement cinematic/high, balanced and fallback tiers.

Use:

- instancing
- geometry reuse
- frustum and distance culling
- LOD
- simplified far trees
- shadow-distance control
- texture-size discipline
- compressed GLB where reliable
- KTX2 or another stable optimized texture path where reliable
- preloading
- shader warm-up
- adaptive DPR

Track:

- total production payload
- texture and material counts
- draw calls
- visible triangles
- tree instances
- ground-cover instances
- shadow casters
- shader programs
- loading time
- renderer.info at key camera moments

Do not use software-rendered cloud FPS as proof of consumer hardware performance.

Vendor every production asset. The final build must work after network access is disabled.

# Screenshot Evidence

Create deterministic evaluation cameras for:

- mountain wide
- canopy high
- canopy close
- forest opening
- descent reveal
- beach transition
- sand detail
- wet sand
- low wave
- breaking wave side
- shallow water
- headland
- sunset reflection
- shoreline flight
- final wide
- mobile proof

Final output requires at least 16 genuinely different UI-free 4K screenshots, not tiny variations of one camera.

Store baseline, cycle evidence, final gallery, diagnostics, contact sheets and video artifacts in an organized artifacts directory.

Generate:

- gallery manifest
- checksums
- before/after contact sheet
- final contact sheet
- objective frame metrics
- reviewer notes

Measure luminance, black percentage, clipped highlights, saturation, dimensions, detail density and duplicate images. These diagnostics detect failure but do not prove artistic quality.

# Mandatory Refinement Cycles

The first functional render is only the baseline.

Perform at least eight genuine post-baseline cycles:

1. world composition, mountain scale, bay shape and camera blocking
2. terrain, erosion, geology and rock grounding
3. trees, canopy, forest floor, ecology and wind
4. sand zones, shore materials, debris and wetness
5. ocean waves, breakers, foam, swash and backwash
6. sunset, clouds, atmosphere, exposure and color
7. drone path, speed, clearance, LOD transitions and cinematography
8. performance, loading, fallback and hostile final review

Every cycle must:

1. run verification
2. launch the current production build
3. capture the same evaluation cameras
4. inspect every frame at full resolution
5. inspect important 100% crops
6. compare against the references and art bible
7. rank the five most damaging defects
8. make material fixes
9. recapture
10. document before/after evidence
11. rerun relevant tests
12. update gates and active-time records

A cycle does not count if it only changes documentation, renames files, captures unchanged frames, adjusts one trivial value or produces review text without fixes.

Run additional cycles while major failures remain.

# Hostile Visual Review

Use fresh review context where available.

Judge actual screenshots and timeline samples for:

- overall realism
- terrain
- geology
- forest density
- tree quality and variation
- forest floor
- beach
- ocean
- waves
- foam
- swash and backwash
- water reflections
- wet sand
- sunset
- clouds
- atmosphere
- lighting
- material coherence
- scale
- wind
- camera motion
- cinematic impact
- performance
- fallback

Every score must cite visible evidence and a file path.

The coordinating agent must verify reviewer claims.

Target average: at least 8/10, with no major category below 7/10.

Never fabricate or inflate scores.

# Automatic Failure Conditions

The final result fails if it contains:

- low-poly hero trees or rocks
- primitive placeholder geometry
- obviously repeated trees
- floating vegetation
- visible foliage-card rectangles
- rubber tree motion
- uniform ecology scatter
- empty or black forest floor
- smooth noise-cone mountain
- flat blue ocean
- repeated sine-wave water
- scrolling foam disconnected from waves
- static white shoreline strip
- no swash or backwash
- mirror water everywhere
- straight coastline
- visible world boundary
- stretched cliff textures
- black foreground hiding detail
- clipped sun or sky
- global orange filter
- flat cloud panorama
- contradictory sun and reflection directions
- camera clipping
- violent banking
- sudden speed changes
- camera jitter
- LOD popping
- shader compilation stutter
- asset pop-in
- screenshots hiding close detail
- only one acceptable view
- runtime hotlinks
- missing asset licenses
- meaningful console errors
- broken production build
- false performance numbers
- false active-time claims
- fewer than eight evidenced cycles

# Deterministic Video Capture

Only begin the final recording after the environment, camera path and visual gates pass.

Rendering and encoding do not count toward active development time.

Do not use an operating-system screen recorder.

Create a deterministic capture mode in the production build. Expose a stable capture API that:

- waits for all assets
- waits for shader compilation
- selects the deterministic seed
- sets exact timeline time
- advances at a fixed timestep
- forces final quality
- hides UI and debug overlays
- reports readiness

Capture the approximately 20-second continuous flight from the actual production Three.js build.

Use Playwright or an equivalent reliable browser harness and stream frames into FFmpeg where practical. Do not commit thousands of temporary frames.

Produce:

- artifacts/final-video/last-light-bay-1440p60.mp4
- 2560×1440
- 60 fps
- approximately 20 seconds
- H.264 High profile
- yuv420p
- CRF approximately 17–20 or visually equivalent encode
- faststart
- licensed ambience or silence
- no cursor
- no UI
- no debug overlays
- no loading frames
- no dropped or duplicated frames

Also create:

- a 1920×1080 60 fps web copy
- a 4K poster frame
- timeline manifest
- FFprobe JSON
- encoding command record
- 12-frame video contact sheet
- checksums
- file-size report

Verify resolution, frame rate, duration, codec, pixel format, frame count, audio and file size.

Watch and inspect the full video.

Detect:

- black frames
- frozen frames
- duplicates
- missing frames
- camera jumps
- clipping
- pop-in
- temporal shimmer
- shadow flicker
- foam discontinuity
- exposure jumps
- encoding corruption

If recording reveals a scene defect, return to implementation, fix it, rerun verification and capture again.

# Verification

Create npm run verify covering:

- TypeScript
- lint
- unit tests
- production build
- asset manifest
- asset licenses
- required files
- deterministic seed
- required cameras
- screenshot harness
- capture readiness
- offline production build
- gates
- active-time validation
- final artifacts

Launch and inspect the production build.

Require:

- no meaningful console errors
- no failed network requests
- no missing assets
- no broken shaders
- no NaN transforms
- no invalid paths
- no uncaught promise failures
- no camera collision
- no broken mobile controls

Run a final technical review covering memory, disposal, duplicated resources, texture color spaces, overdraw, foliage alpha cost, shadows, LOD, culling, ocean stability, shoreline masks, deterministic animation, fallback and capture reliability.

Fix all P0 and P1 findings.

# Completion

scripts/control/final-check.mjs may print:

    LAST_LIGHT_BAY_COMPLETE

only when:

- at least 86,400 seconds of eligible active work are verified
- all leaf and integration gates contain real evidence
- at least eight genuine visual cycles are complete
- npm run verify passes
- production and offline builds pass
- no P0 or P1 issue remains
- no automatic visual failure remains
- all required screenshots and contact sheets exist
- the approximately 20-second master video exists and passes validation
- the web video copy exists
- the entire master video was inspected
- assets and licenses are complete
- performance data was re-measured
- final reviewer evidence exists
- no unfinished TODO or placeholder remains

If anything is missing, exit nonzero and list it.

Do not weaken or edit the checker merely to pass an incomplete result.

# Commit to Main

When and only when every completion condition passes:

1. inspect git status and preserve any legitimate existing work
2. ensure the finished complete implementation is on main
3. run npm run verify from main
4. run the active-time checker from main
5. run the gate checker from main
6. run scripts/control/final-check.mjs from main
7. confirm the final screenshots and videos correspond to that exact tree
8. commit all required source, optimized assets, documentation, evidence and final media
9. do not commit temporary render frames, caches, node_modules or build output
10. create one clear final commit
11. push main to origin
12. confirm local main and origin/main reference the same final commit

Do not force-push. Do not discard unrelated existing user work.

# Final Response

Return:

- completion status
- final main commit SHA
- confirmation that origin/main matches
- verified active implementation/review time
- gate count
- verification output
- final-check output
- renderer and fallback choice
- world dimensions
- asset and license summary
- production payload
- draw calls and visible triangles at key moments
- screenshot and contact-sheet paths
- 1440p60 video path
- 1080p60 video path
- FFprobe summary
- refinement-cycle summary
- hostile-review results
- honest remaining limitations

Embed or link the final gallery and videos where supported.

Do not stop because the first scene works, the ocean moves, the screenshots look colorful, the cycle folders exist, the recording encoded, or the result improved from an earlier version.

The final deliverable is a finished realistic Three.js coastal world plus a validated approximately 20-second continuous drone film, with the complete final state committed and pushed to main.
