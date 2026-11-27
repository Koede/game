/**
 * The player's side of fighting the Emberbound (spec 19.4): the one entry point automatons hurt the player through
 * (`damagePlayer`: difficulty, armour, knockback away from the attacker, 'player:attacked' for the HUD, the attacker
 * remembered for the death screen, a bolt's burning), the burning state, the difficulty of the session, and the
 * player's own swing cooldown with weapons and tools.
 *
 * PlayerState owns one `PlayerCombat` (`player.combat`); Survival ticks it every 20 Hz tick.
 */
import { FLAG_PEACEFUL, HOSTILE_DAMAGE_MULT, MOB_HIT_COOLDOWN_S, PLAYER_EYE, WEAPON_HIT_COOLDOWN_S } from '../core/constants';
import type { Difficulty } from '../core/context';
import type { DamageCause } from '../core/gameEvents';
import { armouredDamage, bestArmour } from '../core/hostile';
import { creatureOrNull, itemOrNull } from '../core/registry';
import type { HostileAttack } from '../core/types';
import { LegendaryState } from './legendary';
import type { PlayerState } from './playerState';

/** Horizontal knockback speed (blocks/s) of a blow whose automaton names none. */
export const KNOCKBACK_DEFAULT = 3;
/** Upward speed a blow gives a player standing on the ground, so the push carries (the physics damps grounded sliding fast). */
export const KNOCKBACK_LIFT = 4.5;
/** Burning deals its damage once per this many seconds. */
export const BURN_INTERVAL_S = 1;
/** Float drift allowance when counting burn time on a 20 Hz tick. */
const EPS = 1e-6;

/** Causes the difficulty multiplier scales: everything an automaton does to the player. */
const HOSTILE_CAUSES: readonly DamageCause[] = ['automaton', 'ember'];

/** Damage after the difficulty: automaton blows and their burning x HOSTILE_DAMAGE_MULT, anything else unchanged. */
export const difficultyDamage = (amount: number, cause: DamageCause, d: Difficulty): number =>
  HOSTILE_CAUSES.includes(cause) ? amount * HOSTILE_DAMAGE_MULT[d] : amount;

/** Seconds the player must wait after a landed hit with this item: WEAPON_HIT_COOLDOWN_S for weapons (mauls), else MOB_HIT_COOLDOWN_S. */
export const strikeCooldownOf = (item: string | null): number =>
  item !== null && itemOrNull(item)?.weapon ? itemOrNull(item)!.weapon!.cooldownS ?? WEAPON_HIT_COOLDOWN_S : MOB_HIT_COOLDOWN_S;

/** Seconds a hit with this item stuns an automaton (the arc maul's 1 s), 0 for everything else. */
export const stunOf = (item: string | null): number => (item !== null ? itemOrNull(item)?.weapon?.stunS ?? 0 : 0);

const article = (name: string): string => (/^[aeiou]/i.test(name) ? 'an' : 'a');

/** Display name of a creature key ("Forge Warden"), the key itself when unknown. */
const nameOf = (species: string): string => creatureOrNull(species)?.name ?? species;

/**
 * The death screen's headline for a death by an automaton: "Felled by a Forge Warden" for a blow ('automaton'),
 * "Burned by a Kiln Sentry's ember" for the burning it left ('ember'). Null for other causes or no known attacker.
 */
export function killerLine(cause: DamageCause | null, species: string | null): string | null {
  if (species === null || (cause !== 'automaton' && cause !== 'ember')) return null;
  const name = nameOf(species);
  return cause === 'ember' ? `Burned by ${article(name)} ${name}'s ember` : `Felled by ${article(name)} ${name}`;
}

export interface CombatSnapshot {
  burnLeftS: number;
  burnPerS: number;
  burnAccS: number;
  /** Species of the last automaton that hurt the player (null = none yet). */
  lastAttacker: string | null;
}

export class PlayerCombat {
  /** The session's difficulty (Settings.difficulty; not saved here - the settings are). Change it with `setDifficulty`. */
  difficulty: Difficulty = 'normal';
  /** Species of the last automaton that hurt the player ('player:attacked'), kept for the death screen. */
  lastAttacker: string | null = null;
  /** Seconds before the player may land another hit on a creature (not saved; counted down per frame by `coolStrike`). */
  strikeCooldownS = 0;
  /** The legendary weapons' running state: marks, lunge cooldown and window (src/game/legendary.ts). Not saved. */
  readonly legendary = new LegendaryState();
  private burnLeftS = 0;
  private burnPerS = 0;
  private burnAccS = 0;
  private readonly off: () => void;

