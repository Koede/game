import { describe, expect, it } from 'vitest';
import { CRATE_SIZE } from '../core/constants';
import { mulberry32, seedFromString } from '../core/math';
import { BLOCKS, STRUCTURE_LOOT, blockId, creature, item, rollLoot } from '../core/registry';
import { CHUNK_SIZE, CHUNK_VOLUME, voxelIndex, voxelId } from '../core/types';
import { chunkKey } from './chunk';
import { ID } from './ids';
import { squareRuin } from './ruins';
import { STRUCTURE_DEFS } from './structureDefs';
import { drawStructure, squareStructure, structureCrateCells, structureGuardPlan, type StructureSite } from './structures';
import { DUNES, FROSTFELL, MARSH, SCAR, WOODLAND } from './terrain';
import { generateChunk } from './worldgen';
import { World } from './world';
import { createBus } from '../core/context';
import { DT } from '../core/constants';
import { MobManager } from '../mobs/manager';
import { TestClock, testPlayer } from '../mobs/testKit';
import type { MobsSnapshot } from '../mobs/types';

const keys = (...k: string[]): number[] => k.map((x) => blockId(x));
/** What each biome's structures may be made of (plus the dirt and stone the levelling lays). */
const COMMON = keys('dirt', 'stone', 'rubble', 'torch', 'magic_light');
const PALETTE: Record<number, number[]> = {
  [WOODLAND]: [...COMMON, ...keys('grass', 'oak_log', 'oak_leaves', 'plank', 'stone_brick', 'brick', 'mossy_stone_brick', 'cracked_stone_brick', 'ember_poppy', 'fern', 'skybell', 'glowcap')],
  [DUNES]: [...COMMON, ...keys('sand', 'brick', 'clay', 'limestone', 'glass', 'cactus', 'dry_shrub', 'water', 'rusted_shell', 'asphalt', 'corestone')],
  [FROSTFELL]: [...COMMON, ...keys('snow', 'ice', 'packed_ice', 'ice_spike', 'pine_log', 'plank', 'stone_brick', 'cracked_stone_brick', 'frost_lily', 'collapsed_furnace', 'rusted_shell')],
  [SCAR]: [...COMMON, ...keys('basalt', 'basalt_column', 'steam_vent', 'lava', 'corestone', 'rusted_shell', 'coal_ore')],
  [MARSH]: [...COMMON, ...keys('peat', 'clay', 'reeds', 'mossy_stone_brick', 'stone_brick', 'cracked_stone_brick', 'oak_log', 'plank', 'glowcap', 'water', 'glass', 'essentia_jar')],
};

/** A site standing at chunk (0, 0) on flat stone, so the real drawing path can be inspected cell by cell. */
function drawn(def: (typeof STRUCTURE_DEFS)[number], biome: number): { voxels: Uint16Array; site: StructureSite } {
  const voxels = new Uint16Array(CHUNK_VOLUME);
  for (let z = 0; z < CHUNK_SIZE; z++) for (let x = 0; x < CHUNK_SIZE; x++) for (let y = 1; y <= 40; y++) voxels[voxelIndex(x, y, z)] = ID.stone;
  const site: StructureSite = { def, x0: 2, z0: 2, floor: 40, biome, bits: 0x5a5a5a, crateX: 2 + def.crate[0], crateZ: 2 + def.crate[1] };
  drawStructure(voxels, 0, 0, site);
  return { voxels, site };
}

