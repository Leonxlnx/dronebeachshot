import {rockShelter} from './rock-shelter.ts';
import {coastNormal} from './coastal.ts';
import * as THREE from 'three';
import { shoreDistance, terrainHeight } from './math.ts';

/**
 * Integration target: src/world/coastal-field.ts (the relative ./math import is intentional).
 * CPU-only construction: no renderer, asset loader, browser, or render target is required.
 *
 * Atlas layout, x fastest, z increasing with row:
 *   R = terrainHeight(x,z), evaluated at the texel center and rounded to Float32.
 *   G = signed distance to the rasterized sea-blocking rock silhouette, in meters;
 *       negative inside, positive outside, saturated to [-32,32].
 *   B = highest world-space triangle surface at that texel center; -100 if absent.
 *   A = directional lee amplitude reduction from the actual emergent rock mask.
 *
 * Bounds are (minX,minZ,maxX,maxZ), NOT origin/size. Thus
 *   uv = (worldXZ - bounds.xy) / (bounds.zw - bounds.xy).
 * Texel i,j samples min + (vec2(i,j)+0.5)*span/1024. flipY=false.
 * Static, visible InstancedMesh geometry only; no skinning/morph/displacement shaders.
 * The root's existing world/instance transforms are respected; input geometry is not edited.
 * Instances whose projected bounds touch sampled shoreDistance in [-70,15] are included;
 * their complete in-domain triangles are rasterized, so the selection band never cuts a
 * rock silhouette. Subpixel rocks can vanish.
 *
 * G is an anisotropic 8-neighbor chamfer approximation, not exact Euclidean distance.
 * Its zero contour lies halfway between occupied/free sample centers. Raster quantization
 * is about one texel (1.172m x 1.514m), with additional chamfer angular error.
 * No silhouettes are invented from bounding spheres; boxes only cull raster work.
 */
export const COASTAL_FIELD_SIZE = 1024;
export const COASTAL_FIELD_DISTANCE_CAP = 32;
const MIN_X = -600, MIN_Z = -900, MAX_X = 600, MAX_Z = 650;
const DX = (MAX_X - MIN_X) / COASTAL_FIELD_SIZE;
const DZ = (MAX_Z - MIN_Z) / COASTAL_FIELD_SIZE;
const COUNT = COASTAL_FIELD_SIZE * COASTAL_FIELD_SIZE;
const BLOCKING_HEIGHT = -0.35;
const NO_ROCK_HEIGHT = -100;

export type CoastalFieldDiagnostics = {
  resolution: number;
  texelMeters: [number, number];
  textureBytes: number;
  instancesVisited: number;
  instancesRasterized: number;
  trianglesVisited: number;
  trianglesRasterized: number;
  degenerateTriangles: number;
  rockSamples: number;
  blockingSamples: number;
  buildMilliseconds: number;
  terrainMilliseconds: number;
  rasterMilliseconds: number;
  distanceMilliseconds: number;
  shelter: 'directional-advection-diffusion';
  shelterMilliseconds: number;
  distanceMethod: 'anisotropic-8-neighbor-chamfer';
};

export type CoastalField = {
  texture: THREE.DataTexture;
  bounds: THREE.Vector4;
  diagnostics: CoastalFieldDiagnostics;
};

const clampIndex = (i: number) => Math.max(0, Math.min(COASTAL_FIELD_SIZE - 1, i));
const worldX = (i: number) => MIN_X + (i + 0.5) * DX;
const worldZ = (j: number) => MIN_Z + (j + 0.5) * DZ;

function visibleToRoot(object: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = object; p; p = p.parent) {
    if (!p.visible) return false;
    if (p === root) return true;
  }
  return false;
}

