/**
 * Hunger (spec 12.1): the food bar drains with time and effort, an empty bar slowly hurts (never fatally), eating
 * refills it, and the Well-Fed buff from forged meals halves the drain. Health regeneration is gated and paid for
 * here too; Survival owns a Hunger and asks it before healing. DOM-free.
 */
import {
  EAT_COOLDOWN_S,
  FOOD_COST_PER_BLOCK_MINED,
  FOOD_COST_PER_JUMP,
  FOOD_DRAIN_PER_S,
  FOOD_DRAIN_SPRINT_MULT,
  MAX_FOOD,
  REGEN_FOOD_COST,
  REGEN_MIN_FOOD,
  STARVE_INTERVAL_S,
  WELL_FED_DRAIN_MULT,
  WELL_FED_REGEN_MULT,
} from '../core/constants';
import type { BuffName } from '../core/gameEvents';
import { itemOrNull } from '../core/registry';
import type { FoodSpec } from '../core/types';
import type { PlayerState } from './playerState';

/**
 * A bar this close to MAX_FOOD counts as full and refuses plain food: a HUD that shows whole points reads 19.6 as
 * full, so the refusal agrees with what the player sees.
 */
export const FULL_MARGIN = 0.5;

export interface HungerSnapshot {
  starveS: number;
}

export type EatRefusal = 'dead' | 'not_food' | 'cooldown' | 'full';

export type EatResult =
  | { ok: true; item: string; hunger: number; buff: BuffName | null }
  /** `message` is what to tell the player (null: refuse quietly, e.g. between two bites). */
  | { ok: false; reason: EatRefusal; message: string | null };

/** The food an item is, or null. */
export const foodOf = (itemKey: string): FoodSpec | null => itemOrNull(itemKey)?.food ?? null;

/** Factor on every food cost: Well-Fed halves them, and so does the Lasting drink (they multiply). */
export const drainFactor = (player: PlayerState): number =>
  (player.wellFed ? WELL_FED_DRAIN_MULT : 1) * player.buffs.foodDrainMult;

/** Food lost per second right now from time alone (sprinting and Well-Fed included). */
export const foodDrainPerS = (player: PlayerState): number =>
  FOOD_DRAIN_PER_S * (player.sprinting ? FOOD_DRAIN_SPRINT_MULT : 1) * drainFactor(player);

/** The food a jump costs. The player controller calls this for every jump off the ground. */
export function exertJump(player: PlayerState): void {
  player.spendFood(FOOD_COST_PER_JUMP * drainFactor(player));
}

/** The food breaking one block costs. The player's mining calls this for every block it breaks. */
export function exertMining(player: PlayerState): void {
  player.spendFood(FOOD_COST_PER_BLOCK_MINED * drainFactor(player));
}

/** The bar counts as full (plain food is refused). */
export const isFull = (player: PlayerState): boolean => player.food >= MAX_FOOD - FULL_MARGIN;

/** Why eating `itemKey` would be refused right now, or null when it would be eaten. */
export function eatRefusal(player: PlayerState, itemKey: string): EatRefusal | null {
  if (player.dead) return 'dead';
  const food = foodOf(itemKey);
  if (!food) return 'not_food';
  if (player.eatCooldownS > 0) return 'cooldown';
  if (!food.buff && isFull(player)) return 'full';
  return null;
}

const REFUSAL_TEXT: Record<EatRefusal, string | null> = {
  dead: null,
  not_food: null,
  cooldown: null,
  full: 'You are full',
};

/**
 * Eats one of the food in `slot` (default: the selected hotbar slot). On success: the item is consumed, food is
 * restored, a buff starts (or is refreshed), the next bite waits EAT_COOLDOWN_S, and 'player:ate', flag 'ate',
 * 'buff:gained' (buff foods) and sfx 'eat' are emitted. Refusals change nothing and emit nothing.
 */
