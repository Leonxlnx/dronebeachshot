// CPU-only API/state checks. This does not create a WebGL context or compile GLSL.
// Run from the repository root:
// node --no-warnings --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs artifacts/refinement-2026-09-30/ssaa-internal2x/cpu-lifecycle-check.mjs
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createLinearMainOutput} from '../../../src/render/linear-main-output.ts';
import {createRefractionPass, refractionUniforms, sceneCaptureScale} from '../../../src/render/refraction.ts';
import {debugMode} from '../../../src/render/materials.ts';
import {createRockSpray} from '../../../src/world/spray.ts';

const gl = {
  RGBA16F: 1, DEPTH_COMPONENT24: 2, RENDERBUFFER: 3, SAMPLES: 4,
  FRAMEBUFFER: 5, FRAMEBUFFER_COMPLETE: 6, MAX_RENDERBUFFER_SIZE: 7,
  getInternalformatParameter: () => new Int32Array([4]),
  getParameter: p => p === 7 ? 4096 : 4,
  checkFramebufferStatus: () => 6,
};
let drawingSize = new THREE.Vector2(640, 360), bound = null;
let viewport = new THREE.Vector4(7, 9, 320, 180), scissor = new THREE.Vector4(2, 3, 220, 140);
let scissorTest = true, failRender = false;
const calls = [];
const renderer = {
  capabilities: {maxSamples: 4, maxTextureSize: 4096},
  extensions: {has: () => true}, autoClear: true, info: {autoReset: true},
  getContext: () => gl, getDrawingBufferSize: v => v.copy(drawingSize),
  getPixelRatio: () => 1, getRenderTarget: () => bound,
  setRenderTarget: t => {bound = t;},
  getViewport: v => v.copy(viewport),
  setViewport: (...v) => {viewport = v.length === 1 ? v[0].clone() : new THREE.Vector4(...v);},
  getScissor: v => v.copy(scissor), setScissor: v => {scissor = v.clone();},
  getScissorTest: () => scissorTest, setScissorTest: v => {scissorTest = v;},
  render: (scene, camera) => {
    calls.push({target: bound, width: bound?.width, height: bound?.height, scene});
    if (failRender) throw Error('mock render failure');
  },
  compileAsync: async () => {},
};
const initial = {viewport: viewport.clone(), scissor: scissor.clone(), scissorTest,
  autoClear: renderer.autoClear, infoAutoReset: renderer.info.autoReset};
function restored() {
  assert.equal(bound, null); assert.deepEqual(viewport, initial.viewport);
  assert.deepEqual(scissor, initial.scissor); assert.equal(scissorTest, initial.scissorTest);
  assert.equal(renderer.autoClear, initial.autoClear);
  assert.equal(renderer.info.autoReset, initial.infoAutoReset);
}
const passed = [];
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 16 / 9, .4, 22000);
const linear = createLinearMainOutput(renderer);
assert.equal(linear.getSampleScale(), 1);
linear.setSampleScale(2); assert.equal(linear.getSampleScale(), 1);
linear.render(scene, camera); assert.equal(calls.length, 1);
assert.equal(calls[0].target, null); assert.equal(linear.getState().initialized, false);
passed.push('OFF remains lazy and direct; requested scale 2 has effective scale 1');

linear.setEnabled(true); assert.equal(linear.getSampleScale(), 2);
calls.length = 0; linear.render(scene, camera);
assert.equal(calls[0].width, 1280); assert.equal(calls[0].height, 720);
assert.equal(calls[1].target, null);
assert.equal(calls[1].scene.children[0].material.uniforms.uSampleScale.value, 2);
assert.equal(linear.getState().samples, 4); restored();
linear.setSampleScale(1); calls.length = 0; linear.render(scene, camera);
assert.equal(calls[0].width, 640); assert.equal(calls[0].height, 360);
assert.equal(calls[1].scene.children[0].material.uniforms.uSampleScale.value, 1); restored();
passed.push('1x/2x use 640x360/1280x720 main targets, 4x MSAA request, canvas output, matching resolve uniform');

