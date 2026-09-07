# Bounded Island growth form

Repeated source crowns remain a visible weakness of the forest. This change
adds one different growth form to 213 existing Island trees in the opening core
forest. Their identities, root positions, scale, yaw and existing ecological
properties are unchanged. It does not complete the required tree-family or
variation inventory.

The secondary crown opens through a continuous deformation of the actual
licensed source mesh. The lower two metres remain fixed, and the same field
acts on wood and leaves in all three geometric LODs. Its Jacobian has positive
unit determinant. A few coarse wood faces are subdivided on their original
surface before bending; source UVs and attachment continuity are preserved.
An earlier rigid-leaf experiment was rejected because it separated a measured
leaf attachment from its supporting wood.

The far view uses newly authored albedo, root-local normal and source-sun
visibility atlases. A complete bake rendered 24 source views and eight sun
directions, with all packed cells checked against their source outputs. The
production files, source attribution, encoding and checksums are documented in
`../tree-form-authoring/`. Recovery combines the original asset archive and a
small derived-asset archive, validating both before writing missing assets.

The asset check now decodes PNGs and checks raw RG8 dimensions. A separate
geometry/atlas check binds the growth field, source model, runtime framing and
three derived payloads. Fresh restoration, 50 tests, native handle checks,
the complete CPU world calculation and production build pass. All 41 built
asset payloads match their manifests.

Independent runtime probes exercise the actual vegetation constructor with
small controlled source and placement doubles: geometry routing, matching far
uniforms, high/balanced/low LOD packing, narrow-frustum billboard bounds,
separate sunlight packing and teardown reachability pass. These probes do not
measure the complete scene or browser performance.

Controlled complete-scene comparisons show the changed foreground crowns in
the forest-opening and initial flight views. The 4.5- and 7-second flight views
are pixel-identical regression controls: the selected cohort is outside their
visible composition. Across these four native views, the change adds three
renderer textures and 55–85 submitted draw calls; the additional submitted
triangles are small. No consumer-GPU performance claim follows from these
diagnostic counts. A separate distant view with multisampled far coverage shows the changed crown silhouettes with no visible atlas rectangles or disappearing forms in that sample; it adds 27 draw calls and three textures. All paired native captures report zero shader and graphics errors. Near foliage grain and broader forest quality remain open.

Browser acceptance, the final 4K gallery and films, the original browser-cycle
and active-time requirements, and global art approval remain incomplete.
