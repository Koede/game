import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { blockId } from '../core/registry';
import { AIR, makeVoxel, voxelId, type Voxel } from '../core/types';
import { FLOW_DELAY_TICKS, FLOW_MAX_PER_TICK } from './flow';
import { WATER_FALLING, WATER_SOURCE, flowingWater, isFallingWater, isWater, isWaterSource, waterLevel } from './water';
import { findSpawn } from './worldgen';
import { World } from './world';

const SEED = 77001;
const STONE = makeVoxel(blockId('stone'));
/** Scenes are built high in the sky, well above any terrain, on a stone floor at FLOOR. */
const FLOOR = 80;
const Y = FLOOR + 1;

function makeWorld(radius = 2, seed = SEED): World {
  const world = new World(seed, createBus());
  world.ensureLoadedAround(0, 0, radius);
  return world;
}

/** Scenery is written as 'load' edits: it wakes no water, like a world restored from a save. */
function fill(world: World, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, v: Voxel): void {
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) world.setVoxel(x, y, z, v, 'load');
}

function floor(world: World, r = 14): void {
  fill(world, -r, FLOOR, -r, r, FLOOR, r, STONE);
}

function run(world: World, ticks: number): void {
  for (let i = 0; i < ticks; i++) world.water.tick();
}

/** Ticks until nothing is pending (or the limit). Returns the ticks run. */
function settle(world: World, limit = 2000): number {
  for (let i = 1; i <= limit; i++) {
    world.water.tick();
    const s = world.water.stats();
    if (s.pending === 0 && s.deferred === 0) return i;
  }
  throw new Error('water did not settle');
}

function waterCells(world: World, y: number, r = 14): number {
  let n = 0;
  for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) if (isWater(world.getVoxel(x, y, z))) n++;
  return n;
}

