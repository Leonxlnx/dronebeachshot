# Last Light Bay: coastal physics audit

Read-only audit of `src/world/ocean.ts`, `terrain.ts`, `atmosphere.ts`, `render/materials.ts`, with supporting reads of `math.ts`, `plants.ts`, and render setup. No Site files changed. Findings below follow directly from shader/code dependencies; no rendered appearance was verified because graphics runtime access was unavailable.

## Five prioritized repairs

### 1. Fix the incoming breaker direction, then conserve frequency through shoaling

**Certain code defect.** `ocean.ts` uses `dot(p,dir)*k - t*sqrt(9.81*k)` for offshore waves, whose directions all have positive z. But both shallow height and breaking foam use `d*.33 + t*1.5`, with positive shore distance d on land. At constant phase, `dd/dt = -1.5/.33 = -4.545` units/s: these crests travel offshore. Minimum repair: use one shared `breakerPhase(p,t)` with `d*.33 - t*1.5 + ...` in height, foam, runup timing, and impact gating.

The depth model currently estimates depth from `-d*.095`, while the wave solver uses the deep-water relation everywhere. For a more coherent inexpensive approximation, preserve each component's frequency, solve `omega² = g*k*tanh(k*h)` for local k from depth h, and accumulate spatial phase along shore-normal distance; do not simply multiply local k(d) by d because its derivative introduces an unintended extra wave number. In shallow water, travel-time phase `phi(d,t) = integral(omega/sqrt(g*h(s))) ds - omega*t` gives onshore travel and decreasing crest spacing. Blend phases through a transition band, rather than superimposing an unrelated fixed-frequency shallow oscillator. The stated dispersion and shallow-water limit are documented in [MIT marine hydrodynamics, water waves](https://ocw.mit.edu/courses/2-20-marine-hydrodynamics-13-021-spring-2005/5d48a5937971d973fd8ca90c051a83f8_lecture20.pdf).

