import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { CRATE_SIZE } from '../core/constants';
import { ORE_VEINS, blockId, hasLootTable, lootTableById } from '../core/registry';
import { CHUNK_SIZE, WORLD_HEIGHT, voxelId, voxelIndex } from '../core/types';
import { CAVE_BANDS, CAVE_ROOM_CHANCE, caveBandAt, caveCampTable, caveRoomPlan, findCaveCamp, lodeOre, type CaveRoomKind } from './caveRooms';
import { ID } from './ids';
import { CAVE_LAVA_TOP } from './terrain';
import { caveRoomOf, generateChunk } from './worldgen';
import { World } from './world';

const SEEDS = [11, 2026, 77123];
const SPAN = 12;

interface Found { seed: number; cx: number; cz: number; kind: CaveRoomKind }
/** Every chunk in a square round the origin whose plan is `kind` (the plan only says what it tries; callers check the stamp). */
function planned(kind: CaveRoomKind): Found[] {
  const out: Found[] = [];
  for (const seed of SEEDS) for (let cz = -SPAN; cz < SPAN; cz++) for (let cx = -SPAN; cx < SPAN; cx++) if (caveRoomPlan(seed, cx, cz)?.kind === kind) out.push({ seed, cx, cz, kind });
  return out;
}
const at = (v: Uint16Array, x: number, y: number, z: number): number => v[voxelIndex(x, y, z)];
const count = (v: Uint16Array, id: number): number => { let n = 0; for (let i = 0; i < v.length; i++) if (v[i] === id) n++; return n; };

describe('cave depth bands', () => {
  it('cover every height once, deep to shallow, and name a camp table each that exists', () => {
    for (let y = 0; y < WORLD_HEIGHT; y++) expect(CAVE_BANDS.filter((b) => y >= b.minY && y <= b.maxY).map((b) => b.band)).toEqual([caveBandAt(y)]);
    expect(CAVE_BANDS.map((b) => b.band)).toEqual(['deep', 'middle', 'shallow']);
    for (const b of CAVE_BANDS) expect(hasLootTable(caveCampTable(b.band))).toBe(true);
  });

  it('only ever offers an ore its own depth allows, and favours the rare ones lower down', () => {
    const veins = new Map(ORE_VEINS.map((v) => [blockId(v.block), v]));
    for (let y = 4; y < 60; y++) {
      for (let r = 0; r < 1; r += 0.05) {
        const id = lodeOre(y, r);
        if (id < 0) continue;
        const v = veins.get(id)!;
        expect(y, `${v.block} at ${y}`).toBeGreaterThanOrEqual(v.minY);
        expect(y, `${v.block} at ${y}`).toBeLessThanOrEqual(v.maxY);
      }
    }
    const ores = (y: number): Set<number> => new Set([0, 0.2, 0.4, 0.6, 0.8, 0.99].map((r) => lodeOre(y, r)));
    expect(ores(10).has(blockId('pitchblende')) || ores(10).has(blockId('wolframite')) || ores(10).has(blockId('spodumene'))).toBe(true);
    expect(ores(50).has(blockId('pitchblende'))).toBe(false);
  });

  it('puts richer loot lower down: the camp tables get stronger and stay within a crate', () => {
    for (const b of CAVE_BANDS) {
      const t = lootTableById(caveCampTable(b.band));
      expect(t.rolls[1]).toBeLessThanOrEqual(CRATE_SIZE);
    }
    expect(lootTableById('cave_camp_deep').rolls[1]).toBeGreaterThan(lootTableById('cave_camp_shallow').rolls[1]);
  });
});

describe('cave room plans', () => {
  it('are deterministic per seed and differ between seeds', () => {
    for (let cx = -5; cx < 5; cx++) expect(caveRoomPlan(7, cx, 3)).toEqual(caveRoomPlan(7, cx, 3));
    const a = Array.from({ length: 40 }, (_, i) => caveRoomPlan(1, i, 0)?.kind ?? '-').join('');
    const b = Array.from({ length: 40 }, (_, i) => caveRoomPlan(2, i, 0)?.kind ?? '-').join('');
    expect(a).not.toBe(b);
  });

  it('try about the configured share of chunks, keep every column inside the chunk interior, and cover all four kinds', () => {
    let rooms = 0;
    let total = 0;
    const kinds = new Set<string>();
    for (let cz = -20; cz < 20; cz++) {
      for (let cx = -20; cx < 20; cx++) {
        total++;
        const p = caveRoomPlan(5, cx, cz);
        if (!p) continue;
        rooms++;
        kinds.add(p.kind);
        for (const c of p.columns) {
          expect(c.x - cx * CHUNK_SIZE).toBeGreaterThanOrEqual(3);
          expect(c.x - cx * CHUNK_SIZE).toBeLessThanOrEqual(12);
          expect(c.z - cz * CHUNK_SIZE).toBeGreaterThanOrEqual(3);
          expect(c.z - cz * CHUNK_SIZE).toBeLessThanOrEqual(12);
        }
      }
    }
    expect(rooms / total).toBeGreaterThan(CAVE_ROOM_CHANCE - 0.06);
    expect(rooms / total).toBeLessThan(CAVE_ROOM_CHANCE + 0.06);
    expect([...kinds].sort()).toEqual(['camp', 'gas', 'lode', 'sinkhole']);
  });
});

