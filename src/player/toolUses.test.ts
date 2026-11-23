import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REACH } from '../core/constants';
import { createBus } from '../core/context';
import { block } from '../core/registry';
import { Facing, makeVoxel, voxelFacing } from '../core/types';
import { fullDurability, makeStack } from '../game';
import { Interaction } from './interaction';
import { PlayerPhysics } from './physics';
import { createRayHit, raycast, type RayHit } from './raycast';
import { TOOL_USES } from './toolUses';
import { flatWorld, makePlayer } from './testKit';

/** Cell under test: (0, 10, -3). Top hits graze over its front face; side hits aim at its middle. */
const CELL = { x: 0, y: 10, z: -3 };

function setup() {
  const bus = createBus();
  const world = flatWorld(bus);
  const player = makePlayer(bus);
  const dropped: Array<{ item: string; count: number }> = [];
  player.dropAll = (stacks) => {
    for (const s of stacks) if (s) dropped.push({ item: s.item, count: s.count });
  };
  let swings = 0;
  const interaction = new Interaction(world, bus, player, new PlayerPhysics(world, player), { triggerSwing: () => swings++ }, () => 0);
  const ray = createRayHit();
  const aim = (face: 'top' | 'side'): RayHit | null => {
    const ex = player.position.x;
    const ey = player.eyeY;
    const ez = player.position.z;
    const tx = CELL.x + 0.5;
    const ty = face === 'top' ? CELL.y + 0.999 : CELL.y + 0.5;
    const tz = CELL.z + 0.5;
    return raycast(world, ex, ey, ez, tx - ex, ty - ey, tz - ez, REACH, false, ray);
  };
  const hold = (item: string, durability?: number, count = 1): void =>
    player.inventory.set(player.selectedSlot, makeStack(item, count, durability ?? fullDurability(item)));
  const at = (): string => world.getBlock(CELL.x, CELL.y, CELL.z).key;
  const put = (key: string): void => world.put(CELL.x, CELL.y, CELL.z, key);
  return { bus, world, player, interaction, aim, hold, at, put, dropped, swings: () => swings };
}

interface Case {
  id: string;
  held: string;
  target: string;
  face?: 'top' | 'side';
  /** Block in the cell afterwards ('air' when removed). */
  becomes: string;
  /** Items that must have been dropped (rng is 0, so every chance passes). */
  drops?: Array<[string, number]>;
  /** What the held slot holds afterwards (a swapped container); default: the same item. */
  heldAfter?: string;
  /** Stack size held (default 1). */
  count?: number;
}

