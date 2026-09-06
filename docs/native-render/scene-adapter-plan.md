# Native production-scene adapter

The production checkout is read-only. Reuse its source modules and Three 0.185.1 directly. Do not import `src/main.ts`, which owns DOM, CSS, audio, URL state, and animation scheduling. The reusable world modules have no browser-only runtime requirements once image loading and the coastal Worker are replaced.

## Module resolution and image I/O

Run the harness with the existing extension-resolution loader:

```sh
node --experimental-strip-types --loader /workspace/sites/last-light-bay/scripts/control/ts-resolve.mjs ./render-native.mjs
```

Use `/workspace/sites/last-light-bay/node_modules/three/build/three.module.js` for the harness's `THREE` import and `/workspace/sites/last-light-bay/node_modules/three/examples/jsm/loaders/GLTFLoader.js` for its loader import. These resolve to the same modules as production's bare imports. Do not load a second Three package from scratch: prototype patches, `instanceof`, texture identity, and module uniforms must share one module graph.

Before invoking `loadTextures()` or `createVegetation()`, call:

```js
import { installNativeAssetLoaders } from './native-asset-adapter.mjs';
const assetAdapter = installNativeAssetLoaders({
  THREE, GLTFLoader,
  publicRoot: '/workspace/sites/last-light-bay/public'
});
```

The provided adapter reads files using Node and decodes WebP/PNG with runtime-owned sharp. It patches `TextureLoader.load` and `GLTFLoader.load`; all production callers remain unchanged. Its GLTF plugin replaces only `parser.loadImageSource`. Official r185 `EXT_texture_webp`, `loadTextureImage`, `assignTexture`, alpha modes, texture channels, KHR texture transforms, and physical material handlers remain active. Image errors fail the GLB rather than silently accepting missing maps.

Standalone textures are physically flipped vertically to match ordinary TextureLoader image upload, then represented with `DataTexture.flipY=false`; glTF source rows remain unflipped, as required by GLTFLoader. Set ordinary texture filter/mipmap defaults explicitly because DataTexture defaults are nearest/no mipmaps. RGBA alpha is preserved, not premultiplied. No image resizing occurs.

All nine GLBs use `EXT_texture_webp`; island and syringa families also use `KHR_texture_transform`. Island branches include physical-material IOR/specular extensions. Syringa far has a PNG canopy alpha bake. All GLBs embed their images and buffers. No Draco, KTX2, meshopt, or Worker decoder is required. Do not recreate these as generic MeshStandardMaterials.

## Renderer boundary

Prefer calling unchanged `createEngine(canvas)` from `src/render/engine.ts` using a canvas facade whose `getContext('webgl2', options)` returns the native context, and which provides `width`, `height`, `style`, `addEventListener`, and `removeEventListener`. Three may also inspect `getAttribute` / `setAttribute`; implement those as needed by the facade. Never call `engine.resize`, since it reads `window`. Set renderer size and camera aspect explicitly.

`createEngine` establishes exact production state: output SRGB, ACES filmic tone mapping, exposure 1.08, PCF shadows, background `0xa4a89a`, exponential fog `0x9daca7` at density `.00052`, perspective FOV 54, near `.4`, far 22000. Native context creation should request preserved opaque antialiased drawing buffer if supported. If native MSAA is unavailable, report that image edge coverage can differ, particularly foliage `alphaToCoverage`; do not alter the production material.

The native extension report selects existing production HDR/fallback branches. `EXT_color_buffer_float` enables half-float water refraction and PMREM environment generation. If unavailable, production uses encoded unsigned-byte refraction/sky and a null environment. Do not falsely advertise the extension or remove passes. Keep r185 WebGL2 and native wrapper capability failures separate from scene code.

## Exact source imports

All paths below are relative to `/workspace/sites/last-light-bay/src/`:

```js
import { createEngine, tiers } from './render/engine.ts';
import { loadTextures } from './world/assets.ts';
import { createTerrain, createRocks } from './world/terrain.ts';
import { createCoastalField } from './world/coastal-field.ts';
import { createAtmosphere } from './world/atmosphere.ts';
import { createOcean } from './world/ocean.ts';
import { createRockSpray } from './world/spray.ts';
import { createGroundCover } from './world/plants.ts';
import { createForestFloor } from './world/forest-floor.ts';
import { createForestStructure } from './world/forest-structure.ts';
import { createVegetation } from './world/vegetation.ts';
import { worldTime, debugMode, createGroundWindDepth } from './render/materials.ts';
import { enableMaterialDiagnostics } from './render/diagnostics.ts';
import { withCloudLighting } from './render/sky-lighting.ts';
import { createRefractionPass } from './render/refraction.ts';
import { applyCinematic, evaluationCameras } from './camera/cinematic.ts';
```