export function eat(player: PlayerState, slot = player.selectedSlot): EatResult {
  const stack = player.inventory.get(slot);
  const food = stack ? foodOf(stack.item) : null;
  const reason = player.dead ? 'dead' : stack && food ? eatRefusal(player, stack.item) : 'not_food';
  if (reason !== null || !stack || !food) {
    const why = reason ?? 'not_food';
    return { ok: false, reason: why, message: REFUSAL_TEXT[why] };
  }
  const item = stack.item;
  player.inventory.removeAt(slot, 1);
  player.feed(food.hunger);
  player.eatCooldownS = EAT_COOLDOWN_S;
  const { bus, position: p } = player;
  bus.emit('player:ate', { item, hunger: food.hunger });
  bus.emit('flag', { flag: 'ate' });
  bus.emit('sfx', { name: 'eat', x: p.x, y: p.y + 1.5, z: p.z });
  let buff: BuffName | null = null;
  if (food.buff === 'well_fed' && food.buffS && food.buffS > 0) {
    buff = 'well_fed';
    player.buffs.wellFedS = Math.max(player.buffs.wellFedS, food.buffS);
    bus.emit('buff:gained', { buff, durationS: food.buffS });
    bus.emit('toast', { text: 'Well-Fed: you heal twice as fast and get hungry half as quickly', kind: 'good', item });
  }
  return { ok: true, item, hunger: food.hunger, buff };
}

/**
 * The per-tick hunger rules for one player: drain, the bite cooldown, the Well-Fed timer, starvation, and the
 * regeneration gate. Survival creates one and ticks it; nothing else needs to.
 */
export class Hunger {
  private starveS = 0;
  private rate = 0;

  constructor(private readonly player: PlayerState) {}

  /** Food change per second as of the last tick (negative while draining). */
  get foodRate(): number {
    return this.rate;
  }

  /** The bar is empty: 1 damage every STARVE_INTERVAL_S, never below 1 health. */
  get starving(): boolean {
    return this.player.food <= 0;
  }

  /** Seconds of Well-Fed left (0 = not active). */
  get wellFedTimeLeftS(): number {
    return this.player.buffs.wellFedS;
  }

  tick(dt: number): void {
    const player = this.player;
    if (player.dead || !(dt > 0)) return;
    player.eatCooldownS = Math.max(0, player.eatCooldownS - dt);
    const drain = foodDrainPerS(player);
    player.drinkCooldownS = Math.max(0, player.drinkCooldownS - dt);
    // The buffs run out after this tick's drain was priced, so their last tick still counts.
    player.buffs.tick(dt);
    this.rate = player.food > 0 ? -drain : 0;
    player.spendFood(drain * dt);
    if (player.food > 0) {
      this.starveS = 0;
      return;
    }
    this.starveS += dt;
    if (this.starveS >= STARVE_INTERVAL_S) {
      this.starveS -= STARVE_INTERVAL_S;
      // Hunger alone never kills: it stops at the last health point.
      if (player.health > 1) player.damage(1, 'hunger');
    }
  }

  /** Health may regenerate only with this much food (spec 12.1). */
  canRegenerate(): boolean {
    return this.player.food >= REGEN_MIN_FOOD;
  }

  /** Seconds per regenerated health point, given the base interval (Well-Fed and Mending each heal twice as fast). */
  regenInterval(baseS: number): number {
    return (this.player.wellFed ? baseS / WELL_FED_REGEN_MULT : baseS) / this.player.buffs.regenMult;
  }

  /** Charges the food one regenerated health point costs. */
  payForRegen(): void {
    this.player.spendFood(REGEN_FOOD_COST);
  }

  /** Forgets the starvation timer (respawn). */
  reset(): void {
    this.starveS = 0;
    this.rate = 0;
  }

  toJSON(): HungerSnapshot {
    return { starveS: this.starveS };
  }

  load(s: Partial<HungerSnapshot> | undefined): void {
    const t = s?.starveS;
    this.starveS = typeof t === 'number' && Number.isFinite(t) ? Math.max(0, t) : 0;
  }
}
