/**
 * Items of the ground-item mechanic (docs/api/ground-items.md): the Hand Vacuum Pump, a Bronze Age handheld that
 * pulls ground items to the player. The pull itself is a definition in src/game/collectors.ts (`COLLECTORS`).
 *
 * Gate (BRONZE_PLAN W0 done): a Bronze Age item (age 1), forged at the Bronze Furnace (`forge(2, 'hand_vacuum', ...)`,
 * furnace tier 2) from bronze plate, leather and a bellows.
 */
import type { ItemSpec } from '../core/types';

/** Seconds of suction a fresh pump has (it is the stack's durability); a long hold costs about a minute of it. */
export const VACUUM_WEAR_S = 480;

export const GROUND_ITEMS: ItemSpec[] = [
  {
    key: 'hand_vacuum', name: 'Hand Vacuum Pump', category: 'tool', age: 1, stack: 1, wear: VACUUM_WEAR_S,
    desc: 'A bronze pump with a leather bellows. Hold it and press Use: loose items within nine blocks stream in to you. The leather wears with every second of suction.',
  },
];
