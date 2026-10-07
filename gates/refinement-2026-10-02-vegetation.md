# Gates: mixed-age coastal woodland

Scope: Preserve the mature forest and route while adding grounded mixed-source lower canopy and restrained species/stand color variation. Driver owns builds, captures and integration.

- [x] G1: Mature tree identities, ordering and downstream consumers remain unchanged; the previous 16 young sites remain represented.
  CHECK: node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-coastal-young-woodland.mjs
  EXPECT: COASTAL_YOUNG_WOODLAND_PASS
  EVIDENCE: COASTAL_YOUNG_WOODLAND_PASS; original 14,000-tree reference SHA-256 927ddf7d... retained, all live attributes/order match apart from Y following current terrain; first 16 young X identities and original groups 4/7/5 pass.

- [x] G2: Added woodland contains two existing broadleaf families, unequal clustered spacing and a useful young-height range; no model/atlas geometry changes.
  EVIDENCE: Pass02 artifacts/refinement-2026-10-02/vegetation/cpu-check.json records 95 young trees (4 Island, 91 Syringa), heights 2.3262-7.6639 m. The prior39 remain first; 56 smaller stems occupy eight separated elliptical outer-shelf pockets with 4-9 survivors each, not a coast-wide row. Existing geometry, alpha and atlas files are unchanged.

- [x] G3: All young-tree source geometry remains grounded across three geometric LODs and outside the dense 60 Hz flight polyline expanded by 2 m.
  EVIDENCE: Pass02 actual six GLB source/node/Float32 transforms pass all basal checks. Maximum upper basal gap 0.11269 m; maximum bottom gap -0.01785 m; burial remains less than 0.35 m. Nearest route-to-source-bounds distance 33.1231 m; all 1,200 route segments miss source bounds expanded 2 m.

- [x] G4: Core and distant species tint remain deterministic, restrained and consistent across source geometry and atlas LODs.
  EVIDENCE: Shared treeTint() is called by every core LOD and distant atlas instance. Checker validates 100 deterministic stand samples, finite bounded linear multipliers, stand variation and source-family separation. Palms retain their exact prior tint formula. No coverage/lighting shader changes.

- [ ] G5: Matched hardware captures improve lower-canopy depth and natural edge without floating trees, blocked route or conspicuous color discontinuity.
  EVIDENCE: pending

- [ ] G6: Final adversarial review and a complete polish pass leave no worthwhile correction within this leaf's scope.
  EVIDENCE: pending

- [x] G7: Geology edits cannot shuffle untouched grass, fern, log, litter, seedling or shrub/snags cohorts; changed sites are grounded or omitted after original selection.
  CHECK: node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-ground-cover-cohort.mjs && node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-forest-cohort.mjs
  EXPECT: FOREST_COHORT_PASS
  EVIDENCE: Independent pinned-e4f1388 source comparisons pass. Grass/fern geometry and original selection caps are exact; untouched instance matrices include regression logs52/65. Changed sites omit625 grass,53 ferns,4 logs; the2 retained changed logs pass twice-dense0.125m support sampling. Forest checker verifies5915 untouched litter/seedling/shrub/snags matrices exactly,56 changed retained instances, stable original selection counts, and removing a live tree omits its roots without reshuffling litter/seedlings.

## Baseline and trace

Inspected actual AMD Radeon 780M baseline-02 flight-0.000/6.000/10.500/19.500 PNGs in the current chat outputs. The shore view has an abrupt bare slope below repeated tall trunks; the opening forest is broadly uniform olive. Trace: main -> createVegetation -> immutable ecology base + render-only coastal young trees -> all LOD instance matrices/colors. The original base also seeds rock refits, roots/litter and shrubs/snags. Those consumers and their original identities stay unchanged. Existing leaf coverage, source normals, direct response and shadow paths remain intact.

Pass 01 GPU review: actual vegetation-01 0/3/6/9/10.5/12/19.5 and two evaluation cameras were supplied; 3/10.5/12 inspected for this leaf. The edge improvement is too modest for acceptance. The next pass adds a younger outer-woodland layer and stronger stand/species contrast, and trials existing coastalUnderstory. Geology also exposed shared-RNG drift: rejection on edited terrain moved untouched logs 52/65 into the 12-second lower-right frame. Selection must use reference terrain and apply current grounding/omission afterward in every affected groundcover consumer.

Understory toggle review: inspected all eight same-source OFF/ON GPU PNGs at9/10.5/12/14.7 in outputs/understory-01. ON adds modest low green interruption of the pale edge without a visible hedgerow, floating mass or composition regression;14.7 is effectively unchanged. Recommended ON to driver for canonical capture and ordinary-startup parity; this is not overall forest acceptance. Pass02 source remains pending matched GPU review.
