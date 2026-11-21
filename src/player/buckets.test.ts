import { describe, expect, it } from 'vitest';
import { REACH } from '../core/constants';
import { createBus } from '../core/context';
import type { Slot } from '../core/types';
import { BUCKET_HINTS } from './buckets';
import { Interaction, screenFor } from './interaction';
import { block } from '../core/registry';
import { PlayerPhysics } from './physics';
import { createRayHit, raycast, type LiquidAim, type RayHit } from './raycast';
import { flatWorld, makePlayer, record } from './testKit';
import { WATER_SOURCE, flowingWater } from '../world/water';

/** A player at (0.5, 10, 0.5) on a stone floor (top at y 10). */
function setup() {
  const bus = createBus();
  const world = flatWorld(bus);
  const player = makePlayer(bus);
  const physics = new PlayerPhysics(world, player);
  const interaction = new Interaction(world, bus, player, physics, { triggerSwing: () => undefined }, () => 0);
  const hit = createRayHit();
  const aim = (x: number, y: number, z: number, liquids: LiquidAim = false): RayHit | null => {
    const ex = player.position.x;
    const ey = player.eyeY;
    const ez = player.position.z;
    return raycast(world, ex, ey, ez, x - ex, y - ey, z - ez, REACH, liquids, hit);
  };
  const hold = (slot: Slot): void => player.inventory.set(player.selectedSlot, slot);
  /** Lets the placement repeat delay run out. */
  const wait = (): void => interaction.updateMining(0.5, false, null);
  return { bus, world, player, interaction, aim, hold, wait };
}

describe('buckets (spec 13)', () => {
  it('a bronze bucket scoops lava, which removes the lava block, and pours it back, returning the bronze bucket', () => {
    const { bus, world, player, interaction, aim, hold, wait } = setup();
    world.put(0, 10, -2, 'lava');
    hold({ item: 'bronze_bucket', count: 1 });
    const sounds = record(bus, 'sfx');
    expect(interaction.use(aim(0.5, 10.5, -1.5, true))).toBe('pail');
    expect(player.heldStack()).toEqual({ item: 'lava_bucket', count: 1 });
    expect(world.getBlock(0, 10, -2).key).toBe('air'); // lava pools are finite
    expect(sounds.map((s) => s.e.name)).toContain('scoop_lava');
    wait();
    expect(interaction.use(aim(2.5, 9.9, -1.5))).toBe('pail');
    expect(world.getBlock(2, 10, -2).key).toBe('lava');
    expect(player.heldStack()).toEqual({ item: 'bronze_bucket', count: 1 });
    expect(sounds.filter((s) => s.e.name === 'scoop_lava')).toHaveLength(2);
  });

  it('never pours lava onto the player', () => {
    const { bus, world, player, interaction, aim, hold } = setup();
    hold({ item: 'lava_bucket', count: 1 });
    const toasts = record(bus, 'toast');
    // The floor cell under the player's feet: pouring would fill the cell the player stands in.
    expect(interaction.use(aim(0.5, 9.9, 0.5))).toBe('refused');
    expect(world.getBlock(0, 10, 0).key).toBe('air');
    expect(player.heldStack()?.item).toBe('lava_bucket');
    expect(toasts.map((t) => t.e.text)).toContain(BUCKET_HINTS.pourOnSelf);
  });

  it('the wooden bucket refuses lava, the bronze one water, and no bucket takes crude oil', () => {
    const { bus, world, player, interaction, aim, hold } = setup();
    const toasts = record(bus, 'toast');
    world.put(0, 10, -2, 'lava');
    world.put(1, 10, -2, 'water');
    world.put(-1, 10, -2, 'oil');
    hold({ item: 'pail', count: 1 });
    expect(interaction.use(aim(0.5, 10.5, -1.5, true))).toBe('refused');
    expect(interaction.use(aim(-0.5, 10.5, -1.5, true))).toBe('refused');
    hold({ item: 'bronze_bucket', count: 1 });
    expect(interaction.use(aim(1.5, 10.5, -1.5, true))).toBe('refused');
    expect(player.heldStack()?.item).toBe('bronze_bucket');
    expect(world.getBlock(0, 10, -2).key).toBe('lava');
    expect(world.getBlock(-1, 10, -2).key).toBe('oil');
    expect(toasts.map((t) => t.e.text)).toEqual([BUCKET_HINTS.hotWood, BUCKET_HINTS.oil, BUCKET_HINTS.bronzeWater]);
  });
});

