/**
 * Chunk meshes on the GPU: up to three meshes per chunk (opaque, cutout, translucent), built from the
 * mesher's batches as they arrive on the bus, replaced on re-mesh and freed when the chunk leaves the view.
 */
import * as THREE from 'three';
import type { GameBus } from '../core/context';
import { CHUNK_SIZE, WORLD_HEIGHT, type ChunkMeshData, type MeshBatch } from '../core/types';
import type { ChunkMaterials } from './materials';

const BATCHES = ['opaque', 'cutout', 'translucent'] as const;
type BatchName = (typeof BATCHES)[number];
/** Opaque first (front to back, sorted by three), then alpha-tested plants, then blended water and glass. */
const RENDER_ORDER: Record<BatchName, number> = { opaque: 0, cutout: 1, translucent: 2 };

interface ChunkEntry {
  cx: number;
  cz: number;
  meshes: (THREE.Mesh | null)[];
  triangles: number;
}

const key = (cx: number, cz: number): number => ((cx + 32768) << 16) | ((cz + 32768) & 0xffff);

/** Uploads a batch as an indexed geometry. Indices are narrowed to 16 bits whenever the vertex count allows. */
export function batchGeometry(batch: MeshBatch): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(batch.positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(batch.uvs, 2));
  g.setAttribute('layer', new THREE.BufferAttribute(batch.layers, 1));
  g.setAttribute('light', new THREE.BufferAttribute(batch.light, 4, true));
  const vertices = batch.positions.length / 3;
  g.setIndex(new THREE.BufferAttribute(vertices <= 0xffff ? Uint16Array.from(batch.indices) : batch.indices, 1));
  let minY = WORLD_HEIGHT;
  let maxY = 0;
  const p = batch.positions;
  for (let i = 1; i < p.length; i += 3) {
    const y = p[i];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  // Plants sway a few centimetres outside their cell; the margin keeps them from being culled early.
  g.boundingBox = new THREE.Box3(new THREE.Vector3(-0.1, minY - 0.1, -0.1), new THREE.Vector3(CHUNK_SIZE + 0.1, maxY + 0.1, CHUNK_SIZE + 0.1));
  g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
  return g;
}

export class ChunkMeshes {
  readonly group = new THREE.Group();
  private readonly chunks = new Map<number, ChunkEntry>();
  private readonly offs: (() => void)[];
  private triangleCount = 0;

  constructor(bus: GameBus, private readonly materials: ChunkMaterials) {
    this.group.name = 'chunks';
    this.group.matrixAutoUpdate = false;
    this.offs = [
      bus.on('chunk:meshed', ({ mesh }) => this.add(mesh)),
      bus.on('chunk:hidden', ({ cx, cz }) => this.remove(cx, cz)),
      bus.on('chunk:unloaded', ({ cx, cz }) => this.remove(cx, cz)),
    ];
  }

  /** Number of chunks with a mesh. */
  get count(): number {
    return this.chunks.size;
  }

  /** Triangles across every chunk mesh (drawn or culled). */
  get triangles(): number {
    return this.triangleCount;
  }

  has(cx: number, cz: number): boolean {
    return this.chunks.has(key(cx, cz));
  }

  /** Takes ownership of a chunk's mesh data, replacing whatever was drawn for that chunk. */
  add(data: ChunkMeshData): void {
    const k = key(data.cx, data.cz);
    let entry = this.chunks.get(k);
    if (!entry) {
      entry = { cx: data.cx, cz: data.cz, meshes: [null, null, null], triangles: 0 };
      this.chunks.set(k, entry);
    }
    this.triangleCount -= entry.triangles;
    entry.triangles = 0;
    for (let i = 0; i < BATCHES.length; i++) {
      const name = BATCHES[i];
      const batch = data[name];
      let mesh = entry.meshes[i];
      if (mesh) mesh.geometry.dispose();
      if (batch.indices.length === 0) {
        if (mesh) {
          this.group.remove(mesh);
          entry.meshes[i] = null;
        }
        continue;
      }
      const geometry = batchGeometry(batch);
      if (!mesh) {
        mesh = new THREE.Mesh(geometry, this.materials[name]);
        mesh.name = `chunk ${data.cx},${data.cz} ${name}`;
        mesh.position.set(data.cx * CHUNK_SIZE, 0, data.cz * CHUNK_SIZE);
        mesh.renderOrder = RENDER_ORDER[name];
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        mesh.updateMatrixWorld(true);
        entry.meshes[i] = mesh;
        this.group.add(mesh);
      } else {
        mesh.geometry = geometry;
      }
      entry.triangles += batch.indices.length / 3;
    }
    this.triangleCount += entry.triangles;
  }

  /** Frees a chunk's meshes (it left the view or was unloaded). */
  remove(cx: number, cz: number): void {
    const k = key(cx, cz);
    const entry = this.chunks.get(k);
    if (!entry) return;
    for (const mesh of entry.meshes) {
      if (!mesh) continue;
      mesh.geometry.dispose();
      this.group.remove(mesh);
    }
    this.triangleCount -= entry.triangles;
    this.chunks.delete(k);
  }

  clear(): void {
    for (const entry of [...this.chunks.values()]) this.remove(entry.cx, entry.cz);
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.clear();
  }
}
