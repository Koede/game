/**
 * Every event that travels over the game's EventBus. Modules that do not import each other
 * (rendering, audio, UI, controls, simulation) coordinate exclusively through these.
 *
 * Adding an event: append it here (never rename or remove one that another module may use).
 */
import type { BlockEntity, ChangeSource, ChunkMeshData, Voxel, WeatherKind } from './types';

/** 'hunger': an empty food bar (spec 12.1; it never takes the last health point on its own). */
export type DamageCause = 'fall' | 'cold' | 'lava' | 'drown' | 'radiation' | 'explosion' | 'burn' | 'hunger';
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';
export type ToastKind = 'info' | 'good' | 'warn' | 'bad';

/** A screen the UI can be asked to open. */
export type ScreenRequest =
  | { type: 'inventory' }
  | { type: 'workbench'; x: number; y: number; z: number }
  | { type: 'furnace'; x: number; y: number; z: number }
  | { type: 'machine'; x: number; y: number; z: number }
  | { type: 'crate'; x: number; y: number; z: number }
  | { type: 'log' }
  | { type: 'pause' };

/** Every one-shot sound. src/audio synthesises all of them; anything may request one with the 'sfx' event. */
export type SfxName =
  | 'dig_stone'
  | 'dig_dirt'
  | 'dig_wood'
  | 'dig_sand'
  | 'dig_metal'
  | 'break'
  | 'place'
  | 'step'
  | 'jump'
  | 'land'
  | 'splash'
  | 'pickup'
  | 'craft'
  | 'forge'
  | 'smelt_done'
  | 'fuel_add'
  | 'ignite'
  | 'bellows'
  | 'fire_out'
  | 'upgrade'
  | 'objective'
  | 'age'
  | 'ui_click'
  | 'ui_open'
  | 'ui_close'
  | 'error'
  | 'hurt'
  | 'death'
  | 'tool_break'
  | 'machine_on'
  | 'machine_off'
  | 'machine_done'
  | 'spark'
  | 'alarm'
  | 'explosion'
  | 'ignition'
  | 'win'
  // ---- food, farming and animals (spec 12.7) ----
  | 'eat'
  | 'till'
  | 'plant'
  | 'harvest'
  | 'hen'
  | 'goat'
  | 'boar'
  | 'mob_hurt'
  // ---- buckets, a richer world, weather (spec 13-15) ----
  /** Rolling thunder; distance is expressed through `volume` (see 'weather:lightning'). Never positioned. */
  | 'thunder'
  /** A steam vent's breathy hiss, positioned at the vent. */
  | 'steam_hiss'
  /** A bronze bucket scooping (or pouring) lava: a thick glop and a sizzle. */
  | 'scoop_lava';

/** Buffs the player can carry. */
export type BuffName = 'well_warmed' | 'well_fed';

export interface GameEvents {
  // ---- world ----
  /** A voxel changed (emitted by the world for every setVoxel). */
  'block:changed': { x: number; y: number; z: number; from: Voxel; to: Voxel; source: ChangeSource };
  'chunk:loaded': { cx: number; cz: number };
  'chunk:unloaded': { cx: number; cz: number };
  /** Fresh mesh data for a chunk; the renderer takes ownership of the buffers. */
  'chunk:meshed': { mesh: ChunkMeshData };
  /**
   * The renderer should drop this chunk's mesh: it left the view distance (its voxel data may stay loaded,
   * see 'chunk:unloaded'). A later 'chunk:meshed' for the same chunk brings it back.
   */
  'chunk:hidden': { cx: number; cz: number };

