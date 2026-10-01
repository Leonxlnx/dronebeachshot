# Existing progress MP4 color audit

**No material hue or gamma failure was observed in the local decode comparison. Keep the exporter unchanged for this update.** Color metadata is incomplete; target-browser/player interpretation remains unverified.

Scope: the already encoded 12-frame, 0.500-second, 640×360 smoke MP4 only. Its SHA-256 is `0f9424f1468ccab0524796daec45828bc758a94be8e1cb2770dcf8459c742341`. Every source PNG hash and the pinned production JS bundle hash were verified. No new video was created and no active render, encoder, exporter or checkpoint was modified.

The pinned engine sets sRGB output (bundle constant `He=srgb`, `outputColorSpace=He`) with ACES tone mapping. Screenshot PNGs carry no sRGB/gamma/ICC chunks. The H.264 stream reports none of `color_range`, `color_space`, `color_transfer` or `color_primaries`; only chroma location is present (`left`).

All 12 frames were decoded to in-memory RGB and compared against the original PNG RGB bytes, using at most two FFmpeg threads and two filter threads. Values below are 8-bit code-value errors, not perceptual DeltaE.

| Local interpretation of existing encoded bytes | RGB MAE / 255 | PSNR | Result |
|---|---:|---:|---|
| FFmpeg default | 1.785 | 39.90 dB | Close numerical roundtrip |
| Explicit BT.601, limited range | 1.785 | 39.90 dB | Byte-identical to default decode |
| Forced BT.709, limited range | 2.298 | 38.24 dB | More error; tag-only matrix change is unsupported |
| Forced BT.601, full range | 6.214 | 30.37 dB | Clearly worse range interpretation |

Default decode median absolute channel error is 1, P95 is 5, P99 is 9, and maximum is 69. Approximately 3.75% of channel samples differ by more than 5. Mean RGB biases are (−0.851, −1.360, −0.875), around half a percent of full scale or less. Thus this is a small average codec/chroma/conversion error, **not a lossless or uniformly tiny per-pixel error claim**. The water-region MAE is 1.318; forest-region MAE is 2.176.

Independent native decoded luma compared with limited-range source formulas also fits BT.601 more closely (MAE 0.947 code values) than BT.709 (1.411). This conclusion is based on observed encoded bytes and forced-decode comparisons, not an assumption from SD/HD frame dimensions.

No transfer-aware browser/player playback was tested. Missing metadata may permit different interpretation elsewhere; this audit does not establish that such a problem currently occurs. Adding BT.709 tags alone would mislabel the locally observed matrix. A future explicit export pipeline would need matching conversion and tags, preserving or deliberately transforming source sRGB transfer, followed by a bounded smoke and target-player verification. No such change is justified immediately from these measurements.

Evidence: `metrics.json`, `ffprobe-observed.json`, reproducible `analyze.py`. Decoded sample buffers were not saved as a new video.
