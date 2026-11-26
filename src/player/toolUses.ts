/**
 * Tool and item Uses on existing blocks (docs/SYNERGY_TOOLS.md): one table of rows, each "hold this, aim at that, press
 * Use". A row says what it applies to (held tool kind or item, target block, face) and does one small, fully visible
 * thing: a block becomes another block, drops something, wears the tool a little. No screens, no new state; a row that
 * needs a place to keep state belongs to its own system instead. Decided AFTER hand stations and pipes (so a wrench still
 * works pipes and a hammer still strikes an anvil) and BEFORE screens (so a wrench can turn a furnace instead of opening it).
 * DOM-free: it talks to the world, the player and the bus.
 */
import type { GameBus } from '../core/context';
import { BLOCKS, block as blockByKey, itemOrNull } from '../core/registry';
import { AIR, Face, makeVoxel, voxelActive, voxelFacing, type BlockDef, type ItemAmount, type ItemDef, type ItemStack, type IWorld, type Voxel } from '../core/types';
import { cropStage, furnaceBelowChimney, isRipeCrop, rollDrops, sawFuel, type PlayerState } from '../game';
import { frontFace } from './blockRules';
import { swapHeldItem } from './buckets';
import type { RayHit } from './raycast';

export interface ToolUseHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  readonly player: PlayerState;
  readonly rng: () => number;
  /** Seconds before the next placement-like Use may happen. */
  readonly cooldown: number;
  startCooldown(): void;
  swing(): void;
  stopMining(): void;
}

interface Ctx {
  readonly world: IWorld;
  readonly player: PlayerState;
  readonly bus: GameBus;
  readonly rng: () => number;
  readonly hit: RayHit;
  readonly stack: ItemStack;
  readonly item: ItemDef;
  readonly def: BlockDef;
}

export interface ToolUseRow {
  /** Stable id, listed in docs/SYNERGY_TOOLS.md and by the tests. */
  id: string;
  /** The game system the row connects the tool to. */
  system: string;
  summary: string;
  applies(c: Ctx): boolean;
  /** Does the Use; false = refused (nothing changed). */
  run(c: Ctx): boolean;
}

// ---- helpers -------------------------------------------------------------------------------------

/** The held tool's kind; a chainsaw counts as no kind here (it has its own rows and an empty one is bare hands). */
const kindOf = (c: Ctx): string | null => (c.item.tool?.fell !== undefined ? null : c.item.tool?.kind ?? null);
const is = (c: Ctx, ...keys: string[]): boolean => keys.includes(c.def.key);
const heldIs = (c: Ctx, ...keys: string[]): boolean => keys.includes(c.stack.item);
const isSaw = (c: Ctx): boolean => c.item.tool?.fell !== undefined;
const at = (c: Ctx): { x: number; y: number; z: number } => ({ x: c.hit.x + 0.5, y: c.hit.y + 0.5, z: c.hit.z + 0.5 });

function replace(c: Ctx, key: string, keepFacing = false): boolean {
  const { x, y, z } = c.hit;
  const to = blockByKey(key);
  const old = c.world.getVoxel(x, y, z);
  const voxel = makeVoxel(to.id, keepFacing ? voxelFacing(old) : 0, keepFacing ? voxelActive(old) : false);
  return c.world.setVoxel(x, y, z, voxel, 'player');
}

function remove(c: Ctx, x = c.hit.x, y = c.hit.y, z = c.hit.z): boolean {
  return c.world.setVoxel(x, y, z, AIR, 'player');
}

function drop(c: Ctx, items: Array<{ item: string; count: number; chance?: number }>, p = at(c)): void {
  const out: ItemAmount[] = [];
  for (const i of items) if (i.chance === undefined || c.rng() < i.chance) out.push({ item: i.item, count: i.count });
  c.player.dropAll(out, p);
}

const wearTool = (c: Ctx, uses = 1): void => void c.player.wearHeldTool(uses);

/** Takes `n` of a chainsaw's fuel (its durability); false when the tank cannot pay. */
function burnFuel(c: Ctx, n: number): boolean {
  if (sawFuel(c.stack) < n || c.stack.durability === undefined) return false;
  if (!c.player.dev) c.stack.durability -= n;
  c.player.inventory.notifyChanged();
  return true;
}

type Sound = 'harvest' | 'break' | 'place' | 'till' | 'dig_wood' | 'dig_stone' | 'dig_sand' | 'splash' | 'dig_metal';
function sfx(c: Ctx, name: Sound): void {
  c.bus.emit('sfx', { name, ...at(c) });
}

