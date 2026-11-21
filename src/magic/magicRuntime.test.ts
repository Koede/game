import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { BLOCKS, block, blockId } from '../core/registry';
import { Face, makeVoxel, voxelActive, voxelId, type IWorld, type Voxel } from '../core/types';
import { PlayerState } from '../game/playerState';
import { jarsFor } from './essentiaNet';
import { Magic, STUDY_LORE, WARD_SCALE, type MagicTarget } from './magic';
import { NODE_POOL, nodeInChunk, nodesNear } from './nodes';
import { RESEARCH } from './entries';

/** A stone floor at y=0, air above; cells set by `put`. */
function setup() {
  const bus = createBus();
  const cells = new Map<string, Voxel>();
  const world = {
    getVoxel: (x: number, y: number, z: number): Voxel => cells.get(`${x},${y},${z}`) ?? (y <= 0 ? makeVoxel(blockId('stone')) : 0),
    getBlock: (x: number, y: number, z: number) => BLOCKS[voxelId(world.getVoxel(x, y, z))],
    setVoxel: (x: number, y: number, z: number, v: Voxel) => {
      const from = world.getVoxel(x, y, z);
      cells.set(`${x},${y},${z}`, v);
      bus.emit('block:changed', { x, y, z, from, to: v, source: 'sim' });
      return true;
    },
    isLoaded: () => true,
    surfaceY: () => 0,
  } as unknown as IWorld;
  const player = new PlayerState(bus, { x: 0.5, y: 1, z: 0.5 });
  const cranked: string[] = [];
  let fire = 10;
  let stoked = 0;
  const magic = new Magic(world, bus, player, {
    crank: (x, y, z) => (cranked.push(`${x},${y},${z}`), true),
    furnaceFire: () => fire,
    stokeFurnace: (_x, _y, _z, s) => ((stoked += s), (fire += s), true),
    lightFurnace: () => null,
    purifyFlask: (_x, _y, _z, l) => l,
  }, 12345);
  const put = (x: number, y: number, z: number, key: string) => world.setVoxel(x, y, z, makeVoxel(blockId(key)));
  const hold = (item: string, count = 1): void => {
    player.inventory.clear();
    player.inventory.add(item, count);
    player.selectedSlot = 0;
  };
  const at = (x: number, y: number, z: number, face?: Face): MagicTarget => ({ x, y, z, block: world.getBlock(x, y, z), face });
  const learn = (...keys: string[]) => {
    for (const k of keys) magic.research.entries[k] = { done: true, tokens: {} };
  };
  const learnAll = () => learn(...RESEARCH.map((e) => e.key));
  return { bus, world, player, magic, put, hold, at, learn, learnAll, cranked, stoked: () => stoked, setFire: (f: number) => (fire = f) };
}

/** Pours `n` units of `aspect` into the jar at x, y, z through vials. */
function fillJar(t: ReturnType<typeof setup>, x: number, y: number, z: number, aspect: string, vials: number): void {
  for (let i = 0; i < vials; i++) {
    t.hold(`vial_${aspect}`, 1);
    expect(t.magic.use(t.at(x, y, z))).toBe('worked');
  }
}

describe('rods', () => {
  it('without an empty vial the rod charges up to its capacity; a bronze rod draws two', () => {
    const t = setup();
    t.hold('vis_rod');
    for (let i = 0; i < 40; i++) {
      t.magic.tick(0.25);
      t.magic.use(null);
    }
    expect(t.magic.charge).toBe(16);
    t.magic.charge = 0;
    t.hold('bronze_rod');
    t.magic.tick(1);
    t.magic.use(null);
    expect(t.magic.charge).toBe(2);
  });

  it('draws only primal aspects until compound draw is researched', () => {
    const t = setup();
    // Leaves and logs: Spring (compound) is richer than anything primal around here.
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) for (let y = -2; y <= 0; y++) t.put(x, y, z, 'oak_log');
    expect(['cinder', 'loam', 'brook', 'gale', 'rune', 'rift']).toContain(t.magic.richest(0, 1, 0)?.aspect);
    t.learn('compound_draw');
    expect(t.magic.richest(0, 1, 0)?.aspect).toBe('spring');
  });
});

