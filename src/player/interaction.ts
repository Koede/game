/**
 * What the player does to the block under the crosshair (spec 3.6): mining with progress, drops, tool wear and
 * dig sounds; "use" in priority order - station or machine screen, then the pail, the hoe (tilling), planting and
 * eating (spec 12), then placing the held block - with the placement rules (replaceable target, placeOn, never
 * inside the player, oriented blocks face the player).
 * DOM-free: it talks to the rest of the game through the IWorld, the PlayerState and the event bus.
 */
import type { GameBus } from '../core/context';
import { blockOf, blockOfItem, block as blockByKey, itemOrNull } from '../core/registry';
import { AIR, Face, Facing, WORLD_HEIGHT, makeVoxel, voxelActive, voxelVariant, withActive, withId, type BlockDef, type ItemDef, type IWorld, type Voxel } from '../core/types';
import { DOOR_TOP, doorPartnerStep } from '../core/doorShape';
import {
  TILLABLE,
  breakVein,
  canHarvest,
  canMine,
  magnetRadius,
  planVein,
  shapeDrops,
  canTill,
  drink,
  eat,
  exertMining,
  fellTree,
  harvest,
  isHoe,
  isRipeCrop,
  popUnsupportedAt,
  miningTime,
  placementCell,
  plant,
  plantCell,
  plantedBy,
  refuelChainsaw,
  rollDrops,
  isSawFuel,
  till,
  type PlayerState,
} from '../game';
import { buildsOnto, digPitch, digSound, placePitch, facingTowards, frontFace, placeOnAdvice, screenFor, toolNeeded } from './blockRules';
import { Buckets } from './buckets';
import { BrewTools, type BrewHands } from './brewTools';
import { HandTools, type HandHands } from './handTools';
import { ToolUses } from './toolUses';
import { SapTools } from './sapTools';
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

