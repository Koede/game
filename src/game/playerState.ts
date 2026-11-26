/**
 * Everything about the player that is state rather than behaviour. Physics, controls, survival and the
 * simulation all read and write this one object.
 *
 * Conventions: `position` is the centre of the feet (the eye is PLAYER_EYE above it). Yaw is in radians, 0 looks
 * north (-Z) and positive turns left - exactly a three.js camera's rotation.y. Pitch is positive looking up.
 */
import { HOTBAR_SIZE, HUNGRY_AT, INVENTORY_SIZE, MAX_AIR_S, MAX_FOOD, MAX_HEALTH, MAX_WARMTH, PLAYER_EYE, REGEN_MIN_FOOD } from '../core/constants';
import type { Difficulty, GameBus } from '../core/context';
import type { DamageCause } from '../core/gameEvents';
import { clamp, type Vec3 } from '../core/math';
import { blockOf, itemOrNull } from '../core/registry';
import type { BlockDef, Slot } from '../core/types';
import type { ColdCause } from './cold';
import { Buffs, type BuffsSnapshot } from './buffs';
import { Collectors } from './collectors';
import { GroundItems, THROWN_DELAY_S, type GroundItemSnapshot } from './groundItems';
import { PlayerCombat, type CombatSnapshot } from './combat';
import { Inventory } from './inventory';
import { PlayAssist, type AssistSnapshot } from './assist';
import { BlueprintBook, type BlueprintBookSnapshot } from './blueprintBook';
import { takesItem } from './lootFilter';
import { favouritesOf, setFavourites } from './inventoryTools';
import { pocketsOf, setPockets, type Pocket } from './pockets';
import { wear } from './mining';
import { Caravan, type CaravanSave } from './caravan';
import { RecipeBook, type RecipeBookSave } from './discovery';

export interface BlockPos {
  x: number;
  y: number;
  z: number;
}

/** The player's timed buffs (see ./buffs). */
export type PlayerBuffs = Buffs;

/** Lifetime counters by item / block key, recorded from the first moment of the game. */
export interface PlayerStats {
  made: Record<string, number>;
  placed: Record<string, number>;
  broken: Record<string, number>;
  /** Cups drunk by drink item key (missing in saves made before brewing). */
  drunk?: Record<string, number>;
  deaths: number;
}

export interface PlayerSnapshot {
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  onGround: boolean;
  inWater: boolean;
  headInWater: boolean;
  health: number;
  warmth: number;
  air: number;
  /** Food 0..MAX_FOOD (spec 12.1). Missing in saves made before hunger existed: a full bar. */
  food?: number;
  inventory: Slot[];
  /** Favourite inventory slots (sort and move-all leave them); missing in older saves. */
  favourites?: number[];
  /** Locked inventory slots (the per-slot lock; nothing moves out of or into them through the UI); missing in older saves. */
  locks?: number[];
  /** Pickup tick per inventory slot (sorting 'newest first' reads them); missing in older saves: none. */
  picked?: number[];
  /** The backpack's pockets (named sections); missing in older saves: one pocket. */
  pockets?: Pocket[];
  /** Play-assist state (pinned recipe...); missing in older saves. */
  assist?: AssistSnapshot;
  selectedSlot: number;
  home: BlockPos | null;
  spawn: Vec3;
  /** `wellFedS` is missing in saves made before hunger existed, `drinks` in saves made before brewing. */
  buffs: BuffsSnapshot;
  stats: PlayerStats;
  dead: boolean;
  deathCause: DamageCause | null;
  /** What chilled the player when the cold last hurt them. Missing in older saves. */
  coldCause?: ColdCause | null;
  sinceDamageS: number;
  /** Burning and the last attacker (spec 19.4). Missing in saves made before the Emberbound. */
  combat?: CombatSnapshot;
  /** Species of the automaton that killed the player (death screen). Missing in older saves. */
  killedBy?: string | null;
  /** Items lying in the world (docs/api/ground-items.md). Missing in saves made before ground items: none. */
  ground?: GroundItemSnapshot[];
  /** Recipe book and caravan (docs/api/discovery.md, caravan.md). Missing in older saves: empty. */
  book?: RecipeBookSave;
  /** Saved and granted blueprints and Gruk's build jobs (docs/api/blueprint.md). Missing in older saves: empty. */
  blueprints?: BlueprintBookSnapshot;
  caravan?: CaravanSave;
}

/** Upper bound of the "seconds since the last damage" counter, so it stays a small finite number in saves. */
const SINCE_DAMAGE_CAP_S = 3600;
/**
 * Coming back from death tops the food bar up to at least this: never starving, and enough above REGEN_MIN_FOOD
 * that a respawn at half health heals once it is warm, without eating first.
 */
