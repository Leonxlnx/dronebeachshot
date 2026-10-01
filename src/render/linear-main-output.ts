import * as THREE from 'three';

const SAMPLE_COUNT = 4;

/** A separate, default-off main output study. It never changes scene materials. */
export function createLinearMainOutput(renderer: THREE.WebGLRenderer) {
  let enabled = false;
  let requestedSampleScale: 1 | 2 = 1;
  let disposed = false;
  let supported: boolean | null = null;
  let supportError: string | null = null;
  let target: THREE.WebGLRenderTarget | null = null;
  let outputScene: THREE.Scene | null = null;
  let outputGeometry: THREE.BufferGeometry | null = null;
  let outputMaterial: THREE.ShaderMaterial | null = null;
  let validatedWidth = 0;
  let validatedHeight = 0;
  let maximumTargetExtent = 0;
  const outputCamera = new THREE.Camera();
  const size = new THREE.Vector2();

  function assertAvailable() {
    if (disposed) throw Error('Linear main output has been disposed');
  }

  function unsupported(reason: string): never {
    supported = false;
    supportError = reason;
    throw Error('Linear main output requires four-sample RGBA16F: ' + reason);
  }

  function checkSupport() {
    if (supported === true) return;
    if (supported === false) unsupported(supportError!);
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.getInternalformatParameter !== 'function') {
      unsupported('WebGL2 multisample format queries are unavailable');
    }
    if (!renderer.extensions.has('EXT_color_buffer_float')) {
      unsupported('EXT_color_buffer_float is unavailable');
    }
    if (renderer.capabilities.maxSamples < SAMPLE_COUNT) {
      unsupported('the context supports fewer than four MSAA samples');
    }
    for (const [name, format] of [
      ['RGBA16F', gl.RGBA16F], ['DEPTH_COMPONENT24', gl.DEPTH_COMPONENT24],
    ] as const) {
      const counts = gl.getInternalformatParameter(gl.RENDERBUFFER, format, gl.SAMPLES) as Int32Array;
      if (!counts || !Array.from(counts).includes(SAMPLE_COUNT)) {
        unsupported(name + ' does not support exactly four samples');
      }
    }
    maximumTargetExtent = Math.min(renderer.capabilities.maxTextureSize,
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number);
    if (!Number.isFinite(maximumTargetExtent) || maximumTargetExtent < 1) {
      unsupported('invalid texture/renderbuffer size limits');
    }
    supported = true;
  }

  function requireCanvas() {
    if (renderer.getRenderTarget() !== null) {
      throw Error('Linear main output requires the default canvas target');
    }
  }

  function ensureResources() {
    checkSupport();
    renderer.getDrawingBufferSize(size);
    const width = size.x * requestedSampleScale, height = size.y * requestedSampleScale;
    // Reject before creating/resizing a target. An oversized study request must
    // leave existing resources usable when the caller returns to scale one.
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
      || width > maximumTargetExtent || height > maximumTargetExtent) {
      throw Error(`Linear main output target ${width}x${height} exceeds the ${maximumTargetExtent}px texture/renderbuffer limit`);
    }
    if (!target) {
      target = new THREE.WebGLRenderTarget(width, height, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        generateMipmaps: false,
        depthBuffer: true,
        stencilBuffer: false,
        samples: SAMPLE_COUNT,
      });
      target.texture.name = 'main-linear-rgba16f-msaa4';
      target.texture.colorSpace = THREE.LinearSRGBColorSpace;
      outputGeometry = new THREE.BufferGeometry();
      outputGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
        -1, -1, 0, 3, -1, 0, -1, 3, 0,
      ], 3));
      outputMaterial = new THREE.ShaderMaterial({
        name: 'main-linear-output',
        uniforms: {uLinearColor: {value: target.texture}, uDebugMode: {value: 0},
          uSampleScale: {value: 1}},
        depthTest: false,
        depthWrite: false,
        blending: THREE.NoBlending,
        toneMapped: true,
        vertexShader: `varying vec2 vOutputUv;
void main(){vOutputUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}`,
        fragmentShader: `uniform sampler2D uLinearColor;
uniform float uDebugMode;
uniform float uSampleScale;
varying vec2 vOutputUv;
void main(){
  if(uSampleScale>1.5){
    // The canvas viewport starts at zero. Each destination pixel resolves an
    // exact 2x2 block of already MSAA-resolved linear HDR source texels.
    ivec2 p=ivec2(gl_FragCoord.xy)*2;
    gl_FragColor=(texelFetch(uLinearColor,p,0)
      +texelFetch(uLinearColor,p+ivec2(1,0),0)
      +texelFetch(uLinearColor,p+ivec2(0,1),0)
      +texelFetch(uLinearColor,p+ivec2(1,1),0))*.25;
  }else{
    gl_FragColor=texture2D(uLinearColor,vOutputUv);
  }
  if(uDebugMode==0.||uDebugMode==5.||uDebugMode==6.){
    #include <tonemapping_fragment>
  }
  if(uDebugMode==0.||uDebugMode==1.||uDebugMode==5.||uDebugMode==6.){
    #include <colorspace_fragment>
  }
}`,
      });
      const triangle = new THREE.Mesh(outputGeometry, outputMaterial);
      triangle.frustumCulled = false;
      outputScene = new THREE.Scene();
      outputScene.add(triangle);
    } else if (target.width !== width || target.height !== height) {
      target.setSize(width, height);
    }
    return target;
  }

  function snapshot() {
    return {
      target: renderer.getRenderTarget(),
      viewport: renderer.getViewport(new THREE.Vector4()),
      scissor: renderer.getScissor(new THREE.Vector4()),
      scissorTest: renderer.getScissorTest(),
      autoClear: renderer.autoClear,
      infoAutoReset: renderer.info.autoReset,
    };
  }

  function restore(previous: ReturnType<typeof snapshot>) {
    renderer.setRenderTarget(previous.target);
    renderer.setViewport(previous.viewport);
    renderer.setScissor(previous.scissor);
    renderer.setScissorTest(previous.scissorTest);
    renderer.autoClear = previous.autoClear;
    renderer.info.autoReset = previous.infoAutoReset;
  }

  function bindLinearTarget() {
    const renderTarget = ensureResources();
    renderer.setRenderTarget(renderTarget);
    // Allocation/resize is the capability boundary; do not add synchronous GL
    // validation queries to every frame of the flight.
    if (validatedWidth === renderTarget.width && validatedHeight === renderTarget.height) return;
    const gl = renderer.getContext();
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      unsupported('framebuffer is incomplete (0x' + status.toString(16) + ')');
    }
    const samples = gl.getParameter(gl.SAMPLES) as number;
    if (samples !== SAMPLE_COUNT) {
      unsupported('allocated framebuffer has ' + samples + ' samples instead of four');
    }
    validatedWidth = renderTarget.width;
    validatedHeight = renderTarget.height;
  }

  function bindOutput() {
    renderer.setRenderTarget(null);
    // setViewport uses logical pixels for the canvas; the target uses physical pixels.
    const dpr = renderer.getPixelRatio();
    renderer.setViewport(0, 0, size.x / dpr, size.y / dpr);
    renderer.setScissorTest(false);
    outputMaterial!.uniforms.uSampleScale.value = requestedSampleScale;
    renderer.autoClear = false;
    // Keep the scene's normal auto-reset behavior, then accumulate the output draw.
    renderer.info.autoReset = false;
  }

  function setEnabled(value: boolean) {
    assertAvailable();
    if (value) checkSupport();
    enabled = value;
  }

  function setSampleScale(value: 1 | 2) {
    assertAvailable();
    if (value !== 1 && value !== 2) throw Error('Linear main sample scale must be one or two');
    requestedSampleScale = value;
  }

  function getSampleScale(): 1 | 2 {
    return enabled ? requestedSampleScale : 1;
  }

  function getState() {
    return {
      enabled,
      sampleScale: getSampleScale(),
      requestedSampleScale,
      supported,
      supportError,
      initialized: target !== null,
      width: target?.width ?? 0,
      height: target?.height ?? 0,
      samples: SAMPLE_COUNT,
      framebufferValidated: target !== null && validatedWidth === target.width && validatedHeight === target.height,
      format: 'RGBA16F',
      colorSpace: THREE.LinearSRGBColorSpace,
      resolveDrawsPerFrame: enabled ? 1 : 0,
      disposed,
    };
  }

  function render(scene: THREE.Scene, camera: THREE.Camera, debugMode = 0) {
    assertAvailable();
    if (!enabled) {
      renderer.render(scene, camera);
      return;
    }
    requireCanvas();
    const previous = snapshot();
    try {
      bindLinearTarget();
      // Three uses linear output and no tone mapping for a normal offscreen target.
      renderer.render(scene, camera);
      outputMaterial!.uniforms.uDebugMode.value = debugMode;
      bindOutput();
      renderer.render(outputScene!, outputCamera);
    } finally {
      restore(previous);
    }
  }

  async function compile(scene: THREE.Scene, camera: THREE.Camera) {
    assertAvailable();
    if (!enabled) {
      await renderer.compileAsync(scene, camera);
      return;
    }
    requireCanvas();
    const previous = snapshot();
    try {
      bindLinearTarget();
      await renderer.compileAsync(scene, camera);
      bindOutput();
      await renderer.compileAsync(outputScene!, outputCamera);
    } finally {
      restore(previous);
    }
  }

  function dispose() {
    if (disposed) return;
    enabled = false;
    target?.dispose();
    outputGeometry?.dispose();
    outputMaterial?.dispose();
    outputScene?.clear();
    target = outputScene = outputGeometry = outputMaterial = null;
    disposed = true;
  }

  return {setEnabled, setSampleScale, getSampleScale, getState, render, compile, dispose};
}