  constructor(private readonly player: PlayerState) {
    // Listening (not only recording in damagePlayer) also catches an attacker announced by whoever emits the event.
    this.off = player.bus.on('player:attacked', (e) => {
      this.lastAttacker = e.species;
    });
  }

  /** Stops listening to the bus (PlayerState.dispose). */
  dispose(): void {
    this.off();
  }

  /** The player is on fire (an ember bolt's burning). */
  get burning(): boolean {
    return this.burnLeftS > EPS;
  }

  /** Seconds of burning left (0 = not burning). */
  get burnTimeLeftS(): number {
    return Math.max(0, this.burnLeftS);
  }

  /** The player may land a hit right now (their own swing cooldown has run out). */
  get strikeReady(): boolean {
    return this.strikeCooldownS <= EPS;
  }

  /** Counts the swing cooldown down (the player controller, every frame - hits are frame-driven, not ticked). */
  coolStrike(dt: number): void {
    if (this.strikeCooldownS > 0 && dt > 0) this.strikeCooldownS = Math.max(0, this.strikeCooldownS - dt);
    this.legendary.tick(dt);
  }

  /** Starts the swing cooldown after a landed hit with `item` (null = bare hands). */
  startStrikeCooldown(item: string | null): void {
    this.strikeCooldownS = strikeCooldownOf(item);
  }

  /**
   * Sets the session's difficulty (from Settings, at start and whenever it changes). Peaceful raises the flag
   * FLAG_PEACEFUL, which completes the objectives that need combat, and puts out any burning.
   */
  setDifficulty(d: Difficulty): void {
    this.difficulty = d;
    if (d !== 'peaceful') return;
    this.extinguish(false);
    this.player.bus.emit('flag', { flag: FLAG_PEACEFUL });
  }

  /**
   * An automaton hurts the player, all in one call. `amount` is the automaton's RAW damage (HostileSpec.damage);
   * `kind` is its species key; (sourceX, sourceZ) where the blow came from (the automaton, or the bolt), `sourceY`
   * its height (default: the player's eye). In order: x the difficulty (Peaceful: nothing happens at all),
   * 'player:attacked' (amount after difficulty, before armour: the HUD's direction pulse), `takeHit` (armour, damage,
   * the attacker remembered, burning) and a knockback away from the source (the species' `knockback`, else
   * KNOCKBACK_DEFAULT). Returns the damage dealt after armour.
   */
  damagePlayer(amount: number, cause: DamageCause, sourceX: number, sourceZ: number, kind: string, sourceY?: number): number {
    const p = this.player;
    if (p.dead || !(amount > 0)) return 0;
    const scaled = difficultyDamage(amount, cause, this.difficulty);
    if (!(scaled > 0)) return 0;
    const hostile = creatureOrNull(kind)?.hostile;
    const attack: HostileAttack = hostile?.attack ?? 'melee';
    const y = sourceY ?? p.position.y + PLAYER_EYE;
    p.bus.emit('player:attacked', { species: kind, attack, amount: scaled, x: sourceX, y, z: sourceZ });
    const dealt = this.takeHit(scaled, cause, sourceX, sourceZ, kind);
    if (!p.dead) this.knockBack(sourceX, sourceZ, hostile?.knockback ?? KNOCKBACK_DEFAULT);
    return dealt;
  }

  /**
   * The second half of `damagePlayer`, for an attacker that has ALREADY applied the difficulty and emitted
   * 'player:attacked' itself (src/mobs' `DamagePlayer` hook - signature-compatible) and pushes the player through
   * `knock`. Armour for ARMOUR_CAUSES (the best piece carried), PlayerState.damage, the attacker remembered for the
   * death screen and, for a species with `burn` (the kiln sentry's bolt), burning. Returns the damage dealt.
   */
  takeHit(amount: number, cause: DamageCause, _sourceX: number, _sourceZ: number, kind: string): number {
    const p = this.player;
    if (p.dead || !(amount > 0) || this.difficulty === 'peaceful') return 0;
    this.lastAttacker = kind;
    const dealt = armouredDamage(amount, cause, bestArmour(p.inventory.slots));
    p.damage(dealt, cause);
    const burn = creatureOrNull(kind)?.hostile?.burn;
    if (burn && cause === 'automaton' && !p.dead) this.ignite(burn.seconds, burn.perS);
    return dealt;
  }

