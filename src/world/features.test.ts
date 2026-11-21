import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { CRATE_SIZE, RUIN_DEEP_DISTANCE } from '../core/constants';
import { seedFromString } from '../core/math';
import { BLOCKS, blockId, itemOrNull } from '../core/registry';
import { AIR, CHUNK_SIZE, WORLD_HEIGHT, voxelFacing, voxelId, voxelIndex, type BiomeKey, type ItemStack } from '../core/types';
import { GameClock } from '../game/clock';
import { PlayerState } from '../game/playerState';
import { Simulation } from '../sim/simulation';
import { chunkKey } from './chunk';
import { OAK_BROAD, newTreeSite, treeInCell } from './flora';
import { ruinCrateEntity, ruinLootTier } from './ruinCrates';
import { spawnRuin, squareRuin, type RuinSite } from './ruins';
import { Column, LIQUID_OIL, sampleColumn, terrainFor } from './terrain';
import { World } from './world';
import { biomeAt, findSpawn, generateChunk } from './worldgen';

const SEED = seedFromString('hearth');
const id = (key: string): number => blockId(key);

/** Generated chunks with world-coordinate access (AIR outside what was generated). */
class Area {
  readonly chunks = new Map<number, Uint16Array>();
  constructor(readonly seed: number, readonly cx0: number, readonly cz0: number, readonly cx1: number, readonly cz1: number) {
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) this.chunks.set(chunkKey(cx, cz), generateChunk(seed, cx, cz));
  }
  static around(seed: number, x: number, z: number, r: number): Area {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    return new Area(seed, cx - r, cz - r, cx + r, cz + r);
  }
  raw(x: number, y: number, z: number): number {
    const c = this.chunks.get(chunkKey(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)));
    if (!c || y < 0 || y >= WORLD_HEIGHT) return AIR;
    return c[voxelIndex(x & 15, y, z & 15)];
  }
  get(x: number, y: number, z: number): number {
    return voxelId(this.raw(x, y, z));
  }
  inside(x: number, z: number): boolean {
    return x >= this.cx0 * 16 && x < (this.cx1 + 1) * 16 && z >= this.cz0 * 16 && z < (this.cz1 + 1) * 16;
  }
  count(keys: string[]): Record<string, number> {
    const want = new Map(keys.map((k) => [id(k), k]));
    const out: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const voxels of this.chunks.values()) {
      for (let i = 0; i < voxels.length; i++) {
        const key = want.get(voxelId(voxels[i]));
        if (key) out[key]++;
      }
    }
    return out;
  }
  /** Calls fn for every voxel of these ids (world coordinates). */
  each(ids: Set<number>, fn: (x: number, y: number, z: number) => void): void {
    for (let cz = this.cz0; cz <= this.cz1; cz++) {
      for (let cx = this.cx0; cx <= this.cx1; cx++) {
        const voxels = this.chunks.get(chunkKey(cx, cz)) as Uint16Array;
        for (let i = 0; i < voxels.length; i++) {
          if (!ids.has(voxelId(voxels[i]))) continue;
          fn(cx * 16 + (i & 15), Math.floor(i / 256), cz * 16 + ((i >> 4) & 15));
        }
      }
    }
  }
}

/** The nearest dry column of a biome to the origin, searched on a coarse spiral-free grid (deterministic). */
function findBiome(seed: number, biome: BiomeKey, test: (c: Column) => boolean = () => true): { x: number; z: number } {
  const t = terrainFor(seed);
  const c = new Column();
  let best: { x: number; z: number } | null = null;
  for (let r = 0; r <= 2400 && !best; r += 32) {
    for (let a = 0; a < 64 && !best; a++) {
      const x = Math.round(Math.cos((a / 64) * Math.PI * 2) * r);
      const z = Math.round(Math.sin((a / 64) * Math.PI * 2) * r);
      if (biomeAt(seed, x, z) === biome && test(sampleColumn(t, x, z, c))) best = { x, z };
    }
  }
  if (!best) throw new Error(`no ${biome} found`);
  return best;
}

const marsh = findBiome(SEED, 'marsh', (c) => c.wMarsh > 0.95);
const dunes = findBiome(SEED, 'dunes', (c) => c.wDunes > 0.95);
const frost = findBiome(SEED, 'frostfell', (c) => c.wFrost > 0.95 && c.height < 66);
const scar = findBiome(SEED, 'scar', (c) => c.wScar > 0.95);
const oilAt = findBiome(SEED, 'dunes', (c) => c.liquid === LIQUID_OIL);
const areas = {
  woodland: Area.around(SEED, findSpawn(SEED).x, findSpawn(SEED).z, 3),
  marsh: Area.around(SEED, marsh.x, marsh.z, 3),
  dunes: Area.around(SEED, dunes.x, dunes.z, 3),
  frostfell: Area.around(SEED, frost.x, frost.z, 3),
  scar: Area.around(SEED, scar.x, scar.z, 3),
  oil: Area.around(SEED, oilAt.x, oilAt.z, 1),
};