describe('the sixteen structure types', () => {
  it('has sixteen distinct types, each with a crate table, a codex line and loot no more than one age ahead', () => {
    expect(STRUCTURE_DEFS).toHaveLength(16);
    expect(new Set(STRUCTURE_DEFS.map((d) => d.key)).size).toBe(16);
    for (const d of STRUCTURE_DEFS) {
      expect(d.desc.length, d.key).toBeGreaterThan(30);
      const table = STRUCTURE_LOOT[d.key];
      expect(table, d.key).toBeDefined();
      for (const e of table.entries) expect(item(e.item).age, `${d.key}: ${e.item}`).toBeLessThanOrEqual(d.age + 1);
      // The crate holds something every time, in stacks that fit.
      for (let n = 0; n < 50; n++) {
        const loot = rollLoot(table, mulberry32(n));
        expect(loot.length, d.key).toBeGreaterThan(0);
        expect(loot.length, d.key).toBeLessThanOrEqual(CRATE_SIZE);
      }
      for (const g of d.guards) expect(creature(g.species).key).toBe(g.species);
    }
  });

  it('covers every biome with at least three types of its own', () => {
    for (const biome of [WOODLAND, DUNES, FROSTFELL, SCAR, MARSH]) {
      expect(STRUCTURE_DEFS.filter((d) => d.biomes.length === 1 && d.biomes[0] === biome).length, `biome ${biome}`).toBeGreaterThanOrEqual(3);
    }
  });

  for (const def of STRUCTURE_DEFS) {
    it(`${def.key}: built only from its biome's blocks, crate cell free on solid ground, guards can stand`, () => {
      for (const biome of def.biomes) {
        const { voxels, site } = drawn(def, biome);
        const allowed = new Set([...PALETTE[biome], ...(def.biomes.length > 1 ? keys('stone_brick', 'mossy_stone_brick', 'grass', 'sand', 'snow', 'peat') : [])]);
        const used = new Set<number>();
        let placed = 0;
        for (let z = 0; z < CHUNK_SIZE; z++) {
          for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let y = 41; y < 41 + 14; y++) {
              const v = voxelId(voxels[voxelIndex(x, y, z)]);
              if (v === 0) continue;
              placed++;
              used.add(v);
            }
          }
        }
        expect(placed, def.key).toBeGreaterThan(10);
        for (const v of used) expect(allowed.has(v), `${def.key} in biome ${biome} uses ${BLOCKS[v].key}`).toBe(true);
        // The crate cell is empty with something solid under it, and headroom above.
        const cx = site.crateX;
        const cz = site.crateZ;
        expect(voxelId(voxels[voxelIndex(cx, 41, cz)]), def.key).toBe(0);
        expect(voxelId(voxels[voxelIndex(cx, 40, cz)]), def.key).not.toBe(0);
        expect(voxelId(voxels[voxelIndex(cx, 42, cz)]), `${def.key} crate has headroom`).toBe(0);
        // Every guard has a cell to stand in, with a solid floor and two open blocks, within its structure.
        const plan = structureGuardPlan(site);
        for (const s of plan.slots) {
          let stands = false;
          for (let y = 41 + s.up; y <= 41 + s.up + 6 && !stands; y++) {
            stands = voxelId(voxels[voxelIndex(s.x, y - 1, s.z)]) !== 0 && voxelId(voxels[voxelIndex(s.x, y, s.z)]) === 0 && voxelId(voxels[voxelIndex(s.x, y + 1, s.z)]) === 0;
          }
          expect(stands, `${def.key} guard ${s.species} at ${s.x},${s.z}`).toBe(true);
        }
      }
    });
  }
});