export const RESPAWN_MIN_FOOD = Math.min(MAX_FOOD, REGEN_MIN_FOOD + 2);

const bump = (counters: Record<string, number>, key: string, by: number): void => {
  counters[key] = (counters[key] ?? 0) + by;
};

export class PlayerState {
  readonly position: Vec3;
  readonly velocity: Vec3 = { x: 0, y: 0, z: 0 };
  yaw = 0;
  pitch = 0;
  onGround = false;
  /** Feet or body are in a water block (written by the player physics). */
  inWater = false;
  /** The eye is in a water block. */
  headInWater = false;
  health = MAX_HEALTH;
  warmth = MAX_WARMTH;
  /** Seconds of breath left. */
  air = MAX_AIR_S;
  /** Food 0..MAX_FOOD (spec 12.1). Change it through `spendFood` / `feed` so the Hungry warning fires. */
  food = MAX_FOOD;
  /** The player is sprinting right now (written by the player physics; sprinting drains food faster). */
  sprinting = false;
  /** Seconds until the next bite is allowed (not saved; counted down by the hunger rules every tick). */
  eatCooldownS = 0;
  /** Seconds until the next sip is allowed (not saved; counted down by Survival every tick). */
  drinkCooldownS = 0;
  /** Slots 0..HOTBAR_SIZE-1 are the hotbar. */
  readonly inventory = new Inventory(INVENTORY_SIZE);
  selectedSlot = 0;
  /** Block position of the home furnace (set by the simulation), or null before the first furnace. */
  home: BlockPos | null = null;
  /** World spawn (feet position): where the player starts and respawns without a home. */
  readonly spawn: Vec3;
  readonly buffs: PlayerBuffs = new Buffs();
  readonly stats: PlayerStats = { made: {}, placed: {}, broken: {}, drunk: {}, deaths: 0 };
  /**
   * Dev Mode (docs/api/dev-mode.md): no damage, no wear, free placing, optional flight. Set by GameState from the
   * world's mode; never saved with the player.
   */
  dev = false;
  /** Multiplies every hit taken (the Warding focus sets 0.5 for a while; src/magic/magic.ts). */
  damageScale = 1;
  /** Dev Mode: placing a block does not use it up. */
  devFreePlace = true;
  /** Dev Mode: flying (no gravity; Jump rises, sprint descends). */
  flying = false;
  dead = false;
  deathCause: DamageCause | null = null;
  /**
   * What chilled the player when the cold last hurt them (written by Survival just before cold damage), so a cold
   * death can name it: night, rain, snow, the frostfell or cold water.
   */
  coldCause: ColdCause | null = null;
  /** Seconds since the player last took damage (advanced by Survival; health regenerates after a quiet spell). */
  sinceDamageS = SINCE_DAMAGE_CAP_S;
  /**
   * Radiation dose at the player from sources that are not radiating blocks (an overheating fission pile).
   * The simulation ADDS to it every tick the source is active; Survival consumes it and resets it to 0.
   */
  extraRadiation = 0;
  /**
   * Species of the automaton behind the death (a blow, or the burning its bolt left), null for any other death.
   * The death screen names it with `killerLine(deathCause, killedBy)` ("Felled by a Forge Warden").
   */
  killedBy: string | null = null;
  /** The fight with the Emberbound: damagePlayer, burning, difficulty, the swing cooldown (spec 19.4). */
  readonly combat: PlayerCombat;
  /** Items lying in the world: everything that gives items spawns them here (see `drop`, `dropHeld`). */
  readonly ground: GroundItems;
  /** Pinned recipe, last hand recipe, undo and the like (./assist). */
  readonly assist = new PlayAssist();
  /** Hidden recipes found by experiment (src/game/discovery.ts). */
  readonly book = new RecipeBook();
  /** The blueprints the player owns and the jobs Gruk is working (./blueprintBook). */
  readonly blueprints = new BlueprintBook();
  /** The trade caravan's prices and visit (src/game/caravan.ts). */
  readonly caravan = new Caravan();
  /** Handheld collectors (vacuum pump, later the electromagnet). */
  readonly collectors: Collectors;
  private readonly unsubscribe: Array<() => void>;

