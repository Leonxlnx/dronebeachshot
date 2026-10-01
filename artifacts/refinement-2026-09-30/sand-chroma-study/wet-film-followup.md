# Conditional follow-up: damp sand versus surface film

Proposal only. Keep this separate from the first sand-chroma comparison. No source was changed and no image was rendered for this follow-up.

The actual candidate10 shore frame shows a broad smooth gray-taupe strip. Its appearance alone does not prove whether the low-chroma albedo or reflected sky dominates. There is, however, a concrete material coupling worth addressing **if the palette pair still leaves excessive gray gloss**: `sandWetness` retains moisture with an 18 s exponential history, and `exposedFilm=wet*sediment*smoothstep(-.25,.10,gp.y)` uses that same persistent value to drive roughness toward `.20`.

The runup carrier period is approximately 4.19 s (`2π/1.5`). A fully wetted sample 4.2 s old still contributes `exp(-4.2/18)=0.792` to the current film. Thus repeated waves can maintain most of the smooth film response across the whole damp band even when the actual ocean sheet has retreated.

## One bounded variant

Keep the existing 18 s history for darkened damp albedo. Compute a separate short-lived **glossy film weight** from the same runup, the same 21 historical ages (`i*.6`), and the same coverage function:

```glsl
float age=float(i)*.6;
float reach=runup(x,t-age);
float coverage=1.-smoothstep(reach-.3,reach+1.,d);
damp=max(damp,coverage*exp(-age/18.));     // existing darkening
film=max(film,coverage*exp(-age/1.5));    // proposed drainage response
```

Use `film` only in the existing exposed-film roughness mask; preserve the `.20` endpoint, sediment/height masks, source ARM, normal detail, `.61` damp darkening, actual ocean film/coverage, refraction, and lighting. The 1.5 s value is an authored study timescale, **not a measured drainage constant**. It should remain a separate default-off control until judged.

This has useful bounds: `0 ≤ film ≤ damp ≤ 1`; dry sand and currently fully covered sand retain their existing endpoints. After recession it only increases roughness back toward the source granular roughness. It does not bleach damp sand or create a second water color.

The source sand ARM mean roughness is approximately `.835` (mean stored green channel `212.927/255`; ARM is linear). For an isolated fully wetted event and full sediment/height mask, the illustration below excludes later rewetting and does not predict final rendered pixels:

| Event age | Current film weight | Proposed film weight | Current roughness, source .835 | Proposed roughness |
| --- | --- | --- | --- | --- |
| 0 s | 1.000 | 1.000 | .200 | .200 |
| 1.2 s | .936 | .449 | .241 | .550 |
| 2.4 s | .875 | .202 | .279 | .707 |
| 4.2 s | .792 | .061 | .332 | .796 |

The expected art benefit is a retained dark beige damp band with a narrower moving reflective swash. It cannot fix the broad geometric strip or grain that has become subpixel. The existing 0.6 s history sampling, transition during recession, and max-history switching require an actual short motion review; a static improvement alone is insufficient. Reject a chalky exposed band, a sudden sheen cutoff, or visible roughness pulsing. Because the current ocean already renders the water sheet, changing its reflection or Fresnel simultaneously would confound this material study.
