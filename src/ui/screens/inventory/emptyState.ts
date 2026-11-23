/** Words and checks for "nothing here yet" states: say what is missing and what to do about it. DOM-free. */

/** True when no slot in start..start+count holds anything. */
export function rangeIsEmpty(slots: readonly (unknown | null | undefined)[], start: number, count: number): boolean {
  for (let i = start; i < Math.min(slots.length, start + count); i++) if (slots[i]) return false;
  return true;
}

export const EMPTY_BACKPACK = 'Your backpack is empty. Mine, gather and craft: whatever you pick up lands here.';