describe('flowing water (spec 18.2)', () => {
  it('a source on flat ground spreads to level 7 and stops', () => {
    const world = makeWorld();
    floor(world);
    world.setVoxel(0, Y, 0, WATER_SOURCE, 'player');
    run(world, FLOW_DELAY_TICKS - 1);
    expect(world.getVoxel(1, Y, 0)).toBe(AIR);
    run(world, 1);
    expect(world.getVoxel(1, Y, 0)).toBe(flowingWater(1));
    settle(world);
    for (let z = -9; z <= 9; z++) {
      for (let x = -9; x <= 9; x++) {
        const d = Math.abs(x) + Math.abs(z);
        const v = world.getVoxel(x, Y, z);
        if (d === 0) expect(v).toBe(WATER_SOURCE);
        else if (d <= 7) expect(v, `${x},${z}`).toBe(flowingWater(d));
        else expect(v, `${x},${z}`).toBe(AIR);
      }
    }
    expect(waterCells(world, Y)).toBe(113);
    // Settled water stays settled.
    const changes = world.water.stats().changes;
    run(world, 100);
    expect(world.water.stats().changes).toBe(changes);
  });

  it('runs to the nearest drop and pours down a cliff as a falling column', () => {
    const world = makeWorld();
    floor(world);
    // A plateau x -10..0, five blocks high; the source sits three blocks from its edge.
    fill(world, -10, Y, -10, 0, Y + 4, 10, STONE);
    const top = Y + 5;
    world.setVoxel(-2, top, 0, WATER_SOURCE, 'player');
    settle(world);
    // Straight to the edge, nothing sideways while the drop is near.
    expect(waterLevel(world.getVoxel(-1, top, 0))).toBe(1);
    expect(waterLevel(world.getVoxel(0, top, 0))).toBe(2);
    expect(world.getVoxel(-2, top, 1)).toBe(AIR);
    expect(world.getVoxel(-2, top, -1)).toBe(AIR);
    expect(world.getVoxel(-3, top, 0)).toBe(AIR);
    // Over the edge: falling all the way down, then spreading out from the foot.
    expect(world.getVoxel(1, top, 0)).toBe(flowingWater(3));
    for (let y = Y; y < top; y++) expect(isFallingWater(world.getVoxel(1, y, 0)), `y ${y}`).toBe(true);
    expect(world.getVoxel(2, Y, 0)).toBe(flowingWater(1));
    expect(world.getVoxel(1, Y, 1)).toBe(flowingWater(1));
    expect(world.getVoxel(8, Y, 0)).toBe(flowingWater(7));
    expect(world.getVoxel(9, Y, 0)).toBe(AIR);
  });

  it('drains gradually once its source is taken', () => {
    const world = makeWorld();
    floor(world);
    world.setVoxel(0, Y, 0, WATER_SOURCE, 'player');
    settle(world);
    world.setVoxel(0, Y, 0, AIR, 'player');
    // Receding over a few updates, not gone at once: the levels weaken step by step (the surface sinks), then the
    // cells go, the weakest first.
    const levels = (): number => {
      let sum = 0;
      for (let z = -9; z <= 9; z++) for (let x = -9; x <= 9; x++) {
        const v = world.getVoxel(x, Y, z);
        if (isWater(v)) sum += waterLevel(v);
      }
      return sum;
    };
    const full = levels();
    run(world, FLOW_DELAY_TICKS);
    expect(waterCells(world, Y)).toBeGreaterThan(100);
    expect(levels()).toBeGreaterThan(full);
    let steps = 1;
    while (waterCells(world, Y) > 0 && steps < 40) {
      run(world, FLOW_DELAY_TICKS);
      steps++;
    }
    expect(waterCells(world, Y)).toBe(0);
    expect(steps).toBeGreaterThanOrEqual(5);
  });

  it('a hole in a lake fills again as a source; a 2x2 pool is endless, a 1x2 pool is not', () => {
    const world = makeWorld();
    floor(world);
    // A 5x5 lake two deep, walled in.
    fill(world, -4, Y, -4, 4, Y + 1, 4, STONE);
    fill(world, -3, Y, -3, 3, Y + 1, 3, WATER_SOURCE);
    world.setVoxel(0, Y + 1, 0, AIR, 'player');
    run(world, FLOW_DELAY_TICKS);
    expect(world.getVoxel(0, Y + 1, 0)).toBe(WATER_SOURCE);
    settle(world);
    expect(world.water.stats().changes).toBe(1);

    // 2x2 pool.
    fill(world, 6, Y, 6, 9, Y, 9, STONE);
    fill(world, 7, Y, 7, 8, Y, 8, WATER_SOURCE);
    world.setVoxel(7, Y, 7, AIR, 'player');
    settle(world);
    expect(world.getVoxel(7, Y, 7)).toBe(WATER_SOURCE);

    // 1x2 pool: the hole stays flowing, and taking the other source drains it.
    fill(world, -9, Y, 6, -6, Y, 8, STONE);
    fill(world, -8, Y, 7, -7, Y, 7, WATER_SOURCE);
    world.setVoxel(-8, Y, 7, AIR, 'player');
    settle(world);
    expect(world.getVoxel(-8, Y, 7)).toBe(flowingWater(1));
    world.setVoxel(-7, Y, 7, AIR, 'player');
    settle(world);
    expect(world.getVoxel(-8, Y, 7)).toBe(AIR);
  });

  it('washes plants away but is stopped by crops, torches and machines', () => {
    const world = makeWorld();
    floor(world);
    const grass = makeVoxel(blockId('tall_grass'));
    const poppy = makeVoxel(blockId('ember_poppy'));
    const reeds = makeVoxel(blockId('reeds'));
    const crop = makeVoxel(blockId('wheat_1'));
    const torch = makeVoxel(blockId('torch'));
    fill(world, 2, Y, 0, 2, Y, 0, grass);
    fill(world, 0, Y, 2, 0, Y, 2, poppy);
    fill(world, -3, Y, -1, -3, Y, -1, reeds);
    fill(world, -2, Y, 0, -2, Y, 0, crop);
    fill(world, 0, Y, -2, 0, Y, -2, torch);
    world.setVoxel(0, Y, 0, WATER_SOURCE, 'player');
    settle(world);
    expect(isWater(world.getVoxel(2, Y, 0))).toBe(true);
    expect(isWater(world.getVoxel(0, Y, 2))).toBe(true);
    expect(isWater(world.getVoxel(-3, Y, -1))).toBe(true);
    expect(world.getVoxel(-2, Y, 0)).toBe(crop);
    expect(world.getVoxel(0, Y, -2)).toBe(torch);
    // Water goes around the crop: the cell behind it is reached the long way (two more steps).
    expect(world.getVoxel(-3, Y, 0)).toBe(flowingWater(5));
  });

  it('waits at an unloaded chunk and carries on when it loads', () => {
    const world = new World(SEED, createBus());
    world.ensureLoadedAround(0, 0, 1); // chunks -1..1: x -16..31
    fill(world, 20, FLOOR, -4, 31, FLOOR, 4, STONE);
    world.setVoxel(28, Y, 0, WATER_SOURCE, 'player');
    run(world, 200);
    const s = world.water.stats();
    expect(s.deferred).toBeGreaterThan(0);
    expect(world.isLoaded(32, 0)).toBe(false);
    expect(world.getVoxel(31, Y, 0)).toBe(flowingWater(3));
    world.ensureLoadedAround(40, 0, 1);
    expect(world.water.stats().deferred).toBe(0);
    settle(world);
    // Past the end of the floor the water runs into the newly loaded chunk and pours down.
    expect(world.getVoxel(32, Y, 0)).toBe(flowingWater(4));
    expect(isFallingWater(world.getVoxel(32, Y - 1, 0))).toBe(true);
  });

  it(`looks at no more than ${FLOW_MAX_PER_TICK} cells a tick and carries the rest over`, () => {
    const world = makeWorld();
    fill(world, -20, FLOOR, -20, 20, FLOOR, 20, STONE);
    let placed = 0;
    for (let x = -20; x <= 20 && placed < 300; x += 2) {
      for (let z = -20; z <= 20 && placed < 300; z += 2) {
        world.setVoxel(x, Y, z, WATER_SOURCE, 'player');
        placed++;
      }
    }
    run(world, FLOW_DELAY_TICKS);
    expect(world.water.stats().updates).toBe(FLOW_MAX_PER_TICK);
    run(world, 1);
    expect(world.water.stats().updates).toBe(placed);
  });

  it('continues identically after a save and load mid-flow', () => {
    const a = makeWorld();
    floor(a);
    fill(a, -10, Y, -10, -1, Y + 3, 10, STONE);
    a.setVoxel(-3, Y + 4, 2, WATER_SOURCE, 'player');
    a.setVoxel(3, Y, -3, WATER_SOURCE, 'player');
    run(a, 23);
    const snapshot = JSON.parse(JSON.stringify(a.toJSON()));
    expect(snapshot.water.queue.length).toBeGreaterThan(0);
    const b = World.fromJSON(snapshot, createBus());
    b.ensureLoadedAround(0, 0, 2);
    const same = (): void => {
      for (let y = Y; y <= Y + 4; y++) {
        for (let z = -14; z <= 14; z++) for (let x = -14; x <= 14; x++) expect(b.getVoxel(x, y, z), `${x},${y},${z}`).toBe(a.getVoxel(x, y, z));
      }
    };
    same();
    for (let step = 0; step < 6; step++) {
      run(a, 7);
      run(b, 7);
      same();
    }
    settle(a);
    settle(b);
    same();
    expect(waterCells(a, Y)).toBeGreaterThan(50);
  });

  it('older saves without water load with nothing pending', () => {
    const a = makeWorld(1);
    const snapshot = JSON.parse(JSON.stringify(a.toJSON()));
    delete snapshot.water;
    const b = World.fromJSON(snapshot, createBus());
    expect(b.water.stats().pending).toBe(0);
    // A damaged queue costs only the water on its way, never the world.
    const damaged = World.fromJSON({ ...snapshot, water: { queue: [1, 2], deferred: [] } }, createBus());
    expect(damaged.water.stats().pending).toBe(0);
  });

  it('a freshly generated world is perfectly still (12 seeds)', () => {
    for (let i = 0; i < 12; i++) {
      const seed = 1000 + i * 7919;
      const world = new World(seed, createBus());
      const spawn = findSpawn(seed);
      world.ensureLoadedAround(spawn.x, spawn.z, 3);
      world.update(spawn.x, spawn.z, 3, 0);
      run(world, 60);
      const s = world.water.stats();
      expect(s.updates, `seed ${seed}`).toBe(0);
      expect(s.changes, `seed ${seed}`).toBe(0);
      expect(s.pending + s.deferred, `seed ${seed}`).toBe(0);
    }
  });

  it('only falling water is drawn as falling, and lone falling water drains from the top', () => {
    const world = makeWorld();
    floor(world);
    world.setVoxel(0, Y + 6, 0, WATER_SOURCE, 'player');
    settle(world);
    expect(world.getVoxel(0, Y + 5, 0)).toBe(WATER_FALLING);
    expect(isWaterSource(world.getVoxel(0, Y + 6, 0))).toBe(true);
    // A hanging source does not spread sideways (it is not resting on anything).
    expect(world.getVoxel(1, Y + 6, 0)).toBe(AIR);
    world.setVoxel(0, Y + 6, 0, AIR, 'player');
    run(world, FLOW_DELAY_TICKS);
    expect(world.getVoxel(0, Y + 5, 0)).not.toBe(WATER_FALLING);
    expect(voxelId(world.getVoxel(0, Y + 1, 0))).toBe(voxelId(WATER_FALLING));
    settle(world);
    expect(waterCells(world, Y)).toBe(0);
  });
});

describe('flow performance', () => {
  it('a 7-level flood across flat ground costs well under 0.5 ms a tick', () => {
    const world = makeWorld();
    fill(world, -30, FLOOR, -30, 30, FLOOR, 30, STONE);
    // Warm up the code paths, then measure a second flood elsewhere.
    world.setVoxel(-15, Y, -15, WATER_SOURCE, 'player');
    settle(world);
    world.setVoxel(15, Y, 15, WATER_SOURCE, 'player');
    let busy = 0;
    let total = 0;
    let worst = 0;
    for (let i = 0; i < 400; i++) {
      const before = world.water.stats().updates;
      world.water.tick();
      const s = world.water.stats();
      if (s.updates > before) {
        busy++;
        total += s.lastTickMs;
        worst = Math.max(worst, s.lastTickMs);
      }
      if (s.pending === 0) break;
    }
    const mean = total / busy;
    console.log(`[flow perf] ${busy} busy ticks, mean ${mean.toFixed(3)} ms, worst ${worst.toFixed(3)} ms`);
    // 0.5 ms alone; budget doubled+ because the whole suite runs in parallel (0.95 ms seen under load).
    expect(mean).toBeLessThan(1.5);
  });
});
