import { describe, expect, it } from 'vitest';
import { perfIt } from '../testing/perf';
import { DT } from '../core/constants';
import { blockId, machine } from '../core/registry';
import { makeVoxel, voxelId } from '../core/types';
import { createBus, type GameBus } from '../core/context';
import { GameClock } from '../game/clock';
import { FakeWorld } from '../game/fakeWorld';
import { PlayerState } from '../game/playerState';
import { World } from '../world/world';
import { Simulation } from './simulation';
import { isCrop, type CropEntity } from './cropRules';
import { makeKit, type Kit } from './testKit';

const P = machine('crop').params as Record<string, number>;
const STAGE_S = P.stageS;
const DAWN = 0.05;
const NIGHT = 0.7;

/** Ticks the clock and the simulation together (the kit's own run() leaves the clock alone). */
function live(kit: Kit, seconds: number): void {
  const ticks = Math.round(seconds / DT);
  for (let i = 0; i < ticks; i++) {
    kit.clock.tick(DT);
    kit.sim.tick(DT);
  }
}

/** Farmland at y - 1 and a crop block at x,y,z; `water` puts a water block 3 blocks east at y - 1. */
function plant(kit: Kit, x: number, y: number, z: number, opts: { water?: boolean; crop?: string; soil?: string } = {}): CropEntity {
  kit.world.put(x, y - 1, z, opts.soil ?? 'farmland');
  if (opts.water) kit.world.put(x + 3, y - 1, z, 'water');
  kit.world.put(x, y, z, opts.crop ?? 'wheat_0');
  const e = kit.world.getEntity(x, y, z);
  if (!isCrop(e)) throw new Error('no crop entity');
  return e;
}

const stageAt = (kit: Kit, x: number, y: number, z: number): string => kit.world.getBlock(x, y, z).key;

/** A kit at dawn (sunlight full until dusk, ~486 s later). */
function morning(): Kit {
  const kit = makeKit();
  kit.clock.timeOfDay = DAWN;
  return kit;
}

