import { describe, expect, it } from 'vitest';
import { HOTBAR_SIZE } from '../core/constants';
import { createBus } from '../core/context';
import { recipesFor } from '../core/registry';
import { craftByPlayer } from './crafting';
import { bringToHotbar, isHandy } from './handy';
import { makeStack } from './inventory';
import { PlayerState } from './playerState';

function rig() {
  const bus = createBus();
  const player = new PlayerState(bus);
  const toasts: string[] = [];
  bus.on('toast', (e) => toasts.push(e.text));
  return { player, toasts, inv: player.inventory };
}

/** Fills every hotbar slot with `item`. */
const fillHotbar = (p: PlayerState, item: string): void => {
  for (let i = 0; i < HOTBAR_SIZE; i++) p.inventory.set(i, makeStack(item, 5));
};

describe('isHandy', () => {
  it('knows what is used from the hand', () => {
    for (const key of ['flint_pickaxe', 'flint_hoe', 'wrench', 'bread', 'potato', 'lamp', 'workbench', 'torch', 'water_pail', 'bronze_bucket', 'lava_bucket']) {
      expect(isHandy(key), key).toBe(true);
    }
    for (const key of ['rubble', 'gravel', 'plank', 'stick', 'flour', 'ember_poppy', 'wheat_seeds', 'padded_coat', 'copper_ingot']) {
      expect(isHandy(key), key).toBe(false);
    }
  });
});

describe('bringToHotbar (gc-8)', () => {
  it('moves a new tool from the pack into an empty hotbar slot', () => {
    const { player, inv } = rig();
    fillHotbar(player, 'gravel');
    inv.set(4, null);
    inv.set(HOTBAR_SIZE + 3, makeStack('flint_pickaxe', 1));
    expect(bringToHotbar(player, 'flint_pickaxe')).toBe('moved');
    expect(inv.get(4)?.item).toBe('flint_pickaxe');
    expect(inv.get(HOTBAR_SIZE + 3)).toBeNull();
  });

  it('swaps out a plain stack on a full hotbar, the selected slot first, and selects it', () => {
    const { player, inv } = rig();
    fillHotbar(player, 'gravel');
    inv.set(0, makeStack('flint_pickaxe', 1));
    player.selectSlot(0);
    inv.set(HOTBAR_SIZE, makeStack('lamp', 1));
    expect(bringToHotbar(player, 'lamp')).toBe('swapped');
    // The selected slot holds a tool, so the first plain stack goes instead.
    expect(inv.get(1)?.item).toBe('lamp');
    expect(inv.get(HOTBAR_SIZE)).toEqual(makeStack('gravel', 5));
    expect(player.selectedSlot).toBe(1);

    const other = rig();
    fillHotbar(other.player, 'ember_poppy');
    other.player.selectSlot(6);
    other.inv.set(20, makeStack('bread', 2));
    expect(bringToHotbar(other.player, 'bread')).toBe('swapped');
    expect(other.inv.get(6)).toEqual(makeStack('bread', 2));
    expect(other.inv.get(20)?.item).toBe('ember_poppy');
  });

  it('leaves it in the pack with a toast when every hotbar slot is handy, and does nothing when one is already out', () => {
    const { player, inv, toasts } = rig();
    fillHotbar(player, 'torch');
    inv.set(HOTBAR_SIZE, makeStack('lamp', 1));
    expect(bringToHotbar(player, 'lamp')).toBe('pack');
    expect(toasts).toEqual(['Lamp is in your pack - open it to put it on the hotbar']);
    inv.set(HOTBAR_SIZE + 1, makeStack('torch', 3));
    expect(bringToHotbar(player, 'torch')).toBe('unchanged');
    expect(bringToHotbar(player, 'gravel')).toBe('unchanged');
  });

  it('runs after a craft by the player', () => {
    const { player, inv } = rig();
    fillHotbar(player, 'gravel');
    inv.set(HOTBAR_SIZE, makeStack('plank', 10));
    const workbench = recipesFor('workbench')[0];
    const result = craftByPlayer(player, workbench);
    expect(result.ok).toBe(true);
    expect(player.heldStack()?.item).toBe('workbench');
  });
});
