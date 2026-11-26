import { describe, expect, it } from 'vitest';
import { createBus, type GameBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { mulberry32 } from '../core/math';
import { blockId } from '../core/registry';
import { AIR, CHUNK_SIZE, makeVoxel, voxelId, voxelIndex, type BlockEntity, type ChunkMeshData } from '../core/types';
import { chunkCoord, localCoord } from './chunk';
import { findCaveCamp } from './caveRooms';
import { runJob } from './jobs';
import { generateChunk } from './worldgen';
import { World } from './world';

const SEED = 20261121;
const STONE = makeVoxel(blockId('stone'));
const TORCH = makeVoxel(blockId('torch'));
const CORESTONE = blockId('corestone');

interface Recorder {
  bus: GameBus;
  count(type: keyof GameEvents, cx?: number, cz?: number): number;
  meshes: ChunkMeshData[];
  clear(): void;
}

function record(): Recorder {
  const bus = createBus();
  const events: { type: keyof GameEvents; cx?: number; cz?: number }[] = [];
  const meshes: ChunkMeshData[] = [];
  for (const type of ['chunk:loaded', 'chunk:unloaded', 'chunk:hidden'] as const) bus.on(type, ({ cx, cz }) => events.push({ type, cx, cz }));
  bus.on('chunk:meshed', ({ mesh }) => {
    events.push({ type: 'chunk:meshed', cx: mesh.cx, cz: mesh.cz });
    meshes.push(mesh);
  });
  bus.on('block:changed', () => events.push({ type: 'block:changed' }));
  return {
    bus,
    meshes,
    count: (type, cx, cz) => events.filter((e) => e.type === type && (cx === undefined || (e.cx === cx && e.cz === cz))).length,
    clear: () => {
      events.length = 0;
      meshes.length = 0;
    },
  };
}

/** Runs update() until no work is left (main-thread pool: jobs run inside update, results land a tick later). */
async function settle(world: World, x: number, z: number, r = 2): Promise<void> {
  let stable = 0;
  let last = '';
  for (let i = 0; i < 2000 && stable < 3; i++) {
    world.update(x, z, r, 1000);
    await new Promise((done) => setTimeout(done, 0));
    const s = world.stats();
    const now = `${s.loaded}/${s.meshed}/${s.generating}/${s.meshing}/${s.queued}/${s.urgent}`;
    stable = now === last && s.generating === 0 && s.meshing === 0 && s.queued === 0 ? stable + 1 : 0;
    last = now;
  }
  if (stable < 3) throw new Error('world did not settle');
}

/** A sealed pocket of air underground, made by player edits. */
function dig(world: World, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) world.setVoxel(x, y, z, AIR);
}

const maxBlockLight = (mesh: ChunkMeshData): number => {
  let max = 0;
  for (const batch of [mesh.opaque, mesh.cutout, mesh.translucent]) for (let i = 1; i < batch.light.length; i += 4) max = Math.max(max, batch.light[i]);
  return max;
};

describe('World voxel access', () => {
  it('reads and writes across chunk borders and at negative coordinates', () => {
    const world = new World(SEED, createBus());
    world.ensureLoadedAround(0, 0, 1);
    expect(world.stats().loaded).toBe(9);
    for (const [x, z] of [[-1, -1], [-16, 5], [15, 15], [16, -17 + 1], [31, 31], [-0.5, -0.5]]) {
      expect(world.setVoxel(x, 60, z, STONE)).toBe(true);
      expect(world.getVoxel(x, 60, z)).toBe(STONE);
      expect(world.getBlock(x, 60, z).key).toBe('stone');
    }
    // -0.5 is inside block -1.
    expect(world.getVoxel(-1, 60, -1)).toBe(STONE);
    expect(world.isLoaded(-16, 31)).toBe(true);
    expect(world.isLoaded(-17, 0)).toBe(false);
    expect(world.setVoxel(-17, 60, 0, STONE)).toBe(false);
    expect(world.getVoxel(-17, 60, 0)).toBe(AIR);
    expect(world.surfaceY(-17, 0)).toBe(-1);
    expect(voxelId(world.getVoxel(3, -1, 3))).toBe(CORESTONE);
    expect(world.getVoxel(3, 96, 3)).toBe(AIR);
    expect(world.setVoxel(3, 96, 3, STONE)).toBe(false);
    expect(world.setVoxel(3, -1, 3, STONE)).toBe(false);
    world.setVoxel(4, 90, 4, STONE);
    expect(world.surfaceY(4, 4)).toBe(90);
  });

  it('emits block:changed for every change and nothing when the voxel is already set', () => {
    const bus = createBus();
    const seen: GameEvents['block:changed'][] = [];
    bus.on('block:changed', (e) => seen.push(e));
    const world = new World(SEED, bus);
    world.ensureLoadedAround(0, 0, 0);
    const before = world.getVoxel(3, 70, -3 + 16);
    world.setVoxel(3, 70, 13, STONE, 'sim');
    world.setVoxel(3, 70, 13, STONE, 'sim');
    expect(seen).toEqual([{ x: 3, y: 70, z: 13, from: before, to: STONE, source: 'sim' }]);
  });
});

