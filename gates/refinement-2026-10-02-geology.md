# Gates: 2026-10-02 geology refinement

Scope: Make the existing broad cliff masses read as connected geological faces through bounded authoritative terrain geometry; preserve summit, shore, route and grounded scene support.

- [x] G1: Read the full central and continuation terrain flow, callers and rejected face history before selecting the change.
  EVIDENCE: Read terrain.ts, math.ts, terrain-fractures.ts, terrain-surface.ts, ecology.ts, rock-local-refit.ts, detailed-rocks.ts, inland-outcrops.ts, principal-face-planes.ts, broad-recess-planes.ts, cinematic.ts and check-terrain-fractures.mjs. New cuts must follow the stable reference-height stage so existing roots and rock refits share the live surface without regenerating identities.

- [x] G2: Inspect actual baseline GPU geology frames and receive the driver's source-mutation authorization.
  EVIDENCE: Inspected outputs/baseline-02/flight-0.000.png, flight-6.000.png and flight-10.500.png. Camera-to-terrain probes identify the exposed 10.5-second sheet at eastern X214..315/Z-15..121, rather than the old western principal-face study. Driver authorized geology source edits after baseline-02 completed on 2026-10-02.

- [x] G3: Implement resolved geological structure in the authoritative surface, with exact protection outside bounded regions and no additive overlay or material-only disguise.
  EVIDENCE: Third pass replaces the narrow new joints and transverse benches with a 21-triangle western face target and two eastern pairs of broad inclined planes. The western target retains an oblique buttress between unequal eroded banks. Eastern faces cover both the flight ramp and the previously missed negative-Z headland; both primary planes face their review camera. All changes remain after the stable cohort-selection stage. New Float32 removal reaches 80.522736 m west and 78.110970 m east; 2,666/4,651 vertices change respectively. Eight selected affine faces retain 1,302/400/512/250/144/165/108/50 actual vertices cut by more than 1 m. No material, camera, profile, additive mesh or dependency change.

- [x] G4: Independent frozen-baseline grid, route, shore, summit and root checks pass, including damaged-data negative controls.
  CHECK: node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-terrain-fractures.mjs
  EXPECT: TERRAIN_FRACTURE_CHECK_PASS
  EVIDENCE: TERRAIN_FRACTURE_CHECK_PASS on frozen pass03; 481,401 vertices, 140,000 actual tile triangles and 14,000 center-grounded roots before ecological omissions. Separate west 90 m/east 80 m budgets; nearest new changed vertex is 50.545461 m from shore. Summit 425 m, all 1,201 flight and 16 evaluation surface supports, and flight clearance 5.113556 m remain exact. Another 555 independently raycast samples prove exact protected shore triangle support. The check now requires broad normal changes: 1,990 western and 3,410 eastern vertices turn more than 15 degrees. Surface SHA256: f8abec285da00e1b0d1b7db035b49f4b2545d3c47835819d45c826dc9c01a94b. Eight damaged-data controls pass. Frozen source hashes still normalize CRLF to canonical Git LF without changing fixtures or expected fingerprints.

- [x] G5: Focused existing math, actual triangle contact, cinematic, stable reference cohorts and protected coastal atlas checks pass.
  CHECK: node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs --test src/world/math.test.ts src/world/terrain-surface.test.ts src/camera/cinematic.test.ts src/world/inland-outcrops.test.ts
  EXPECT: # fail 0
  EVIDENCE: Final frozen pass03 Node run passed 16/16, fail 0. Includes stable base-tree identity/order, supported inland scans, protected coastal G/B/A hash, actual triangle contact and camera contracts. Current atlas R and root centers follow the edited terrain.

- [ ] G6: Inspect matched actual GPU before/after frames and iterate on shape until the driver accepts meaningful improvement with coherent scene contact.
  EVIDENCE: Pending pass03 GPU review. Inspected all nine pass02 images; driver rejected thin etched cuts, nearly horizontal gashes and broad Gaussian sheets left intact. Pass03 addresses those findings with connected face normals. Before freezing, camera-side tests exposed invisible eastern return planes; the final coefficients make both faces front-facing, with sun-normal dots approximately 0.629/0.371 at headland and 0.849/0.408 at the flight ramp. This predicts contrast but does not prove GPU appearance. The independent western projection audit finds about 7,369 square metres of front-facing affine plan area, yet its dim return facets comprise only 3.56% of projected affine area. Wide-view mass and silhouette must therefore be judged from the capture; most broad faces remain sunlit. Prior pass02 basal-support IDs are obsolete and must not be applied to this geometry. Driver holds authoritative ecological omissions until geometry acceptance; current center grounding does not establish source-mesh basal support.

