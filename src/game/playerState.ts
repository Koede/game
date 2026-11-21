/**
 * Everything about the player that is state rather than behaviour. Physics, controls, survival and the
 * simulation all read and write this one object.
 *
 * Conventions: `position` is the centre of the feet (the eye is PLAYER_EYE above it). Yaw is in radians, 0 looks
 * north (-Z) and positive turns left - exactly a three.js camera's rotation.y. Pitch is positive looking up.
 */
import { HOTBAR_SIZE, INVENTORY_SIZE, MAX_AIR_S, MAX_HEALTH, MAX_WARMTH, PLAYER_EYE } from '../core/constants';
import type { GameBus } from '../core/context';
import type { DamageCause } from '../core/gameEvents';
import { clamp, type Vec3 } from '../core/math';
import { blockOf, itemOrNull } from '../core/registry';
import type { BlockDef, Slot } from '../core/types';
import { Inventory } from './inventory';
import { wear } from './mining';

export interface BlockPos {
  x: number;
  y: number;
  z: number;
}

export interface PlayerBuffs {
  /** Seconds of Well-Warmed left (0 = not active). */
  wellWarmedS: number;
}

/** Lifetime counters by item / block key, recorded from the first moment of the game. */
export interface PlayerStats {
  made: Record<string, number>;
  placed: Record<string, number>;
  broken: Record<string, number>;
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
  inventory: Slot[];
  selectedSlot: number;
  home: BlockPos | null;
  spawn: Vec3;
  buffs: PlayerBuffs;
  stats: PlayerStats;
  dead: boolean;
  deathCause: DamageCause | null;
  sinceDamageS: number;
}

/** Upper bound of the "seconds since the last damage" counter, so it stays a small finite number in saves. */
const SINCE_DAMAGE_CAP_S = 3600;

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
  /** Slots 0..HOTBAR_SIZE-1 are the hotbar. */
  readonly inventory = new Inventory(INVENTORY_SIZE);
  selectedSlot = 0;
  /** Block position of the home furnace (set by the simulation), or null before the first furnace. */
  home: BlockPos | null = null;
  /** World spawn (feet position): where the player starts and respawns without a home. */
  readonly spawn: Vec3;
  readonly buffs: PlayerBuffs = { wellWarmedS: 0 };
  readonly stats: PlayerStats = { made: {}, placed: {}, broken: {}, deaths: 0 };
  dead = false;
  deathCause: DamageCause | null = null;
  /** Seconds since the player last took damage (advanced by Survival; health regenerates after a quiet spell). */
  sinceDamageS = SINCE_DAMAGE_CAP_S;
  /**
   * Radiation dose at the player from sources that are not radiating blocks (an overheating fission pile).
   * The simulation ADDS to it every tick the source is active; Survival consumes it and resets it to 0.
   */
  extraRadiation = 0;
  private readonly unsubscribe: Array<() => void>;

  constructor(readonly bus: GameBus, spawn: Vec3 = { x: 0.5, y: 64, z: 0.5 }) {
    this.spawn = { ...spawn };
    this.position = { ...spawn };
    this.unsubscribe = [
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
    const held = this.heldStack();
    const loss = wear(block, held);
    if (!held || held.durability === undefined || loss <= 0) return false;
    held.durability -= loss;
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

  /**
   * Puts items into the inventory. Emits 'item:gained' for what arrived (and 'inventory:changed'); what does
   * not fit is returned as a count after a warning toast.
   */
  give(item: string, count = 1, durability?: number): number {
    const left = this.inventory.add(item, count, durability);
    const gained = Math.floor(count) - left;
    if (gained > 0) this.bus.emit('item:gained', { item, count: gained });
    if (left > 0) {
      const name = itemOrNull(item)?.name ?? item;
      this.bus.emit('toast', { text: `Inventory full - no room for ${left} ${name}`, kind: 'warn', item });
    }
    return left;
  }

  setHome(x: number, y: number, z: number): void {
    this.home = { x, y, z };
  }

  /** Hurts the player. Emits 'player:damage' (and 'player:death' when health runs out) with their sounds. */
  damage(amount: number, cause: DamageCause): void {
    if (this.dead || !(amount > 0)) return;
    this.health = Math.max(0, this.health - amount);
    this.sinceDamageS = 0;
    this.bus.emit('player:damage', { amount, cause, health: this.health });
    if (this.health > 0) {
      this.bus.emit('sfx', { name: 'hurt' });
      return;
    }
    this.dead = true;
    this.deathCause = cause;
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
    this.health = homeIsHot ? MAX_HEALTH : MAX_HEALTH / 2;
    this.warmth = homeIsHot ? MAX_WARMTH : MAX_WARMTH / 2;
    this.air = MAX_AIR_S;
    this.buffs.wellWarmedS = 0;
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
      inventory: this.inventory.toJSON(),
      selectedSlot: this.selectedSlot,
      home: this.home ? { ...this.home } : null,
      spawn: { ...this.spawn },
      buffs: { ...this.buffs },
      stats: {
        made: { ...this.stats.made },
        placed: { ...this.stats.placed },
        broken: { ...this.stats.broken },
        deaths: this.stats.deaths,
      },
      dead: this.dead,
      deathCause: this.deathCause,
      sinceDamageS: this.sinceDamageS,
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
    this.inventory.load(s.inventory);
    this.selectedSlot = clamp(Math.floor(s.selectedSlot), 0, HOTBAR_SIZE - 1);
    this.home = s.home ? { ...s.home } : null;
    this.buffs.wellWarmedS = Math.max(0, s.buffs.wellWarmedS);
    this.stats.made = { ...s.stats.made };
    this.stats.placed = { ...s.stats.placed };
    this.stats.broken = { ...s.stats.broken };
    this.stats.deaths = s.stats.deaths;
    this.dead = s.dead;
    this.deathCause = s.deathCause;
    this.sinceDamageS = s.sinceDamageS;
    this.extraRadiation = 0;
  }
}
