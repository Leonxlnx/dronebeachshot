# Intermediate capture recovery

The progress capture script and checkpoint module were reconstructed after the
workspace source loss. They preserve the documented behavior and surviving
version-1 manifest format; this is not a claim of byte-identical recovery.
The final capture implementation and acceptance gates remain separate.

Restored files:

- `scripts/progress-capture.mjs`
- `scripts/control/progress-checkpoints.mjs`
- `scripts/control/progress-checkpoints.test.mjs`
- `scripts/control/progress-network.mjs`
- `scripts/control/progress-glb-fetch.mjs`

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

Validation: syntax checks and 30 focused tests passed with:

```sh
node --check scripts/progress-capture.mjs
node --check scripts/control/progress-checkpoints.mjs
node --check scripts/control/progress-network.mjs
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

## Startup failure diagnostics and deterministic encoder test

The first full npm test run exposed a timing assumption in the early-exit test:
an 80 ms delay did not ensure that a child process had exited under parallel CPU
load. The test now waits for the actual child `close` event before returning its
first frame. Its exact one-saved-frame assertion is unchanged.

The first recovered candidate-07 capture recorded a failed `palm-tree.glb`
request, but its URL-only logging lost the browser's failure reason. The capture
now records request error text, HTTP status, resource type, stage and timestamps,
with bounded event history. Failure manifests include active requests, a page
readiness/loading/error snapshot (2.5 s deadline), and local server read or
incomplete-response errors.

Before switching offline, the browser now waits for actual request completion
and a 250 ms quiet period, with a 30 s maximum (`networkTimeout` can override it).
All request failures remain fatal. This prevents the script from deliberately
cutting off known in-flight requests; it does not establish that the original
palm failure was caused by the offline switch. Its missing build metadata may
instead indicate failure during the initial health check. The next real capture
must supply that missing evidence.

## Completed-body GLB abort investigation

The retry supplied the missing evidence: three GLB requests returned HTTP 200,
then `net::ERR_ABORTED` before the offline transition. The page was nevertheless
ready with no scene error, and resource timing reported each full encoded body
size. Thus the offline switch was not the cause of that retry's failures.
The precise browser/Three stream lifecycle cause is still an inference.

Intermediate capture now installs a narrowly scoped fetch wrapper before loading
production modules. Only same-origin `/assets/…/*.glb` GET responses are affected.
The wrapper fully drains the network response, verifies its complete byte count
and SHA-256 against the actual served file, then returns a normal in-memory
Response containing the same bytes to Three's unchanged GLTFLoader. Production
assets and scene source are not rewritten. Every raw network failure and every
delivery integrity failure remains fatal; there is no `ERR_ABORTED` exemption.
The manifest records the inventory and verified deliveries.

`scripts/control/check-glb-fetch-lifecycle.mjs` exercised actual Three 185 loading
of island hero, island medium, syringa near and palm GLBs in one Chromium process
with GPU/WebGL disabled. Both original and buffered modes completed 12 loads.
Parsed geometry counts, JSON hashes and image dimensions matched. The buffered
mode verified all 12 exact payloads; deliberately tampered bytes, a truncated
response, HTTP 503 and an aborted signal all rejected. Two rounds also requested
garbage collection during progress callbacks.

Evidence: `artifacts/refinement-2026-09-30/glb-fetch-lifecycle/results.json`.
The tiny original-mode fixture did not reproduce the full-scene abort, so these
results establish byte-preserving behavior and strict negative handling, not a
proven elimination of that sporadic browser anomaly. The next full-scene capture
remains the integration check. The optional `coastalUnderstory` profile control
is also accepted; no visual approval is implied by that setting support.
