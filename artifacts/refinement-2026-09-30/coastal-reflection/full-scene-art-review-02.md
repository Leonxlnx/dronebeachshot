**Accept corrected coastal reflection with distortion 1 for the combined profile.** The earlier hard bright slits are gone at t10.5. Water now receives a coherent muted brown/green contribution from the wooded coast, while the wave mode retains irregular surface highlights. Flat is a valid control but looks smoother and slightly duller.

The gain persists at t10.75 (x220–575/y190–330). The previous parallel cutout bands do not return, and shoreline contact stays stable without an obvious edge halo, displaced coast reflection or pasted flat strip. This replaces the rejection of the earlier unfiltered reflection implementation; it does not retroactively accept those images.

Actual six-frame 640×360 software WebGL2 run completed without reported errors. Source: `bb1bdf0b976d1eb2080a1287635c1fd02b3fbd3aad450178cddfff9fa238cc25`. ON states record ready=true, 320×180, MSAA4 and the intended distortion.

| Frame | Seconds | PNG SHA256 |
|---|---:|---|
| shore-off | 10.5 | `fed2e1c15abbc8c0ea259c9a1433615a306ac9750169c697a4becc475a489bb9` |
| shore-flat | 10.5 | `bbf477dbbb9f272552ddd51bb977fc1219bf1cfdec1ce7e2882256e0186681c1` |
| shore-wave | 10.5 | `ae6b902a9f98695daa1a57387895c60c0c9879fff182f1bce67bcebdbd6253c3` |
| shore-off-restored | 10.5 | `fed2e1c15abbc8c0ea259c9a1433615a306ac9750169c697a4becc475a489bb9` |
| nearby-off | 10.75 | `79efee5313bcf985093fc50a1129bec5aebe6930e2c210c3166b84f531f421e8` |
| nearby-wave | 10.75 | `0a0a714ed1061442a56e0e85c18549de804a886512c9f06d050d80e2e81a3646` |

Decoded RGBA OFF/restored is **exact: 0 differing pixels/channels, max delta 0**. Both new OFF frames also equal their matching old 47-frame controls exactly in decoded RGBA. PNG hashes were independently checked against the new manifest; exact state and comparison measurements are in `full-scene-art-review-02.json`.

This is bounded static optical acceptance for the combined profile, not a performance benchmark, temporal test or full-route acceptance. Larger combined views remain a separate validation. No production code or settings were edited by this review.
