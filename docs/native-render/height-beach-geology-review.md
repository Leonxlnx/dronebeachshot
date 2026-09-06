# Higher relief, beach materials and exposed geology — incomplete

The actual production Three.js modules now contain a425m main crest, an accompanying C2 camera-height curve, source-preserving near rock replacements, denser original Syringa foliage, a finer pale sand material, and one shared directional aerial-perspective model. This is measurable progress, not artistic acceptance.

## Accepted implementation changes

- The shared core height function is calibrated on the2m crest to425m. The highest crest is aligned with takeoff. The authored beach/seabed through25m inland is unchanged.
- The camera starts at451.522m. Its quintic correction has zero value and first two derivatives at12s, where it rejoins the authored shoreline/sea path. The1201-sample unculled-source-bound fit reports minimum terrain/tree/rock-box clearances5.095/3.2/21.448m. Its7201 derivative samples give64.950m/s maximum descent and27.950m/s² vertical acceleration. These are sampled bounds. This is still an aggressive flight, and the late arrival at beach height needs cinematography refinement.
- Takeoff gaze has subsequently been raised toward the horizon. The four images in higher-fractured-coast precede that gaze change and the nonperiodic stone material change.
- Original closed Rock Moss Set01 scans replace46 of the former nearby primitive outcrops in the previous313m state; current425m selection is recorded in world-cpu-check.json. Visible GLB and image-free worker geometry build exactly matching coastal fields.
- Near Syringa retains every original leaf component and full source trunk, original source attribute values and image bytes. At identical native specimen framing it retains97.30%/97.11% of source coverage versus80.55%/78.51% previously. Near only was changed. Hero/medium and historical far-atlas derivations remain documented.
- Sand03 uses matching2K diffuse/normal/ARM at2m tile scale. Pale buff normalization preserves relative fine grain. Exposed wet sand owns the reflective water film; submerged sediment retains granular roughness, fixing the cyan line from excessive underwater sun reflection.
- Marble Cliff03 replaces the overly fine dark seaside material on continuous bedrock. Matching2K maps use5.7483m scale. The first full-scene render exposed obvious scan repetition; the current shader now uses matching smooth scan offsets and a neutral mineral tone on fresh faces. This later shader compiles but awaits actual native visual review.
- Grass is continuous curved ribbon geometry with tapered tips. The former double color multiplication is removed; grass and ferns now align their root plane to the actual rendered slope. Blade colors are restrained green. The latest root alignment is after the four-frame batch.
- Atmosphere and ocean now use the same scene-linear directional airlight function. It respects fog disabled for refraction, and applies before display tone mapping. Lower-hemisphere illumination and sky color were corrected separately. Cloud shape remains poor.

## Inspected real frames

All paths below are under artifacts/native-review. Images are native ANGLE/Mesa execution of the actual production modules, not browser/mobile/offline or consumer-performance evidence.

- scanned-rocks-spectrum: four1280px frames of genuine near rock integration and64-wave ocean normals.
- beach-color-grass: beach-transition, sand-detail, wet-sand and headland1280px frames. Root inspected every full image. Fine pale grain and underwater highlight correction are visible.
- unified-airlight: wet-sand960px completed with no GL/shader errors. The following mountain-wide frame was killed with exit137 during resource pressure. No completed mountain image or successful whole batch is claimed.
- higher-fractured-coast: headland and flight0/5/9 at960px. All four full frames inspected, process exit0. They show the increased relief but still severe art defects. Sidecars retain the exact imported source hashes, including changes made after earlier batches.

## Five damaging visible defects

1. Distant land still shows smooth isolated cones and bare flanks; the annulus redesign is a separate unaccepted study.
2. Main exposed slopes are steep but lack convincing continuous fractured cliff silhouettes. Broad source-scan transition bodies are still being tested.
3. Foliage appears granular and airy at these screen sizes. Near coverage restoration helps one family; it does not establish full forest or temporal acceptance.
4. Cloud banks still read as soft repeated vertical pillars. Lighting/color corrections do not solve their form.
5. Surf is too regular from altitude, and the flight descends too late for the intended long low beach pass. Full temporal verification remains open.

Current source/asset/unit/CPU-world/build and worker equality checks are recorded in adjacent logs. Native studies do not count as the eight final production-browser cycles. Browser WebGL remains unavailable. The24h requirement, all artistic gates, final16×4K gallery, master/web films, offline/mobile/performance validation and final main push/publication remain unmet. The final checker has not been weakened.
