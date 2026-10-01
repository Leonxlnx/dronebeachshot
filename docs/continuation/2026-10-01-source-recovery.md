# Working source recovery after partial workspace loss

Around 03:16 UTC, source files, dependencies, Git metadata and many render assets
became unavailable. The cause is not established. The in-memory scene capture
continued and completed its 12-frame, 512×288, 24fps, 0.5-second H264 test at 9.75s.
ffprobe and independent decoded-frame review confirmed the MP4. Missing early PNGs
and pinned-bundle files mean that particular output directory is no longer a
complete resumable checkpoint. Its finished MP4 remains valid evidence only for
that short test, not a full film or final quality acceptance.

The authoritative b027d2abf86eaf4c1185f000c064ea9bea49d218 Git source was cloned
read-only and restored without overwriting surviving files. All41 original assets
were hash-checked and restored by the existing archive restoration script. The
lost local3b2d3cc commit was not pushed and has not been recovered as a Git object.
Its previous acceptance evidence remains historical; the current source must be
validated again.

Agents retain exact patches for several renderer and placement changes. Others
are reconstructed from explicit contracts and surviving reviews, with no claim of
byte equivalence. In particular the material weathering, foam lighting, capture
implementation and conservative culling reconstruction require fresh rendered
comparisons. Rejected principal-face shape remains default off; mineral relief
and seeded far-crown coverage remain default off. No old final gate is advanced.

A read-only baseline checkout and local recovery patches are retained. All further
work remains local while the earlier automatic GitHub push rejection is unresolved.
