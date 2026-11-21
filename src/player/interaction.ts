/**
 * What the player does to the block under the crosshair (spec 3.6): mining with progress, drops, tool wear and
 * dig sounds; "use" in priority order - station or machine screen, then the pail, the hoe (tilling), planting and
 * eating (spec 12), then placing the held block - with the placement rules (replaceable target, placeOn, never
 * inside the player, oriented blocks face the player).
 * DOM-free: it talks to the rest of the game through the IWorld, the PlayerState and the event bus.
 */
import type { GameBus } from '../core/context';
import { blockOf, blockOfItem, block as blockByKey, itemOrNull } from '../core/registry';
import { AIR, Face, Facing, WORLD_HEIGHT, makeVoxel, withId, type BlockDef, type IWorld, type Voxel } from '../core/types';
import {
  TILLABLE,
  canHarvest,
  canMine,
  canTill,
  eat,
  exertMining,
  harvest,
  isHoe,
  isRipeCrop,
  isUnsupported,
  miningTime,
  placementCell,
  plant,
  plantCell,
  plantedBy,
  rollDrops,
  till,
  type PlayerState,
} from '../game';
import { buildsOnto, digSound, facingTowards, frontFace, placeOnAdvice, screenFor, toolNeeded } from './blockRules';
import { Buckets } from './buckets';
import { BrewTools, type BrewHands } from './brewTools';
import { PipeTools, type TransportHands } from './pipeTools';
import type { RayHit } from './raycast';

export { digSound, facingTowards, screenFor } from './blockRules';

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
/** How often the "placed against it - open it from the front" hint may repeat. */
const PLACED_AGAINST_HINT_S = 180;

/** The collision test the placement rule needs from the physics. */
export interface BodyProbe {
  intersectsCell(x: number, y: number, z: number, height?: number): boolean;
}

/** The hand swing the interaction asks for (IView.triggerSwing). */
export interface SwingTarget {
  triggerSwing(): void;
}

