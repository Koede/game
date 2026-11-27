import { describe, expect, it } from 'vitest';
import { REACH } from '../core/constants';
import { createBus } from '../core/context';
import { blockId } from '../core/registry';
import { voxelId, type Slot } from '../core/types';
import { Interaction } from './interaction';
import type { BrewHands, BrewResult } from './brewTools';
import { PlayerPhysics } from './physics';
import { createRayHit, raycast, type RayHit } from './raycast';
import { flatWorld, makePlayer, record } from './testKit';


/** A player on a stone floor and a fake simulation that answers brewUse / placeContainer with what the test sets. */
function setup() {
  const bus = createBus();
  const world = flatWorld(bus);
  const player = makePlayer(bus);
  const calls: string[] = [];
  const answers: { use: BrewResult; place: BrewResult; furnaceTop: boolean; chem: BrewResult | null } = {
    use: { ok: true, consume: false },
    place: { ok: true, consume: true },
    furnaceTop: true,
    chem: { ok: true, consume: false, toast: 'Still Base set to 130 C' },
  };
  const brew: BrewHands = {
    brewUse: (x, y, z, held) => (calls.push(`use ${x},${y},${z} ${held}`), answers.use),
    placeContainer: (x, y, z, held) => (calls.push(`place ${x},${y},${z} ${held}`), answers.place),
    isFurnaceTop: () => answers.furnaceTop,
    chemUse: (x, y, z, held) => (calls.push(`chem ${x},${y},${z} ${held}`), answers.chem),
  };
  let swings = 0;
  const interaction = new Interaction(world, bus, player, new PlayerPhysics(world, player), { triggerSwing: () => swings++ }, () => 0, null, brew);
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

describe('brewing blocks take the tap first', () => {
  it('a still base takes a tap right after another module step: the placement cooldown does not drop it', () => {
    const { world, player, interaction, aim, calls } = setup();
    world.put(0, 10, -2, 'still_base');
    player.inventory.set(player.selectedSlot, null);
    expect(interaction.use(aim(0.5, 10.2, -1.5))).toBe('brewed');
    // The first step has just set the placement cooldown (0.15 s of game time). A slow frame rate counts that down slowly,
    // so the next tap comes in well inside it on a phone: it must still reach the base.
    expect(interaction.use(aim(0.5, 10.2, -1.5))).toBe('brewed');
    expect(calls).toEqual(['chem 0,10,-2 null', 'chem 0,10,-2 null']);
  });

  it('a drip cone on a cup is the step: brewUse is asked, one cone is taken, and nothing is placed', () => {
    const { world, player, interaction, aim, hold, calls, answers } = setup();
    world.put(0, 10, -2, 'clay_cup');
    hold({ item: 'drip_cone', count: 3 });
    answers.use = { ok: true, consume: true };
    expect(interaction.use(aim(0.5, 10.2, -1.5))).toBe('brewed');
    expect(calls).toEqual(['use 0,10,-2 drip_cone']);
    expect(player.heldStack()?.count).toBe(2);
    expect(voxelId(world.getVoxel(0, 11, -2))).toBe(0);
  });

  it('a cup in hand aimed at a cup is a refused step, not a second cup on top', () => {
    const { world, player, interaction, aim, hold, answers, bus } = setup();
    const toasts = record(bus, 'toast');
    world.put(0, 10, -2, 'clay_cup');
    hold({ item: 'clay_cup', count: 2 });
    answers.use = { ok: false, reason: 'Set a drip cone on the cup' };
    expect(interaction.use(aim(0.5, 10.2, -1.5))).toBe('refused');
    expect(player.heldStack()?.count).toBe(2);
    expect(toasts.map((t) => t.e.text)).toEqual(['Set a drip cone on the cup']);
    expect(voxelId(world.getVoxel(0, 10, -2))).toBe(blockId('clay_cup'));
  });

  it('pouring boiling water swaps the boiling bucket for the empty one in the same slot', () => {
    const { world, player, interaction, aim, hold, answers } = setup();
    world.put(0, 10, -2, 'cup_cone_loaded');
    hold({ item: 'boiling_pail', count: 1, durability: 60 });
    answers.use = { ok: true, consume: true, give: 'pail' };
    interaction.use(aim(0.5, 10.2, -1.5));
    expect(player.heldStack()).toEqual({ item: 'pail', count: 1 });
  });

  it('taking the drink gives it to the pack and keeps the empty hand; a boiling bucket keeps its seconds left', () => {
    const { world, player, interaction, aim, answers } = setup();
    world.put(0, 10, -2, 'cup_full');
    answers.use = { ok: true, consume: false, give: 'light_roast' };
    interaction.use(aim(0.5, 10.2, -1.5));
    expect(player.inventory.count('light_roast')).toBe(1);

    world.put(1, 10, -2, 'furnace_bucket_boiling');
    answers.use = { ok: true, consume: false, give: 'boiling_pail', giveDurability: 90 };
    interaction.updateMining(1, false, null);
    interaction.use(aim(1.5, 10.2, -1.5));
    const slot = player.inventory.slots.find((s) => s?.item === 'boiling_pail');
    expect(slot?.durability).toBe(90);
  });

  it('a repeated Use while the button is held does one step per press delay', () => {
    const { world, interaction, aim, calls } = setup();
    world.put(0, 10, -2, 'clay_cup');
    interaction.use(aim(0.5, 10.2, -1.5));
    interaction.use(aim(0.5, 10.2, -1.5));
    expect(calls).toHaveLength(1);
    interaction.updateMining(0.2, false, null);
    interaction.use(aim(0.5, 10.2, -1.5));
    expect(calls).toHaveLength(2);
  });
});

describe('the kettle', () => {
  it('an empty bucket asks the simulation (a boiling kettle fills it); a water bucket asks it too, to be poured in', () => {
    const { world, interaction, aim, hold, calls, answers } = setup();
    world.put(0, 10, -2, 'kettle_pot');
    hold({ item: 'pail', count: 1 });
    answers.use = { ok: false, reason: 'The kettle is not boiling yet' };
    expect(interaction.use(aim(0.5, 10.2, -1.5))).toBe('refused');
    expect(calls).toEqual(['use 0,10,-2 pail']);
    interaction.updateMining(0.2, false, null);
    hold({ item: 'water_pail', count: 1 });
    answers.use = { ok: false, reason: 'The kettle is full' };
    interaction.use(aim(0.5, 10.2, -1.5));
    expect(calls).toEqual(['use 0,10,-2 pail', 'use 0,10,-2 water_pail']);
  });
});

describe('a water container aimed at a furnace top', () => {
  it('is set down by the simulation (the cell above), never poured as a source', () => {
    const { world, player, interaction, aim, hold, calls } = setup();
    world.put(0, 10, -2, 'furnace_clay');
    hold({ item: 'water_pail', count: 1 });
    expect(interaction.use(aim(0.5, 11, -1.5))).toBe('placed');
    expect(calls).toEqual(['place 0,11,-2 water_pail']);
    expect(player.inventory.count('water_pail')).toBe(0);
    expect(voxelId(world.getVoxel(0, 11, -2))).toBe(0);
  });

  it('on any other block it pours a water source as before', () => {
    const { world, interaction, aim, hold, answers, calls } = setup();
    answers.furnaceTop = false;
    world.put(0, 10, -2, 'stone');
    hold({ item: 'water_pail', count: 1 });
    expect(interaction.use(aim(0.5, 11, -1.5))).toBe('pail');
    expect(calls).toEqual([]);
  });

  it('on the side of the furnace the bucket is not set down', () => {
    const { world, interaction, aim, hold, calls } = setup();
    world.put(0, 10, -2, 'furnace_clay');
    hold({ item: 'water_pail', count: 1 });
    interaction.use(aim(0.5, 10.5, -1.01));
    expect(calls).toEqual([]);
  });
});

describe('drinking comes after the screens and before eating and placing', () => {
  it('a held cup of coffee is drunk in the open: Swift starts and the clay cup comes back', () => {
    const { player, interaction, hold } = setup();
    hold({ item: 'light_roast', count: 1 });
    expect(interaction.use(null)).toBe('drank');
    expect(player.buffs.has('swift')).toBe(true);
    expect(player.heldStack()).toEqual({ item: 'clay_cup', count: 1 });
  });

  it('a second tap inside the cooldown is refused without a toast', () => {
    const { player, interaction, hold, bus } = setup();
    hold({ item: 'light_roast', count: 2 });
    interaction.use(null);
    hold({ item: 'light_roast', count: 1 });
    const toasts = record(bus, 'toast');
    expect(interaction.use(null)).toBe('refused');
    expect(toasts).toHaveLength(0);
    expect(player.heldStack()?.item).toBe('light_roast');
  });

  it('aimed at a furnace the furnace screen opens, the drink stays in hand', () => {
    const { world, player, interaction, aim, hold, bus } = setup();
    const opened = record(bus, 'ui:open');
    world.put(0, 10, -2, 'furnace_clay');
    hold({ item: 'light_roast', count: 1 });
    expect(interaction.use(aim(0.5, 10.5, -1.01))).toBe('screen');
    expect(opened).toHaveLength(1);
    expect(player.heldStack()?.item).toBe('light_roast');
  });
});

