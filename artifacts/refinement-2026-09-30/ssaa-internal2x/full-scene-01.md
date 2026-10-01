Linear 1x versus native: **UNCLEAR as a standalone art gain**. Leaf highlights differ slightly, but coarse stipple remains. Linear 2x versus 1x: **ACCEPT for this still**. Left/foreground and lower central crowns have finer speckle and more continuous foliage while retaining trunks, gaps and overall coverage.

The curved shoreline band (x240–610/y150–254) also changes: foam edges become narrower and more finely fragmented; upper-left glints resolve finer. There is no visible refraction shift or outline halo. Existing regular foam lanes remain procedural. This is not a leaf-only change.

Source: `5b3479529a796233889fd2de92d044f0aba207d73933c932ccb34c85b495e248`; t4.083333333333333; 640×360 output. Actual stats confirm 640×360 then 1280×720 RGBA16F/MSAA4 targets for 1x/2x, respectively.

| Frame | Seconds | PNG SHA256 |
|---|---:|---|
| near-crown-native | 4.083333333333333 | `a0c69d3010a56aab25bd8d5a30cc09d01d1487379286e42ba1d8961f1d66477b` |
| near-crown-linear-1x | 4.083333333333333 | `7e21900cc3280d68b27571d0d7d6f11aadfd56cb773f18282e3fc2edb7a1cc8d` |
| near-crown-linear-2x | 4.083333333333333 | `c5d2769133266ed54f8a58a52bd2dca26041a4f98713c12e39c70584b07dcdf0` |
| near-crown-native-restored | 4.083333333333333 | `a0c69d3010a56aab25bd8d5a30cc09d01d1487379286e42ba1d8961f1d66477b` |

Decoded native/restored RGBA: **0 differing pixels, 0 differing channels, max delta 0**. Native/1x: 85,974 differing pixels, max delta 60. 1x/2x: 196,472 differing pixels, max delta 169. These counts locate numerical changes and are not quality scores.

Restored state is disabled/effective scale 1; the 1280×720 target remains cached. No temporal shimmer or performance conclusion follows from these stills or unsynchronized capture durations. Exact per-frame state and measurements are in `full-scene-01.json`.
