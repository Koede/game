import { describe, expect, it } from 'vitest';
import { emptyVis, primalsOf, type Vis } from './vis';
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

describe('late aspects', () => {
  it('draws spark only when the spark flag is set', () => {
    const t = setup();
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) for (let y = -2; y <= 4; y++) t.put(x, y, z, 'furnace_plasma');
    expect(t.magic.richest(0, 1, 0)).toBeNull();
    t.learn('compound_draw');
    expect(t.magic.richest(0, 1, 0)?.aspect).toBe('glow');
    const only = setup();
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) for (let y = -2; y <= 4; y++) only.put(x, y, z, 'furnace_plasma');
    only.magic.research.flags = ['spark'];
    expect(only.magic.richest(0, 1, 0)?.aspect).toBe('spark');
  });
});

describe('rods', () => {
  it('the rod fills primal vis pools up to its capacity; a bronze rod draws two', () => {
    const t = setup();
    t.hold('vis_rod');
    for (let i = 0; i < 80; i++) {
      t.magic.tick(0.25);
      t.magic.use(null);
    }
    const pools = Object.values(t.magic.vis);
    expect(Math.max(...pools)).toBe(16);
    expect(pools.every((n) => n <= 16)).toBe(true);
    t.magic.vis = emptyVis();
    t.hold('bronze_rod');
    t.magic.tick(1);
    t.magic.use(null);
    expect(Math.max(...Object.values(t.magic.vis))).toBe(2);
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
    t.magic.vis = emptyVis();
    t.magic.use(null);
    for (const p of Object.keys(primalsOf({ [node.aspect]: 1 })) as (keyof Vis)[]) expect(t.magic.vis[p]).toBe(2);
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

  it('the rune desk makes a bronze rod from ingredients and rod vis, after the research', () => {
    const t = setup();
    t.put(2, 1, 0, 'rune_desk');
    const desk = t.magic.desk(2, 1, 0);
    const row = () => desk.rows().find((r) => r.id === 'bronze_rod')!;
    expect(row().problem).toMatch(/Research/);
    t.learn('bronze_rod');
    t.player.inventory.clear();
    t.player.inventory.add('vis_rod', 1);
    t.player.inventory.add('bronze_ingot', 2);
    t.magic.vis = { ...emptyVis(), gale: 4, loam: 4 };
    expect(row().problem).toMatch(/Not enough vis in your rod: Rune 2/);
    t.magic.vis.rune = 3;
    expect(row().problem).toBeNull();
    expect(desk.make('bronze_rod')).toMatch(/Made/);
    expect(t.player.inventory.count('bronze_rod')).toBe(1);
    expect(t.magic.vis).toEqual({ ...emptyVis(), rune: 1 });
  });

  it('the arcane workbench shows only its own recipes; sanity soap is made there with vis and lifts warp', () => {
    const t = setup();
    t.put(2, 1, 0, 'arcane_workbench');
    expect(t.magic.use(t.at(2, 1, 0))).toBe('screen');
    const bench = t.magic.desk(2, 1, 0, true);
    const desk = t.magic.desk(2, 1, 0);
    expect(bench.rows().map((r) => r.id)).toEqual(['sanity_soap']);
    expect(desk.rows().some((r) => r.id === 'sanity_soap')).toBe(false);
    t.learn('arcane_bench');
    t.player.inventory.clear();
    t.player.inventory.add('vis_rod', 1);
    t.player.inventory.add('charcoal', 1);
    t.player.inventory.add('clay', 1);
    t.magic.vis = { ...emptyVis(), brook: 8, rune: 8, loam: 8, rift: 8 };
    expect(bench.make('sanity_soap')).toMatch(/Made/);
    expect(t.player.inventory.count('sanity_soap')).toBe(1);
    t.hold('sanity_soap');
    expect(t.magic.use(null)).toBe('refused'); // no warp to scrub
    t.magic.addWarp(5);
    expect(t.magic.use(null)).toBe('worked');
    expect(t.magic.warp).toBe(2);
    expect(t.player.inventory.count('sanity_soap')).toBe(0);
  });

  it('warp grows from infusions and mishaps, whispers at high levels, and survives a save', () => {
    const t = setup();
    t.learnAll();
    t.magic.warp = 10;
    t.magic.rng = () => 0;
    t.player.food = 20;
    t.magic.tick(46);
    expect(t.player.food).toBeLessThan(20); // hollowness
    expect(t.magic.uneaseText()).toMatch(/air hums/);
    const u = setup();
    u.magic.load(JSON.parse(JSON.stringify(t.magic.toJSON())));
    expect(u.magic.warp).toBe(10);
    u.magic.load({});
    expect(u.magic.warp).toBe(0);
  });

  it('a hot crucible of water dissolves items into essentia, bottles vials and turns catalysts', () => {
    const t = setup();
    t.put(4, 1, 4, 'crucible');
    t.hold('copper_ore', 4);
    expect(t.magic.use(t.at(4, 1, 4))).toBe('refused'); // research first
    t.learn('crucible');
    expect(t.magic.use(t.at(4, 1, 4))).toBe('refused'); // no water
    t.hold('water_vial');
    expect(t.magic.use(t.at(4, 1, 4))).toBe('worked');
    expect(t.player.inventory.count('glass_vial')).toBe(1);
    t.hold('copper_ore', 3);
    expect(t.magic.use(t.at(4, 1, 4))).toBe('worked');
    expect(t.magic.use(t.at(4, 1, 4))).toBe('worked');
    const before = { ...t.magic.crucibleAt(4, 1, 4)!.ess };
    expect(before.vein).toBeGreaterThanOrEqual(3);
    expect(t.magic.use(t.at(4, 1, 4))).toBe('worked'); // the third ore is the catalyst
    expect(t.player.inventory.count('copper_ingot')).toBe(2);
    expect(t.magic.crucibleAt(4, 1, 4)!.ess.vein).toBe((before.vein ?? 0) - 3);
    t.hold('glass_vial');
    expect(t.magic.use(t.at(4, 1, 4))).toBe('worked');
    expect(t.player.inventory.toJSON().some((s) => s?.item.startsWith('vial_'))).toBe(true);
    t.setFire(0);
    t.hold('sand');
    expect(t.magic.use(t.at(4, 1, 4))).toBe('refused'); // cold
    const snap = JSON.parse(JSON.stringify(t.magic.toJSON()));
    const u = setup();
    u.put(4, 1, 4, 'crucible');
    u.magic.load(snap);
    expect(u.magic.crucibleAt(4, 1, 4)).toEqual(t.magic.crucibleAt(4, 1, 4));
  });

  it('unmirrored pedestals make an infusion unstable, and mishaps throw items off', () => {
    const t = setup();
    t.learnAll();
    t.put(0, 1, 0, 'infusion_altar');
    t.put(2, 1, 0, 'arcane_pedestal');
    t.put(-2, 1, 0, 'arcane_pedestal');
    t.hold('glass');
    t.magic.use(t.at(0, 1, 0));
    t.hold('copper_ingot');
    t.magic.use(t.at(2, 1, 0));
    expect(t.magic.instabilityAt(0, 1, 0)).toBe(2);
    t.hold('copper_ingot');
    t.magic.use(t.at(-2, 1, 0));
    expect(t.magic.instabilityAt(0, 1, 0)).toBe(0);
    t.put(0, 1, 2, 'arcane_pedestal');
    t.hold('copper_ingot');
    t.magic.use(t.at(0, 1, 2));
    expect(t.magic.instabilityAt(0, 1, 0)).toBe(3);
    // A lens with its two ingots set crooked (east and south): unstable 4; a mishap throws one off and the infusion breaks.
    const u = setup();
    u.learnAll();
    u.put(0, 1, 0, 'infusion_altar');
    for (const [x, z] of [[2, 0], [0, 2]] as const) {
      u.put(x, 1, z, 'arcane_pedestal');
      u.hold('copper_ingot');
      u.magic.use(u.at(x, 1, z));
    }
    u.hold('glass');
    u.magic.use(u.at(0, 1, 0));
    expect(u.magic.instabilityAt(0, 1, 0)).toBe(4);
    u.hold('vis_rod');
    expect(u.magic.use(u.at(0, 1, 0))).toBe('worked');
    u.magic.rng = () => 0;
    u.magic.tick(1);
    u.magic.tick(0.1);
    expect(u.magic.displays().length).toBe(2); // the glass and one ingot are left
    expect(u.magic.infusionAt(0, 1, 0)).toBeNull();
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
  it('cost primal vis; ward halves damage; light sets a light; blink moves you', () => {
    const t = setup();
    t.hold('focus_ward');
    t.player.inventory.add('vis_rod', 1);
    expect(t.magic.use(null)).toBe('refused');
    t.magic.vis = { ...emptyVis(), loam: 16, rune: 16, cinder: 16, gale: 16, rift: 16 };
    expect(t.magic.use(null)).toBe('worked');
    expect(t.magic.vis.loam).toBe(13);
    expect(t.magic.vis.rune).toBe(13);
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
  it('a clay servant three blocks from a crank cranks it once within 30s and never walks past 8', () => {
    const t = setup();
    t.put(0, 1, 0, 'clay_servant');
    t.put(3, 1, 0, 'hand_crank');
    t.put(0, 1, 1, 'essentia_jar');
    fillJar(t, 0, 1, 1, 'spring', 1);
    let farthest = 0;
    for (let i = 0; i < 30; i++) {
      t.magic.tick(1);
      for (let x = -1; x <= 12; x++) for (let y = 0; y <= 3; y++) for (let z = -1; z <= 3; z++) {
        if (t.world.getBlock(x, y, z).key !== 'clay_servant') continue;
        farthest = Math.max(farthest, Math.max(Math.abs(x), Math.abs(y - 1), Math.abs(z)));
      }
    }
    expect(t.cranked).toEqual(['3,1,0']);
    expect(farthest).toBeLessThanOrEqual(8);
  });

  it('a clay servant does not walk to a crank more than 8 blocks from where it was placed', () => {
    const t = setup();
    t.put(0, 1, 0, 'clay_servant');
    t.put(20, 1, 0, 'hand_crank');
    t.put(0, 1, 1, 'essentia_jar');
    fillJar(t, 0, 1, 1, 'spring', 1);
    for (let i = 0; i < 30; i++) t.magic.tick(1);
    expect(t.cranked).toEqual([]);
    expect(t.world.getBlock(0, 1, 0).key).toBe('clay_servant');
    expect(t.magic.servantText(0, 1, 0)).toMatch(/idle/);
    for (let x = 1; x <= 20; x++) expect(t.world.getBlock(x, 1, 0).key).not.toBe('clay_servant');
  });

  it('a fed servant acts once on a deployer, or offers a loose belt item once', () => {
    const calls: string[] = [];
    const workshop = {
      offer: (x: number, y: number, z: number, item: string, count: number) => {
        calls.push(`offer ${x},${y},${z} ${item} ${count}`);
        return count;
      },
      act: (a: { target: [number, number, number]; mode: string }) => {
        calls.push(`act ${a.target.join(',')} ${a.mode}`);
        return 'used' as const;
      },
    };
    const deploy = setup();
    deploy.magic.bindWorkshop(workshop);
    deploy.put(0, 1, 0, 'clay_servant');
    deploy.put(1, 1, 0, 'deployer');
    deploy.put(0, 1, 1, 'essentia_jar');
    fillJar(deploy, 0, 1, 1, 'spring', 1);
    deploy.magic.tick(1);
    for (let i = 0; i < 10; i++) deploy.magic.tick(1);
    expect(calls).toEqual(['act 1,1,-1 auto']);

    calls.length = 0;
    const belt = setup();
    belt.magic.bindWorkshop(workshop);
    belt.put(0, 1, 0, 'clay_servant');
    belt.put(1, 1, 0, 'conveyor_belt');
    belt.put(0, 1, 1, 'essentia_jar');
    fillJar(belt, 0, 1, 1, 'spring', 1);
    const [pile] = belt.player.ground.spawn('flint', 2, 1.5, 1.2, 0.5, { scatter: false, vy: 0 });
    belt.magic.tick(1);
    for (let i = 0; i < 10; i++) belt.magic.tick(1);
    expect(calls).toEqual(['offer 1,1,0 flint 1']);
    expect(pile.count).toBe(1);
  });

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
    t.magic.vis.cinder = 7;
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
