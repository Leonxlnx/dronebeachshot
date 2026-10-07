# Gates: lighting profile proposals

Scope: Read-only lighting/color review and three existing-control profile alternatives for a later matched render batch.

Follow-up scope: Review every lighting-02 matched image, select or revise the lighting recommendation, and record limits pending the next structural/atmosphere recheck.

- [x] G1: Inspect all nine supplied baseline images and identify recurring color/detail failures.
  EVIDENCE: Viewed baseline-02 flight-0.000/6.000/10.500/19.500 and baseline-extra flight-3.000/9.000/12.000/headland/mountain-wide at native 1280x720. Nine per-view findings recorded in work/lighting-proposals.json. Both manifests identify source 362b128cde592fb45eacf4beb74efc0eb15360376b4f3fae5fad69ab8d733247 and hardware AMD 780M.

- [x] G2: Trace canonical profile controls through direct/ambient lighting, atmosphere and final postprocessing; proposals use existing supported controls only.
  EVIDENCE: Read docs/canonical-look.md, profiles/last-light-bay.json, src/app/canonical-look.ts, main.ts lighting/render callers, atmosphere.ts, sky-lighting.ts, aerial-perspective.ts, ocean.ts radiance section, ground-materials.ts and linear-main-output.ts. Seven source-response notes identify key couplings: skyColor is hemi-only, fixed bayClearSky supplies visible sky/haze, and ocean reflection bypasses environmentIntensity.

- [x] G3: Deliver three compact explicit alternatives with baseline settings, per-view guidance and rejection criteria; preserve source/profile files.
  CHECK: node -e "const fs=require('fs'),assert=require('node:assert/strict');const p=JSON.parse(fs.readFileSync('work/lighting-proposals.json','utf8')),b=JSON.parse(fs.readFileSync(p.baselineProfile,'utf8'));assert.deepEqual(p.baselineLighting,b.lighting);assert.equal(p.alternatives.length,3);for(const a of p.alternatives){assert.ok(a.id&&a.rationale&&a.rejectIf);assert.deepEqual(Object.keys(a.controls),['lighting']);assert.deepEqual(Object.keys(a.controls.lighting).sort(),Object.keys(b.lighting).sort())}console.log('3 complete lighting alternatives')"
  EXPECT: 3 complete lighting alternatives
  EVIDENCE: 3 complete lighting alternatives

- [x] G4: Re-read the proposed settings against implementation and baseline, refine once, then run the gate checker.
  EVIDENCE: Node assert validation passed: 9 observations, 3 complete valid lighting alternatives, 12 valid matched candidate rows; canonical baseline matches. All control types/ranges and cloud pins checked through existing validateProfile/validateTimeline. Re-read caught and corrected the linear-output source line reference; final pass found no further change. Source/profile files were not edited by this leaf, no build or capture executed. Gate checker execution recorded below.

Scoped checker: `node E:/randomtesting/unlazy-repo/scripts/gate-check.mjs --timeout 60 gates/refinement-2026-10-02-lighting.md` returned `ALL MET (4 met)`.

Checker caveat: without `--timeout`, its file-argument filter discards the first positional argument. The first invocation therefore scanned the repository and ran the unmet ROOT-TIME check (reported in-progress) plus this leaf's G3. Its write path runs only on passing checks; only this leaf's G3 gate was changed. Explicit `--timeout 60` scopes the rerun correctly.

- [x] G5: Verify the 16-frame lighting-02 manifest, complete controls and matched source/cameras.
  CHECK: node --input-type=module -e "import fs from 'node:fs';import assert from 'node:assert/strict';import {inspectPng} from './scripts/control/capture-integrity.mjs';const p=JSON.parse(fs.readFileSync('work/lighting-proposals.json','utf8')),d=p.matchedReview.batch+'/',m=JSON.parse(fs.readFileSync(d+'manifest.json','utf8'));assert.equal(m.frames.length,16);assert.equal(m.captureSucceeded,true);assert.equal(m.graphics.backend,'hardware');assert.equal(m.errors.length,0);const variants={'lighting-control':p.baselineLighting,...Object.fromEntries(p.alternatives.map(a=>[a.id,a.controls.lighting]))};for(const [v,l] of Object.entries(variants)){const rows=m.frames.filter(f=>f.settings.label.startsWith(v+'-'));assert.equal(rows.length,4);assert.deepEqual(rows.map(f=>String(f.settings.view)).sort(),['headland','mountain-wide','10.5','19.5'].sort());for(const f of rows){assert.deepEqual(f.settings.lighting,l);assert.equal(f.stats.sourceIdentity,p.matchedReview.sourceIdentity);assert.equal(inspectPng(fs.readFileSync(d+f.view+'.png'),1280,720).sha256,f.sha256)}}console.log('PASS 16 matched actual PNGs, complete lighting controls and one hardware source')"
  EXPECT: PASS 16 matched actual PNGs, complete lighting controls and one hardware source
  EVIDENCE: Separate Node assertions passed for 16 hardware frames, one source, 4 views x 4 exact complete lighting profiles and no capture errors; inspectPng verified every PNG CRC, dimension and SHA-256 against the manifest. Source 71d2087249a88d7a165b87367f2b72af38a8ad164eac3ea381b16527d9bd2526, AMD Radeon 780M, native 1280x720.

- [x] G6: View all 16 exact PNGs and compare natural color, shadow detail, highlight grain and depth at all four cameras.
  EVIDENCE: Viewed all lighting-control/balanced-warm-cool/clear-dimensional/shadow-recovery-limit PNGs at headland, mountain-wide, 10.5 and 19.5 individually, not contact-sheet substitutes. Four per-view comparison records in work/lighting-proposals.json matchedReview.perView describe every frame. Shadow recovery retains warm rock grain and cooler green canopy; other candidates close down the backlit forest. Grey cloud ceiling and rounded pale geology remain independent scene limits.

- [x] G7: Record a preferred profile or explicit revision with frame-specific reasoning and remaining recheck limits.
  EVIDENCE: work/lighting-proposals.json matchedReview selects shadow-recovery-limit unchanged; parent accepted provisionally for the next frozen-source comparison. Five fixed-rectangle read-only Pillow measurements (sRGB decoded to linear Rec.709, after ACES; mixed scene ROIs) corroborate visual review. At 19.5 near-forest [30,332,310,428], mean luminance changes are balanced -12.26%, dimensional -25.58%, recovery +15.40%; recovery p90/p10 is 2.058 vs control 1.988. At 10.5 near-canopy [810,190,1080,320], recovery p10 rises .005522 to .006603 while mean changes -0.84%; clipped-pixel fraction is zero in all five ROIs, not a whole-image claim. Recheck same-source control and preferred light at four matched views plus 0/3/6/9/12 after atmosphere/geology changes; no camera-specific correction or source/profile edits proposed.