  constructor(readonly bus: GameBus, spawn: Vec3 = { x: 0.5, y: 64, z: 0.5 }) {
    this.spawn = { ...spawn };
    this.position = { ...spawn };
    this.combat = new PlayerCombat(this);
    this.ground = new GroundItems(bus);
    this.collectors = new Collectors(this, bus);
    this.unsubscribe = [
      () => this.combat.dispose(),
      this.inventory.onChange(() => bus.emit('inventory:changed', {})),
      bus.on('item:made', (e) => bump(this.stats.made, e.item, e.count)),
      bus.on('block:placed', (e) => bump(this.stats.placed, blockOf(e.voxel).key, 1)),
      bus.on('block:broken', (e) => bump(this.stats.broken, blockOf(e.voxel).key, 1)),
    ];
  }

  /** Stops listening to the bus (when the game this player belongs to is torn down). */
  dispose(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
  }

  get eyeY(): number {
    return this.position.y + PLAYER_EYE;
  }

  get wellWarmed(): boolean {
    return this.buffs.wellWarmedS > 0;
  }

  get wellFed(): boolean {
    return this.buffs.wellFedS > 0;
  }

  /** Food at or below HUNGRY_AT: no sprinting (spec 12.1). */
  get hungry(): boolean {
    return this.food <= HUNGRY_AT;
  }

  /**
   * Takes food points away (already scaled by whoever decides the cost). Crossing into Hungry warns once with a
   * toast; the warning comes back only after the bar has been above the line again.
   */
  spendFood(amount: number): void {
    if (!(amount > 0) || this.dead) return;
    const wasHungry = this.hungry;
    this.food = Math.max(0, this.food - amount);
    if (!wasHungry && this.hungry) {
      this.bus.emit('toast', { text: 'You are hungry - eat something. You cannot sprint until you do.', kind: 'warn' });
    }
  }

  /** Adds food points, up to MAX_FOOD. */
  feed(amount: number): void {
    if (!(amount > 0)) return;
    this.food = Math.min(MAX_FOOD, this.food + amount);
  }

  /** Unit vector the player looks along, written into `out`. */
  viewDir(out: Vec3): Vec3 {
    const c = Math.cos(this.pitch);
    out.x = -Math.sin(this.yaw) * c;
    out.y = Math.sin(this.pitch);
    out.z = -Math.cos(this.yaw) * c;
    return out;
  }

  heldStack(): Slot {
    return this.inventory.get(this.selectedSlot);
  }

  selectSlot(slot: number): void {
    const next = clamp(Math.floor(slot), 0, HOTBAR_SIZE - 1);
    if (next === this.selectedSlot) return;
    this.selectedSlot = next;
    this.bus.emit('hotbar:selected', { slot: next });
  }

  /** Takes items out of the selected slot (placing a block uses one). Returns what was taken. */
  consumeHeld(count = 1): Slot {
    return this.inventory.removeAt(this.selectedSlot, count);
  }

  /**
   * Applies the wear of breaking `block` to the held tool. Returns true when the tool broke (it is then gone,
   * and 'tool:broke' plus its sound and a toast were emitted).
   */
  wearHeld(block: BlockDef): boolean {
    return this.wearHeldTool(wear(block, this.heldStack()));
  }

  /**
   * Takes `uses` of durability from the held tool (a hoe tilling soil). Returns true when the tool broke, with the
   * same events as `wearHeld`.
   */
  wearHeldTool(uses: number): boolean {
    const held = this.heldStack();
    if (!held || held.durability === undefined || !(uses > 0) || this.dev) return false;
    held.durability -= uses;
    if (held.durability > 0) {
      this.inventory.notifyChanged();
      return false;
    }
    this.inventory.set(this.selectedSlot, null);
    this.bus.emit('tool:broke', { item: held.item });
    this.bus.emit('sfx', { name: 'tool_break' });
    this.bus.emit('toast', { text: `Your ${itemOrNull(held.item)?.name ?? held.item} broke`, kind: 'warn', item: held.item });
    return true;
  }

  /** Whether the loot filter (Settings.lootFilter) lets the player pick `item` up from the ground. */
  takes(item: string): boolean {
    return takesItem(this.assist.lootFilter, item);
  }

  /**
   * Puts items into the inventory. Emits 'item:gained' for what arrived (and 'inventory:changed'); what does
   * not fit is returned as a count after a warning toast.
   */
  give(item: string, count = 1, durability?: number, enchants?: Record<string, number>): number {
    const left = this.inventory.add(item, count, durability, 0, this.inventory.size, undefined, enchants);
    const gained = Math.floor(count) - left;
    if (gained > 0) this.bus.emit('item:gained', { item, count: gained });
    if (left > 0) {
      const name = itemOrNull(item)?.name ?? item;
      this.bus.emit('toast', { text: `Inventory full - no room for ${left} ${name}`, kind: 'warn', item });
    }
    return left;
  }

