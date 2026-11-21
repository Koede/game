import { describe, expect, it } from 'vitest';
import { REACH } from '../core/constants';
import { createBus } from '../core/context';
import type { Slot } from '../core/types';
import { Interaction } from './interaction';
import { PlayerPhysics } from './physics';
import { createRayHit, raycast, type RayHit } from './raycast';
import { TAP_COOLDOWN_S } from './sapTools';
import { flatWorld, makePlayer, record } from './testKit';

function setup() {
  const bus = createBus();
  const world = flatWorld(bus);
  const player = makePlayer(bus);
  const interaction = new Interaction(world, bus, player, new PlayerPhysics(world, player), { triggerSwing: () => {} }, () => 0);
  const hit = createRayHit();
  const aim = (x: number, y: number, z: number): RayHit | null => {
    const ex = player.position.x;
    const ey = player.eyeY;
    const ez = player.position.z;
    return raycast(world, ex, ey, ez, x - ex, y - ey, z - ez, REACH, false, hit);
  };
  const hold = (slot: Slot): void => player.inventory.set(player.selectedSlot, slot);
  const count = (item: string): number => player.inventory.count(item);
  return { bus, world, player, interaction, aim, hold, count };
}

describe('tapping pine sap', () => {
  it('a beaker on a pine log becomes a beaker of sap', () => {
    const { world, interaction, aim, hold, count, bus } = setup();
    const toasts = record(bus, 'toast');
    world.put(0, 10, -2, 'pine_log');
    hold({ item: 'glass_beaker', count: 3 });
    expect(interaction.use(aim(0.5, 10.5, -1.5))).toBe('worked');
    expect(count('glass_beaker')).toBe(2);
    expect(count('pine_sap')).toBe(1);
    expect(JSON.stringify(toasts)).toContain('sap');
  });

  it('the same log is spent for a while, then weeps again', () => {
    const { world, interaction, aim, hold, count } = setup();
    world.put(0, 10, -2, 'pine_log');
    hold({ item: 'glass_beaker', count: 3 });
    const target = aim(0.5, 10.5, -1.5);
    interaction.use(target);
    expect(interaction.use(target)).toBe('refused');
    expect(count('pine_sap')).toBe(1);
    interaction.updateMining(TAP_COOLDOWN_S + 1, false, null);
    expect(interaction.use(target)).toBe('worked');
    expect(count('pine_sap')).toBe(2);
  });

  it('an oak log gives nothing', () => {
    const { world, interaction, aim, hold, count } = setup();
    world.put(0, 10, -2, 'oak_log');
    hold({ item: 'glass_beaker', count: 1 });
    expect(interaction.use(aim(0.5, 10.5, -1.5))).not.toBe('worked');
    expect(count('pine_sap')).toBe(0);
  });

  it('other items on a pine log do nothing special', () => {
    const { world, interaction, aim, hold, count } = setup();
    world.put(0, 10, -2, 'pine_log');
    hold({ item: 'stick', count: 1 });
    interaction.use(aim(0.5, 10.5, -1.5));
    expect(count('pine_sap')).toBe(0);
  });
});