failRender = true; assert.throws(() => linear.render(scene, camera), /mock render failure/);
failRender = false; restored();
linear.setSampleScale(2); drawingSize.set(2500, 1000);
assert.throws(() => linear.render(scene, camera), /texture\/renderbuffer limit/);
assert.equal(linear.getState().width, 640); restored();
drawingSize.set(640, 360); linear.setSampleScale(1); linear.render(scene, camera); restored();
assert.throws(() => linear.setSampleScale(3), /one or two/);
linear.setEnabled(false); assert.equal(linear.getSampleScale(), 1);
linear.dispose(); linear.dispose();
assert.throws(() => linear.setSampleScale(2), /disposed/);
passed.push('Main restores renderer state after success/failure; rejects oversize before resize; recovers, validates scale and disposes idempotently');

const refraction = createRefractionPass(renderer), water = new THREE.Group(), spray = new THREE.Group();
scene.fog = new THREE.FogExp2(0xffffff, .00014);
const originalMode = debugMode.value;
function refractionRestored() {
  assert.equal(bound, null); assert.equal(water.visible, true); assert.equal(spray.visible, true);
  assert.equal(scene.fog.density, .00014); assert.equal(debugMode.value, originalMode);
  assert.equal(sceneCaptureScale.value, 1);
}
calls.length = 0; refraction.render(scene, camera, water, spray, 2);
assert.equal(calls[0].width, 1280); assert.equal(calls[0].height, 720);
assert.deepEqual(refractionUniforms.uUnderResolution.value.toArray(), [1280, 720]); refractionRestored();
calls.length = 0; refraction.render(scene, camera, water, spray);
assert.equal(calls[0].width, 640); assert.equal(calls[0].height, 360);
assert.deepEqual(refractionUniforms.uUnderResolution.value.toArray(), [640, 360]);
failRender = true;
assert.throws(() => refraction.render(scene, camera, water, spray, 2), /mock render failure/);
failRender = false; refractionRestored();
const prior = refractionUniforms.uUnderResolution.value.toArray(); drawingSize.set(2500, 1000);
assert.throws(() => refraction.render(scene, camera, water, spray, 2), /texture\/renderbuffer limit/);
assert.deepEqual(refractionUniforms.uUnderResolution.value.toArray(), prior); assert.equal(bound, null);
assert.throws(() => refraction.render(scene, camera, water, spray, 3), /one or two/);
refraction.dispose();
passed.push('Refraction target/depth dimensions and uUnderResolution scale together; default 1x and error restoration hold');

// Empty emitter field is sufficient to exercise the real onBeforeRender callback.
const points = createRockSpray({texture: {image: {data: new Float32Array(3 * 3 * 4)}},
  diagnostics: {resolution: 3}, bounds: new THREE.Vector4(-1, -1, 1, 1)});
let sprayTarget = null, sprayViewportHeight = 720;
const sprayGl = {ALIASED_POINT_SIZE_RANGE: 8, getParameter: () => [1, 64]};
const sprayRenderer = {getRenderTarget: () => sprayTarget,
  getCurrentViewport: v => v.set(0, 0, 1280, sprayViewportHeight),
  getDrawingBufferSize: v => v.set(640, 360), getContext: () => sprayGl};
points.onBeforeRender(sprayRenderer);
assert.equal(points.material.uniforms.uBufferHeight.value, 360);
sprayTarget = {}; points.onBeforeRender(sprayRenderer);
assert.equal(points.material.uniforms.uBufferHeight.value, 720);
sprayViewportHeight = 540; points.onBeforeRender(sprayRenderer);
assert.equal(points.material.uniforms.uBufferHeight.value, 540);
points.geometry.dispose(); points.material.dispose();
passed.push('Spray uses canvas physical height on canvas and actual active viewport height on an offscreen target');

const sourceFiles = ['src/main.ts', 'src/render/linear-main-output.ts', 'src/render/refraction.ts', 'src/world/spray.ts'];
const sourceSha256 = Object.fromEntries(sourceFiles.map(path => [path,
  createHash('sha256').update(readFileSync(new URL('../../../' + path, import.meta.url))).digest('hex')]));
const report = {kind: 'CPU mocks only', passed, sourceSha256,
  limits: ['Renderer and GL capability/status responses are mocked; Three scene/target objects are real CPU objects.',
    'No WebGL context, allocation, GLSL compile, pixel comparison, speed measurement or art acceptance.']};
writeFileSync(new URL('./cpu-lifecycle-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
