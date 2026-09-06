# Baseline native visual review

Reviewed the actual 640×360 native production frames for `mountain-wide`, `flight-0`, `descent-reveal`, `wet-sand`, and `sunset-reflection` against uploaded references `01-1000064683.png` and `03-1000064676.png`. This is native ANGLE/software-renderer image evidence, **not browser QA, consumer performance evidence, or approval**. Limited resolution prevents a fine texture verdict; the major form, coverage, composition, and lighting failures are unambiguous.

## Overall finding

The baseline does not yet resemble the requested lush, sunlit coastal environment. It reads as a brown, sparsely vegetated procedural mountain scene under pale overcast light. The references derive their realism from a continuous forest crown surface interrupted by coherent pale cliff faces, repeated coves/headlands, warm directional sunlight, and legible shallow-water structure. Those large visual systems must be corrected before more small effects or texture detail will matter.

## Prioritized defects and concrete implementation targets

### 1. P0 — Restore substantial forest crowns and continuous forest coverage

**Visible defect:** In `mountain-wide`, green vegetation is chiefly a thin stippled layer on brown ground; exposed terrain and dark round rocks dominate every mountain. Individual substantial crowns are almost absent at the main mountain scale. `wet-sand` confirms lace-like, sparse foliage even nearby. This is far from the reference's overlapping broadleaf crown volumes and occasional taller palms.

**Root target:** Inspect `world/vegetation.ts`, `world/ecology.ts`, and `render/vegetation-material.ts` together. The render metadata reports 8,500 trees, so a placement-count increase alone is not an adequate diagnosis. First force one tree family/LOD at a known root into a close, plainly lit native view and verify its decoded alpha, actual crown dimensions, retained coverage, and source/medium/far silhouette. The material raises alphaTest to at least 0.4, enables alpha-to-coverage, and applies screen-space LOD discard; each is a concrete coverage check, not a proven culprit. Ensure distant crowns retain opaque volume rather than fragmented twigs. Then revise ecology's steep-slope rejection (`slope > 1.4` retains only 26%) and habitat density so soil-bearing ridges and valleys join into closed canopy. Reserve exposure for actual cliff faces. **Acceptance:** the same wide frame should show a connected crown surface with legible crown-size variation, not green noise on visible brown mountain skins.

### 2. P0 — Fix the flight composition and finite-world exposure

**Visible defect:** `mountain-wide` is dominated by one oversized, isolated triangular spire at center-right; the reference presents a diagonal sequence of vegetated headlands and coves with ocean/sunset at left. Worse, `flight-0` points outward so the mountains disappear entirely and two long beach strips end in abrupt straight-cut land edges. `descent-reveal` becomes almost all water, with a clipped sliver of headland. These frames cannot deliver the reference's mountain-to-cove reveal.

**Root target:** Rework the early `sampleCamera` target in `camera/cinematic.ts`: it follows the horizontal flight tangent, so at the elevated opening it looks out of the mountains toward empty ocean. Use authored forward-facing composition targets for the mountain/forest/cove phases while preserving the actual clearance-safe path. In `world/terrain.ts`, replace the detached, visibly polygonal continuation strips with terrain that overlaps and joins the primary coast, or place/extend the playable terrain so no tile boundary is visible from the authored flight. **Acceptance:** flight opening contains layered ridges and the cove; descent keeps a forested headland and beach as anchors; no rectangular terrain termination is exposed.

### 3. P1 — Replace boulder-studded cones with coherent coastal geology

**Visible defect:** The mountains look like pointed brown cones covered with separately pasted dark pebbles/boulders. The reference has asymmetrical connected crags, tall bright fractured rock faces, vegetated ledges, deep forest gullies, and boulder clusters mainly at cliff feet and the waterline. The current distant hills show broad planar facets and repeated simple profiles.

**Root target:** `world/math.ts` builds the main relief from the maximum of radial ridge mounds with a shared pointed shape. Replace or augment that structure with connected asymmetric ridge spines, sharper buttresses, incised valleys, and a few deliberately exposed major wall faces. In `world/terrain.ts:createRocks`, constrain large round rock instances to talus, shoreline clusters, and genuine outcrops; the current wide slope eligibility distributes them over entire mountain skins. In `render/ground-materials.ts`, make the pale rock material read on contiguous steep faces instead of leaving most of the mass as dark brown soil. **Acceptance:** mountains read as a few large geological forms at thumbnail size; round rock dots cease being their primary texture.

### 4. P1 — Recover an actual low-sun lighting composition

**Visible defect:** All frames are cream/gray overcast with weak directional separation. `sunset-reflection` has a heavy mottled cloud ceiling, no visible solar disk, and a faint cold-looking narrow reflection. `wet-sand` shows bright white water glare while land is murky. Neither establishes the reference's orange low sun, warm lit ridge edges, cool forest valleys, and broad gold ocean path.

**Root target:** Coordinate `world/clouds.ts`, `world/atmosphere.ts`, `render/sky-lighting.ts`, and `render/engine.ts`. Establish an intentional opening around the low sun and preserve its disk/halo in the visible sky and related water reflection; the current globally populated density field can cover the entire solar direction. Tune direct light, sky fill, cloud transmission, fog hue, and exposure from the same fixed native frame. Avoid globally raising exposure to solve dark land because water/sky already wash out. **Acceptance:** visible low sun and warm sky sector, directional warm ridge lighting, separated shaded valleys, and a gold water path that agrees with the sun's location.

### 5. P1 — Remove water artifacts and create a readable shallow-to-deep cove

**Visible defect:** `descent-reveal` shows high-frequency regular ripples that alias into repeated dotted diagonal patterns. Breakers form two nearly uniform, broad parallel white ribbons with black stippling. The cove is flat pale green-blue, without a clear submerged rock pattern or strong deep-water boundary. `wet-sand` adds a severe straight diagonal water-sheet edge in the left foreground, and large lens-like ripple patches. These are construction artifacts, not subtle differences from the reference.

**Root target:** In `world/ocean.ts`, resolve the hard coverage join between the near water grid and `swashGeometry`/surface mode masks at the visible diagonal. Verify shared triangle coverage and depth before tuning color. Filter `waterNormal` micro-waves and foam noise by projected pixel footprint rather than only eye distance so high-frequency waves do not form moiré. Break up crest width/strength alongshore and soften residual foam into irregular connected lace. Verify the transmitted coast/depth input then establish turquoise shallow water, darker blue offshore water, and visible submerged obstacles. **Acceptance:** no straight water edge, no regular stipple/moiré, irregular coastal foam, and a readable depth gradient around the cove.

## Scope and evidence limits

The reviewed metadata reports production source hashes, zero shader errors, and GL error 0. Those facts establish successful native execution, not visual correctness. The review identifies visible defects; suspected coverage, cloud, and swash causes need a small isolated render or source trace before changing multiple interacting systems. No checkout edits, browser actions, new workers, or approval were performed by this review.
