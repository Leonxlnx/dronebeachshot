# Current cinematic — forest descent and slow sunset glide

One continuous 20-second camera move: the 425 m crest, descending forested flank, curved beach, then a slowing offshore glide with coast, forested mountains and sunset in the same composition. The route, bank and lens are unchanged. From 0.25–9.5 s a smooth pitch correction brings the descending forest and beach crescent into view; the complete camera pose is unchanged from 9.5 s onward. The final segment now has matching position, velocity and acceleration at the join and decreases continuously from 26.90 to 5 m/s.

The 42° vertical field of view remains equivalent to approximately 26.38 mm full frame at 16:9. The real sun direction is unchanged. The final camera gaze is fixed from 18.8–20 s while the camera travels another 6.30 m, preserving readable motion without an abrupt stop.

| Time s | Position X / Y / Z m | Look target X / Y / Z m | Speed m/s |
| --- | --- | --- | --- |
| 0 | -126.00 / 451.52 / 350.00 | -149.51 / 426.43 / 252.80 | 27.09 |
| 1.5 | -122.00 / 441.51 / 310.00 | -137.17 / 378.48 / 226.01 | 29.83 |
| 3 | -104.00 / 397.77 / 268.00 | -103.94 / 302.97 / 203.46 | 61.90 |
| 4.5 | -75.00 / 302.33 / 208.00 | -77.42 / 192.59 / 152.46 | 87.32 |
| 5.8 | -90.00 / 201.99 / 149.00 | -95.22 / 99.92 / 83.44 | 93.17 |
| 7.2 | -125.00 / 99.56 / 96.00 | -119.75 / 22.38 / 16.71 | 71.61 |
| 9 | -90.00 / 19.06 / 73.00 | 5.87 / 4.54 / 44.75 | 40.72 |
| 10.5 | -36.98 / 4.92 / 84.31 | 62.74 / 3.92 / 76.81 | 39.51 |
| 10.8 | -25.00 / 4.80 / 86.00 | 74.58 / 3.80 / 76.90 | 41.26 |
| 12.8 | 62.00 / 4.80 / 69.00 | 151.57 / 3.80 / 24.54 | 44.93 |
| 14.7 | 112.00 / 5.00 / 21.00 | 124.05 / 4.00 / -78.27 | 26.90 |
| 16 | 106.71 / 5.11 / -8.31 | -59.60 / 30.27 / -341.27 | 20.95 |
| 18 | 90.24 / 5.59 / -33.16 | -632.79 / 87.86 / -692.05 | 8.81 |
| 18.8 | 87.45 / 5.74 / -38.20 | -662.55 / 87.74 / -688.20 | 5.95 |
| 19 | 86.97 / 5.76 / -39.24 | -663.03 / 87.76 / -689.24 | 5.57 |
| 20 | 85.00 / 5.80 / -44.00 | -665.00 / 87.80 / -694.00 | 5.00 |

The former endpoint coordinate constraint was replaced with checks of the requested seaward, slowing, continuous ending: final height 4–10 m, at least 100 m signed shoreline separation, monotonic positive motion ending at 5 m/s, zero terminal acceleration, a stable last 1.2 s of gaze, and useful sun frame margin. All existing terrain, tree and rock checks remain.

Current full-route CPU review samples 2,401 poses: minimum terrain clearance 5.114 m, conservative tree-envelope margin 0.483 m and rock-box distance 23.857 m. On the changed final section, the corresponding minima are 9.597 m, 64.257 m and 65.914 m. A denser 1,200 Hz opening check measures the inherited minimum tree-cylinder margin at 0.365 m; the route has not changed. These are discrete conservative CPU checks, not mesh visibility or browser approval.

The gaze correction follows the descending route pitch with a smooth upper limit and quintic entry/exit. A 1,200 Hz review measures a maximum gaze turn of 56.41°/s, compared with 53.22°/s before this correction; the ending remains below 35.20°/s. Native before/after stills at 1.5, 3, 4.5 and 7 s show more foreground forest and the beach curve. These views still expose sparse canopy and pale slopes. The original sustained 3–8 m treetop pass is not established by this gaze-only change. A six-second 640×360 native motion study at 12 fps has been inspected across the ending, including resumed render batches; motion remains continuous in those samples. It is a development study. Actual browser, final-film, foliage/LOD and full-route visual acceptance remain open.
