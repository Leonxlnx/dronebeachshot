# Forest structure candidate

Copy `forest-structure.ts` to `src/world/forest-structure.ts`, then assemble it after textures are loaded and before the existing global MeshStandardMaterial cloud-lighting/diagnostics traversal:

```ts
import { createForestStructure } from './world/forest-structure';
const forestStructure = createForestStructure(textures);
scene.add(forestStructure.group);
```

The function returns `{group, stats}` and requires only existing Three.js, terrain, habitat, cinematic, and material modules. It calls `renderedTerrainHeight(x,z)` for placement. Shrubs have tapered woody stems and individually closed, curved leaf volumes. Snags have tapered trunks, leaning broken branches, secondary forks, irregular broken rims, and separate end-grain faces. No billboards, spheres for crowns, external assets, or new dependencies are used.

Four shrub forms and three snag forms share geometries across instances: at most 14 draw calls. Targets are 420 shrubs and 24 sparse snags; density, soil, moisture, exposure, and spacing can produce fewer. Both placement and source shapes have fixed independent seeds. `stats` records actual counts, triangles, route/spacing rejection, construction time, heights, and a deterministic placement signature. Placement records are available at `group.userData.forestStructurePlacements` for CPU audits.

Route exclusion mirrors `ecology.ts`: sample `pathPosition(i/30)` for i=0…600. Candidates use their full geometry radius plus 2.2m horizontal padding and vertical clearance. Root contact is intentionally buried below the rendered terrain; all forms stay off beach sand and avoid steep slopes. Shrubs use the current `windMaterial` for stems and leaves, maintaining matching world wind motion. Snags remain static. Main should apply its existing cloud-lighting and material diagnostics wrapper once.

Limitations for review: candidate placements do not receive the existing tree list, so they do not explicitly avoid individual live trunks. The wind-deformed shrub shadow material follows the app's existing wind-material behavior; this module adds no separate shadow override. Instancing uses one bound per geometry family over the candidate domain, so a visible family submits all its instances. The geometry/count budget is explicit in stats; reduce targets if the measured scene frame budget requires it. No rendered appearance or camera sequence is claimed verified by this draft.

Disposal: geometries are unique per mesh, while the four materials are shared across families. Dispose geometries normally and dispose each unique material once when removing the group.

CPU verification completed against the current real terrain-surface, habitat, math, and cinematic helpers. TypeScript passed. Two independent builds had the same placement signature `826ebc90`; all positions were finite, mesh bounds were valid, and every leaf surface was topologically closed (two triangles per undirected edge). For the CPU-only build, windMaterial was replaced by a plain material stub; its shader was not executed. Measured result: 420 shrubs, 24 snags, 37,350 leaf volumes, 14 draw calls, 439,932 instanced triangles, 5,232 source triangles, approximately 1.30 seconds construction. Maximum heights were 2.08m for shrubs and 9.12m for snags. No candidate met the route-overlap condition in this seed; 11 candidates were rejected by structure spacing. These figures are CPU construction/geometry evidence, not rendered frame-rate or visual evidence.


## Root integration amendments

The integrated module now accepts the live tree list, excludes overlapping trunk bases using a spatial grid, and uses 16 sides for the main snag trunks. Wind-driven shrubs receive matching custom depth materials. Actual integrated counts/signature are in `artifacts/world-cpu-check.json`; the earlier candidate signature above is retained as preparation history. No GPU appearance pass is implied.
