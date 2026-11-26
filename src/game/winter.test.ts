import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { blockId } from '../core/registry';
import { voxelId } from '../core/types';
import { DAYS_PER_SEASON } from '../sim/seasons';
import { setTemperatureProvider } from '../sim/temperature';
import { FakeWorld } from './fakeWorld';
import { PlayerState } from './playerState';
import { FUEL_TARGET_S, Winter } from './winter';

const WINTER_DAY = DAYS_PER_SEASON * 3 + 3; // day 3 of the first winter
const SPRING_DAY = DAYS_PER_SEASON * 4 + 1;

class EditedWorld extends FakeWorld {
  private readonly edited = new Set<string>();
  setVoxel(x: number, y: number, z: number, v: number, s?: 'player' | 'sim' | 'load' | 'town'): boolean {
    this.edited.add(`${x},${y},${z}`);
    return super.setVoxel(x, y, z, v, s);
  }
  /** Terrain as generated: not in the edit log. */
  natural(x: number, y: number, z: number, block: string): void {
    this.put(x, y, z, block);
    this.edited.delete(`${x},${y},${z}`);
  }
  wasEdited(x: number, y: number, z: number): boolean {
    return this.edited.has(`${x},${y},${z}`);
  }
}

function rig(day: number, hard = true) {
  const bus = createBus();
  const world = new EditedWorld(bus);
  world.fill(-3, 4, -3, 3, 4, 3, 'stone');
  const player = new PlayerState(bus, { x: 0.5, y: 6, z: 0.5 });
  const toasts: string[] = [];
  bus.on('toast', (e) => toasts.push(e.text));
  let d = day;
  let night = false;
  const winter = new Winter({ world, bus, player, day: () => d, isNight: () => night, snowing: () => false });
  winter.hard = hard;
  return { world, player, toasts, winter, setDay: (n: number) => { d = n; }, setNight: (n: boolean) => { night = n; } };
}

const sweep = (r: ReturnType<typeof rig>): void => { for (let i = 0; i < 300; i++) r.winter.tick(0.05); };

describe('winter: frozen rivers', () => {
  it('freezes open water from the second day of winter and thaws it in spring', () => {
    const r = rig(DAYS_PER_SEASON * 3 + 1);
    r.world.fill(-2, 4, -2, 2, 5, 2, 'water'); // a river two deep
    sweep(r);
    expect(voxelId(r.world.getVoxel(0, 5, 0))).toBe(blockId('water')); // day 1 of winter: still open
    r.setDay(WINTER_DAY);
    sweep(r);
    expect(voxelId(r.world.getVoxel(0, 5, 0))).toBe(blockId('ice'));
    expect(voxelId(r.world.getVoxel(2, 5, -2))).toBe(blockId('ice'));
    r.setDay(SPRING_DAY);
    sweep(r);
    expect(voxelId(r.world.getVoxel(0, 5, 0))).toBe(blockId('water'));
  });

  it('never thaws natural ice, and does not freeze water with nothing under it', () => {
    const r = rig(SPRING_DAY);
    r.world.natural(0, 5, 0, 'ice');
    r.world.put(1, 5, 0, 'water');
    r.world.setVoxel(1, 4, 0, 0); // a waterfall cell: air below
    r.setDay(WINTER_DAY);
    sweep(r);
    expect(voxelId(r.world.getVoxel(1, 5, 0))).toBe(blockId('water'));
    r.setDay(SPRING_DAY);
    r.world.natural(0, 5, 0, 'ice');
    r.world.natural(0, 4, 0, 'water');
    sweep(r);
    expect(voxelId(r.world.getVoxel(0, 5, 0))).toBe(blockId('ice'));
  });

  it('freezes rivers on a normal world too', () => {
    const r = rig(WINTER_DAY, false);
    r.world.put(1, 5, 1, 'water');
    sweep(r);
    expect(voxelId(r.world.getVoxel(1, 5, 1))).toBe(blockId('ice'));
  });
});

