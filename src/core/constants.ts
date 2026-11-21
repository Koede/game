/** Gameplay tunables shared across modules. Content-specific numbers (recipes, machines) live in src/content. */
import type { BiomeKey, Precipitation, WeatherKind } from './types';

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
/**
 * Above MOB_STORED_SOFT_CAP stored animals, frozen wild adults at least MOB_DESPAWN_DISTANCE blocks from the
 * player are retired, farthest first, down to MOB_DESPAWN_TARGET (their columns may roll again later).
 */
export const MOB_STORED_SOFT_CAP = 250;
export const MOB_DESPAWN_TARGET = 220;
export const MOB_DESPAWN_DISTANCE = 128;
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

// --- weather and the moon (spec 15; lookups in src/core/weather.ts) ---
/** A weather state lasts this long (uniformly between the two), then the next one is drawn. */
export const WEATHER_MIN_S = 240;
export const WEATHER_MAX_S = 720;
/** A change from one state to the next eases over this long (uniformly between the two). */
export const WEATHER_BLEND_MIN_S = 30;
export const WEATHER_BLEND_MAX_S = 60;
/** Chance of each state at every draw (sums to 1). Drawing the state already current simply extends it. */
export const WEATHER_CHANCE: Readonly<Record<WeatherKind, number>> = { clear: 0.45, cloudy: 0.25, rain: 0.2, storm: 0.1 };
/** Cloud cover 0..1 of each settled state (sky, cloud layer, sun disc dimming). */
export const WEATHER_CLOUD_COVER: Readonly<Record<WeatherKind, number>> = { clear: 0.15, cloudy: 0.7, rain: 0.9, storm: 1 };
/**
 * Brightness multiplier on the daytime sky and sunlit terrain of each settled state. Render only: the clock's
 * sunlight factor, which crops and the HUD read, is never changed by the weather.
 */
export const WEATHER_DAYLIGHT: Readonly<Record<WeatherKind, number>> = { clear: 1, cloudy: 0.82, rain: 0.68, storm: 0.52 };
/** Strength 0..1 of whatever falls (rain, snow or dust) in each settled state. */
export const WEATHER_INTENSITY: Readonly<Record<WeatherKind, number>> = { clear: 0, cloudy: 0, rain: 0.6, storm: 1 };
/** Solar panel output multiplier of each state (whatever falls: rain, snow or dust all block the sun). */
export const WEATHER_SOLAR: Readonly<Record<WeatherKind, number>> = { clear: 1, cloudy: 0.5, rain: 0.2, storm: 0.2 };
/** Wind turbine output multiplier of each state (may lift a turbine past its rated output). */
export const WEATHER_WIND: Readonly<Record<WeatherKind, number>> = { clear: 1, cloudy: 1, rain: 1, storm: 1.5 };
/** What falls in each biome when it rains: snow in the frostfell, a dry dust wind in the dunes. */
export const BIOME_PRECIPITATION: Readonly<Record<BiomeKey, Precipitation>> = {
  woodland: 'rain', dunes: 'dust', frostfell: 'snow', scar: 'rain', marsh: 'rain',
};
/** At or above this height rain falls as snow in every biome except the dunes (high altitude). */
export const SNOW_LINE_Y = 72;
/** Rain or snow weaker than this is a drizzle: it does not chill the player or a furnace, nor water crops. */
export const WET_MIN_INTENSITY = 0.25;
/** Warmth lost per second while rain or snow falls on the player under open sky (on top of every other drain). */
export const WARMTH_DRAIN_WET = 0.3;
/** Heat-loss multiplier of a furnace with open sky above it while rain or snow falls there. */
export const FURNACE_WET_LOSS_MULT = 1.5;
/** Storms only: seconds between lightning flashes (uniform), and how far away they strike, in blocks. */
export const LIGHTNING_MIN_S = 6;
export const LIGHTNING_MAX_S = 22;
export const LIGHTNING_MIN_DIST = 60;
export const LIGHTNING_MAX_DIST = 900;
/** Thunder follows a flash after distance / SOUND_SPEED seconds (blocks are metres). */
export const SOUND_SPEED = 343;
/** The moon runs through this many phases, one per day: 0 = new, 4 = full. */
export const MOON_PHASES = 8;
/** Phase of the moon on the first night of a new world (a full moon: the first night is the hardest). */
export const MOON_FIRST_PHASE = 4;
/** Night-time sunlight factor at new moon and at full moon (spec 3.5's ~0.08 is the average). */
export const NIGHT_LIGHT_NEW_MOON = 0.04;
export const NIGHT_LIGHT_FULL_MOON = 0.12;
/** The star field turns about the pole this many times a day. */
export const STAR_TURNS_PER_DAY = 1;