describe('buckets and flowing water (spec 18.3)', () => {
  it('the empty bucket aims through flowing water at the first source behind it and takes it', () => {
    const { bus, world, player, interaction, aim, hold } = setup();
    world.setVoxel(0, 10, -1, flowingWater(2));
    world.setVoxel(0, 10, -2, flowingWater(1));
    world.setVoxel(0, 10, -3, WATER_SOURCE);
    hold({ item: 'pail', count: 1 });
    const sounds = record(bus, 'sfx');
    const hit = aim(0.5, 10.4, -2.5, 'sources');
    expect(hit && [hit.x, hit.y, hit.z]).toEqual([0, 10, -3]);
    expect(hit?.throughFlow).toBe(true);
    expect(interaction.use(hit)).toBe('pail');
    expect(player.heldStack()).toEqual({ item: 'water_pail', count: 1 });
    expect(world.getVoxel(0, 10, -3)).toBe(0);
    expect(world.getVoxel(0, 10, -2)).toBe(flowingWater(1));
    expect(sounds.map((s) => s.e.name)).toContain('splash');
  });

  it('refuses with a short toast when only flowing water is in reach', () => {
    const { bus, world, player, interaction, aim, hold } = setup();
    world.setVoxel(0, 10, -1, flowingWater(3));
    world.setVoxel(0, 10, -2, flowingWater(4));
    hold({ item: 'pail', count: 1 });
    const toasts = record(bus, 'toast');
    // Through the flow onto the floor behind it.
    expect(interaction.use(aim(0.5, 9.9, -2.5, 'sources'))).toBe('refused');
    // Through the flow with nothing behind it in reach (a sheet at eye height): the flowing cell itself is the target.
    world.setVoxel(0, 11, -2, flowingWater(2));
    const flat = aim(0.5, player.eyeY, -7.5, 'sources');
    expect(flat && [flat.x, flat.y, flat.z]).toEqual([0, 11, -2]);
    expect(flat?.block.key).toBe('water');
    expect(interaction.use(flat)).toBe('refused');
    expect(player.heldStack()?.item).toBe('pail');
    expect(world.getVoxel(0, 10, -2)).toBe(flowingWater(4));
    expect(toasts.map((t) => t.e.text)).toEqual([BUCKET_HINTS.flowing]);
    // Plain ground with no water at all: nothing happens, no toast.
    expect(interaction.use(aim(3.5, 9.9, 2.5, 'sources'))).toBe('none');
  });

  it('the water bucket places a source in air, a washable plant or flowing water, never on a source', () => {
    const { world, player, interaction, aim, hold, wait } = setup();
    hold({ item: 'water_pail', count: 1 });
    world.setVoxel(2, 10, -1, flowingWater(5));
    expect(interaction.use(aim(2.5, 9.9, -0.5))).toBe('pail');
    expect(world.getVoxel(2, 10, -1)).toBe(WATER_SOURCE);
    expect(player.heldStack()?.item).toBe('pail');
    wait();
    hold({ item: 'water_pail', count: 1 });
    world.put(-2, 10, -1, 'ember_poppy');
    expect(interaction.use(aim(-1.5, 10.3, -0.5))).toBe('pail');
    expect(world.getVoxel(-2, 10, -1)).toBe(WATER_SOURCE);
    wait();
    hold({ item: 'water_pail', count: 1 });
    expect(interaction.use(aim(2.5, 9.9, -0.5))).toBe('refused');
    expect(player.heldStack()?.item).toBe('water_pail');
  });
});

describe('berry bushes (spec 14)', () => {
  it('Use picks a fruiting bush: berries into the pack, the bare bush stays, no screen opens', () => {
    const { bus, world, player, interaction, aim, hold } = setup();
    world.put(0, 10, -2, 'berry_bush');
    hold({ item: 'dirt', count: 3 });
    const log = record(bus, 'ui:open', 'sfx');
    expect(interaction.use(aim(0.5, 10.5, -1.5))).toBe('picked');
    expect(world.getBlock(0, 10, -2).key).toBe('berry_bush_bare');
    player.ground.drain(player);
    expect(player.inventory.count('wildberries')).toBeGreaterThanOrEqual(1);
    expect(player.inventory.count('dirt')).toBe(3);
    expect(log.some((l) => l.type === 'ui:open')).toBe(false);
    expect(log.some((l) => 'name' in l.e && l.e.name === 'harvest')).toBe(true);
    expect(screenFor(block('berry_bush_bare'), 0, 10, -2)).toBeNull();
    expect(screenFor(block('berry_bush'), 0, 10, -2)).toBeNull();
  });

  it('breaking a fruiting bush picks it too; breaking the bare bush takes it away', () => {
    const { world, player, interaction, aim } = setup();
    world.put(0, 10, -2, 'berry_bush');
    const target = (): RayHit | null => aim(0.5, 10.5, -1.5);
    for (let t = 0; t < 3 && world.getBlock(0, 10, -2).key === 'berry_bush'; t += 1 / 60) interaction.updateMining(1 / 60, true, target());
    expect(world.getBlock(0, 10, -2).key).toBe('berry_bush_bare');
    player.ground.drain(player);
    expect(player.inventory.count('wildberries')).toBeGreaterThanOrEqual(1);
    for (let t = 0; t < 3 && world.getBlock(0, 10, -2).key !== 'air'; t += 1 / 60) interaction.updateMining(1 / 60, true, target());
    expect(world.getBlock(0, 10, -2).key).toBe('air');
    player.ground.drain(player);
    expect(player.inventory.count('berry_bush_bare')).toBe(1);
  });
});
