import { describe, expect, it } from 'vitest';
import { REACH } from '../core/constants';
import { createBus } from '../core/context';
import { block, blockOf } from '../core/registry';
import { AIR, Facing, voxelFacing, type Slot } from '../core/types';
import { fullDurability } from '../game';
import { Interaction, facingTowards, screenFor } from './interaction';
import { PlayerPhysics } from './physics';
import { createRayHit, raycast, type RayHit } from './raycast';
import { flatWorld, makePlayer, record } from './testKit';

const DT = 1 / 60;

/** A player at (0.5, 10, 0.5) on a stone floor, looking at what the test sets up. */
function setup(floor = 'stone') {
  const bus = createBus();
  const world = flatWorld(bus, floor);
  const player = makePlayer(bus);
  const physics = new PlayerPhysics(world, player);
  let swings = 0;
  const interaction = new Interaction(world, bus, player, physics, { triggerSwing: () => swings++ }, () => 0);
  const hit = createRayHit();
  /** Aims from the eye at the centre of a cell (or a point) and returns the hit. */
  const aim = (x: number, y: number, z: number, liquids = false): RayHit | null => {
    const ex = player.position.x;
    const ey = player.eyeY;
    const ez = player.position.z;
    return raycast(world, ex, ey, ez, x - ex, y - ey, z - ez, REACH, liquids, hit);
  };
  const hold = (slot: Slot): void => player.inventory.set(player.selectedSlot, slot);
  return { bus, world, player, physics, interaction, aim, hold, swings: () => swings };
}

/** Mines with the button held until the block breaks or `maxS` passes; returns the seconds it took. */
function mineFor(interaction: Interaction, aim: () => RayHit | null, maxS: number): number {
  let t = 0;
  while (t < maxS) {
    const before = interaction.edits;
    interaction.updateMining(DT, true, aim());
    t += DT;
    if (interaction.edits !== before) return t;
  }
  return Infinity;
}

describe('mining', () => {
  it('dirt by hand takes its hardness in seconds and drops itself', () => {
    const { bus, world, player, interaction, aim } = setup();
    world.put(0, 10, -2, 'dirt');
    const events = record(bus, 'block:mining', 'block:broken', 'item:gained', 'sfx');
    const t = mineFor(interaction, () => aim(0.5, 10.5, -1.5), 5);
    expect(t).toBeGreaterThan(0.78);
    expect(t).toBeLessThan(0.85);
    expect(world.getVoxel(0, 10, -2)).toBe(AIR);
    player.ground.drain(player);
    expect(player.inventory.count('dirt')).toBe(1);
    const mining = events.filter((x) => x.type === 'block:mining');
    expect(mining[0].e).toMatchObject({ x: 0, y: 10, z: -2, progress: 0 });
    expect(mining.length).toBeGreaterThan(5);
    expect(mining.length).toBeLessThan(12);
    const broken = events.find((x) => x.type === 'block:broken')!.e as { x: number; voxel: number };
    expect(blockOf(broken.voxel).key).toBe('dirt');
    const sounds = events.filter((x) => x.type === 'sfx').map((x) => (x.e as { name: string }).name);
    expect(sounds).toContain('dig_dirt');
    expect(sounds).toContain('break');
  });

  it('stone by hand is three times slower, drops nothing and explains why', () => {
    const { bus, world, player, interaction, aim } = setup();
    world.put(0, 10, -2, 'stone');
    const toasts = record(bus, 'toast');
    const t = mineFor(interaction, () => aim(0.5, 10.5, -1.5), 20);
    expect(t).toBeGreaterThan(11.9);
    expect(t).toBeLessThan(12.1);
    expect(player.inventory.count('rubble')).toBe(0);
    expect(toasts[0].e.text).toMatch(/wooden pickaxe/i);
  });

  it('a matching tool is faster, harvests, and wears by one', () => {
    const { world, player, interaction, aim, hold } = setup();
    world.put(0, 10, -2, 'stone');
    const full = fullDurability('flint_pickaxe')!;
    hold({ item: 'flint_pickaxe', count: 1, durability: full });
    const t = mineFor(interaction, () => aim(0.5, 10.5, -1.5), 10);
    expect(t).toBeCloseTo(2, 1);
    player.ground.drain(player);
    expect(player.inventory.count('rubble')).toBe(1);
    expect(player.heldStack()?.durability).toBe(full - 1);
  });

  it('Well-Warmed mines 25% faster', () => {
    const { world, player, interaction, aim } = setup();
    world.put(0, 10, -2, 'dirt');
    player.buffs.wellWarmedS = 100;
    const t = mineFor(interaction, () => aim(0.5, 10.5, -1.5), 5);
    expect(t).toBeCloseTo(0.8 / 1.25, 1);
  });

  it('looking away or letting go resets progress', () => {
    const { bus, world, interaction, aim } = setup();
    world.put(0, 10, -2, 'dirt');
    world.put(1, 10, -2, 'dirt');
    const events = record(bus, 'block:mining');
    for (let i = 0; i < 30; i++) interaction.updateMining(DT, true, aim(0.5, 10.5, -1.5));
    expect(interaction.progress).toBeGreaterThan(0.5);
    interaction.updateMining(DT, true, aim(1.5, 10.5, -1.5));
    expect(interaction.progress).toBeLessThan(0.1);
    expect(interaction.mx).toBe(1);
    expect(events.some((x) => x.e.progress === -1 && x.e.x === 0)).toBe(true);
    interaction.updateMining(DT, false, aim(1.5, 10.5, -1.5));
    expect(interaction.progress).toBe(-1);
  });

  it('corestone never breaks', () => {
    const { bus, world, interaction, aim } = setup();
    world.put(0, 10, -2, 'corestone');
    const toasts = record(bus, 'toast');
    expect(mineFor(interaction, () => aim(0.5, 10.5, -1.5), 30)).toBe(Infinity);
    expect(world.getBlock(0, 10, -2).key).toBe('corestone');
    expect(toasts).toHaveLength(1);
  });

  it('liquids are not mined', () => {
    const { world, interaction, aim } = setup();
    world.put(0, 10, -2, 'water');
    interaction.updateMining(DT, true, aim(0.5, 10.5, -1.5, true));
    expect(interaction.progress).toBe(-1);
  });
});

