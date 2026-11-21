import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, createInputState } from '../core/context';
import { EAT_COOLDOWN_S, FOOD_COST_PER_BLOCK_MINED, FOOD_COST_PER_JUMP, HUNGRY_AT, MAX_FOOD, REACH } from '../core/constants';
import { createBus } from '../core/context';
import { block, blockOf } from '../core/registry';
import { AIR, Face, makeVoxel, type Slot } from '../core/types';
import { PlayerController } from './controller';
import { Interaction, digSound, screenFor } from './interaction';
import { PlayerPhysics } from './physics';
import { createRayHit, raycast, type RayHit } from './raycast';
import { Script, StubView, flatWorld, makePlayer, record } from './testKit';

const DT = 1 / 60;

/** A player at (0.5, 10, 0.5) on a grass field (top surface y = 10). */
function setup() {
  const bus = createBus();
  const world = flatWorld(bus, 'grass');
  const player = makePlayer(bus);
  const physics = new PlayerPhysics(world, player);
  const interaction = new Interaction(world, bus, player, physics, { triggerSwing: () => undefined }, () => 0);
  const hit = createRayHit();
  const aim = (x: number, y: number, z: number): RayHit | null => {
    const ex = player.position.x;
    const ey = player.eyeY;
    const ez = player.position.z;
    return raycast(world, ex, ey, ez, x - ex, y - ey, z - ez, REACH, false, hit);
  };
  /** The top face of the floor block two cells north of the player. */
  const aimFloor = (): RayHit | null => aim(0.5, 9.95, -1.5);
  const hold = (slot: Slot): void => player.inventory.set(player.selectedSlot, slot);
  /** Lets cooldowns pass (the interaction's own and the bite cooldown the hunger tick counts down). */
  const wait = (seconds: number): void => {
    interaction.updateMining(seconds, false, null);
    player.eatCooldownS = Math.max(0, player.eatCooldownS - seconds);
  };
  const events = record(bus, 'sfx', 'toast', 'flag', 'block:placed', 'player:ate', 'ui:open', 'block:broken');
  const sounds = () => events.filter((e) => e.type === 'sfx').map((e) => (e.e as { name: string }).name);
  const toasts = () => events.filter((e) => e.type === 'toast').map((e) => (e.e as { text: string }).text);
  const of = (type: string) => events.filter((e) => e.type === type).map((e) => e.e);
  return { bus, world, player, physics, interaction, aim, aimFloor, hold, wait, sounds, toasts, of };
}

/** Mines a hand-made hit until something breaks (or `maxS` passes). */
function mine(interaction: Interaction, hit: RayHit, maxS = 5): boolean {
  for (let t = 0; t < maxS; t += DT) {
    const before = interaction.edits;
    interaction.updateMining(DT, true, hit);
    if (interaction.edits !== before) return true;
  }
  return false;
}

function hitAt(world: ReturnType<typeof flatWorld>, x: number, y: number, z: number, face = Face.PY): RayHit {
  const v = world.getVoxel(x, y, z);
  return { x, y, z, face, px: x, py: y + 1, pz: z, voxel: v, block: blockOf(v), distance: 2 };
}

describe('Use with a hoe', () => {
  it('tills the top of grass into farmland, wears the hoe, flags and sounds', () => {
    const r = setup();
    r.hold({ item: 'flint_hoe', count: 1, durability: 64 });
    expect(r.interaction.use(r.aimFloor())).toBe('tilled');
    expect(blockOf(r.world.getVoxel(0, 9, -2)).key).toBe('farmland');
    expect(r.player.heldStack()!.durability).toBe(63);
    expect(r.of('flag')).toEqual([{ flag: 'tilled' }]);
    expect(r.sounds()).toEqual(['till']);
    expect(r.interaction.edits).toBe(1);
  });

  it('dirt too; not farmland again, not stone, not from the side (with a hint)', () => {
    const r = setup();
    r.hold({ item: 'bronze_hoe', count: 1, durability: 192 });
    r.world.put(0, 9, -2, 'dirt');
    expect(r.interaction.use(r.aimFloor())).toBe('tilled');
    r.wait(1);
    expect(r.interaction.use(r.aimFloor())).toBe('none');
    r.world.put(0, 9, -2, 'stone');
    expect(r.interaction.use(r.aimFloor())).toBe('none');
    r.world.put(0, 10, -2, 'grass');
    expect(r.interaction.use(r.aim(0.5, 10.5, -1.5))).toBe('none');
    expect(r.toasts()).toEqual(['Till the soil from above: aim at its top']);
    expect(r.world.getBlock(0, 10, -2).key).toBe('grass');
  });

  it('keeps a short repeat delay between tilled blocks', () => {
    const r = setup();
    r.hold({ item: 'flint_hoe', count: 1, durability: 64 });
    expect(r.interaction.use(r.aimFloor())).toBe('tilled');
    expect(r.interaction.use(r.aim(0.5, 9.95, -2.5))).toBe('refused');
    r.wait(0.2);
    expect(r.interaction.use(r.aim(0.5, 9.95, -2.5))).toBe('tilled');
  });
});

