import * as THREE from 'three';
import { rng, noise, terrainSlope, shoreDistance } from './math';
import { habitatAt } from './habitat';
import { renderedTerrainHeight } from './terrain-surface';
import { pathPosition } from '../camera/cinematic';
import { windMaterial, type Textures } from '../render/materials';

/**
 * Candidate integration target: src/world/forest-structure.ts.
 * No new dependencies, texture downloads, runtime simulation, or global state changes.
 * Geometry is instanced by four shrub forms and three snag forms: at most 14 draws.
 * Main's existing material traversal should apply cloud lighting and diagnostics.
 * All roots use the rendered triangle height, not the ideal heightfield.
 */
const SEED = 607193;
const SHRUB_TARGET = 420;
const SNAG_TARGET = 24;
const TAU = Math.PI * 2;

type Habitat = ReturnType<typeof habitatAt>;
type Kind = 'shrub' | 'snag';
type PlantPlacement = {
  kind: Kind; variant: number; x: number; y: number; z: number;
  angle: number; scale: number; radius: number; height: number;
  moisture: number; exposure: number; soil: number;
};
type Shape = {
  wood: THREE.BufferGeometry; other: THREE.BufferGeometry;
  radius: number; height: number; leafCount: number;
};
export type ForestStructureStats = {
  seed: number; shrubs: number; snags: number; leafSurfaces: number;
  drawCalls: number; instancedTriangles: number; sourceTriangles: number;
  routeRejected: number; spacingRejected: number;
  shrubAttempts: number; snagAttempts: number; placementSignature: string;
  buildMilliseconds: number; maxShrubHeight: number; maxSnagHeight: number;
};

/** One attribute layout for all parts; no disposable merge intermediates. */
class GeometryBuilder {
  positions: number[] = [];
  colors: number[] = [];
  uv: number[] = [];
  indices: number[] = [];
  vertex(p: THREE.Vector3, c: THREE.Color, u = 0, v = 0): number {
    const id = this.positions.length / 3;
    this.positions.push(p.x, p.y, p.z);
    this.colors.push(c.r, c.g, c.b);
    this.uv.push(u, v);
    return id;
  }
  triangle(a: number, b: number, c: number) { this.indices.push(a, b, c); }
  finish(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.indices); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}

function frame(direction: THREE.Vector3): [THREE.Vector3, THREE.Vector3] {
  const axis = Math.abs(direction.y) > 0.94 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(direction, axis).normalize();
  return [side, new THREE.Vector3().crossVectors(direction, side).normalize()];
}

/** Tapered ring geometry, with an irregular splintered last ring and a separate cut face. */
function woodTube(
  wood: GeometryBuilder, cuts: GeometryBuilder | null,
  points: THREE.Vector3[], radii: number[], sides: number, random: () => number,
  tint: THREE.Color, broken = false,
) {
  const rings: number[][] = [], ringPoints: THREE.Vector3[][] = [];
  let distance = 0;
  const seam = random() * TAU;
  for (let j = 0; j < points.length; j++) {
    if (j) distance += points[j].distanceTo(points[j - 1]);
    const tangent = points[Math.min(j + 1, points.length - 1)].clone()
      .sub(points[Math.max(j - 1, 0)]).normalize();
    const [side, around] = frame(tangent), ids: number[] = [], ps: THREE.Vector3[] = [];
    for (let k = 0; k <= sides; k++) {
      // Duplicate the first ring vertex at the UV seam, with identical geometry.
      if (k === sides) {
        ps.push(ps[0].clone()); ids.push(wood.vertex(ps[0], tint, 1, distance / 1.6)); continue;
      }
      const angle = seam + k / sides * TAU;
      const ridge = 0.94 + 0.08 * Math.sin(k * 2.17 + seam);
      const p = points[j].clone().addScaledVector(side, Math.cos(angle) * radii[j] * ridge)
        .addScaledVector(around, Math.sin(angle) * radii[j] * ridge);
      if (broken && j === points.length - 1) p.addScaledVector(tangent, (random() - 0.35) * radii[j] * 2.2);
      const c = tint.clone().multiplyScalar(0.89 + 0.16 * ((k * 0.618 + j * 0.09) % 1));
      ids.push(wood.vertex(p, c, k / sides, distance / 1.6)); ps.push(p);
    }
    rings.push(ids); ringPoints.push(ps);
  }
  for (let j = 0; j < rings.length - 1; j++) for (let k = 0; k < sides; k++) {
    wood.triangle(rings[j][k], rings[j][k + 1], rings[j + 1][k]);
    wood.triangle(rings[j][k + 1], rings[j + 1][k + 1], rings[j + 1][k]);
  }
  if (cuts) {
    const last = ringPoints[ringPoints.length - 1], color = new THREE.Color(0xa59b82);
    const center = cuts.vertex(points[points.length - 1], color.clone().multiplyScalar(0.83), 0.5, 0.5);
    const edge = last.slice(0, sides).map((p, i) => cuts.vertex(p, color.clone().multiplyScalar(0.9 + random() * 0.13),
      0.5 + Math.cos(i / sides * TAU) * 0.5, 0.5 + Math.sin(i / sides * TAU) * 0.5));
    for (let k = 0; k < sides; k++) cuts.triangle(center, edge[k], edge[(k + 1) % sides]);
  }
}