describe('use: screens', () => {
  it('opens the right screen for stations and machines', () => {
    expect(screenFor(block('workbench'), 1, 2, 3)).toEqual({ type: 'workbench', x: 1, y: 2, z: 3 });
    expect(screenFor(block('furnace_blast'), 1, 2, 3)).toEqual({ type: 'furnace', x: 1, y: 2, z: 3 });
    expect(screenFor(block('crate'), 1, 2, 3)).toEqual({ type: 'crate', x: 1, y: 2, z: 3 });
    expect(screenFor(block('thermopile'), 1, 2, 3)).toEqual({ type: 'machine', x: 1, y: 2, z: 3 });
    expect(screenFor(block('stone'), 1, 2, 3)).toBeNull();
  });

  it('using a furnace emits ui:open even while holding a block', () => {
    const { bus, world, player, interaction, aim, hold } = setup();
    world.put(0, 10, -2, 'furnace_clay');
    hold({ item: 'plank', count: 5 });
    const opens = record(bus, 'ui:open');
    expect(interaction.use(aim(0.5, 10.5, -1.5))).toBe('screen');
    expect(opens[0].e.screen).toEqual({ type: 'furnace', x: 0, y: 10, z: -2 });
    expect(player.inventory.count('plank')).toBe(5);
  });
});

