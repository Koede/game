import { describe, expect, it } from 'vitest';
import { VACUUM_WEAR_S } from '../content/itemsGround';
import { createBus } from '../core/context';
import { COLLECTORS, collectorOf } from './collectors';
import { FakeWorld } from './fakeWorld';
import { PICKUP_RADIUS } from './groundItems';
import { PlayerState } from './playerState';

function setup() {
  const bus = createBus();
  const world = new FakeWorld(bus);
  world.fill(-30, 0, -30, 30, 4, 30, 'stone');
  const player = new PlayerState(bus, { x: 0.5, y: 5, z: 0.5 });
  const names: string[] = [];
  bus.on('sfx', (e) => names.push(e.name));
  const tick = (seconds: number): void => {
    for (let t = 0; t < seconds - 1e-9; t += 0.05) player.ground.tick(0.05, world, player, player.collectors.tick(0.05));
  };
  return { bus, world, player, names, tick };
}

const lie = (p: PlayerState, x: number, z: number, item = 'coal'): void => {
  p.ground.spawn(item, 1, x, 5, z, { scatter: false, delayS: 0 });
};

describe('hand vacuum pump', () => {
  it('is a registered item with wear, and a collector far beyond the plain pickup radius', () => {
    expect(collectorOf('hand_vacuum')?.radius).toBeGreaterThan(PICKUP_RADIUS * 4);
    expect(collectorOf('coal')).toBeNull();
    const { player } = setup();
    expect(player.give('hand_vacuum', 1)).toBe(0);
    expect(player.inventory.get(0)).toEqual({ item: 'hand_vacuum', count: 1, durability: VACUUM_WEAR_S });
  });

  it('does nothing without it: Use falls through', () => {
    const { player } = setup();
    expect(player.collectors.trigger()).toBe(false);
    player.give('coal', 1);
    expect(player.collectors.trigger()).toBe(false);
  });

  it('pulls items from nine blocks away to the player and into the pack', () => {
    const { player, tick, names } = setup();
    player.give('hand_vacuum', 1);
    player.selectSlot(0);
    lie(player, 8.5, 0.5);
    lie(player, 0.5, -7.5, 'stick');
    lie(player, 25.5, 0.5, 'flint'); // out of range
    tick(2);
    expect(player.ground.count('coal')).toBe(1); // not armed yet: far items stay
    expect(player.collectors.trigger()).toBe(true);
    tick(2);
    expect(player.inventory.count('coal')).toBe(1);
    expect(player.inventory.count('stick')).toBe(1);
    expect(player.ground.count('flint')).toBe(1);
    expect(names).toContain('steam_hiss');
    expect(names).toContain('pickup');
  });

  it('runs for a burst per Use, stops, and wears the pump by the seconds it ran', () => {
    const { player, tick } = setup();
    player.give('hand_vacuum', 1);
    const def = COLLECTORS.hand_vacuum;
    player.collectors.trigger();
    tick(1);
    expect(player.collectors.running).toBe(true);
    const worn = VACUUM_WEAR_S - player.inventory.get(0)!.durability!;
    expect(worn).toBeCloseTo(def.power.kind === 'wear' ? def.power.perS : 0, 0);
    tick(def.burstS + 1);
    expect(player.collectors.running).toBe(false);
    const after = player.inventory.get(0)!.durability!;
    tick(2);
    expect(player.inventory.get(0)!.durability).toBe(after);
    // holding Use keeps re-arming it
    for (let i = 0; i < 40; i++) {
      player.collectors.trigger();
      tick(0.25);
    }
    expect(player.collectors.running).toBe(true);
    expect(player.inventory.get(0)!.durability!).toBeLessThan(after - 5);
  });

  it('stops pulling when the pump is put away, and breaks when its leather is gone', () => {
    const { player, tick } = setup();
    player.give('hand_vacuum', 1);
    player.collectors.trigger();
    player.selectSlot(1);
    tick(0.2);
    expect(player.collectors.running).toBe(false);
    player.selectSlot(0);
    player.inventory.get(0)!.durability = 0.4;
    player.collectors.trigger();
    tick(1);
    expect(player.inventory.count('hand_vacuum')).toBe(0);
    expect(player.collectors.running).toBe(false);
  });

  it('leaves items alone while the pack is full', () => {
    const { player, tick } = setup();
    player.give('hand_vacuum', 1);
    for (let i = 1; i < player.inventory.size; i++) player.inventory.set(i, { item: 'stick', count: 99 });
    lie(player, 7.5, 0.5);
    player.collectors.trigger();
    tick(2);
    expect(player.ground.count('coal')).toBe(1);
  });

  it('a second collector is only another definition: an electric one needs its supply', () => {
    const { player, tick } = setup();
    let joules = 0;
    let supply = true;
    COLLECTORS.test_magnet = {
      item: 'test_magnet', radius: 12, pull: 14, burstS: 1,
      power: { kind: 'electric', watts: 400, supply: (j) => { if (supply) joules += j; return supply; } },
    };
    const held = player.heldStack.bind(player);
    try {
      player.heldStack = () => ({ item: 'test_magnet', count: 1 });
      lie(player, 11.5, 0.5);
      expect(player.collectors.trigger()).toBe(true);
      tick(1.5);
      expect(joules).toBeGreaterThan(0);
      expect(player.ground.count('coal')).toBe(0);
      supply = false;
      lie(player, 11.5, 0.5);
      player.collectors.trigger();
      tick(1);
      expect(player.ground.count('coal')).toBe(1);
    } finally {
      player.heldStack = held;
      delete COLLECTORS.test_magnet;
    }
  });
});
