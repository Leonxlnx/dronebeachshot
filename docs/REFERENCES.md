# Reference and implementation sources
Accessed 2026-09-05. User-provided visual references are analyzed in ART_BIBLE.md; they are not redistributed as public production imagery.

## Three.js
- Exact installed runtime: three 0.185.1, from author-published npm package https://www.npmjs.com/package/three . The latest GitHub release family is r185: https://github.com/mrdoob/three.js/releases/tag/r185 . Online documentation may be dev-ahead; installed source governs shader APIs.
- https://threejs.org/docs/pages/WebGLRenderer.html — WebGL2 requirement, renderer statistics, output color space, compileAsync and shader-error callback.
- https://threejs.org/manual/en/webgpurenderer.html — WebGPU route remains experimental; ShaderMaterial/onBeforeCompile/EffectComposer are not supported there. Chosen architecture: WebGLRenderer + GLSL. This is an implementation choice, not a universal performance claim.
- https://threejs.org/docs/pages/InstancedMesh.html — aggregate bounds, instance matrices/colors and culling constraints.
- https://threejs.org/docs/pages/Material.html — shader hooks, program cache keys, alpha testing/coverage and foliage double-side costs.
- https://threejs.org/docs/pages/Object3D.html — matching depth material for wind-displaced shadow casters.
- https://threejs.org/docs/pages/Water.html — official flat reflection baseline; separate displacement and shoreline system required for requested behavior.
- https://threejs.org/docs/pages/Sky.html — atmospheric reference; this project implements a spatially sampled cloud slab rather than a panorama.
- https://threejs.org/manual/en/shadows.html and https://threejs.org/docs/pages/CSM.html — shadow cost and distance management.
- https://threejs.org/docs/pages/GLTFLoader.html and https://threejs.org/docs/pages/KTX2Loader.html — supported extensions and optional compression loaders. This project embeds WebP images and requires no Draco or Meshopt decoder at runtime.
- https://threejs.org/docs/pages/EffectComposer.html and https://threejs.org/docs/pages/OutputPass.html — deterministic postprocessing timing and output conversion reference. Initial implementation renders directly without bloom to avoid hiding defects.
- https://threejs.org/manual/en/tips.html — screenshot capture must render immediately before reading canvas pixels.

## Asset references
See ASSET_LICENSES.md and public/assets/manifest.json for exact source pages, creators, download URLs, modifications and checksums. The CC0 assets are vendored.

## Outstanding research
Additional primary coastal geomorphology, wave shoaling and real-drone movement references remain part of the unfinished refinement work. They have not been claimed as completed.

### Spatial cloud density refinement
- [Guerrilla: Nubis, Authoring Real-Time Volumetric Cloudscapes (2017)](https://www.guerrilla-games.com/read/nubis-authoring-real-time-volumetric-cloudscapes-with-the-decima-engine): primary conceptual reference for separate regional coverage, Perlin–Worley density and cloud illumination. The project uses its own deterministic periodic scalar-noise generator; no presentation images, generator source, or proprietary cloud assets were copied.

- [Three.js Data3DTexture](https://threejs.org/docs/pages/Data3DTexture.html): current raw 3D texture, mip-generation and filtering API, verified during the cloud sampling refinement.
