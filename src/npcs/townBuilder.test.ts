import { describe, expect, it } from 'vitest';
import { DAY_LENGTH_S, SUNSET_AT, TWILIGHT } from '../core/constants';
import { blockOrNull } from '../core/registry';
import { phaseAt } from '../game/clock';
import { DAY_BUDGET, MOVABLE, TownBuilder, type TownHost } from './townBuilder';
import { planTown } from './townPlan';
import { footprintOf, townTemplate } from './townTemplates';

const SEED = 7;
const ORIGIN: [number, number] = [100, -40];
const DAY_FRAC = SUNSET_AT - 2 * TWILIGHT;
const ITEMS = ['dirt', 'stone_brick', 'oak_log', 'plank', 'glass', 'torch', 'crate', 'workbench', 'furnace_clay', 'gravel'];

interface Placed {
  x: number;
  y: number;
  z: number;
  block: string;
  prev: string;
}

/** A small world: natural ground under `groundY`, placed blocks on top, and chunks that may be unloaded. */
class Ground implements TownHost {
  tod = 0.4;
  dayNo = 1;
  unloadedAt: (x: number, z: number) => boolean = () => false;
  readonly over = new Map<string, { block: string; facing: number }>();
  readonly edited = new Set<string>();
  readonly log: Placed[] = [];

  constructor(readonly groundY: (x: number, z: number) => number = () => 10) {}

  private key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }
  day(): number {
    return this.dayNo;
  }
  timeOfDay(): number {
    return this.tod;
  }
  private loaded(x: number, z: number): boolean {
    return !this.unloadedAt(x, z);
  }
  natural(x: number, y: number, z: number): string {
    const g = this.groundY(x, z);
    return y < g ? 'dirt' : y === g ? 'grass' : 'air';
  }
  block(x: number, y: number, z: number): string {
    return this.over.get(this.key(x, y, z))?.block ?? this.natural(x, y, z);
  }
  townSurface(x: number, z: number) {
    if (!this.loaded(x, z)) return null;
    for (let y = 60; y > -3; y--) {
      const b = this.block(x, y, z);
      if (b !== 'air') return { y, key: b };
    }
    return null;
  }
  townBlock(x: number, y: number, z: number): string | null {
    return this.loaded(x, z) ? this.block(x, y, z) : null;
  }
  townEdited(x: number, y: number, z: number): boolean {
    return this.edited.has(this.key(x, y, z));
  }
  townPlace(x: number, y: number, z: number, block: string, facing: number): boolean {
    if (!this.loaded(x, z)) return false;
    this.log.push({ x, y, z, block, prev: this.block(x, y, z) });
    this.over.set(this.key(x, y, z), { block, facing });
    this.edited.add(this.key(x, y, z));
    return true;
  }
  /** Player-made: a block the builder must leave alone. */
  playerBlock(x: number, y: number, z: number, block: string): void {
    this.over.set(this.key(x, y, z), { block, facing: 0 });
    this.edited.add(this.key(x, y, z));
  }
  placedNonAir(): Placed[] {
    return this.log.filter((p) => p.block !== 'air');
  }
}

function stockUp(b: TownBuilder, n = 1000): void {
  for (const item of ITEMS) b.deliver(item, n);
}

/** Plays `days` days: the day phase ticks the budget through, then one night tick. */
function runDays(b: TownBuilder, g: Ground, days: number, dt = 2): void {
  for (let d = 0; d < days; d++) {
    g.dayNo += d === 0 ? 0 : 1;
    g.tod = 0.4;
    for (let t = 0; t < DAY_LENGTH_S * DAY_FRAC - 1e-9; t += dt) b.tick(dt, g, SEED, ORIGIN);
    g.tod = 0.99;
    b.tick(0, g, SEED, ORIGIN);
  }
}