describe('surface life and biomes', () => {
  it('woodland has flowers, ferns, berry bushes, wild crops, glowcaps and three sizes of oak', () => {
    const n = areas.woodland.count(['ember_poppy', 'skybell', 'fern', 'berry_bush', 'wild_wheat', 'wild_potato', 'wild_carrot', 'glowcap', 'tall_grass', 'oak_log']);
    for (const [key, value] of Object.entries(n)) expect(value, key).toBeGreaterThan(0);
    const t = terrainFor(SEED);
    const site = newTreeSite();
    const kinds = new Set<number>();
    for (let gz = -40; gz < 40; gz++) for (let gx = -40; gx < 40; gx++) if (treeInCell(t, gx, gz, site)) kinds.add(site.kind);
    for (const kind of [0, 1, 2, 3, 4]) expect(kinds.has(kind), `tree kind ${kind}`).toBe(true);
  });

  it('the marsh is flat wetland at sea level with shallow pools, reeds, peat, clay and willows', () => {
    const a = areas.marsh;
    const n = a.count(['peat', 'clay', 'reeds', 'water', 'oak_leaves', 'skybell']);
    for (const [key, value] of Object.entries(n)) expect(value, key).toBeGreaterThan(0);
    const t = terrainFor(SEED);
    const c = new Column();
    let marshy = 0;
    let flat = 0;
    let deep = 0;
    let wet = 0;
    for (let z = marsh.z - 24; z <= marsh.z + 24; z++) {
      for (let x = marsh.x - 24; x <= marsh.x + 24; x++) {
        sampleColumn(t, x, z, c);
        if (c.wMarsh < 0.99) continue;
        marshy++;
        if (c.height >= 28 && c.height <= 33) flat++;
        if (c.liquid !== 0) {
          wet++;
          if (31 - c.height > 3) deep++;
        }
      }
    }
    expect(marshy).toBeGreaterThan(200);
    expect(flat / marshy).toBeGreaterThan(0.97);
    expect(wet / marshy).toBeGreaterThan(0.1);
    expect(deep / wet).toBeLessThan(0.05);
  });

  it('dunes grow cacti and seep oil; frostfell has ice spires and frost lilies; the scar has organ pipes, vents and snags', () => {
    expect(areas.dunes.count(['cactus']).cactus).toBeGreaterThan(5);
    expect(areas.oil.count(['oil']).oil).toBeGreaterThan(10);
    const f = areas.frostfell.count(['packed_ice', 'ice_spike', 'frost_lily', 'pine_log']);
    for (const [key, value] of Object.entries(f)) expect(value, key).toBeGreaterThan(0);
    const s = areas.scar.count(['basalt_column', 'steam_vent', 'pine_log']);
    for (const [key, value] of Object.entries(s)) expect(value, key).toBeGreaterThan(0);
    // Every spire is crowned by a spike.
    areas.frostfell.each(new Set([id('ice_spike')]), (x, y, z) => expect(areas.frostfell.get(x, y - 1, z)).toBe(id('packed_ice')));
  });

  it('never lets oil or water touch air at their sides or below (pools, oases, underground lakes)', () => {
    const fluids = new Set([id('oil'), id('water')]);
    let checked = 0;
    for (const a of Object.values(areas)) {
      a.each(fluids, (x, y, z) => {
        if (!a.inside(x + 1, z) || !a.inside(x - 1, z) || !a.inside(x, z + 1) || !a.inside(x, z - 1)) return;
        checked++;
        const open = a.get(x, y - 1, z) === AIR || a.get(x + 1, y, z) === AIR || a.get(x - 1, y, z) === AIR || a.get(x, y, z + 1) === AIR || a.get(x, y, z - 1) === AIR;
        if (open) throw new Error(`${BLOCKS[a.get(x, y, z)].key} at ${x},${y},${z} touches air`);
      });
    }
    expect(checked).toBeGreaterThan(1000);
  });
});