describe('wellsprings', () => {
  it('are placed by the seed alone and some exist', () => {
    expect(nodeInChunk(7, 3, 4)).toEqual(nodeInChunk(7, 3, 4));
    expect(nodesNear(12345, 0, 0, 6).length).toBeGreaterThan(0);
  });

  it('a rod near one draws its aspect twice as fast, and the pool refills', () => {
    const t = setup();
    const node = nodesNear(12345, 0, 0, 8)[0];
    t.player.position.x = node.x + 0.5;
    t.player.position.z = node.z + 0.5;
    t.player.position.y = 1;
    t.hold('vis_rod');
    t.magic.use(null);
    expect(t.magic.nodeLeft(node.key)).toBe(NODE_POOL); // not researched: the land, not the node
    t.learn('wellsprings');
    t.magic.tick(1);
    t.magic.charge = 0;
    t.magic.use(null);
    expect(t.magic.charge).toBe(2);
    expect(t.magic.nodeLeft(node.key)).toBe(NODE_POOL - 2);
    t.magic.tick(60);
    expect(t.magic.nodeLeft(node.key)).toBe(NODE_POOL);
  });
});

describe('tubes, desk and altar', () => {
  it('tubes join far jars to a consumer', () => {
    const t = setup();
    t.put(10, 1, 0, 'essentia_jar');
    for (let x = 1; x <= 9; x++) t.put(x, 1, 0, 'essentia_tube');
    const blockAt = (x: number, y: number, z: number) => t.world.getBlock(x, y, z).key;
    expect(jarsFor(blockAt, 0, 1, 0, 3)).toEqual([[10, 1, 0]]);
    expect(jarsFor(blockAt, 0, 1, 5, 3)).toEqual([]);
  });

  it('the rune desk makes a bronze rod from ingredients and essentia, after the research', () => {
    const t = setup();
    t.put(2, 1, 0, 'rune_desk');
    t.put(3, 1, 0, 'essentia_jar');
    t.put(3, 1, 1, 'essentia_jar');
    fillJar(t, 3, 1, 0, 'gale', 1);
    fillJar(t, 3, 1, 1, 'loam', 1);
    const desk = t.magic.desk(2, 1, 0);
    const row = () => desk.rows().find((r) => r.id === 'bronze_rod')!;
    expect(row().problem).toMatch(/Research/);
    t.learn('bronze_rod');
    t.player.inventory.clear();
    t.player.inventory.add('vis_rod', 1);
    t.player.inventory.add('bronze_ingot', 2);
    expect(row().problem).toMatch(/Not enough essentia: Rune 2/);
    t.player.inventory.add('vial_rune', 1);
    expect(row().problem).toBeNull();
    expect(desk.make('bronze_rod')).toMatch(/Made/);
    expect(t.player.inventory.count('bronze_rod')).toBe(1);
    expect(t.player.inventory.count('vial_rune')).toBe(0);
    expect(t.magic.jarText(3, 1, 0)).toMatch(/empty/);
  });

  it('an altar with pedestals infuses a scrying lens from nearby jars', () => {
    const t = setup();
    t.learnAll();
    t.put(0, 1, 0, 'infusion_altar');
    t.put(2, 1, 0, 'arcane_pedestal');
    t.put(-2, 1, 0, 'arcane_pedestal');
    for (const [z, a] of [[2, 'vein'], [-2, 'mind'], [3, 'clarity']] as const) {
      t.put(0, 1, z, 'essentia_jar');
      fillJar(t, 0, 1, z, a, 2);
    }
    t.hold('glass');
    t.magic.use(t.at(0, 1, 0));
    t.hold('copper_ingot', 2);
    t.magic.use(t.at(2, 1, 0));
    t.magic.use(t.at(-2, 1, 0));
    expect(t.magic.matchInfusion(0, 1, 0)?.id).toBe('vein_lens');
    t.hold('vis_rod');
    expect(t.magic.use(t.at(0, 1, 0))).toBe('worked');
    expect(voxelActive(t.world.getVoxel(0, 1, 0))).toBe(true);
    for (let i = 0; i < 200; i++) t.magic.tick(0.1);
    expect(t.magic.altarText(0, 1, 0)).toBe('Infusion Altar - Scrying Lens');
    t.player.inventory.clear();
    t.magic.use(t.at(0, 1, 0));
    expect(t.player.inventory.count('vein_lens')).toBe(1);
    expect(t.magic.displays()).toEqual([]);
  });
});