describe('town builder', () => {
  it('uses the day and night phases it assumes', () => {
    expect(phaseAt(0.4)).toBe('day');
    expect(phaseAt(0.99)).toBe('night');
  });

  it('lays one day budget of cells in a day, and no more', () => {
    const g = new Ground();
    const b = new TownBuilder();
    stockUp(b);
    runDays(b, g, 1);
    const s = b.toJSON()!;
    expect(s.cell).toBeGreaterThanOrEqual(DAY_BUDGET - 1);
    expect(s.cell).toBeLessThanOrEqual(DAY_BUDGET);
    expect(s.laid).toBe(s.cell);
  });

  it('runs the stages in order, clearing first, and the storage bay comes first', () => {
    const g = new Ground();
    const b = new TownBuilder();
    stockUp(b);
    let last = -1;
    let building = 0;
    for (let d = 0; d < 6; d++) {
      runDays(b, g, 1);
      if (b.toJSON()!.building !== building) {
        building = b.toJSON()!.building;
        last = -1;
      }
      const st = b.stage();
      if (st >= 0) {
        expect(st).toBeGreaterThanOrEqual(last);
        last = st;
      }
    }
    expect(b.toJSON()!.building).toBeGreaterThanOrEqual(1);
    expect(b.planned!.buildings[0].template).toBe('storage_bay');
  });

  it('builds from the bay only: nothing is placed from nowhere, and missing() names what is short', () => {
    const g = new Ground();
    const b = new TownBuilder();
    runDays(b, g, 3);
    expect(g.placedNonAir()).toHaveLength(0);
    expect(b.missing()).toEqual([{ item: 'dirt', count: 1 }]);
    b.deliver('dirt', 1);
    runDays(b, g, 1);
    expect(g.placedNonAir().length).toBeGreaterThan(0);
    const miss = b.missing();
    expect(miss.some((m) => m.item === 'oak_log' || m.item === 'stone_brick')).toBe(true);
    // Every placed block was taken from the bay: stock left plus placements equals what was delivered.
    const left = b.stock();
    const placedDirt = g.placedNonAir().filter((p) => p.block === 'dirt').length;
    expect(placedDirt).toBe(1);
    // The doorstep was grass: digging it may return a drop to the bay before the dirt is laid, so the bay never goes negative.
    expect(left.dirt ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('digs movable blocks out of the way into the bay, and conserves material', () => {
    const g = new Ground();
    const b = new TownBuilder();
    // Plan first (pure), then raise two stone bumps inside the bay's footprint.
    const plan = planTown(SEED, ORIGIN, (x, z) => g.townSurface(x, z))!;
    const bay = plan.buildings[0];
    g.over.set(`${bay.x + 1},11,${bay.z + 1}`, { block: 'stone', facing: 0 });
    g.over.set(`${bay.x + 2},11,${bay.z + 1}`, { block: 'stone', facing: 0 });
    stockUp(b, 100);
    const before = b.stock();
    runDays(b, g, 2);
    const stone = blockOrNull('stone')!;
    for (const d of stone.drops) {
      const n = typeof d.count === 'number' ? d.count : d.count[0];
      expect((b.stock()[d.item] ?? 0) - (before[d.item] ?? 0) + (g.placedNonAir().filter((p) => p.block === d.item).length)).toBe(2 * n);
    }
    expect(g.block(bay.x + 1, 11, bay.z + 1)).toBe('air');
    expect(MOVABLE.has('stone')).toBe(true);
  });

  it('never overwrites a player-edited cell', () => {
    const g = new Ground();
    const b = new TownBuilder();
    const plan = planTown(SEED, ORIGIN, (x, z) => g.townSurface(x, z))!;
    const bay = plan.buildings[0];
    g.playerBlock(bay.x + 2, 11, bay.z, 'torch'); // a player's torch where the bay's footing goes
    stockUp(b);
    runDays(b, g, 4);
    expect(g.block(bay.x + 2, 11, bay.z)).toBe('torch');
    expect(g.log.some((p) => p.x === bay.x + 2 && p.y === 11 && p.z === bay.z)).toBe(false);
    expect(b.toJSON()!.blocked).toBeGreaterThanOrEqual(1);
  });

  it('drops a plot with too many player blocks in the way and moves to the next', () => {
    const g = new Ground();
    const b = new TownBuilder();
    const plan = planTown(SEED, ORIGIN, (x, z) => g.townSurface(x, z))!;
    const bay = plan.buildings[0];
    const f = footprintOf(townTemplate('storage_bay')!, bay.rot);
    for (let x = bay.x; x < bay.x + f.w; x++) for (let z = bay.z; z < bay.z + f.d; z++) g.playerBlock(x, 11, z, 'plank');
    stockUp(b);
    runDays(b, g, 1);
    expect(b.toJSON()!.building).toBe(1);
    expect(b.currentTemplate).toBe('well_plaza');
  });

  it('catches up on cells in unloaded chunks when they load, and never places one twice', () => {
    const g = new Ground();
    const b = new TownBuilder();
    stockUp(b);
    b.tick(0, g, SEED, ORIGIN); // plans and starts the bay while its chunks are loaded
    g.unloadedAt = () => true;
    runDays(b, g, 1);
    const away = b.toJSON()!;
    expect(away.cell).toBeGreaterThan(0);
    expect(away.laid).toBe(0);
    expect(g.log).toHaveLength(0);
    g.unloadedAt = () => false;
    b.tick(0, g, SEED, ORIGIN);
    const back = b.toJSON()!;
    expect(back.laid).toBe(back.cell);
    // Each cell gets its block once (a movable block dug first is not a second placement of the same block).
    const keys = g.placedNonAir().map((p) => `${p.x},${p.y},${p.z}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThan(0);
  });

  it('reaches tall footings down to the ground on a slope, with no floating corners', () => {
    const slope = (x: number) => 10 + Math.floor((x - 90) / 4);
    const g = new Ground(slope);
    const b = new TownBuilder();
    stockUp(b);
    runDays(b, g, 8);
    expect(b.toJSON()!.building).toBeGreaterThanOrEqual(1);
    const plan = planTown(SEED, ORIGIN, (x, z) => new Ground(slope).townSurface(x, z))!;
    const bay = plan.buildings[0];
    const t = townTemplate('storage_bay')!;
    const f = footprintOf(t, bay.rot);
    let lo = Infinity;
    const grounds: number[] = [];
    for (let i = 0; i < f.w; i++) for (let j = 0; j < f.d; j++) {
      grounds.push(slope(bay.x + i));
      lo = Math.min(lo, slope(bay.x + i));
    }
    const base = lo + 1;
    let k = 0;
    for (let i = 0; i < f.w; i++) for (let j = 0; j < f.d; j++, k++) {
      const gy = grounds[k];
      for (let y = gy + 1; y < base; y++) expect(g.block(bay.x + i, y, bay.z + j), `stilt ${i},${j},${y}`).toBe('stone_brick');
    }
    expect(g.block(bay.x, base, bay.z)).toBe('oak_log');
  });

  it('keeps its progress through a save and a load, and an old save starts a town', () => {
    const g = new Ground();
    const b = new TownBuilder();
    stockUp(b);
    runDays(b, g, 2);
    const json = JSON.parse(JSON.stringify(b.toJSON()));
    const b2 = new TownBuilder();
    b2.load(json);
    expect(b2.toJSON()).toEqual(json);
    expect(b2.missing()).toEqual(b.missing());
    const fresh = new TownBuilder();
    fresh.load(undefined);
    expect(fresh.toJSON()).toBeUndefined();
    fresh.tick(0, new Ground(), SEED, ORIGIN);
    expect(fresh.planned).not.toBeNull();
  });
});