describe('World streaming', () => {
  it('loads and meshes the chunks around the player, nearest first', async () => {
    const rec = record();
    const world = new World(SEED, rec.bus);
    world.update(8, 8, 2, 1000);
    // The very first job is the player's own chunk.
    await new Promise((done) => setTimeout(done, 0));
    expect(rec.count('chunk:loaded', 0, 0)).toBe(1);
    await settle(world, 8, 8);
    const s = world.stats();
    // In view: dx^2 + dz^2 <= 6 -> 21 chunks; their neighbours make 45 chunks of data.
    expect(s.meshed).toBe(21);
    expect(s.loaded).toBe(45);
    expect(rec.count('chunk:loaded')).toBe(45);
    expect(rec.count('chunk:meshed')).toBe(21);
    expect(rec.count('chunk:meshed', 2, 1)).toBe(1);
    expect(rec.count('chunk:meshed', 2, 2)).toBe(0);
    expect(world.isReadyAround(8, 8, 2)).toBe(true);
    expect(rec.meshes.every((m) => m.opaque.indices.length > 0)).toBe(true);
  });

  it('re-meshes an edited chunk synchronously, and its neighbour too when the edit is on the border', async () => {
    const rec = record();
    const world = new World(SEED, rec.bus);
    await settle(world, 8, 8);
    rec.clear();
    const y = world.surfaceY(8, 8);
    world.setVoxel(8, y, 8, AIR);
    expect(rec.count('chunk:meshed')).toBe(0);
    world.update(8, 8, 2, 0);
    expect(rec.count('chunk:meshed', 0, 0)).toBe(1);
    expect(rec.count('chunk:meshed')).toBe(1);
    rec.clear();
    world.setVoxel(15, world.surfaceY(15, 4), 4, AIR);
    world.update(8, 8, 2, 0);
    expect(rec.count('chunk:meshed', 0, 0)).toBe(1);
    expect(rec.count('chunk:meshed', 1, 0)).toBe(1);
  });

  it('carries a lighting change into the neighbour it reaches and no further', async () => {
    const rec = record();
    const world = new World(SEED, rec.bus);
    await settle(world, 8, 8);
    // A sealed room deep underground running across the border between chunks (0,0) and (1,0).
    dig(world, 10, 12, 6, 20, 14, 10);
    await settle(world, 8, 8);
    rec.clear();
    world.setVoxel(12, 12, 8, TORCH);
    world.update(8, 8, 2, 0);
    expect(rec.count('chunk:meshed', 0, 0)).toBe(1);
    expect(rec.count('chunk:meshed', 1, 0)).toBe(0);
    await settle(world, 8, 8);
    // The torch's light crosses into (1,0), which is re-meshed; the chunks it does not reach are not.
    expect(rec.count('chunk:meshed', 1, 0)).toBe(1);
    expect(maxBlockLight(rec.meshes.filter((m) => m.cx === 1 && m.cz === 0)[0])).toBeGreaterThan(0);
    expect(rec.count('chunk:meshed', -1, 0)).toBe(0);
    expect(rec.count('chunk:meshed', 0, 1)).toBe(0);
    expect(rec.count('chunk:meshed')).toBe(2);
  });

  it('leaves no drawn mesh out of date after many edits, lighting changes included', async () => {
    const rec = record();
    const world = new World(SEED, rec.bus);
    const shown = new Map<string, ChunkMeshData>();
    rec.bus.on('chunk:meshed', ({ mesh }) => shown.set(`${mesh.cx},${mesh.cz}`, mesh));
    rec.bus.on('chunk:hidden', ({ cx, cz }) => shown.delete(`${cx},${cz}`));
    await settle(world, 8, 8);
    const rng = mulberry32(99);
    const furnace = blockId('furnace_clay');
    const palette = [AIR, AIR, AIR, STONE, TORCH, makeVoxel(blockId('glass')), makeVoxel(furnace, 1, true), makeVoxel(blockId('water'))];
    const pick = (lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));
    for (let round = 0; round < 12; round++) {
      for (let i = 0; i < 8; i++) {
        // Mostly near chunk borders, where lighting and geometry cross into neighbours.
        const x = rng() < 0.6 ? pick(13, 18) : pick(-16, 31);
        const z = rng() < 0.6 ? pick(-2, 2) : pick(-16, 31);
        const y = rng() < 0.5 ? world.surfaceY(x, z) - pick(0, 2) : pick(8, 30);
        world.setVoxel(x, y, z, palette[pick(0, palette.length - 1)], rng() < 0.5 ? 'player' : 'sim');
      }
      world.update(8, 8, 2, 0);
      if (round % 3 === 2) await settle(world, 8, 8);
    }
    await settle(world, 8, 8);
    expect(shown.size).toBe(21);
    for (const mesh of shown.values()) {
      const chunks: (Uint16Array | null)[] = [];
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) chunks.push(world.chunkVoxels(mesh.cx + dx, mesh.cz + dz));
      const fresh = runJob({ type: 'mesh', cx: mesh.cx, cz: mesh.cz, chunks }).mesh;
      for (const batch of ['opaque', 'cutout', 'translucent'] as const) {
        expect(mesh[batch].light, `${batch} light of chunk ${mesh.cx},${mesh.cz}`).toEqual(fresh[batch].light);
        expect(mesh[batch].positions).toEqual(fresh[batch].positions);
      }
    }
  });

  it('hides chunks that leave the view, unloads far ones, and remembers edits forever', async () => {
    const rec = record();
    const world = new World(SEED, rec.bus);
    await settle(world, 8, 8);
    world.setVoxel(5, 70, 5, STONE);
    world.setVoxel(-20, 3, 40, AIR);
    const edited = world.getVoxel(-20, 3, 40);
    rec.clear();
    const far = 40 * CHUNK_SIZE;
    await settle(world, far, 8);
    expect(rec.count('chunk:hidden', 0, 0)).toBe(1);
    expect(rec.count('chunk:unloaded', 0, 0)).toBe(1);
    expect(world.isLoaded(5, 5)).toBe(false);
    expect(world.getVoxel(5, 70, 5)).toBe(AIR);
    expect(world.stats().loaded).toBe(45);
    await settle(world, 8, 8);
    expect(world.getVoxel(5, 70, 5)).toBe(STONE);
    expect(world.getVoxel(-20, 3, 40)).toBe(edited);
    // Besides the player's two edits: one per Old Works crate the World placed in the chunks it loaded on the way.
    // Cave camp crates are generated voxels: the World gives them loot and an entity but no edit (the voxel is already a crate).
    const generated = (x: number, y: number, z: number): number => generateChunk(SEED, chunkCoord(x), chunkCoord(z))[voxelIndex(localCoord(x), y, localCoord(z))];
    const crates = [...world.entities()].filter((e) => e.kind === 'crate' && findCaveCamp(SEED, chunkCoord(e.x), chunkCoord(e.z), generated)?.y !== e.y).length;
    expect(world.stats().edits).toBe(2 + crates);
  });

  it('keeps chunks around block entities loaded however far the player goes', async () => {
    const rec = record();
    const world = new World(SEED, rec.bus);
    await settle(world, 8, 8);
    const crate: BlockEntity = { kind: 'thermopile', x: 8, y: 40, z: 8 };
    world.setEntity(crate);
    expect(world.getEntity(8, 40, 8)).toBe(crate);
    // Crates never pin (they do nothing on their own; whatever reaches into one pins its own chunks).
    const pinned = world.stats().pinned;
    world.setEntity({ kind: 'crate', x: 200, y: 40, z: 8, slots: [] });
    expect(world.stats().pinned).toBe(pinned);
    world.removeEntity(200, 40, 8);
    // Nor do wild bushes picked on the way (they only regrow, and src/sim wakes them when their chunk loads).
    world.setEntity({ kind: 'berry_bush', x: 300, y: 40, z: 8, growS: 0 });
    expect(world.stats().pinned).toBe(pinned);
    world.removeEntity(300, 40, 8);
    rec.clear();
    await settle(world, 40 * CHUNK_SIZE, 8);
    for (let cz = -1; cz <= 1; cz++) {
      for (let cx = -1; cx <= 1; cx++) {
        expect(world.isLoaded(cx * 16, cz * 16)).toBe(true);
        expect(rec.count('chunk:hidden', cx, cz)).toBe(1);
        expect(rec.count('chunk:unloaded', cx, cz)).toBe(0);
      }
    }
    expect(world.isLoaded(2 * 16, 0)).toBe(false);
    expect(world.stats().pinned).toBe(9);
    expect(world.removeEntity(8, 40, 8)).toBe(crate);
    expect(world.removeEntity(8, 40, 8)).toBeUndefined();
    world.update(40 * CHUNK_SIZE, 8, 2, 0);
    expect(world.isLoaded(8, 8)).toBe(false);
    expect(rec.count('chunk:unloaded', 0, 0)).toBe(1);
    expect([...world.entities()].filter((e) => e.kind !== 'crate')).toEqual([]);
  });

  it('loads the chunks around a far-away entity, after the ones in view', async () => {
    const world = new World(SEED, createBus());
    world.setEntity({ kind: 'thermopile', x: 1000, y: 50, z: -1000 });
    await settle(world, 8, 8);
    expect(world.isLoaded(1000, -1000)).toBe(true);
    expect(world.isLoaded(1000 + 16, -1000 - 16)).toBe(true);
    expect(world.isLoaded(1000 + 32, -1000)).toBe(false);
    expect(world.stats().loaded).toBe(45 + 9);
    expect(world.stats().meshed).toBe(21);
  });
});