/** Closed eight-triangle leaf lamina with arched upper face and distinct lower face. */
function leafVolume(builder: GeometryBuilder, root: THREE.Vector3, direction: THREE.Vector3,
  length: number, width: number, color: THREE.Color) {
  const forward = direction.clone().normalize();
  const side = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  if (side.lengthSq() < 0.1) side.set(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(side, forward).normalize();
  if (up.y < 0) up.negate();
  const middle = root.clone().addScaledVector(forward, length * 0.48);
  const boundary = [root, middle.clone().addScaledVector(side, width * 0.5),
    root.clone().addScaledVector(forward, length).addScaledVector(up, -length * 0.075),
    middle.clone().addScaledVector(side, -width * 0.5)];
  const ids = boundary.map((p, i) => builder.vertex(p, color, i === 1 ? 0 : i === 3 ? 1 : 0.5, i === 2 ? 1 : i === 0 ? 0 : 0.5));
  const top = builder.vertex(middle.clone().addScaledVector(up, length * 0.055), color, 0.5, 0.5);
  const bottom = builder.vertex(middle.clone().addScaledVector(up, -0.0025), color.clone().lerp(new THREE.Color(0x9a9e75), 0.26), 0.5, 0.5);
  for (let i = 0; i < 4; i++) {
    builder.triangle(top, ids[i], ids[(i + 1) % 4]);
    builder.triangle(bottom, ids[(i + 1) % 4], ids[i]);
  }
}

function bounds(wood: THREE.BufferGeometry, other: THREE.BufferGeometry, leafCount = 0): Shape {
  const box = wood.boundingBox!.clone().union(other.boundingBox!);
  return { wood, other, radius: Math.hypot(Math.max(Math.abs(box.min.x), Math.abs(box.max.x)),
    Math.max(Math.abs(box.min.z), Math.abs(box.max.z))), height: box.max.y, leafCount };
}

function shrubShape(variant: number): Shape {
  const random = rng(SEED + 101 + variant * 431);
  const wood = new GeometryBuilder(), foliage = new GeometryBuilder();
  const height = 1.28 + variant * 0.13, stems = 3 + variant % 2;
  let leafCount = 0;
  for (let s = 0; s < stems; s++) {
    const angle = s / stems * TAU + random() * 0.45;
    const spread = 0.36 + random() * 0.4, stemHeight = height * (0.72 + random() * 0.28);
    const points = Array.from({ length: 5 }, (_, j) => {
      const u = j / 4, bend = angle + u * 0.25;
      return new THREE.Vector3(Math.cos(bend) * spread * u * u, -0.17 + (stemHeight + 0.17) * u,
        Math.sin(bend) * spread * u * u);
    });
    woodTube(wood, null, points, [0.046, 0.033, 0.022, 0.012, 0.003], 5, random, new THREE.Color(0x8f8d6c));
    for (let branch = 0; branch < 3; branch++) {
      const attach = points[branch + 1].clone();
      const direction = angle + (branch % 2 ? -1 : 1) * (0.6 + random() * 0.7);
      const length = (0.39 + random() * 0.28) * (1 - branch * 0.13);
      const end = attach.clone().add(new THREE.Vector3(Math.cos(direction) * length, 0.19 + random() * 0.19, Math.sin(direction) * length));
      const mid = attach.clone().lerp(end, 0.55).add(new THREE.Vector3(0, 0.06, 0));
      woodTube(wood, null, [attach, mid, end], [0.014, 0.008, 0.0015], 4, random, new THREE.Color(0x858768));
      for (let l = 0; l < 7; l++) {
        const u = (l + 0.45) / 7, root = attach.clone().lerp(end, u);
        const leafAngle = direction + (l % 2 ? -1 : 1) * (0.62 + random() * 0.5);
        const leafDirection = new THREE.Vector3(Math.cos(leafAngle), 0.05 + random() * 0.38, Math.sin(leafAngle));
        const color = new THREE.Color().setHSL(0.205 + random() * 0.065, 0.28 + random() * 0.17, 0.18 + random() * 0.10);
        leafVolume(foliage, root, leafDirection, 0.18 + random() * 0.10, 0.075 + random() * 0.045, color); leafCount++;
      }
    }
    // A small apical spray conceals the exposed stem tip without a solid crown blob.
    for (let l = 0; l < 4; l++) {
      const a = angle + l * 2.399;
      leafVolume(foliage, points[4], new THREE.Vector3(Math.cos(a), 0.2 + random() * 0.35, Math.sin(a)),
        0.19 + random() * 0.08, 0.09, new THREE.Color(0x426331)); leafCount++;
    }
  }
  return bounds(wood.finish(), foliage.finish(), leafCount);
}

function snagShape(variant: number): Shape {
  const random = rng(SEED + 5039 + variant * 883);
  const wood = new GeometryBuilder(), cuts = new GeometryBuilder();
  const height = 5.4 + variant * 1.22, radius = 0.24 + variant * 0.055;
  const lean = new THREE.Vector3((random() - 0.5) * 0.65, 0, (random() - 0.5) * 0.65);
  const points = Array.from({ length: 9 }, (_, j) => {
    const u = j / 8;
    return new THREE.Vector3(lean.x * u * u + Math.sin(u * 6.2) * 0.07,
      -0.44 + (height + 0.44) * u, lean.z * u * u + Math.sin(u * 4.5) * 0.065);
  });
  const radii = points.map((_, i) => radius * (0.32 + 0.68 * Math.pow(1 - i / 8, 0.85)) * (i === 0 ? 1.28 : 1));
  woodTube(wood, cuts, points, radii, 16, random, new THREE.Color(0xb2ad9e), true);
  for (let b = 0; b < 5 + variant; b++) {
    const u = 0.28 + b / (6 + variant) * 0.58, index = Math.min(7, Math.floor(u * 8));
    const start = points[index].clone().lerp(points[index + 1], u * 8 - index);
    const angle = b * 2.399 + random() * 0.48;
    const length = 0.72 + random() * 1.27, rise = 0.3 + random() * 0.7;
    const direction = new THREE.Vector3(Math.cos(angle), rise, Math.sin(angle)).normalize();
    const mid = start.clone().addScaledVector(direction, length * 0.56);
    const end = start.clone().addScaledVector(direction, length).add(new THREE.Vector3(0, -0.08, 0));
    const branchRadius = radius * (0.36 - u * 0.16);
    woodTube(wood, cuts, [start, mid, end], [branchRadius, branchRadius * 0.55, branchRadius * 0.19],
      6, random, new THREE.Color(0xaaa694), true);
    if (b % 3 === 1) {
      const fork = mid.clone().add(new THREE.Vector3(Math.cos(angle + 0.85) * 0.46, 0.29, Math.sin(angle + 0.85) * 0.46));
      woodTube(wood, cuts, [mid, mid.clone().lerp(fork, 0.55), fork], [branchRadius * 0.46, branchRadius * 0.2, 0.006],
        5, random, new THREE.Color(0x9f9c8d), true);
    }
  }
  return bounds(wood.finish(), cuts.finish());
}

export function createForestStructure(textures: Textures, liveTrees:readonly {x:number,z:number,scale:number}[]=[]): { group: THREE.Group; stats: ForestStructureStats } {
  const started = performance.now(), group = new THREE.Group();
  group.name = 'habitat-shrubs-and-standing-snags';
  const random = rng(SEED), shrubShapes = Array.from({ length: 4 }, (_, i) => shrubShape(i));
  const snagShapes = Array.from({ length: 3 }, (_, i) => snagShape(i));
  // Same 20-second route and 1/30-second sampling convention used by ecology.ts.
  const flight = Array.from({ length: 601 }, (_, i) => pathPosition(i / 30));
  const placements: PlantPlacement[] = [];
  const stats: ForestStructureStats = { seed: SEED, shrubs: 0, snags: 0, leafSurfaces: 0,
    drawCalls: 0, instancedTriangles: 0, sourceTriangles: 0, routeRejected: 0, spacingRejected: 0,
    shrubAttempts: 0, snagAttempts: 0, placementSignature: '', buildMilliseconds: 0, maxShrubHeight: 0, maxSnagHeight: 0 };

  const trunkCells=new Map<string,{x:number,z:number,scale:number}[]>();
  for(const tree of liveTrees){const key=Math.floor(tree.x/16)+','+Math.floor(tree.z/16);const list=trunkCells.get(key)||[];list.push(tree);trunkCells.set(key,list)}
  function liveTrunkTooClose(x:number,z:number,kind:Kind){
    const cx=Math.floor(x/16),cz=Math.floor(z/16);
    for(let zc=cz-1;zc<=cz+1;zc++)for(let xc=cx-1;xc<=cx+1;xc++)for(const tree of trunkCells.get(xc+','+zc)||[]){
      if(Math.hypot(tree.x-x,tree.z-z)<(kind==='snag'?1.5:.65)+tree.scale*.55)return true;
    }
    return false;
  }
  function place(kind: Kind, x: number, z: number, habitat: Habitat, variant: number, scale: number): boolean {
    if(liveTrunkTooClose(x,z,kind)){stats.spacingRejected++;return false}
    const shape = kind === 'shrub' ? shrubShapes[variant] : snagShapes[variant];
    const y = renderedTerrainHeight(x, z) - 0.055;
    const radius = shape.radius * scale, height = shape.height * scale;
    if (flight.some(p => p.y > y - 1.5 && p.y < y + height + 2.5 && Math.hypot(p.x - x, p.z - z) < radius + 2.2)) {
      stats.routeRejected++; return false;
    }
    if (placements.some(p => {
      const separation = kind === 'snag' && p.kind === 'snag' ? 19 :
        kind !== p.kind ? 1.5 + radius + p.radius : (radius + p.radius) * 0.78;
      return Math.hypot(p.x - x, p.z - z) < separation;
    })) { stats.spacingRejected++; return false; }
    placements.push({ kind, variant, x, y, z, angle: random() * TAU, scale, radius, height,
      moisture: habitat.moisture, exposure: habitat.exposure, soil: habitat.soil });
    return true;
  }

  // Sparse stressed/dead forms first, so young growth retains clearance around their bases.
  for (let i = 0; i < 14000 && stats.snags < SNAG_TARGET; i++) {
    stats.snagAttempts++;
    const x = (random() - 0.5) * 940, z = -75 + random() * 690, d = shoreDistance(x, z);
    if (d < 58 || d > 235 || terrainSlope(x, z) > 0.85) continue;
    const habitat = habitatAt(x, z);
    if (habitat.soil < 0.34 || habitat.canopy < 0.24 || habitat.exposure < 0.24 ||
        noise(x * 0.034 + 11, z * 0.034) < 0.38 || random() > 0.2 + habitat.exposure * 0.52) continue;
    const variant = Math.floor(random() * snagShapes.length), scale = 0.76 + random() * 0.39;
    if (place('snag', x, z, habitat, variant, scale)) stats.snags++;
  }
  for (let i = 0; i < 30000 && stats.shrubs < SHRUB_TARGET; i++) {
    stats.shrubAttempts++;
    const x = (random() - 0.5) * 980, z = -135 + random() * 820, d = shoreDistance(x, z);
    if (d < 31 || d > 260 || terrainSlope(x, z) > 0.82) continue;
    const habitat = habitatAt(x, z), clump = noise(x * 0.033 + 29, z * 0.033 - 14);
    if (habitat.soil < 0.28 || habitat.moisture < 0.38 || clump < 0.40) continue;
    const density = (0.18 + habitat.soil * 0.43 + habitat.moisture * 0.31) * (0.88 - habitat.canopy * 0.27);
    if (random() > density) continue;
    const variant = Math.floor(random() * shrubShapes.length);
    const scale = (0.72 + random() * 0.65) * (1 - habitat.exposure * 0.24);
    if (place('shrub', x, z, habitat, variant, scale)) stats.shrubs++;
  }

  const shrubWood = windMaterial(0xffffff, true, textures); shrubWood.vertexColors = true;
  const shrubLeaves = windMaterial(0xffffff); shrubLeaves.roughness = 0.83;
  const snagWood = new THREE.MeshStandardMaterial({ map: textures.bark, normalMap: textures.barkNormal,
    normalScale: new THREE.Vector2(0.42, 0.42), color: 0xffffff, vertexColors: true, roughness: 0.96 });
  const cutWood = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true,
    roughness: 0.98, side: THREE.DoubleSide });
  const dummy = new THREE.Object3D();
  const triangles = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  for (const [kind, shapes, woodMaterial, otherMaterial] of [
    ['shrub', shrubShapes, shrubWood, shrubLeaves], ['snag', snagShapes, snagWood, cutWood],
  ] as const) for (let variant = 0; variant < shapes.length; variant++) {
    const shape = shapes[variant], matching = placements.filter(p => p.kind === kind && p.variant === variant);
    stats.sourceTriangles += triangles(shape.wood) + triangles(shape.other);
    if (!matching.length) { shape.wood.dispose(); shape.other.dispose(); continue; }
    const wood = new THREE.InstancedMesh(shape.wood, woodMaterial, matching.length);
    const other = new THREE.InstancedMesh(shape.other, otherMaterial, matching.length);
    wood.name = `${kind}-${variant}-wood`; other.name = `${kind}-${variant}-${kind === 'shrub' ? 'leaf-volumes' : 'broken-ends'}`;
    matching.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.angle, 0); dummy.scale.setScalar(p.scale); dummy.updateMatrix();
      wood.setMatrixAt(i, dummy.matrix); other.setMatrixAt(i, dummy.matrix);
      // Slow habitat variation only; individual leaves carry their own color variation.
      other.setColorAt(i, new THREE.Color().setRGB(0.88 + p.moisture * 0.1, 0.91 + p.moisture * 0.07, 0.85 + p.moisture * 0.09));
      if (kind === 'shrub') { stats.leafSurfaces += shape.leafCount; stats.maxShrubHeight = Math.max(stats.maxShrubHeight, p.height); }
      else stats.maxSnagHeight = Math.max(stats.maxSnagHeight, p.height);
    });
    for (const mesh of [wood, other]) {
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      // Include wind displacement in the static instance bounds.
      if (kind === 'shrub' && mesh.boundingSphere) mesh.boundingSphere.radius += 1;
      group.add(mesh); stats.drawCalls++;
    }
    stats.instancedTriangles += (triangles(shape.wood) + triangles(shape.other)) * matching.length;
  }
  let signature = 2166136261;
  for (const p of placements) for (const value of [p.x, p.y, p.z, p.scale, p.angle, p.variant]) {
    signature = Math.imul(signature ^ Math.round(value * 10000), 16777619) >>> 0;
  }
  stats.placementSignature = signature.toString(16).padStart(8, '0');
  stats.buildMilliseconds = performance.now() - started;
  group.userData.counts = { shrubs: stats.shrubs, snags: stats.snags, leafSurfaces: stats.leafSurfaces };
  group.userData.forestStructureStats = stats;
  group.userData.forestStructurePlacements = placements;
  return { group, stats };
}
