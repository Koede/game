import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { BLOCKS, blockId } from '../core/registry';
import { makeVoxel, voxelId, type IWorld, type Voxel } from '../core/types';
import { PlayerState } from '../game/playerState';
import { Magic, ENCHANT_INFUSE_S, type MagicTarget } from './magic';
import { enchantCost } from '../core/enchant';

/** A stone floor at y=0, air above, a flat world of cells set by `put`: the altar, jars and pedestals of one test. */
function setup() {
  const bus = createBus();
  const cells = new Map<string, Voxel>();
  const world = {
    getVoxel: (x: number, y: number, z: number): Voxel => cells.get(`${x},${y},${z}`) ?? (y <= 0 ? makeVoxel(blockId('stone')) : 0),
    getBlock: (x: number, y: number, z: number) => BLOCKS[voxelId(world.getVoxel(x, y, z))],
    setVoxel: (x: number, y: number, z: number, v: Voxel) => {
      cells.set(`${x},${y},${z}`, v);
      bus.emit('block:changed', { x, y, z, from: 0, to: v, source: 'sim' });
      return true;
    },
    isLoaded: () => true,
    surfaceY: () => 0,
  } as unknown as IWorld;
  const player = new PlayerState(bus, { x: 0.5, y: 1, z: 0.5 });
  const magic = new Magic(world, bus, player, {}, 12345);
  magic.rng = () => 0.99; // no mishaps unless a test asks for them
  const put = (x: number, y: number, z: number, key: string) => world.setVoxel(x, y, z, makeVoxel(blockId(key)));
  const hold = (item: string, count = 1): void => {
    player.inventory.clear();
    player.inventory.add(item, count);
    player.selectedSlot = 0;
  };
  const at = (x: number, y: number, z: number): MagicTarget => ({ x, y, z, block: world.getBlock(x, y, z) });
  const learn = (...keys: string[]) => {
    for (const k of keys) magic.research.entries[k] = { done: true, tokens: {} };
  };
  /** Pours `vials` vials of `aspect` into the jar at x, y, z (a vial is VIAL_UNITS units). */
  const fill = (x: number, y: number, z: number, aspect: string, vials: number): void => {
    for (let i = 0; i < vials; i++) {
      hold(`vial_${aspect}`);
      expect(magic.use(at(x, y, z))).toBe('worked');
    }
  };
  const carried = (item: string) => player.inventory.toJSON().find((s) => s?.item === item) ?? null;
  return { bus, world, player, magic, put, hold, at, learn, fill, carried };
}

/** An altar at (0, 1, 0) holding `heart` (no pedestals), with a jar of `aspect` two cells away. */
function altarWith(heart: string, aspect?: string, vials = 2) {
  const t = setup();
  t.learn('infusion');
  t.put(0, 1, 0, 'infusion_altar');
  t.hold(heart);
  expect(t.magic.use(t.at(0, 1, 0))).toBe('worked');
  if (aspect) {
    t.put(0, 1, 2, 'essentia_jar');
    t.fill(0, 1, 2, aspect, vials);
  }
  return t;
}

/** Hold a rod and Use the altar: starts whatever the altar can write. */
const startWithRod = (t: ReturnType<typeof setup>) => {
  t.hold('vis_rod');
  return t.magic.use(t.at(0, 1, 0));
};

describe('altar hum', () => {
  it('hums for an aspect in the jars that the held tool can take an enchant for, and shows it on the altar', () => {
    const t = altarWith('iron_pickaxe', 'vein');
    expect(t.magic.enchantHum(0, 1, 0)).toEqual({ key: 'veinseeker', level: 1, aspect: 'vein' });
    expect(t.magic.altarText(0, 1, 0)).toMatch(/hums toward Vein/);
    expect(t.magic.displays().find((d) => d.item === 'iron_pickaxe')?.glow).toBe('vein');
  });

  it('is silent with no matching essentia, and for an item no enchant applies to', () => {
    expect(altarWith('iron_pickaxe').magic.enchantHum(0, 1, 0)).toBeNull();
    // Essentia no enchant asks for (mind): silent.
    expect(altarWith('iron_pickaxe', 'mind').magic.enchantHum(0, 1, 0)).toBeNull();
    const glass = altarWith('glass', 'vein');
    expect(glass.magic.enchantHum(0, 1, 0)).toBeNull();
    expect(glass.magic.displays().find((d) => d.item === 'glass')?.glow).toBeUndefined();
  });

  it('a heart with pedestals is a recipe matter, not an enchant', () => {
    const t = altarWith('iron_pickaxe', 'vein');
    t.put(2, 1, 0, 'arcane_pedestal');
    t.hold('copper_ingot');
    t.magic.use(t.at(2, 1, 0));
    expect(t.magic.enchantHum(0, 1, 0)).toBeNull();
  });
});