describe('crop growth', () => {
  it('ripens in 3 stages of stageS seconds when hydrated in daylight, then stops', () => {
    const kit = morning();
    const grew = kit.record('crop:grew');
    const e = plant(kit, 0, 11, 0, { water: true });
    live(kit, STAGE_S - 0.2);
    expect(stageAt(kit, 0, 11, 0)).toBe('wheat_0');
    live(kit, 0.4);
    expect(stageAt(kit, 0, 11, 0)).toBe('wheat_1');
    expect(grew).toEqual([{ x: 0, y: 11, z: 0, stage: 1 }]);
    live(kit, 2 * STAGE_S);
    expect(stageAt(kit, 0, 11, 0)).toBe('wheat_3');
    expect(grew.map((g) => g.stage)).toEqual([1, 2, 3]);
    expect(grew.map((g) => g.ripe)).toEqual([undefined, undefined, true]);
    // The same entity all along, now resting.
    expect(kit.world.getEntity(0, 11, 0)).toBe(e);
    expect(e.growS).toBe(0);
    live(kit, 60);
    expect(grew).toHaveLength(3);
    expect(kit.sim.cropView(0, 11, 0)).toMatchObject({ ripe: true, status: 'Ripe', stage: 3, stages: 4, name: 'Wheat (ripe)' });
  });

  it('grows at dryRate without water, sleeps through the night and goes on in the morning', () => {
    const kit = morning();
    const e = plant(kit, 0, 11, 0, { crop: 'potato_0' });
    const dryStage = STAGE_S / P.dryRate;
    live(kit, dryStage - 0.2);
    expect(stageAt(kit, 0, 11, 0)).toBe('potato_0');
    live(kit, 0.4);
    expect(stageAt(kit, 0, 11, 0)).toBe('potato_1');
    expect(kit.sim.cropView(0, 11, 0)).toMatchObject({ hydrated: false, rate: P.dryRate, status: 'Growing - stage 2 of 4' });
    // Run into the night: growth stops where the light falls below minSunlight.
    while (kit.clock.sunlight() >= P.minSunlight) live(kit, 1);
    live(kit, 5);
    const atDusk = e.growS;
    live(kit, 120);
    expect(e.growS).toBe(atDusk);
    expect(kit.sim.cropView(0, 11, 0)).toMatchObject({ lit: false, rate: 0, status: 'Needs light', nextStageS: Infinity });
    // Sunrise wakes it.
    while (kit.clock.sunlight() < P.minSunlight) live(kit, 1);
    live(kit, 10);
    expect(e.growS).toBeGreaterThan(atDusk);
    live(kit, 3 * dryStage);
    expect(stageAt(kit, 0, 11, 0)).toBe('potato_3');
  });

  it('dry crops ripen in two stageS per stage, hydrated ones in one (the spec totals 300 s / 600 s)', () => {
    const kit = morning();
    plant(kit, 0, 11, 0, { water: true });
    plant(kit, 20, 11, 0);
    live(kit, 3 * STAGE_S + 0.2);
    expect(stageAt(kit, 0, 11, 0)).toBe('wheat_3');
    expect(stageAt(kit, 20, 11, 0)).toBe('wheat_1');
    const dry = kit.sim.cropView(20, 11, 0);
    expect(dry?.ripeInS).toBeCloseTo(6 * STAGE_S - (3 * STAGE_S + 0.2), 0);
  });

  it('water reaches 4 blocks horizontally at y or y - 1, not 5, not y + 1', () => {
    const kit = morning();
    const cases: Array<[number, number, number, boolean]> = [
      [4, -1, 4, true],
      [-4, 0, 0, true],
      [5, -1, 0, false],
      [0, 1, 2, false],
      [0, -2, 2, false],
    ];
    cases.forEach(([dx, dy, dz], i) => {
      const x = i * 20;
      plant(kit, x, 11, 0);
      kit.world.put(x + dx, 11 + dy, dz, 'water');
    });
    live(kit, 1);
    cases.forEach(([, , , wet], i) => expect(kit.sim.cropView(i * 20, 11, 0)?.hydrated).toBe(wet));
    // Taking the water away dries the crop; pouring it back hydrates it again.
    kit.world.put(4, 10, 4, 'air');
    live(kit, DT);
    expect(kit.sim.cropView(0, 11, 0)?.hydrated).toBe(false);
    kit.world.put(0, 11, -3, 'water');
    live(kit, DT);
    expect(kit.sim.cropView(0, 11, 0)?.hydrated).toBe(true);
  });

  it('a plant left on nothing pops on the next tick, dropping what it would (UNIT-03 rule 1)', () => {
    const kit = morning();
    plant(kit, 0, 11, 0, { soil: 'dirt', water: true });
    live(kit, 0.2);
    expect(stageAt(kit, 0, 11, 0)).toBe('air');
    expect(kit.sim.cropView(0, 11, 0)).toBeNull();
  });

  it('soil removed under a growing crop pops it, and a crop on farmland never pops', () => {
    const kit = morning();
    const e = plant(kit, 0, 11, 0, { water: true });
    live(kit, STAGE_S + 0.2);
    expect(stageAt(kit, 0, 11, 0)).not.toBe('air');
    kit.world.put(0, 10, 0, 'air');
    live(kit, 0.2);
    expect(stageAt(kit, 0, 11, 0)).toBe('air');
    expect(e).toBeDefined();
  });

  it('needs open sky by day: an opaque block anywhere above stops it, glass does not', () => {
    const kit = morning();
    const e = plant(kit, 0, 11, 0, { water: true });
    kit.world.put(0, 40, 0, 'stone');
    live(kit, 50);
    expect(e.growS).toBe(0);
    expect(kit.sim.cropView(0, 11, 0)?.status).toBe('Needs light');
    kit.world.put(0, 40, 0, 'glass');
    live(kit, 50);
    expect(e.growS).toBeCloseTo(50, 5);
    kit.world.put(0, 13, 0, 'oak_leaves');
    live(kit, 20);
    expect(e.growS).toBeCloseTo(50, 5);
    kit.world.put(0, 13, 0, 'air');
    live(kit, 20);
    expect(e.growS).toBeCloseTo(70, 5);
  });

  it('a powered lamp within lampRadius grows it at night and underground', () => {
    const kit = makeKit();
    kit.clock.timeOfDay = NIGHT;
    // Underground: a stone roof over everything.
    kit.world.fill(-8, 20, -8, 30, 20, 8, 'stone');
    const near = plant(kit, 0, 11, 0, { water: true });
    const far = plant(kit, 12, 11, 0, { water: true });
    // A lamp 4 blocks above-and-beside the near crop (distance sqrt(9 + 16) = 5) fed by a burner generator.
    const lampAt = { x: 3, y: 15, z: 0 };
    kit.machine('lamp', lampAt.x, lampAt.y, lampAt.z);
    const burner = kit.machine('burner_generator', lampAt.x + 1, lampAt.y, lampAt.z);
    burner.slots[0] = { item: 'coal', count: 20 };
    // Only `far` is 9 blocks from the lamp; give it its own lamp 6 blocks away (out of reach).
    kit.machine('lamp', 12, 17, 0);
    kit.machine('burner_generator', 13, 17, 0).slots[0] = { item: 'coal', count: 20 };
    live(kit, STAGE_S + 0.2);
    expect(kit.sim.machineView(lampAt.x, lampAt.y, lampAt.z)?.running).toBe(true);
    expect(stageAt(kit, 0, 11, 0)).toBe('wheat_1');
    expect(far.growS).toBe(0);
    expect(kit.sim.cropView(12, 11, 0)?.status).toBe('Needs light');
    // Switching the lamp off puts the crop back in the dark at once.
    kit.sim.setMachineOn(lampAt.x, lampAt.y, lampAt.z, false);
    live(kit, 1);
    const held = near.growS;
    live(kit, 30);
    expect(near.growS).toBe(held);
    kit.sim.setMachineOn(lampAt.x, lampAt.y, lampAt.z, true);
    live(kit, 30);
    expect(near.growS).toBeGreaterThan(held + 25);
    // Breaking the lamp darkens it too.
    kit.world.put(lampAt.x, lampAt.y, lampAt.z, 'air');
    live(kit, 1);
    const after = near.growS;
    live(kit, 10);
    expect(near.growS).toBe(after);
  });

  it('an unpowered lamp does not count', () => {
    const kit = makeKit();
    kit.clock.timeOfDay = NIGHT;
    const e = plant(kit, 0, 11, 0, { water: true });
    kit.machine('lamp', 1, 12, 0);
    live(kit, 20);
    expect(e.growS).toBe(0);
  });

  it('is not a machine: no network, no machine view, no sounds or toasts, nothing returned when broken', () => {
    const kit = morning();
    const sfx = kit.record('sfx');
    const toasts = kit.record('toast');
    const placed = kit.record('machine:placed');
    const removed = kit.record('machine:removed');
    // Right beside a lamp on a working network.
    kit.machine('lamp', 1, 11, 0);
    kit.machine('burner_generator', 2, 11, 0).slots[0] = { item: 'coal', count: 20 };
    placed.length = 0;
    sfx.length = 0;
    plant(kit, 0, 11, 0, { water: true });
    live(kit, 3 * STAGE_S + 1);
    expect(stageAt(kit, 0, 11, 0)).toBe('wheat_3');
    expect(kit.sim.machineAt(0, 11, 0)).toBeNull();
    expect(kit.sim.machineView(0, 11, 0)).toBeNull();
    expect(kit.sim.networkAt(0, 11, 0)).toBeNull();
    expect(kit.sim.allNetworks()).toHaveLength(1);
    expect(kit.sim.allNetworks()[0].members.map((m) => m.kind).sort()).toEqual(['burner_generator', 'lamp']);
    expect(kit.sim.entityCount).toBe(2);
    expect(kit.sim.cropCount).toBe(1);
    expect(placed).toEqual([]);
    expect(sfx.map((s) => s.name)).toEqual(['pickup']); // only the ripening chime
    expect(toasts).toEqual([]);
    const before = JSON.stringify(kit.player.inventory.toJSON());
    kit.world.put(0, 11, 0, 'air');
    expect(kit.world.getEntity(0, 11, 0)).toBeUndefined();
    expect(kit.sim.cropCount).toBe(0);
    expect(kit.sim.cropView(0, 11, 0)).toBeNull();
    expect(JSON.stringify(kit.player.inventory.toJSON())).toBe(before);
    expect(removed).toEqual([]);
    // Replanting starts from scratch.
    kit.world.put(0, 11, 0, 'wheat_0');
    expect((kit.world.getEntity(0, 11, 0) as CropEntity).growS).toBe(0);
  });

  it('costs nothing per tick while it cannot grow, and ripe crops sleep for good', () => {
    const kit = morning();
    for (let i = 0; i < 10; i++) plant(kit, i * 2, 11, 0, { water: true });
    live(kit, 1);
    const field = { get awakeCount() { return kit.sim.cropsAwake; } };
    expect(field.awakeCount).toBe(10);
    kit.clock.timeOfDay = NIGHT;
    live(kit, 1);
    expect(field.awakeCount).toBe(0);
    kit.clock.timeOfDay = DAWN;
    live(kit, 3 * STAGE_S + 1);
    expect(field.awakeCount).toBe(0);
    expect(stageAt(kit, 0, 11, 0)).toBe('wheat_3');
    // An unrelated edit far away wakes nobody.
    kit.world.put(50, 11, 50, 'stone');
    expect(field.awakeCount).toBe(0);
  });
});

