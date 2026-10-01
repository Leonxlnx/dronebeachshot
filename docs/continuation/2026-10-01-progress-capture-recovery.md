# Intermediate capture recovery

The progress capture script and checkpoint module were reconstructed after the
workspace source loss. They preserve the documented behavior and surviving
version-1 manifest format; this is not a claim of byte-identical recovery.
The final capture implementation and acceptance gates remain separate.

Restored files:

- `scripts/progress-capture.mjs`
- `scripts/control/progress-checkpoints.mjs`
- `scripts/control/progress-checkpoints.test.mjs`

The original command remains supported:

```sh
BAY_BROWSER_EXECUTABLE=/workspace/scratch/46479389b383/forest-capture-runtime/browser/chromium node scripts/progress-capture.mjs video width=512 fps=24 duration=0.5 start=9.75 profile=artifacts/refinement-2026-09-30/clear-motion-profile.json out=artifacts/refinement-2026-09-30/motion-06-shore
```

Use a new output for a new capture. To resume a complete valid checkpoint,
repeat its exact original arguments with `resume`. The surviving historical
motion-06-shore movie is evidence of its previous run, but that checkpoint lost
frames and pinned bundle files during the source loss and must not be described
as resumable now.

Video captures pin and hash `dist` before loading it; resumed captures serve the
pinned bundle even if the working build changes. The immutable contract includes
dimensions, fps, duration, start time, profile and timeline. Every committed PNG
has a numeric unique name, decoded dimension/CRC validation, SHA-256 and the
production source identity. PNG writes and manifest replacement are atomic.
An output lock rejects concurrent writers. Orphan PNGs do not become records.

Saved frames feed a fresh encoder in order. Missing frames are committed before
their encoder write, so an encoder failure during a long render preserves the
completed frame. Encoder listeners attach immediately, write and completion
deadlines are bounded, and a failed attempt preserves a previous finished movie.
The existing still-plan flow retains named cameras, labels and cumulative
settings. The optional profiling, linear output and crown blending settings are
accepted; actual shadow/linear output state is recorded when exposed by the API.

Validation: syntax checks and 28 tests passed with:

```sh
node --check scripts/progress-capture.mjs
node --check scripts/control/progress-checkpoints.mjs
node --test scripts/control/progress-checkpoints.test.mjs scripts/control/capture-run.test.mjs
```

Focused tests cover missing/corrupted/replaced PNGs, wrong dimensions, frame
identity/time/order, changed settings/timeline/fps and pinned bundle changes.
They verify rejection preserves the committed manifest, use real ffmpeg to
resume a partial prefix and re-encode a complete prefix without a browser,
verify cumulative setting replay, reject a changed production identity, and
exercise encoder early exit and exit timeout while preserving checkpoints.
The test video is a two-frame 8×4 fixture, not visual evidence for the real scene.
Full-scene recovered captures require their own review.
