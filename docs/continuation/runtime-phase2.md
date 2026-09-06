# Retained runtime and deployment changes — source review

Independent read-only review against baseline
`462588e855fc4773868321c73d1f703690344c5b` found **no further concrete functional
regression in the reviewed changes**. This is a source review, not browser,
graphics, mobile, memory or final-production acceptance. No new test harness or
browser session was run for this review.

- **Capture restoration:** logical canvas size is restored before DPR, avoiding
  the earlier temporary enlargement of a 4K canvas. Aspect restoration follows.
  Deferred quality/resize requests are copied and cleared before application;
  the latest quality wins and also applies the current viewport, while a
  resize-only request uses the current tier. The same cleanup runs after PNG
  encoding rejection. The overlapping-capture guard remains intact.
- **Startup and background behavior:** failure of the initial asset-loading
  group cancels the coastal worker and rethrows the original error. Nonpersisted
  navigation still terminates the worker; BFCache suspension preserves the scene.
  Backgrounding stops playback and sound together and updates the sound control.
  Optional audio suspend/close rejections are contained locally.
- **Input lookup:** quality and evaluation-camera names use own-property checks,
  closing the inherited-property cases identified during the earlier review.
- **Asset restoration:** archive parts, the complete archive and extracted
  runtime entries are checked against their hashes before any restore writes.
  Edited existing files are preserved by failure; missing files use exclusive
  creation. The reviewed tests cover a fresh real-archive restore, every runtime
  file's hash, idempotence, preservation of edits, symlink refusal and malformed
  ZIP directories. This pass reviewed those tests without rerunning them.
- **Worker verification:** the checker obtains the worker name from the actual
  built HTML entry instead of directory ordering. It requires exactly one local
  worker reference, checks the transferred field dimensions and finite values,
  then compares its hash with the visible-world CPU result. The worker runner
  was also read to confirm which production asset fetch it supplies.

The complete browser scene and its lifecycle remain outside this
source-only finding. The project must retain its outstanding browser and final
acceptance gates; this review supplies no substitute for them.

Reviewed file fingerprints:

| File | SHA-256 |
| --- | --- |
| `src/main.ts` | `638ad15994ff352587992e575556dab568803ac6de668330d8bc3638a411cce0` |
| `src/app/audio.ts` | `4feee393f9a9159b3f417da93b8ab5fcae858bbe726279741bc9f94a26978bf5` |
| `recovery/restore-assets.mjs` | `2d6a638ceac470d17ad052c9a17fd6d2a458613183897d0a7e09c73d7fe49141` |
| `recovery/restore-assets.test.mjs` | `0b385bfde386c02085284924428c36fbeec286ea935d2ecddef455cf7b4e8de4` |
| `scripts/control/check-worker.mjs` | `316ad3438956269ddf2def2ebe0a3739496881f7ea5bafc595948964f6d97c0b` |
