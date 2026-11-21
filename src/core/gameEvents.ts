/**
 * Every event that travels over the game's EventBus. Modules that do not import each other
 * (rendering, audio, UI, controls, simulation) coordinate exclusively through these.
 *
 * Adding an event: append it here (never rename or remove one that another module may use).
 */
import type { BlockEntity, ChangeSource, ChunkMeshData, HostileAttack, ItemAmount, ProjectileKind, Voxel, WeatherKind } from './types';

/**
 * 'hunger': an empty food bar (spec 12.1; it never takes the last health point on its own).
 * 'automaton': a landed automaton attack, ember bolts included (spec 19.2; armour counts). 'ember': the burning an
 * ember bolt leaves (spec 19.1). The automaton behind either is the species of the last 'player:attacked'.
 */
export type DamageCause = 'fall' | 'cold' | 'lava' | 'drown' | 'radiation' | 'explosion' | 'burn' | 'hunger' | 'automaton' | 'ember';
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
  | { type: 'pause' }
  /** The pipe screen for the pipe (network segment) at this position. */
  | { type: 'pipe'; x: number; y: number; z: number };

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
  | 'scoop_lava'
  // ---- transport and hearths (spec 16-17) ----
  /** A hearth formed: a deep whoomph as the fire takes the whole chamber, with a rising shimmer. Positioned at the controller. */
  | 'hearth_formed'
  /** A soft metallic tick: the wrench changed a pipe end or a pipe joint. */
  | 'pipe_clunk'
  // ---- the Emberbound automatons (spec 19.5); all positioned at the automaton or the projectile ----
  /** A heavy metal clank: one footfall of a walking automaton (the colossus at a low pitch, mites high and light). */
  | 'automaton_step'
  /** A whirr winding up with a hiss of embers catching: an automaton wakes (notices the player, or is hit while dormant). */
  | 'automaton_wake'
  /** The telegraph: a rising hiss and bellows-inhale through the whole wind-up. Must cut through on a phone speaker. */
  | 'automaton_windup'
  /** A metal impact: a blow, a dash or a slam lands. */
  | 'automaton_attack'
  /** A kiln sentry launches an ember bolt: a throaty whoosh with crackle. */
  | 'ember_bolt'
  /** An arc drone's zap: a sharp electric crack and buzz. */
  | 'arc_zap'
  /** A clang: the player hits an automaton. */
  | 'automaton_hurt'
  /** An automaton breaks apart: a crash of plates and a tinkle of scrap. */
  | 'automaton_break';

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

  // ---- world overlays (UI asks, renderer draws) ----
  /**
   * Show a ghost preview: translucent cubes where blocks are missing (`missing`) or wrong (`wrong`).
   * `key` identifies the preview (e.g. "hearth:x,y,z"); showing the same key again replaces it.
   */
  'ghost:show': { key: string; cells: Array<{ x: number; y: number; z: number; block: string; state: 'missing' | 'wrong' }> };
  /** Remove a ghost preview (omit key to clear all). */
  'ghost:clear': { key?: string };
  /** Pulse a red outline on one block for `seconds` (with an edge-of-screen arrow when off-screen). */
  'highlight:block': { x: number; y: number; z: number; seconds: number };

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

  // ---- multiblock hearths (spec 17) ----
  /**
   * The furnace at x,y,z now sits in a formed hearth of structural `tier` (sim, on a change of formed state or
   * tier). `min` / `max` are the inclusive world corners of the shell (render: the light sweep; UI: the STRUCTURE tab).
   */
  'hearth:formed': { x: number; y: number; z: number; tier: number; min: [number, number, number]; max: [number, number, number] };
  /** The hearth of the furnace at x,y,z stopped being formed (a block was broken or changed). Nothing is destroyed. */
  'hearth:unformed': { x: number; y: number; z: number };

  // ---- the Emberbound automatons (spec 19; they also use 'mob:spawned' / 'mob:hurt' / 'mob:died') ----
  /** An automaton woke: it noticed the player, was hit while dormant, or night fell on it. x,y,z = its feet. */
  'hostile:woke': { id: number; species: string; x: number; y: number; z: number };
  /** An automaton wound down (daylight under open sky, spec 19.2): it stops, its glow dims, it no longer attacks. */
  'hostile:dormant': { id: number; species: string; x: number; y: number; z: number };
  /**
   * The telegraph of an attack began: ember parts flare and sfx automaton_windup plays for `durationS` (the spec's
   * windupS). The HUD shows an edge arrow towards x,z when it is off-screen.
   */
  'hostile:windup': { id: number; species: string; attack: HostileAttack; x: number; y: number; z: number; durationS: number };
  /** The wind-up ended and the attack was released (a blow or slam swings, a bolt leaves, a dash starts its charge, a zap arcs). */
  'hostile:attack': { id: number; species: string; attack: HostileAttack; x: number; y: number; z: number };
  /**
   * An automaton's attack hurt the player: emitted just before PlayerState.damage(amount, 'automaton'). `amount` is
   * after the difficulty multiplier and before armour; x,y,z is where the blow came from (the automaton, or the bolt).
   * The HUD pulses the screen edge towards it; the death screen names `species` ("Felled by a Forge Warden").
   */
  'player:attacked': { species: string; attack: HostileAttack; amount: number; x: number; y: number; z: number };
  /** A projectile left its launcher (`from` = the automaton's mob id). Velocity in blocks per second. */
  'projectile:fired': { id: number; kind: ProjectileKind; species: string; from: number; x: number; y: number; z: number; vx: number; vy: number; vz: number };
  /** A projectile ended: it struck the player or a block, or flew out its lifetime ('expired'). x,y,z = where. */
  'projectile:hit': { id: number; kind: ProjectileKind; species: string; from: number; x: number; y: number; z: number; target: 'player' | 'block' | 'expired' };
  /**
   * The player broke an automaton apart (spec 19.5: debris, sparks). `drops` went into the inventory. Emitted together
   * with 'mob:died' and the flag FLAG_AUTOMATON_SALVAGED.
   */
  'automaton:salvaged': { id: number; species: string; x: number; y: number; z: number; drops: ItemAmount[] };
}
