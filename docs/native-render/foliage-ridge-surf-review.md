# Native foliage, ridge, surf and sampling review — incomplete

These are actual native ANGLE/Mesa renders of production Three.js modules. They are not accepted browser cycles, consumer FPS, final 4K stills or the final film. The visual target is still unmet.

## Integrated changes

- Linear alpha-weighted leaf RGB filtering removes bright transparent padding from mip colors. Actual source texture alpha bytes and source leaf geometry remain unchanged.
- Far Island/Syringa crowns use 8 azimuth × 3 elevation atlases baked from the original near meshes. Continuous four-view interpolation replaces nearest-view switching. Encoded normal RGB is alpha-weighted before filtering, then recovered before decoding. Native boundary controls change 0–3 significant pixels instead of 55–115; 24 color/depth coverage controls match.
- Far atlas color uses alpha-to-coverage when a multisampled framebuffer is available. Near layered leaf cards retain alpha hashing: testing found that shared A2C masks lose 20–42% of leaf-union area in the tested near views. Single-sample shadow maps retain alpha hashing. Near-grain/temporal stability remains open.
- Connected ridge spines, drainage, broader shoulders and a short crest replace isolated radial cones. The first narrow ridge produced an unacceptable needle and was superseded. The actual 2 m crest is 313 m at(-120,354). Full-scene shoulders still have broad smooth faces and sparse-looking crowns; no geometry quality approval.
- A quintic camera height correction provides smooth continuous descent, with the original beach/sea path restored at11.5 s. Exact vertical extrema and 1,201 route clearance samples are documented in candidates/ridge-shoulder. Total speed remains aggressive; four route frames do not establish full temporal motion quality.
- Breaking-energy groups and metre-scale foam rafts interrupt coast-wide white rails. Existing phase, displaced water, runup, wetness, swash geometry and the soft refraction film edge remain unchanged.
- Sun/hemi balance and reduced shadow bias improve readable light/shade separation without lowering mean luminance in the paired native ROIs. The change is modest. Static shadow coverage and crown structure remain open.
- A deterministic 64-component directional micro-normal spectrum replaces eight sparse bands. The aerial regular glitter grid becomes irregular connected highlights in the isolated water comparison; unfiltered slope RMS remains0.138564. Shared displacement and shoreline behavior are unchanged. Full-scene water review and hardware cost remain to be checked.

## Actual reviewed full-scene views

Root inspected far-impostors mountain-wide/flight-0/headland/canopy-close; shoulder-ocean mountain-wide; shoulder-ocean-retry headland/breaking-wave-side/wet-sand; shoulder-flight0/5/9/11.5; and a1920×1080 headland frame after the lighting change. All completed frame sidecars record shader errors[] and GL error0. Headland still looks granular and sparse at1920, so low diagnostic resolution does not explain all visible failures.

The full-scene ocean/ridge and flight images precede the64-wave normal spectrum. Isolated before/after water views are in candidates/ocean-spectrum-study; do not imply that older full-scene images contain that later change.

## Diagnostic output correction and interrupted work

Native surfaceless default buffers have zero MSAA samples. An explicit4-sample offscreen target was added. The first RGBA8 offscreen implementation omitted tone mapping; ridge-four-view and ridge-coverage are invalid for color/exposure acceptance and are marked accordingly. The corrected path uses linear HalfFloat MSAA followed by official Three OutputPass. A native HDR palette control matches production default-framebuffer ACES/sRGB bytes exactly for all tested colors, with0 shader/GL errors.

Shared filesystem exhaustion interrupted shoulder-ocean during headland PNG encoding. Only mountain-wide completed. The partial PNG was removed and the three remaining views were recaptured successfully in shoulder-ocean-retry. Reproducible caches and an already-saved archive copy were removed; no source asset or unique evidence was discarded.

Cloud-volume prototypes remain scratch candidates. A deterministic3D noise lattice and separated cumulus volumes compile, but the images remain too soft, repetitive or granular. They are not integrated and not accepted as realistic clouds.

## Remaining visual failures

Forest crown density/structure, temporal foliage stability, exposed hero rock surfaces, smooth broad slopes, distant land detail, cloud form/lighting, pale/cyan sun glitter, beach sediment detail and full continuous motion still fail the reference standard. Final browser availability, offline/mobile checks, consumer performance, all final artifacts, eight genuine browser cycles and the required86,400 verified active seconds remain open. No final publish or main push has occurred.