const CASES: Case[] = [
  { id: 'axe_strip_oak', held: 'flint_axe', target: 'oak_log', becomes: 'stripped_oak_log', drops: [['fiber', 2]] },
  { id: 'axe_strip_pine', held: 'wooden_axe', target: 'pine_log', becomes: 'stripped_pine_log', drops: [['fiber', 1], ['pine_resin', 1]] },
  { id: 'axe_trim_leaves', held: 'bronze_axe', target: 'oak_leaves', becomes: 'oak_leaves', drops: [['stick', 1], ['fiber', 1]] },
  { id: 'axe_saw_slab', held: 'flint_axe', target: 'plank', becomes: 'plank_slab', drops: [['stick', 1]] },
  { id: 'saw_buck_plank', held: 'chainsaw', target: 'plank', becomes: 'air', drops: [['stick', 4]] },
  { id: 'saw_stripped_log', held: 'chainsaw', target: 'stripped_oak_log', becomes: 'air', drops: [['plank', 6]] },
  { id: 'saw_clear_leaves', held: 'chainsaw', target: 'pine_leaves', becomes: 'air' },
  { id: 'hoe_reap_replant', held: 'flint_hoe', target: 'wheat_3', becomes: 'wheat_0', drops: [['wheat', 1]] },
  { id: 'shovel_flatten_farmland', held: 'wooden_shovel', target: 'farmland', face: 'top', becomes: 'dirt' },
  { id: 'hoe_scythe', held: 'flint_hoe', target: 'tall_grass', becomes: 'air', drops: [['fiber', 2]] },
  { id: 'shovel_cut_sod', held: 'flint_shovel', target: 'grass', face: 'top', becomes: 'dirt', drops: [['fiber', 1]] },
  { id: 'shovel_sift_gravel', held: 'wooden_shovel', target: 'gravel', becomes: 'sand', drops: [['flint', 1]] },
  { id: 'slop_feeds_crop', held: 'slop_canister', target: 'carrot_1', becomes: 'carrot_2', heldAfter: 'empty_canister' },
  { id: 'sugar_sweetens_bush', held: 'sugar', target: 'berry_bush_bare', becomes: 'berry_bush', count: 2 },
  { id: 'pail_waters_bush', held: 'water_pail', target: 'tea_bush_bare', becomes: 'tea_bush', heldAfter: 'pail' },
  { id: 'pick_dress_brick', held: 'flint_pickaxe', target: 'cracked_stone_brick', becomes: 'stone_brick' },
  { id: 'pick_dress_limestone', held: 'flint_pickaxe', target: 'limestone', becomes: 'stone_brick' },
  { id: 'maul_cracks_brick', held: 'bronze_maul', target: 'stone_brick', becomes: 'cracked_stone_brick' },
  { id: 'torch_melts_snow', held: 'torch', target: 'snow', becomes: 'air' },
  { id: 'pail_chips_ice', held: 'pail', target: 'ice', becomes: 'air', heldAfter: 'water_pail' },
  { id: 'hammer_stone_to_rubble', held: 'flint_hammer', target: 'stone', becomes: 'rubble' },
  { id: 'hammer_rubble_to_gravel', held: 'bronze_hammer', target: 'rubble', becomes: 'gravel' },
  { id: 'hammer_gravel_to_sand', held: 'bronze_hammer', target: 'gravel', becomes: 'sand' },
  { id: 'hammer_rivet_plate', held: 'bronze_hammer', target: 'bronze_plate_block', becomes: 'rivet_plate_block' },
  { id: 'pail_mosses_brick', held: 'water_pail', target: 'stone_brick', becomes: 'mossy_stone_brick', heldAfter: 'pail' },
  { id: 'pail_melts_snow', held: 'pail', target: 'snow', becomes: 'air', heldAfter: 'water_pail' },
  { id: 'lava_vitrifies_sand', held: 'lava_bucket', target: 'sand', becomes: 'glass', heldAfter: 'bronze_bucket' },
  { id: 'lava_fires_clay', held: 'lava_bucket', target: 'clay', becomes: 'brick', heldAfter: 'bronze_bucket' },
  { id: 'vacuum_loose_piles', held: 'hand_vacuum', target: 'rubble', becomes: 'air' },
];

describe('tool uses: every row of the table', () => {
  it('has a case here for every row but the wrench, and ids are unique', () => {
    const ids = TOOL_USES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !CASES.some((c) => c.id === id)).sort()).toEqual(['wrench_turn_block']);
  });

  for (const c of CASES) {
    it(`${c.id}: ${c.held} on ${c.target}`, () => {
      const t = setup();
      t.put(c.target);
      t.hold(c.held, undefined, c.count);
      const hit = t.aim(c.face ?? 'side');
      expect(hit?.block.key).toBe(c.target);
      expect(t.interaction.use(hit)).toBe('worked');
      expect(t.at()).toBe(c.becomes);
      for (const [item, count] of c.drops ?? []) expect(t.dropped, `${item} dropped`).toContainEqual({ item, count });
      expect(t.player.heldStack()?.item).toBe(c.heldAfter ?? c.held);
      expect(t.swings()).toBe(1);
    });
  }
});

describe('docs/SYNERGY_TOOLS.md', () => {
  it('lists every row of the table', () => {
    const doc = readFileSync('docs/SYNERGY_TOOLS.md', 'utf8');
    expect(TOOL_USES.map((r) => r.id).filter((id) => !doc.includes(`\`${id}\``))).toEqual([]);
  });
});

