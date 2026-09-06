// Pure source transform for root integration. Does not read/write the checkout.
// The three exact replacements preserve evolving cloud imports/uniforms/code.
export const lightingParameterEdits = [
  ['export const atmosphereLighting={sunIntensity:3.6,skyIntensity:1.15};',
   'export const atmosphereLighting={sunIntensity:4.4,skyIntensity:.65};'],
  ['new THREE.DirectionalLight(0xffbd75,atmosphereLighting.sunIntensity)',
   'new THREE.DirectionalLight(0xffd1a1,atmosphereLighting.sunIntensity)'],
  ['sun.shadow.bias=-.00025;sun.shadow.normalBias=1.1;',
   'sun.shadow.bias=-.00004;sun.shadow.normalBias=.25;'],
];
export function patchAtmosphereLighting(source) {
  for (const [before, after] of lightingParameterEdits) {
    if (source.includes(after) && !source.includes(before)) continue;
    if (source.split(before).length !== 2) throw Error('Lighting parameter anchor changed: '+before);
    source = source.replace(before, after);
  }
  return source;
}
