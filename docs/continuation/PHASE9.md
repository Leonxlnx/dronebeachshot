# Orthographic tree-impostor direction

Far trees selected their atlas view from the camera position for every pass.
That is correct for perspective cameras, but directional-light shadow cameras
have parallel rays. Moving such a camera along its viewing axis, or translating
a tree across its frame, could incorrectly change the tree's shadow silhouette.

The shared color/depth hook now derives the orthographic viewing direction from
the view matrix and transforms it into tree-local coordinates. The projection
matrix selects this branch because Three's depth material does not receive its
`isOrthographic` uniform. The perspective calculation and atlas contents remain
unchanged. The shader program key was updated.

`npm run check:impostor-camera` compares the direction with Three's actual
Raycaster across 1,632 camera/transform cases, including 68 nested instance
transforms, nonuniform scale, camera roll, view offsets and camera translation.
It exercises negative controls for the old formula, reversed direction, wrong
matrix indices and an incorrect normal-matrix substitution. The old formula
fails 808 orthographic cases. The corrected double-precision direction differs
from the independent oracle by at most 3.02e-13 in unit-vector distance.

The check also constructs the actual production color/depth hooks, both with
and without source-sun visibility, and verifies that their injected direction
blocks match the evaluated formula. It is part of `verify:build`.

This establishes CPU mathematics and shader assembly. It does not establish
GLSL execution, visual quality, browser acceptance, or consumer performance.
The graphics environment is currently unavailable; a fresh paired image check
remains required. The original gallery, film, refinement-cycle and active-time
completion requirements remain open.
