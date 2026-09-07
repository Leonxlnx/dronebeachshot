import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { wrapNativeGL } from './native-gl-compat.mjs';

const adapter = new URL('./native-gl-compat.mjs', import.meta.url);
assert.equal(typeof global.gc, 'function', 'Run with --expose-gc');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function collect(refs) {
  let remaining = refs.length;
  for (let i = 0; i < 30 && remaining; i++) {
    await tick();
    global.gc();
    await tick();
    remaining = refs.filter(reference => reference.deref()).length;
  }
  return remaining;
}
function fixture() {
  let textureId = 0, programId = 0, shaderId = 0, current = 0, bound = 0;
  const textures = new Set(), programs = new Map(), shaders = new Map(), recycled = [];
  const native = {
    TEXTURE_BINDING_2D: 0x8069, CURRENT_PROGRAM: 0x8b8d,
    createTexture() { const id = recycled.length ? recycled.shift() : ++textureId; textures.add(id); return id; },
    deleteTexture(id) { textures.delete(id); if (bound === id) bound = 0; },
    bindTexture(target, id) { bound = id ?? 0; },
    createProgram() { const id = ++programId; programs.set(id, { attached: [], deleted: false }); return id; },
    useProgram(id) { current = id ?? 0; },
    deleteProgram(id) { programs.get(id).deleted = true; if (current !== id) programs.delete(id); },
    createShader() { const id = ++shaderId; shaders.set(id, { deleted: false }); return id; },
    attachShader(program, shader) { programs.get(program).attached.push(shader); },
    deleteShader(id) { shaders.get(id).deleted = true; },
    getAttachedShaders(id) { return [...programs.get(id).attached]; },
    getParameter(parameter) { return parameter === this.CURRENT_PROGRAM ? current : bound; },
    getUniformLocation(program, name) { return { nativeUniformProgram: program, name }; },
    linkProgram() {},
  };
  return { native, textures, programs, shaders, recycled, gl: wrapNativeGL(native) };
}

// Keep one observable caller reference alive while both native deletion forms
// remain deferred. A registry must not silently replace these wrapper identities.
const pending = fixture();
const texture = pending.gl.createTexture();
pending.gl.bindTexture(0, texture);
assert.equal(pending.gl.getParameter(pending.native.TEXTURE_BINDING_2D), texture);
const program = pending.gl.createProgram(), shader = pending.gl.createShader(0);
pending.gl.useProgram(program);
pending.gl.attachShader(program, shader);
pending.gl.deleteShader(shader);
pending.gl.deleteProgram(program);
assert.equal(pending.programs.get(program.nativeId).deleted, true);
assert.equal(pending.shaders.get(shader.nativeId).deleted, true);
for (let i = 0; i < 4; i++) { await tick(); global.gc(); }
assert.equal(pending.gl.getParameter(pending.native.CURRENT_PROGRAM), program);
assert.equal(pending.gl.getAttachedShaders(program)[0], shader);
assert.equal(pending.gl.getParameter(pending.native.TEXTURE_BINDING_2D), texture);
assert.equal(wrapNativeGL(pending.native), pending.gl);
assert.equal(wrapNativeGL(pending.gl), pending.gl);

// No strong references to old wrappers survive this call. The fake driver's
// native allocation count is separately zero; this tests only JS retention.
const deletion = fixture();
function makeDeleted() {
  const deleted = [], controls = [];
  for (let i = 0; i < 1000; i++) {
    const handle = deletion.gl.createTexture();
    deleted.push(new WeakRef(handle));
    deletion.gl.deleteTexture(handle);
    controls.push(new WeakRef({ i }));
  }
  return { deleted, controls };
}
const { deleted, controls } = makeDeleted();
assert.equal(deletion.textures.size, 0);
const deletedRetained = await collect(deleted), controlsRetained = await collect(controls);
assert.equal(controlsRetained, 0);
assert.equal(deletedRetained, 0);

// A native binding alone need not own a JS object. Once the caller reference
// has died, returning a new canonical wrapper preserves every observable use.
const binding = fixture();
function makeBound() {
  const handle = binding.gl.createTexture();
  binding.gl.bindTexture(0, handle);
  return { reference: new WeakRef(handle), native: handle.nativeId };
}
const formerlyBound = makeBound();
assert.equal(await collect([formerlyBound.reference]), 0);
const rebound = binding.gl.getParameter(binding.native.TEXTURE_BINDING_2D);
assert.equal(rebound.nativeId, formerlyBound.native);
assert.equal(binding.gl.getParameter(binding.native.TEXTURE_BINDING_2D), rebound);

