/**
 * Disasters with counterplay (docs/api/disasters.md): every number the three hazards run on. Each hazard has a
 * condition that PREVENTS it, and every one is telegraphed well before it lands so a phone player can react:
 *
 *   boiler overpressure  prevented by a safety valve beside the boiler (steam is vented), or by using the steam /
 *                        letting the fire die so the steam room is never left full under heat
 *   chimney fire         prevented by a proper flue (a Brick Chimney stack standing on the furnace), by burning hot
 *                        and clean (coal, charcoal, coke) and by sweeping the stack with a stick
 *   storm on wiring      prevented by covering the cable (anything solid overhead) or by a lightning rod: a mast of
 *                        metal plate blocks that stands above the wire
 *
 * Difficulty (Settings.difficulty, the world's hard-mode flag): peaceful has none of it, normal is mild (long
 * warnings, nothing blown up, little damage), hard is harsh (short warnings, blasts, fire spreading to woodwork).
 * Pure data: the rules are in src/game/disasters.ts.
 */
import type { Difficulty } from '../core/context';

export interface DisasterTuning {
  /** Master switch for the difficulty. */
  on: boolean;
  boiler: {
    /** Steam room fill (0..1) at and above which an under-heat boiler builds pressure. */
    riseFill: number;
    /** Seconds of left-alone full steam under heat from calm to burst (pressure 0 -> 1). */
    riseS: number;
    /** Seconds for pressure to fall from 1 to 0 once the steam is used or the fire is down. */
    fallS: number;
    /** Pressure at which a safety valve starts venting (and holds the boiler at). */
    ventAt: number;
    /** Litres of steam a valve vents each second while open. */
    ventLPerS: number;
    /** Blast radius of a burst; 0 = the boiler alone is wrecked. */
    blastRadius: number;
    /** Damage to a player within `hurtDist` blocks when a burst is not a blast. */
    hurtDamage: number;
    hurtDist: number;
  };
  chimney: {
    /** Soot per second at fuel smoke 1 and flue factor 1 (1 = a fire). */
    sootPerS: number;
    /** Soot lost per second once the furnace runs hot enough to burn the flue clean. */
    burnOffPerS: number;
    /** Furnace temperature that burns soot off instead of laying it down. */
    burnOffC: number;
    /** A fire needs the furnace at least this hot. */
    fireMinC: number;
    /** Soot left after a fire (the flue is half-cleaned by it). */
    afterFire: number;
    /** Flammable blocks around the furnace the fire eats (hard only). */
    spreadBlocks: number;
    /** Burn damage to a player within 3 blocks. */
    hurt: number;
  };
  storm: {
    /** Seconds between strikes at the wiring while a storm rages (uniform in [min, max]). */
    minS: number;
    maxS: number;
    /** Seconds between the warning (static, crackle) and the strike: the time to cover the wire or fetch a rod. */
    warnS: number;
    /** Cable blocks a strike burns out. */
    cablesBlown: number;
    /** Damage to a player within 3 blocks of a strike. */
    hurt: number;
  };
}

const OFF: DisasterTuning = {
  on: false,
  boiler: { riseFill: 2, riseS: 1, fallS: 1, ventAt: 1, ventLPerS: 0, blastRadius: 0, hurtDamage: 0, hurtDist: 0 },
  chimney: { sootPerS: 0, burnOffPerS: 0, burnOffC: 0, fireMinC: 0, afterFire: 0, spreadBlocks: 0, hurt: 0 },
  storm: { minS: 1e9, maxS: 1e9, warnS: 1, cablesBlown: 0, hurt: 0 },
};

export const DISASTER_TUNING: Readonly<Record<Difficulty, DisasterTuning>> = {
  peaceful: OFF,
  normal: {
    on: true,
    boiler: { riseFill: 0.9, riseS: 120, fallS: 20, ventAt: 0.6, ventLPerS: 200, blastRadius: 0, hurtDamage: 3, hurtDist: 3 },
    chimney: { sootPerS: 1 / 600, burnOffPerS: 1 / 240, burnOffC: 750, fireMinC: 350, afterFire: 0.4, spreadBlocks: 0, hurt: 0 },
    storm: { minS: 90, maxS: 180, warnS: 8, cablesBlown: 1, hurt: 0 },
  },
  hard: {
    on: true,
    boiler: { riseFill: 0.8, riseS: 45, fallS: 30, ventAt: 0.6, ventLPerS: 200, blastRadius: 2, hurtDamage: 8, hurtDist: 4 },
    chimney: { sootPerS: 1 / 240, burnOffPerS: 1 / 300, burnOffC: 850, fireMinC: 300, afterFire: 0.5, spreadBlocks: 4, hurt: 6 },
    storm: { minS: 35, maxS: 80, warnS: 4, cablesBlown: 4, hurt: 6 },
  },
};

/** Pressure / soot levels at which the player is told: 'watch' is a heads-up, 'warning' is act now. */
export const WARN_WATCH = 0.45;
export const WARN_ALARM = 0.8;

/** Furnace soot multiplier by flue: a Brick Chimney stack, a clear column, a ceiling in the way. */
export const FLUE_FACTOR = { chimney: 0.2, open: 0.6, blocked: 2 } as const;
/** Clear blocks needed straight above a furnace (or its stack) for the flue to count as open. */
export const FLUE_CLEAR_BLOCKS = 3;
/** Reach (blocks) from a Brick Chimney's top that a sweep gets down to the furnace. */
export const CHIMNEY_MAX_STACK = 8;
/** How far from the player (blocks) disasters are simulated and strikes are aimed. */
export const DISASTER_RADIUS = 48;
/** A cable is covered by a lightning rod this close (blocks, horizontally) when the rod's top stands above the cable. */
export const ROD_RANGE = 8;
/** A rod is this many metal plate blocks tall at least. */
export const ROD_MIN_HEIGHT = 2;
/** Blocks a rod is built of (bronze plate, riveted plate), and the key of the safety valve the steam loop adds. */
export const ROD_BLOCKS: readonly string[] = ['bronze_plate_block', 'rivet_plate_block'];
export const SAFETY_VALVE_BLOCK = 'safety_valve';
/** The valve vents a boiler it stands within this many blocks of. */
export const VALVE_REACH = 2;
/** Woodwork a chimney fire can eat. */
export const FLAMMABLE_BLOCKS: readonly string[] = ['plank', 'oak_log', 'pine_log', 'fence', 'wooden_door', 'stripped_oak_log', 'stripped_pine_log'];