  /** Throws the player: ADDS this velocity (blocks/s) to theirs (src/mobs' `KnockPlayer` hook - signature-compatible). */
  knock(vx: number, vy: number, vz: number): void {
    const v = this.player.velocity;
    if (this.player.dead || !Number.isFinite(vx + vy + vz)) return;
    v.x += vx;
    v.y += vy;
    v.z += vz;
  }

  /**
   * Sets the player burning for `seconds` at `perS` damage per second (cause 'ember'). A new burn REFRESHES the time
   * (never adds to it) and keeps the stronger rate; standing in water refuses it.
   */
  ignite(seconds: number, perS: number): void {
    const p = this.player;
    if (p.dead || !(seconds > 0) || !(perS > 0) || this.difficulty === 'peaceful') return;
    if (p.inWater || p.headInWater) return;
    if (!this.burning) {
      this.burnAccS = 0;
      this.burnPerS = perS;
    } else this.burnPerS = Math.max(this.burnPerS, perS);
    this.burnLeftS = Math.max(this.burnLeftS, seconds);
  }

  /** Puts the fire out (water, respawn). With `hiss`, the steam hiss plays at the player. */
  extinguish(hiss: boolean): void {
    const wasBurning = this.burning;
    this.burnLeftS = this.burnPerS = this.burnAccS = 0;
    if (!hiss || !wasBurning) return;
    const p = this.player.position;
    this.player.bus.emit('sfx', { name: 'steam_hiss', x: p.x, y: p.y + 1, z: p.z });
  }

  /** One 20 Hz tick (Survival calls it): burning damage once a second; water puts the fire out. */
  tick(dt: number): void {
    if (!this.burning || !(dt > 0)) return;
    const p = this.player;
    if (p.inWater || p.headInWater) {
      this.extinguish(true);
      return;
    }
    const step = Math.min(dt, this.burnLeftS);
    this.burnLeftS -= step;
    this.burnAccS += step;
    if (this.burnAccS + EPS >= BURN_INTERVAL_S) {
      this.burnAccS = Math.max(0, this.burnAccS - BURN_INTERVAL_S);
      p.damage(difficultyDamage(this.burnPerS, 'ember', this.difficulty), 'ember');
    }
    if (!this.burning || p.dead) this.extinguish(false);
  }

  /** Forgets the fire and the swing cooldown (respawn). The last attacker stays until the next one. */
  reset(): void {
    this.extinguish(false);
    this.strikeCooldownS = 0;
    this.legendary.reset();
  }

  private knockBack(fromX: number, fromZ: number, speed: number): void {
    if (!(speed > 0)) return;
    const p = this.player;
    let dx = p.position.x - fromX;
    let dz = p.position.z - fromZ;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) {
      // Struck from straight above or inside the player: push back along the way they face.
      dx = Math.sin(p.yaw);
      dz = Math.cos(p.yaw);
    } else {
      dx /= d;
      dz /= d;
    }
    p.velocity.x = dx * speed;
    p.velocity.z = dz * speed;
    if (p.onGround) p.velocity.y = Math.max(p.velocity.y, KNOCKBACK_LIFT);
  }

  toJSON(): CombatSnapshot {
    return { burnLeftS: this.burnLeftS, burnPerS: this.burnPerS, burnAccS: this.burnAccS, lastAttacker: this.lastAttacker };
  }

  /** Restores a snapshot; a missing or damaged one (saves made before combat) means not burning, no attacker. */
  load(s: Partial<CombatSnapshot> | undefined): void {
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
    this.burnLeftS = num(s?.burnLeftS);
    this.burnPerS = num(s?.burnPerS);
    this.burnAccS = Math.min(num(s?.burnAccS), BURN_INTERVAL_S);
    if (this.burnPerS <= 0) this.burnLeftS = 0;
    this.lastAttacker = typeof s?.lastAttacker === 'string' ? s.lastAttacker : null;
    this.strikeCooldownS = 0;
  }
}