/** Half-cell boundary seeds, then two linear chamfer sweeps; O(width*height). */
function signedChamfer(mask: Uint8Array): Float32Array {
  const n = COASTAL_FIELD_SIZE, cap = COASTAL_FIELD_DISTANCE_CAP;
  const dist = new Float32Array(COUNT).fill(cap);
  const diagonal = Math.hypot(DX, DZ);
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const i = z * n + x, occupied = mask[i];
    let d = cap;
    if ((x > 0 && mask[i - 1] !== occupied) ||
        (x < n - 1 && mask[i + 1] !== occupied)) d = DX * 0.5;
    if ((z > 0 && mask[i - n] !== occupied) ||
        (z < n - 1 && mask[i + n] !== occupied)) d = Math.min(d, DZ * 0.5);
    // Treat space outside the atlas as free. No false edge seed is made for free pixels.
    if (occupied && (x === 0 || x === n - 1)) d = Math.min(d, DX * 0.5);
    if (occupied && (z === 0 || z === n - 1)) d = Math.min(d, DZ * 0.5);
    dist[i] = d;
  }
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const i = z * n + x;
    let d = dist[i];
    if (x > 0) d = Math.min(d, dist[i - 1] + DX);
    if (z > 0) {
      d = Math.min(d, dist[i - n] + DZ);
      if (x > 0) d = Math.min(d, dist[i - n - 1] + diagonal);
      if (x < n - 1) d = Math.min(d, dist[i - n + 1] + diagonal);
    }
    dist[i] = d;
  }
  for (let z = n - 1; z >= 0; z--) for (let x = n - 1; x >= 0; x--) {
    const i = z * n + x;
    let d = dist[i];
    if (x < n - 1) d = Math.min(d, dist[i + 1] + DX);
    if (z < n - 1) {
      d = Math.min(d, dist[i + n] + DZ);
      if (x > 0) d = Math.min(d, dist[i + n - 1] + diagonal);
      if (x < n - 1) d = Math.min(d, dist[i + n + 1] + diagonal);
    }
    dist[i] = d;
  }
  for (let i = 0; i < COUNT; i++) if (mask[i]) dist[i] = -dist[i];
  return dist;
}

