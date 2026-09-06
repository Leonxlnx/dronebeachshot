import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Inject the same Three and GLTFLoader modules imported by the production scene.
// This changes I/O only. It never reconstructs or simplifies a glTF material.
export function installNativeAssetLoaders({ THREE, GLTFLoader, publicRoot,
  sharp = createRequire(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,
    '_native_asset_adapter.cjs'))('sharp') }) {
  const previousTextureLoad = THREE.TextureLoader.prototype.load;
  const previousGLTFLoad = GLTFLoader.prototype.load;
  const installed = new WeakSet();
  const decodeFailures = new WeakMap();
  const metrics = { standaloneTextures: 0, gltfImages: 0, gltfs: 0, rgbaBytes: 0 };

  function localPath(uri, base = '') {
    if (uri.startsWith('file:')) return fileURLToPath(uri);
    if (uri.startsWith('/assets/')) return join(publicRoot, uri.slice(1));
    if (/^[a-z][a-z0-9+.-]*:/i.test(uri)) {
      throw Error('Native asset adapter only reads local files and data URIs: ' + uri);
    }
    if (base.startsWith('file:')) return fileURLToPath(new URL(uri, base));
    return resolve(base || publicRoot, uri);
  }

  async function bytesFor(uri, base = '') {
    if (uri.startsWith('data:')) {
      const comma = uri.indexOf(',');
      if (comma < 0) throw Error('Malformed image data URI');
      const header = uri.slice(0, comma), payload = uri.slice(comma + 1);
      return header.endsWith(';base64') ? Buffer.from(payload, 'base64')
        : Buffer.from(decodeURIComponent(payload), 'binary');
    }
    return readFile(localPath(uri, base));
  }

  async function decode(bytes, verticallyFlip) {
    let pipeline = sharp(bytes).toColourspace('srgb').ensureAlpha();
    // TextureLoader's DOM-image upload flips Y. Bake that flip into standalone
    // typed-array pixels. glTF convention is flipY=false and keeps source rows.
    if (verticallyFlip) pipeline = pipeline.flip();
    const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) throw Error('Expected RGBA image pixels');
    metrics.rgbaBytes += data.byteLength;
    return { data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      width: info.width, height: info.height };
  }

  function dataTexture() {
    const texture = new THREE.DataTexture(null, 1, 1, THREE.RGBAFormat,
      THREE.UnsignedByteType);
    // Match ordinary THREE.Texture defaults. DataTexture defaults differ.
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.flipY = false;
    texture.premultiplyAlpha = false;
    texture.unpackAlignment = 1;
    return texture;
  }

  THREE.TextureLoader.prototype.load = function (url, onLoad, _onProgress, onError) {
    const texture = dataTexture();
    const resolved = this.manager.resolveURL((this.path || '') + url);
    if(process.env.BAY_TRACE_ASSETS)console.log('asset begin',resolved);
    this.manager.itemStart(resolved);
    bytesFor(resolved).then(bytes => decode(bytes, true)).then(image => {
      texture.image = image;
      texture.needsUpdate = true;
      metrics.standaloneTextures++;
      if(process.env.BAY_TRACE_ASSETS)console.log('asset ready',resolved);
      onLoad?.(texture);
      this.manager.itemEnd(resolved);
    }).catch(error => {
      onError?.(error);
      this.manager.itemError(resolved);
      this.manager.itemEnd(resolved);
    });
    return texture;
  };

  function nativeImagesPlugin(parser) {
    const failures = [];
    decodeFailures.set(parser, failures);
    // Leave built-in EXT_texture_webp, loadTextureImage, assignTexture,
    // KHR_texture_transform, and all material extension handlers intact.
    parser.loadImageSource = function (sourceIndex) {
      if (parser.sourceCache[sourceIndex] !== undefined) {
        return parser.sourceCache[sourceIndex].then(texture => texture.clone());
      }
      const source = parser.json.images[sourceIndex];
      const promise = (async () => {
        let bytes;
        if (source.bufferView !== undefined) {
          bytes = Buffer.from(await parser.getDependency('bufferView', source.bufferView));
        } else if (source.uri !== undefined) {
          bytes = await bytesFor(source.uri, parser.options.path);
        } else throw Error('glTF image lacks bufferView/URI: ' + sourceIndex);
        const texture = dataTexture();
        texture.image = await decode(bytes, false);
        if (source.extras && typeof source.extras === 'object') {
          Object.assign(texture.userData, source.extras);
        }
        texture.userData.mimeType = source.mimeType ||
          (/\.webp(?:$|\?)/i.test(source.uri || '') ? 'image/webp' :
            /\.jpe?g(?:$|\?)/i.test(source.uri || '') ? 'image/jpeg' : 'image/png');
        texture.needsUpdate = true;
        metrics.gltfImages++;
        return texture;
      })().catch(error => {
        // GLTFLoader otherwise catches image errors and silently returns null maps.
        failures.push(error);
        throw error;
      });
      parser.sourceCache[sourceIndex] = promise;
      return promise;
    };
    return { name: 'NODE_native_image_bytes' };
  }

  GLTFLoader.prototype.load = function (url, onLoad, onProgress, onError) {
    if (!installed.has(this)) {
      this.register(nativeImagesPlugin);
      installed.add(this);
    }
    const resolved = this.manager.resolveURL((this.path || '') + url);
    if(process.env.BAY_TRACE_ASSETS)console.log('asset begin',resolved);
    this.manager.itemStart(resolved);
    const task = (async () => {
      const path = localPath(resolved);
      const bytes = await readFile(path);
      onProgress?.({ loaded: bytes.byteLength, total: bytes.byteLength,
        lengthComputable: true });
      // A Buffer's backing ArrayBuffer can include unrelated bytes.
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const base = this.resourcePath || pathToFileURL(dirname(path) + '/').href;
      const gltf = await this.parseAsync(buffer, base);
      const failures = decodeFailures.get(gltf.parser) || [];
      if (failures.length) throw new AggregateError(failures, 'glTF image decoding failed');
      metrics.gltfs++;
      onLoad?.(gltf);
      this.manager.itemEnd(resolved);
    })();
    task.catch(error => {
      onError?.(error);
      this.manager.itemError(resolved);
      this.manager.itemEnd(resolved);
    });
  };

  return { metrics, restore() {
    THREE.TextureLoader.prototype.load = previousTextureLoad;
    GLTFLoader.prototype.load = previousGLTFLoad;
  } };
}
