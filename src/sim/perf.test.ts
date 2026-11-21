/**
 * Speed budget (spec 7.1): 300 entities tick in under 1 ms. Measured on a base that uses every kind of work at
 * once - electric furnaces, heat engines, busy processors pushing into crates, fuel generators, batteries,
 * ambient generators and consumers on cabled networks - and reported, not guessed.
 */
import { describe, expect, it } from 'vitest';
import { DT } from '../core/constants';
import { makeKit, type Kit } from './testKit';

const GROUPS = 30;

/**
 * Ten entities on one cabled network, 8 blocks apart from the next group. The arc furnace stands in its smallest
 * hearth (x - 1 .. x + 1, z .. z + 2); the thermopile sits at its mouth and carries the grid to it.
 */
function group(kit: Kit, gx: number, gz: number): void {
  const x = gx * 8;
  const z = gz * 8;
  const w = kit.world;
  const furnace = kit.furnace(x, 5, z, 'furnace_arc');
  kit.formed(x, 5, z);
  furnace.fuel[0] = { item: 'coal', count: 99 };
  kit.sim.light(x, 5, z);
  kit.machine('thermopile', x, 5, z - 1);
  kit.machine('lamp', x + 1, 5, z - 1);
  w.put(x + 2, 5, z - 1, 'copper_cable');
  for (let i = 2; i <= 5; i++) w.put(x + i, 5, z, 'copper_cable');
  const crusher = kit.machine('crusher', x + 6, 5, z);
  crusher.slots[0] = { item: 'copper_ore', count: 99 };
  kit.machine('crate', x + 6, 5, z + 1);
  const burner = kit.machine('burner_generator', x + 3, 5, z - 1);
  burner.slots[0] = { item: 'coal', count: 99 };
  kit.machine('battery', x + 4, 5, z - 1);
  kit.machine('solar_panel', x + 5, 5, z - 1);
  w.put(x + 3, 5, z + 2, 'water');
  w.put(x + 3, 4, z + 1, 'water');
  kit.machine('water_wheel', x + 3, 5, z + 1);
  w.put(x + 4, 4, z + 1, 'lava');
  kit.machine('geothermal_tap', x + 4, 5, z + 1);
}

/** Mean milliseconds per call of `fn` over `n` calls, in batches of 100; returns the mean and the median batch. */
function measure(n: number, fn: (i: number) => void): { mean: number; median: number } {
  const batches: number[] = [];
  let i = 0;
  const t0 = performance.now();
  while (i < n) {
    const b0 = performance.now();
    for (let k = 0; k < 100; k++) fn(i++);
    batches.push((performance.now() - b0) / 100);
  }
  const mean = (performance.now() - t0) / n;
  batches.sort((a, b) => a - b);
  return { mean, median: batches[batches.length >> 1] };
}

describe('speed', () => {
  it('ticks a 300-entity base in well under a millisecond', () => {
    const kit = makeKit();
    for (let g = 0; g < GROUPS; g++) group(kit, g % 6, Math.floor(g / 6));
    expect(kit.sim.entityCount).toBe(300);
    kit.run(5);
    expect(kit.sim.allNetworks()).toHaveLength(GROUPS);
    expect(kit.sim.grid().generationW).toBeGreaterThan(GROUPS * 5000);

    const tick = measure(2000, () => kit.sim.tick(DT));
    // A block placed and removed beside a machine every tick: the refresh of its surroundings is included.
    const edit = measure(400, (i) => {
      kit.world.put(8 * (i % 6) + 6, 6, 0, i % 2 === 0 ? 'stone' : 'air');
      kit.sim.tick(DT);
    });
    // A cable added and removed every tick: networks are rebuilt each time (the worst case, a player-paced event).
    const cable = measure(200, (i) => {
      kit.world.put(5, 6, 0, i % 2 === 0 ? 'copper_cable' : 'air');
      kit.sim.tick(DT);
    });
    console.log(
      `sim speed, 300 entities: tick mean ${tick.mean.toFixed(4)} ms (median batch ${tick.median.toFixed(4)}); ` +
        `tick + nearby block edit ${edit.mean.toFixed(4)} ms; tick + cable edit ${cable.mean.toFixed(4)} ms`,
    );
    // The base was really working while it was timed.
    let crushed = 0;
    let running = 0;
    for (const e of kit.world.entities()) {
      if (e.kind === 'crate') crushed += (e.slots as Array<{ item: string; count: number } | null>).reduce((n, st) => n + (st?.item === 'crushed_copper' ? st.count : 0), 0);
      const m = kit.sim.machineView(e.x, e.y, e.z);
      if (m?.running) running++;
    }
    expect(crushed).toBeGreaterThan(GROUPS * 40);
    expect(running).toBeGreaterThan(GROUPS * 6);
    // Above the coal flame (1250 C): electric heat is doing its part.
    expect(kit.sim.maxFurnaceTempC()).toBeGreaterThan(1260);
    expect(tick.mean).toBeLessThan(1);
    expect(edit.mean).toBeLessThan(1);
    expect(cable.mean).toBeLessThan(5);
  });
});