Use depth-linked amplitude/breaking masks, with a tunable upper wave-height ratio near `H/h ≈ 0.8`, instead of a fixed 3–42 unit band alone. This is an artistic implementation of depth-limited breaking, not an engineering model. [TxDOT wave dynamics guidance](https://www.txdot.gov/manuals/des/hyd/chapter-15--coastal-hydraulic-design/section-4--waves---currents.html) supports the approximate depth limit, onshore shoaling, refraction, and lower energy in sheltered zones.

### 2. Make runup, backwash, normals, and wet sand use one shoreline flow

**Certain disconnection.** Water runup is `2.9 + 2.6*sin(.8t+.012x) + .7*sin(1.3t-.035x)`; terrain wetness independently uses `3.5 + 2.7*sin(...) + .8*sin(...)`. Neither is phase-coupled to the 1.5 rad/s breaker. The `flow = p*1.6 + vec2(sin(.3z),.7t)` foam texture drifts in global negative z regardless of shoreline curvature or whether wash is advancing.

Proposed shared GLSL interface: `shoreNormal(p)`, `breakerPhase(p,t)`, `runup(p,t)`, `runupVelocity(p,t)`, `wetness(p,t)`. The existing curve permits a first-order landward unit normal `n = normalize(vec2(-shoreZDerivative(x),1))`. Use a smooth faster advancing/slower retreating runup cycle and set cross-shore fluid velocity to `u = n*dRunup/dt`; use its integrated displacement in foam coordinates. This gives foam forward motion during uprush, deceleration near maximum runup, then seaward drainage. Backwash should be most visible behind the receding front, not as the sole direction of all breaker foam.

Use the same runup function for clipping and wetting. For deterministic timeline scrubbing, approximate wetness memory with several historical samples, e.g. `max_i(wetAt(t-i*dt)*exp(-i*dt/tau))`, rather than a simulation state requiring prior frames. Keep sand wet briefly after water retreats. Runup comprises time-varying swash plus setup and depends on wave height, period, and beach slope: [USGS explanation](https://www.usgs.gov/centers/spcmsc/science/storm-impact-scale), [Stockdon et al. 2006 publication](https://pubs.usgs.gov/publication/70030520).

Also repair water normals over land: the vertex shader conforms water height to the sand profile for d>0, but `waterNormal` differentiates offshore `swell` only. Use the derivative of the actual water-height function, then add only a fading micro-normal on the thin wash film.

### 3. Couple impact foam to the actual rock instances

**Certain absent feature.** `createRocks()` creates five groups of up to 290 instances. No rock positions, dimensions, bathymetry mask, SDF, or scene depth enter `createOcean()`. Consequently foam cannot respond to individual rock contacts. Random offshore rocks at d down to -45 have the same foam calculation as empty water.

Practical repair: when placing rocks, also record waterline intersections as ellipses. Bake the nearshore subset into a small world-aligned obstacle-distance/height texture. Compute boundary foam from `exp(-abs(sdf)/width)`, pulse it with the local incoming crest, and weight the seaward-facing side by `max(dot(rockOutwardNormal,-waveDirection),0)`. Add a weaker delayed residual ring and a lee attenuation mask. Keep the result sparse: do not place identical always-white rings around all rocks. This is an approximation; the primary physical cues are impact, reflection, wrapping, and shelter. [NWS nearshore-model physics](https://www.weather.gov/akq/NWPS) explicitly includes obstacle transmission, reflection, diffraction, breaking, and dissipation.

For geology, coherent joint directions and weathering families are more useful than five independently noisy ellipsoids. A humid South China analogue can reasonably use weathered granite with rounded residual blocks or resistant volcanic rock with more angular outcrops. [Hong Kong CEDD geology](https://hkss.cedd.gov.hk/hkss/en/publications-and-resources/educational-materials/hong-kong-geology/chapter-6/index.html) documents the granitic/volcanic framework; [CEDD weathering comparison](https://www.cedd.gov.hk/eng/about-us/organisation/geo/pub_info/memoirs/geology/eco/index.html) describes more rapid granite deterioration in humid conditions. These establish an analogue, not a claimed location for the fictional bay.

### 4. Put vegetation and cloud advection in explicit world wind coordinates

**Certain transform defect.** `windMaterial()` alters `transformed.x/z` before each instance's random yaw is applied. Thus a common local +x bend becomes different world directions for differently rotated grass clumps. Derive a world wind displacement, transform it into instance-local coordinates using the inverse instance rotation/scale, or apply displacement after world transformation. Keep root strength zero and use normalized plant height with a bounded tip amplitude; `pow(position.y/1.6,2)` should not be reused for tall geometry without a height parameter.

Cloud density samples use `p.xz += vec2(1.6,.4)*t`, so features move toward world `(-1.6,-.4)`. Name the intended velocity explicitly and use `density(p - wind*t)`. A shared baseline direction can coordinate exposed grasses, leaves, and surface ripples, with shelter/turbulence and separate aloft speed. Do not require swell direction or cloud speed to equal surface wind: the [Hong Kong Observatory](https://www.hko.gov.hk/en/education/weather/wind-and-pressure/00111-the-origin-of-wind.html) describes terrain-modified local wind and reduced flow over land.

### 5. Share sky radiance and cloud attenuation with water and direct light

**Certain missing coupling, visual severity unverified.** The atmosphere ray marches clouds; ocean `skyReflect()` is a plain static vertical gradient. Cloud occlusion never attenuates the 3.1-intensity directional light or the water's solar glint. The same sun direction is already used in all systems, which is a good shared foundation.

Extract shared sky/cloud functions. A few coarser cloud samples along reflection rays will make broad cloud forms agree in sky and water; attenuate solar glint with cloud transmittance along the sun ray. If adding moving cloud shadows to terrain, use that same density and velocity field. Avoid a second unrelated shadow noise. Keep the expensive full sky march off water pixels unless profiling permits it. Also align ocean aerial perspective with scene fog: land uses Exp2 fog with density .00052 and green-gray color, while water uses linear optical-depth exponential .00016 and warm gray. Different formulas and colors currently guarantee different distant haze responses.

## Compact source shelf for ecology and landscape

- [NOAA maritime forests](https://oceantoday.noaa.gov/maritimeforests/): shrubs tolerate the exposed edge, larger trees occur progressively inland; supports an exposure gradient rather than uniform forest height.
- [NPS salt-spray dynamics](https://www.nps.gov/places/the-sunken-forest-tour-salt-spray-dynamics.htm): topographic protection and salt pruning; transferable process, not a prescription for Atlantic species in a South China analogue.
- [USGS pocket-beach research](https://www.usgs.gov/publications/seasonal-rotation-california-pocket-beaches): headland-bounded beaches respond to changing incoming wave direction; supports a contained bay beach and coherent wave approach.
- [USACE Coastal Engineering Manual Part II](https://www.publications.usace.army.mil/Portals/76/Publications/EngineerManuals/EM_1110-2-1100_Part-02.pdf): comprehensive reference for water-wave mechanics and transformations. Link confirmed from the official index; full PDF was too large for the web reader.
- [USGS observed runup dataset](https://pubs.usgs.gov/ds/602/): useful future reference for real time-series shapes; catalogue search verified, direct fetch returned 403.

## Targeted verification after implementation

1. At fixed shore-normal sample points, track a shallow crest over increasing t and assert positive d motion until dissipation.
2. Compare clipping reach, foam edge, and wetness at several times around maximum runup; retreat must leave a decaying wet strip.
3. Compare two identical grass instances with yaw 0 and pi/2: the world-space displacement vectors should approximately agree.
4. In eventual rendered QA, use foam/normals/direct-light/environment modes at the bay center, each rocky flank, and a grazing sun reflection angle. Check temporal sequences, not a single frame.

No test runs or visual passes are claimed by this audit.
