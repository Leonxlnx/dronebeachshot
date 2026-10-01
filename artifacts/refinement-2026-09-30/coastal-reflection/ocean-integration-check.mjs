// Small CPU math/source check; no renderer, WebGL context or GLSL compilation.
// node --no-warnings --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs artifacts/refinement-2026-09-30/coastal-reflection/ocean-integration-check.mjs
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import * as THREE from 'three';
import {updateCoastalReflectionCamera,coastalReflectionPass,coastalReflectionSeaLevel} from '../../../src/render/coastal-reflection.ts';
import {withAerialPerspective} from '../../../src/render/aerial-perspective.ts';
const eye=new THREE.Vector3(0,8,-20),point=new THREE.Vector3(0,0,0),coast=new THREE.Vector3(0,6,15);
const camera=new THREE.PerspectiveCamera(54,16/9,.4,22000);
camera.position.copy(eye);camera.lookAt(point);camera.updateMatrixWorld();
const mirror=new THREE.PerspectiveCamera(),texture=new THREE.Matrix4(),inverseVP=new THREE.Matrix4();
assert.equal(updateCoastalReflectionCamera(camera,mirror,texture,inverseVP),true);
function project(p,w=1){const h=new THREE.Vector4(p.x,p.y,p.z,w).applyMatrix4(texture);return h.multiplyScalar(1/h.w);}
const flat=project(point),land=project(coast);
assert.ok(Math.hypot(flat.x-land.x,flat.y-land.y)<1e-12);
const reconstructed=new THREE.Vector4(flat.x*2-1,flat.y*2-1,land.z*2-1,1).applyMatrix4(inverseVP);
reconstructed.multiplyScalar(1/reconstructed.w);
assert.ok(new THREE.Vector3(reconstructed.x,reconstructed.y,reconstructed.z).distanceTo(coast)<1e-9);
const ray=point.clone().sub(eye).normalize().reflect(new THREE.Vector3(0,1,0));
const reprojection=point.clone().addScaledVector(ray,point.distanceTo(coast));
assert.ok(reprojection.distanceTo(coast)<1e-12);
const directional=project(ray,0);
assert.ok(Math.hypot(directional.x-flat.x,directional.y-flat.y)<1e-12);
const coastRay=coast.clone().sub(mirror.position),waterHit=(0-mirror.position.y)/coastRay.y;
const fogOrigin=mirror.position.clone().addScaledVector(coastRay,waterHit);
assert.ok(fogOrigin.distanceTo(point)<1e-12);

const material=new THREE.MeshStandardMaterial();withAerialPerspective(material);
const shader={uniforms:{},fragmentShader:'#include <common>\n#include <fog_fragment>\n#include <tonemapping_fragment>'};
material.onBeforeCompile(shader,{});
assert.equal(shader.uniforms.uCoastalReflectionPass,coastalReflectionPass);
assert.equal(shader.uniforms.uCoastalReflectionSeaLevel,coastalReflectionSeaLevel);
assert.equal(coastalReflectionPass.value,0);
assert.match(shader.fragmentShader,/else\{\s*gl_FragColor.rgb=bayAerialPerspective\(gl_FragColor.rgb\/uSceneCaptureScale,\s*cameraPosition,vLightingWorld,uSolarDirection,fogDensity\)\*uSceneCaptureScale;/);
material.dispose();

const sourcePaths=['src/render/aerial-perspective.ts','src/world/ocean.ts','src/render/coastal-reflection.ts'];
const sources=Object.fromEntries(sourcePaths.map(p=>[p,readFileSync(new URL('../../../'+p,import.meta.url),'utf8')]));
for(const [fileName,source] of Object.entries(sources)){
 const result=ts.transpileModule(source,{fileName,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
 assert.equal(result.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
}
const ocean=sources['src/world/ocean.ts'];
assert.match(ocean,/if\(uCoastalReflectionReady>\.5\)reflection=coastalReflectedRadiance/);
assert.match(ocean,/uniforms:\{\.\.\.material.uniforms,uSurfaceMode:\{value:mode\}\}/);
assert.match(ocean,/ray.y>0\./);
assert.doesNotMatch(ocean,/texture(?:2D|Lod)\(uCoastalReflectionColor[^;]*\.(?:a|rgba)\b/);
const report={kind:'CPU math and source checks only',passed:[
 'Flat water point and real reflected coast project to the same UV',
 'Coast reconstructed using inverse clipped VP matches the original point',
 'Depth-guided reflected ray reduces to exact mean-plane mapping for an up normal',
 'Sky direction projection agrees with mean-plane mapping',
 'Per-fragment aerial origin is the actual mean-plane intersection',
 'Aerial default flag is zero, uniform objects are shared, ordinary branch retains original expression',
 'Ready guard, shared ocean surface uniforms and downward-ray fallback are present; target alpha is unused',
 'Three changed TypeScript files transpile without syntax diagnostics'],
 sourceSha256:Object.fromEntries(Object.entries(sources).map(([p,s])=>[p,createHash('sha256').update(s).digest('hex')])),
 limits:['No WebGL context, GLSL compile, target readback, full-scene frame, timing or art acceptance.','Wave-normal reprojection is one approximation from a mean-plane capture; it does not trace wave intersections or new disocclusions.']};
writeFileSync(new URL('./ocean-integration-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