  /**
   * Puts items into the world as ground items: at (x, y, z), or at the player's feet when no position is given.
   * THE call for "something gave items": broken blocks, animals, spills. Returns nothing; they are picked up again
   * by walking close (a collector pulls from further).
   */
  drop(item: string, count = 1, durability?: number, at?: { x: number; y: number; z: number }, magnet?: number): void {
    const p = at ?? { x: this.position.x, y: this.position.y + 0.5, z: this.position.z };
    this.ground.spawn(item, count, p.x, p.y, p.z, { durability, magnet });
  }

  /** Drops several stacks at one point (a spill, an animal's drops). */
  dropAll(
    stacks: ReadonlyArray<{ item: string; count: number; durability?: number } | null>,
    at?: { x: number; y: number; z: number },
    magnet?: number,
  ): void {
    for (const s of stacks) if (s) this.drop(s.item, s.count, s.durability, at, magnet);
  }

  /** Throws `count` out of `slot` in front of the player (the drop key). Returns how many left the pack. */
  dropSlot(slot: number, count = 1): number {
    const s = this.inventory.get(slot);
    if (!s || this.dead) return 0;
    const taken = this.inventory.removeAt(slot, Math.min(Math.max(1, Math.floor(count)), s.count));
    if (!taken) return 0;
    const dir = this.viewDir({ x: 0, y: 0, z: 0 });
    // Out of the hand: a little in front of the eye, thrown forward and slightly up.
    const hx = this.position.x + dir.x * 0.5;
    const hz = this.position.z + dir.z * 0.5;
    this.ground.spawn(taken.item, taken.count, hx, this.eyeY - 0.35, hz, {
      durability: taken.durability,
      enchants: taken.enchants,
      scatter: false,
      vx: dir.x * 4.2,
      vy: 2 + dir.y * 3,
      vz: dir.z * 4.2,
      delayS: THROWN_DELAY_S,
    });
    this.bus.emit('sfx', { name: 'place', x: hx, y: this.eyeY - 0.35, z: hz, volume: 0.4, pitch: 1.5 });
    return taken.count;
  }

  /** The drop key: one of the held item, or all of the stack. Returns how many were dropped. */
  dropHeld(all = false): number {
    const s = this.heldStack();
    return s ? this.dropSlot(this.selectedSlot, all ? s.count : 1) : 0;
  }

  setHome(x: number, y: number, z: number): void {
    this.home = { x, y, z };
  }

  /** The session's difficulty (Settings.difficulty), set through `combat.setDifficulty`. */
  get difficulty(): Difficulty {
    return this.combat.difficulty;
  }

  /**
   * An automaton hurts the player: difficulty, armour, knockback, 'player:attacked', burning (see
   * PlayerCombat.damagePlayer). `kind` is the automaton's species key. Returns the damage dealt.
   */
  damagePlayer(amount: number, cause: DamageCause, sourceX: number, sourceZ: number, kind: string, sourceY?: number): number {
    return this.combat.damagePlayer(amount, cause, sourceX, sourceZ, kind, sourceY);
  }

  /** Hurts the player. Emits 'player:damage' (and 'player:death' when health runs out) with their sounds. */
  damage(amount: number, cause: DamageCause): void {
    if (this.dead || !(amount > 0) || this.dev) return;
    amount *= this.damageScale;
    this.health = Math.max(0, this.health - amount);
    this.sinceDamageS = 0;
    this.bus.emit('player:damage', { amount, cause, health: this.health });
    if (this.health > 0) {
      this.bus.emit('sfx', { name: 'hurt' });
      return;
    }
    this.dead = true;
    this.deathCause = cause;
    this.killedBy = cause === 'automaton' || cause === 'ember' ? this.combat.lastAttacker : null;
    this.combat.reset();
    this.stats.deaths++;
    this.velocity.x = this.velocity.y = this.velocity.z = 0;
    this.bus.emit('sfx', { name: 'death' });
    this.bus.emit('player:death', { cause });
  }

  heal(amount: number): void {
    if (this.dead || !(amount > 0)) return;
    this.health = Math.min(MAX_HEALTH, this.health + amount);
  }

