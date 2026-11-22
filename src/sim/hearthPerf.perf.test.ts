/**
 * Speed budgets of multiblock hearths (spec 17.3), on the real World: a full scan of the largest box under 1 ms, and
 * a formed 5x5x5 hearth costing under 0.05 ms per tick once it stands (its furnace's own tick included).
 */
import { describe, expect, it } from 'vitest';
import { DT } from '../core/constants';
import { createBus } from '../core/context';
import { blockId } from '../core/registry';
import { Facing, makeVoxel } from '../core/types';
import { GameClock } from '../game/clock';
import { PlayerState } from '../game/playerState';
import { World } from '../world/world';
import { buildHearth } from './hearthKit';
import { scanHearth } from './hearthScan';
import { Simulation } from './simulation';

const Y = 80;

function meanMs(n: number, fn: () => void): number {
  for (let i = 0; i < 50; i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn();
  return (performance.now() - t0) / n;
}

describe('hearth speed', () => {
  it('scans the largest box in under a millisecond and costs almost nothing once formed', () => {
    const bus = createBus();
    const world = new World(77, bus);
    world.ensureLoadedAround(0, 0, 1);
    const sim = new Simulation(world, bus, new PlayerState(bus, { x: 0.5, y: Y, z: -3 }), new GameClock(bus));
    world.setVoxel(0, Y, 0, makeVoxel(blockId('furnace_star'), Facing.North), 'player');
    buildHearth(world, 0, Y, 0, { tier: 6, inner: [5, 5, 5] });
    sim.validateHearths();
    const e = sim.furnaceAt(0, Y, 0)!;
    expect(e).toMatchObject({ effTier: 6, hearth: { tier: 6, inner: [5, 5, 5], closed: true } });
    e.fuel[0] = { item: 'coal', count: 99 };
    sim.light(0, Y, 0);

    const scan = meanMs(300, () => scanHearth(world, 0, Y, 0, Facing.North));
    for (let i = 0; i < 200; i++) sim.tick(DT);
    const tick = meanMs(4000, () => sim.tick(DT));
    console.log(`hearth speed (real World): full scan of a 7x7x7 box ${scan.toFixed(4)} ms; tick with a formed 5x5x5 hearth ${tick.toFixed(4)} ms`);
    expect(scan).toBeLessThan(1);
    expect(tick).toBeLessThan(0.05);
    expect(e.hearth?.tier).toBe(6);
  });
});