/** A fake world whose chunk columns are loaded only once listed, announcing it like the real world. */
class PartialWorld extends FakeWorld {
  readonly loaded = new Set<string>();
  constructor(private readonly busRef: GameBus) {
    super(busRef);
  }
  isLoaded(x?: number, z?: number): boolean {
    return this.loaded.has(`${Math.floor((x ?? 0) / 16)},${Math.floor((z ?? 0) / 16)}`);
  }
  load(cx: number, cz: number): void {
    this.loaded.add(`${cx},${cz}`);
    this.busRef.emit('chunk:loaded', { cx, cz });
  }
}

describe('crop persistence', () => {
  it('continues identically after a save and load mid-growth', () => {
    const a = morning();
    plant(a, 0, 11, 0, { water: true });
    plant(a, 10, 11, 0, { crop: 'carrot_0' });
    live(a, 150);
    expect(stageAt(a, 0, 11, 0)).toBe('wheat_1');

    const saved = JSON.parse(JSON.stringify([...a.world.entities()])) as CropEntity[];
    const b = makeKit();
    b.clock.timeOfDay = a.clock.timeOfDay;
    for (const e of saved) b.world.setEntity(e);
    for (const [x, y, z] of [[0, 10, 0], [3, 10, 0], [0, 11, 0], [10, 10, 0], [10, 11, 0]]) b.world.setVoxel(x, y, z, a.world.getVoxel(x, y, z), 'load');
    b.sim.resync();
    expect(b.sim.cropCount).toBe(2);
    live(a, 200);
    live(b, 200);
    const snap = (kit: Kit) => JSON.parse(JSON.stringify([...kit.world.entities()]));
    expect(snap(b)).toEqual(snap(a));
    expect(stageAt(b, 0, 11, 0)).toBe('wheat_3');
    expect(voxelId(b.world.getVoxel(10, 11, 0))).toBe(voxelId(a.world.getVoxel(10, 11, 0)));
    expect(stageAt(b, 10, 11, 0)).toBe('carrot_1');
  });

  it('waits for its chunk after loading, and adopts the stored entity', () => {
    const kit = makeKit((bus) => new PartialWorld(bus));
    const world = kit.world as PartialWorld;
    kit.clock.timeOfDay = DAWN;
    const stored: CropEntity = { kind: 'crop', x: 2, y: 11, z: 2, growS: 90 };
    world.setEntity(stored);
    world.put(2, 10, 2, 'farmland');
    world.put(5, 10, 2, 'water');
    world.put(2, 11, 2, 'wheat_0');
    kit.sim.resync();
    live(kit, 20);
    expect(stored.growS).toBe(90);
    expect(kit.sim.cropView(2, 11, 2)).toBeNull();
    world.load(0, 0);
    live(kit, 10.2);
    expect(kit.world.getEntity(2, 11, 2)).toBe(stored);
    expect(stageAt(kit, 2, 11, 2)).toBe('wheat_1');
  });

  it('an old-style crop entity without growS starts from zero', () => {
    const kit = morning();
    kit.world.setEntity({ kind: 'crop', x: 0, y: 11, z: 0, on: true, slots: [] });
    plant(kit, 0, 11, 0, { water: true });
    expect((kit.world.getEntity(0, 11, 0) as CropEntity).growS).toBe(0);
    live(kit, STAGE_S + 0.2);
    expect(stageAt(kit, 0, 11, 0)).toBe('wheat_1');
  });
});