describe('planting', () => {
  it('seeds on farmland plant the stage-0 crop with the plant sound', () => {
    const r = setup();
    r.world.put(0, 9, -2, 'farmland');
    r.hold({ item: 'wheat_seeds', count: 4 });
    expect(r.interaction.use(r.aimFloor())).toBe('planted');
    expect(r.world.getBlock(0, 10, -2).key).toBe('wheat_0');
    expect(r.player.heldStack()!.count).toBe(3);
    expect(r.of('block:placed')).toEqual([{ x: 0, y: 10, z: -2, voxel: makeVoxel(block('wheat_0').id) }]);
    expect(r.sounds()).toEqual(['plant']);
  });

  it('seeds on grass are refused with a hint about tilling', () => {
    const r = setup();
    r.hold({ item: 'wheat_seeds', count: 4 });
    expect(r.interaction.use(r.aimFloor())).toBe('refused');
    expect(r.world.getVoxel(0, 10, -2)).toBe(AIR);
    expect(r.toasts()[0]).toMatch(/Wheat Seeds can only be planted on farmland - till grass or dirt with a hoe/);
  });

  it('a potato is planted when aimed at farmland and eaten otherwise', () => {
    const r = setup();
    r.player.food = 10;
    r.world.put(0, 9, -2, 'farmland');
    r.hold({ item: 'potato', count: 5 });
    expect(r.interaction.use(r.aimFloor())).toBe('planted');
    expect(r.world.getBlock(0, 10, -2).key).toBe('potato_0');
    expect(r.player.food).toBe(10);
    r.wait(1);
    // Grass beside it: no farmland, so Use eats it.
    expect(r.interaction.use(r.aim(0.5, 9.95, -0.6))).toBe('ate');
    expect(r.player.food).toBe(11);
    expect(r.of('player:ate')).toEqual([{ item: 'potato', hunger: 1 }]);
    expect(r.player.heldStack()!.count).toBe(3);
    expect(r.sounds()).toEqual(['plant', 'eat']);
  });
});

describe('eating with Use', () => {
  it('eats looking at the sky, at a block, or at a crop - but opens a station instead', () => {
    const r = setup();
    r.player.food = 2;
    r.hold({ item: 'bread', count: 5 });
    expect(r.interaction.use(null)).toBe('ate');
    expect(r.player.food).toBe(8);
    r.wait(EAT_COOLDOWN_S);
    expect(r.interaction.use(r.aimFloor())).toBe('ate');
    r.wait(EAT_COOLDOWN_S);
    r.world.put(0, 10, -2, 'wheat_2');
    expect(r.interaction.use(r.aim(0.5, 10.5, -1.5))).toBe('ate');
    expect(r.of('ui:open')).toEqual([]);
    r.wait(EAT_COOLDOWN_S);
    r.world.put(0, 10, -2, 'furnace_clay');
    expect(r.interaction.use(r.aim(0.5, 10.5, -1.5))).toBe('screen');
    expect(r.of('ui:open')).toEqual([{ screen: { type: 'furnace', x: 0, y: 10, z: -2 } }]);
    expect(r.player.heldStack()!.count).toBe(2);
    expect(r.of('flag')).toEqual([{ flag: 'ate' }, { flag: 'ate' }, { flag: 'ate' }]);
  });

  it('bites wait for the cooldown; a full stomach is refused with one toast', () => {
    const r = setup();
    r.player.food = MAX_FOOD - 3;
    r.hold({ item: 'carrot', count: 5 });
    expect(r.interaction.use(null)).toBe('ate');
    expect(r.interaction.use(null)).toBe('refused');
    expect(r.toasts()).toEqual([]);
    r.wait(EAT_COOLDOWN_S);
    expect(r.interaction.use(null)).toBe('refused');
    expect(r.interaction.use(null)).toBe('refused');
    expect(r.toasts()).toEqual(['You are full']);
    expect(r.player.heldStack()!.count).toBe(4);
  });

  it('non-food items are not eaten and the dead do not eat', () => {
    const r = setup();
    r.player.food = 5;
    r.hold({ item: 'wheat', count: 5 });
    expect(r.interaction.use(null)).toBe('none');
    r.hold({ item: 'bread', count: 5 });
    r.player.dead = true;
    expect(r.interaction.use(null)).toBe('none');
    expect(r.player.food).toBe(5);
  });
});