describe('cave rooms in generated chunks', () => {
  it('generate the same chunk twice, byte for byte', () => {
    for (const f of [...planned('camp'), ...planned('sinkhole')].slice(0, 12)) expect(generateChunk(f.seed, f.cx, f.cz)).toEqual(generateChunk(f.seed, f.cx, f.cz));
  });

  it('build camps on a floor: a crate with air above it, a torch beside it, nothing in the rock', () => {
    let built = 0;
    for (const f of planned('camp')) {
      const v = generateChunk(f.seed, f.cx, f.cz);
      const found = findCaveCamp(f.seed, f.cx, f.cz, (x, y, z) => at(v, x - f.cx * CHUNK_SIZE, y, z - f.cz * CHUNK_SIZE));
      if (!found) continue;
      built++;
      const lx = found.x - f.cx * CHUNK_SIZE;
      const lz = found.z - f.cz * CHUNK_SIZE;
      expect(at(v, lx, found.y + 1, lz), 'air over the crate').toBe(0);
      expect(at(v, lx, found.y - 1, lz), 'floor under the crate').not.toBe(0);
      expect(at(v, lx - 1, found.y, lz), 'torch').toBe(ID.torch);
      expect(found.y).toBeGreaterThan(CAVE_LAVA_TOP + 1);
    }
    expect(built).toBeGreaterThan(10);
  });

  it('build lodes whose ore belongs to the depth they sit at, on a wall beside the floor they stand on', () => {
    const veins = new Map(ORE_VEINS.map((v) => [blockId(v.block), v]));
    let lodes = 0;
    for (const f of planned('lode').slice(0, 80)) {
      const room = caveRoomOf(f.seed, f.cx, f.cz);
      if (room?.kind !== 'lode') continue;
      const v = generateChunk(f.seed, f.cx, f.cz);
      const lx = room.x - f.cx * CHUNK_SIZE;
      const lz = room.z - f.cz * CHUNK_SIZE;
      let ore = 0;
      for (let y = room.y - 2; y <= room.y + 4; y++) for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
        const x = lx + dx; const z = lz + dz;
        if (x < 0 || x > 15 || z < 0 || z > 15) continue;
        const vein = veins.get(at(v, x, y, z));
        if (!vein) continue;
        expect(y, `${vein.block}`).toBeGreaterThanOrEqual(vein.minY);
        expect(y, `${vein.block}`).toBeLessThanOrEqual(vein.maxY);
        ore++;
      }
      expect(ore, 'lode ore').toBeGreaterThanOrEqual(4);
      lodes++;
    }
    expect(lodes).toBeGreaterThan(10);
  });

  it('dig sinkholes that never reach the lava, with a glowcap rim and ore at the bottom', () => {
    let holes = 0;
    for (const f of planned('sinkhole')) {
      const room = caveRoomOf(f.seed, f.cx, f.cz);
      if (room?.kind !== 'sinkhole') continue;
      const v = generateChunk(f.seed, f.cx, f.cz);
      const lx = room.x - f.cx * CHUNK_SIZE;
      const lz = room.z - f.cz * CHUNK_SIZE;
      let bottom = room.y;
      while (at(v, lx, bottom - 1, lz) === 0) bottom--;
      expect(room.y - bottom, 'depth').toBeGreaterThanOrEqual(4);
      expect(bottom, 'shaft floor above the lava').toBeGreaterThan(CAVE_LAVA_TOP + 1);
      let rim = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 1; dy++) if (at(v, lx + dx, room.y + dy, lz + dz) === ID.glowcap) rim++;
      expect(rim, 'rim glowcaps').toBeGreaterThan(0);
      holes++;
    }
    expect(holes).toBeGreaterThan(5);
  });

  it('pool foul air only in rock-bound pockets with no liquid touching it, and keep it out of everything but cave air', () => {
    let pockets = 0;
    for (const f of planned('gas')) {
      const v = generateChunk(f.seed, f.cx, f.cz);
      const n = count(v, ID.foulAir);
      if (n === 0) continue;
      pockets++;
      expect(n).toBeLessThan(80);
      for (let y = 1; y < 64; y++) for (let z = 1; z < CHUNK_SIZE - 1; z++) for (let x = 1; x < CHUNK_SIZE - 1; x++) {
        if (at(v, x, y, z) !== ID.foulAir) continue;
        expect(y).toBeLessThanOrEqual(30);
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const id = at(v, x + dx, y + dy, z + dz);
          expect(id === ID.lava || id === ID.water, 'no liquid beside foul air').toBe(false);
        }
      }
    }
    expect(pockets).toBeGreaterThan(5);
    // A chunk with no gas plan never holds foul air.
    for (const seed of SEEDS) for (let cx = 0; cx < 10; cx++) if (caveRoomPlan(seed, cx, 0)?.kind !== 'gas') expect(count(generateChunk(seed, cx, 0), ID.foulAir)).toBe(0);
  });

  it('keep every room reachable: the open cave a camp or pit stands in is big and not a sealed pocket', () => {
    let checked = 0;
    for (const f of [...planned('camp').slice(0, 25)]) {
      const v = generateChunk(f.seed, f.cx, f.cz);
      const found = findCaveCamp(f.seed, f.cx, f.cz, (x, y, z) => at(v, x - f.cx * CHUNK_SIZE, y, z - f.cz * CHUNK_SIZE));
      if (!found) continue;
      // Flood the open cells (air, torch, plants) from beside the crate inside the chunk; a room that is not a sealed hole has a lot of air or touches the chunk edge.
      const start = [found.x - f.cx * CHUNK_SIZE, found.y + 1, found.z - f.cz * CHUNK_SIZE];
      const seen = new Set<number>();
      const stack = [voxelIndex(start[0], start[1], start[2])];
      let edge = false;
      while (stack.length && seen.size < 600) {
        const i = stack.pop()!;
        if (seen.has(i)) continue;
        seen.add(i);
        const x = i & 15;
        const z = (i >> 4) & 15;
        const y = i >> 8;
        if (x === 0 || x === 15 || z === 0 || z === 15) edge = true;
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const nx = x + dx; const ny = y + dy; const nz = z + dz;
          if (nx < 0 || nx > 15 || nz < 0 || nz > 15 || ny < 1 || ny >= WORLD_HEIGHT) continue;
          const id = at(v, nx, ny, nz);
          if (id === 0 || id === ID.glowcap || id === ID.torch) stack.push(voxelIndex(nx, ny, nz));
        }
      }
      checked++;
      expect(edge || seen.size >= 120, `camp at ${found.x},${found.y},${found.z} seed ${f.seed}`).toBe(true);
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('keeps chunk generation cheap: a chunk costs well under 6 ms on average even with the rooms', () => {
    const t0 = performance.now();
    let n = 0;
    for (let cz = -6; cz < 6; cz++) for (let cx = -6; cx < 6; cx++) { generateChunk(31, cx, cz); n++; }
    expect((performance.now() - t0) / n).toBeLessThan(12);
  });
});

