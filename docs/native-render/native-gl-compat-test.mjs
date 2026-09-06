import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import nodeGles from 'node-gles-webgl2';
import * as THREE from '/workspace/sites/last-light-bay/node_modules/three/build/three.module.js';
import { wrapNativeGL } from './native-gl-compat.mjs';

const width = 32, height = 32;
const gl = wrapNativeGL(nodeGles.createWebGLRenderingContext({ width, height, majorVersion: 3, minorVersion: 0 }));
const canvas = { width, height, style: {}, addEventListener() {}, removeEventListener() {},
  setAttribute() {}, getContext(type) { return type === 'webgl2' ? gl : null; } };
gl.canvas = canvas;
const results = { threeRevision: THREE.REVISION, renderer: gl.getParameter(gl.RENDERER), samples: {} };
let renderer;
try {
  const framebuffer = gl.createFramebuffer(), texture = gl.createTexture();
  assert.equal(typeof framebuffer, 'object');
  new WeakMap().set(framebuffer, true);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  assert.equal(gl.getParameter(gl.FRAMEBUFFER_BINDING), framebuffer);
  assert.equal(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), framebuffer);
  assert.equal(gl.getParameter(gl.READ_FRAMEBUFFER_BINDING), framebuffer);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  assert.equal(gl.getParameter(gl.TEXTURE_BINDING_2D), texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 4, 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  assert.equal(gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
    gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME), texture);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  assert.equal(gl.getParameter(gl.FRAMEBUFFER_BINDING), null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.deleteFramebuffer(framebuffer); gl.deleteTexture(texture);

  renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false });
  renderer.setSize(width, height, false);
  const errors = [];
  renderer.debug.onShaderError = (context, program, vertex, fragment) => errors.push([
    context.getProgramInfoLog(program), context.getShaderInfoLog(vertex), context.getShaderInfoLog(fragment)]);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 10);
  camera.position.z = 1;
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000, toneMapped: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(plane);
  const target = new THREE.WebGLRenderTarget(16, 16);
  target.depthTexture = new THREE.DepthTexture(16, 16, THREE.UnsignedIntType);
  const target2 = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType });
  function near(pixel, expected, label) {
    const sample = Array.from(pixel); results.samples[label] = sample;
    sample.forEach((value, i) => assert(Math.abs(value - expected[i]) <= 1,
      label + ': expected ' + expected + ', got ' + sample));
  }
  const pixel = new Uint8Array(4);
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const targetFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  assert.equal(typeof targetFramebuffer, 'object');
  renderer.readRenderTargetPixels(target, 8, 8, 1, 1, pixel);
  near(pixel, [255, 0, 0, 255], 'red-target');
  assert.equal(gl.getParameter(gl.FRAMEBUFFER_BINDING), targetFramebuffer);

  material.color.set(0x00ff00);
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  assert.equal(gl.getParameter(gl.FRAMEBUFFER_BINDING), null);
  gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  near(pixel, [0, 255, 0, 255], 'green-default');

  material.color.set(0x0000ff);
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  material.color.set(0xffff00);
  renderer.setRenderTarget(target2);
  renderer.render(scene, camera);
  const secondFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  renderer.readRenderTargetPixels(target, 8, 8, 1, 1, pixel);
  near(pixel, [0, 0, 255, 255], 'blue-target-after-other-target');
  assert.equal(gl.getParameter(gl.FRAMEBUFFER_BINDING), secondFramebuffer);
  const halfPixel = new Uint16Array(4);
  renderer.readRenderTargetPixels(target2, 8, 8, 1, 1, halfPixel);
  assert.deepEqual(Array.from(halfPixel), [15360, 15360, 0, 15360]);
  results.samples['yellow-half-float-target'] = Array.from(halfPixel);
  renderer.setRenderTarget(null);
  assert.equal(gl.getParameter(gl.FRAMEBUFFER_BINDING), null);
  const cubeTarget = new THREE.WebGLCubeRenderTarget(16, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter
  });
  const cubeScene = new THREE.Scene();
  const cubeMaterial = new THREE.ShaderMaterial({ side: THREE.BackSide,
    vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'void main(){gl_FragColor=vec4(.25,.5,1.,1.);}' });
  const box = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), cubeMaterial);
  cubeScene.add(box);
  const cubeCamera = new THREE.CubeCamera(.1, 10, cubeTarget);
  cubeCamera.update(renderer, cubeScene);
  assert.equal(gl.getParameter(gl.FRAMEBUFFER_BINDING), null);
  for (let face = 0; face < 6; face++) {
    renderer.readRenderTargetPixels(cubeTarget, 8, 8, 1, 1, halfPixel, face);
    assert.deepEqual(Array.from(halfPixel), [13312, 14336, 15360, 15360]);
    results.samples['half-float-cubemap-face-' + face] = Array.from(halfPixel);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromCubemap(cubeTarget.texture);
  assert.equal(gl.getParameter(gl.FRAMEBUFFER_BINDING), null);
  renderer.readRenderTargetPixels(environment, 8, 8, 1, 1, halfPixel);
  Array.from(halfPixel).forEach((v, i) => assert(Math.abs(v - [13312, 14336, 15360, 15360][i]) <= 2));
  results.samples['half-float-pmrem'] = Array.from(halfPixel);
  environment.dispose(); pmrem.dispose(); cubeTarget.dispose();
  box.geometry.dispose(); cubeMaterial.dispose();
  const booleanMaterial = new THREE.ShaderMaterial({
    uniforms: { enabled: { value: true }, gate: { value: true } },
    vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform bool enabled; uniform float gate; void main(){gl_FragColor=enabled&&gate>.5?vec4(1.,0.,1.,1.):vec4(0.,1.,1.,1.);}'
  });
  plane.material = booleanMaterial;
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  near(pixel, [255, 0, 255, 255], 'boolean-uniform-true');
  booleanMaterial.uniforms.enabled.value = false;
  booleanMaterial.uniforms.gate.value = false;
  renderer.render(scene, camera);
  gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  near(pixel, [0, 255, 255, 255], 'boolean-uniform-false');
  plane.material = material;
  booleanMaterial.dispose();
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(gl.getError(), gl.NO_ERROR);
  target.dispose(); target2.dispose(); material.dispose(); plane.geometry.dispose();
  results.success = true;
} catch (error) {
  results.success = false;
  results.error = String(error.stack || error);
  process.exitCode = 1;
} finally {
  renderer?.dispose();
  gl.destroy();
  await writeFile('./native-gl-compat-result.json', JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
}
