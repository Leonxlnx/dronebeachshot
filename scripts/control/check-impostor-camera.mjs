// Independent CPU review only. No WebGL context, native render, browser, or network.
// Run: node scripts/control/check-impostor-camera.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
register(pathToFileURL(join(site, 'scripts/control/ts-resolve.mjs')));
const THREE = await import(pathToFileURL(join(site, 'node_modules/three/build/three.module.js')));
const { createTreeImpostor } = await import(pathToFileURL(join(site, 'src/world/tree-impostor.ts')));
const packageJSON = JSON.parse(await readFile(join(site, 'node_modules/three/package.json'), 'utf8'));
assert.equal(packageJSON.version, '0.185.1');

const V = (...xyz) => new THREE.Vector3(...xyz);
const tolerance = 1e-9; // Euclidean distance between unit vectors, in double precision.
let assertions = 0;
let maxError = 0;
let cameraCases = 0;
let oldOrthographicFailures = 0;
function close(actual, expected, label) {
  assert(actual.toArray().every(Number.isFinite), `${label}: finite result`);
  const error = actual.distanceTo(expected);
  maxError = Math.max(maxError, error);
  assert(error < tolerance, `${label}: vector error ${error}`);
  assertions++;
}
function differs(actual, expected, minimum, label) {
  assert(actual.distanceTo(expected) > minimum, `${label}: ineffective negative control`);
  assertions++;
}
function oldFormula(camera, world, center) {
  return new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld)
    .applyMatrix4(world.clone().invert()).sub(center).normalize();
}
function proposedFormula(camera, world, center) {
  if (camera.projectionMatrix.elements[15] > .5) {
    // GLSL is indexed [column][row]; the third ROW is JS elements 2, 6, 10.
    const view = camera.matrixWorldInverse.elements;
    return V(view[2], view[6], view[10])
      .applyMatrix3(new THREE.Matrix3().setFromMatrix4(world).invert()).normalize();
  }
  return oldFormula(camera, world, center);
}
function rayOracle(camera, world, center, explicitNDC) {
  const worldCenter = center.clone().applyMatrix4(world);
  const projected = worldCenter.clone().project(camera);
  const ndc = explicitNDC ?? new THREE.Vector2(projected.x, projected.y);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  // Independently transform Three's actual ray, rather than extracting a view row.
  // Ray.applyMatrix4 uses the full inverse affine transform and its own direction path.
  const localRay = raycaster.ray.clone().applyMatrix4(world.clone().invert());
  return localRay.direction.negate();
}
function object(position, angles, scale) {
  const obj = new THREE.Object3D();
  obj.position.fromArray(position);
  obj.rotation.set(...angles, 'YXZ');
  obj.scale.fromArray(scale);
  obj.updateMatrix();
  return obj;
}
let seed = 0x7b0312e1;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const between = (a, b) => a + (b - a) * random();
const triplet = (a, b) => [between(a, b), between(a, b), between(a, b)];
const worlds = [{ name: 'identity', world: new THREE.Matrix4() }];
worlds.push({name:'off-axis-translation', world:new THREE.Matrix4().makeTranslation(31, -12, 8)});
for (let i = 0; i < 66; i++) {
  const parent = object(triplet(-15, 15), triplet(-2.5, 2.5), i < 2 ? [1, 1, 1] : triplet(.35, 2.8));
  const branch = object(triplet(-12, 12), triplet(-2.5, 2.5), i < 2 ? [1, 1, 1] : triplet(.4, 2.3));
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial(), 1);
  mesh.position.fromArray(triplet(-10, 10));
  mesh.rotation.set(...triplet(-1.6, 1.6));
  const instance = object(triplet(-10, 10), triplet(-3.1, 3.1), triplet(.2, 3.2));
  mesh.setMatrixAt(0, instance.matrix);
  parent.add(branch); branch.add(mesh); parent.updateMatrixWorld(true);
  const storedInstance = new THREE.Matrix4(); mesh.getMatrixAt(0, storedInstance);
  const world = mesh.matrixWorld.clone().multiply(storedInstance);
  assert(world.determinant() > 0, 'positive, nonsingular instance/world transform');
  worlds.push({name:`nested-${i}`, world});
  mesh.geometry.dispose(); mesh.material.dispose();
}