  /**
   * Brings the player back with the whole inventory: full health and warmth when the home furnace is hot,
   * half otherwise. `at` is the feet position to appear at (Survival.respawn picks one); default is the world spawn.
   */
  respawn(homeIsHot: boolean, at: Vec3 = this.spawn): void {
    this.dead = false;
    this.deathCause = null;
    this.killedBy = null;
    this.combat.reset();
    this.health = homeIsHot ? MAX_HEALTH : MAX_HEALTH / 2;
    this.warmth = homeIsHot ? MAX_WARMTH : MAX_WARMTH / 2;
    this.air = MAX_AIR_S;
    this.buffs.clear();
    this.food = Math.max(this.food, RESPAWN_MIN_FOOD);
    this.eatCooldownS = 0;
    this.drinkCooldownS = 0;
    this.sprinting = false;
    this.sinceDamageS = SINCE_DAMAGE_CAP_S;
    this.extraRadiation = 0;
    this.position.x = at.x;
    this.position.y = at.y;
    this.position.z = at.z;
    this.velocity.x = this.velocity.y = this.velocity.z = 0;
    this.onGround = false;
    this.inWater = this.headInWater = false;
    this.bus.emit('player:respawn', { x: at.x, y: at.y, z: at.z });
  }

  /** Advances the quiet-time counter (called by Survival every tick). */
  addQuietTime(dt: number): void {
    this.sinceDamageS = Math.min(SINCE_DAMAGE_CAP_S, this.sinceDamageS + dt);
  }

  toJSON(): PlayerSnapshot {
    return {
      position: { ...this.position },
      velocity: { ...this.velocity },
      yaw: this.yaw,
      pitch: this.pitch,
      onGround: this.onGround,
      inWater: this.inWater,
      headInWater: this.headInWater,
      health: this.health,
      warmth: this.warmth,
      air: this.air,
      food: this.food,
      inventory: this.inventory.toJSON(),
      favourites: [...favouritesOf(this.inventory)].sort((a, b) => a - b),
      locks: [...this.inventory.locked].sort((a, b) => a - b),
      picked: [...this.inventory.ticks],
      pockets: pocketsOf(this.inventory),
      assist: this.assist.toJSON(),
      selectedSlot: this.selectedSlot,
      home: this.home ? { ...this.home } : null,
      spawn: { ...this.spawn },
      buffs: this.buffs.toJSON(),
      stats: {
        made: { ...this.stats.made },
        placed: { ...this.stats.placed },
        broken: { ...this.stats.broken },
        drunk: { ...this.stats.drunk },
        deaths: this.stats.deaths,
      },
      dead: this.dead,
      deathCause: this.deathCause,
      coldCause: this.coldCause,
      sinceDamageS: this.sinceDamageS,
      combat: this.combat.toJSON(),
      killedBy: this.killedBy,
      ground: this.ground.toJSON(),
      book: this.book.toJSON(),
      blueprints: this.blueprints.toJSON(),
      caravan: this.caravan.toJSON(),
    };
  }

  load(s: PlayerSnapshot): void {
    Object.assign(this.position, s.position);
    Object.assign(this.velocity, s.velocity);
    Object.assign(this.spawn, s.spawn);
    this.yaw = s.yaw;
    this.pitch = s.pitch;
    this.onGround = s.onGround;
    this.inWater = s.inWater;
    this.headInWater = s.headInWater;
    this.health = clamp(s.health, 0, MAX_HEALTH);
    this.warmth = clamp(s.warmth, 0, MAX_WARMTH);
    this.air = clamp(s.air, 0, MAX_AIR_S);
    this.food = typeof s.food === 'number' && Number.isFinite(s.food) ? clamp(s.food, 0, MAX_FOOD) : MAX_FOOD;
    this.eatCooldownS = 0;
    this.drinkCooldownS = 0;
    this.sprinting = false;
    this.inventory.load(s.inventory);
    setFavourites(this.inventory, s.favourites);
    this.inventory.setLocks(s.locks);
    this.inventory.setTicks(s.picked);
    setPockets(this.inventory, s.pockets);
    this.assist.load(s.assist);
    this.selectedSlot = clamp(Math.floor(s.selectedSlot), 0, HOTBAR_SIZE - 1);
    this.home = s.home ? { ...s.home } : null;
    this.buffs.load(s.buffs);
    this.stats.made = { ...s.stats.made };
    this.stats.placed = { ...s.stats.placed };
    this.stats.broken = { ...s.stats.broken };
    this.stats.drunk = { ...s.stats.drunk };
    this.stats.deaths = s.stats.deaths;
    this.dead = s.dead;
    this.deathCause = s.deathCause;
    this.coldCause = s.coldCause ?? null;
    this.sinceDamageS = s.sinceDamageS;
    this.extraRadiation = 0;
    this.combat.load(s.combat);
    this.killedBy = this.dead && typeof s.killedBy === 'string' ? s.killedBy : null;
    this.collectors.stop();
    this.ground.load(s.ground);
    this.book.load(s.book);
    this.blueprints.load(s.blueprints);
    this.caravan.load(s.caravan);
  }
}
