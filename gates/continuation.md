# Gates: recovered coast continuation

Scope: recover the available source, improve the coastal scene and runtime, and verify improvements without changing the original final acceptance contract.

- [x] C1: Source, assets, geometry and production compilation pass.
  CHECK: npm run verify:build
  EXPECT: built in
  EVIDENCE: automatic-evidence=v1; definition-sha256=21c14aff1fde20ea4b20eb932bbe435d30c4c3e7a1594d62ee4585c7c9ce3e6d; exit=0; EXPECT=matched; output-sha256=6914e79b094066fff842438fccb3f91cfd8ad35bf8d98a2aa659e831a0121e22; output-bytes=5251; shell=/bin/sh; cwd=/workspace/scratch/370812df87f3/dronebeachshot; path=0e215f92adb6/13 entries
- [x] C2: The production worker transfers the same coastal field as the visible rock assembly.
  CHECK: node scripts/control/check-worker.mjs
  EXPECT: WORKER_CPU_PASS
  EVIDENCE: automatic-evidence=v1; definition-sha256=68bb0d7b75151bf51e64a0786334592feeea8665334352b601fc26d0a07465bc; exit=0; EXPECT=matched; output-sha256=f7b6fbb5c401b297722ecde6aa704fd57b3988f67ac78cd5ee0a8d300077f607; output-bytes=83; shell=/bin/sh; cwd=/workspace/scratch/370812df87f3/dronebeachshot; path=0e215f92adb6/13 entries
- [x] C3: Offshore rocks are grounded, fit the flight corridor and contribute real geometry to wave shelter.
  CHECK: node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-offshore.mjs
  EXPECT: OFFSHORE_CHECK_PASS
  EVIDENCE: automatic-evidence=v1; definition-sha256=d5d481e480f51af7352b43436af671d98bbabadca7889a4600844e42ad5fc31a; exit=0; EXPECT=matched; output-sha256=d096f56faa6c76eeff9a630621c97822c5dad188229f4c72283d7c7e4a9180f5; output-bytes=760; shell=/bin/sh; cwd=/workspace/scratch/370812df87f3/dronebeachshot; path=0e215f92adb6/13 entries
- [ ] C4: Playback, scrubbing, capture and unavailable-graphics behavior are checked in the production browser.
  EVIDENCE: pending
- [x] C5: Current full-scene images demonstrate accepted visual improvements.
  EVIDENCE: docs/continuation/REVIEW.md; matched full-scene before/after views individually inspected, sand minification and cloud occlusion retained; final-source hash check and two pixel-identical sky comparisons in artifacts/continuation/final-source-comparison.json; offshore close view confirms emergent/submerged scans. Native-only local improvement, not ROOT-WORLD or browser-cycle acceptance.
- [x] C6: Recovery limits and the exact implemented source are saved with honest remaining final gates.
  EVIDENCE: docs/continuation/REVIEW.md, handoff.md, source-hashed artifacts/continuation/final-diagnostics and unchanged GATES.md/final checker preserve missing newer source, unavailable browser, incomplete art/time/cycles/media and no publication claim.

ABANDON: C4 Managed browser has GL_VENDOR/GL_RENDERER Disabled and cannot create either context; production preview attempt is blocked by client. Evidence: artifacts/continuation/browser-check.json. Resume this gate in a permitted working production browser; unavailable-graphics UI alone does not satisfy it.
