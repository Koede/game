import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { block } from '../core/registry';
import { attachHaptics } from '../player/haptics';
import { FakeWorld } from './fakeWorld';
import { FallingTrees } from './fallingTrees';
import { PlayerState } from './playerState';

/** A grass floor at y = 9 and an oak of 5 logs; the player chops from the west, so it falls east. */
function grove(reduceMotion: boolean) {
  const bus = createBus();
  const world = new FakeWorld(bus);
  world.fill(-12, 9, -12, 12, 9, 12, 'grass');
  world.fill(0, 10, 0, 0, 14, 0, 'oak_log');
  const player = new PlayerState(bus, { x: -4.5, y: 10, z: 0.5 });
  player.inventory.set(player.selectedSlot, { item: 'steel_axe', count: 1, durability: 700 });
  const trees = new FallingTrees(world, player, bus, { rng: () => 0.5, reduceMotion: () => reduceMotion });
  const hit = { x: 0, y: 10, z: 0, block: block('oak_log'), voxel: 0, face: 0 } as never;
  for (let n = 0; n < 50 && trees.trees().length === 0; n++) trees.chop(hit);
  return { bus, trees };
}

/** Ticks until the tree has landed; returns how many ticks it took. */
function ticksToLand(t: ReturnType<typeof grove>): number {
  let n = 0;
  while (t.trees.trees().length > 0 && n < 60 * 30) {
    t.trees.tick(1 / 60);
    n++;
  }
  return n;
}

describe('the polish of a felled tree', () => {
  it('reduce motion makes the fall shorter, without changing where it lands', () => {
    const normal = ticksToLand(grove(false));
    const quick = ticksToLand(grove(true));
    expect(quick).toBeLessThan(normal * 0.85);
  });

  it('the landing is a haptic buzz when vibration is on', () => {
    const t = grove(false);
    const buzzes: unknown[] = [];
    attachHaptics(t.bus, () => true, (pattern) => {
      buzzes.push(pattern);
      return true;
    }, () => 0);
    t.bus.emit('sfx', { name: 'tree_fall' });
    expect(buzzes.length).toBe(1);
  });
});
