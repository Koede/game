import { describe, expect, it } from 'vitest';
import { sortPack } from '../game/storage';
import { makeKit } from './testKit';

describe('sim storage network', () => {
  it('labels crates, finds the network within range, sorts a pack into it', () => {
    const kit = makeKit();
    const a = kit.machine('crate', 0, 1, 0);
    const b = kit.machine('crate', 3, 1, 0);
    kit.machine('crate', 40, 1, 0);
    expect(kit.sim.setCrateLabel(3, 1, 0, 'food').ok).toBe(true);
    expect(kit.sim.setCrateLabel(3, 1, 0, 'bogus_label').ok).toBe(false);
    expect(kit.sim.setCrateLabel(9, 9, 9, 'food').ok).toBe(false);
    expect(b.label).toBe('food');
    expect(kit.sim.crateLabel(3, 1, 0)).toBe('food');
    const net = kit.sim.storageNetwork(0, 1, 0);
    expect(net).toHaveLength(2);
    kit.player.inventory.slots[12] = { item: 'bread', count: 4 };
    kit.player.inventory.slots[13] = { item: 'coal', count: 3 };
    sortPack(kit.player.inventory, net, 9);
    expect(b.slots.some((s) => s?.item === 'bread')).toBe(true);
    expect(a.slots.some((s) => s?.item === 'coal')).toBe(true);
    expect(kit.sim.setCrateLabel(3, 1, 0, '').ok).toBe(true);
    expect(b.label).toBeUndefined();
  });
});
