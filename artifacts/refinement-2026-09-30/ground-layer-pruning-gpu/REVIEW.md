# Qualified review

The 128px material fixture completed 52 lit, nonblank, finite frames. All
38 paired PNG files were byte-identical. Original→mode0 and mode0→mode1 were
also Float32-exact; rock and the opted-out continuation stayed exact.

The eight core mode1→mode2 pairs had small unexplained linear differences:
maximum `7.21216e-6` with synthetic inputs and `5.30481e-6` with source-derived
256px inputs. This supports the recorded 8-bit comparisons, **not** universal
float equivalence, full-scene equivalence or a measured performance gain.

Root integrated the controls for inspection, both defaulting to 0. The archived
GPU evidence predates the combined integration. No repeat render is claimed.
The replay harness now compares SHA-verified originals from git `c604d90` with
actual current material/wrapper code, keeping the independent ripple filter off.
Historical evidence cannot be overwritten by its default output path.

Post-integration CPU verification passed 10/10 focused checks in one run;
CPU-only probe preparation also succeeded. Production source was not edited by
this reproducibility update. Raw float differences, PNG checks and the inspected
images remain beside this review.