- [ ] G7: Complete an adversarial source/visual pass with no further justified change, record limitations and leave no accidental files or whitespace defects.
  EVIDENCE: Pending GPU/ecology acceptance. Independent review finds the western 21-triangle target exactly covers its 13,460 square metre footprint; 53,782 off-grid probes have zero holes/overlaps. Shared heights, unsigned perimeter distances, patch unions and shore/toe fades are continuous. Deep outer returns initially reached slopes around 8–9 m/m; selected 20–25 m edge transitions reduce the final eastern maximum mesh slopes to about 4.3 m/m while retaining broad affine faces. Grid oracle, 16 focused tests and scoped whitespace check pass. Actual screenshot quality and final basal support remain open.

## Shape analysis

The baseline central ridges use two Gaussian cross sections and Gaussian erosion channels. Their broad derivative transitions remain soft even where the texture is mineral. The existing non-Gaussian fracture is confined to the eastern headland. Previous principal-face planar cuts exposed a transverse lip/quarry return and remain disabled. Baseline ray probes corrected the initial western-region hypothesis: this pass divides the eastern coastal ramp down its fall line, varying bank scale/strike and retaining connected upper shoulders. It does not restore the rejected transverse shelf or add high-frequency noise.

Source ownership is terrain geometry only. Driver owns builds, capture, profile, materials and final visual acceptance. Edited: src/world/terrain-fractures.ts; src/world/math.ts; the explicit regional oracle in scripts/control/check-terrain-fractures.mjs. Third geometry source pass frozen for GPU review; G6 and G7 remain open. Center-grounded roots do not prove complete basal wood support on the new banks.

The later baseline-extra/mountain-wide.png confirms that the western principal face remains a separate large smooth mass. Camera rays map its central pale sheet at image750/360 to world(-112.9,184.1), image800/330 to(-147,189.5), image850/300 to(-175.1,199.1), and image860/140 to(-141.5,250.8). These ray probes motivated the implemented second-pass southeast-descending fracture through(-184,276),(-166,232),(-151,209),(-145,190),(-141,167), with an unequal short tributary. They identify its location but do not establish visual acceptance. Historical flat principal/broad-recess studies remain disabled.

The read-only western feasibility probe warned that P=304+.25(x+160)+.08(z-210) has multiple contour branches and an elevation-only16m cut would produce25–40m roofs. After driver authorization, the actual upper bench was confined to one branch with a narrow irregular polygon. The lower223m bench uses a separate unequal footprint and12m spall depth. Each returns through a short weathered scarp; max-union with the major joint interrupts the ledges instead of making continuous terrace stripes.


## Third-pass decision

The first two iterations changed depth mainly within channels, leaving almost every broad Gaussian normal intact. The third pass changes the actual target height over whole faces. It removes all new channel and bench operators from pass02, retains the original reference-stage eastern joint, and uses one connected western target plus two broad eastern targets. The western stations are staggered rather than sharing horizontal bench bands. Deep perimeter returns have independently tuned widths; there is no per-query depth clamp that restores the old curvature.

The new southern headland bounds are necessary: the headland center ray hits approximately X318.6/Z-18.5, outside the earlier Z>=2 patch. The shoreline guard moved to 50 m so triangles sampled through the protected 45 m strip stay exact. The final eastern plane directions were checked against the actual camera positions, because surface-normal counts alone can include hidden back faces.

Frozen production geometry SHA256: a4119cabf8b5119d483daacdde9d1bb554fde15ed3c7e7dac29ad5b39880e93d. Oracle SHA256: 16e7ce62907c1b07ac2aeeefc84f2a593a429166824d253ebc4baebaeb804324. No build or capture was performed by the geology agent.
