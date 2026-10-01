**Accept source response alone as a bounded lighting improvement. Reject far-crown blending and the combined preset.**

At the opening (x20–225/y90–255), response adds readable internal light and shade while retaining crown texture. The hill remains too uniformly brown overall. Blending instead turns the headland (x0–240/y80–250) into a soft, continuous moss-like mound; the combination restores some shading but keeps that loss of crown separation.

At descent, the distant upper-left patch (x0–120/y10–150) is mostly neutral or slightly improved by response. Blending makes it a blurry green mass beside sharper near crowns. The near crowns themselves remain essentially unchanged. Water and shoreline stay visually consistent within each quartet.

Actual 640×360 software WebGL2 captures at t0 and t5; source `5b3479529a796233889fd2de92d044f0aba207d73933c932ccb34c85b495e248`. Grass palette is 0, linear output is off/scale 1, crown coverage is off, cloud coverage is 0.9/morphology off, and coastal reflection is off. Each quartet differs only in source response and far blending.

| Frame | Seconds | PNG SHA256 |
|---|---:|---|
| opening-baseline | 0 | `a99c969227856ac9d0886639bfbd29303e26364fc23bea8a6caa9ce55ee406c6` |
| opening-response | 0 | `5f6d6650f162bc0f9f032caa455d9e8e428f13f3151b5895db41e42f2f59df3a` |
| opening-blend | 0 | `0bc3a5c791b55ac2ba1990466a46311cf9ba3921c0d8ede9988f2d137e00509a` |
| opening-combined | 0 | `2c266ff0b490f8ee18e6514a22ad24a5e0e8523e5d8856fa0cc116332e5ae51d` |
| descent-baseline | 5 | `62d2f92dca7c8d71976a5df7f6cb174c7ae9cf37cb718b3af91bdc3698fb63f8` |
| descent-response | 5 | `1ad10a78fb08c16a10a981f72222aa54bd770785f9cf65d789357895de18b03e` |
| descent-blend | 5 | `a26d818e72423ab22ac10fee6f19cc2f0402d09ea5a5161146931dbc1b335c72` |
| descent-combined | 5 | `3f2d35a30f1cd2ab85026fa7388e3b4d78b27506568579b41ec99e087517259b` |

Hashes were checked against the manifest; decoded RGBA comparison bounds and actual response-ready state are stored in `full-scene-01.json`. These counts are not quality scores. There is no restored frame in this eight-frame group, so this review makes no restoration claim.

These static, two-pose decisions do not establish motion quality, full-route or combined-profile acceptance, runtime performance, an 8/10 score, or a completed environment. No production settings were edited.
