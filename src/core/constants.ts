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

// --- hunger (spec 12.1) ---
export const MAX_FOOD = 20;
/** Food lost per second at rest (a full bar lasts 20 minutes), the sprint multiplier, and the cost of effort. */
export const FOOD_DRAIN_PER_S = 1 / 60;
export const FOOD_DRAIN_SPRINT_MULT = 2.5;
export const FOOD_COST_PER_BLOCK_MINED = 0.03;
export const FOOD_COST_PER_JUMP = 0.03;
/** At or below this the player is Hungry: no sprinting, one warning toast when crossing it. */
export const HUNGRY_AT = 6;
/** Seconds between hits of 1 damage while the food bar is empty (never below 1 health from hunger alone). */
export const STARVE_INTERVAL_S = 6;
/** Health only regenerates at or above this much food, and each point regenerated costs this much food. */
export const REGEN_MIN_FOOD = 12;
export const REGEN_FOOD_COST = 0.25;
/** Seconds between two bites. */
export const EAT_COOLDOWN_S = 0.6;
/** Well-Fed (from forged meals): duration, health regeneration speed-up, and the factor on all food drain. */
export const WELL_FED_DURATION_S = 360;
export const WELL_FED_REGEN_MULT = 2;
export const WELL_FED_DRAIN_MULT = 0.5;

// --- animals (spec 12.5) ---
/** Hard caps: animals simulated (loaded) at once, and animals kept in the save. */
export const MOB_LOADED_CAP = 40;
export const MOB_STORED_CAP = 300;
/** Chance that a chunk column rolls a group the first time it loads. */
export const MOB_CHUNK_SPAWN_CHANCE = 0.15;
/** Wandering: farthest target in blocks, deepest drop it will step down, and the flee burst. */
export const MOB_WANDER_RADIUS = 8;
export const MOB_MAX_DROP = 2;
export const MOB_FLEE_SPEED_MULT = 1.6;
export const MOB_FLEE_S = 5;
/** Following a player who holds a liked item: notice range and how close it comes. */
export const MOB_FOLLOW_RANGE = 10;
export const MOB_FOLLOW_DISTANCE = 2;
/** Breeding: how long a fed animal stays eager, partner search radius, time to a baby, cooldown afterwards. */
export const MOB_EAGER_S = 30;
export const MOB_BREED_RADIUS = 8;
export const MOB_BREED_S = 3;
export const MOB_BREED_COOLDOWN_S = 300;
/** Babies are this fraction of adult size and grow up after this many seconds. */
export const MOB_BABY_SCALE = 0.5;
export const MOB_GROW_UP_S = 300;
/** Keep-alive spawning near the player: minimum adults within the radius, daytime seconds below it, min distance. */
export const MOB_KEEPALIVE_MIN_ADULTS = 6;
export const MOB_KEEPALIVE_RADIUS = 64;
export const MOB_KEEPALIVE_AFTER_S = 120;
export const MOB_KEEPALIVE_MIN_DISTANCE = 24;
/** The chunks around world spawn guarantee groups within this many blocks. */
export const MOB_SPAWN_GUARANTEE_RADIUS = 40;
/** Hitting animals: seconds between hits, tip-over time before the drops, and idle call interval range. */
export const MOB_HIT_COOLDOWN_S = 0.4;
export const MOB_DEATH_S = 0.6;
export const MOB_CALL_MIN_S = 8;
export const MOB_CALL_MAX_S = 20;
