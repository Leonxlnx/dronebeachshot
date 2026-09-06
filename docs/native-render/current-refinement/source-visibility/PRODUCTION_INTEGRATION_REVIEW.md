# Production source visibility integration review

Read-only review of `/workspace/sites/last-light-bay` after both-family integration. No renderer or production edits. Shader hooks were composed on CPU using the actual production constructors and the same outer diagnostics/cloud/aerial wrappers used by `main.ts`.

## Concrete correction

**Visibility textures are missing from explicit teardown.** `main.ts` pagehide cleanup collects direct material texture properties and `ShaderMaterial.uniforms`. `uSourceSunVisibility` is held inside a `MeshStandardMaterial.onBeforeCompile` closure, so both new RG8 resources escape this texture Set. Add each `vegetation.farTextures[i].visibility` to the existing Set before disposal. This is a lifecycle issue; it does not explain the rendered landscape. The browser will normally reclaim a destroyed page's context, but the app's explicit cleanup does not release these resources itself.

The two families are correctly shared across core/distant materials; dispose once per family, not once per cell. CPU arrays remain reachable through `farTextures` until that owner is released. Existing filtered normal uniforms have a similar closure-only lifecycle concern predating this change.

## Correct integration paths

- Both `/assets/impostors/{island,syringa}-visibility.rg8` files exist and each contains 6,291,456 bytes. Bytes and manifest hashes equal the vetted candidates: Island `511289cba41882d4d417c23b7081bfd5971242c879041f08ffb97bceeeb7017d`; Syringa `fcc1b601ed813ced3b6a7016e5d8fafbc5000f7baf819a4dd706ff29d060d63b`.
- Current tree metadata is exact SHA `bdd6f275f338429d72b04db484b72ac4b98ff80fe748d9a6355f18ca8e234e2b`; geometry/framing preflight is unchanged.
- The fifth `createTreeImpostor` argument carries the matching family texture from both core far and distant forest call sites. Binding occurs once on the lit material, after impostor setup. Depth coverage does not acquire the visibility factor.
- CPU composition checks pass for both families: one visibility function/call, the correct family texture, shared actual solar-direction object, direct physical and thin-leaf transmission attenuation, existing cloud attenuation and aerial perspective, unchanged map UV/alpha path, and `treeWorld` declared before inverse transformation. Proof and composed GLSL: `production-shader-review.json`, `production-{island,syringa}-shader.{vert,frag}`.
- Three's local `WebGLTextures` chooses RG8 for RGFormat + UnsignedByteType; no sRGB conversion, no row flip, no RGBA image decoding. Loader checks HTTP success and exact byte length. HTTP hosting behavior itself was not tested in this read-only review.
- Sun direction is from surface toward the actual directional sun. `inverse(mat3(treeWorld))` gives the correct source-space ray for actual instance transforms; azimuth orientation and wrapping are correct for the tested remote yaw/uniform-scale instances.

## Approximations and bounded follow-up

**Core far transforms change source-relative sun elevation.** Exact CPU reconstruction of 13,861 current non-palm root transforms gives local elevation 4.1429°–6.7379°, median 5.4761°, while the atlas fixes elevation at 6.02165°. The inverse transform is correct; eight azimuths cannot reproduce this elevation change. This remains an approximation for tilted/stretched core instances, rather than a demonstrated visible regression. Remote pure-yaw uniform-scale instances retain the baked elevation exactly. `core-sun-transform-review.json` records the result. Do not claim the core poses have the same validation as the remote specimens.

**Deep mips mix neighboring atlas cells.** A CPU box-mip/bilinear diagnostic compared the global Island atlas with isolated tile boundary sampling. At 16- and 8-texel view cells, there was no difference on covered samples. At 4 texels per view, coverage-weighted mean difference was 0.000083 in visibility; at 2 texels it was 0.0271, and at 1 texel it was 0.0205. Isolated extreme samples differ more. This is a tiny/far-crown limitation, not evidence for the former overall golden canopy. No mip patch is recommended before the current full-scene result identifies an actual visible problem. Evidence: `visibility-mip-review.json` (CPU filtering approximation, not GPU image output).

**Loading can start sooner.** The two species load concurrently, but within each species albedo, normal, and visibility are awaited serially. These three independent reads could use `Promise.all` so the new binary starts with the images, reducing the extra startup dependency. This is a small startup optimization, not a correctness blocker.

No other concrete integration defect was found. The native full-scene check remains the right next visual gate; this code review is not a browser or performance acceptance.
