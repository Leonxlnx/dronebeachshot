# Retreating swash-front coverage

Actual three-way native controls at cinematic time 10.5 s isolate a visible opaque cutout at the retreating front. The existing shader applied its thin-film blending only at signed shore distance greater than -1 m, even though runup retreats farther seaward. The selected correction applies the existing film coverage wherever the opaque-coast buffer is ready. Because coverage is already exactly one away from the front, interior water color remains unchanged.

Variant 0 is the production baseline; variant 1 enables this coverage at all front positions and removes the harsh serrated boundary. Variant 2 additionally moves the sand-contact height transition with runup; it creates a visible broad reflected crease and was rejected. Production includes only variant 1. Water geometry, runup, wave phase, normals, foam, coastal field and sand wetness are unchanged.

These 960×540 views deliberately omit vegetation and understory to show the shoreline. All three use real production terrain/ocean shaders, native HalfFloat MSAA4 and ACES/sRGB output. GL/shader errors are zero. They do not establish final world, browser, mobile, performance or temporal acceptance. Further wave shape and reflection refinement remains open.