// Instrument only the finalizer delivery scheduler: actual adapter registration,
// held values, WeakRefs and cleanup callback run unchanged. Delayed callbacks
// are dispatched only after real GC proves their target cannot be observed.
const StandardRegistry = globalThis.FinalizationRegistry;
const registrations = [];
globalThis.FinalizationRegistry = class DelayedRegistry {
  constructor(callback) { this.callback = callback; }
  register(target, held) { registrations.push({ target: new WeakRef(target), held, callback: this.callback }); }
};
let reuse;
try { reuse = fixture(); } finally { globalThis.FinalizationRegistry = StandardRegistry; }
function retiredWithReusedId() {
  const old = reuse.gl.createTexture(), id = old.nativeId;
  reuse.gl.deleteTexture(old);
  reuse.recycled.push(id);
  const replacement = reuse.gl.createTexture();
  assert.notEqual(replacement, old, 'Fresh creation must retire old observable identity');
  assert.equal(replacement.nativeId, id);
  reuse.gl.bindTexture(0, replacement);
  return { oldReference: new WeakRef(old), replacement };
}
const reused = retiredWithReusedId();
assert.equal(registrations.length, 2);
assert.equal(await collect([reused.oldReference]), 0);
const oldRegistration = registrations[0];
assert.equal(oldRegistration.target.deref(), undefined);
assert.deepEqual(Object.keys(oldRegistration.held).sort(), ['kind', 'native', 'reference']);
assert.ok(oldRegistration.held.reference instanceof WeakRef);
oldRegistration.callback(oldRegistration.held);
assert.equal(reuse.gl.getParameter(reuse.native.TEXTURE_BINDING_2D), reused.replacement,
  'Delayed old finalizer must not remove the replacement native-ID cache entry');

// The same deletion callback must actually evict a dead current entry. Repeated
// callbacks are harmless, and a fresh later allocation remains canonical.
function forgetReplacement() {
  const handle = reuse.gl.createTexture();
  reuse.gl.deleteTexture(handle);
  return new WeakRef(handle);
}
const forgotten = forgetReplacement();
assert.equal(await collect([forgotten]), 0);
const deadRegistration = registrations.at(-1);
deadRegistration.callback(deadRegistration.held);
deadRegistration.callback(deadRegistration.held);
reuse.recycled.push(deadRegistration.held.native);
const next = reuse.gl.createTexture();
reuse.gl.bindTexture(0, next);
assert.equal(reuse.gl.getParameter(reuse.native.TEXTURE_BINDING_2D), next);

const uniforms = fixture(), uniformProgram = uniforms.gl.createProgram();
const beforeLink = uniforms.gl.getUniformLocation(uniformProgram, 'uTime');
assert.equal(uniforms.gl.getUniformLocation(uniformProgram, 'uTime'), beforeLink);
uniforms.gl.linkProgram(uniformProgram);
const afterLink = uniforms.gl.getUniformLocation(uniformProgram, 'uTime');
assert.notEqual(afterLink, beforeLink);
assert.equal(uniforms.gl.getUniformLocation(uniformProgram, 'uTime'), afterLink);

const result = {
  adapterSha256: createHash('sha256').update(fs.readFileSync(adapter)).digest('hex'),
  scope: 'Actual adapter with fake numeric native handles; no graphics allocations or scene rendering',
  deletedNativeTextures: deletion.textures.size,
  deletedWrappersStillRetained: deletedRetained,
  unrelatedControlsStillRetained: controlsRetained,
  pendingDeleteProgramIdentity: true,
  attachedPendingDeleteShaderIdentity: true,
  callerHeldBindingIdentity: true,
  unobservedBoundWrapperCollectsAndRecanonicalizes: true,
  freshReusedIdChangesIdentity: true,
  delayedOldFinalizerPreservesReusedIdIdentity: true,
  deadEntryCleanupIdempotent: true,
  uniformLocationIdentityAndRelinkInvalidation: true,
  finalizerNote: 'ID-reuse race deterministically schedules the actual cleanup callback after real GC of the old target; separate deletion test uses the real runtime FinalizationRegistry.',
};
console.log(JSON.stringify(result, null, 2));
