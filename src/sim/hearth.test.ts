import { describe, expect, it } from 'vitest';
import { DT, HEARTH_RESCAN_S } from '../core/constants';
import { hearthCrucibles, hearthScale } from '../core/hearth';
import { blockId, blockOf, furnaceTier } from '../core/registry';
import { makeVoxel, voxelActive, type Voxel } from '../core/types';
import type { FakeWorld } from '../game/fakeWorld';
import { boxCells, buildHearth } from './hearthKit';
import { CellRole, structureOf } from './hearthScan';
import { fire, makeKit, type Kit } from './testKit';

/** The fake world's voxel map, to change blocks without telling anyone (as a missed event would). */
const voxels = (w: FakeWorld): Map<string, Voxel> => (w as unknown as { voxels: Map<string, Voxel> }).voxels;

/** A furnace at 0, 1, 0 (facing north: its hearth lies towards +z) with a hearth of `tier` built around it. */
function hearthKit(block: string, tier: number, inner?: [number, number, number]): Kit {
  const kit = makeKit();
  kit.furnace(0, 1, 0, block);
  buildHearth(kit.world, 0, 1, 0, { tier, inner });
  kit.sim.validateHearths();
  return kit;
}

const furnace = (kit: Kit) => kit.sim.furnaceAt(0, 1, 0)!;
const scansOf = (kit: Kit): number => (kit.sim as unknown as { hearths: { get(k: string): { scans: number } } }).hearths.get('0,1,0').scans;