describe('the underground', () => {
  const deep = new Area(SEED, -10, -10, 9, 9);

  it('has crystal geodes, underground lakes, lava falls and glowcaps on cave floors', () => {
    const crystals = deep.count(['crystal_cluster']).crystal_cluster;
    expect(crystals).toBeGreaterThan(10);
    let lake = 0;
    let fall = 0;
    let caveCaps = 0;
    deep.each(new Set([id('water'), id('lava'), id('glowcap')]), (x, y, z) => {
      const v = deep.get(x, y, z);
      if (v === id('water') && y < 26) lake++;
      if (v === id('lava') && y > 10 && deep.get(x, y + 1, z) === id('lava') && deep.get(x, y - 1, z) === id('lava')) fall++;
      if (v === id('glowcap') && y < 26) caveCaps++;
    });
    expect(lake).toBeGreaterThan(5);
    expect(fall).toBeGreaterThan(5);
    expect(caveCaps).toBeGreaterThan(10);
    // Crystals grow inside a quartz shell.
    let shelled = 0;
    deep.each(new Set([id('crystal_cluster')]), (x, y, z) => {
      for (let d = 1; d <= 4; d++) if ([deep.get(x + d, y, z), deep.get(x - d, y, z), deep.get(x, y + d, z), deep.get(x, y - d, z)].includes(id('quartz_ore'))) return void shelled++;
    });
    expect(shelled / crystals).toBeGreaterThan(0.8);
  });

  it('shows ore in cliff faces', () => {
    const ores = new Set(['coal_ore', 'copper_ore', 'tin_ore', 'iron_ore', 'limestone', 'bauxite'].map(id));
    let exposed = 0;
    for (const a of [areas.frostfell, areas.scar, areas.woodland]) {
      a.each(ores, (x, y, z) => {
        if (y > 34 && [a.get(x + 1, y, z), a.get(x - 1, y, z), a.get(x, y, z + 1), a.get(x, y, z - 1)].includes(AIR)) exposed++;
      });
    }
    expect(exposed).toBeGreaterThan(10);
  });
});

/** A ruin of the grid whose footprint crosses a chunk border, searched deterministically. */
function borderRuin(): RuinSite {
  for (let sz = -4; sz <= 4; sz++) {
    for (let sx = -4; sx <= 4; sx++) {
      const r = squareRuin(SEED, sx, sz);
      if (r && (Math.floor(r.x0 / 16) !== Math.floor((r.x0 + r.w - 1) / 16) || Math.floor(r.z0 / 16) !== Math.floor((r.z0 + r.d - 1) / 16))) return r;
    }
  }
  throw new Error('no ruin across a chunk border');
}

