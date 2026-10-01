# Actual startup failure fixtures

`scripts/control/check-progress-startup-failure.mjs` exercised the real progress
capture harness with two tiny local pages, before any capture API existed.
Canvas context creation was forbidden; no scene or WebGL calls were made.

`results.json` records the successful verification: visible `#error` text failed
with its original message in 1.281 seconds; a console error failed with its
original message in 0.446 seconds. Both stopped in `scene-readiness`, saved no
frames, and retained the raw failure in their per-case manifests/status files.
Each local server port refused connections after return, and the harness left
no additional live ChildProcess handles.

The 8-second fixture readiness deadline is intentionally much less than the
production 300-second deadline. Both failures occurred from observed errors,
not either timeout. The fixture enforces a 15-second total bound per case.

`failure.json` is retained evidence of an earlier **fixture bootstrap** failure:
this environment's virtual PID 2 had no `/proc/2/task/2/children`. It happened
before either browser test. The final fixture checks Node's own live child
handles instead; it makes no claim to inventory all host PIDs.

The script, this README, `results.json`, and both per-case `capture/manifest.json`
and `capture/capture-status.json` files are ready for review/commit. The fixture
HTML inputs may be retained with them; they contain only intentional local
errors. No harness edits were made during the later cloud capture.