describe('forming and coming apart', () => {
  it('forms a Blast hearth: event, sound, toast, active shell, more crucibles', () => {
    const kit = makeKit();
    const formed = kit.record('hearth:formed');
    const toasts = kit.record('toast');
    const sfx = kit.record('sfx');
    const e = kit.furnace(0, 1, 0, 'furnace_blast');
    kit.run(0.5);
    expect(e).toMatchObject({ effTier: 2, hearth: null });
    expect(e.crucibleIn).toHaveLength(furnaceTier(2).crucibles); // alone it runs on the Bronze Furnace's two crucibles
    const box = buildHearth(kit.world, 0, 1, 0, { tier: 3 });
    expect(formed).toEqual([]);
    kit.run(DT);
    expect(formed).toEqual([{ x: 0, y: 1, z: 0, tier: 3, min: [-1, 0, 0], max: [1, 1, 2] }]);
    expect(toasts.map((t) => t.text)).toContain('Blast hearth formed');
    expect(sfx).toContainEqual({ name: 'hearth_formed', x: 0, y: 1, z: 0 });
    expect(e).toMatchObject({ effTier: 3, hearth: { tier: 3, inner: [1, 1, 1], closed: false, windows: 0 } });
    expect(e.crucibleIn).toHaveLength(hearthCrucibles(structureOf(3), [1, 1, 1]));
    for (const c of boxCells(box)) {
      if (c.role === CellRole.Interior) continue;
      const v = kit.world.getVoxel(c.x, c.y, c.z);
      // Every shell block glows; the furnace's own bit still means "hot".
      expect(voxelActive(v), `${c.x},${c.y},${c.z}`).toBe(c.role !== CellRole.Controller);
    }
    kit.run(10);
    expect(formed).toHaveLength(1); // announced once
  });

  it('comes apart when a wall goes: nothing is destroyed, locked crucibles keep their contents', () => {
    const kit = hearthKit('furnace_blast', 3, [3, 3, 1]);
    const e = furnace(kit);
    expect(e.crucibleIn).toHaveLength(5);
    const unformed = kit.record('hearth:unformed');
    const toasts = kit.record('toast');
    fire(kit, e, 'charcoal', 20);
    for (let i = 0; i < 5; i++) e.crucibleIn[i] = { item: 'copper_ore', count: 3 };
    e.crucibleOut[4] = { item: 'copper_ingot', count: 2 };
    kit.run(30);
    kit.world.put(1, 1, 4, 'air'); // back wall
    kit.run(DT);
    expect(unformed).toEqual([{ x: 0, y: 1, z: 0 }]);
    expect(toasts.map((t) => t.text)).toContain('The Blast hearth came apart - wall has a gap');
    expect(e).toMatchObject({ hearth: null, effTier: 2 });
    expect(e.crucibleIn).toHaveLength(5);
    expect(voxelActive(kit.world.getVoxel(-1, 1, 4))).toBe(false);
    const before = e.crucibleIn.map((s) => s?.count ?? 0);
    kit.run(60);
    // Only the Bronze Furnace's two crucibles work on; the rest hold still and keep what they hold.
    expect(e.crucibleIn.slice(2).map((s) => s?.count ?? 0)).toEqual(before.slice(2));
    const view = kit.sim.furnaceView(0, 1, 0)!;
    expect(view.cruciblesActive).toBe(2);
    expect(view.crucibles.map((c) => c.locked)).toEqual([false, false, true, true, true]);
    expect(view.crucibles[4].status).toBe('Locked - take it out');
    const slots = kit.sim.furnaceSlots(0, 1, 0)!;
    expect(slots.crucibleIn.accepts('copper_ore', 3)).toBe(false);
    expect(slots.crucibleIn.removeAt(3)).toEqual({ item: 'copper_ore', count: 3 });
    expect(slots.crucibleOut.removeAt(4)).toEqual({ item: 'copper_ingot', count: 2 });
    // Built back: it forms again and the crucibles open.
    kit.world.put(1, 1, 4, 'brick');
    kit.run(DT);
    expect(e.hearth?.tier).toBe(3);
    expect(slots.crucibleIn.accepts('copper_ore', 3)).toBe(true);
  });

  it('breaking the furnace takes the hearth down quietly', () => {
    const kit = hearthKit('furnace_blast', 3);
    const unformed = kit.record('hearth:unformed');
    const toasts = kit.record('toast');
    kit.world.put(0, 1, 0, 'air');
    expect(unformed).toEqual([{ x: 0, y: 1, z: 0 }]);
    expect(toasts.filter((t) => /came apart/.test(t.text))).toEqual([]);
    expect(voxelActive(kit.world.getVoxel(1, 1, 1))).toBe(false);
  });

  it('cools down by itself when its hearth comes apart above the new maximum', () => {
    const kit = hearthKit('furnace_blast', 3);
    const e = furnace(kit);
    fire(kit, e, 'coal', 50);
    kit.run(200);
    expect(e.tempC).toBeCloseTo(1250, 0);
    kit.world.put(1, 1, 2, 'air');
    kit.run(DT);
    expect(e.tempC).toBeGreaterThan(1240);
    kit.run(60);
    expect(e.tempC).toBeLessThan(1240);
    expect(e.tempC).toBeGreaterThanOrEqual(furnaceTier(2).maxTempC);
    kit.run(600);
    expect(e.tempC).toBeCloseTo(furnaceTier(2).maxTempC, 5);
  });
});