describe('the Old Works and big trees are independent of generation order', () => {
  it('generates the same chunks in any order, whatever was generated before', () => {
    const r = borderRuin();
    const keys: Array<[number, number]> = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) keys.push([Math.floor(r.x0 / 16) + dx, Math.floor(r.z0 / 16) + dz]);
    const forward = keys.map(([cx, cz]) => generateChunk(SEED, cx, cz));
    // Churn every cache (other seeds, far squares) and go backwards.
    for (let i = 0; i < 12; i++) generateChunk(SEED + 1 + i, i * 9, -i * 7);
    for (let i = 0; i < 40; i++) generateChunk(SEED, 300 + i * 8, -200);
    const backward = [...keys].reverse().map(([cx, cz]) => generateChunk(SEED, cx, cz)).reverse();
    backward.forEach((voxels, i) => expect(voxels, `chunk ${keys[i]}`).toEqual(forward[i]));
  });

  it('draws a ruin across a chunk border as one building', () => {
    const r = borderRuin();
    const a = new Area(SEED, Math.floor(r.x0 / 16) - 1, Math.floor(r.z0 / 16) - 1, Math.floor((r.x0 + r.w) / 16) + 1, Math.floor((r.z0 + r.d) / 16) + 1);
    const floors = new Set(['stone_brick', 'cracked_stone_brick', 'mossy_stone_brick', 'gravel', 'sand', 'basalt', 'snow', 'grass'].map(id));
    const walls = new Set(['stone_brick', 'cracked_stone_brick', 'mossy_stone_brick', 'brick'].map(id));
    let wallBlocks = 0;
    for (let z = r.z0; z < r.z0 + r.d; z++) {
      for (let x = r.x0; x < r.x0 + r.w; x++) {
        expect(floors.has(a.get(x, r.floor, z)), `floor at ${x},${z}`).toBe(true);
        expect(BLOCKS[a.get(x, r.floor - 1, z)].solid, `ground under ${x},${z}`).toBe(true);
        if (walls.has(a.get(x, r.floor + 1, z))) wallBlocks++;
      }
    }
    expect(wallBlocks).toBeGreaterThan(r.w + r.d);
    expect(a.get(r.crateX, r.floor + 1, r.crateZ)).toBe(AIR);
    let furnaces = 0;
    a.each(new Set([id('collapsed_furnace')]), (x, y, z) => {
      if (y !== r.floor + 1 || x < r.x0 || x >= r.x0 + r.w || z < r.z0 || z >= r.z0 + r.d) return;
      furnaces++;
      expect(voxelFacing(a.raw(x, y, z))).toBe(r.door);
    });
    expect(furnaces).toBe(1);
  });

  it('draws broad oaks whose 2x2 trunk straddles a chunk border on both sides', () => {
    const t = terrainFor(SEED);
    const site = newTreeSite();
    let checked = 0;
    for (let gz = -60; gz < 60 && checked < 3; gz++) {
      for (let gx = -60; gx < 60 && checked < 3; gx++) {
        if (!treeInCell(t, gx, gz, site) || site.kind !== OAK_BROAD || ((site.x & 15) !== 15 && (site.z & 15) !== 15)) continue;
        const a = Area.around(SEED, site.x, site.z, 1);
        for (let k = 0; k < 4; k++) {
          for (let y = site.base + 1; y <= site.base + site.trunk; y++) expect(a.get(site.x + (k & 1), y, site.z + (k >> 1))).toBe(id('oak_log'));
        }
        const top = site.base + site.trunk + 1;
        expect(a.get(site.x - 2, top, site.z)).toBe(id('oak_leaves'));
        expect(a.get(site.x + 3, top, site.z + 1)).toBe(id('oak_leaves'));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('ruin crates', () => {
  const valid = (slots: unknown[]): void => {
    expect(slots).toHaveLength(CRATE_SIZE);
    const items = slots.filter((s): s is ItemStack => s !== null);
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const s of items) {
      const def = itemOrNull(s.item);
      expect(def, s.item).not.toBeNull();
      expect(s.count).toBeGreaterThanOrEqual(1);
      expect(s.count).toBeLessThanOrEqual(def?.stack ?? 0);
      if (def?.tool) expect(s.durability).toBe(def.tool.durability);
    }
  };

  it('rolls valid, deterministic loot: near tables close to spawn, deep ones far away', () => {
    const spawn = { x: 0, z: 0 };
    const near = ruinCrateEntity(SEED, 40, 40, 12, spawn);
    expect(near).toEqual(ruinCrateEntity(SEED, 40, 40, 12, spawn));
    valid(near.slots as unknown[]);
    expect(ruinLootTier(40, 40, 12, spawn)).toBe('near');
    expect(ruinLootTier(RUIN_DEEP_DISTANCE + 5, 40, 0, spawn)).toBe('deep');
    expect(ruinLootTier(10, 20, 0, spawn)).toBe('deep');
    for (let i = 0; i < 40; i++) valid(ruinCrateEntity(SEED, i * 97, 40, i * 31, spawn).slots as unknown[]);
  });

  it('are placed by the World as real crates the simulation can open, once', () => {
    const bus = createBus();
    const world = new World(SEED, bus);
    const player = new PlayerState(bus, { x: 0.5, y: 60, z: 0.5 });
    const sim = new Simulation(world, bus, player, new GameClock(bus));
    const r = spawnRuin(SEED) as RuinSite;
    const y = r.floor + 1;
    world.ensureLoadedAround(r.crateX, r.crateZ, 1);
    expect(world.getBlock(r.crateX, y, r.crateZ).key).toBe('crate');
    const inventory = sim.machineSlots(r.crateX, y, r.crateZ);
    expect(inventory).not.toBeNull();
    const stored = world.getEntity(r.crateX, y, r.crateZ) as unknown as { slots: unknown[] };
    valid(stored.slots);
    expect(sim.machineView(r.crateX, y, r.crateZ)?.role).toBe('crate');

    // Saved and loaded untouched: still there, same loot, not placed twice.
    const snapshot = world.toJSON();
    world.load(snapshot);
    sim.resync();
    world.ensureLoadedAround(r.crateX, r.crateZ, 1);
    expect(world.getBlock(r.crateX, y, r.crateZ).key).toBe('crate');
    expect((world.getEntity(r.crateX, y, r.crateZ) as unknown as { slots: unknown[] }).slots).toEqual(stored.slots);

    // Broken: the loot drops as ground items (the pack is untouched) and the crate never comes back.
    const first = stored.slots.find((s) => s !== null) as ItemStack;
    world.setVoxel(r.crateX, y, r.crateZ, AIR, 'player');
    expect(world.getEntity(r.crateX, y, r.crateZ)).toBeUndefined();
    expect(player.ground.count(first.item)).toBeGreaterThanOrEqual(first.count);
    world.load(world.toJSON());
    world.ensureLoadedAround(r.crateX, r.crateZ, 1);
    expect(world.getBlock(r.crateX, y, r.crateZ).key).toBe('air');
    expect(world.getEntity(r.crateX, y, r.crateZ)).toBeUndefined();
    sim.dispose();
    world.dispose();
  });
});
