/** Gameplay tunables shared across modules. Content-specific numbers (recipes, machines) live in src/content. */

// --- simulation clock ---
export const TICK_RATE = 20;
/** Seconds per simulation tick. */
export const DT = 1 / TICK_RATE;

// --- day / night ---
/** Length of a full day in real seconds. */
export const DAY_LENGTH_S = 900;
/** Fraction of the day (0..1, 0 = sunrise) at which the sun sets. Night lasts from here to 1. */
export const SUNSET_AT = 0.64;
/** Width of the dawn and dusk transitions, as a fraction of the day. */
export const TWILIGHT = 0.05;

// --- temperature ---
export const AMBIENT_TEMP_C = 20;
/** A furnace at or above this temperature counts as "hot": it glows, lights and warms its surroundings. */
export const FURNACE_HOT_C = 200;
/** A furnace at or above this temperature grants the Well-Warmed buff to players resting near it. */
export const FURNACE_BUFF_C = 400;
/** Degrees C removed from the furnace by every forged item. */
export const FORGE_CHILL_C = 25;
/** Bellows: draft added per pump, and how fast draft decays per second. */
export const DRAFT_PER_PUMP = 0.34;
export const DRAFT_DECAY_PER_S = 0.1;
/** Flame temperature bonus at full draft, degrees C. */
export const DRAFT_FLAME_BONUS_C = 250;
/** Crates within this many blocks of a furnace or workbench lend their contents to its recipes. */
export const STATION_CRATE_RADIUS = 4;

// --- player ---
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE = 1.62;
export const REACH = 5;
export const WALK_SPEED = 4.3;
export const SPRINT_SPEED = 5.8;
export const SWIM_SPEED = 2.6;
export const JUMP_VELOCITY = 8.2;
export const GRAVITY = 26;
export const MAX_HEALTH = 20;
export const MAX_WARMTH = 100;
export const MAX_AIR_S = 15;
export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 36;
export const CRATE_SIZE = 27;

// --- survival ---
/** Warmth lost per second: at night, extra in the Frostfell biome, extra while swimming. */
export const WARMTH_DRAIN_NIGHT = 0.3;
export const WARMTH_DRAIN_FROST_DAY = 0.2;
export const WARMTH_DRAIN_FROST_NIGHT = 0.6;
export const WARMTH_DRAIN_WATER = 0.4;
/** Warmth regained per second inside a heat source's radius, and passively on a mild day. */
export const WARMTH_GAIN_HEAT = 4;
export const WARMTH_GAIN_DAY = 0.5;
/** Seconds between hits of 1 damage while warmth is 0. */
export const COLD_DAMAGE_INTERVAL_S = 3;
/** Seconds near a hot furnace needed to earn Well-Warmed, and how long the buff lasts. */
export const WELL_WARMED_AFTER_S = 8;
export const WELL_WARMED_DURATION_S = 300;
export const WELL_WARMED_MINING_BONUS = 1.25;
/** Blocks fallen before fall damage starts (1 damage per extra block). */
export const SAFE_FALL = 3.5;

// --- power ---
/** Fraction of charging power that ends up stored. */
export const BATTERY_EFFICIENCY = 0.9;
/** Machines stall when their network delivers less than this fraction of what they ask for. */
export const BROWNOUT_STALL = 0.25;

// --- endgame ---
/** Starhearth ignition: watts that must be delivered continuously for this many seconds. */
export const IGNITION_POWER_W = 300_000;
export const IGNITION_SECONDS = 90;
/** Output of an ignited Starhearth. */
export const STARHEARTH_OUTPUT_W = 1_000_000;