describe('winter: hard-winter cold and goals', () => {
  it('drains warmth only on a hard-winter world, harder at night and in the open, building up over the first days', () => {
    const hard = rig(WINTER_DAY);
    const normal = rig(WINTER_DAY, false);
    expect(normal.winter.coldDrain(true)).toBe(0);
    const day = hard.winter.coldDrain(true);
    expect(day).toBeGreaterThan(0);
    expect(hard.winter.coldDrain(false)).toBeLessThan(day);
    hard.setNight(true);
    expect(hard.winter.coldDrain(true)).toBeGreaterThan(day);
    const early = rig(DAYS_PER_SEASON * 3 + 1);
    expect(early.winter.coldDrain(true)).toBeLessThan(day);
    expect(rig(DAYS_PER_SEASON * 2 + 2).winter.coldDrain(true)).toBe(0); // summer
  });

  it('asks the heat-zones provider first', () => {
    const r = rig(WINTER_DAY);
    setTemperatureProvider(() => 15);
    try {
      expect(r.winter.coldDrain(true)).toBe(0);
    } finally {
      setTemperatureProvider(null);
    }
    expect(r.winter.coldDrain(true)).toBeGreaterThan(0);
  });

  it('completes the fuel goal from the pack plus crates, once', () => {
    const r = rig(DAYS_PER_SEASON * 3);
    expect(r.winter.current()?.id).toBe('stockpile');
    r.player.inventory.set(0, { item: 'oak_log', count: 30 }); // 30 x 50 s
    r.world.setEntity({ kind: 'crate', x: 2, y: 5, z: 2, slots: [{ item: 'charcoal', count: 20 }] } as never); // 20 x 80 s
    expect(r.winter.fuelStockS()).toBeGreaterThanOrEqual(FUEL_TARGET_S);
    r.winter.tick(2.5);
    expect(r.winter.goals()[0].done).toBe(true);
    expect(r.toasts.filter((t) => /fuel is put by/.test(t))).toHaveLength(1);
    expect(r.winter.current()?.id).toBe('greenhouse');
  });

  it('completes the greenhouse goal for a crop under glass but not one in the open or under stone', () => {
    const r = rig(DAYS_PER_SEASON * 3);
    r.world.put(0, 5, 0, 'wheat_0');
    r.world.setEntity({ kind: 'crop', x: 0, y: 5, z: 0, growS: 0 } as never);
    expect(r.winter.hasGreenhouse()).toBe(false);
    r.world.put(0, 9, 0, 'stone');
    expect(r.winter.hasGreenhouse()).toBe(false);
    r.world.put(0, 9, 0, 'glass');
    expect(r.winter.hasGreenhouse()).toBe(true);
  });

  it('finishes the arc after the first winter and warns on the way in', () => {
    const r = rig(DAYS_PER_SEASON * 2 + 1);
    r.setDay(DAYS_PER_SEASON * 2 + 1);
    r.winter.tick(2.5);
    r.setDay(DAYS_PER_SEASON * 3 + 1);
    r.winter.tick(2.5);
    expect(r.toasts.some((t) => /^Winter\./.test(t))).toBe(true);
    r.setDay(SPRING_DAY);
    r.winter.tick(2.5);
    expect(r.winter.goals().find((g) => g.id === 'thaw')?.done).toBe(true);
    const saved = JSON.parse(JSON.stringify(r.winter.toJSON()));
    const again = rig(SPRING_DAY, false);
    again.winter.load(saved);
    expect(again.winter.hard).toBe(true);
    expect(again.winter.goals().find((g) => g.id === 'thaw')?.done).toBe(true);
  });

  it('puts a goal on the HUD only through the first autumn and winter', () => {
    expect(rig(DAYS_PER_SEASON).winter.activeGoal()).toBeNull();
    expect(rig(DAYS_PER_SEASON * 2 + 8).winter.activeGoal()?.id).toBe('stockpile');
    expect(rig(WINTER_DAY, false).winter.activeGoal()).toBeNull();
    expect(rig(SPRING_DAY + 20).winter.activeGoal()).toBeNull();
  });

  it('has no goals or drain on a world that is not hard', () => {
    const r = rig(WINTER_DAY, false);
    expect(r.winter.current()).toBeNull();
    r.winter.tick(2.5);
    expect(r.toasts).toHaveLength(0);
  });
});