describe('World persistence', () => {
  it('round-trips seed, edits and entities through JSON', async () => {
    const world = new World(SEED, createBus());
    world.ensureLoadedAround(0, 0, 1);
    world.setVoxel(-3, 50, 7, STONE);
    world.setVoxel(20, 2, -9, AIR);
    world.setVoxel(20, 2, -9, TORCH, 'sim');
    world.setEntity({ kind: 'furnace', x: 4, y: 33, z: -2, tier: 1, tempC: 640, lit: true, draft: 0.5, ignited: false, slots: [{ item: 'coal', count: 3 }, null] });
    const json = JSON.stringify(world.toJSON());

    const rec = record();
    const copy = World.fromJSON(JSON.parse(json), rec.bus);
    expect(copy.seed).toBe(SEED);
    expect(copy.stats().edits).toBe(2);
    expect([...copy.entities()]).toEqual([...world.entities()]);
    expect(copy.getEntity(4, 33, -2)).not.toBe(world.getEntity(4, 33, -2));
    copy.ensureLoadedAround(0, 0, 1);
    for (let y = 0; y < 96; y += 7) {
      for (let z = -16; z < 32; z += 3) for (let x = -16; x < 32; x += 3) expect(copy.getVoxel(x, y, z)).toBe(world.getVoxel(x, y, z));
    }
    expect(copy.getVoxel(-3, 50, 7)).toBe(STONE);
    expect(copy.getVoxel(20, 2, -9)).toBe(TORCH);
    expect(JSON.stringify(copy.toJSON())).toBe(json);
  });

  it('replaces a running world on load and refuses malformed snapshots', async () => {
    const rec = record();
    const world = new World(SEED, rec.bus);
    await settle(world, 8, 8);
    const other = new World(99, createBus());
    other.setVoxel(0, 0, 0, STONE);
    other.setEntity({ kind: 'crate', x: 1, y: 2, z: 3 });
    const snapshot = other.toJSON();
    expect(() => world.load({ ...snapshot, entities: [{ kind: 'crate' } as unknown as BlockEntity] })).toThrow();
    expect(() => world.load({ ...snapshot, edits: { nope: 'AAAA' } })).toThrow();
    expect(world.seed).toBe(SEED);
    expect(world.stats().loaded).toBe(45);
    rec.clear();
    world.load(snapshot);
    expect(world.seed).toBe(99);
    expect(rec.count('chunk:unloaded')).toBe(45);
    expect(rec.count('chunk:hidden')).toBe(21);
    expect(world.stats().loaded).toBe(0);
    expect(world.getEntity(1, 2, 3)?.kind).toBe('crate');
    await settle(world, 8, 8);
    expect(world.stats().meshed).toBe(21);
    expect(world.biomeAt(8, 8)).toBe(other.biomeAt(8, 8));
  });
});
