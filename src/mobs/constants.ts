/** Tunables of src/mobs that are not in the spec (the spec's numbers are MOB_* in src/core/constants.ts). */

/** Seconds a corpse stays, fading, after the MOB_DEATH_S tip-over, before it is removed. */
export const CORPSE_FADE_S = 0.5;
/** Length of the red hurt flash, seconds. */
export const FLASH_S = 0.3;
/** Idle calls are only voiced within this many blocks of the player (audio cannot hear further anyway). */
export const CALL_RANGE = 32;
/** Animals below this y (fell out of the world) are removed. */
export const VOID_Y = -8;
/** Knockback of a hit: horizontal and vertical speed, m/s. */
export const KNOCK_H = 5;
export const KNOCK_V = 4.5;
/** Natural healing: +1 health every HEAL_EVERY_S once an animal has not been hurt for HEAL_DELAY_S. */
export const HEAL_DELAY_S = 10;
export const HEAL_EVERY_S = 30;
/** Crowding: bodies closer than CROWD_GAP x their summed half widths push apart at up to CROWD_PUSH m/s. */
export const CROWD_GAP = 1.1;
export const CROWD_PUSH = 1.5;
/** A birth beyond MOB_LOADED_CAP retires the farthest wild adult at least this far from the player (blocks). */
export const RETIRE_MIN_DISTANCE = 40;
/** How often (seconds) the manager checks the stored count against MOB_STORED_SOFT_CAP. */
export const DESPAWN_CHECK_S = 5;