describe('structures in the world', () => {
  const SEEDS = ['hearth', 'ember', 'bronze', 'alpha', 'forge', 'lantern'].map(seedFromString);

  it('are deterministic, never share a square with a ruin overlap, and every type turns up across a few worlds', () => {
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      for (let sz = -8; sz <= 8; sz++) {
        for (let sx = -8; sx <= 8; sx++) {
          const s = squareStructure(seed, sx, sz);
          expect(squareStructure(seed, sx, sz)).toBe(s);
          if (!s) continue;
          seen.add(s.def.key);
          expect(s.def.biomes).toContain(s.biome);
          const r = squareRuin(seed, Math.floor(s.x0 / 112), Math.floor(s.z0 / 112));
          if (r) {
            const apart = r.x0 - 4 >= s.x0 + s.def.w || r.x0 + r.w + 4 <= s.x0 || r.z0 - 4 >= s.z0 + s.def.d || r.z0 + r.d + 4 <= s.z0;
            expect(apart, `${s.def.key} overlaps a ruin`).toBe(true);
          }
        }
      }
    }
    const missing = STRUCTURE_DEFS.map((d) => d.key).filter((k) => !seen.has(k));
    expect(missing).toEqual([]);
  });

  it('are drawn into generated chunks, with the crate cell left empty', () => {
    for (const seed of SEEDS) {
      let found: StructureSite | null = null;
      for (let sz = -6; sz <= 6 && !found; sz++) for (let sx = -6; sx <= 6 && !found; sx++) found = squareStructure(seed, sx, sz);
      expect(found).not.toBeNull();
      const s = found as StructureSite;
      const cx = Math.floor(s.crateX / CHUNK_SIZE);
      const cz = Math.floor(s.crateZ / CHUNK_SIZE);
      const a = generateChunk(seed, cx, cz);
      const b = generateChunk(seed, cx, cz);
      expect(a).toEqual(b);
      const lx = s.crateX - cx * CHUNK_SIZE;
      const lz = s.crateZ - cz * CHUNK_SIZE;
      expect(voxelId(a[voxelIndex(lx, s.floor + 1, lz)])).toBe(0);
      expect(voxelId(a[voxelIndex(lx, s.floor, lz)])).not.toBe(0);
      expect(structureCrateCells(seed, cx, cz).some((c) => c.x === s.crateX && c.z === s.crateZ && c.key === s.def.key)).toBe(true);
    }
    void chunkKey;
  });
});

describe('structures with a real world and mob manager', () => {
  const find = (want: (d: (typeof STRUCTURE_DEFS)[number]) => boolean): { seed: number; site: StructureSite } => {
    for (const name of ['hearth', 'ember', 'bronze', 'alpha', 'forge', 'lantern', 'delta', 'omega']) {
      const seed = seedFromString(name);
      for (let sz = -8; sz <= 8; sz++) for (let sx = -8; sx <= 8; sx++) {
        const site = squareStructure(seed, sx, sz);
        if (site && want(site.def)) return { seed, site };
      }
    }
    throw new Error('no such structure in the sample worlds');
  };

  it('puts a rolled crate in the world when the chunk loads, once', () => {
    const { seed, site } = find((d) => d.guards.length === 0);
    const bus = createBus();
    const world = new World(seed, bus);
    world.ensureLoadedAround(site.crateX, site.crateZ, 2);
    const y = site.floor + 1;
    expect(world.getVoxel(site.crateX, y, site.crateZ)).not.toBe(0);
    const crate = world.getEntity(site.crateX, y, site.crateZ);
    expect(crate?.kind).toBe('crate');
    expect(((crate as { slots?: unknown[] } | undefined)?.slots ?? []).some((s) => s !== null)).toBe(true);
  });

  it('creates its guardians once, from its own biome, saved and never respawned', () => {
    const { seed, site } = find((d) => d.key === 'glassblower_kiln' || d.key === 'frost_cairn' || d.key === 'ember_altar');
    const bus = createBus();
    const world = new World(seed, bus);
    world.ensureLoadedAround(site.x0, site.z0, 3);
    const clock = new TestClock(0.5, 1);
    const mobs = new MobManager(world, bus, clock, seed, { naturalSpawning: false, spawn: null });
    const player = testPlayer(site.x0 + 0.5, site.floor + 1, site.z0 - 30);
    mobs.tick(DT, player);
    const guards = mobs.hostiles.all.filter((m) => m.hostile!.ruin.startsWith('s:'));
    expect(guards.length).toBe(site.def.guards.length);
    for (const g of guards) {
      expect(site.def.guards.map((x) => x.species)).toContain(g.spec.key);
      expect(g.x).toBeGreaterThan(site.x0);
      expect(g.x).toBeLessThan(site.x0 + site.def.w);
      expect(g.hostile!.ruin).toBe(`s:${site.x0},${site.z0}`);
    }
    const saved = JSON.parse(JSON.stringify(mobs.toJSON())) as MobsSnapshot;
    const again = new MobManager(world, bus, clock, seed, { naturalSpawning: false, spawn: null });
    again.load(saved);
    again.tick(DT, player);
    again.tick(DT, player);
    expect(again.hostiles.all.filter((m) => m.hostile!.ruin.startsWith('s:')).length).toBe(guards.length);
  });
});
