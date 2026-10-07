# Gates: shore and water refinement, 2026-10-02

Scope: connected runup, sand moisture, surface-film roughness and swash/foam/reflection, preserving accepted sampling and depth fixes. Driver owns builds, GPU captures and canonical appearance defaults.

- [x] G1: Inspect matching actual GPU baseline shore views before selecting a candidate.
  EVIDENCE: Inspected current-chat outputs/baseline-02/flight-6.000.png and flight-10.500.png, 1280x720, capture complete with zero reported errors. Both show a smooth constant-width wet arc; 6 s also shows repeated sand-source tiling. Driver authorized bounded shared-front/sand/ocean changes after inspection.

- [ ] G2: The retained candidate preserves bounded deterministic wetting, earlier exposed-film drainage, exact runup velocity and existing wave-normal/reflection filtering.
  CHECK: node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs --test src/world/coastal.test.ts src/render/sand-film.test.ts src/world/ground-arm.test.ts src/render/coastal-reflection-filter.test.ts
  EXPECT: fail 0
  EVIDENCE: All 12 focused checks pass after candidate 2. Added ARM shader check proves sand albedo/normal/array ARM use identical source-phase weights and UV gradients; the packed ground still fits 15 samplers. Existing runup/depth/film/reflection checks remain passing.

- [ ] G3: Driver compares actual matching GPU PNGs and accepts a meaningful reduction in the broad glossy ribbon without disconnected foam, reflection seams or lost beach grain.
  EVIDENCE: Candidate 1 shore-01 viewed at 6, 10.5 and 12 s. Driver rejected its angular sheet-like 10.5 s front; nonuniform wet-band width helps but foam remains visually disconnected and sand source tiles remain conspicuous. Second pass authorized, acceptance pending.

- [ ] G4: A final independent source reread finds no unresolved correctness defect and the owned diff has no whitespace errors.
  CHECK: git diff --check -- src/world/coastal.ts src/world/ocean.ts src/render/sand-film.ts src/render/sand-film.test.ts src/render/ground-materials.ts gates/refinement-2026-10-02-shore.md
  EXPECT: /^$/
  EVIDENCE: Independent shore_check candidate-2 reread found no blocking defect: all sand channels share exact phase weights/gradients; bubbles now survive thin water with separate continuous support, zero at front and one offshore. Fixed contact envelope, FD normals, reflection footprint and foam depth gate stay aligned. Owned git diff --check passes. Original filtered ripple function and all 64 spectrum calls remain untouched; candidate-1 fixture comparison passed after CRLF normalization.

## Baseline source diagnosis

The existing 18-second dampness history also drives exposed sand toward roughness 0.20 because `sandFilmDrying` defaults to zero. The separate swash surface follows sand at a constant 28 mm height, and wind-normal energy becomes exactly zero at shore distance 4 m. Thus even a broad freshly covered strip can become a smooth mirror before its 0.55 m coverage transition. CPU wetting history, fragment-only edge fingers and wash/foam do not currently share one front field.

## Ownership

Only this leaf changes `sand-film.ts`, sand-only material expressions and `ocean.ts`. Coordinate `coastal.ts` changes with the driver first. Texture declarations, sampler bindings and sampling infrastructure are owned by the runtime leaf. No builds, GPU captures, commits or pushes run from this leaf.

## Candidate 1

Shared runup amplitude now includes bounded .68–1 alongshore attenuation at scales resolved by the 2 m mesh; global tide bounds and the existing wave phase remain unchanged. CPU moisture, short film history and GLSL swash all use that front. The fragment-only random fringe is removed. A 0–75 mm connected swash wedge thins at the front and during retreat; mesh clearance remains separate at 12 mm. The wedge controls water displacement, retained shallow capillary slopes, wash foam and optical front coverage. Existing fixed contact-transition coordinates are retained, avoiding the previously rejected moving-contact crease. Wind spectrum, unresolved variance, reflection footprint and foam depth gates remain intact.

`sandFilmDrying=1` selects the existing 1.5 s drainage history and a granular exposed-film roughness of .30; driver owns the profile/canonical switch. At zero, original .20 roughness behavior remains available. Dry sand albedo, source normal, ARM channels and all sampler infrastructure are unchanged by this leaf. No arbitrary albedo dimming was used to hide the sand tile repetition.

Visual review must reject any new nearshore ridge or excessive glint broadening: maximum sheet elevation is 87 mm including raster clearance versus the prior 28 mm, and the depth-supported slope scales the existing spectrum. Source is frozen for driver capture.

## Candidate 2: projected front, persistent bubbles and source phases

The candidate-1 contact sheet and 6/10.5/12 s GPU images show continuous motion but lateral pointed tongues at grazing views. A reproducible CPU proof in current-chat `work/shore-mesh-proof.mjs` and `.json` samples 144,711 positions on the actual terrain/water triangles; no intersections occur. The projected analytic half-coverage contour matches the visible tips, while replacing mesh-interpolated height by exact height moves the contour by at most 0.0103 horizontal pixels. The defect is the short authored runup patches, not too few triangles.

Broadening the shared runup patches reduces visible projected horizontal extrema from six to one at 10.5 s. The remaining extremum is at approximately (1088.178, 567.038). An additional 732,111 samples near runup peaks also find no terrain intersections with the original contact envelope, so a speculative additional clearance change was reverted. No mesh subdivision was added.

Foam had been mixed into water before optical film coverage. This multiplied bubbles by the vanishing sheet coverage exactly at contact. Foam now composites after the ground/water blend with its own 0.08 m continuous front support; leading lace is connected without changing offshore crest/depth gates. The same existing source-phase lattice now samples sand albedo, normal and array ARM with the original source UV gradients. This removes coherent two-metre repetition without suppressing grain or changing source assets, adding six texture reads across the three channels and no sampler bindings. Candidate 2 awaits matching GPU still/motion review.

## Candidate 3 review in progress

Actual pass-02 GPU views accept the smoother 10.5 s shoreline. Leading foam is now visible but reads as segmented pale bars. The strong 6 s sand checker remains after changing all texture-source phases, falsifying the earlier claim that source tiling alone explains the grid. Further diagnosis must isolate geometric normals, vertex color, procedural detail and shadows before changing terrain or masking the result. No sand-grid acceptance is claimed.
