import { describe, expect, it } from 'vitest';
import { DAY_LENGTH_S, SUNSET_AT, TWILIGHT } from '../core/constants';
import { blockId } from '../core/registry';
import { makeVoxel } from '../core/types';
import { FakeWorld } from '../game/fakeWorld';
import { checkRoom } from './housing';
import { LODGE_BED, LODGE_D, LODGE_PATH, LODGE_W, lodgeVolume, stateAt } from './lodge';
import { layoutBlocks } from './tavern';
import { TownBuilder, type TownHost } from './townBuilder';
import { footprintOf, townTemplate } from './townTemplates';
import { planTown } from './townPlan';

const SEED = 11;
const ORIGIN: [number, number] = [60, 30];
const DAY_FRAC = SUNSET_AT - 2 * TWILIGHT;

/** Flat grass at y 10 over natural dirt; everything placed is kept. Edited cells are the builder's own placements (as the game reports). */
class Flat implements TownHost {
  dayNo = 1;
  tod = 0.4;
  readonly over = new Map<string, { block: string; facing: number }>();
  readonly edited = new Set<string>();
  private k(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }
  private natural(y: number): string {
    return y < 10 ? 'dirt' : y === 10 ? 'grass' : 'air';
  }
  block(x: number, y: number, z: number): string {
    return this.over.get(this.k(x, y, z))?.block ?? this.natural(y);
  }
  day(): number {
    return this.dayNo;
  }
  timeOfDay(): number {
    return this.tod;
  }
  townSurface(x: number, z: number) {
    for (let y = 60; y > -3; y--) {
      const b = this.block(x, y, z);
      if (b !== 'air') return { y, key: b };
    }
    return null;
  }
  townBlock(x: number, y: number, z: number): string | null {
    return this.block(x, y, z);
  }
  townEdited(x: number, y: number, z: number): boolean {
    return this.edited.has(this.k(x, y, z));
  }
  townPlace(x: number, y: number, z: number, block: string, facing: number): boolean {
    this.over.set(this.k(x, y, z), { block, facing });
    this.edited.add(this.k(x, y, z));
    return true;
  }
  /** The world as the builder left it, for the room check. */
  world(): FakeWorld {
    const w = new FakeWorld();
    for (const [key, c] of this.over) {
      const [x, y, z] = key.split(',').map(Number);
      if (c.block !== 'air') w.setVoxel(x, y, z, makeVoxel(blockId(c.block), c.facing));
    }
    return w;
  }
}

/** Plays `days` days: the day phase earns the budget, then one night tick (as the real game does). */
function play(b: TownBuilder, h: Flat, days: number): void {
  for (let d = 0; d < days; d++) {
    h.dayNo++;
    h.tod = 0.4;
    for (let t = 0; t < DAY_LENGTH_S * DAY_FRAC - 1e-9; t += 2) b.tick(2, h, SEED, ORIGIN);
    h.tod = 0.99;
    b.tick(0, h, SEED, ORIGIN);
  }
}

/** A builder with every block of the lodge in stock, and its plan. */
function started(): { b: TownBuilder; h: Flat } {
  const h = new Flat();
  const b = new TownBuilder();
  b.tick(0, h, SEED, ORIGIN);
  // Every block any stage places (the temporary rooms' doors and beds included).
  const items = new Set<string>();
  for (let k = 0; k < LODGE_PATH.length; k++) for (const c of stateAt(k).values()) if (c.block !== 'air') items.add(c.block);
  for (const item of items) b.deliver(item, 100000);
  for (const item of ['dirt', 'stone_brick', 'oak_log', 'plank', 'gravel']) b.deliver(item, 100000);
  return { b, h };
}

describe('the lodge in the town plan', () => {
  it('is the second building in the plan, on a plot that holds its whole footprint, and touches no other plot', () => {
    const flat = (x: number, z: number) => (x === x ? { y: 10, key: 'grass' } : null);
    const plan = planTown(SEED, ORIGIN, flat);
    expect(plan).not.toBeNull();
    const idx = plan!.buildings.findIndex((x) => x.template === 'lodge');
    expect(idx).toBe(1);
    const lodge = plan!.buildings[idx];
    expect(lodge.rot).toBe(0);
    const box = (x: number, z: number, w: number, d: number) => ({ x0: x, z0: z, x1: x + w - 1, z1: z + d - 1 });
    const mine = box(lodge.x, lodge.z, LODGE_W, LODGE_D);
    for (const [i, other] of plan!.buildings.entries()) {
      if (i === idx || other.template === 'well_plaza') continue;
      const t = footprintOf(townTemplate(other.template)!, other.rot);
      const o = box(other.x, other.z, t.w, t.d);
      const apart = o.x1 < mine.x0 || o.x0 > mine.x1 || o.z1 < mine.z0 || o.z0 > mine.z1;
      expect(apart, `${other.template} overlaps the lodge`).toBe(true);
    }
  });
});

