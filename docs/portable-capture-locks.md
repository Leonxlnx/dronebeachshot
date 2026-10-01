# Capture locks on a local laptop

Each capture output directory has one exclusive `.capture-lock.json` owner.
Normal completion releases that owner's unchanged lock, so a later capture can
resume the checkpoint after its existing contract and frame validation pass.

On Linux, the existing version-2 policy is unchanged. It verifies the host,
kernel boot, procfs view, process birth and PID namespace before deciding that an
owner is active or conclusively stale. Unknown identities remain blocked.

On macOS and Windows, version-3 locks use atomic exclusive file creation. Their
host, platform, PID, process-session nonce and lock token identify the recorded
owner; the nonce is **not** a verified OS process-birth measurement. Release
requires the same regular file identity and exact owner bytes. Portable locks
are never reclaimed automatically, including when a PID appears absent, a file
is old, or its contents use another format or are malformed.

If a portable capture is interrupted before cleanup, preserve its checkpoint.
Confirm that the original capture process and its renderer have finished before
deliberately removing only that output directory's lock file. Do not decide this
from lock age, an absent heartbeat or a PID check alone, and do not delete a lock
while a writer may still use the directory. If ownership is uncertain, use a new
output directory. Removing a lock does not waive the normal resume checks or
permit mixing capture backends, settings, source bundles or frames.

The portable policy tests exercise macOS/Windows metadata on the current host
and verify exclusive acquisition, conservative refusal and normal release.
They are not evidence of a capture or hardware-rendering run on those systems.
Two Linux `/proc` integration tests are skipped on other operating systems;
their assertions and Linux behavior remain unchanged.