describe('use: placing', () => {
  it('places the held block against the face, takes one, and emits block:placed', () => {
    const { bus, world, player, interaction, aim, hold, swings } = setup();
    world.put(0, 10, -2, 'stone');
    hold({ item: 'plank', count: 3 });
    const events = record(bus, 'block:placed', 'sfx');
    expect(interaction.use(aim(0.5, 10.5, -1.5))).toBe('placed');
    expect(world.getBlock(0, 10, -1).key).toBe('plank');
    expect(player.inventory.count('plank')).toBe(2);
    expect(events.find((x) => x.type === 'block:placed')!.e).toMatchObject({ x: 0, y: 10, z: -1 });
    expect(swings()).toBe(1);
  });

  it('never places inside the player, but a torch at the feet is fine', () => {
    const { world, interaction, aim, hold } = setup();
    hold({ item: 'plank', count: 3 });
    // Looking at the floor right under the player: the cell above it is where the player stands.
    expect(interaction.use(aim(0.5, 9.9, 0.4))).toBe('refused');
    expect(world.getBlock(0, 10, 0).key).toBe('air');
    hold({ item: 'torch', count: 3 });
    expect(interaction.use(aim(0.5, 9.9, 0.4))).toBe('placed');
    expect(world.getBlock(0, 10, 0).key).toBe('torch');
  });

  it('honours placeOn with an explanation', () => {
    const { bus, world, interaction, aim, hold } = setup();
    hold({ item: 'tall_grass', count: 2 });
    const toasts = record(bus, 'toast');
    expect(interaction.use(aim(0.5, 9.9, -2.5))).toBe('refused');
    expect(toasts[0].e.text).toMatch(/grass/i);
    world.put(0, 9, -2, 'grass');
    interaction.updateMining(1, false, null); // let the place cooldown pass
    expect(interaction.use(aim(0.5, 9.9, -1.6))).toBe('placed');
    expect(world.getBlock(0, 10, -2).key).toBe('tall_grass');
  });

  it('replaces a replaceable target (tall grass) instead of stacking on it', () => {
    const { world, interaction, aim, hold } = setup();
    world.put(0, 9, -2, 'grass');
    world.put(0, 10, -2, 'tall_grass');
    hold({ item: 'plank', count: 1 });
    expect(interaction.use(aim(0.5, 10.3, -1.5))).toBe('placed');
    expect(world.getBlock(0, 10, -2).key).toBe('plank');
  });

  it('places into water through the water surface', () => {
    const { world, interaction, aim, hold } = setup();
    world.fill(-1, 10, -4, 1, 10, -2, 'water');
    hold({ item: 'plank', count: 1 });
    expect(interaction.use(aim(0.5, 9.9, -2.5))).toBe('placed');
    expect(world.getBlock(0, 10, -3).key === 'plank' || world.getBlock(0, 10, -2).key === 'plank').toBe(true);
  });

  it('orients a furnace to face the player', () => {
    const { world, player, interaction, aim, hold } = setup();
    hold({ item: 'furnace_clay', count: 1 });
    expect(interaction.use(aim(0.5, 10, -1.5))).toBe('placed');
    expect(voxelFacing(world.getVoxel(0, 10, -2))).toBe(Facing.South);
    expect(facingTowards(0)).toBe(Facing.South);
    expect(facingTowards(Math.PI)).toBe(Facing.North);
    expect(facingTowards(Math.PI / 2)).toBe(Facing.East); // looking west -> front faces east
    expect(facingTowards(-Math.PI / 2)).toBe(Facing.West);
    expect(player.inventory.count('furnace_clay')).toBe(0);
  });

  it('has a short repeat delay', () => {
    const { world, interaction, aim, hold } = setup();
    world.put(0, 10, -3, 'stone');
    world.put(1, 10, -3, 'stone');
    hold({ item: 'plank', count: 5 });
    expect(interaction.use(aim(0.5, 10.5, -2.5))).toBe('placed');
    expect(interaction.use(aim(1.5, 10.5, -2.5))).toBe('refused');
    interaction.updateMining(0.2, false, null);
    expect(interaction.use(aim(1.5, 10.5, -2.5))).toBe('placed');
  });

  it('items that place nothing do nothing', () => {
    const { world, interaction, aim, hold } = setup();
    hold({ item: 'stick', count: 5 });
    expect(interaction.use(aim(0.5, 9.9, -2.5))).toBe('none');
    expect(world.getBlock(0, 10, -2).key).toBe('air');
  });
});

describe('use: pail', () => {
  it('scoops water into the same slot and pours it back out, returning the empty pail', () => {
    const { bus, world, player, interaction, aim, hold } = setup();
    world.put(0, 10, -2, 'water');
    hold({ item: 'pail', count: 1 });
    const sounds = record(bus, 'sfx');
    expect(interaction.use(aim(0.5, 10.5, -1.5, true))).toBe('pail');
    expect(player.heldStack()).toEqual({ item: 'water_pail', count: 1 });
    expect(world.getBlock(0, 10, -2).key).toBe('air'); // the source block is taken (spec 18.3)
    expect(sounds.some((x) => x.e.name === 'splash')).toBe(true);
    // Pour onto the floor further away.
    expect(interaction.use(aim(2.5, 9.9, -0.5))).toBe('pail');
    expect(world.getBlock(2, 10, -1).key).toBe('water');
    expect(player.heldStack()).toEqual({ item: 'pail', count: 1 });
  });

  it('refuses lava', () => {
    const { bus, world, player, interaction, aim, hold } = setup();
    world.put(0, 10, -2, 'lava');
    hold({ item: 'pail', count: 1 });
    const toasts = record(bus, 'toast');
    expect(interaction.use(aim(0.5, 10.5, -1.5, true))).toBe('refused');
    expect(player.heldStack()?.item).toBe('pail');
    expect(toasts).toHaveLength(1);
  });
});

describe('dig sound pitch', () => {
  it('rings fuller with the right tool, light with a bare hand', async () => {
    const { digPitch } = await import('./blockRules');
    const { block } = await import('../core/registry');
    const stone = block('stone');
    const bare = digPitch(stone, null);
    expect(bare).toBeGreaterThan(1);
    const pick = digPitch(stone, { item: 'flint_pickaxe', count: 1, durability: 100 } as never);
    expect(pick).toBeLessThan(bare);
  });
});
