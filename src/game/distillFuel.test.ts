import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { FUEL_GRADES } from '../core/distill';
import { itemOrNull } from '../core/registry';
import { SAW_CANISTER_FUEL } from '../content/itemsVehicle';
import { isSawFuel, refuelChainsaw, sawFuel } from './felling';
import { PlayerState } from './playerState';

function withSaw(fuelItem: string) {
  const player = new PlayerState(createBus(), { x: 0.5, y: 10, z: 0.5 });
  player.inventory.slots.forEach((_, i) => player.inventory.set(i, null));
  player.inventory.set(0, { item: fuelItem, count: 2 });
  player.selectSlot(0);
  player.inventory.set(1, { item: 'chainsaw', count: 1, durability: 1 });
  return player;
}

describe('distillery fuels in engines', () => {
  it('every fuel grade names real items, and the old Fuel Canister stays worth exactly one', () => {
    for (const [k, g] of Object.entries(FUEL_GRADES)) {
      expect(itemOrNull(k), k).not.toBeNull();
      if (g.empty) expect(itemOrNull(g.empty), k).not.toBeNull();
    }
    expect(FUEL_GRADES.fuel_canister).toEqual({ saw: 1, tractor: 1, engine: 1, empty: null });
  });

  it('gasoline fills a chainsaw 1.3 times as far and hands the empty canister back', () => {
    const p = withSaw('gasoline_canister');
    expect(refuelChainsaw(p)).toBe('refuelled');
    expect(sawFuel(p.inventory.get(1))).toBe(Math.round(SAW_CANISTER_FUEL * 1.3));
    expect(p.inventory.get(0)!.count).toBe(1);
    expect(p.inventory.slots.some((s) => s?.item === 'empty_canister')).toBe(true);
  });

  it('a chainsaw cannot burn diesel', () => {
    expect(isSawFuel('diesel_canister')).toBe(false);
    expect(isSawFuel('gasoline_canister')).toBe(true);
    const p = withSaw('diesel_canister');
    expect(refuelChainsaw(p)).toBe('no-fuel');
    expect(p.inventory.get(0)!.count).toBe(2);
  });

  it('kerosene runs a tractor one canister per canister but a chainsaw refuses it', () => {
    expect(FUEL_GRADES.kerosene_canister).toEqual({ saw: 0, tractor: 1, engine: 1, empty: 'empty_canister' });
    expect(isSawFuel('kerosene_canister')).toBe(false);
    const p = withSaw('kerosene_canister');
    expect(refuelChainsaw(p)).toBe('no-fuel');
    expect(p.inventory.get(0)!.count).toBe(2);
  });
});