describe('tool uses: wear, fuel and refusals', () => {
  it('a tool loses one use per row; a broken one is gone', () => {
    const t = setup();
    t.put('oak_log');
    t.hold('flint_axe', 1);
    expect(t.interaction.use(t.aim('side'))).toBe('worked');
    expect(t.player.heldStack()).toBeNull();
  });

  it('a chainsaw pays fuel and refuses when the tank is empty (it stays an ordinary Use)', () => {
    const t = setup();
    t.put('plank');
    t.hold('chainsaw', 1); // 1 = out of fuel
    expect(t.interaction.use(t.aim('side'))).not.toBe('worked');
    expect(t.at()).toBe('plank');
    t.hold('chainsaw', 5);
    expect(t.interaction.use(t.aim('side'))).toBe('worked');
    expect(t.player.heldStack()?.durability).toBe(4);
  });

  it('the chainsaw clears a 3x3x3 of leaves for one fuel', () => {
    const t = setup();
    t.world.fill(-1, 10, -4, 1, 11, -2, 'oak_leaves');
    t.world.put(3, 10, -3, 'oak_leaves');
    t.hold('chainsaw', 5);
    expect(t.interaction.use(t.aim('side'))).toBe('worked'); // hits the leaf at z -2: clears z -3..-1
    expect(t.world.getBlock(-1, 10, -3).key).toBe('air');
    expect(t.world.getBlock(1, 11, -2).key).toBe('air');
    expect(t.world.getBlock(-1, 10, -4).key).toBe('oak_leaves');
    expect(t.world.getBlock(3, 10, -3).key).toBe('oak_leaves');
    expect(t.player.heldStack()?.durability).toBe(4);
  });

  it('a hoe does not reap an unripe crop', () => {
    const t = setup();
    t.put('wheat_1');
    t.hold('flint_hoe');
    expect(t.interaction.use(t.aim('side'))).not.toBe('worked');
    expect(t.at()).toBe('wheat_1');
  });

  it('flattening refuses while something grows on the farmland', () => {
    const t = setup();
    t.put('farmland');
    t.world.put(CELL.x, CELL.y + 1, CELL.z, 'wheat_0');
    t.hold('flint_shovel');
    expect(t.interaction.use(t.aim('top'))).not.toBe('worked');
    expect(t.at()).toBe('farmland');
  });

  it('slop does not fertilise a ripe crop, and sugar needs a picked bush', () => {
    const t = setup();
    t.put('wheat_3');
    t.hold('slop_canister');
    expect(t.interaction.use(t.aim('side'))).not.toBe('worked');
    t.put('berry_bush');
    t.hold('sugar', undefined, 2);
    expect(t.interaction.use(t.aim('side'))).not.toBe('worked');
    expect(t.player.heldStack()?.count).toBe(2);
  });

  it('sugar is used up one at a time', () => {
    const t = setup();
    t.put('coffee_shrub_bare');
    t.hold('sugar', undefined, 3);
    expect(t.interaction.use(t.aim('side'))).toBe('worked');
    expect(t.at()).toBe('coffee_shrub');
    expect(t.player.heldStack()?.count).toBe(2);
  });

  it('the hand vacuum pays 4 s of suction, puts the block in the pack, and refuses when nearly spent', () => {
    const t = setup();
    t.put('sand');
    t.hold('hand_vacuum', 10);
    expect(t.interaction.use(t.aim('side'))).toBe('worked');
    expect(t.player.heldStack()?.durability).toBe(6);
    expect(t.player.inventory.count('sand')).toBe(1);
    t.put('sand');
    t.hold('hand_vacuum', 3);
    expect(t.interaction.use(t.aim('side'))).not.toBe('worked');
    expect(t.at()).toBe('sand');
  });

  it('the wrench turns an oriented block a quarter turn from its side, leaves its front to open it, and a plain block alone', () => {
    const t = setup();
    // Facing South puts the front on +Z, the side the player stands on: aimed there the wrench does nothing here.
    t.world.setVoxel(CELL.x, CELL.y, CELL.z, makeVoxel(block('loom').id, Facing.South, false), 'sim');
    t.hold('wrench');
    expect(t.interaction.use(t.aim('side'))).not.toBe('worked');
    expect(voxelFacing(t.world.getVoxel(CELL.x, CELL.y, CELL.z))).toBe(Facing.South);
    t.world.setVoxel(CELL.x, CELL.y, CELL.z, makeVoxel(block('loom').id, Facing.North, false), 'sim');
    expect(t.interaction.use(t.aim('side'))).toBe('worked');
    expect(voxelFacing(t.world.getVoxel(CELL.x, CELL.y, CELL.z))).toBe(Facing.East);
    t.world.setVoxel(CELL.x, CELL.y, CELL.z, makeVoxel(block('stone').id), 'sim');
    expect(t.interaction.use(t.aim('side'))).not.toBe('worked');
  });

  it('a row needs its cooldown: two Uses in the same instant strip only one log', () => {
    const t = setup();
    t.world.put(CELL.x, CELL.y, CELL.z, 'oak_log');
    t.world.put(CELL.x, CELL.y + 1, CELL.z, 'oak_log');
    t.hold('flint_axe');
    expect(t.interaction.use(t.aim('side'))).toBe('worked');
    t.world.put(CELL.x, CELL.y, CELL.z, 'oak_log');
    expect(t.interaction.use(t.aim('side'))).toBe('refused');
  });
});