describe('crops are machine blocks without a screen', () => {
  it('no screen, a soft dig sound, nothing happens on an empty-handed Use', () => {
    const r = setup();
    for (const key of ['wheat_0', 'potato_2', 'carrot_3']) {
      expect(screenFor(block(key), 0, 0, 0)).toBeNull();
      expect(digSound(block(key))).toBe('dig_sand');
    }
    expect(digSound(block('farmland'))).toBe('dig_dirt');
    expect(screenFor(block('crusher'), 1, 2, 3)).toEqual({ type: 'machine', x: 1, y: 2, z: 3 });
    r.world.put(0, 10, -2, 'wheat_1');
    expect(r.interaction.use(r.aim(0.5, 10.5, -1.5))).toBe('none');
    expect(r.of('ui:open')).toEqual([]);
  });

  it('breaking a ripe crop harvests it with the harvest sound; an unripe one returns its seed', () => {
    const r = setup();
    r.world.put(0, 9, -2, 'farmland');
    r.world.put(0, 10, -2, 'wheat_3');
    expect(mine(r.interaction, hitAt(r.world, 0, 10, -2))).toBe(true);
    r.player.ground.drain(r.player);
    expect(r.player.inventory.count('wheat')).toBeGreaterThanOrEqual(1);
    expect(r.player.inventory.count('wheat_seeds')).toBeGreaterThanOrEqual(1);
    expect(r.sounds()).toContain('harvest');
    expect(r.sounds()).not.toContain('break');
    expect(r.sounds()).not.toContain('dig_metal');
    r.wait(1);
    r.world.put(0, 10, -2, 'carrot_1');
    const before = r.sounds().length;
    expect(mine(r.interaction, hitAt(r.world, 0, 10, -2))).toBe(true);
    r.player.ground.drain(r.player);
    expect(r.player.inventory.count('carrot')).toBe(1);
    expect(r.sounds().slice(before)).toEqual(['dig_sand', 'break']);
  });

  it('a crop pops when its farmland is dug away', () => {
    const r = setup();
    r.world.put(0, 9, -2, 'farmland');
    r.world.put(0, 10, -2, 'potato_3');
    expect(mine(r.interaction, hitAt(r.world, 0, 9, -2, Face.PZ))).toBe(true);
    expect(r.world.getVoxel(0, 9, -2)).toBe(AIR);
    expect(r.world.getVoxel(0, 10, -2)).toBe(AIR);
    r.player.ground.drain(r.player);
    expect(r.player.inventory.count('dirt')).toBe(1);
    expect(r.player.inventory.count('potato')).toBeGreaterThanOrEqual(2);
    const broken = r.of('block:broken') as Array<{ y: number; voxel: number }>;
    expect(broken.map((b) => [b.y, blockOf(b.voxel).key])).toEqual([[9, 'farmland'], [10, 'potato_3']]);
    expect(r.sounds()).toContain('harvest');
  });

  it('tall grass on dug-out soil pops too', () => {
    const r = setup();
    r.world.put(0, 10, -2, 'tall_grass');
    expect(mine(r.interaction, hitAt(r.world, 0, 9, -2, Face.PZ))).toBe(true);
    expect(r.world.getVoxel(0, 10, -2)).toBe(AIR);
  });
});

describe('effort and hunger', () => {
  it('every mined block costs food', () => {
    const r = setup();
    r.world.put(0, 10, -2, 'dirt');
    expect(mine(r.interaction, hitAt(r.world, 0, 10, -2, Face.PZ))).toBe(true);
    expect(r.player.food).toBeCloseTo(MAX_FOOD - FOOD_COST_PER_BLOCK_MINED, 9);
  });

  it('a Hungry player cannot sprint', () => {
    const r = setup();
    const forward = { moveX: 0, moveZ: 1, jump: false, sprint: true };
    r.physics.step(DT, forward);
    expect(r.physics.result.sprinting).toBe(true);
    expect(r.player.sprinting).toBe(true);
    r.player.food = HUNGRY_AT;
    r.physics.step(DT, forward);
    expect(r.physics.result.sprinting).toBe(false);
    expect(r.player.sprinting).toBe(false);
    r.player.food = HUNGRY_AT + 0.5;
    r.physics.step(DT, forward);
    expect(r.player.sprinting).toBe(true);
    r.physics.step(DT, { ...forward, sprint: false });
    expect(r.player.sprinting).toBe(false);
  });

  it('jumps cost food; asking to sprint while Hungry says why, once', () => {
    const bus = createBus();
    const world = flatWorld(bus);
    const player = makePlayer(bus);
    const input = new Script();
    const controller = new PlayerController({
      world, bus, player, view: new StubView(), input, settings: { ...DEFAULT_SETTINGS }, state: createInputState(), rng: () => 0,
    });
    const toasts = record(bus, 'toast');
    input.next.jump = true;
    controller.update(DT);
    input.next.jump = false;
    for (let i = 0; i < 90; i++) controller.update(DT);
    expect(player.food).toBeCloseTo(MAX_FOOD - FOOD_COST_PER_JUMP, 9);

    player.food = 3;
    input.next.moveZ = 1;
    input.next.sprint = true;
    for (let i = 0; i < 30; i++) controller.update(DT);
    input.next.sprint = false;
    controller.update(DT);
    input.next.sprint = true;
    for (let i = 0; i < 30; i++) controller.update(DT);
    expect(player.sprinting).toBe(false);
    expect(toasts.map((t) => t.e.text)).toEqual(['Too hungry to sprint - eat something']);
  });
});
