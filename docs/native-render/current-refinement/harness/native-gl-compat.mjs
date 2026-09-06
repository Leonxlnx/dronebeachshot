// Native GLES exposes GLuints where WebGL exposes opaque object handles.
// Three r185 uses those handles as WeakMap keys. Preserve one object identity
// per live native handle/type, and pass native IDs only at the binding boundary.
const wrappedContexts = new WeakMap();

export function wrapNativeGL(nativeGL) {
  if (wrappedContexts.has(nativeGL)) return wrappedContexts.get(nativeGL);
  const handleData = new WeakMap();
  const resources = new Map();
  const functions = new Map();
  const extensions = new WeakMap();
  const uniformLocations = new Map();
  const createdTypes = {
    createFramebuffer: 'Framebuffer', createTexture: 'Texture',
    createRenderbuffer: 'Renderbuffer', createBuffer: 'Buffer',
    createProgram: 'Program', createShader: 'Shader',
    createVertexArray: 'VertexArrayObject', createVertexArrayOES: 'VertexArrayObject',
    createQuery: 'Query', createQueryEXT: 'Query',
    createSampler: 'Sampler', createTransformFeedback: 'TransformFeedback',
    fenceSync: 'Sync'
  };
  const parameterTypes = new Map();
  for (const [type, names] of Object.entries({
    Buffer: ['ARRAY_BUFFER_BINDING', 'ELEMENT_ARRAY_BUFFER_BINDING',
      'COPY_READ_BUFFER_BINDING', 'COPY_WRITE_BUFFER_BINDING',
      'PIXEL_PACK_BUFFER_BINDING', 'PIXEL_UNPACK_BUFFER_BINDING',
      'TRANSFORM_FEEDBACK_BUFFER_BINDING', 'UNIFORM_BUFFER_BINDING'],
    Framebuffer: ['FRAMEBUFFER_BINDING', 'DRAW_FRAMEBUFFER_BINDING', 'READ_FRAMEBUFFER_BINDING'],
    Renderbuffer: ['RENDERBUFFER_BINDING'],
    Texture: ['TEXTURE_BINDING_2D', 'TEXTURE_BINDING_CUBE_MAP',
      'TEXTURE_BINDING_3D', 'TEXTURE_BINDING_2D_ARRAY'],
    Program: ['CURRENT_PROGRAM'], VertexArrayObject: ['VERTEX_ARRAY_BINDING'],
    TransformFeedback: ['TRANSFORM_FEEDBACK_BINDING'], Sampler: ['SAMPLER_BINDING']
  })) {
    for (const name of names) if (typeof nativeGL[name] === 'number') {
      parameterTypes.set(nativeGL[name], type);
    }
  }

  function unwrap(value) {
    return value && typeof value === 'object' && handleData.has(value)
      ? handleData.get(value).native : value;
  }

  function wrap(type, value, { fresh = false, zeroValid = false, scope = '' } = {}) {
    if (value === null || value === undefined || (!zeroValid && value === 0) || value === -1) return null;
    // UniformLocation and Sync are already opaque objects in this native build.
    if (typeof value === 'object') return value;
    const kind = type + (scope === '' ? '' : ':' + scope);
    let handles = resources.get(kind);
    if (!handles) resources.set(kind, handles = new Map());
    if (fresh || !handles.has(value)) {
      const object = Object.create(null);
      Object.defineProperties(object, {
        [Symbol.toStringTag]: { value: 'WebGL' + type },
        nativeId: { value, enumerable: false }
      });
      handleData.set(object, { type, native: value });
      handles.set(value, Object.freeze(object));
    }
    return handles.get(value);
  }

  function wrapResult(name, args, value) {
    if (createdTypes[name]) {
      const result = wrap(createdTypes[name], value, { fresh: true });
      if (name === 'createProgram') uniformLocations.delete(unwrap(result));
      return result;
    }
    if (name === 'getParameter' || name === 'getIndexedParameter') {
      const type = parameterTypes.get(args[0]);
      return type ? wrap(type, value) : value;
    }
    if (name === 'getVertexAttrib' && args[1] === nativeGL.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING) {
      return wrap('Buffer', value);
    }
    if (name === 'getAttachedShaders') return value?.map(shader => wrap('Shader', shader)) ?? value;
    if ((name === 'getQuery' || name === 'getQueryEXT') && args[1] === nativeGL.CURRENT_QUERY) {
      return wrap('Query', value);
    }
    if (name === 'getFramebufferAttachmentParameter' && args[2] === nativeGL.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME) {
      const type = nativeGL.getFramebufferAttachmentParameter(args[0], args[1], nativeGL.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE);
      return type === nativeGL.TEXTURE ? wrap('Texture', value)
        : type === nativeGL.RENDERBUFFER ? wrap('Renderbuffer', value) : value === 0 ? null : value;
    }
    if (name === 'getUniformLocation') {
      if (value === null || value === undefined) return null;
      const program = unwrap(args[0]);
      let locations = uniformLocations.get(program);
      if (!locations) uniformLocations.set(program, locations = new Map());
      const key = args[1];
      // Stable per-program/name identity also when the native API makes a new
      // napi UniformLocation object on every getUniformLocation call.
      if (!locations.has(key)) locations.set(key,
        typeof value === 'object' ? value : wrap('UniformLocation', value,
          { zeroValid: true, scope: program }));
      return locations.get(key);
    }
    return value;
  }

  function adaptMethod(receiver, name, method) {
    return (...args) => {
      const rawArgs = args.map(unwrap);
      // WebIDL converts boolean scalar arguments to numbers. The native napi
      // binding rejects them instead, while Three uploads bool uniforms (such
      // as receiveShadow) through uniform1i. Keep locations/array APIs intact.
      if (typeof name === 'string' && /^uniform[1-4](?:f|i|ui)$/.test(name)) {
        for (let i = 1; i < rawArgs.length; i++) {
          if (typeof rawArgs[i] === 'boolean') rawArgs[i] = Number(rawArgs[i]);
        }
      }
      const value = Reflect.apply(method, receiver, rawArgs);
      if (name === 'linkProgram' || name === 'deleteProgram') {
        uniformLocations.delete(rawArgs[0]);
        resources.delete('UniformLocation:' + rawArgs[0]);
      }
      if (name === 'getExtension' && value && typeof value === 'object') {
        if (!extensions.has(value)) {
          const methods = new Map();
          extensions.set(value, new Proxy(value, {
            get(target, key) {
              const item = Reflect.get(target, key, target);
              if (typeof item !== 'function') return item;
              if (!methods.has(key)) methods.set(key, adaptMethod(target, key, item));
              return methods.get(key);
            }
          }));
        }
        return extensions.get(value);
      }
      return wrapResult(name, args, value);
    };
  }

  const proxy = new Proxy(nativeGL, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      if (!functions.has(key)) functions.set(key, adaptMethod(target, key, value));
      return functions.get(key);
    },
    set(target, key, value) { return Reflect.set(target, key, value, target); }
  });
  wrappedContexts.set(nativeGL, proxy);
  wrappedContexts.set(proxy, proxy);
  return proxy;
}
