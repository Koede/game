/**
 * The interaction sweep: every item the game has, held and used on every block, and every block mined with each kind of
 * tool. "There is no interaction that should work and does not" is checked from the registries, so a block or item added
 * later is covered the day it lands. The rule: a Use either does something (any outcome other than 'none'/'refused'),
 * or the player is told why (a toast, or a screen opening). Bare hands stay quiet, and so does a Use that hits nothing.
 */
import { describe, expect, it } from 'vitest';
import { REACH } from '../core/constants';
import { createBus } from '../core/context';
import { BLOCKS, ITEMS, block, itemOrNull } from '../core/registry';
import { AIR, Face, WORLD_HEIGHT, type Slot } from '../core/types';
import { fullDurability } from '../game';
import { Interaction, noUseAdvice, type UseOutcome } from './interaction';
import { PlayerPhysics } from './physics';
import type { TransportHands } from './pipeTools';
import { createRayHit, raycast, type RayHit } from './raycast';
import { flatWorld, makePlayer, record } from './testKit';

const DT = 1 / 20;
const TARGET = { x: 0, y: 10, z: -2 };
const solidBlocks = BLOCKS.filter((b) => b.id !== AIR && b.liquid === null);

/** A transport that refuses everything with a reason, as a machine would that is not set up for the wrench or bucket. */
const stubTransport = { wrench: () => ({ ok: false, reason: 'not connected' }), bucketUse: () => ({ ok: false, reason: 'not a fluid endpoint', endpoint: false }) } as unknown as TransportHands;

function setup(holdKey: string | null, targetKey: string | null = null) {
  const bus = createBus();
  const world = flatWorld(bus, 'stone', 4);
  const player = makePlayer(bus);
  const physics = new PlayerPhysics(world, player);
  const interaction = new Interaction(world, bus, player, physics, { triggerSwing: () => undefined }, () => 0, stubTransport);
  if (targetKey) world.put(TARGET.x, TARGET.y, TARGET.z, targetKey);
  if (holdKey) player.inventory.set(player.selectedSlot, { item: holdKey, count: 2, durability: fullDurability(holdKey) } as Slot);
  const events = record(bus, 'toast', 'ui:open');
  const out = createRayHit();
  /** Aims at the side (aimTop false) or the top of the target cell. */
  const aim = (aimTop: boolean): RayHit | null =>
    raycast(world, player.position.x, player.eyeY, player.position.z, TARGET.x + 0.5 - player.position.x, (aimTop ? 10.95 : 10.5) - player.eyeY, TARGET.z + 0.5 - player.position.z, REACH, false, out);
  return { bus, world, player, interaction, events, aim };
}

describe('Use sweep: every item on every block', () => {
  it('never throws, and never does nothing in silence', () => {
    const silent: string[] = [];
    const thrown: string[] = [];
    for (const item of ITEMS) {
      for (const def of solidBlocks) {
        for (const aimTop of [false, true]) {
          const { interaction, events, aim } = setup(item.key, def.key);
          const hit = aim(aimTop);
          if (!hit) continue;
          let outcome: UseOutcome;
          try {
            outcome = interaction.use(hit);
          } catch (err) {
            thrown.push(`${item.key} on ${def.key}: ${(err as Error).message}`);
            continue;
          }
          const told = events.length > 0;
          if ((outcome === 'none' || outcome === 'refused') && !told) silent.push(`${item.key} on ${def.key} (${aimTop ? 'top' : 'side'}) -> ${outcome}`);
        }
      }
    }
    expect(thrown).toEqual([]);
    expect(silent).toEqual([]);
  });

  it('forced placement (Shift / the Place toggle) never throws or stays silent either', () => {
    const silent: string[] = [];
    for (const item of ITEMS.filter((i) => i.block !== undefined || i.category === 'tool')) {
      for (const def of solidBlocks) {
        const { interaction, events, aim } = setup(item.key, def.key);
        const hit = aim(true);
        if (!hit) continue;
        const outcome = interaction.use(hit, true);
        if ((outcome === 'none' || outcome === 'refused') && events.length === 0) silent.push(`${item.key} on ${def.key} -> ${outcome}`);
      }
    }
    expect(silent).toEqual([]);
  });
});