export function createCoastalField(rocks: THREE.Group): CoastalField {
  const started = performance.now();
  const data = new Float32Array(COUNT * 4);
  const tops = new Float32Array(COUNT).fill(-Infinity);
  const mask = new Uint8Array(COUNT);
  const firstShoreRow = new Int32Array(COASTAL_FIELD_SIZE);
  const lastShoreRow = new Int32Array(COASTAL_FIELD_SIZE);
  const diagnostics: CoastalFieldDiagnostics = {
    resolution: COASTAL_FIELD_SIZE, texelMeters: [DX, DZ], textureBytes: data.byteLength,
    instancesVisited: 0, instancesRasterized: 0, trianglesVisited: 0,
    trianglesRasterized: 0, degenerateTriangles: 0, rockSamples: 0, blockingSamples: 0,
    buildMilliseconds: 0, terrainMilliseconds: 0, rasterMilliseconds: 0,
    distanceMilliseconds: 0, shelter: 'directional-advection-diffusion', shelterMilliseconds: 0, distanceMethod: 'anisotropic-8-neighbor-chamfer',
  };

  for (let x = 0; x < COASTAL_FIELD_SIZE; x++) {
    const wx = worldX(x);
    // Current shoreDistance is affine in z at a fixed x. Derive its scale from the
    // authoritative CPU function, avoiding a separately copied shoreline derivative.
    const d0 = shoreDistance(wx, 0), dz = shoreDistance(wx, 1) - d0;
    const lowZ = (-70 - d0) / dz, highZ = (15 - d0) / dz;
    firstShoreRow[x] = Math.max(0, Math.ceil((lowZ - MIN_Z) / DZ - 0.5));
    lastShoreRow[x] = Math.min(COASTAL_FIELD_SIZE - 1, Math.floor((highZ - MIN_Z) / DZ - 0.5));
    for (let z = 0; z < COASTAL_FIELD_SIZE; z++) {
      const i = z * COASTAL_FIELD_SIZE + x;
      data[i * 4] = terrainHeight(wx, worldZ(z));
      data[i * 4 + 2] = NO_ROCK_HEIGHT;
    }
  }
  diagnostics.terrainMilliseconds = performance.now() - started;
  const rasterStart = performance.now();

  rocks.updateWorldMatrix(true, true);
  const localInstance = new THREE.Matrix4(), worldInstance = new THREE.Matrix4();
  const localBox = new THREE.Box3(), worldBox = new THREE.Box3();
  const vertex = new THREE.Vector3();

  rocks.traverse(object => {
    if (!(object instanceof THREE.InstancedMesh) || !visibleToRoot(object, rocks)) return;
    const mesh = object;
    const position = mesh.geometry.getAttribute('position');
    if (!position || position.itemSize < 3 || position.count === 0) return;
    // Compute a private bound; avoid mutating geometry.boundingBox.
    localBox.makeEmpty();
    for (let i = 0; i < position.count; i++) {
      vertex.set(position.getX(i), position.getY(i), position.getZ(i));
      localBox.expandByPoint(vertex);
    }
    const transformed = new Float64Array(position.count * 3);
    const index = mesh.geometry.getIndex();
    const available = index ? index.count : position.count;
    const first = Math.max(0, Math.floor(mesh.geometry.drawRange.start));
    const end = Math.min(available, first + mesh.geometry.drawRange.count);

    for (let instance = 0; instance < mesh.count; instance++) {
      diagnostics.instancesVisited++;
      mesh.getMatrixAt(instance, localInstance);
      worldInstance.multiplyMatrices(mesh.matrixWorld, localInstance);
      worldBox.copy(localBox).applyMatrix4(worldInstance);
      if (worldBox.max.x < MIN_X || worldBox.min.x > MAX_X ||
          worldBox.max.z < MIN_Z || worldBox.min.z > MAX_Z) continue;
      const minX = clampIndex(Math.ceil((worldBox.min.x - MIN_X) / DX - 0.5));
      const maxX = clampIndex(Math.floor((worldBox.max.x - MIN_X) / DX - 0.5));
      const minZ = Math.ceil((worldBox.min.z - MIN_Z) / DZ - 0.5);
      const maxZ = Math.floor((worldBox.max.z - MIN_Z) / DZ - 0.5);
      let intersectsShoreSamples = false;
      for (let x = minX; x <= maxX; x++) {
        if (Math.max(minZ, firstShoreRow[x]) <= Math.min(maxZ, lastShoreRow[x])) {
          intersectsShoreSamples = true;
          break;
        }
      }
      if (!intersectsShoreSamples) continue;
      diagnostics.instancesRasterized++;

      for (let i = 0; i < position.count; i++) {
        vertex.set(position.getX(i), position.getY(i), position.getZ(i)).applyMatrix4(worldInstance);
        transformed[i * 3] = vertex.x;
        transformed[i * 3 + 1] = vertex.y;
        transformed[i * 3 + 2] = vertex.z;
      }
      for (let triangle = first; triangle + 2 < end; triangle += 3) {
        diagnostics.trianglesVisited++;
        const ai = (index ? index.getX(triangle) : triangle) * 3;
        const bi = (index ? index.getX(triangle + 1) : triangle + 1) * 3;
        const ci = (index ? index.getX(triangle + 2) : triangle + 2) * 3;
        const ax = transformed[ai], ay = transformed[ai + 1], az = transformed[ai + 2];
        const bx = transformed[bi], by = transformed[bi + 1], bz = transformed[bi + 2];
        const cx = transformed[ci], cy = transformed[ci + 1], cz = transformed[ci + 2];
        const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        // Vertical triangles have zero xz area and do not cover any texel center.
        if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) {
          diagnostics.degenerateTriangles++;
          continue;
        }
        const left = Math.max(minX, Math.ceil((Math.min(ax, bx, cx) - MIN_X) / DX - 0.5));
        const right = Math.min(maxX, Math.floor((Math.max(ax, bx, cx) - MIN_X) / DX - 0.5));
        const bottom = Math.ceil((Math.min(az, bz, cz) - MIN_Z) / DZ - 0.5);
        const top = Math.floor((Math.max(az, bz, cz) - MIN_Z) / DZ - 0.5);
        if (left > right || bottom > top) continue;
        let hit = false;
        for (let x = left; x <= right; x++) {
          const wx = worldX(x);
          const z0 = Math.max(bottom, 0);
          const z1 = Math.min(top, COASTAL_FIELD_SIZE - 1);
          for (let z = z0; z <= z1; z++) {
            const wz = worldZ(z);
            const a = ((bz - cz) * (wx - cx) + (cx - bx) * (wz - cz)) / denominator;
            const b = ((cz - az) * (wx - cx) + (ax - cx) * (wz - cz)) / denominator;
            const c = 1 - a - b;
            if (a < -1e-8 || b < -1e-8 || c < -1e-8) continue;
            const y = a * ay + b * by + c * cy;
            if (!Number.isFinite(y)) continue;
            const pixel = z * COASTAL_FIELD_SIZE + x;
            if (y > tops[pixel]) tops[pixel] = y;
            hit = true;
          }
        }
        if (hit) diagnostics.trianglesRasterized++;
      }
    }
  });
  for (let i = 0; i < COUNT; i++) if (Number.isFinite(tops[i])) {
    data[i * 4 + 2] = tops[i];
    diagnostics.rockSamples++;
    if (tops[i] > BLOCKING_HEIGHT) {
      mask[i] = 1;
      diagnostics.blockingSamples++;
    }
  }
  diagnostics.rasterMilliseconds = performance.now() - rasterStart;
  const distanceStart = performance.now();
  const distances = signedChamfer(mask);
  for (let i = 0; i < COUNT; i++) data[i * 4 + 1] = distances[i];
  diagnostics.distanceMilliseconds = performance.now() - distanceStart;
  const shelterStart=performance.now();
  const lee=rockShelter(mask,COASTAL_FIELD_SIZE,COASTAL_FIELD_SIZE,DX,DZ,column=>{const n=coastNormal(worldX(column));return n[0]/n[1]});
  for(let i=0;i<COUNT;i++)data[i*4+3]=lee[i];
  diagnostics.shelterMilliseconds=performance.now()-shelterStart;

  const texture = new THREE.DataTexture(data, COASTAL_FIELD_SIZE, COASTAL_FIELD_SIZE,
    THREE.RGBAFormat, THREE.FloatType);
  texture.name = 'coastal-terrain-rock-field';
  texture.internalFormat = 'RGBA32F';
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  diagnostics.buildMilliseconds = performance.now() - started;
  return { texture, bounds: new THREE.Vector4(MIN_X, MIN_Z, MAX_X, MAX_Z), diagnostics };
}

