# Water micro-normal candidate

`ocean-micro-normal.patch` changes only the micro-normal spectrum and its pixel-footprint filtering. `ocean-micro-normal-candidate.ts` is the complete proposed file. No production file was edited.

The inspected baseline `wet-sand` and `sunset-reflection` frames show repeated rounded interference cells nearby and dense stipple toward the horizon. The current six bands have harmonically spaced wavenumbers `1.8 + i*1.8`, equal slope amplitudes, and only a distance fade. That fade cannot account for camera angle, resolution, or the strongly stretched pixel footprint near the horizon.

## Changes

- Eight fixed, non-harmonic wavenumbers: 1.31, 2.17, 3.73, 6.11, 9.47, 14.23, 21.37 and 32.11 radians/meter, corresponding to wavelengths from 4.80 m to 0.196 m. Independent phase offsets and directional spread avoid the previous short repeating frequency pattern.
- Directions center on the existing `WIND` vector. Component phases remain absolute-time functions, with deep-water gravity-wave dispersion `sqrt(9.81*k)` and downwind propagation. No accumulation or random per-frame state is introduced.
- Each band measures its phase change across both screen-pixel axes using `k*dot(direction, dWorldXZ/dPixel)`. It fades smoothly between 1 and 3 radians/pixel and is absent before the π-radians/pixel Nyquist limit. This accounts for anisotropic grazing-angle footprints, not just camera distance.
- `dFdx` and `dFdy` occur only at the beginning of fragment `main`, before any discard, then enter `waterNormal` as arguments. The shared `waterFns` block remains derivative-free and valid in the vertex shader.

The unfiltered micro-slope RMS is **0.138564**, matching the old six bands. The improvement is not obtained by reducing all close-water normal amplitude. The existing distance and shoreline envelopes are retained. For an isotropic footprint, the candidate's retained RMS is approximately 0.1386 at 1 cm/pixel, 0.1354 at 10 cm/pixel, 0.1050 at 0.5 m/pixel, 0.0801 at 1 m/pixel and 0 at 3 m/pixel. Directional/grazing footprints are filtered per band.

## Preserved behavior

Swell displacement, `waterHeight`, its central-difference normal contribution, swash and far-water geometry, coastal field, foam, refraction, Fresnel and glint equations remain unchanged. The actual water mesh still displaces with the existing swells. This candidate does not introduce replacement flat geometry or a visual backdrop.

## Verification and next comparison

The exact candidate `createOcean` compiled and rendered **1,708,080 production water triangles** under native Three r185 with a synthetic constant coastal field. Result: **zero shader errors, GL error 0**. Both shader stages compiled, validating the derivative boundary. Details are in `ocean-micro-normal-validation.json`; spectrum values are in `ocean-micro-spectrum.json`.

Root should compare the same `wet-sand`, `descent-reveal` and `sunset-reflection` views at adjacent absolute times. This check establishes shader validity, not whole-scene appearance. Foam noise and the sharp glint lobe are separate potential alias sources; neither is changed here. Filtered-out micro-slope variance is not yet transferred into the glint model's roughness, so remaining sparkle requires its own measured follow-up rather than another arbitrary normal-strength reduction.
