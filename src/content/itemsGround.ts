/**
 * Items of the ground-item mechanic (docs/api/ground-items.md): the Hand Vacuum Pump, a Bronze Age handheld that
 * pulls ground items to the player. The pull itself is a definition in src/game/collectors.ts (`COLLECTORS`).
 *
 * Gate: the code still has five furnace tiers and five ages (BRONZE_PLAN W0, the six-age renumbering, has not run), so
 * the Bronze Furnace does not exist yet. The pump is made at the Clay Furnace (tier 1, 800 C, the Ember Age's top)
 * from bronze plate, leather and a bellows - all Ember crafts - and is documented as Bronze. When W0 lands, move its
 * recipe to `forge(2, ...)` at the Bronze Furnace (age 1) and give it that `age` here.
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