  // ---- player actions ----
  /** Mining progress 0..1 on a block. progress = -1 means mining stopped without breaking it. */
  'block:mining': { x: number; y: number; z: number; progress: number };
  /** A block was broken by the player (after the voxel was already replaced). */
  'block:broken': { x: number; y: number; z: number; voxel: Voxel };
  /** A block was placed by the player. */
  'block:placed': { x: number; y: number; z: number; voxel: Voxel };
  'player:damage': { amount: number; cause: DamageCause; health: number };
  'player:death': { cause: DamageCause };
  'player:respawn': { x: number; y: number; z: number };
  /** The player's inventory contents changed in any way. */
  'inventory:changed': Record<string, never>;
  'hotbar:selected': { slot: number };
  /** Items entered the player's inventory from the world (mining, machine output, rewards). */
  'item:gained': { item: string; count: number };
  /** The player made something at a station (hand, workbench, furnace forge) or collected a smelted product. */
  'item:made': { item: string; count: number; station: string; recipeId: string };
  'tool:broke': { item: string };

  // ---- furnace & machines ----
  'machine:placed': { entity: BlockEntity };
  'machine:removed': { entity: BlockEntity };
  'furnace:lit': { x: number; y: number; z: number };
  'furnace:out': { x: number; y: number; z: number };
  'furnace:pumped': { x: number; y: number; z: number; draft: number };
  /** A crucible finished one item. */
  'furnace:smelted': { x: number; y: number; z: number; item: string; count: number };
  'furnace:upgraded': { x: number; y: number; z: number; tier: number };
  /** Starhearth ignition progress (0..1). */
  'furnace:ignition': { x: number; y: number; z: number; state: 'started' | 'progress' | 'failed' | 'done'; progress: number };
  /** A processing machine finished one job. */
  'machine:job': { kind: string; x: number; y: number; z: number; item: string };
  /** A power network changed state in a way the player should hear about. */
  'power:alert': { kind: 'overload' | 'brownout' | 'recovered' | 'meltdown_warning'; message: string; x: number; y: number; z: number };
  'explosion': { x: number; y: number; z: number; radius: number };

  // ---- progression ----
  'objective:completed': { id: string };
  'age:advanced': { age: number };
  /** A named one-off thing happened (objective conditions of type 'flag' listen for these). */
  'flag': { flag: string };
  'buff:gained': { buff: BuffName; durationS: number };
  'game:won': Record<string, never>;

  // ---- time ----
  'time:phase': { phase: DayPhase };

  // ---- UI ----
  /** Ask the UI to open a screen. */
  'ui:open': { screen: ScreenRequest };
  /** Ask the UI to close whatever screen is open. */
  'ui:close': Record<string, never>;
  /** The UI opened / closed a screen (controls release or re-acquire the pointer on these). */
  'ui:opened': { screen: ScreenRequest };
  'ui:closed': Record<string, never>;
  /** Short message on the HUD. `item` shows that item's icon next to it. */
  'toast': { text: string; kind?: ToastKind; item?: string };

  // ---- audio ----
  /** Play a one-shot sound, optionally positioned in the world. */
  'sfx': { name: SfxName; x?: number; y?: number; z?: number; volume?: number; pitch?: number };

  // ---- system ----
  'settings:changed': Record<string, never>;
  'game:saved': Record<string, never>;
  'game:paused': { paused: boolean };

  // ---- food, farming and animals (spec 12) ----
  /** The player ate one `item`, restoring `hunger` food points. */
  'player:ate': { item: string; hunger: number };
  /** An animal entered the world (spawn roll, keep-alive spawn or birth). `id` is unique for the session and saved. */
  'mob:spawned': { id: number; species: string };
  /** An animal was hit; `health` is what it has left. */
  'mob:hurt': { id: number; species: string; health: number };
  'mob:died': { id: number; species: string };
  /** A crop advanced to `stage` (0-based; the last stage is ripe). */
  'crop:grew': { x: number; y: number; z: number; stage: number };

  // ---- weather (spec 15) ----
  /** The weather began changing (once per change, when the blend from `previous` to `kind` starts). */
  'weather:changed': { kind: WeatherKind; previous: WeatherKind };
  /**
   * A storm's lightning flashed `distance` blocks away, towards `bearing` (radians, the camera's yaw convention:
   * 0 = north, positive turns left). Visual only - it never strikes anything. The thunder 'sfx' follows after
   * distance / SOUND_SPEED seconds.
   */
  'weather:lightning': { distance: number; bearing: number };
}