// --- the Old Works ruins (spec 14; loot tables in src/content/loot.ts) ---
/** One ruin site per square of this many chunks a side (at most; rolled per square from the seed). */
export const RUIN_GRID_CHUNKS = 7;
/** Chance that a square of the grid holds a ruin at all. */
export const RUIN_CHANCE = 0.8;
/** One ruin is always placed with its crate within this many blocks of world spawn. */
export const RUIN_SPAWN_RADIUS = 96;
/** A ruin farther than this from spawn, or with its crate this far below sea level or deeper, rolls the 'deep' table. */
export const RUIN_DEEP_DISTANCE = 400;
export const RUIN_DEEP_BELOW_SEA = 8;

// --- item and fluid transport (spec 16; pipe numbers live on the pipe blocks, BlockSpec.pipe) ---
/** Litres in one bucket: a bucket used on a tank or fluid endpoint fills or empties this much. */
export const LITRES_PER_BUCKET = 1000;
/** A pipe's core and arms span this part of the cell on both cross axes (the texture's rows/columns 4..11). */
export const PIPE_CORE_MIN = 4 / 16;
export const PIPE_CORE_MAX = 12 / 16;
/** Caps of one pipe network: pipes beyond it are inert ("Network too long"), likewise ports. */
export const PIPE_MAX_PIPES = 1024;
export const PIPE_MAX_PORTS = 64;
/** Item packets in flight per network; 'pull' ports pause while the network is at the cap. */
export const PIPE_MAX_PACKETS = 48;
/** A port's filter holds up to this many item or fluid keys. */
export const PIPE_FILTER_SLOTS = 5;
/** Port priority range: higher priorities are served first. */
export const PIPE_PRIORITY_MIN = -2;
export const PIPE_PRIORITY_MAX = 2;

// --- multiblock hearths (spec 17; per-tier rules live on FurnaceTierSpec.structure, lookups in src/core/hearth.ts) ---
/** Blocks that may stand in a face cell (never an edge) of a hearth's shell instead of wall. */
export const HEARTH_FACE_PARTS: readonly string[] = ['glass', 'item_hatch', 'fluid_hatch', 'power_port', 'blower'];
/** Blocks that may stand in a face cell of a hearth's ceiling (tiers whose structure asks for electrodes). */
export const HEARTH_CEILING_PARTS: readonly string[] = ['electrode'];
/** Shell cells of the smallest closed hearth (1x1x1 interior): heat loss scales with shell area / this. */
export const HEARTH_SHELL_AREA_REF = 26;
/** A window (glass face) or an open-top cell counts this many times in the shell area. */
export const HEARTH_OPENING_AREA = 2;
/** Smelting speed: x (1 + HEARTH_SPEED_PER_CELL * (interior volume - 1)), at most HEARTH_SPEED_MAX. */
export const HEARTH_SPEED_PER_CELL = 0.1;
export const HEARTH_SPEED_MAX = 2;
/** Each blower in a face is a tuyere: + this much smelting speed, counting at most HEARTH_MAX_TUYERES of them. */
export const HEARTH_TUYERE_BONUS = 0.25;
export const HEARTH_MAX_TUYERES = 4;
/** A validation reports at most this many problems. */
export const HEARTH_MAX_PROBLEMS = 8;
/** An unformed controller rescans every this many seconds, only while the player is within the range or its screen is open. */
export const HEARTH_RESCAN_S = 1;
export const HEARTH_RESCAN_RANGE = 16;
/** A formed hearth re-checks one shell cell every this many ticks (the safety net behind block-change rescans). */
export const HEARTH_VERIFY_TICKS = 4;
/** Seconds a tapped structure problem stays highlighted in the world. */
export const HEARTH_HIGHLIGHT_S = 10;
