import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { FLAG_FELLED_TREE } from '../core/constants';
import { itemOrNull } from '../core/registry';
import { AIR } from '../core/types';
import { SAW_CANISTER_FUEL, SAW_FUEL_PER_LOG, SAW_MAX_LOGS, SAW_TANK } from '../content/itemsVehicle';
import { FakeWorld } from './fakeWorld';
import { canFell, fellTree, isChainsaw, refuelChainsaw, sawCapacity, sawFuel, trunkAbove } from './felling';
import { miningTime, toolMatches } from './mining';
import { PlayerState } from './playerState';
import { block } from '../core/registry';

const rng = (): number => 0.5;

function rig(fuel: number = SAW_TANK) {
  const bus = createBus();
  const world = new FakeWorld(bus);
  world.fill(-6, 9, -6, 6, 9, 6, 'grass');
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 8.5 });
  const flags: string[] = [];
  const sfx: string[] = [];
  const broken: number[] = [];
  const toasts: string[] = [];
  bus.on('flag', (e) => flags.push(e.flag));
  bus.on('sfx', (e) => sfx.push(e.name));
  bus.on('block:broken', (e) => broken.push(e.y));
  bus.on('toast', (e) => toasts.push(e.text));
  player.inventory.set(player.selectedSlot, { item: 'chainsaw', count: 1, durability: fuel + 1 });
  const saw = () => player.inventory.get(player.selectedSlot)!;
  const count = (item: string): number => player.ground.count(item);
  const trunk = (x: number, z: number, h: number, key = 'oak_log') => world.fill(x, 10, z, x, 9 + h, z, key);
  return { bus, world, player, flags, sfx, broken, toasts, saw, count, trunk };
}

describe('the chainsaw item', () => {
  it('is an age-2 (Current) axe-kind tool whose durability is its tank, with felling numbers', () => {
    const def = itemOrNull('chainsaw')!;
    expect(def.age).toBe(2);
    expect(def.tool?.kind).toBe('axe');
    expect(def.tool?.fell).toEqual({ maxLogs: SAW_MAX_LOGS, fuelPerLog: SAW_FUEL_PER_LOG, canisterFuel: SAW_CANISTER_FUEL });
    expect(def.tool?.durability).toBe(SAW_TANK + 1);
    expect(isChainsaw({ item: 'chainsaw', count: 1, durability: 5 })).toBe(true);
    expect(isChainsaw({ item: 'iron_axe', count: 1, durability: 5 })).toBe(false);
  });

  it('cuts logs several times faster than the best hand axe and counts as bare hands when empty', () => {
    const log = block('oak_log');
    const full = { item: 'chainsaw', count: 1, durability: SAW_TANK + 1 };
    const steel = { item: 'steel_axe', count: 1, durability: 700 };
    expect(miningTime(log, full, false)).toBeLessThan(miningTime(log, steel, false) / 1.4);
    const empty = { item: 'chainsaw', count: 1, durability: 1 };
    expect(toolMatches(log, empty)).toBe(false);
    expect(miningTime(log, empty, false)).toBeCloseTo(log.hardness);
    expect(canFell(empty)).toBe(false);
  });
});