describe('effective tier and grants', () => {
  it('runs at min(its tier, the hearth tier), and alone at most as the Bronze Furnace', () => {
    expect(furnace(hearthKit('furnace_clay', 3))).toMatchObject({ tier: 1, effTier: 1, hearth: { tier: 3 } });
    expect(furnace(hearthKit('furnace_arc', 3))).toMatchObject({ tier: 4, effTier: 3 });
    expect(furnace(hearthKit('furnace_blast', 4))).toMatchObject({ tier: 3, effTier: 3, hearth: { tier: 4 } });
    expect(furnace(hearthKit('furnace_arc', 4))).toMatchObject({ tier: 4, effTier: 4 });
    const kit = makeKit();
    expect(kit.furnace(0, 1, 0, 'furnace_star')).toMatchObject({ tier: 6, effTier: 2 });
    const view = kit.sim.furnaceView(0, 1, 0)!;
    expect(view).toMatchObject({ effectiveTier: 2, maxTempC: 1100, hearth: { formed: false, text: 'Not formed' } });
    expect(view.status).toBe('No Starhearth formed - it runs like a Bronze Furnace');
  });

  it('scales heat capacity, loss, fire and heater with the inside; windows lose double', () => {
    const kit = hearthKit('furnace_arc', 4, [3, 2, 2]);
    const e = furnace(kit);
    const spec = furnaceTier(4);
    const scale = hearthScale([3, 2, 2], { closed: true, windows: 0, tuyeres: 0 });
    expect(e.hearth).toMatchObject({ tier: 4, inner: [3, 2, 2], closed: true });
    const view = kit.sim.furnaceView(0, 1, 0)!;
    expect(view.cruciblesActive).toBe(hearthCrucibles(structureOf(4), [3, 2, 2]));
    expect(view.electric.maxW).toBeCloseTo(spec.electricHeatW * scale.loss);
    expect(view.hearth).toMatchObject({ formed: true, tier: 4, name: 'Arc hearth', text: 'Formed - Arc hearth 3x2x2' });
    // Cooling from 1000 C over one tick shows the loss and the heat capacity.
    e.tempC = 1000;
    kit.run(DT);
    expect(e.tempC).toBeCloseTo(1000 - (spec.lossWPerC * scale.loss * 980 * DT) / (spec.heatCapacityJ * scale.heatCapacity), 6);
    kit.world.put(1, 2, 3, 'glass'); // a window in the back wall
    kit.run(DT);
    expect(e.hearth?.windows).toBe(1);
    const windowed = hearthScale([3, 2, 2], { closed: true, windows: 1, tuyeres: 0 });
    expect(windowed.loss - scale.loss).toBeCloseTo(1 / 26);
    e.tempC = 1000;
    kit.run(DT);
    expect(e.tempC).toBeCloseTo(1000 - (spec.lossWPerC * windowed.loss * 980 * DT) / (spec.heatCapacityJ * windowed.heatCapacity), 6);
  });

  it('a bigger hearth reaches the same flame on fuel, burning it faster', () => {
    const small = hearthKit('furnace_blast', 3, [1, 1, 1]);
    const big = hearthKit('furnace_blast', 3, [3, 3, 2]);
    for (const kit of [small, big]) fire(kit, furnace(kit), 'coal', 99);
    small.run(600);
    big.run(600);
    expect(furnace(small).tempC).toBeCloseTo(1250, 0);
    expect(furnace(big).tempC).toBeCloseTo(1250, 0);
    const left = (kit: Kit): number => kit.sim.furnaceView(0, 1, 0)!.burnTimeLeftS;
    expect(left(big)).toBeLessThan(left(small) / 2);
  });

  it('smelts faster in a bigger hearth, and faster still with powered tuyeres', () => {
    const time = (inner: [number, number, number], blower: boolean): number => {
      const kit = hearthKit('furnace_blast', 3, inner);
      if (blower) {
        kit.machine('blower', -1, 1, 1); // in the west wall face
        kit.machine('burner_generator', -2, 1, 1).slots[0] = { item: 'coal', count: 20 };
      }
      const e = furnace(kit);
      e.tempC = 1000;
      fire(kit, e, 'coal', 99);
      kit.run(1);
      e.crucibleIn[0] = { item: 'copper_ore', count: 10 };
      let t = 0;
      while (e.crucibleIn[0] && t < 200) {
        kit.run(0.25);
        t += 0.25;
      }
      if (blower) expect(kit.sim.furnaceView(0, 1, 0)!.hearth).toMatchObject({ blowers: 1, tuyeres: 1 });
      return t;
    };
    const plain = time([1, 1, 1], false);
    const bigger = time([2, 1, 1], false);
    const blown = time([1, 1, 1], true);
    expect(bigger / plain).toBeCloseTo(1 / 1.1, 1);
    expect(blown / plain).toBeCloseTo(1 / 1.25, 1);
  });
});

