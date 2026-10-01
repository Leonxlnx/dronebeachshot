# Preserve resolved sand albedo

The9s1280×720 woodland screenshot retains a smooth, nearly uniform wet-sand ribbon. The source material adds a footprint fade to albedo after its existing texture minification filter: at0.18m per pixel it replaces the entire sampled luminance ratio with1. With the existing2m repeat, a tile still spans approximately11pixels at that cutoff.

The narrow correction removes that second albedo fade. It retains the already mip-filtered source luminance ratio and its existing.62…1.38 clamp. The footprint fade remains for normal-map grain. Palette, eighteen-second damp darkening, roughness, water/runup, geometry and shadows are unchanged. No toggle or new noise was added.

Independent CPU analysis of the exact sand source retains4.46% ratio standard deviation at16×16 linear box averages (12.5cm cells), with5th/95th percentiles.937/1.085. At8×8 (25cm cells), deviation remains4.27%. At1×1, the ratio is.99717, close to the previous far-field constant1. Exact source/image hashes and every measured scale are in evidence.json. These are source-scale statistics, not exact GPU mip samples or rendered pixel predictions.

Visual acceptance remains open. This may break the uniform substrate appearance modestly but does not change literal wet-band width. The next actual comparison must reject distracting repetition, blotchiness or shimmer; no overall quality rating is inferred.
