import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLinearMainOutput} from '../../src/render/linear-main-output.ts';

// CPU state regression: no DOM, terrain generation or WebGL context is created.
function mockRenderer(options = {}) {
  const context = {
    RGBA16F: 0x881a, DEPTH_COMPONENT24: 0x81a6, RENDERBUFFER: 0x8d41,
    SAMPLES: 0x80a9, FRAMEBUFFER: 0x8d40, FRAMEBUFFER_COMPLETE: 0x8cd5,
    getInternalformatParameter(_target, format) {
      return new Int32Array(options.unsupportedFormat === format ? [2, 1] : [4, 2, 1]);
    },
    checkFramebufferStatus() { return options.framebufferStatus ?? this.FRAMEBUFFER_COMPLETE; },
    getParameter() { return options.allocatedSamples ?? 4; },
  };
  if (options.noWebGL2) context.getInternalformatParameter = undefined;
  const renderer = {
    currentTarget: null,
    viewport: new THREE.Vector4(3, 5, 320, 180),
    scissor: new THREE.Vector4(7, 9, 280, 160),
    scissorTest: true,
    size: new THREE.Vector2(640, 360),
    autoClear: options.autoClear ?? true,
    toneMapping: THREE.ReinhardToneMapping,
    toneMappingExposure: 0.73,
    outputColorSpace: THREE.LinearSRGBColorSpace,
    capabilities: {maxSamples: options.maxSamples ?? 4},
    extensions: {has: () => !options.noFloatExtension},
    contextReads: 0,
    draws: [],
    compilations: [],
    info: {
      autoReset: options.autoReset ?? false,
      render: {calls: 5, triangles: 20, points: 2, lines: 3, frame: 4},
      reset() {Object.assign(this.render, {calls: 0, triangles: 0, points: 0, lines: 0});},
    },
    getContext() {this.contextReads++; return context;},
    getRenderTarget() {return this.currentTarget;},
    setRenderTarget(value) {this.currentTarget = value;},
    getViewport(value) {return value.copy(this.viewport);},
    setViewport(x, y, z, w) {x instanceof THREE.Vector4 ? this.viewport.copy(x) : this.viewport.set(x, y, z, w);},
    getScissor(value) {return value.copy(this.scissor);},
    setScissor(value) {this.scissor.copy(value);},
    getScissorTest() {return this.scissorTest;},
    setScissorTest(value) {this.scissorTest = value;},
    getDrawingBufferSize(value) {return value.copy(this.size);},
    getPixelRatio() {return 2;},
    render(scene, camera) {
      const output = scene !== mainScene;
      if (options.throwRender === (output ? 'output' : 'main')) throw Error('injected render failure');
      if (this.info.autoReset) this.info.reset();
      this.info.render.frame++;
      this.info.render.calls += output ? 1 : 7;
      this.info.render.triangles += output ? 1 : 400;
      this.draws.push({scene, camera, output, target: this.currentTarget, autoClear: this.autoClear,
        toneMapping: this.toneMapping, colorSpace: this.outputColorSpace, exposure: this.toneMappingExposure,
        viewport: this.viewport.clone(), scissorTest: this.scissorTest,
        debugMode: output ? scene.children[0].material.uniforms.uDebugMode.value : null});
    },
    async compileAsync(scene, camera) {
      if (options.throwCompile && scene !== mainScene) throw Error('injected compile failure');
      this.compilations.push({scene, camera, target: this.currentTarget});
    },
  };
  return renderer;
}

function state(renderer) {
  return {target: renderer.currentTarget, viewport: renderer.viewport.toArray(), scissor: renderer.scissor.toArray(),
    scissorTest: renderer.scissorTest, autoClear: renderer.autoClear, autoReset: renderer.info.autoReset,
    toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure, colorSpace: renderer.outputColorSpace};
}

const mainScene = new THREE.Scene();
const camera = new THREE.Camera();
const color = new THREE.MeshStandardMaterial({transparent: true, depthWrite: false});
const depth = new THREE.MeshDepthMaterial({alphaHash: true});
const sourceMesh = new THREE.Mesh(new THREE.BufferGeometry(), color);
sourceMesh.customDepthMaterial = depth;
mainScene.add(sourceMesh);
const colorState = {hook: color.onBeforeCompile, cache: color.customProgramCacheKey(), hash: color.alphaHash,
  a2c: color.alphaToCoverage, transparent: color.transparent, depthWrite: color.depthWrite};
const depthState = {hook: depth.onBeforeCompile, cache: depth.customProgramCacheKey(), hash: depth.alphaHash};
let checks = 0;

{
  const renderer = mockRenderer({noFloatExtension: true});
  const helper = createLinearMainOutput(renderer);
  assert.equal(helper.getState().enabled, false);
  assert.equal(helper.getState().initialized, false);
  helper.setEnabled(false);
  renderer.currentTarget = new THREE.WebGLRenderTarget(2, 2);
  const before = state(renderer);
  helper.render(mainScene, camera, 0);
  assert.equal(renderer.draws.length, 1);
  assert.equal(renderer.draws[0].target, before.target);
  assert.equal(renderer.contextReads, 0);
  assert.deepEqual(state(renderer), before);
  await helper.compile(mainScene, camera);
  assert.equal(renderer.compilations.length, 1);
  assert.throws(() => helper.setEnabled(true), /EXT_color_buffer_float/);
  assert.equal(helper.getState().enabled, false);
  helper.dispose();
  checks++;
}

for (const options of [{noWebGL2: true}, {maxSamples: 2}, {unsupportedFormat: 0x881a}, {unsupportedFormat: 0x81a6}]) {
  const helper = createLinearMainOutput(mockRenderer(options));
  assert.throws(() => helper.setEnabled(true), /four/);
  assert.equal(helper.getState().supported, false);
  assert.equal(helper.getState().enabled, false);
  helper.dispose();
  checks++;
}