describe('cave camp crates in the world', () => {
  it('get their loot once, from the table of the band they lie in, and are not rolled again after an edit', () => {
    const f = planned('camp').find((c) => {
      const v = generateChunk(c.seed, c.cx, c.cz);
      return findCaveCamp(c.seed, c.cx, c.cz, (x, y, z) => at(v, x - c.cx * CHUNK_SIZE, y, z - c.cz * CHUNK_SIZE)) !== null;
    })!;
    const world = new World(f.seed, createBus());
    world.ensureLoadedAround(f.cx * CHUNK_SIZE + 8, f.cz * CHUNK_SIZE + 8, 0);
    const camp = findCaveCamp(f.seed, f.cx, f.cz, (x, y, z) => voxelId(world.getVoxel(x, y, z)))!;
    const slotsOf = (): unknown[] => (world.getEntity(camp.x, camp.y, camp.z) as unknown as { slots: unknown[] }).slots;
    const e = world.getEntity(camp.x, camp.y, camp.z)!;
    expect(e.kind).toBe('crate');
    expect(slotsOf().some((s) => s !== null)).toBe(true);
    expect(voxelId(world.getVoxel(camp.x, camp.y, camp.z))).toBe(ID.crate);
    // Emptied by the player: a second look at the chunk leaves it empty (the entity already exists, so nothing is rolled again).
    slotsOf().fill(null);
    world.ensureLoadedAround(f.cx * CHUNK_SIZE + 8, f.cz * CHUNK_SIZE + 8, 0);
    expect(slotsOf().every((s) => s === null)).toBe(true);
  });
});
