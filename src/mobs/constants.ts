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