for (const autoReset of [false, true]) {
  const renderer = mockRenderer({autoReset});
  const helper = createLinearMainOutput(renderer);
  helper.setEnabled(true);
  assert.equal(helper.getState().initialized, false);
  const before = state(renderer);
  helper.render(mainScene, camera, 0);
  assert.deepEqual(state(renderer), before);
  assert.equal(renderer.draws.length, 2);
  const [main, output] = renderer.draws;
  assert.equal(main.scene, mainScene);
  assert.equal(main.camera, camera);
  assert.equal(main.autoClear, true);
  assert.equal(main.target.samples, 4);
  assert.equal(main.target.texture.type, THREE.HalfFloatType);
  assert.equal(main.target.texture.colorSpace, THREE.LinearSRGBColorSpace);
  assert.equal(main.target.width, 640);
  assert.equal(main.target.height, 360);
  assert.equal(output.target, null);
  assert.equal(output.autoClear, false);
  assert.equal(output.scissorTest, false);
  assert.deepEqual(output.viewport.toArray(), [0, 0, 320, 180]);
  assert.equal(output.toneMapping, before.toneMapping);
  assert.equal(output.colorSpace, before.colorSpace);
  assert.equal(output.exposure, 0.73);
  assert.equal(renderer.info.render.calls, autoReset ? 8 : 13);
  assert.equal(renderer.info.render.triangles, autoReset ? 401 : 421);

  const shader = output.scene.children[0].material.fragmentShader;
  assert.match(shader, /if\(uDebugMode==0\.\|\|uDebugMode==5\.\|\|uDebugMode==6\.\)\{\s*#include <tonemapping_fragment>/);
  assert.match(shader, /if\(uDebugMode==0\.\|\|uDebugMode==1\.\|\|uDebugMode==5\.\|\|uDebugMode==6\.\)\{\s*#include <colorspace_fragment>/);
  assert.doesNotMatch(shader, /gl_FragColor\.a\s*=/);
  for (let mode = 0; mode <= 12; mode++) {
    helper.render(mainScene, camera, mode);
    assert.equal(renderer.draws.at(-1).debugMode, mode);
    assert.deepEqual(state(renderer), before);
  }
  renderer.size.set(1000, 600);
  helper.render(mainScene, camera, 1);
  assert.equal(renderer.draws.at(-2).target, main.target);
  assert.equal(main.target.width, 1000);
  assert.equal(main.target.height, 600);
  assert.equal(helper.getState().width, 1000);
  assert.equal(helper.getState().height, 600);
  helper.setEnabled(false);
  const drawsBefore = renderer.draws.length;
  helper.render(mainScene, camera, 0);
  assert.equal(renderer.draws.length, drawsBefore + 1);
  assert.equal(renderer.draws.at(-1).target, null);
  helper.setEnabled(true);
  await helper.compile(mainScene, camera);
  assert.equal(renderer.compilations.length, 2);
  assert.equal(renderer.compilations[0].target, main.target);
  assert.equal(renderer.compilations[1].target, null);
  assert.deepEqual(state(renderer), before);
  const disposed = {target: 0, geometry: 0, material: 0};
  main.target.addEventListener('dispose', () => disposed.target++);
  output.scene.children[0].geometry.addEventListener('dispose', () => disposed.geometry++);
  output.scene.children[0].material.addEventListener('dispose', () => disposed.material++);
  helper.dispose();
  helper.dispose();
  assert.deepEqual(disposed, {target: 1, geometry: 1, material: 1});
  assert.equal(helper.getState().disposed, true);
  assert.equal(helper.getState().initialized, false);
  assert.throws(() => helper.render(mainScene, camera), /disposed/);
  checks++;
}

for (const options of [{framebufferStatus: 0x8cd6}, {allocatedSamples: 2}, {throwRender: 'main'}, {throwRender: 'output'}]) {
  const renderer = mockRenderer(options);
  const helper = createLinearMainOutput(renderer);
  helper.setEnabled(true);
  const before = state(renderer);
  assert.throws(() => helper.render(mainScene, camera), /framebuffer|samples|injected/);
  assert.deepEqual(state(renderer), before);
  helper.dispose();
  checks++;
}

{
  const renderer = mockRenderer({autoClear: false, throwCompile: true});
  const helper = createLinearMainOutput(renderer);
  helper.setEnabled(true);
  const before = state(renderer);
  helper.render(mainScene, camera);
  assert.equal(renderer.draws[0].autoClear, false);
  assert.deepEqual(state(renderer), before);
  await assert.rejects(helper.compile(mainScene, camera), /injected compile/);
  assert.deepEqual(state(renderer), before);
  renderer.currentTarget = new THREE.WebGLRenderTarget(1, 1);
  assert.throws(() => helper.render(mainScene, camera), /default canvas/);
  await assert.rejects(helper.compile(mainScene, camera), /default canvas/);
  helper.dispose();
  checks++;
}

assert.deepEqual({hook: color.onBeforeCompile, cache: color.customProgramCacheKey(), hash: color.alphaHash,
  a2c: color.alphaToCoverage, transparent: color.transparent, depthWrite: color.depthWrite}, colorState);
assert.deepEqual({hook: depth.onBeforeCompile, cache: depth.customProgramCacheKey(), hash: depth.alphaHash}, depthState);
color.dispose(); depth.dispose(); sourceMesh.geometry.dispose();
console.log(JSON.stringify({ok: true, checks, diagnosticModes: 13, browserContexts: 0}));
