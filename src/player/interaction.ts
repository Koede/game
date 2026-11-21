/**
 * What the player does to the block under the crosshair (spec 3.6): mining with progress, drops, tool wear and
 * dig sounds; "use" in priority order - station or machine screen, then the pail, then placing the held block -
 * with the placement rules (replaceable target, placeOn, never inside the player, oriented blocks face the player).
 * DOM-free: it talks to the rest of the game through the IWorld, the PlayerState and the event bus.
 */
import type { GameBus } from '../core/context';
import type { ScreenRequest, SfxName } from '../core/gameEvents';
import { ITEMS, blockOfItem, block as blockByKey, itemOrNull } from '../core/registry';
import { AIR, Facing, WORLD_HEIGHT, makeVoxel, type BlockDef, type IWorld } from '../core/types';
import { canHarvest, canMine, harvest, miningTime, type PlayerState } from '../game';
import type { RayHit } from './raycast';

/** Seconds between dig sounds (and hand swings) while mining. */
export const DIG_INTERVAL_S = 0.25;
/** Seconds between 'block:mining' progress events. */
export const MINING_EVENT_INTERVAL_S = 0.1;
/** Pause after a block breaks before the next one starts, so holding mine never clears several per frame. */
export const BREAK_COOLDOWN_S = 0.12;
/** Shortest time between two placements (taps and auto-repeat both go through it). */
export const PLACE_COOLDOWN_S = 0.15;
/** The same advisory toast (e.g. "needs a bronze pickaxe") is not repeated within this many seconds. */
const ADVICE_COOLDOWN_S = 8;

/** The collision test the placement rule needs from the physics. */
export interface BodyProbe {
  intersectsCell(x: number, y: number, z: number, height?: number): boolean;
}

/** The hand swing the interaction asks for (IView.triggerSwing). */
export interface SwingTarget {
  triggerSwing(): void;
}

/** Which dig sound a block makes. */
export function digSound(def: BlockDef): SfxName {
  if (def.machine || def.power || def.station) return def.tool === 'axe' ? 'dig_wood' : 'dig_metal';
  if (def.tool === 'axe') return 'dig_wood';
  if (def.tool === 'shovel') return def.key === 'sand' || def.key === 'gravel' || def.key === 'snow' ? 'dig_sand' : 'dig_dirt';
  if (def.tool === 'pickaxe') return 'dig_stone';
  return def.opaque ? 'dig_dirt' : 'dig_sand';
}

/** The screen that using this block opens, or null. */
export function screenFor(def: BlockDef, x: number, y: number, z: number): ScreenRequest | null {
  if (def.station === 'workbench') return { type: 'workbench', x, y, z };
  if (!def.machine) return null;
  if (def.machine === 'furnace') return { type: 'furnace', x, y, z };
  if (def.machine === 'crate') return { type: 'crate', x, y, z };
  return { type: 'machine', x, y, z };
}

/** Facing that turns a block's front towards a player looking along yaw (0 = north, positive turns left). */
export function facingTowards(yaw: number): Facing {
  const lookX = -Math.sin(yaw);
  const lookZ = -Math.cos(yaw);
  if (Math.abs(lookZ) >= Math.abs(lookX)) return lookZ < 0 ? Facing.South : Facing.North;
  return lookX > 0 ? Facing.West : Facing.East;
}

/** Name of the cheapest tool that harvests the block, for the "needs a ..." hint. */
function toolNeeded(def: BlockDef): string | null {
  for (const it of ITEMS) {
    const tool = it.tool;
    if (tool && tool.tier === def.minTier && (tool.kind === def.tool || tool.universal)) return it.name.toLowerCase();
  }
  return null;
}

export type UseOutcome = 'none' | 'screen' | 'pail' | 'placed' | 'refused';

export class Interaction {
  /** Cell being mined and its progress 0..1; progress is -1 while not mining. */
  progress = -1;
  mx = 0;
  my = 0;
  mz = 0;
  /** Counts world edits made here (blocks broken, placed, water poured), so callers can tell the target moved. */
  edits = 0;
  private miningVoxel = 0;
  private digTimer = 0;
  private eventTimer = 0;
  private breakCooldown = 0;
  private placeCooldown = 0;
  private clock = 0;
  private readonly advice = new Map<string, number>();

