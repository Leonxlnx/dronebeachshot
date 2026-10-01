# Coastal reflection footprint correction

The prior full-scene reflection study is rejected: bright internal slit segments were byte-identical to reflection OFF, consistent with the hard perturbed-ray horizon gate. The corrected implementation remains default OFF and awaits root’s actual image acceptance.

Flat control now uses the mean-plane ray. Wave mode estimates its actual pixel/angular footprint, integrates positive horizon support, and samples a positive conditional representative. Projected covariance drives both color LOD and finite-capture overlap; clipped sample centroids stay within the capture. Mip reconstruction moments use actual NPOT levels and continuous trilinear weights. New derivatives execute before varying discards in a uniform ON branch, reusing the water normal afterward. The OFF normal, neighboring-water bounce and cubemap fallback retain their existing arithmetic.

Five focused numerical tests pass: numerical horizon integration, numerical rectangle integration/edge continuity, positive sample directions, NPOT bilinear/trilinear moments, and combined covariance versus principal-axis search. TypeScript and CPU evaluation of the actual fixture’s extracted shader module pass. No browser, GPU render, build or commit was performed for this correction. Exact changed files and hashes are in the adjacent JSON.

This is an explicit moment approximation. Scalar slope variance lacks directional covariance; the conditional representative and separable capture coverage do not exactly integrate a microfacet lobe or its joint clipping constraints. The existing depth proxy cannot recover hidden geometry or trace secondary waves. Real shader compilation, OFF restoration equality and visual quality remain pending.
