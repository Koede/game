/**
 * Drinking (BREWING_PLAN 5, 11.1) and the carried boiling pail's cooling. Drinking one cup grants its buff
 * (at most one tea buff and one coffee buff; a new one of a family replaces the old), restores what the drink
 * restores, and puts the empty clay cup back in the same slot. The pail helper is pure; Survival ticks it.
 * DOM-free.
 */
import { CUP_ITEM, DRINK_BUFFS } from '../core/brewing';
import { DRINK_COOLDOWN_S, FLAG_SIX_CUPS, MAX_WARMTH } from '../core/constants';
import { DRINKS, itemOrNull } from '../core/registry';
import type { DrinkSpec, Slot } from '../core/types';
import type { BuffName } from '../core/gameEvents';
import { makeStack } from './inventory';
import type { PlayerState } from './playerState';

export type DrinkRefusal = 'dead' | 'not_drink' | 'cooldown';

export type DrinkResult =
  | { ok: true; item: string; buff: BuffName; replaced: BuffName | null }
  /** `message` is what to tell the player (always null today: refusals are quiet, like a bite cooldown). */
  | { ok: false; reason: DrinkRefusal; message: string | null };

/** The drink an item is, or null. */
export const drinkOf = (itemKey: string): DrinkSpec | null => itemOrNull(itemKey)?.drink ?? null;

/** Why drinking `itemKey` would be refused right now, or null when it would be drunk. */
export function drinkRefusal(player: PlayerState, itemKey: string): DrinkRefusal | null {
  if (player.dead) return 'dead';
  if (!drinkOf(itemKey)) return 'not_drink';
  return player.drinkCooldownS > 0 ? 'cooldown' : null;
}

/**
 * Drinks one of the item in `slot` (default: the selected hotbar slot). On success: the drink is consumed and the
 * empty clay cup lands in the same slot, the buff starts or is refreshed, the next sip waits DRINK_COOLDOWN_S, and
 * 'player:drank', 'buff:gained', a toast (naming a replaced buff) and sfx 'sip' are emitted. Refusals change
 * nothing and emit nothing.
 */
export function drink(player: PlayerState, slot = player.selectedSlot): DrinkResult {
  const stack = player.inventory.get(slot);
  const spec = stack ? drinkOf(stack.item) : null;
  const reason = stack && spec ? drinkRefusal(player, stack.item) : player.dead ? 'dead' : 'not_drink';
  if (reason !== null || !stack || !spec) return { ok: false, reason: reason ?? 'not_drink', message: null };
  const item = stack.item;
  const { bus, buffs, position: p } = player;
  if (stack.count > 1) {
    player.inventory.removeAt(slot, 1);
    player.give(CUP_ITEM, 1);
  } else {
    player.inventory.set(slot, makeStack(CUP_ITEM, 1));
  }
  const granted = buffs.grant(spec.buff, spec.buffS);
  if (spec.warmth) player.warmth = Math.min(MAX_WARMTH, player.warmth + spec.warmth);
  if (spec.hunger) player.feed(spec.hunger);
  player.drinkCooldownS = DRINK_COOLDOWN_S;
  const drunk = (player.stats.drunk ??= {});
  const firstOfKind = !drunk[item];
  drunk[item] = (drunk[item] ?? 0) + 1;
  bus.emit('player:drank', { item });
  if (firstOfKind && DRINKS.every((d) => drunk[d.key])) bus.emit('flag', { flag: FLAG_SIX_CUPS });
  bus.emit('buff:gained', { buff: spec.buff, durationS: spec.buffS });
  bus.emit('sfx', { name: 'sip', x: p.x, y: p.y + 1.5, z: p.z });
  const name = DRINK_BUFFS[spec.buff].name;
  const text = granted.replaced ? `${name} replaces ${DRINK_BUFFS[granted.replaced].name}` : `${name}: ${DRINK_BUFFS[spec.buff].effect}`;
  bus.emit('toast', { text, kind: 'good', item });
  return { ok: true, item, buff: spec.buff, replaced: granted.replaced };
}

/**
 * Cools a stack that goes back to another item after a while carried (a boiling pail, `ItemSpec.cools`): the
 * stack's `durability` holds the seconds left (a fresh stack with none starts at `afterS`). Returns the stack
 * to put in its place when it has cooled, the same stack when it only ticked, or null for a stack that does not
 * cool. Pure apart from writing the new durability.
 */
export function coolStack(stack: NonNullable<Slot>, dt: number): NonNullable<Slot> | null {
  const cools = itemOrNull(stack.item)?.cools;
  if (!cools) return null;
  const left = (stack.durability ?? cools.afterS) - dt;
  if (left > 0) {
    stack.durability = left;
    return stack;
  }
  return makeStack(cools.to, stack.count);
}

/**
 * Cools every carried boiling container by `dt` seconds. Returns true when one turned back (a toast is emitted
 * for it); the inventory is told whenever a heat bar changed.
 */
export function coolCarried(player: PlayerState, dt: number): boolean {
  if (!(dt > 0)) return false;
  const inv = player.inventory;
  let barMoved = false;
  let cooled = false;
  for (let i = 0; i < inv.size; i++) {
    const stack = inv.get(i);
    if (!stack) continue;
    const before = stack.durability;
    const next = coolStack(stack, dt);
    if (next === null) continue;
    if (next === stack) {
      // The heat bar redraws about once a second, not every tick.
      barMoved ||= before === undefined || Math.floor(before) !== Math.floor(stack.durability ?? 0);
      continue;
    }
    inv.set(i, next);
    cooled = true;
    const from = itemOrNull(stack.item)?.name ?? stack.item;
    const to = itemOrNull(next.item)?.name ?? next.item;
    player.bus.emit('toast', { text: `The ${from} cooled: it is a ${to} again`, kind: 'info', item: next.item });
  }
  if (barMoved && !cooled) inv.notifyChanged();
  return cooled;
}