export type UseOutcome = 'none' | 'screen' | 'pail' | 'placed' | 'tilled' | 'planted' | 'ate' | 'drank' | 'fuelled' | 'picked' | 'wrenched' | 'brewed' | 'worked' | 'poured' | 'refused';

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
  /** Counts every advise() call, shown or held back by its cooldown. */
  private adviceGiven = 0;
  private readonly buckets: Buckets;
  private readonly pipes: PipeTools;
  private readonly brewing: BrewTools;
  private readonly handwork: HandTools;
  private readonly sap: SapTools;
  private readonly toolUses: ToolUses;

  constructor(
    private readonly world: IWorld,
    private readonly bus: GameBus,
    private readonly player: PlayerState,
    private readonly body: BodyProbe,
    private readonly swing: SwingTarget,
    private readonly rng: () => number = Math.random,
    transport: TransportHands | null = null,
    brew: BrewHands | null = null,
    hands: HandHands | null = null,
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
    this.sap = new SapTools({
      player, bus,
      advise: (key, text) => this.advise(key, text),
      swing: () => swing.triggerSwing(),
      stopMining: () => this.stopMining(),
    });
    this.toolUses = new ToolUses({
      world, player, bus, rng,
      get cooldown() {
        return self.placeCooldown;
      },
      startCooldown: () => (this.placeCooldown = PLACE_COOLDOWN_S),
      swing: () => swing.triggerSwing(),
      stopMining: () => this.stopMining(),
    });
    this.handwork = new HandTools({
      player,
      advise: (key, text) => this.advise(key, text),
      swing: () => swing.triggerSwing(),
      stopMining: () => this.stopMining(),
    }, hands);
  }

  /** A Use handler that goes first (after placing against a screen block); returns null to pass. Set by the app. */
  beforeUse: ((hit: RayHit | null) => 'worked' | 'refused' | 'screen' | null) | null = null;
  /** An axe blow on a log (game/fallingTrees.ts): true when the tree takes the blow instead of the log breaking. Set by the app. */
  treeChop: ((hit: RayHit) => boolean) | null = null;

  get mining(): boolean {
    return this.progress >= 0;
  }

  /** Advances mining (while `mineHeld`) on the targeted cell. Call every frame. */
  updateMining(dt: number, mineHeld: boolean, hit: RayHit | null): void {
    this.clock += dt;
    this.breakCooldown = Math.max(0, this.breakCooldown - dt);
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.pipes.update(dt);
    this.sap.update(dt);
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
    const time = miningTime(def, this.player.heldStack(), this.player.wellWarmed, this.player.buffs.miningMult, this.player.buffs.strength);
    if (Number.isFinite(time)) this.progress = time <= 0 ? 1 : Math.min(1, this.progress + dt / time);

    this.digTimer -= dt;
    if (this.digTimer <= 0) {
      this.digTimer += DIG_INTERVAL_S;
      this.bus.emit('sfx', { name: digSound(def), x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5, pitch: digPitch(def, this.player.heldStack()) });
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
   * and a water container aimed at a furnace top is set there; a held drink is drunk after the screens. Hand work comes
   * right after (handTools.ts): a stroke, an insert or a take at a hand station, a mould poured from a molten furnace.
   */
  use(hit: RayHit | null, forcePlace = false): UseOutcome {
    const advised = this.adviceGiven;
    const outcome = this.useOn(hit, forcePlace);
    if (outcome !== 'none' || this.player.dead) return outcome;
    if (this.adviceGiven !== advised) return outcome; // a rule already explained itself (maybe on cooldown): no second toast
    // Nothing claimed this Use: an item that is not a block-and-target thing (an elixir) may still act, set by the app...
    const last = this.lastResort?.(hit) ?? null;
    if (last !== null) return last;
    // ...and otherwise the player is told why nothing happened (a silent press reads as a broken button).
    this.explainNothing(hit);
    return 'none';
  }

  /** Last say on a Use nothing else claimed (the elixir drink, set by the app); null to pass. */
  lastResort: ((hit: RayHit | null) => UseOutcome | null) | null = null;

  /** The toast for a held item aimed at a block it cannot do anything to. Bare hands stay quiet (a tap is not a request). */
  private explainNothing(hit: RayHit | null): void {
    const held = this.player.heldStack();
    if (!hit || !held || hit.block.liquid !== null) return;
    const item = itemOrNull(held.item);
    if (!item) return;
    this.advise(`nouse:${item.key}:${hit.block.key}`, noUseAdvice(item, hit.block));
  }

  private useOn(hit: RayHit | null, forcePlace: boolean): UseOutcome {
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
    // Essentia & Research (src/magic/magic.ts, set by the app): the notebook, rod, vials and jars, before sap and screens.
    if (!forcePlace && this.beforeUse) {
      const magic = this.beforeUse(hit && hit.block.liquid === null ? hit : null);
      if (magic !== null) {
        this.stopMining();
        if (magic === 'worked') this.swing.triggerSwing();
        return magic === 'screen' ? 'screen' : magic === 'worked' ? 'worked' : 'refused';
      }
    }
    // A glass beaker aimed at a pine log taps its sap (sapTools.ts), before any placing or screen.
    if (hit && !forcePlace) {
      const tapped = this.sap.use(hit);
      if (tapped !== null) return tapped === 'tapped' ? 'worked' : 'refused';
    }
    if (hit && !forcePlace) {
      const swung = this.swingDoor(hit);
      if (swung !== null) return swung;
    }
    if (hit) {
      const brewed = this.brewing.use(hit) ?? this.brewing.placeContainer(hit);
      if (brewed !== null) return brewed;
      const worked = this.handwork.use(hit, forcePlace);
      if (worked !== null) return worked;
      const piped = this.pipes.use(hit, this.player.heldStack()?.item ?? null);
      if (piped !== null) return piped;
      // Tools and items on existing blocks (toolUses.ts): strip, reap, rivet, turn with the wrench...
      const used = this.toolUses.use(hit);
      if (used !== null) return used;
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
    // A Fuel Canister in hand tops up a chainsaw carried in the pack.
    if (isSawFuel(held.item) && refuelChainsaw(this.player) === 'refuelled') {
      this.swing.triggerSwing();
      return 'fuelled';
    }
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
    if (!this.placeableCell(x, y, z)) {
      this.advise('place:nospace', y < 0 || y >= WORLD_HEIGHT ? 'Nothing can be built past the edge of the world' : 'There is no room to place that there');
      return false;
    }
    if (def.placeOn) {
      const below = this.world.getBlock(x, y - 1, z);
      if (!def.placeOn.includes(below.key)) {
        this.advise(`place:${def.key}`, placeOnAdvice(def));
        return false;
      }
    }
    if (def.solid && this.body.intersectsCell(x, y, z, def.shape === 'slab' ? 0.5 : 1)) {
      this.advise('place:body', 'You are standing in the way - step aside to place that');
      return false;
    }
    // A door is two cells: the top half goes in the cell above, which must be free and clear of the player.
    const door = def.shape === 'door';
    if (door && (!this.placeableCell(x, y + 1, z) || this.body.intersectsCell(x, y + 1, z, 1))) {
      this.advise(`place:${def.key}`, 'A door needs two cells of room: clear the cell above.');
      return false;
    }
    const facing = def.oriented ? facingTowards(this.player.yaw) : Facing.North;
    const voxel = makeVoxel(def.id, facing);
    if (!this.world.setVoxel(x, y, z, voxel, 'player')) return false;
    if (door) this.world.setVoxel(x, y + 1, z, makeVoxel(def.id, facing, false, DOOR_TOP), 'player');
    this.edits++;
    if (!(this.player.dev && this.player.devFreePlace)) this.player.consumeHeld(1);
    this.placeCooldown = PLACE_COOLDOWN_S;
    this.bus.emit('block:placed', { x, y, z, voxel });
    this.bus.emit('sfx', { name: 'place', x: x + 0.5, y: y + 0.5, z: z + 0.5, pitch: placePitch(def), volume: 0.8 });
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
    // A chainsaw takes the whole trunk (game/felling.ts); without one, or without fuel, this is null.
    if (fellTree(this.world, this.player, hit.x, hit.y, hit.z, this.rng)) {
      this.progress = -1;
      this.breakCooldown = BREAK_COOLDOWN_S;
      this.edits++;
      exertMining(this.player);
      return;
    }
    // An axe on a tree's base wears its health down; the tree falls when that runs out (game/fallingTrees.ts).
    if (this.treeChop !== null && this.treeChop(hit)) {
      this.progress = -1;
      this.breakCooldown = BREAK_COOLDOWN_S;
      return;
    }
    const def = hit.block;
    const held = this.player.heldStack();
    const shaped = shapeDrops(harvest(def, held, this.rng), held, this.rng);
    const drops = shaped.drops;
    const { x, y, z, voxel } = hit;
    // Enchants (src/game/enchantEffects.ts): read before the break, since the tool can wear out on it.
    const magnet = magnetRadius(held);
    const vein = canHarvest(def, held) ? planVein(this.world, this.player, x, y, z) : [];
    this.progress = -1;
    this.breakCooldown = BREAK_COOLDOWN_S;
    // A fruiting bush gives its fruit and stays, picked (spec 14: harvestLeaves is a block rule).
    const left = leftBehind(def, voxel);
    if (!this.world.setVoxel(x, y, z, left, 'player')) return;
    this.edits++;
    if (def.shape === 'door') this.clearDoorPartner(def, x, y, z, voxel);
    this.player.dropAll(drops, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, magnet);
    if (shaped.bonus) this.bus.emit('sfx', { name: 'pickup', x: x + 0.5, y: y + 0.5, z: z + 0.5, pitch: 1.6 });
    const broke = this.player.wearHeld(def);
    exertMining(this.player);
    if (vein.length > 0 && !broke && left === AIR) this.edits += breakVein(this.world, this.player, vein, this.rng, rollDrops);
    if (left !== AIR) {
      this.bus.emit('sfx', { name: 'harvest', x: x + 0.5, y: y + 0.5, z: z + 0.5 });
      return;
    }
    this.bus.emit('block:broken', { x, y, z, voxel });
    this.bus.emit('sfx', { name: isRipeCrop(def) ? 'harvest' : 'break', x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    this.popUnsupported(x, y + 1, z);
  }

  /** Use on a wooden door (docs/api/door.md): both halves swing open or shut together. Null when the block is no door. */
  private swingDoor(hit: RayHit): UseOutcome | null {
    if (hit.block.shape !== 'door') return null;
    if (this.placeCooldown > 0) return 'refused';
    const { x, y, z, voxel, block: def } = hit;
    const on = !voxelActive(voxel);
    const py = y + doorPartnerStep(voxelVariant(voxel));
    if (!this.world.setVoxel(x, y, z, withActive(voxel, on), 'player')) return 'refused';
    const partner = this.world.getVoxel(x, py, z);
    if (blockOf(partner).key === def.key) this.world.setVoxel(x, py, z, withActive(partner, on), 'player');
    this.edits++;
    this.placeCooldown = PLACE_COOLDOWN_S;
    this.bus.emit('sfx', { name: 'place', x: x + 0.5, y: y + 0.5, z: z + 0.5, pitch: on ? 1.2 : 0.9, volume: 0.6 });
    this.swing.triggerSwing();
    return 'worked';
  }

  /** Breaking one half of a door takes the other half with it (no second drop). */
  private clearDoorPartner(def: BlockDef, x: number, y: number, z: number, voxel: Voxel): void {
    const py = y + doorPartnerStep(voxelVariant(voxel));
    if (blockOf(this.world.getVoxel(x, py, z)).key === def.key) this.world.setVoxel(x, py, z, AIR, 'player');
  }

  /** Use on a fruiting bush: its drops into the pack, the picked block in its place (entity kept), sfx harvest. */
  private pick(hit: RayHit): UseOutcome {
    if (this.placeCooldown > 0) return 'refused';
    const { x, y, z, voxel, block: def } = hit;
    if (!this.world.setVoxel(x, y, z, leftBehind(def, voxel), 'player')) return 'refused';
    this.edits++;
    this.player.dropAll(rollDrops(def, this.rng), { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    this.placeCooldown = PLACE_COOLDOWN_S;
    this.bus.emit('sfx', { name: 'harvest', x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    this.swing.triggerSwing();
    return 'picked';
  }

  /** A plant left standing on nothing (its farmland or soil was just broken) pops, dropping what it would. */
  private popUnsupported(x: number, y: number, z: number): void {
    const voxel = popUnsupportedAt(this.world, this.bus, x, y, z, this.rng, (items, at) => this.player.dropAll(items, at), 'player');
    if (voxel !== null) this.bus.emit('block:broken', { x, y, z, voxel });
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
    // Refusals (the cooldown) are quiet, like a bite.
    if (!drink(this.player).ok) return 'refused';
    this.swing.triggerSwing();
    return 'drank';
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
    this.adviceGiven++;
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

/** Why the held item did nothing on the block: a hint where the tool has a real use nearby, else a plain statement. */
export function noUseAdvice(item: ItemDef, target: BlockDef): string {
  if (isHoe({ item: item.key, count: 1 })) return `A hoe only tills dirt and grass, from above - not ${target.name}`;
  const kind = item.tool?.kind;
  if (kind && kind !== 'hoe' && canMine(target)) return `Nothing to do with the ${item.name} on ${target.name} - hold Mine to dig it`;
  return `The ${item.name} does nothing on ${target.name}`;
}

/** What breaking or picking a block leaves in its cell: the picked stage of a bush (same facing and flags), else air. */
function leftBehind(def: BlockDef, voxel: Voxel): Voxel {
  return def.harvestLeaves !== null ? withId(voxel, blockByKey(def.harvestLeaves).id) : AIR;
}