describe('when it scans', () => {
  it('scans on the tick after a change in reach, and not otherwise', () => {
    const kit = hearthKit('furnace_blast', 3);
    const n = scansOf(kit);
    kit.run(5);
    expect(scansOf(kit)).toBe(n);
    kit.world.put(10, 1, 10, 'stone'); // far away
    kit.run(DT);
    expect(scansOf(kit)).toBe(n);
    kit.world.put(2, 1, 1, 'stone'); // touching the shell
    expect(scansOf(kit)).toBe(n);
    kit.run(DT);
    expect(scansOf(kit)).toBe(n + 1);
  });

  it('retries an unformed hearth every second only near the player or with its screen open', () => {
    const kit = makeKit();
    kit.furnace(0, 1, 0, 'furnace_blast');
    buildHearth(kit.world, 0, 1, 0, { tier: 3 });
    kit.world.put(1, 1, 2, 'air');
    kit.run(DT);
    expect(furnace(kit).hearth).toBeNull();
    voxels(kit.world).set('1,1,2', makeVoxel(blockId('brick'))); // placed without a block event
    kit.player.position.x = 40;
    kit.run(3);
    expect(furnace(kit).hearth).toBeNull();
    kit.bus.emit('ui:opened', { screen: { type: 'furnace', x: 0, y: 1, z: 0 } });
    kit.run(HEARTH_RESCAN_S + DT);
    expect(furnace(kit).hearth?.tier).toBe(3);

    kit.bus.emit('ui:closed', {});
    voxels(kit.world).delete('1,1,2');
    kit.world.put(-1, 1, 1, 'air'); // now unformed for good
    kit.run(DT);
    voxels(kit.world).set('-1,1,1', makeVoxel(blockId('brick')));
    const n = scansOf(kit);
    kit.run(3);
    expect(scansOf(kit)).toBe(n);
    kit.player.position.x = 3;
    kit.run(HEARTH_RESCAN_S + DT);
    expect(scansOf(kit)).toBeGreaterThan(n);
  });

  it('a formed hearth sweeps its cells and notices a change it was never told about', () => {
    const kit = hearthKit('furnace_blast', 3, [2, 2, 2]);
    expect(furnace(kit).hearth).not.toBeNull();
    voxels(kit.world).delete('-1,2,3');
    kit.run(0.5);
    const cells = 4 * 4 * 3;
    kit.run((cells * 4 + 1) * DT);
    expect(furnace(kit).hearth).toBeNull();
  });
});

describe('upgrades and ignition need their hearth', () => {
  it('the upgrade waits for the next tier hearth, with the reason', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_bronze');
    kit.player.give('bronze_ingot', 4);
    kit.player.give('bellows', 1);
    e.tempC = 750;
    const hint = 'Build a Blast hearth: brick walls around the furnace';
    expect(kit.sim.upgrade(0, 1, 0)).toEqual({ ok: false, reason: hint });
    expect(kit.sim.furnaceView(0, 1, 0)!.upgrade).toMatchObject({ ok: false, structureOk: false, structure: hint, reason: hint });
    buildHearth(kit.world, 0, 1, 0, { tier: 3 });
    expect(kit.sim.furnaceView(0, 1, 0)!.upgrade).toMatchObject({ ok: true, structureOk: true, structure: null, reason: null });
    expect(kit.sim.upgrade(0, 1, 0)).toEqual({ ok: true });
    kit.run(DT);
    expect(e).toMatchObject({ tier: 3, effTier: 3 });
    expect(kit.sim.furnaceView(0, 1, 0)!.upgrade).toMatchObject({
      structureOk: false, structure: 'Build an Arc hearth: refractory brick walls around the furnace, a ceiling and 1 Arc Electrode',
    });
    expect(kit.sim.structureView(0, 1, 0)!.target.tier).toBe(4);
  });

  it('recipes above the hearth tier say what to build', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_arc');
    e.tempC = 1400;
    kit.player.give('iron_ingot', 4);
    const row = kit.sim.furnaceView(0, 1, 0)!.forge.find((r) => r.recipe.id === 'iron_plate')!;
    expect(row).toMatchObject({ locked: true, reason: 'Needs a formed Blast hearth' });
    expect(kit.sim.forge(0, 1, 0, 'iron_plate')).toEqual({ ok: false, reason: 'Needs a formed Blast hearth' });
  });

  it('ignition needs a formed Starhearth', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_star');
    e.tempC = 3100;
    expect(kit.sim.startIgnition(0, 1, 0)).toEqual({
      ok: false, reason: 'Build a Starhearth: star casing walls around the furnace, a ceiling and 4 Power Ports',
    });
  });
});

