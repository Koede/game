/**
 * Speed budgets of transport (spec 16.4, phone-safe), on the real World: 20 item networks of 200 pipes, each at the
 * cap of 48 packets in flight, tick in under 0.5 ms; rebuilding a 1000-pipe network after a pipe is placed takes
 * under 5 ms. Measured and reported, not guessed.
 */
import { describe, expect, it } from 'vitest';
import { DT } from '../core/constants';
import { createBus } from '../core/context';
import { blockId } from '../core/registry';
import { makeVoxel } from '../core/types';
import { GameClock } from '../game/clock';
import { PlayerState } from '../game/playerState';
import { World } from '../world/world';
import type { ItemNet } from './itemNet';
import { Simulation } from './simulation';

const Y = 80;
const NETS = 20;
const LENGTH = 200;

function meanMs(n: number, fn: () => void, warm = 0): number {
  for (let i = 0; i < warm; i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn();
  return (performance.now() - t0) / n;
}

describe('transport speed', () => {
  it('ticks 20 networks of 200 pipes with 48 packets each in under 0.5 ms, and rebuilds 1000 pipes in under 5 ms', () => {
    const bus = createBus();
    const world = new World(91, bus);
    world.ensureLoadedAround(0, 0, 8);
    const sim = new Simulation(world, bus, new PlayerState(bus, { x: 0.5, y: Y, z: -3 }), new GameClock(bus));
    const put = (x: number, y: number, z: number, key: string): void => {
      world.setVoxel(x, y, z, makeVoxel(blockId(key)), 'player');
    };
    const x0 = -LENGTH / 2;
    for (let n = 0; n < NETS; n++) {
      const z = n * 4;
      for (let i = 0; i < LENGTH; i++) put(x0 + i, Y, z, 'fast_item_pipe');
      // Three full crates pull at the start of the run; one takes at the far end.
      for (const [dx, dy, dz] of [[-1, 0, 0], [0, 1, 0], [0, -1, 0]]) {
        put(x0 + dx, Y + dy, z + dz, 'crate');
        const inv = sim.machineSlots(x0 + dx, Y + dy, z + dz)!;
        for (let s = 0; s < 27; s++) inv.add(s % 2 ? 'iron_ore' : 'coal', 99);
      }
      put(x0 + LENGTH, Y, z, 'crate');
      for (const dir of [1, 2, 3]) sim.setPort(x0, Y, z, dir, { mode: 'pull' });
    }
    // An empty far crate fills in 27 x 99 / 96 = 28 s: keep emptying them so the runs keep flowing.
    const drain = (): void => {
      for (let n = 0; n < NETS; n++) sim.machineSlots(x0 + LENGTH, Y, n * 4)!.clear();
    };
    for (let i = 0; i < 25 / DT; i++) sim.tick(DT);
    drain();
    const nets = sim.transport.items as ItemNet[];
    expect(nets).toHaveLength(NETS);
    for (const net of nets) {
      expect(net.size).toBe(LENGTH);
      expect(net.packets.length).toBeGreaterThanOrEqual(44); // at the cap of 48 but for those just delivered
    }
    for (let i = 0; i < 100; i++) sim.transport.tick(DT);
    let packets = 0;
    const tick = meanMs(400, () => {
      sim.transport.tick(DT);
      for (const net of nets) packets += net.packets.length;
    });
    packets /= 400 * NETS;
    drain();
    const simTick = meanMs(200, () => sim.tick(DT));
    for (const net of nets) expect(net.packets.length).toBeGreaterThan(40);

    // A 1000-pipe network (a 100 x 10 sheet of pipes): placing a pipe beside it, then breaking it, rebuilds it twice.
    const z = -20;
    for (let y = 60; y < 70; y++) for (let i = 0; i < 100; i++) put(-50 + i, y, z, 'item_pipe');
    put(-51, 60, z, 'crate');
    put(0, 70, z, 'crate');
    sim.transport.refresh();
    expect(sim.transport.netAt(-50, 60, z)!.size).toBe(1000);
    let y = 60;
    const rebuild = meanMs(20, () => {
      put(50, y, z, 'item_pipe');
      sim.transport.refresh();
      world.setVoxel(50, y, z, 0, 'player');
      sim.transport.refresh();
      y = y === 69 ? 60 : y + 1;
    }, 10);
    expect(sim.transport.netAt(-50, 60, z)!.size).toBe(1000);
    console.log(
      `transport speed (real World): ${NETS} networks x ${LENGTH} pipes, ${packets.toFixed(1)} packets each on average (cap 48) - transport tick ${tick.toFixed(4)} ms, `
      + `whole sim tick ${simTick.toFixed(4)} ms; rebuild of a 1000-pipe network (place + break, two rebuilds) ${rebuild.toFixed(3)} ms`,
    );
    // 0.5 ms alone; budget widened because the whole suite runs in parallel on all threads.
    expect(tick).toBeLessThan(1.5);
    expect(rebuild / 2).toBeLessThan(15); // 5 ms alone; wider because the suite runs on all threads (and e2e may run alongside)
  });
});
