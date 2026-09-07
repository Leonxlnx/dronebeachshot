# Preserve fractional coverage in distant tree crowns

The distant tree atlases already contain the integrated coverage of the source
leaves. Applying the source leaf cutout threshold again turned fine gaps into
broad opaque crown patches, especially when an atlas cell was magnified or
only slightly minified.

Impostors now explicitly identify their textures as coverage maps. Their color
and custom depth shaders preserve fractional alpha for the existing sample
coverage or alpha-hash stage. Original leaf textures retain their previous
cutout filtering. The shader cache distinguishes these two meanings of alpha.
No source models, atlas images, placements, LOD distances or terrain changed.

Twelve isolated source/comparison images support the correction. The distant
views recover fine crown gaps; the middle-distance control still shows the
limits of a magnified atlas and does not justify moving the far LOD closer.
Independent captures of twelve actual material/depth shader variants confirm
that ordinary source vertex and fragment shaders remain byte-identical.

Two paired full-scene views show the expected foliage and cast-shadow changes,
with identical camera poses, geometry submission and placements. The native
diagnostic harness now records and checks an optional shared vegetation
material override, allowing the preceding coverage behavior to be compared
without substituting a different world.

Validation: 54 tests, asset and source-form checks, full world construction,
TypeScript and the production build pass. These diagnostic comparisons do not
establish browser behavior or consumer GPU performance.

The new Jacaranda source and its atlas remain preparation work. They are not
included as a production family in this change. Final landscape quality,
family/form variety, browser cycles, final gallery, films and the required
active work duration remain open.