/**
 * Bind uniforms uCoastalField={value:field.texture}, uCoastalBounds={value:field.bounds}.
 * R/G/A are manually bilinear; B remains the nearest actual top-height sample.
 * Outside the domain the helper returns deep bed/no rock/no shelter; fieldValid lets
 * callers instead choose an analytic terrain fallback. This is GLSL1/WebGL2 compatible.
 */
export const coastalFieldGLSL = /* glsl */ `
uniform sampler2D uCoastalField;
uniform vec4 uCoastalBounds;
float coastalFieldValid(vec2 p) {
  return step(uCoastalBounds.x,p.x)*step(p.x,uCoastalBounds.z)*
         step(uCoastalBounds.y,p.y)*step(p.y,uCoastalBounds.w);
}
vec2 coastalFieldUV(vec2 p) {
  return (p-uCoastalBounds.xy)/(uCoastalBounds.zw-uCoastalBounds.xy);
}
vec4 coastalFieldSample(vec2 p) {
  if (coastalFieldValid(p)<0.5) return vec4(-85.,32.,-100.,0.);
  vec2 uv=coastalFieldUV(p), grid=uv*1024.-0.5;
  vec2 base=floor(grid), f=fract(grid);
  vec2 uv00=(base+0.5)/1024.;
  vec4 s00=texture2D(uCoastalField,uv00);
  vec4 s10=texture2D(uCoastalField,uv00+vec2(1./1024.,0.));
  vec4 s01=texture2D(uCoastalField,uv00+vec2(0.,1./1024.));
  vec4 s11=texture2D(uCoastalField,uv00+vec2(1./1024.,1./1024.));
  vec4 s=mix(mix(s00,s10,f.x),mix(s01,s11,f.x),f.y);
  s.b=texture2D(uCoastalField,uv).b;
  return s;
}
`;

/**
 * CPU verification example, not called by createCoastalField or at application startup.
 * Checks world/instance transforms, overlapping top surfaces, a rotated/scaled submerged
 * box, a non-indexed sloping surface, signed boundary distance, Float32 terrain equality,
 * and finite/clamped channels.
 * Throws on failure; creates no WebGL context and disposes its temporary resources.
 */