describe('crop speed', () => {
  perfIt('ticks 500 growing crops in the real world in well under 0.3 ms', () => {
    const bus = createBus();
    const world = new World(1234, bus);
    world.ensureLoadedAround(0, 0, 1);
    const clock = new GameClock(bus, DAWN);
    const sim = new Simulation(world, bus, new PlayerState(bus, { x: 0.5, y: 80, z: 0.5 }), clock);
    const put = (x: number, y: number, z: number, key: string): void => {
      world.setVoxel(x, y, z, makeVoxel(blockId(key)), 'player');
    };
    // A 25 x 20 field high above the terrain, with a water channel along each end (160 crops in reach of it).
    const Y = 80;
    for (let x = 0; x < 25; x++) {
      for (let z = 0; z < 20; z++) {
        put(x, Y - 1, z, 'farmland');
        put(x, Y, z, ['wheat_0', 'potato_0', 'carrot_0'][(x + z) % 3]);
      }
    }
    for (let z = 0; z < 20; z++) {
      put(-1, Y - 1, z, 'water');
      put(25, Y - 1, z, 'water');
    }
    expect(sim.cropCount).toBe(500);
    const time = (ticks: number): number => {
      const t0 = performance.now();
      for (let i = 0; i < ticks; i++) {
        clock.tick(DT);
        sim.tick(DT);
      }
      return (performance.now() - t0) / ticks;
    };
    time(40);
    expect(sim.cropsAwake).toBe(500);
    // 220 s of game time: every crop grows at least a stage (swapping its block) inside the window.
    const day = time(4400);
    const stages = [...world.entities()].map((e) => sim.cropView(e.x, e.y, e.z)?.stage ?? -1);
    expect(stages.filter((s) => s === 1)).toHaveLength(340);
    expect(stages.filter((s) => s === 2)).toHaveLength(160);
    clock.timeOfDay = NIGHT;
    time(1);
    expect(sim.cropsAwake).toBe(0);
    const night = time(2000);
    // Right after loading a save every crop looks around once (a read budget per tick): the worst ticks of a load.
    clock.timeOfDay = DAWN;
    sim.resync();
    // 500 x ~180 reads at 1500 a tick: about 60 ticks until every crop looked around.
    const before = [...world.entities()].map((e) => e.growS as number);
    const loadTicks: number[] = [];
    for (let i = 0; i < 60; i++) loadTicks.push(time(1));
    const after = [...world.entities()].map((e) => e.growS as number);
    expect(after.every((g, i) => g > before[i])).toBe(true);
    const loadMean = loadTicks.reduce((a, t) => a + t, 0) / loadTicks.length;
    loadTicks.sort((a, b) => a - b);
    const loadMedian = loadTicks[loadTicks.length >> 1];
    expect(sim.cropsAwake).toBe(500);
    console.log(
      `crop speed, 500 crops (real World): day tick ${day.toFixed(4)} ms (stage swaps included), night tick ${night.toFixed(4)} ms, ` +
        `after a load ${loadTicks.length} ticks at mean ${loadMean.toFixed(3)} / median ${loadMedian.toFixed(3)} ms`,
    );
    expect(day).toBeLessThan(0.3);
    expect(night).toBeLessThan(0.05);
    expect(loadMedian).toBeLessThan(1);
  });
});