describe('building the lodge stage by stage', () => {
  it('goes through the five stages in order, each finished before the next, and ends on the full tavern', () => {
    const { b, h } = started();
    const levels: number[] = [b.lodgeLevel()];
    for (let day = 0; day < 400 && b.lodgeLevel() < 5; day++) {
      play(b, h, 1);
      if (levels[levels.length - 1] !== b.lodgeLevel()) levels.push(b.lodgeLevel());
    }
    expect(levels).toEqual([0, 1, 2, 3, 4, 5]);
    expect(b.lodgeOrigin()).not.toBeNull();
  });

  it('the bedroom passes checkRoom once the lodge stands, and the second and third bedrooms once they do', () => {
    const { b, h } = started();
    // Checked the moment a stage completes. The ground-floor rooms are taken down when the upper floor starts (its first stage clears
    // them), so the built world is read at levels 1 and 2 here; the third bedroom is checked as a finished stage in lodge.test.ts.
    let checked = 0;
    for (let day = 0; day < 400 && b.lodgeLevel() < 3; day++) {
      play(b, h, 1);
      const level = b.lodgeLevel();
      if (level >= 3) break;
      const o = b.lodgeOrigin();
      if (!o || level < 1 || level === checked) continue;
      const w = h.world();
      expect(checkRoom(w, o[0] + LODGE_BED[0], o[1] + LODGE_BED[1], o[2] + LODGE_BED[2]).reasons, `bedroom one at level ${level}`).toEqual([]);
      if (level >= 2) expect(checkRoom(w, o[0] + 10, o[1] + 1, o[2] + 1).reasons, 'bedroom two').toEqual([]);
      checked = level;
    }
    expect(checked).toBe(2);
  });

  it('the built world equals the final layout over the plot, air where the layout is silent', () => {
    const { b, h } = started();
    for (let day = 0; day < 400 && b.lodgeLevel() < 5; day++) play(b, h, 1);
    const o = b.lodgeOrigin()!;
    const want = new Map<string, string>();
    for (const p of layoutBlocks()) want.set(`${p.x},${p.y},${p.z}`, p.block);
    for (const [x, y, z] of lodgeVolume()) {
      const key = `${x},${y - 0},${z}`;
      const expected = want.get(key) ?? 'air';
      expect(h.block(o[0] + x, o[1] + y, o[2] + z), key).toBe(expected);
    }
    // The cellar below the floor row: the layout's cells there are placed, the rest of the cellar is clear.
    for (const [key, block] of want) {
      const [x, y, z] = key.split(',').map(Number);
      if (y >= 0) continue;
      expect(h.block(o[0] + x, o[1] + y, o[2] + z), key).toBe(block);
    }
  });
});

describe('the lodge in saves', () => {
  it('a save in the middle of a stage loads to the same stage, and the building goes on from there', () => {
    const { b, h } = started();
    while (b.lodgeLevel() < 2) play(b, h, 1);
    play(b, h, 1);
    const snap = JSON.parse(JSON.stringify(b.toJSON()));
    expect(snap.lodge.stage).toBe(b.lodgeLevel());
    const again = new TownBuilder();
    again.load(snap);
    expect(again.lodgeLevel()).toBe(b.lodgeLevel());
    expect(again.hasLodge()).toBe(true);
    expect(again.lodgeOrigin()).toEqual(b.lodgeOrigin());
    expect(again.currentTemplate).toBe(LODGE_PATH[b.lodgeLevel()]);
    expect(again.progress().cells).toBe(b.progress().cells);
  });

  it('an older save with no lodge in its plan loads without one, as before', () => {
    const { b } = started();
    const snap = JSON.parse(JSON.stringify(b.toJSON()));
    snap.plan.buildings = snap.plan.buildings.filter((x: { template: string }) => x.template !== 'lodge');
    delete snap.lodge;
    const old = new TownBuilder();
    old.load(snap);
    expect(old.hasLodge()).toBe(false);
    expect(old.lodgeLevel()).toBe(0);
  });

  it('settling the lodge (the dev skip) finishes it at once and places nothing more on its plot', () => {
    const { b, h } = started();
    play(b, h, 1);
    b.finishLodge();
    expect(b.lodgeLevel()).toBe(5);
    const lodge = b.planned!.buildings.find((x) => x.template === 'lodge')!;
    const onPlot = () => {
      const out = new Map<string, string>();
      for (const [key, c] of h.over) {
        const [x, , z] = key.split(',').map(Number);
        if (x >= lodge.x && x < lodge.x + LODGE_W && z >= lodge.z && z < lodge.z + LODGE_D) out.set(key, c.block);
      }
      return out;
    };
    const before = onPlot();
    play(b, h, 30);
    expect(onPlot()).toEqual(before);
    expect(b.lodgeLevel()).toBe(5);
  });
});