export function verifyCoastalFieldCPU(): { checks: number; diagnostics: CoastalFieldDiagnostics } {
  let checks = 0;
  const check = (ok: boolean, message: string) => { checks++; if (!ok) throw Error(message); };
  const group = new THREE.Group();
  group.position.set(2, 1, -2);
  const geometry = new THREE.BoxGeometry(12, 4, 8);
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, 3);
  mesh.position.set(3, 2, -4);
  const transform = new THREE.Object3D();
  transform.position.set(0, 0, 65); transform.updateMatrix(); mesh.setMatrixAt(0, transform.matrix);
  transform.position.set(30, -6, 60); transform.rotation.y = Math.PI / 2;
  transform.scale.set(1.5, 0.5, 1); transform.updateMatrix(); mesh.setMatrixAt(1, transform.matrix);
  transform.position.set(0, 4, 65); transform.rotation.y = 0;
  transform.scale.set(0.5, 0.5, 0.5); transform.updateMatrix(); mesh.setMatrixAt(2, transform.matrix);
  group.add(mesh);
  const slopeGeometry = new THREE.BufferGeometry();
  const slopeVertices: number[] = [];
  for (const [x, z] of [[-10, -8], [10, -8], [10, 8], [-10, -8], [10, 8], [-10, 8]]) {
    slopeVertices.push(x, 2 + 0.2 * x + 0.1 * z, z);
  }
  slopeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(slopeVertices, 3));
  const slopeMesh = new THREE.InstancedMesh(slopeGeometry, material, 1);
  slopeMesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-50, 0, 60));
  group.add(slopeMesh);
  const field = createCoastalField(group);
  const values = field.texture.image.data as Float32Array;
  const at = (x: number, z: number) => {
    const col = clampIndex(Math.floor((x - MIN_X) / DX));
    const row = clampIndex(Math.floor((z - MIN_Z) / DZ));
    const index = row * COASTAL_FIELD_SIZE + col;
    return { col, row, index, x: worldX(col), z: worldZ(row),
      terrain: values[index * 4], distance: values[index * 4 + 1], top: values[index * 4 + 2] };
  };
  try {
    const overlap = at(5, 59), baseOnly = at(9.5, 59), submerged = at(35, 54), empty = at(-100, 40);
    check(overlap.top === 8, 'The highest overlapping box surface must be world y=8.');
    check(baseOnly.top === 5, 'The parent+mesh+instance transformed base top must be y=5.');
    check(overlap.distance < 0, 'A sea-blocking box must have negative interior distance.');
    check(submerged.top === -2, 'A rotated/scaled submerged box must retain its actual top.');
    check(submerged.distance > 0, 'A submerged box below -0.35 must not block the sea.');
    check(empty.top === NO_ROCK_HEIGHT && empty.distance === 32, 'Empty far cells must use defaults.');
    const sloping = at(-48, 58);
    check(Math.abs(sloping.top - (3 + 0.2 * (sloping.x + 48) + 0.1 * (sloping.z - 58))) < 1e-5,
      'Non-indexed sloping triangles must interpolate world height barycentrically.');
    for (const sample of [overlap, baseOnly, submerged, empty]) {
      check(sample.terrain === Math.fround(terrainHeight(sample.x, sample.z)), 'R must match CPU terrain exactly after Float32 storage.');
    }
    let right = overlap.col;
    while (right < COASTAL_FIELD_SIZE - 1 && values[(overlap.row * COASTAL_FIELD_SIZE + right) * 4 + 1] < 0) right++;
    check(Math.abs(values[(overlap.row * COASTAL_FIELD_SIZE + right) * 4 + 1] - DX / 2) < 1e-6,
      'The first free pixel outside an axis-aligned box should be half an x texel from its boundary.');
    check(field.diagnostics.instancesRasterized === 4, 'All four nearshore instances should be rasterized.');
    let valid = true;
    for (let i = 0; i < COUNT; i++) {
      const j = i * 4;
      if (!Number.isFinite(values[j]) || !Number.isFinite(values[j + 1]) ||
          !Number.isFinite(values[j + 2]) || Math.abs(values[j + 1]) > 32 || !Number.isFinite(values[j+3]) || values[j+3]<0 || values[j+3]>.920001) { valid = false; break; }
    }
    check(valid, 'Every channel must be finite; G clamped; lee A bounded in [0,.92].');
    return { checks, diagnostics: field.diagnostics };
  } finally {
    field.texture.dispose(); geometry.dispose(); slopeGeometry.dispose(); material.dispose();
  }
}