export type UseOutcome = 'none' | 'screen' | 'pail' | 'placed' | 'tilled' | 'planted' | 'ate' | 'drank' | 'picked' | 'wrenched' | 'brewed' | 'refused';

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
  private readonly buckets: Buckets;
  private readonly pipes: PipeTools;
  private readonly brewing: BrewTools;

  constructor(
    private readonly world: IWorld,
    private readonly bus: GameBus,
    private readonly player: PlayerState,
    private readonly body: BodyProbe,
    private readonly swing: SwingTarget,
    private readonly rng: () => number = Math.random,
    transport: TransportHands | null = null,
    brew: BrewHands | null = null,
  ) {
    const self = this;
    this.buckets = new Buckets({
      world, bus, player,
      get placeCooldown() {
        return self.placeCooldown;
      },
      placed: () => (this.placeCooldown = PLACE_COOLDOWN_S),
      advise: (key, text) => this.advise(key, text),
      placeableCell: (x, y, z) => this.placeableCell(x, y, z),
      bodyIn: (x, y, z) => body.intersectsCell(x, y, z),
      edited: () => this.edits++,
      swing: () => swing.triggerSwing(),
    });
    this.pipes = new PipeTools({
      world, bus, player,
      advise: (key, text) => this.advise(key, text),
      swing: () => swing.triggerSwing(),
      stopMining: () => this.stopMining(),
    }, transport);
    this.brewing = new BrewTools({
      player,
      get placeCooldown() {
        return self.placeCooldown;
      },
      placed: () => (this.placeCooldown = PLACE_COOLDOWN_S),
      advise: (key, text) => this.advise(key, text),
      edited: () => this.edits++,
      swing: () => swing.triggerSwing(),
      stopMining: () => this.stopMining(),
    }, brew);
  }

  get mining(): boolean {
    return this.progress >= 0;
  }

  /** Advances mining (while `mineHeld`) on the targeted cell. Call every frame. */
  updateMining(dt: number, mineHeld: boolean, hit: RayHit | null): void {
    this.clock += dt;
    this.breakCooldown = Math.max(0, this.breakCooldown - dt);
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.pipes.update(dt);
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
   * an empty pail is held (so water can be scooped) and skips them otherwise. A held block is placed first when
   * `forcePlace` asks for it (Shift, the touch Place toggle) or when it is a building block aimed at a screen block
   * anywhere but its front (an engine on a furnace, a tank on a tank, bricks around a hearth). Then pipes and fluid
   * blocks (pipeTools.ts): the wrench, a bucket on a tank or fluid endpoint, the pipe screen. Then screens.
   * Brewing comes before all of that (brewTools.ts): a cup or a heated bucket takes the held item as the next step,
   * and a water container aimed at a furnace top is set there; a held drink is drunk after the screens.
   */
  use(hit: RayHit | null, forcePlace = false): UseOutcome {
    if (this.player.dead) return 'none';
    if (hit && hit.block.liquid === null) {
      const def = blockOfItem(this.player.heldStack()?.item ?? '');
      const against = def !== null && !forcePlace && placesAgainst(def, hit);
      if (def && (forcePlace || against)) {
        if (!this.placeBlock(hit, def)) return 'refused';
        if (against) {
          const front = hit.block.oriented ? 'its front or ' : '';
          this.advise('placed-against', `Placed against the ${hit.block.name}. To open it, use ${front}an empty hand.`, PLACED_AGAINST_HINT_S);
        }
        return 'placed';
      }
    }
    if (hit) {
      const brewed = this.brewing.use(hit) ?? this.brewing.placeContainer(hit);
      if (brewed !== null) return brewed;
      const piped = this.pipes.use(hit, this.player.heldStack()?.item ?? null);
      if (piped !== null) return piped;
    }
    const screen = hit && hit.block.liquid === null ? screenFor(hit.block, hit.x, hit.y, hit.z) : null;
    if (screen) {
      this.stopMining();
      this.bus.emit('ui:open', { screen });
      this.swing.triggerSwing();
      return 'screen';
    }
    // A fruiting bush is picked by hand, whatever is held.
    if (hit && hit.block.harvestLeaves !== null && hit.block.liquid === null) return this.pick(hit);
    const held = this.player.heldStack();
    if (!held) return 'none';
    if (itemOrNull(held.item)?.drink) return this.drinkHeld();
    // Food is eaten wherever the crosshair is (the sky included), unless this Use would plant it.
    const food = itemOrNull(held.item)?.food;
    if (food && !(hit && plantCell(this.world, held.item, hit))) return this.eatHeld();
    if (!hit) return 'none';
    const bucket = this.buckets.use(held.item, hit);
    if (bucket !== null) return bucket;
    if (isHoe(held)) return this.tillTarget(hit);
    if (plantedBy(held.item) && plantCell(this.world, held.item, hit)) return this.plantTarget(hit);
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
    const { x, y, z } = placementCell(hit);
    if (!this.placeableCell(x, y, z)) return false;
    if (def.placeOn) {
      const below = this.world.getBlock(x, y - 1, z);
      if (!def.placeOn.includes(below.key)) {
        this.advise(`place:${def.key}`, placeOnAdvice(def));
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
    // A fruiting bush gives its fruit and stays, picked (spec 14: harvestLeaves is a block rule).
    const left = leftBehind(def, voxel);
    if (!this.world.setVoxel(x, y, z, left, 'player')) return;
    this.edits++;
    for (const d of drops) this.player.give(d.item, d.count);
    this.player.wearHeld(def);
    exertMining(this.player);
    if (left !== AIR) {
      this.bus.emit('sfx', { name: 'harvest', x: x + 0.5, y: y + 0.5, z: z + 0.5 });
      return;
    }
    this.bus.emit('block:broken', { x, y, z, voxel });
    this.bus.emit('sfx', { name: isRipeCrop(def) ? 'harvest' : 'break', x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    this.popUnsupported(x, y + 1, z);
  }

  /** Use on a fruiting bush: its drops into the pack, the picked block in its place (entity kept), sfx harvest. */
  private pick(hit: RayHit): UseOutcome {
    if (this.placeCooldown > 0) return 'refused';
    const { x, y, z, voxel, block: def } = hit;
    if (!this.world.setVoxel(x, y, z, leftBehind(def, voxel), 'player')) return 'refused';
    this.edits++;
    for (const d of rollDrops(def, this.rng)) this.player.give(d.item, d.count);
    this.placeCooldown = PLACE_COOLDOWN_S;
    this.bus.emit('sfx', { name: 'harvest', x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    this.swing.triggerSwing();
    return 'picked';
  }

  /** A plant left standing on nothing (its farmland or soil was just broken) pops, dropping what it would. */
  private popUnsupported(x: number, y: number, z: number): void {
    if (!isUnsupported(this.world, x, y, z)) return;
    const voxel = this.world.getVoxel(x, y, z);
    const def = blockOf(voxel);
    if (!this.world.setVoxel(x, y, z, AIR, 'player')) return;
    for (const d of rollDrops(def, this.rng)) this.player.give(d.item, d.count);
    this.bus.emit('block:broken', { x, y, z, voxel });
    this.bus.emit('sfx', { name: isRipeCrop(def) ? 'harvest' : 'break', x: x + 0.5, y: y + 0.5, z: z + 0.5 });
  }

  private eatHeld(): UseOutcome {
    const result = eat(this.player);
    if (result.ok) {
      this.swing.triggerSwing();
      return 'ate';
    }
    if (result.message) this.advise(`eat:${result.reason}`, result.message);
    return 'refused';
  }

  private drinkHeld(): UseOutcome {
    const result = drink(this.player);
    if (result.ok) {
      this.swing.triggerSwing();
      return 'drank';
    }
    if (result.message) this.advise(`drink:${result.reason}`, result.message);
    return 'refused';
  }

  private tillTarget(hit: RayHit): UseOutcome {
    if (this.placeCooldown > 0) return 'refused';
    if (!canTill(this.world, hit.x, hit.y, hit.z, hit.face)) {
      if (TILLABLE.includes(hit.block.key)) {
        const blocked = hit.face === Face.PY && this.world.getVoxel(hit.x, hit.y + 1, hit.z) !== AIR;
        this.advise('till', blocked ? 'Clear the top of the soil before tilling it' : 'Till the soil from above: aim at its top');
      }
      return 'none';
    }
    if (!till(this.world, this.player, hit)) return 'refused';
    this.edits++;
    this.placeCooldown = PLACE_COOLDOWN_S;
    this.swing.triggerSwing();
    return 'tilled';
  }

  private plantTarget(hit: RayHit): UseOutcome {
    if (this.placeCooldown > 0) return 'refused';
    if (!plant(this.world, this.player, hit)) return 'refused';
    this.edits++;
    this.placeCooldown = PLACE_COOLDOWN_S;
    this.swing.triggerSwing();
    return 'planted';
  }

  private placeableCell(x: number, y: number, z: number): boolean {
    if (y < 0 || y >= WORLD_HEIGHT || !this.world.isLoaded(x, z)) return false;
    return this.world.getBlock(x, y, z).replaceable;
  }

  /** A toast that explains a refusal, at most once per `cooldownS` (default ADVICE_COOLDOWN_S) for the same subject. */
  advise(key: string, text: string, cooldownS = ADVICE_COOLDOWN_S): void {
    const last = this.advice.get(key);
    if (last !== undefined && this.clock - last < cooldownS) return;
    this.advice.set(key, this.clock);
    this.bus.emit('toast', { text, kind: 'info' });
  }
}

/**
 * A building block held against a block that has a screen goes on the face aimed at, unless that face is the front
 * (the furnace mouth, a machine's front), which still opens the screen. Pipes keep their own rules (pipeTools.ts).
 */
function placesAgainst(def: BlockDef, hit: RayHit): boolean {
  if (!buildsOnto(def) || hit.block.pipe !== null || !screenFor(hit.block, hit.x, hit.y, hit.z)) return false;
  return frontFace(hit.block, hit.voxel) !== hit.face;
}

/** What breaking or picking a block leaves in its cell: the picked stage of a bush (same facing and flags), else air. */
function leftBehind(def: BlockDef, voxel: Voxel): Voxel {
  return def.harvestLeaves !== null ? withId(voxel, blockByKey(def.harvestLeaves).id) : AIR;
}
