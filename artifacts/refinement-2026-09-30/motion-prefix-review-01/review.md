# Motion prefix review 01

**No confidently identified abrupt LOD pop or whole-frame lighting flash in this prefix.** This is screening evidence, not a quality acceptance or review of the complete 20-second film.

Snapshot: **254 frames, indices 0–253, 0–10.54166667 s at 24 fps**, 640×360. All 254 PNG SHA-256 hashes match the single manifest snapshot; indices/timestamps are consecutive; all PNG hashes are distinct. Source is pinned candidate 10 (`ee114c8d7bf6eca95ce22fe39a35e16f00e779974c773861829e36c84c1dfbd8`). New visual studies are absent.

Analysis uses 160×90 RGB arrays, display-luma/color/edge measurements and 15 local translation matches per adjacent pair. Raw difference is normalized using ±8-pixel patch correlation with a subpixel peak. The analysis never edits the actual PNGs. Twenty-one original 640×360 PNGs were inspected.

| Transition | Time | Evidence and judgment |
|---|---|---|
| 13→14 | 0.5417→0.5833 s | Strongest local outlier (z 5.23) lies in sky/sun column; matching hits search bound. Frames 13/14/15 show continuous tilt, no confirmed pop. |
| 23→24 | 0.9583→1.0000 s | Largest mean luma step, −1.278% of display scale; part of smooth multi-frame decrease as bright horizon exits. No isolated flash. |
| 45→46 | 1.8750→1.9167 s | Restart boundary is unremarkable: normalized residual 0.005626, local z −0.21, prefix 17.8th percentile. Original frames 45/46/47 agree. |
| 103–105 | 4.2917–4.3750 s | Elevated residual in lower-left foreground leaves/terrain; parallax and fine foliage are visible. No discrete LOD replacement established. Foliage shimmer still merits video-level assessment. |
| 179–181 | 7.4583–7.5417 s | Strongest patch is reflective animated water; frames show continuous waves and camera movement. |
| 212–214 | 8.8333–8.9167 s | Largest raw difference at 213 drops from 0.04527 to 0.01203 after local motion compensation; normalized local z 0.008. Coastal tracking remains consistent. |
| 248→249 | 10.3333→10.3750 s | Local z 4.37 comes from moving water at native pixel center (320,280), low correlation 0.571. Whole-patch mean z −0.145 and original frames 248/249/250 show stable shore/forest. |
| 252→253 | 10.5000→10.5417 s | Endpoint-only normalized z 3.36; one-sided neighborhood and no following frames in snapshot. Candidate only, not a confirmed defect. |

The patch model cannot fully remove perspective, occlusion, parallax or animated water. Downsampling can hide fine foliage flicker. This was individual-frame inspection rather than complete video playback. Remaining 226 nominal frames were not read or reviewed.

Evidence: `manifest-snapshot.json`, complete numeric `metrics.json`, concise `review.json`, reproducible `analyze.py` and `summarize.py`. CPU/file work only; active film, lock, encoding, browser and GPU untouched.