function camera(kind, index) {
  const cam = kind === 'orthographic' ? new THREE.OrthographicCamera(-130, 170, 140, -120, .1, 3000)
    : new THREE.PerspectiveCamera(57, 16/9, .1, 3000);
  const poses = [[180, 115, 260], [-230, 180, 170], [190, 250, -200], [0, 0, 650], [0, 650, 0], [0, -650, 0]];
  cam.position.fromArray(poses[index % poses.length]); cam.lookAt(0, 0, 0);
  if (index < 3) cam.rotateZ(.23 + .47 * index);
  if (index === 1) { cam.zoom = 1.3; cam.setViewOffset(2400, 1600, 700, 200, 1100, 900); }
  if (index === 2) {
    const parent = object([14, 8, -9], [.13, -.18, .08], [1, 1, 1]);
    parent.add(cam); parent.updateMatrixWorld(true);
  }
  if (index === 3) { cam.coordinateSystem = THREE.WebGPUCoordinateSystem; cam._reversedDepth = true; }
  cam.updateProjectionMatrix(); cam.updateWorldMatrix(true, false);
  assert.equal(cam.projectionMatrix.elements[15], kind === 'orthographic' ? 1 : 0);
  return cam;
}
for (const kind of ['orthographic', 'perspective']) for (let index = 0; index < 6; index++) {
  const cam = camera(kind, index);
  for (const {name, world} of worlds) for (const center of [V(0, 0, 0), V(2.5, 11, -4)]) {
    const inCamera = center.clone().applyMatrix4(world).applyMatrix4(cam.matrixWorldInverse);
    assert(inCamera.z < -cam.near, `${name}: center lies in front of camera`);
    const actual = proposedFormula(cam, world, center);
    const oracle = rayOracle(cam, world, center);
    close(actual, oracle, `${kind}/${index}/${name}`);
    cameraCases++;
    if (kind === 'orthographic') {
      for (const xy of [[-.85, .7], [.65, -.45], [0, 0]])
        close(actual, rayOracle(cam, world, center, new THREE.Vector2(...xy)), `parallel ray ${xy}`);
      if (oldFormula(cam, world, center).distanceTo(oracle) > .001) oldOrthographicFailures++;
    } else close(actual, oldFormula(cam, world, center), 'perspective branch preserved');
  }
}

// Explicit orthographic controls isolate camera movement and object translation.
const ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, .1, 1000);
ortho.position.set(0, 0, 100); ortho.lookAt(0, 0, 0); ortho.updateMatrixWorld(true);
const axisWorld = new THREE.Matrix4().makeTranslation(40, 15, 0);
const origin = V(0, 0, 0);
const before = proposedFormula(ortho, axisWorld, origin);
const oldBefore = oldFormula(ortho, axisWorld, origin);
close(before, V(0, 0, 1), 'backward sign on known axis');
differs(before, oldBefore, .3, 'old orthographic off-axis direction');
ortho.position.z = 280; ortho.updateMatrixWorld(true);
close(before, proposedFormula(ortho, axisWorld, origin), 'orthographic camera-axis movement invariance');
differs(oldBefore, oldFormula(ortho, axisWorld, origin), .2, 'old camera-axis movement defect');
const movedObject = new THREE.Matrix4().makeTranslation(-55, 38, -20);
close(before, proposedFormula(ortho, movedObject, V(9, -7, 2)), 'orthographic object translation and center invariance');
const perspective = new THREE.PerspectiveCamera(57, 16/9, .1, 1000);
perspective.position.set(0, 0, 100); perspective.lookAt(0, 0, 0); perspective.updateMatrixWorld(true);
const perspectiveBefore = proposedFormula(perspective, axisWorld, origin);
perspective.position.z = 280; perspective.updateMatrixWorld(true);
differs(perspectiveBefore, proposedFormula(perspective, axisWorld, origin), .2, 'perspective camera-axis motion remains effective');
differs(proposedFormula(perspective, axisWorld, origin), proposedFormula(perspective, movedObject, origin), .3, 'perspective object translation remains effective');

