/**
 * Warm things held in the hand (docs/SYNERGY_TOOLS.md): a lit torch or a vessel of boiling water warms the player as if
 * standing at a small fire, so a hunter caught out at night has a plan that is not "dig in". DOM-free.
 */
import type { Slot } from '../core/types';

/** Items that warm whoever holds them (the selected hotbar slot). */
export const HELD_WARM_ITEMS: ReadonlySet<string> = new Set(['torch', 'boiling_pail', 'boiling_beaker', 'boiling_vial']);

export const heldWarms = (held: Slot): boolean => held !== null && HELD_WARM_ITEMS.has(held.item);
