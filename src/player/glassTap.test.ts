import { describe, expect, it } from 'vitest';
import { REACH } from '../core/constants';
import { createBus } from '../core/context';
import { Interaction } from './interaction';
import { PlayerPhysics } from './physics';
import { createRayHit, raycast } from './raycast';
import { flatWorld, makePlayer } from './testKit';

describe('a glass vial at the sap tap', () => {
  it('works like an empty beaker', () => {
    const bus = createBus();
    const world = flatWorld(bus);
    const player = makePlayer(bus);
    const interaction = new Interaction(world, bus, player, new PlayerPhysics(world, player), { triggerSwing: () => {} }, () => 0);
    world.put(0, 10, -2, 'pine_log');
    player.inventory.set(player.selectedSlot, { item: 'glass_vial', count: 2 });
    const ex = player.position.x;
    const ey = player.eyeY;
    const ez = player.position.z;
    const hit = raycast(world, ex, ey, ez, 0.5 - ex, 10.5 - ey, -1.5 - ez, REACH, false, createRayHit());
    expect(interaction.use(hit)).toBe('worked');
    expect(player.inventory.count('glass_vial')).toBe(1);
    expect(player.inventory.count('pine_sap')).toBe(1);
  });
});