const LEAVES = ['oak_leaves', 'pine_leaves'];
const CHEAP_FOLIAGE = ['tall_grass', 'dry_shrub', 'fern', 'reeds'];
/** Bare bush key -> its fruiting block, from the bush's own `harvestLeaves` rule. */
const REGROWS: ReadonlyMap<string, string> = new Map(BLOCKS.filter((b) => b.harvestLeaves !== null).map((b) => [b.harvestLeaves as string, b.key]));
const LOOSE_PILES = ['sand', 'gravel', 'rubble', 'snow'];

function advanceCrop(c: Ctx): boolean {
  const s = cropStage(c.def);
  if (!s || s.ripe) return false;
  const { x, y, z } = c.hit;
  return c.world.setVoxel(x, y, z, makeVoxel(blockByKey(`${s.crop}_${s.stage + 1}`).id), 'player');
}

// ---- the table -----------------------------------------------------------------------------------

export const TOOL_USES: readonly ToolUseRow[] = [
  // ---- woodwork: axes and the chainsaw ----
  {
    id: 'axe_strip_oak', system: 'woodwork', summary: 'An axe strips an oak log into a Stripped Oak Log and a handful of bark fibre',
    applies: (c) => kindOf(c) === 'axe' && is(c, 'oak_log'),
    run: (c) => (replace(c, 'stripped_oak_log') ? (drop(c, [{ item: 'fiber', count: 2 }]), wearTool(c), sfx(c, 'dig_wood'), true) : false),
  },
  {
    id: 'axe_strip_pine', system: 'woodwork', summary: 'An axe strips a pine log; the bark gives fibre and sometimes a lump of resin',
    applies: (c) => kindOf(c) === 'axe' && is(c, 'pine_log'),
    run: (c) => (replace(c, 'stripped_pine_log') ? (drop(c, [{ item: 'fiber', count: 1 }, { item: 'pine_resin', count: 1, chance: 0.5 }]), wearTool(c), sfx(c, 'dig_wood'), true) : false),
  },
  {
    id: 'axe_trim_leaves', system: 'woodwork', summary: 'An axe trims a leaf block for sticks and fibre without felling it',
    applies: (c) => kindOf(c) === 'axe' && is(c, ...LEAVES),
    run: (c) => (drop(c, [{ item: 'stick', count: 1, chance: 0.6 }, { item: 'fiber', count: 1, chance: 0.5 }]), wearTool(c), sfx(c, 'harvest'), true),
  },
  {
    id: 'axe_saw_slab', system: 'woodwork', summary: 'An axe halves a plank block into a Plank Slab and a stick',
    applies: (c) => kindOf(c) === 'axe' && is(c, 'plank'),
    run: (c) => (replace(c, 'plank_slab') ? (drop(c, [{ item: 'stick', count: 1 }]), wearTool(c), sfx(c, 'dig_wood'), true) : false),
  },
  {
    id: 'saw_clear_leaves', system: 'felling', summary: 'A fuelled chainsaw clears the leaves around the aimed leaf block (3x3x3) for a little fuel',
    applies: (c) => isSaw(c) && is(c, ...LEAVES),
    run: (c) => {
      if (!burnFuel(c, 1)) return false;
      const { x, y, z } = c.hit;
      for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!LEAVES.includes(c.world.getBlock(x + dx, y + dy, z + dz).key)) continue;
        remove(c, x + dx, y + dy, z + dz);
        drop(c, [{ item: 'stick', count: 1, chance: 0.3 }, { item: 'fiber', count: 1, chance: 0.2 }], { x: x + dx + 0.5, y: y + dy + 0.5, z: z + dz + 0.5 });
      }
      sfx(c, 'break');
      return true;
    },
  },
  {
    id: 'saw_buck_plank', system: 'felling', summary: 'A fuelled chainsaw bucks a plank block into four sticks in one pass',
    applies: (c) => isSaw(c) && is(c, 'plank', 'plank_slab'),
    run: (c) => (burnFuel(c, 1) && remove(c) ? (drop(c, [{ item: 'stick', count: 4 }]), sfx(c, 'dig_wood'), true) : false),
  },
  {
    id: 'saw_stripped_log', system: 'felling', summary: 'A fuelled chainsaw saws a stripped log into six planks (as an axe on the chopping block)',
    applies: (c) => isSaw(c) && is(c, 'stripped_oak_log', 'stripped_pine_log'),
    run: (c) => (burnFuel(c, 1) && remove(c) ? (drop(c, [{ item: 'plank', count: 6 }]), sfx(c, 'dig_wood'), true) : false),
  },

  // ---- farming: hoes, shovels, canisters, pails, sugar ----
  {
    id: 'hoe_reap_replant', system: 'farming', summary: 'A hoe reaps a ripe crop and leaves it replanted at its first stage',
    applies: (c) => kindOf(c) === 'hoe' && isRipeCrop(c.def),
    run: (c) => {
      const s = cropStage(c.def)!;
      const { x, y, z } = c.hit;
      if (!c.world.setVoxel(x, y, z, makeVoxel(blockByKey(`${s.crop}_0`).id), 'player')) return false;
      drop(c, rollDrops(c.def, c.rng));
      wearTool(c);
      sfx(c, 'harvest');
      return true;
    },
  },
  {
    id: 'shovel_flatten_farmland', system: 'farming', summary: 'A shovel flattens farmland back into plain dirt (aim at its top; nothing may grow there)',
    applies: (c) => kindOf(c) === 'shovel' && is(c, 'farmland') && c.hit.face === Face.PY,
    run: (c) => c.world.getVoxel(c.hit.x, c.hit.y + 1, c.hit.z) === AIR && replace(c, 'dirt') && (wearTool(c), sfx(c, 'till'), true),
  },
  {
    id: 'hoe_scythe', system: 'farming', summary: 'A hoe cuts tall grass, ferns, reeds and dry shrub down to fibre (shrub gives a stick too)',
    applies: (c) => (kindOf(c) === 'hoe' || heldIs(c, 'starcleaver')) && is(c, ...CHEAP_FOLIAGE),
    run: (c) => (remove(c) ? (drop(c, [{ item: 'fiber', count: 2 }, { item: 'stick', count: 1, chance: c.def.key === 'dry_shrub' ? 0.7 : 0 }]), wearTool(c), sfx(c, 'harvest'), true) : false),
  },
  {
    id: 'shovel_cut_sod', system: 'farming', summary: 'A shovel cuts the sod off grass: dirt underneath, roots for fibre',
    applies: (c) => kindOf(c) === 'shovel' && is(c, 'grass') && c.hit.face === Face.PY,
    run: (c) => (replace(c, 'dirt') ? (drop(c, [{ item: 'fiber', count: 1 }], { x: c.hit.x + 0.5, y: c.hit.y + 1.2, z: c.hit.z + 0.5 }), wearTool(c), sfx(c, 'dig_sand'), true) : false),
  },
  {
    id: 'shovel_sift_gravel', system: 'masonry', summary: 'A shovel sifts gravel into sand, and a sharp flint turns up now and then',
    applies: (c) => kindOf(c) === 'shovel' && is(c, 'gravel'),
    run: (c) => (replace(c, 'sand') ? (drop(c, [{ item: 'flint', count: 1, chance: 0.35 }]), wearTool(c), sfx(c, 'dig_sand'), true) : false),
  },
  {
    id: 'slop_feeds_crop', system: 'distillery', summary: 'A Slop Canister fertilises a growing crop one stage and comes back empty',
    applies: (c) => heldIs(c, 'slop_canister') && cropStage(c.def) !== null && !isRipeCrop(c.def),
    run: (c) => {
      if (!advanceCrop(c)) return false;
      swapHeldItem(c.player, 'empty_canister');
      sfx(c, 'splash');
      return true;
    },
  },
  {
    id: 'sugar_sweetens_bush', system: 'sugar', summary: 'A pinch of sugar brings a picked berry, tea or coffee bush back into fruit',
    applies: (c) => heldIs(c, 'sugar') && REGROWS.has(c.def.key),
    run: (c) => (replace(c, REGROWS.get(c.def.key)!, true) ? (c.player.consumeHeld(1), sfx(c, 'harvest'), true) : false),
  },
  {
    id: 'pail_waters_bush', system: 'brewing', summary: 'A water pail waters a picked bush back into fruit and is left empty',
    applies: (c) => heldIs(c, 'water_pail') && REGROWS.has(c.def.key),
    run: (c) => (replace(c, REGROWS.get(c.def.key)!, true) ? (swapHeldItem(c.player, 'pail'), sfx(c, 'splash'), true) : false),
  },

  // ---- stone and masonry: pickaxe, hammer, buckets ----
  {
    id: 'pick_dress_brick', system: 'masonry', summary: 'A pickaxe dresses cracked or mossy stone brick back into sound stone brick',
    applies: (c) => kindOf(c) === 'pickaxe' && is(c, 'cracked_stone_brick', 'mossy_stone_brick'),
    run: (c) => (replace(c, 'stone_brick') ? (wearTool(c), sfx(c, 'dig_stone'), true) : false),
  },
  {
    id: 'pick_dress_limestone', system: 'masonry', summary: 'A pickaxe dresses a limestone block straight into stone brick (two uses of the pick)',
    applies: (c) => kindOf(c) === 'pickaxe' && is(c, 'limestone') && (c.stack.durability ?? 2) >= 2,
    run: (c) => (replace(c, 'stone_brick') ? (wearTool(c, 2), sfx(c, 'dig_stone'), true) : false),
  },
  {
    id: 'maul_cracks_brick', system: 'masonry', summary: 'A maul cracks stone brick into cracked brick (the pickaxe dresses it back)',
    applies: (c) => kindOf(c) === 'maul' && is(c, 'stone_brick'),
    // The Quiet Hammer does it without a sound.
    run: (c) => (replace(c, 'cracked_stone_brick') ? (wearTool(c), heldIs(c, 'quiet_hammer') || sfx(c, 'dig_stone'), true) : false),
  },
  {
    id: 'rootsong_greens_dirt', system: 'farming', summary: 'Rootsong used on bare dirt coaxes grass over it',
    applies: (c) => kindOf(c) === 'staff' && is(c, 'dirt'),
    run: (c) => (replace(c, 'grass') ? (wearTool(c), sfx(c, 'harvest'), true) : false),
  },
  {
    id: 'torch_melts_snow', system: 'survival', summary: 'A torch (or Emberfang) held to a snow block melts it away (it is kept)',
    applies: (c) => (heldIs(c, 'torch') || heldIs(c, 'emberfang')) && is(c, 'snow'),
    run: (c) => (remove(c) ? (sfx(c, 'splash'), true) : false),
  },
  {
    id: 'pail_chips_ice', system: 'fluids', summary: 'An empty pail chips a block of ice into a water pail',
    applies: (c) => heldIs(c, 'pail') && is(c, 'ice'),
    run: (c) => (remove(c) ? (swapHeldItem(c.player, 'water_pail'), sfx(c, 'splash'), true) : false),
  },
  {
    id: 'hammer_stone_to_rubble', system: 'masonry', summary: 'A hammer knocks stone, limestone or basalt apart into rubble',
    applies: (c) => kindOf(c) === 'hammer' && is(c, 'stone', 'limestone', 'basalt'),
    run: (c) => (replace(c, 'rubble') ? (wearTool(c), sfx(c, 'dig_stone'), true) : false),
  },
  {
    id: 'hammer_rubble_to_gravel', system: 'masonry', summary: 'A hammer breaks rubble down to gravel',
    applies: (c) => kindOf(c) === 'hammer' && is(c, 'rubble'),
    run: (c) => (replace(c, 'gravel') ? (wearTool(c), sfx(c, 'dig_stone'), true) : false),
  },
  {
    id: 'hammer_gravel_to_sand', system: 'masonry', summary: 'A hammer grinds gravel down to sand',
    applies: (c) => kindOf(c) === 'hammer' && is(c, 'gravel'),
    run: (c) => (replace(c, 'sand') ? (wearTool(c), sfx(c, 'dig_stone'), true) : false),
  },
  {
    id: 'hammer_rivet_plate', system: 'bronze', summary: 'A hammer rivets a Bronze Plate Block into a Riveted Plate Block',
    applies: (c) => kindOf(c) === 'hammer' && is(c, 'bronze_plate_block'),
    run: (c) => (replace(c, 'rivet_plate_block') ? (wearTool(c), sfx(c, 'dig_metal'), true) : false),
  },
  {
    id: 'stick_sweeps_flue', system: 'furnace', summary: 'A stick pushed up a Brick Chimney sweeps the soot off the furnace it stands on (the stick is used up)',
    applies: (c) => heldIs(c, 'stick') && is(c, 'brick_chimney') && furnaceBelowChimney(c.world, c.hit.x, c.hit.y, c.hit.z) !== null,
    run: (c) => {
      if (!c.player.consumeHeld(1)) return false;
      c.bus.emit('disaster:sweep', { x: c.hit.x, y: c.hit.y, z: c.hit.z });
      sfx(c, 'dig_wood');
      return true;
    },
  },
  {
    id: 'pail_mosses_brick', system: 'fluids', summary: 'A water pail left on stone brick wets it into mossy brick; the pail comes back empty',
    applies: (c) => heldIs(c, 'water_pail') && is(c, 'stone_brick'),
    run: (c) => (replace(c, 'mossy_stone_brick') ? (swapHeldItem(c.player, 'pail'), sfx(c, 'splash'), true) : false),
  },
  {
    id: 'pail_melts_snow', system: 'fluids', summary: 'An empty pail scoops a block of snow and comes up a water pail',
    applies: (c) => heldIs(c, 'pail') && is(c, 'snow'),
    run: (c) => (remove(c) ? (swapHeldItem(c.player, 'water_pail'), sfx(c, 'splash'), true) : false),
  },
  {
    id: 'lava_vitrifies_sand', system: 'glass', summary: 'A lava bucket poured on a sand block melts it into glass (the bronze bucket is left)',
    applies: (c) => heldIs(c, 'lava_bucket') && is(c, 'sand'),
    run: (c) => (replace(c, 'glass') ? (swapHeldItem(c.player, 'bronze_bucket'), sfx(c, 'break'), true) : false),
  },
  {
    id: 'lava_fires_clay', system: 'furnace', summary: 'A lava bucket poured on a clay block fires it into brick (the bronze bucket is left)',
    applies: (c) => heldIs(c, 'lava_bucket') && is(c, 'clay'),
    run: (c) => (replace(c, 'brick') ? (swapHeldItem(c.player, 'bronze_bucket'), sfx(c, 'break'), true) : false),
  },

  // ---- machines and ground items ----
  {
    id: 'wrench_turn_block', system: 'machines', summary: 'A wrench aimed at the side, top or back of a front-facing block (furnace, loom, machine) turns it a quarter turn; its front still opens it',
    applies: (c) => heldIs(c, 'wrench') && c.def.oriented && c.def.pipe === null && frontFace(c.def, c.hit.voxel) !== c.hit.face,
    run: (c) => {
      const { x, y, z, voxel } = c.hit;
      const next = (voxelFacing(voxel) + 1) & 3;
      const turned = ((voxel & ~(3 << 10)) | (next << 10)) as Voxel;
      if (!c.world.setVoxel(x, y, z, turned, 'player')) return false;
      sfx(c, 'dig_metal');
      return true;
    },
  },
  {
    id: 'vacuum_loose_piles', system: 'ground items', summary: 'A hand vacuum pulls a loose block (sand, gravel, rubble, snow) straight into the pack for 4 s of suction',
    applies: (c) => heldIs(c, 'hand_vacuum') && is(c, ...LOOSE_PILES) && (c.stack.durability ?? 0) >= 4,
    run: (c) => {
      if (!remove(c)) return false;
      c.stack.durability = (c.stack.durability ?? 0) - 4;
      c.player.inventory.notifyChanged();
      c.player.give(c.def.key, 1);
      sfx(c, 'dig_sand');
      return true;
    },
  },
];

export class ToolUses {
  constructor(private readonly host: ToolUseHost) {}

  /** The row the held item and the target would run, or null. Pure: changes nothing. */
  match(hit: RayHit): ToolUseRow | null {
    const c = this.ctx(hit);
    return c ? TOOL_USES.find((r) => r.applies(c)) ?? null : null;
  }

  /** Use on `hit`: 'worked' when a row ran, 'refused' when one applied but could not, null when none applies. */
  use(hit: RayHit): 'worked' | 'refused' | null {
    const c = this.ctx(hit);
    const row = c ? TOOL_USES.find((r) => r.applies(c)) : undefined;
    if (!c || !row) return null;
    if (this.host.cooldown > 0) return 'refused';
    this.host.stopMining();
    if (!row.run(c)) return 'refused';
    this.host.startCooldown();
    this.host.swing();
    return 'worked';
  }

  private ctx(hit: RayHit): Ctx | null {
    const { player } = this.host;
    const stack = player.heldStack();
    if (player.dead || !stack || hit.block.liquid !== null) return null;
    const item = itemOrNull(stack.item);
    if (!item) return null;
    return { world: this.host.world, player, bus: this.host.bus, rng: this.host.rng, hit, stack, item, def: hit.block };
  }
}
