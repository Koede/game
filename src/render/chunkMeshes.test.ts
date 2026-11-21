import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import type { ChunkMeshData, MeshBatch } from '../core/types';
import { batchGeometry, ChunkMeshes } from './chunkMeshes';
import { createChunkMaterials, createWorldUniforms } from './materials';

function quads(n: number, y = 5): MeshBatch {
  const positions = new Float32Array(n * 12);
  for (let i = 0; i < n * 4; i++) positions[i * 3 + 1] = y + (i % 2);
  const indices = new Uint32Array(n * 6);
  for (let q = 0; q < n; q++) indices.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
  return { positions, uvs: new Float32Array(n * 8), layers: new Float32Array(n * 4), light: new Uint8Array(n * 16), indices };
}
const mesh = (cx: number, cz: number, opaque: number, cutout: number, translucent: number): ChunkMeshData => ({
  cx, cz, opaque: quads(opaque), cutout: quads(cutout), translucent: quads(translucent),
});

describe('chunk meshes', () => {
  it('uploads a batch with 16-bit indices and a bounding box fitted to its height', () => {
    const g = batchGeometry(quads(3, 40));
    expect(g.getIndex()?.array).toBeInstanceOf(Uint16Array);
    expect(g.getAttribute('light').normalized).toBe(true);
    expect(g.boundingBox?.min.y).toBeCloseTo(39.9, 5);
    expect(g.boundingBox?.max.y).toBeCloseTo(41.1, 5);
  });

  it('keeps one mesh per non-empty batch, positioned at the chunk, and replaces it on re-mesh', () => {
    const bus = createBus();
    const chunks = new ChunkMeshes(bus, createChunkMaterials(createWorldUniforms(null)));
    bus.emit('chunk:meshed', { mesh: mesh(2, -3, 10, 0, 4) });
    expect(chunks.count).toBe(1);
    expect(chunks.group.children.length).toBe(2);
    expect(chunks.triangles).toBe(28);
    const first = chunks.group.children[0] as import('three').Mesh;
    expect(first.position.x).toBe(32);
    expect(first.position.z).toBe(-48);
    let disposed = 0;
    first.geometry.addEventListener('dispose', () => disposed++);
    bus.emit('chunk:meshed', { mesh: mesh(2, -3, 5, 1, 0) });
    expect(disposed).toBe(1);
    expect(chunks.group.children.length).toBe(2);
    expect(chunks.triangles).toBe(12);
    // Draw order: opaque, then cutout, then translucent.
    const orders = chunks.group.children.map((m) => m.renderOrder).sort();
    expect(orders).toEqual([0, 1]);
  });

  it('drops a chunk on chunk:hidden and chunk:unloaded, and stops listening on dispose', () => {
    const bus = createBus();
    const chunks = new ChunkMeshes(bus, createChunkMaterials(createWorldUniforms(null)));
    bus.emit('chunk:meshed', { mesh: mesh(0, 0, 1, 1, 1) });
    bus.emit('chunk:meshed', { mesh: mesh(1, 0, 1, 0, 0) });
    bus.emit('chunk:hidden', { cx: 0, cz: 0 });
    expect(chunks.has(0, 0)).toBe(false);
    expect(chunks.count).toBe(1);
    bus.emit('chunk:unloaded', { cx: 1, cz: 0 });
    expect(chunks.count).toBe(0);
    expect(chunks.triangles).toBe(0);
    expect(chunks.group.children.length).toBe(0);
    chunks.dispose();
    bus.emit('chunk:meshed', { mesh: mesh(0, 0, 1, 1, 1) });
    expect(chunks.count).toBe(0);
  });
});