describe('the shell stands for the furnace', () => {
  it('power ports carry the grid to the controller', () => {
    const kit = hearthKit('furnace_plasma', 5);
    const e = furnace(kit);
    // The ports stand in the back wall (0, 1, 3 and 1, 1, 3); a generator touching one feeds the furnace through it.
    expect(blockOf(kit.world.getVoxel(0, 1, 3)).key).toBe('power_port');
    const gen = kit.machine('burner_generator', 0, 1, 4);
    gen.slots[0] = { item: 'coal', count: 30 };
    e.tempC = 1000;
    kit.run(1);
    const net = kit.sim.networkAt(0, 1, 0)!;
    expect(net.id).toBe(kit.sim.machineView(0, 1, 4)!.network);
    expect(e.deliveredW).toBeGreaterThan(2000);
    // Broken open, the hearth no longer links them.
    kit.world.put(-1, 3, 1, 'air');
    kit.run(DT);
    expect(kit.sim.networkAt(0, 1, 0)!.id).not.toBe(kit.sim.machineView(0, 1, 4)!.network);
  });

  it('a steam engine on the ceiling and a thermopile on a wall work the furnace', () => {
    const kit = hearthKit('furnace_blast', 4);
    const e = furnace(kit);
    fire(kit, e, 'coal', 99);
    kit.run(300);
    const pile = kit.machine('thermopile', 2, 1, 1);
    const engine = kit.machine('steam_engine', 0, 3, 1);
    kit.world.put(1, 3, 1, 'water');
    kit.machine('lamp', 3, 1, 1);
    kit.machine('lamp', 0, 4, 1);
    kit.run(1);
    expect(kit.sim.machineView(2, 1, 1)!.problem).toBeNull();
    expect(kit.sim.machineView(0, 3, 1)!.problem).toBeNull();
    expect(pile.availW).toBeGreaterThan(200);
    expect(engine.availW).toBeGreaterThan(1500);
    expect(e.extractW).toBeGreaterThan(0);
  });
});

describe('saving', () => {
  it('a formed hearth loads formed, quietly, and is checked again', () => {
    const a = hearthKit('furnace_blast', 3, [2, 2, 1]);
    const e = furnace(a);
    fire(a, e, 'coal', 40);
    a.run(30);
    const load = (change?: (w: FakeWorld) => void): Kit => {
      const b = makeKit();
      for (const [k, v] of voxels(a.world)) voxels(b.world).set(k, v);
      for (const ent of a.world.entities()) b.world.setEntity(JSON.parse(JSON.stringify(ent)));
      change?.(b.world);
      b.sim.resync();
      return b;
    };
    const b = load();
    const events = [b.record('hearth:formed'), b.record('hearth:unformed'), b.record('toast')];
    expect(furnace(b)).toMatchObject({ effTier: 3, hearth: { tier: 3, inner: [2, 2, 1] } });
    a.run(60);
    b.run(60);
    expect(events.flat()).toEqual([]);
    expect(JSON.parse(JSON.stringify(furnace(b)))).toEqual(JSON.parse(JSON.stringify(e)));

    const c = load((w) => voxels(w).delete('-1,1,3'));
    const gone = c.record('hearth:unformed');
    c.run(DT);
    expect(gone).toEqual([{ x: 0, y: 1, z: 0 }]);
    expect(furnace(c)).toMatchObject({ hearth: null, effTier: 2 });
  });
});

describe('furnace odds and ends', () => {
  it('a burned lava bucket leaves its bronze bucket in the firebox', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_bronze');
    e.fuel[0] = { item: 'lava_bucket', count: 1 };
    expect(kit.sim.light(0, 1, 0)).toEqual({ ok: true });
    expect(e.fuel[0]).toEqual({ item: 'bronze_bucket', count: 1 });
    expect(e.burnItem).toBe('lava_bucket');
    kit.run(30);
    expect(e.tempC).toBeGreaterThan(700);
  });

  it('heat engines take heat for the power used, not the power they could make', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_bronze');
    fire(kit, e, 'charcoal', 99);
    kit.run(120);
    kit.machine('thermopile', 1, 1, 0);
    kit.run(1);
    expect(kit.sim.machineView(1, 1, 0)!.availW).toBeGreaterThan(150);
    expect(e.extractW).toBe(0); // nothing on the grid uses it
    kit.machine('lamp', 2, 1, 0);
    kit.run(1);
    expect(e.extractW).toBeCloseTo(4 * 10, 6); // a 10 W lamp, at 4 J of heat per J
  });
});
