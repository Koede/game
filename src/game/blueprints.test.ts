import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { itemOrNull } from '../core/registry';
import { makeKit } from '../sim/testKit';
import { BUILD_INTERVAL_S } from './blueprint';
import { BLUEPRINT_MAX_SIDE, BLUEPRINT_TOOL, Blueprints, NetworkSource, edgeCells, siteGhost } from './blueprints';
import { FakeWorld } from './fakeWorld';
import { Inventory } from './inventory';

const SQUARE = { item: BLUEPRINT_TOOL };
const tap = (x: number, y: number, z: number) => ({ x, y, z, px: x, py: y + 1, pz: z });

/** A 3x2x3 hut: a plank floor and a stone strip on top. */
function hut(w: FakeWorld, x = 0, z = 0): void {
  w.fill(x, 5, z, x + 2, 5, z + 2, 'plank');
  w.fill(x, 6, z, x + 2, 6, z, 'stone');
}

describe('blueprint tool', () => {
  it('is a craftable item', () => {
    expect(itemOrNull(BLUEPRINT_TOOL)?.name).toBe("Builder's Square");
  });

  it('captures a box from two taps, outlines it and lists its materials', () => {
    const w = new FakeWorld(createBus());
    hut(w);
    const bp = new Blueprints(createBus(), () => []);
    expect(bp.use(tap(0, 5, 0), { item: 'stick' })).toBeNull();
    expect(bp.use(tap(0, 5, 0), SQUARE)).toBe('worked');
    expect(bp.outline()).toEqual({ lo: [0, 5, 0], hi: [0, 5, 0] });
    expect(bp.use(tap(2, 6, 2), SQUARE)).toBe('worked');
    expect(bp.boxSize()).toEqual([3, 2, 3]);
    expect(bp.outline()).toEqual({ lo: [0, 5, 0], hi: [2, 6, 2] });
    expect(edgeCells([0, 5, 0], [2, 6, 2], 'glass')).toHaveLength(16);
    expect(bp.materials(w)).toEqual([{ item: 'plank', count: 9 }, { item: 'stone', count: 3 }]);
    const r = bp.confirm(w);
    expect(r.ok).toBe(true);
    expect(r.text).toContain('9 Planks');
    expect(bp.saved).toHaveLength(1);
    expect(bp.current?.cells).toHaveLength(12);
    expect(bp.cornerA).toBeNull();
    // Too big a box is refused at the second tap.
    bp.tap(tap(0, 0, 0));
    expect(bp.tap(tap(BLUEPRINT_MAX_SIDE, 0, 0)).ok).toBe(false);
    expect(bp.cornerB).toBeNull();
    // An empty box saves nothing.
    bp.tap(tap(50, 50, 50));
    bp.tap(tap(51, 51, 51));
    expect(bp.confirm(w).ok).toBe(false);
  });

  it('places a copy: the ghost shows the site and Raise needs a chest near it', () => {
    const w = new FakeWorld(createBus());
    hut(w);
    const bp = new Blueprints(createBus(), () => []);
    bp.tap(tap(0, 5, 0));
    bp.tap(tap(2, 6, 2));
    bp.confirm(w);
    bp.setMode('place');
    bp.tap({ x: 10, y: 4, z: 10, px: 10, py: 5, pz: 10 });
    expect(bp.origin).toEqual([10, 5, 10]);
    expect(bp.outline()).toEqual({ lo: [10, 5, 10], hi: [12, 6, 12] });
    w.put(10, 5, 10, 'dirt');
    const ghost = siteGhost(w, bp.current!, bp.origin!);
    expect(ghost).toHaveLength(12);
    expect(ghost.filter((g) => g.state === 'wrong')).toHaveLength(1);
    const r = bp.confirm(w);
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/chest/);
    expect(bp.sites).toHaveLength(0);
  });

  it('a network source takes from the first chest, then the rest', () => {
    const a = new Inventory(4);
    const b = new Inventory(4);
    a.add('plank', 2);
    b.add('plank', 5);
    const src = new NetworkSource(() => [{ id: 'a', label: '', inv: a }, { id: 'b', label: 'blocks', inv: b }]);
    expect(src.count('plank')).toBe(7);
    expect(src.remove('plank', 4)).toBe(4);
    expect(a.count('plank')).toBe(0);
    expect(b.count('plank')).toBe(3);
    expect(src.add('plank', 1)).toBe(0);
    expect(a.count('plank')).toBe(1);
  });

  it('a builder raises it from the chest by the site and the storage network behind it', () => {
    const kit = makeKit();
    hut(kit.world, 0, 40);
    // The site's chest holds the planks; the stone is in a chest 10 blocks past it, out of reach of the site itself.
    kit.machine('crate', 20, 1, 0);
    kit.machine('crate', 10, 1, 0);
    kit.sim.machineSlots(20, 1, 0)!.add('plank', 9);
    kit.sim.machineSlots(10, 1, 0)!.add('stone', 2);
    const toasts = kit.record('toast');
    const bp = new Blueprints(kit.bus, (x, y, z) => kit.sim.storageNetwork(x, y, z));
    bp.tap(tap(0, 5, 40));
    bp.tap(tap(2, 6, 42));
    expect(bp.confirm(kit.world).ok).toBe(true);
    bp.setMode('place');
    bp.tap({ x: 25, y: 0, z: 0, px: 25, py: 1, pz: 0 });
    expect(kit.sim.storageNetwork(25, 1, 0).map((c) => c.id)).toEqual(['20,1,0']);
    const r = bp.confirm(kit.world);
    expect(r.ok).toBe(true);
    expect(bp.sites[0].chest).toEqual([20, 1, 0]);
    for (let i = 0; i < 40; i++) bp.tick(BUILD_INTERVAL_S, kit.world);
    // Two stone of three: the build waits and says what for.
    expect(bp.sites[0].job.state).toBe('waiting');
    expect(bp.sites[0].job.missing).toBe('stone');
    expect(toasts.some((t) => /waits for Stone/.test(t.text))).toBe(true);
    expect(kit.world.getBlock(25, 1, 0).key).toBe('plank');
    expect(kit.sim.machineSlots(20, 1, 0)!.count('plank')).toBe(0);
    expect(kit.sim.machineSlots(10, 1, 0)!.count('stone')).toBe(0);
    // Restocking the far chest lets it finish after the retry.
    kit.sim.machineSlots(10, 1, 0)!.add('stone', 1);
    for (let i = 0; i < 20; i++) bp.tick(BUILD_INTERVAL_S, kit.world);
    expect(bp.sites).toHaveLength(0);
    expect(kit.world.getBlock(27, 2, 0).key).toBe('stone');
    expect(toasts.some((t) => /is built/.test(t.text))).toBe(true);
  });

  it('saves and loads blueprints and builds under way', () => {
    const w = new FakeWorld(createBus());
    hut(w);
    const chest = new Inventory(8);
    chest.add('plank', 3);
    const near = () => [{ id: '5,5,5', label: '', inv: chest }];
    const bp = new Blueprints(createBus(), near);
    bp.tap(tap(0, 5, 0));
    bp.tap(tap(2, 6, 2));
    bp.save(w, 'Hut');
    bp.tap(tap(0, 5, 0));
    bp.tap(tap(2, 5, 2));
    bp.save(w);
    bp.setMode('place');
    bp.cycle();
    expect(bp.current?.name).toBe('Hut');
    bp.tap({ x: 10, y: 4, z: 10, px: 10, py: 5, pz: 10 });
    expect(bp.confirm(w).ok).toBe(true);
    bp.tick(BUILD_INTERVAL_S * 2, w);
    const raw = JSON.parse(JSON.stringify(bp.toJSON()));
    const back = new Blueprints(createBus(), near);
    back.load(raw);
    expect(back.saved.map((b) => b.name)).toEqual(['Hut', 'Blueprint 2']);
    expect(back.selected).toBe(0);
    expect(back.sites).toHaveLength(1);
    expect(back.sites[0].chest).toEqual([5, 5, 5]);
    expect(back.sites[0].job.placed).toBe(bp.sites[0].job.placed);
    expect(back.sites[0].job.origin).toEqual([10, 5, 10]);
    expect(JSON.stringify(back.toJSON())).toBe(JSON.stringify(raw));
    // Junk loads as empty.
    back.load({ saved: [{ name: 'x', cells: 'no' }], sites: [null], selected: 9 });
    expect(back.saved).toHaveLength(0);
    expect(back.sites).toHaveLength(0);
    back.load(null);
    expect(back.selected).toBe(0);
  });
});