describe('Mining sweep: every block with every kind of tool', () => {
  const TOOLS: Array<string | null> = [null, 'wooden_pickaxe', 'iron_pickaxe', 'iron_axe', 'iron_shovel', 'iron_hoe', 'flint_hammer', 'iron_maul', 'power_drill'];

  it('a block either breaks or the first swing says why it will not', () => {
    const stalled: string[] = [];
    for (const toolKey of TOOLS.filter((k) => k === null || itemOrNull(k) !== null)) {
      for (const def of solidBlocks) {
        const { world, player, interaction, events, aim } = setup(toolKey, def.key);
        player.dev = false;
        let t = 0;
        let broke = false;
        while (t < 40 && !broke) {
          const before = interaction.edits;
          interaction.updateMining(DT, true, aim(false));
          t += DT;
          broke = interaction.edits !== before;
        }
        void world;
        if (!broke && !events.some((e) => e.type === 'toast')) stalled.push(`${toolKey ?? 'hand'} on ${def.key}`);
      }
    }
    expect(stalled).toEqual([]);
  });
});

describe('refusals explain themselves', () => {
  it('a block placed into the player says so', () => {
    const { player, interaction, events, world } = setup('stone');
    world.put(1, 11, 0, 'stone');
    const hit = raycast(world, player.position.x, player.eyeY, player.position.z, 1.5 - player.position.x, 11.5 - player.eyeY, 0.5 - player.position.z, REACH, false, createRayHit());
    expect(hit).not.toBeNull();
    // The aimed face looks at the player, so the cell a block would go into is the one the player's head is in.
    expect(interaction.use(hit)).toBe('refused');
    expect(events.some((e) => e.type === 'toast' && /in the way/.test((e.e as { text: string }).text))).toBe(true);
  });

  it('a block aimed past the top of the world says so', () => {
    const { interaction, events, aim, world } = setup('stone', 'stone');
    const hit = aim(true)!;
    world.put(hit.x, WORLD_HEIGHT - 1, hit.z, 'stone');
    hit.y = WORLD_HEIGHT - 1;
    hit.py = WORLD_HEIGHT;
    hit.face = Face.PY;
    expect(interaction.use(hit)).toBe('refused');
    expect(events.some((e) => e.type === 'toast' && /edge of the world/.test((e.e as { text: string }).text))).toBe(true);
  });

  it('a hoe on sand says where a hoe works, a pickaxe on stone points at Mine', () => {
    expect(noUseAdvice(itemOrNull('iron_hoe')!, block('sand'))).toMatch(/hoe only tills dirt and grass/);
    expect(noUseAdvice(itemOrNull('iron_pickaxe')!, block('stone'))).toMatch(/hold Mine/);
    expect(noUseAdvice(itemOrNull('coal')!, block('stone'))).toMatch(/does nothing on Stone/);
  });

  it('bare hands stay quiet, and the last-resort hook (the elixir) goes before the toast', () => {
    const quiet = setup(null, 'stone');
    expect(quiet.interaction.use(quiet.aim(false))).toBe('none');
    expect(quiet.events).toHaveLength(0);

    const held = setup('coal', 'stone');
    held.interaction.lastResort = () => 'drank';
    expect(held.interaction.use(held.aim(false))).toBe('drank');
    expect(held.events).toHaveLength(0);
  });

  it('the same hint is not repeated on every press', () => {
    const { interaction, events, aim } = setup('coal', 'stone');
    interaction.use(aim(false));
    interaction.use(aim(false));
    expect(events.filter((e) => e.type === 'toast')).toHaveLength(1);
  });
});