  constructor(
    private readonly world: IWorld,
    private readonly bus: GameBus,
    private readonly player: PlayerState,
    private readonly body: BodyProbe,
    private readonly swing: SwingTarget,
    private readonly rng: () => number = Math.random,
  ) {}

  get mining(): boolean {
    return this.progress >= 0;
  }

  /** Advances mining (while `mineHeld`) on the targeted cell. Call every frame. */
  updateMining(dt: number, mineHeld: boolean, hit: RayHit | null): void {
    this.clock += dt;
    this.breakCooldown = Math.max(0, this.breakCooldown - dt);
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    if (!mineHeld || !hit || hit.block.liquid !== null || this.player.dead) {
      this.stopMining();
      return;
    }
    if (this.breakCooldown > 0) return;
    if (!this.mining || hit.x !== this.mx || hit.y !== this.my || hit.z !== this.mz || hit.voxel !== this.miningVoxel) {
      this.stopMining();
      this.startMining(hit);
    }
    const def = hit.block;
    // The held stack can change mid-dig (hotbar, a tool breaking), so the rate is re-evaluated every frame.
    const time = miningTime(def, this.player.heldStack(), this.player.wellWarmed);
    if (Number.isFinite(time)) this.progress = time <= 0 ? 1 : Math.min(1, this.progress + dt / time);

    this.digTimer -= dt;
    if (this.digTimer <= 0) {
      this.digTimer += DIG_INTERVAL_S;
      this.bus.emit('sfx', { name: digSound(def), x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 });
      this.swing.triggerSwing();
    }
    if (this.progress >= 1) {
      this.breakBlock(hit);
      return;
    }
    this.eventTimer -= dt;
    if (this.eventTimer <= 0) {
      this.eventTimer = MINING_EVENT_INTERVAL_S;
      this.bus.emit('block:mining', { x: hit.x, y: hit.y, z: hit.z, progress: this.progress });
    }
  }

  /** Stops mining the current cell (if any) without breaking it. */
  stopMining(): void {
    if (!this.mining) return;
    this.progress = -1;
    this.bus.emit('block:mining', { x: this.mx, y: this.my, z: this.mz, progress: -1 });
  }

  /**
   * "Use" on the target, in the priority of spec 3.6. `hit` should come from a ray that includes liquids when
   * an empty pail is held (so water can be scooped) and skips them otherwise.
   */
  use(hit: RayHit | null): UseOutcome {
    if (!hit || this.player.dead) return 'none';
    const screen = hit.block.liquid === null ? screenFor(hit.block, hit.x, hit.y, hit.z) : null;
    if (screen) {
      this.stopMining();
      this.bus.emit('ui:open', { screen });
      this.swing.triggerSwing();
      return 'screen';
    }
    const held = this.player.heldStack();
    if (!held) return 'none';
    if (held.item === 'pail') return this.scoop(hit);
    if (held.item === 'water_pail') return this.pour(hit);
    const def = blockOfItem(held.item);
    if (!def || hit.block.liquid !== null) return 'none';
    return this.placeBlock(hit, def) ? 'placed' : 'refused';
  }