describe('foci', () => {
  it('cost charge; ward halves damage; light sets a light; blink moves you', () => {
    const t = setup();
    t.hold('focus_ward');
    t.player.inventory.add('vis_rod', 1);
    expect(t.magic.use(null)).toBe('refused');
    t.magic.charge = 16;
    expect(t.magic.use(null)).toBe('worked');
    expect(t.magic.charge).toBe(10);
    t.player.damage(4, 'fall');
    expect(t.player.health).toBe(20 - 4 * WARD_SCALE);
    for (let i = 0; i < 40; i++) t.magic.tick(1);
    expect(t.player.damageScale).toBe(1);
    t.hold('focus_light');
    t.player.inventory.add('vis_rod', 1);
    expect(t.magic.use(t.at(3, 0, 3, Face.PY))).toBe('worked');
    expect(t.world.getBlock(3, 1, 3).key).toBe('magic_light');
    t.hold('focus_blink');
    t.player.inventory.add('vis_rod', 1);
    t.player.yaw = 0;
    t.player.pitch = 0;
    const z0 = t.player.position.z;
    expect(t.magic.use(null)).toBe('worked');
    expect(z0 - t.player.position.z).toBeGreaterThan(5);
  });
});

describe('servants, siphon, still and study', () => {
  it('a clay servant fed Spring cranks the crank it touches', () => {
    const t = setup();
    t.put(5, 1, 5, 'clay_servant');
    t.put(6, 1, 5, 'hand_crank');
    t.put(5, 1, 6, 'essentia_jar');
    fillJar(t, 5, 1, 6, 'spring', 1);
    t.magic.tick(1);
    expect(t.cranked).toContain('6,1,5');
    expect(t.magic.servantText(5, 1, 5)).toMatch(/cranking/);
    expect(t.magic.jarText(5, 1, 6)).toMatch(/Spring 3\//);
  });

  it('the hearth siphon feeds a low fire from a Cinder jar it touches', () => {
    const t = setup();
    t.put(1, 1, 1, 'furnace_clay');
    t.put(2, 1, 1, 'essentia_jar');
    fillJar(t, 2, 1, 1, 'cinder', 1);
    t.magic.tick(1);
    expect(t.stoked()).toBe(0);
    t.learn('hearth_siphon');
    t.magic.tick(1);
    expect(t.stoked()).toBeGreaterThan(0);
  });

  it('Clarity purifies a flask and studying a vial gives lore', () => {
    const t = setup();
    t.learn('still_clarity', 'still_trace', 'distilled_lore');
    t.hold('vial_clarity');
    expect(t.magic.use(t.at(4, 1, 4))).toBe('worked');
    expect(t.player.inventory.count('glass_vial')).toBe(1);
    t.player.inventory.add('vial_gale', 1);
    const before = t.magic.research.lore.gale ?? 0;
    expect(t.magic.notebook().study('vial_gale')).toMatch(/Studied/);
    expect(t.magic.research.lore.gale).toBe(before + STUDY_LORE);
  });

  it('saves and loads every part of the state', () => {
    const t = setup();
    t.learnAll();
    t.put(0, 1, 0, 'infusion_altar');
    t.put(2, 1, 0, 'arcane_pedestal');
    t.hold('glass');
    t.magic.use(t.at(0, 1, 0));
    t.hold('copper_ingot');
    t.magic.use(t.at(2, 1, 0));
    t.put(5, 1, 5, 'clay_servant');
    t.magic.charge = 7;
    const snap = JSON.parse(JSON.stringify(t.magic.toJSON()));
    const u = setup();
    u.magic.load(snap);
    expect(u.magic.toJSON()).toEqual(snap);
    expect(u.magic.displays().length).toBe(2);
    u.magic.load({ pedestals: [[1, 2, 3, 'nope']], charge: 'x', servants: 'bad' });
    expect(u.magic.displays()).toEqual([]);
    expect(block('magic_light').light).toBeGreaterThan(0);
  });
});
