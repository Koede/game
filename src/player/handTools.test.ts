import { describe, expect, it } from 'vitest';
import { REACH } from '../core/constants';
import { createBus } from '../core/context';
import { voxelId, type Slot } from '../core/types';
import type { HandAim, HandHands, HandResult } from './handTools';
import { Interaction } from './interaction';
import { PlayerPhysics } from './physics';
import { createRayHit, raycast, type RayHit } from './raycast';
import { flatWorld, makePlayer, record } from './testKit';

/** A player on a stone floor and a fake simulation that answers stroke() with what the test sets. */
function setup() {
  const bus = createBus();
  const world = flatWorld(bus);
  const player = makePlayer(bus);
  const calls: string[] = [];
  const answers: { stroke: HandResult; view: HandAim | null } = { stroke: { ok: true, did: 'stroke' }, view: { strokesPerS: 2, timed: false } };
  const hand: HandHands = {
    stroke: (x, y, z, held) => (calls.push(`stroke ${x},${y},${z} ${held}`), answers.stroke),
    handView: () => answers.view,
  };
  let swings = 0;
  const interaction = new Interaction(world, bus, player, new PlayerPhysics(world, player), { triggerSwing: () => swings++ }, () => 0, null, null, hand);
  const hit = createRayHit();
  const aim = (x: number, y: number, z: number): RayHit | null => {
    const ex = player.position.x;
    const ey = player.eyeY;
    const ez = player.position.z;
    return raycast(world, ex, ey, ez, x - ex, y - ey, z - ez, REACH, false, hit);
  };
  const hold = (slot: Slot): void => player.inventory.set(player.selectedSlot, slot);
  return { bus, world, player, interaction, aim, hold, calls, answers, swings: () => swings };
}

describe('hand stations take the tap first', () => {
  it('a log in hand aimed at a chopping block goes to stroke(), not into a block placed beside it', () => {
    const { world, interaction, aim, hold, calls, swings } = setup();
    world.put(0, 10, -2, 'chopping_block');
    hold({ item: 'oak_log', count: 3 });
    expect(interaction.use(aim(0.5, 10.5, -1.5))).toBe('worked');
    expect(calls).toEqual(['stroke 0,10,-2 oak_log']);
    expect(voxelId(world.getVoxel(0, 11, -2))).toBe(0);
    expect(swings()).toBe(1);
  });

  it('an empty hand sends a null held key', () => {
    const { world, interaction, aim, calls } = setup();
    world.put(0, 10, -2, 'chopping_block');
    interaction.use(aim(0.5, 10.5, -1.5));
    expect(calls).toEqual(['stroke 0,10,-2 null']);
  });

  it('a held Use repeats at the station pace: strokes wait for the timer, then go again', () => {
    const { world, interaction, aim, calls } = setup();
    world.put(0, 10, -2, 'chopping_block');
    const target = aim(0.5, 10.5, -1.5);
    interaction.use(target);
    interaction.use(target);
    expect(calls).toHaveLength(1);
    interaction.updateMining(0.3, false, null);
    interaction.use(target);
    expect(calls).toHaveLength(1);
    interaction.updateMining(0.3, false, null);
    interaction.use(target);
    expect(calls).toHaveLength(2);
  });

  it('loading and taking do not wait the stroke interval for the next step', () => {
    const { world, interaction, aim, calls, answers } = setup();
    world.put(0, 10, -2, 'chopping_block');
    const target = aim(0.5, 10.5, -1.5);
    answers.stroke = { ok: true, did: 'insert' };
    interaction.use(target);
    interaction.updateMining(0.35, false, null);
    interaction.use(target);
    expect(calls).toHaveLength(2);
  });

  it('a refusal is toasted as the sentence the simulation gives, and reports refused', () => {
    const { world, interaction, aim, answers, bus } = setup();
    const toasts = record(bus, 'toast');
    world.put(0, 10, -2, 'chopping_block');
    answers.stroke = { ok: false, reason: 'Chopping Block cannot work clay' };
    expect(interaction.use(aim(0.5, 10.5, -1.5))).toBe('refused');
    expect(JSON.stringify(toasts)).toContain('cannot work clay');
  });

  it('Shift (forcePlace) still places the held block against the station', () => {
    const { world, interaction, aim, hold, calls } = setup();
    world.put(0, 10, -2, 'chopping_block');
    hold({ item: 'oak_log', count: 3 });
    expect(interaction.use(aim(0.5, 10.5, -1.5), true)).toBe('placed');
    expect(calls).toEqual([]);
  });

  it('an ordinary block is not a station: the tap falls through', () => {
    const { world, interaction, aim, hold, calls } = setup();
    world.put(0, 10, -2, 'stone');
    hold({ item: 'oak_log', count: 1 });
    expect(interaction.use(aim(0.5, 10.5, -1.5))).toBe('placed');
    expect(calls).toEqual([]);
  });
});
