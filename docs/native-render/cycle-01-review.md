# Native baseline and first refinement

The first successful actual-world frames were rendered through native ANGLE
and the unchanged Three.js world modules. Baseline cameras: mountain-wide,
flight-0, descent-reveal, wet-sand and sunset-reflection at 640×360. The native
readback was also encoded with alpha removed to match the opaque production
canvas; original RGB was preserved. These corrected encodings are not extra
views or refinement cycles.

First correction: the ocean shader used the reserved GLSL identifier `active`.
Actual ANGLE compilation failed. Renaming it to `breakerActivity` preserved the
equation and allowed complete scene frames with no shader or GL errors.

The baseline has substantial visible failures. Sparse foliage reads as noise
over brown, conical hills studded with round dark rocks. Distant terrain strips
are obviously artificial and have abrupt edges. The opening flight barely
shows the mountain it departs from. Water has repetitive ripples, wide uniform
foam stripes and a diagonal surface edge in the wet-sand camera. The sky is a
pale continuous ceiling; a visible low sun is missing.

The first lighting refinement changes weather-scale cloud coverage, raises the
cloud base above the mountain, adds warm radiance and increases the directional
sun/sky-fill contrast. Three 960×540 frames were rendered. The color is warmer,
but cloud bands remain severe and the sun is still obscured. Mountain geometry,
foliage coverage, water boundaries and repeated waves remain unacceptable.

**Not accepted.** The native renderer makes visual diagnosis possible but does
not establish browser rendering, antialiasing, mobile behavior or performance.
The 30–66 million submitted triangles across multiple passes in baseline metadata
are draw statistics, not consumer-GPU performance measurements. No image here
is a final 4K still and no final film has been captured.

Next changes target leaf coverage/alpha filtering, forest coverage on slopes,
continuous distant terrain, geological shape, and water surface continuity.