// Negative mutations expose a sign error, a row/column error, and a normal-matrix substitution.
const rolled = camera('orthographic', 0);
const nonuniform = worlds[12].world;
const expected = rayOracle(rolled, nonuniform, origin);
const view = rolled.matrixWorldInverse.elements;
differs(proposedFormula(rolled, nonuniform, origin).negate(), expected, 1.9, 'negative backward sign');
differs(V(view[8], view[9], view[10]).applyMatrix3(new THREE.Matrix3().setFromMatrix4(nonuniform).invert()).normalize(), expected, .05, 'wrong view column');
differs(V(view[2], view[6], view[10]).applyMatrix3(new THREE.Matrix3().getNormalMatrix(nonuniform)).normalize(), expected, .05, 'inverse transpose used for direction');
assert(oldOrthographicFailures > 500, 'old formula demonstrably fails the orthographic sweep');

// Invoke actual production hooks on the actual Three ShaderLib templates.
// This constructs materials and shader text only; it does NOT compile or execute GLSL.
const directionBlock = /vec3 impostorEye=[\s\S]*?(?=\s*vec3 impostorUpReference=)/;
const normalizedExpected = `vec3 impostorEye=(inverse(treeWorld)*vec4(cameraPosition,1.)).xyz;
vec3 impostorDirection=normalize(impostorEye-uImpostorCenter);
if(projectionMatrix[3][3]>.5){
vec3 cameraBackward=vec3(viewMatrix[0][2],viewMatrix[1][2],viewMatrix[2][2]);
impostorDirection=normalize(inverse(mat3(treeWorld))*cameraBackward);
}`;
const normalizeGLSL = s => s.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, '');
const hookEvidence = [];
for (const visibility of [false, true]) {
  const albedo = new THREE.DataTexture(new Uint8Array([80, 120, 30, 255]), 1, 1);
  const normals = new THREE.DataTexture(new Uint8Array([128, 255, 128, 255]), 1, 1);
  const sun = visibility ? new THREE.DataTexture(new Uint8Array([255, 255]), 1, 1, THREE.RGFormat) : undefined;
  const mesh = createTreeImpostor({family:0, center:[1, 5, -2], halfSize:8, bounds:{min:[-5, 0, -4], max:[6, 12, 7]}, columns:8, rows:3}, albedo, normals, 1, sun);
  for (const [pass, material, template] of [['lit', mesh.material, THREE.ShaderLib.standard], ['depth', mesh.customDepthMaterial, THREE.ShaderLib.depth]]) {
    assert.equal(pass === 'depth' ? material.isMeshDepthMaterial : material.isMeshStandardMaterial, true);
    const shader = {uniforms: THREE.UniformsUtils.clone(template.uniforms), vertexShader:template.vertexShader, fragmentShader:template.fragmentShader};
    material.onBeforeCompile(shader, undefined);
    const blocks = [...shader.vertexShader.matchAll(new RegExp(directionBlock.source, 'g'))];
    assert.equal(blocks.length, 1, `${pass}: actual corrected hook injected exactly once`);
    assert.equal(normalizeGLSL(blocks[0][0]), normalizeGLSL(normalizedExpected), `${pass}: actual direction block matches evaluated formula`);
    assert(shader.vertexShader.indexOf('mat4 treeWorld = modelMatrix;') < blocks[0].index, `${pass}: world matrix declared first`);
    assert(shader.vertexShader.includes('treeWorld = modelMatrix * instanceMatrix;'), `${pass}: combines nested mesh world and instance`);
    assert(!/\bisOrthographic\b/.test(normalizeGLSL(shader.vertexShader)), `${pass}: no missing depth uniform dependency`);
    assert(shader.vertexShader.indexOf('float impostorAzimuth=') > blocks[0].index, `${pass}: atlas selection consumes corrected direction`);
    assert(shader.fragmentShader.includes('sampleImpostorViews(map,vMapUv)'), `${pass}: actual four-view color/depth coverage sampling`);
    assert(material.customProgramCacheKey().includes('native-tree-impostor-v3-orthographic-'), `${pass}: revised shader program key`);
    hookEvidence.push({pass, visibility});
    assertions += 8;
  }
  mesh.geometry.dispose(); mesh.material.map.dispose(); mesh.material.dispose(); mesh.customDepthMaterial.dispose();
  mesh.material.userData.sharedShaderTextures.forEach(texture => texture.dispose());
  albedo.dispose(); normals.dispose(); sun?.dispose();
}

console.log('TREE_IMPOSTOR_CAMERA_CHECK_PASS '+JSON.stringify({cameraCases,transformCases:worlds.length,maxUnitVectorError:maxError,oldOrthographicFailures,hooks:hookEvidence.length}));