describe('felling', () => {
  it('takes a whole straight trunk and gives every log', () => {
    const t = rig();
    t.trunk(0, 0, 6);
    const r = fellTree(t.world, t.player, 0, 10, 0, rng)!;
    expect(r.logs).toBe(6);
    for (let y = 10; y <= 15; y++) expect(t.world.getVoxel(0, y, 0)).toBe(AIR);
    expect(t.count('oak_log')).toBe(6);
    expect(t.broken).toHaveLength(6);
    expect(t.sfx).toContain('saw_cut');
    expect(t.sfx).toContain('tree_fall');
    expect(t.flags).toContain(FLAG_FELLED_TREE);
  });

  it('cutting the middle of a trunk leaves the stump below and takes the part above', () => {
    const t = rig();
    t.trunk(0, 0, 6);
    const r = fellTree(t.world, t.player, 0, 13, 0, rng)!;
    expect(r.logs).toBe(3);
    expect(t.world.getBlock(0, 12, 0).key).toBe('oak_log');
    expect(t.world.getBlock(0, 13, 0).key).toBe('air');
  });

  it('follows boughs joined diagonally but not a tree of another kind or a detached log', () => {
    const t = rig();
    t.trunk(0, 0, 4);
    t.world.put(1, 12, 1, 'oak_log'); // diagonal bough
    t.world.put(2, 13, 2, 'oak_log'); // bough continues
    t.world.put(4, 12, 4, 'oak_log'); // detached
    t.world.put(0, 14, 1, 'pine_log'); // another wood touching the top
    const r = fellTree(t.world, t.player, 0, 10, 0, rng)!;
    expect(r.logs).toBe(6);
    expect(t.world.getBlock(4, 12, 4).key).toBe('oak_log');
    expect(t.world.getBlock(0, 14, 1).key).toBe('pine_log');
  });

  it('caps the count at maxLogs, nearest first, and says more is left', () => {
    const t = rig(2000);
    t.player.inventory.set(t.player.selectedSlot, { item: 'chainsaw', count: 1, durability: 2000 });
    t.world.fill(0, 10, 0, 0, 70, 0, 'oak_log');
    const r = fellTree(t.world, t.player, 0, 10, 0, rng)!;
    expect(r.logs).toBe(SAW_MAX_LOGS);
    expect(r.more).toBe(true);
    expect(t.world.getBlock(0, 10 + SAW_MAX_LOGS - 1, 0).key).toBe('air');
    expect(t.world.getBlock(0, 10 + SAW_MAX_LOGS, 0).key).toBe('oak_log');
  });

  it('never starts below the cut: logs under the target stay', () => {
    const t = rig();
    t.trunk(0, 0, 3);
    t.world.put(1, 9 + 1, 0, 'oak_log');
    fellTree(t.world, t.player, 0, 11, 0, rng);
    expect(t.world.getBlock(0, 10, 0).key).toBe('oak_log');
    expect(t.world.getBlock(1, 10, 0).key).toBe('oak_log');
  });

  it('burns fuelPerLog per log and stops at the tank, never destroying the saw', () => {
    const t = rig(22);
    t.trunk(0, 0, 10);
    const r = fellTree(t.world, t.player, 0, 10, 0, rng)!;
    // 22 fuel = 3 logs at 7 each; one unit stays in the tank.
    expect(r.logs).toBe(3);
    expect(t.saw().durability).toBe(2);
    expect(t.world.getBlock(0, 13, 0).key).toBe('oak_log');
    expect(sawFuel(t.saw())).toBe(1);
    // One more cut with the last unit, then the saw is empty but still in hand.
    fellTree(t.world, t.player, 0, 13, 0, rng);
    expect(t.saw().durability).toBe(1);
    expect(t.saw().item).toBe('chainsaw');
    expect(fellTree(t.world, t.player, 0, 14, 0, rng)).toBeNull();
    expect(t.toasts.join(' ')).toMatch(/out of fuel/);
  });

  it('does nothing for other tools, other blocks or the dead', () => {
    const t = rig();
    t.trunk(0, 0, 3);
    t.player.inventory.set(t.player.selectedSlot, { item: 'iron_axe', count: 1, durability: 100 });
    expect(fellTree(t.world, t.player, 0, 10, 0, rng)).toBeNull();
    t.player.inventory.set(t.player.selectedSlot, { item: 'chainsaw', count: 1, durability: 50 });
    expect(fellTree(t.world, t.player, 3, 9, 3, rng)).toBeNull(); // grass
    expect(trunkAbove(t.world, 3, 9, 3, 10)).toEqual([]);
    expect(t.world.getBlock(0, 10, 0).key).toBe('oak_log');
  });

  it('a short stump does not count as a felled tree', () => {
    const t = rig();
    t.trunk(0, 0, 2);
    fellTree(t.world, t.player, 0, 10, 0, rng);
    expect(t.flags).not.toContain(FLAG_FELLED_TREE);
  });
});

describe('refuelling', () => {
  it('a Fuel Canister in hand tops up the saw in the pack, once per canister, never past full', () => {
    const t = rig(100);
    t.player.inventory.set(0, { item: 'fuel_canister', count: 3 });
    t.player.selectSlot(0);
    t.player.inventory.set(1, { item: 'chainsaw', count: 1, durability: 101 });
    expect(refuelChainsaw(t.player)).toBe('refuelled');
    expect(sawFuel(t.player.inventory.get(1))).toBe(100 + SAW_CANISTER_FUEL);
    expect(t.player.inventory.get(0)!.count).toBe(2);
    expect(refuelChainsaw(t.player)).toBe('refuelled');
    expect(sawFuel(t.player.inventory.get(1))).toBe(sawCapacity(t.player.inventory.get(1)));
    expect(t.player.inventory.get(0)!.count).toBe(1);
    // Full: the canister is kept.
    expect(refuelChainsaw(t.player)).toBe('full');
    expect(t.player.inventory.get(0)!.count).toBe(1);
  });

  it('reports no saw quietly and needs a canister in hand', () => {
    const t = rig();
    t.player.inventory.set(0, { item: 'fuel_canister', count: 1 });
    t.player.selectSlot(0);
    t.player.inventory.set(t.player.selectedSlot + 1, null);
    t.player.inventory.slots.forEach((_, i) => i !== 0 && t.player.inventory.set(i, null));
    expect(refuelChainsaw(t.player)).toBe('no-saw');
    t.player.inventory.set(0, { item: 'stick', count: 1 });
    expect(refuelChainsaw(t.player)).toBe('no-fuel');
  });
});
