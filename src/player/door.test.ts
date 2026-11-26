import { describe, expect, it } from 'vitest';
import { REACH } from '../core/constants';
import { createBus } from '../core/context';
import { DOOR_TOP } from '../core/doorShape';
import { block } from '../core/registry';
import { AIR, Facing, makeVoxel, voxelActive, voxelVariant } from '../core/types';
import { solidHeight, sweepAxis } from './collision';
import { Interaction } from './interaction';
import { PlayerPhysics } from './physics';
import { createRayHit, raycast, type RayHit } from './raycast';
import { flatWorld, makePlayer } from './testKit';

// A north-facing door in a wall at z=3, two cells tall (bottom at y=10, top above), in the flat test world.
// The player stands at (0.5, 10, 0.5) looking towards +z, so the door's front faces the player.
function setup() {
  const bus = createBus();
  const world = flatWorld(bus, 'stone');
  const player = makePlayer(bus);
  const physics = new PlayerPhysics(world, player);
  const interaction = new Interaction(world, bus, player, physics, { triggerSwing: () => undefined }, () => 0);
  const doorId = block('wooden_door').id;
  world.setVoxel(0, 10, 3, makeVoxel(doorId, Facing.North));
  world.setVoxel(0, 11, 3, makeVoxel(doorId, Facing.North, false, DOOR_TOP));
  const hit = createRayHit();
  const aim = (x: number, y: number, z: number): RayHit | null => {
    const ex = player.position.x;
    const ey = player.eyeY;
    const ez = player.position.z;
    return raycast(world, ex, ey, ez, x - ex, y - ey, z - ez, REACH, false, hit);
  };
  return { world, player, interaction, aim };
}

describe('wooden door', () => {
  it('is solid when closed and passable when open, with both halves swinging together', () => {
    const { world, interaction, aim } = setup();
    expect(solidHeight(world, 0, 10, 3)).toBe(1);

    const ray = aim(0.5, 10.5, 3.5);
    expect(ray?.block.key).toBe('wooden_door');
    expect(interaction.use(ray)).toBe('worked');
    expect(voxelActive(world.getVoxel(0, 10, 3))).toBe(true);
    expect(voxelActive(world.getVoxel(0, 11, 3))).toBe(true);
    expect(solidHeight(world, 0, 10, 3)).toBe(0);

    // Walking into the doorway: a closed door stops the player short, an open one lets them through.
    expect(sweepAxis(world, { x: 0.5, y: 10, z: 2.5 }, 2, 2)).toBeCloseTo(2, 5);

    interaction.updateMining(1, false, null); // lets the place cooldown run out
    expect(interaction.use(aim(0.5, 10.5, 3.5))).toBe('worked');
    expect(voxelActive(world.getVoxel(0, 10, 3))).toBe(false);
    expect(voxelActive(world.getVoxel(0, 11, 3))).toBe(false);
    expect(solidHeight(world, 0, 10, 3)).toBe(1);
    // Shut again: the thin panel stops the player at its face (z 6/16 of the cell, less the half width).
    expect(sweepAxis(world, { x: 0.5, y: 10, z: 2.5 }, 2, 2)).toBeCloseTo(0.575, 2);
  });

  it('marks its top half so the upper cell is not a second bottom', () => {
    const { world } = setup();
    expect(voxelVariant(world.getVoxel(0, 11, 3))).toBe(DOOR_TOP);
    expect(world.getVoxel(0, 12, 3)).toBe(AIR);
  });
});
