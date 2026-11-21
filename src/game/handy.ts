/**
 * Freshly made tools, food and placeable machines belong in the hand: the objectives say "hold the food" or
 * "stand the lamp against the thermopile", and a phone player was never taught to dig them out of the pack.
 * After the player crafts one, `bringToHotbar` moves it from the pack onto the hotbar. DOM-free.
 */
import { HOTBAR_SIZE } from '../core/constants';
import { blockOfItem, itemOrNull } from '../core/registry';
import type { PlayerState } from './playerState';

const BUCKET_KEY = /(^|_)(pail|bucket)$/;

/** Items the player uses from the hand: tools, food, machines and stations, buckets, torches. */
export function isHandy(itemKey: string): boolean {
  const def = itemOrNull(itemKey);
  if (!def) return false;
  if (def.tool || def.food) return true;
  if (def.category === 'tool' || def.category === 'machine' || def.category === 'food') return true;
  // Buckets and pails are used from the hand; worn gear (the coat, the suit) works from anywhere in the pack.
  if (BUCKET_KEY.test(def.key)) return true;
  return blockOfItem(itemKey)?.shape === 'torch';
}

export type HotbarOutcome =
  /** Already on the hotbar (or not a handy item, or nowhere at all): nothing moved. */
  | 'unchanged'
  /** Moved from the pack into an empty hotbar slot. */
  | 'moved'
  /** Swapped with a plain stack on the hotbar, which went to the pack; that slot is now selected. */
  | 'swapped'
  /** Every hotbar slot holds something handy: it stays in the pack and a toast says so. */
  | 'pack';

/**
 * Puts a stack of `itemKey` on the hotbar when there is none there: into the first empty hotbar slot, else in
 * place of a plain stack (the selected slot first) which goes to the pack and the slot is selected. When every
 * hotbar slot holds a handy item, a toast says where the new one is.
 */
export function bringToHotbar(player: PlayerState, itemKey: string): HotbarOutcome {
  if (!isHandy(itemKey)) return 'unchanged';
  const inv = player.inventory;
  let from = -1;
  for (let i = 0; i < inv.size; i++) {
    const s = inv.get(i);
    if (!s || s.item !== itemKey) continue;
    if (i < HOTBAR_SIZE) return 'unchanged';
    if (from < 0) from = i;
  }
  if (from < 0) return 'unchanged';
  let to = -1;
  for (let i = 0; i < HOTBAR_SIZE && to < 0; i++) if (!inv.get(i)) to = i;
  if (to >= 0) {
    inv.batch(() => {
      inv.set(to, inv.get(from));
      inv.set(from, null);
    });
    return 'moved';
  }
  const plain = (i: number): boolean => {
    const s = inv.get(i);
    return s !== null && !isHandy(s.item);
  };
  to = plain(player.selectedSlot) ? player.selectedSlot : -1;
  for (let i = 0; i < HOTBAR_SIZE && to < 0; i++) if (plain(i)) to = i;
  if (to < 0) {
    const name = itemOrNull(itemKey)?.name ?? itemKey;
    player.bus.emit('toast', { text: `${name} is in your pack - open it to put it on the hotbar`, kind: 'info', item: itemKey });
    return 'pack';
  }
  inv.batch(() => {
    const out = inv.get(to);
    inv.set(to, inv.get(from));
    inv.set(from, out);
  });
  player.selectSlot(to);
  return 'swapped';
}
