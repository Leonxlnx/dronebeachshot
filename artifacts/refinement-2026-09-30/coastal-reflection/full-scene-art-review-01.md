**Reject current flat reflection, wave reflection and the combined preset. Sand-film drying alone remains unclear as a visual improvement.**

At t10.5, flat reflection creates sharp horizontal bright slits across grazing water (x0–515/y184–265). Wave distortion bends/breaks them and adds useful coast-colored water, but parallel contour bands remain more conspicuous than a coherent reflected shoreline. The same defect persists at t10.75 (x0–560/y185–280).

Film-only produces at most a subtle less-polished transition in the right sand strip (x520–639/y214–330). The broad smooth gray ribbon remains. It introduces no obvious new defect here, but the gain is not decisive. The nearby combined pair cannot isolate film at t10.75.

Source `5b3479529a796233889fd2de92d044f0aba207d73933c932ccb34c85b495e248`; actual 640×360 software WebGL2. Reflection ON records ready=true, 320×180, MSAA4 and the intended distortion mode. Those state checks establish execution, not optical quality.

| Frame | Seconds | PNG SHA256 |
|---|---:|---|
| shore-off | 10.5 | `fed2e1c15abbc8c0ea259c9a1433615a306ac9750169c697a4becc475a489bb9` |
| shore-reflection-flat | 10.5 | `ee93420dd4a12cb1868d8dba06828d0a596140c216c1c042fd7d92064568cd7d` |
| shore-reflection-wave | 10.5 | `c551211ca3cd64513e65b551399508cdb9d83743a86d96352cf391896e07f501` |
| shore-film-only | 10.5 | `771b1ff49725b2f83d9dbfd784a00316f486717d56dfdf955b6e9827e2bddf6f` |
| shore-combined | 10.5 | `e84199a35384f3218b48e61ed26a27b1e230259cfc682702496789b63c064d24` |
| nearby-off | 10.75 | `79efee5313bcf985093fc50a1129bec5aebe6930e2c210c3166b84f531f421e8` |
| nearby-combined | 10.75 | `30469e5b3db552cdd7c5a61cbfa1918c82dd1619a5ba1e0b20b3e26e638a161c` |
| shore-off-restored | 10.5 | `fed2e1c15abbc8c0ea259c9a1433615a306ac9750169c697a4becc475a489bb9` |

OFF/restored decoded RGBA is **exact: 0 differing pixels/channels, maximum delta 0**. Hashes match the manifest; per-frame settings, reflection state and decoded comparison bounds are in `full-scene-art-review-01.json`.

This review diagnoses visible results only. It makes no shader-cause, motion-quality, performance, 8/10 realism or completed-environment claim, and changes no production settings.