  /**
   * Places `def` against the hit face (or into the hit cell when that holds something replaceable such as
   * tall grass), taking one item from the selected slot. Returns false when a rule refuses it.
   */
  placeBlock(hit: RayHit, def: BlockDef): boolean {
    if (this.placeCooldown > 0) return false;
    const intoHit = hit.block.replaceable && hit.block.liquid === null;
    const x = intoHit ? hit.x : hit.px;
    const y = intoHit ? hit.y : hit.py;
    const z = intoHit ? hit.z : hit.pz;
    if (!this.placeableCell(x, y, z)) return false;
    if (def.placeOn) {
      const below = this.world.getBlock(x, y - 1, z);
      if (!def.placeOn.includes(below.key)) {
        const names = def.placeOn.map((k) => blockByKey(k).name.toLowerCase());
        this.advise(`place:${def.key}`, `${def.name} can only be placed on ${names.join(', ')}`);
        return false;
      }
    }
    if (def.solid && this.body.intersectsCell(x, y, z, def.shape === 'slab' ? 0.5 : 1)) return false;
    const voxel = makeVoxel(def.id, def.oriented ? facingTowards(this.player.yaw) : Facing.North);
    if (!this.world.setVoxel(x, y, z, voxel, 'player')) return false;
    this.edits++;
    this.player.consumeHeld(1);
    this.placeCooldown = PLACE_COOLDOWN_S;
    this.bus.emit('block:placed', { x, y, z, voxel });
    this.bus.emit('sfx', { name: 'place', x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    this.swing.triggerSwing();
    return true;
  }

  // ---------------------------------------------------------------------------------------------

  private startMining(hit: RayHit): void {
    this.mx = hit.x;
    this.my = hit.y;
    this.mz = hit.z;
    this.miningVoxel = hit.voxel;
    this.progress = 0;
    this.digTimer = 0;
    this.eventTimer = MINING_EVENT_INTERVAL_S;
    this.bus.emit('block:mining', { x: hit.x, y: hit.y, z: hit.z, progress: 0 });
    const def = hit.block;
    if (!canMine(def)) {
      this.advise(`mine:${def.key}`, `${def.name} cannot be broken`);
    } else if (!canHarvest(def, this.player.heldStack())) {
      const tool = toolNeeded(def);
      this.advise(`mine:${def.key}`, tool ? `${def.name} needs a ${tool} or better to drop anything` : `${def.name} drops nothing with this`);
    }
  }

  private breakBlock(hit: RayHit): void {
    const def = hit.block;
    const held = this.player.heldStack();
    const drops = harvest(def, held, this.rng);
    const { x, y, z, voxel } = hit;
    this.progress = -1;
    this.breakCooldown = BREAK_COOLDOWN_S;
    if (!this.world.setVoxel(x, y, z, AIR, 'player')) return;
    this.edits++;
    for (const d of drops) this.player.give(d.item, d.count);
    this.player.wearHeld(def);
    this.bus.emit('block:broken', { x, y, z, voxel });
    this.bus.emit('sfx', { name: 'break', x: x + 0.5, y: y + 0.5, z: z + 0.5 });
  }

  private placeableCell(x: number, y: number, z: number): boolean {
    if (y < 0 || y >= WORLD_HEIGHT || !this.world.isLoaded(x, z)) return false;
    return this.world.getBlock(x, y, z).replaceable;
  }

  private scoop(hit: RayHit): UseOutcome {
    if (hit.block.liquid === 'water') {
      this.swapHeld('water_pail');
      this.bus.emit('sfx', { name: 'splash', x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 });
      this.swing.triggerSwing();
      return 'pail';
    }
    if (hit.block.liquid !== null) {
      this.advise('pail:hot', 'That would burn straight through a wooden pail');
      return 'refused';
    }
    return 'none';
  }

  private pour(hit: RayHit): UseOutcome {
    if (this.placeCooldown > 0 || hit.block.liquid !== null) return 'none';
    const intoHit = hit.block.replaceable;
    const x = intoHit ? hit.x : hit.px;
    const y = intoHit ? hit.y : hit.py;
    const z = intoHit ? hit.z : hit.pz;
    if (!this.placeableCell(x, y, z)) return 'refused';
    const target = this.world.getBlock(x, y, z);
    if (target.liquid !== null) return 'refused';
    const voxel = makeVoxel(blockByKey('water').id);
    if (!this.world.setVoxel(x, y, z, voxel, 'player')) return 'refused';
    this.edits++;
    this.swapHeld('pail');
    this.placeCooldown = PLACE_COOLDOWN_S;
    this.bus.emit('block:placed', { x, y, z, voxel });
    this.bus.emit('sfx', { name: 'splash', x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    this.swing.triggerSwing();
    return 'pail';
  }

  /** Replaces the held (single) pail with another pail item in the same slot. */
  private swapHeld(item: string): void {
    if (!itemOrNull(item)) return;
    const inv = this.player.inventory;
    const slot = this.player.selectedSlot;
    inv.batch(() => {
      inv.removeAt(slot, 1);
      if (inv.get(slot) === null) inv.set(slot, { item, count: 1 });
      else this.player.give(item, 1);
    });
  }

  /** A toast that explains a refusal, at most once per ADVICE_COOLDOWN_S for the same subject. */
  private advise(key: string, text: string): void {
    const last = this.advice.get(key);
    if (last !== undefined && this.clock - last < ADVICE_COOLDOWN_S) return;
    this.advice.set(key, this.clock);
    this.bus.emit('toast', { text, kind: 'info' });
  }
}
