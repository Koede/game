/** Words and checks for "nothing here yet" states: say what is missing and what to do about it. DOM-free. */

/** True when no slot in start..start+count holds anything. */
export function rangeIsEmpty(slots: readonly (unknown | null | undefined)[], start: number, count: number): boolean {
  for (let i = start; i < Math.min(slots.length, start + count); i++) if (slots[i]) return false;
  return true;
}

/** Whole inventory empty (hotbar too). */
export const EMPTY_BACKPACK = 'Your backpack is empty. Mine, gather and craft: whatever you pick up lands here.';
/** Backpack empty but the hotbar holds things (a fresh pack: picked-up items fill the hotbar first). */
export const EMPTY_BACKPACK_HOTBAR = 'Nothing in the backpack yet: what you pick up fills the hotbar first, then lands here.';