describe('enchanting at the altar', () => {
  it('a rod on a silent altar says so and starts nothing', () => {
    const t = altarWith('iron_pickaxe');
    expect(startWithRod(t)).toBe('refused');
    expect(t.magic.infusionAt(0, 1, 0)).toBeNull();
  });

  it('writes Veinseeker I from the jars, names nothing until then, and records it in the notebook once', () => {
    const t = altarWith('iron_pickaxe', 'vein');
    expect(startWithRod(t)).toBe('worked');
    const running = t.magic.infusionAt(0, 1, 0);
    expect(running?.id).toBe('enchant:veinseeker');
    expect(Object.keys(running?.missing ?? {})).toEqual(['vein']);
    for (let i = 0; i < (ENCHANT_INFUSE_S + 2) * 10; i++) t.magic.tick(0.1);
    expect(t.magic.infusionAt(0, 1, 0)).toBeNull();
    // Use the altar to take the heart back: it carries the enchant.
    t.player.inventory.clear();
    expect(t.magic.use(t.at(0, 1, 0))).toBe('worked');
    expect(t.carried('iron_pickaxe')?.enchants).toEqual({ veinseeker: 1 });
    expect(t.magic.research.entries.enchant_veinseeker?.done).toBe(true);
    const note = t.magic.notebook().entries().find((e) => e.key === 'enchant_veinseeker');
    expect(note?.status).toBe('done');
    expect(note?.learn).toEqual({ enchant: 'veinseeker' });
    expect(t.magic.stats.infusions).toBe(1);
  });

  it('the notebook note waits for the altar (infusion research) and is open, not done, until a write succeeds', () => {
    const t = setup();
    const note = () => t.magic.notebook().entries().find((e) => e.key === 'enchant_magnet');
    expect(note()?.status).toBe('locked');
    t.learn('infusion');
    expect(note()?.status).toBe('open');
    expect(note()?.learn).toEqual({ enchant: 'magnet' });
  });

  it('a second level costs twice the essentia and is less steady: the higher level is written in place', () => {
    expect(enchantCost('veinseeker', 1)).toEqual({ vein: 2 });
    expect(enchantCost('veinseeker', 2)).toEqual({ vein: 4 });
    const t = altarWith('iron_pickaxe', 'vein', 2);
    startWithRod(t);
    for (let i = 0; i < (ENCHANT_INFUSE_S + 2) * 10; i++) t.magic.tick(0.1);
    // Level 2 wants four vein: four more units in the jar next to it.
    t.fill(0, 1, 2, 'vein', 2);
    expect(t.magic.enchantHum(0, 1, 0)).toEqual({ key: 'veinseeker', level: 2, aspect: 'vein' });
    expect(startWithRod(t)).toBe('worked');
    expect(t.magic.infusionAt(0, 1, 0)?.missing.vein ?? 0).toBeGreaterThan(0);
    for (let i = 0; i < (ENCHANT_INFUSE_S + 2) * 10; i++) t.magic.tick(0.1);
    t.player.inventory.clear();
    t.magic.use(t.at(0, 1, 0));
    expect(t.carried('iron_pickaxe')?.enchants).toEqual({ veinseeker: 2 });
  });

  it('a second enchant is unsteady: a mishap drops a durable tool to durability 1 and never deletes it', () => {
    const t = altarWith('iron_pickaxe', 'vein');
    startWithRod(t);
    for (let i = 0; i < (ENCHANT_INFUSE_S + 2) * 10; i++) t.magic.tick(0.1);
    // Take the heart back (it lands in the selected slot, enchant and all) and put it on the altar again.
    t.player.inventory.clear();
    t.magic.use(t.at(0, 1, 0));
    expect(t.magic.use(t.at(0, 1, 0))).toBe('worked');
    expect(t.magic.displays().some((d) => d.item === 'iron_pickaxe')).toBe(true);
    // The vein jar is emptied of its use here (Magnet wants drive, and the leftover vein would hum for Veinseeker II first).
    t.put(0, 1, 2, 'air');
    t.put(0, 1, -2, 'essentia_jar');
    t.fill(0, 1, -2, 'drive', 2);
    expect(t.magic.enchantHum(0, 1, 0)).toEqual({ key: 'magnet', level: 1, aspect: 'drive' });
    t.magic.rng = () => 0; // every roll trips: the mishap comes on the first tick, and the branch is the durable one
    expect(startWithRod(t)).toBe('worked');
    expect(t.magic.infusionAt(0, 1, 0)?.id).toBe('enchant:magnet');
    t.magic.tick(0.1);
    expect(t.magic.displays().some((d) => d.item === 'iron_pickaxe')).toBe(true); // a mishap never takes the item
    t.magic.rng = () => 0.99;
    for (let i = 0; i < (ENCHANT_INFUSE_S + 2) * 10; i++) t.magic.tick(0.1);
    t.player.inventory.clear();
    t.magic.use(t.at(0, 1, 0));
    const pick = t.carried('iron_pickaxe');
    expect(pick).not.toBeNull();
    expect(pick?.durability).toBe(1);
    expect(pick?.enchants).toEqual({ veinseeker: 1, magnet: 1 });
  });

  it('a mishap that spares a durable tool adds warp instead', () => {
    const t = altarWith('iron_pickaxe', 'vein');
    startWithRod(t);
    for (let i = 0; i < (ENCHANT_INFUSE_S + 2) * 10; i++) t.magic.tick(0.1);
    t.player.inventory.clear();
    t.magic.use(t.at(0, 1, 0));
    t.magic.use(t.at(0, 1, 0));
    t.put(0, 1, 2, 'air');
    t.put(0, 1, -2, 'essentia_jar');
    t.fill(0, 1, -2, 'drive', 2);
    // First roll trips the mishap, the second (0.9, not under 0.5) spares the tool and adds warp instead.
    const rolls = [0, 0.9];
    t.magic.rng = () => (rolls.length ? (rolls.shift() as number) : 0.99);
    const warp = t.magic.warp;
    expect(startWithRod(t)).toBe('worked');
    t.magic.tick(0.1);
    expect(t.magic.warp).toBe(warp + 2);
    t.magic.rng = () => 0.99;
    for (let i = 0; i < (ENCHANT_INFUSE_S + 2) * 10; i++) t.magic.tick(0.1);
    t.player.inventory.clear();
    t.magic.use(t.at(0, 1, 0));
    expect(t.carried('iron_pickaxe')?.durability).toBeGreaterThan(1);
  });

  it('saves and loads a heart with its enchants and a write in progress', () => {
    const t = altarWith('iron_pickaxe', 'vein');
    t.player.inventory.clear();
    startWithRod(t);
    t.magic.tick(3);
    const snap = JSON.parse(JSON.stringify(t.magic.toJSON()));
    expect(snap.infusion.enchant).toEqual({ key: 'veinseeker', level: 1 });
    const u = setup();
    u.magic.load(snap);
    expect(u.magic.infusionAt(0, 1, 0)?.id).toBe('enchant:veinseeker');
    expect(u.magic.toJSON()).toEqual(snap);
    u.magic.load({ infusion: { x: 0, y: 1, z: 0, id: 'enchant:nope', paid: {}, t: 0, enchant: { key: 'nope', level: 9 } } });
    expect(u.magic.infusionAt(0, 1, 0)).toBeNull();
  });
});
