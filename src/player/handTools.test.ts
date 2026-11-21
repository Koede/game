import { describe, expect, it } from 'vitest';
import { REACH } from '../core/constants';
import { createBus } from '../core/context';
import type { Slot } from '../core/types';
import { useRepeatFor, type HandHands, type HandResult, type PourResult } from './handTools';
import { Interaction } from './interaction';
import { USE_REPEAT_S } from './input/core';
import { PlayerPhysics } from './physics';
import { createRayHit, raycast, type RayHit } from './raycast';
import { flatWorld, makePlayer, record } from './testKit';

function setup() {
  const bus = createBus();
  const world = flatWorld(bus);
  const player = makePlayer(bus);
  const calls: string[] = [];
  const answers: { stroke: HandResult; ret: HandResult; pour: PourResult; molten: number } = {
    stroke: { ok: true, did: 'stroke' },
    ret: { ok: true, did: 'return' },
    pour: { ok: true },
    molten: 0,
  };
  const hands: HandHands = {
    stroke: (x, y, z, held) => (calls.push(`stroke ${x},${y},${z} ${held}`), answers.stroke),
    handReturn: (x, y, z) => (calls.push(`return ${x},${y},${z}`), answers.ret),
    pourCrucible: (x, y, z, slot, held) => (calls.push(`pour ${x},${y},${z} #${slot} ${held}`), answers.pour),
    furnaceView: () => ({ crucibles: [{ index: 0, moltenS: 0 }, { index: 1, moltenS: answers.molten }] }),
  };
  let swings = 0;
  const interaction = new Interaction(world, bus, player, new PlayerPhysics(world, player), { triggerSwing: () => swings++ }, () => 0, null, null, hands);
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

describe('hand stations take the tap', () => {
  it('an empty hand strokes the quern: the sim is asked with a null hand, and the hand swings', () => {
    const { world, interaction, aim, calls, swings } = setup();
    world.put(0, 10, -2, 'hand_quern');
    expect(interaction.use(aim(0.5, 10.3, -1.5))).toBe('worked');
    expect(calls).toEqual(['stroke 0,10,-2 null']);
    expect(swings()).toBe(1);
  });

  it('an ingredient in hand goes to the sim as is (the sim loads it)', () => {
    const { world, interaction, aim, hold, calls } = setup();
    world.put(0, 10, -2, 'hand_quern');
    hold({ item: 'wheat', count: 5 });
    expect(interaction.use(aim(0.5, 10.3, -1.5))).toBe('worked');
    expect(calls).toEqual(['stroke 0,10,-2 wheat']);
  });

  it('the station tool goes to the sim; any other tool is a bare hand', () => {
    const { world, interaction, aim, hold, calls } = setup();
    world.put(0, 10, -2, 'stone_anvil');
    hold({ item: 'flint_hammer', count: 1, durability: 20 });
    interaction.use(aim(0.5, 10.5, -1.5));
    hold({ item: 'flint_pickaxe', count: 1, durability: 20 });
    interaction.use(aim(0.5, 10.5, -1.5));
    expect(calls).toEqual(['stroke 0,10,-2 flint_hammer', 'stroke 0,10,-2 null']);
  });

  it('a block that is not an ingredient is placed beside the station, not struck with', () => {
    const { world, player, interaction, aim, hold, calls } = setup();
    world.put(0, 10, -2, 'hand_quern');
    hold({ item: 'stone_brick', count: 4 });
    expect(interaction.use(aim(0.5, 10.3, -1.5))).toBe('placed');
    expect(calls).toEqual([]);
    expect(player.heldStack()?.count).toBe(3);
  });

  it('a log is an ingredient of the chopping block even though it is a block', () => {
    const { world, interaction, aim, hold, calls } = setup();
    world.put(0, 10, -2, 'chopping_block');
    hold({ item: 'oak_log', count: 2 });
    expect(interaction.use(aim(0.5, 10.5, -1.5))).toBe('worked');
    expect(calls).toEqual(['stroke 0,10,-2 oak_log']);
  });

  it('a refusal is toasted with the sim sentence and ends the tap', () => {
    const { world, bus, interaction, aim, answers } = setup();
    const toasts = record(bus, 'toast');
    world.put(0, 10, -2, 'hand_quern');
    answers.stroke = { ok: false, reason: 'Take the Flour first' };
    expect(interaction.use(aim(0.5, 10.3, -1.5))).toBe('refused');
    expect(toasts.map((t) => t.e.text)).toEqual(['Take the Flour first']);
  });

  it('Shift / Place with an empty hand takes the loaded input back', () => {
    const { world, interaction, aim, calls } = setup();
    world.put(0, 10, -2, 'hand_quern');
    expect(interaction.use(aim(0.5, 10.3, -1.5), true)).toBe('worked');
    expect(calls).toEqual(['return 0,10,-2']);
  });

  it('never opens a screen for a station and leaves other blocks alone', () => {
    const { world, bus, interaction, aim, calls } = setup();
    const opened = record(bus, 'ui:open');
    world.put(0, 10, -2, 'loom');
    interaction.use(aim(0.5, 10.5, -1.5));
    expect(opened).toEqual([]);
    world.put(2, 10, -2, 'stone');
    expect(interaction.use(aim(2.5, 10.5, -1.5))).toBe('none');
    expect(calls).toEqual(['stroke 0,10,-2 null']);
  });
});

describe('moulds at a furnace', () => {
  it('pours the first molten crucible in the world, without the screen', () => {
    const { world, bus, interaction, aim, hold, calls, answers, swings } = setup();
    const opened = record(bus, 'ui:open');
    world.put(0, 10, -2, 'furnace_clay');
    answers.molten = 14;
    hold({ item: 'ingot_mould', count: 1, durability: 40 });
    expect(interaction.use(aim(0.5, 10.5, -1.5))).toBe('poured');
    expect(calls).toEqual(['pour 0,10,-2 #1 ingot_mould']);
    expect(opened).toEqual([]);
    expect(swings()).toBe(1);
  });

  it('opens the furnace screen as usual when nothing is molten', () => {
    const { world, bus, interaction, aim, hold, calls } = setup();
    const opened = record(bus, 'ui:open');
    world.put(0, 10, -2, 'furnace_clay');
    hold({ item: 'ingot_mould', count: 1, durability: 40 });
    expect(interaction.use(aim(0.5, 10.5, -1.5))).toBe('screen');
    expect(opened.length).toBe(1);
    expect(calls).toEqual([]);
  });

  it('toasts why a pour was refused', () => {
    const { world, bus, interaction, aim, hold, answers } = setup();
    const toasts = record(bus, 'toast');
    world.put(0, 10, -2, 'furnace_clay');
    answers.molten = 5;
    answers.pour = { ok: false, reason: 'The Axe Mould does not take Copper Ingot' };
    hold({ item: 'axe_mould', count: 1 });
    expect(interaction.use(aim(0.5, 10.5, -1.5))).toBe('refused');
    expect(toasts.map((t) => t.e.text)).toEqual(['The Axe Mould does not take Copper Ingot']);
  });
});

describe('hold-to-repeat rate', () => {
  it('uses the stations stroke rate, the usual repeat elsewhere', () => {
    const { world } = setup();
    world.put(0, 10, -2, 'chopping_block');
    world.put(1, 10, -2, 'stone');
    expect(useRepeatFor(world.getBlock(0, 10, -2))).toBeCloseTo(0.25);
    expect(useRepeatFor(world.getBlock(1, 10, -2))).toBe(USE_REPEAT_S);
    expect(useRepeatFor(null)).toBe(USE_REPEAT_S);
    world.put(2, 10, -2, 'stone_anvil');
    expect(useRepeatFor(world.getBlock(2, 10, -2))).toBeCloseTo(0.4);
  });
});