## Exact assembly and frame sequence

```js
const tier = 'high'; // or requested balanced/low; capture itself uses DPR 1
const { renderer, scene, camera, shaderErrors } = createEngine(canvas);
renderer.setPixelRatio(1);
renderer.setSize(width, height, false);
camera.aspect = width / height;
camera.updateProjectionMatrix();
const refraction = createRefractionPass(renderer);
renderer.shadowMap.autoUpdate = false;
const progress = (percent, label) => console.log(percent, label);
const textures = await loadTextures(progress);
scene.add(createTerrain(textures));
const rocks = createRocks(textures);
scene.add(rocks);
// Exactly the Worker computation, reusing visible seeded rock geometry.
// createCoastalField does not mutate that geometry or require rendering.
const field = createCoastalField(rocks);
const atmosphere = createAtmosphere(renderer);
scene.add(atmosphere.group);
const ocean = createOcean(field);
scene.add(ocean.group);
const spray = createRockSpray(field);
scene.add(spray);
const cover = createGroundCover(textures);
scene.add(cover);
const diagnosed = new Set();
cover.traverse(object => {
  if (object instanceof THREE.Mesh) {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof THREE.MeshStandardMaterial && !diagnosed.has(material)) {
        enableMaterialDiagnostics(material); diagnosed.add(material);
      }
    }
  }
});
const vegetation = await createVegetation(progress);
scene.add(vegetation.group);
cover.add(createForestFloor(textures, vegetation.placements));
const forestStructure = createForestStructure(textures, vegetation.placements);
cover.add(forestStructure.group);
scene.traverse(object => {
  if (object instanceof THREE.Mesh && object.castShadow &&
      object.material instanceof THREE.MeshStandardMaterial &&
      typeof object.material.userData.windBark === 'boolean') {
    object.customDepthMaterial = createGroundWindDepth(object.material);
  }
});
const cloudMaterials = new Set();
scene.traverse(object => {
  if (object instanceof THREE.Mesh) {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof THREE.MeshStandardMaterial && !cloudMaterials.has(material)) {
        enableMaterialDiagnostics(material);
        withCloudLighting(material);
        cloudMaterials.add(material);
      }
    }
  }
});
vegetation.setTier(tier);
renderer.shadowMap.enabled = tier !== 'low';
atmosphere.sun.shadow.mapSize.setScalar(tiers[tier].shadow || 512);
atmosphere.sun.shadow.map?.dispose();
atmosphere.sun.shadow.map = null;
renderer.shadowMap.needsUpdate = true;
cover.visible = tier !== 'low' && debugMode.value !== 12;

function chooseCamera(time, name) {
  if (name && evaluationCameras[name]) {
    const preset = evaluationCameras[name];
    camera.position.copy(preset.position);
    camera.up.set(0, 1, 0);
    camera.lookAt(preset.target);
    camera.fov = 54;
    camera.updateProjectionMatrix();
  } else applyCinematic(camera, time);
}
function draw(time, name) {
  renderer.info.reset();
  worldTime.value = time;
  chooseCamera(time, name);
  atmosphere.update(renderer, camera.position, time);
  scene.environment = debugMode.value === 5 ? null : atmosphere.environment;
  scene.environmentIntensity = .65;
  vegetation.update(camera.position);
  renderer.shadowMap.needsUpdate = true;
  refraction.render(scene, camera, ocean.group, spray);
  renderer.render(scene, camera);
  if (shaderErrors.length) throw Error(shaderErrors.join(' | '));
}
```

Before first capture, choose the initial camera, call vegetation/atmosphere updates, assign environment and intensity, `await renderer.compileAsync(scene,camera)` and `await refraction.compile(scene,camera)`. Production warms cinematic times `[0,3,7,11,15,19]` and then draws the requested time/preset. There is no simulation integration: shader time and camera/LOD are absolute. Worker avoidance changes CPU scheduling only. A preset normally uses `evaluationCameras[name].time`.

Read pixels only after both refraction and final scene rendering. Default framebuffer readback is bottom-up; vertically flip the captured output once before PNG encoding. Keep this separate from source image orientation. Preserve all geometry, tiers, source transforms, and shaders; lowering resolution for a smoke frame is safe, changing mesh subdivisions or suppressing atmosphere/refraction is not an exact-scene render.

## Validation status

`native-asset-audit.json` is produced by a CPU-only decode audit of all fourteen standalone material textures and all nine production GLBs. It records material classes, alpha thresholds, maps, image dimensions, color spaces, and UV offset/repeat values, asserting that expected maps and KHR transforms survived. GPU upload, native MSAA, driver shader compilation, and final image rendering remain the root harness's validation boundary.
