/**
 * Every event that travels over the game's EventBus. Modules that do not import each other
 * (rendering, audio, UI, controls, simulation) coordinate exclusively through these.
 *
 * Adding an event: append it here (never rename or remove one that another module may use).
 */
import type { BlockEntity, ChangeSource, ChunkMeshData, DrinkBuff, HostileAttack, ItemAmount, LegendaryEffect, ProjectileKind, Voxel, WeatherKind } from './types';

/**
 * 'hunger': an empty food bar (spec 12.1; it never takes the last health point on its own).
 * 'automaton': a landed automaton attack, ember bolts included (spec 19.2; armour counts). 'ember': the burning an
 * ember bolt leaves (spec 19.1). The automaton behind either is the species of the last 'player:attacked'.
 */
export type DamageCause = 'fall' | 'cold' | 'lava' | 'drown' | 'radiation' | 'explosion' | 'burn' | 'hunger' | 'automaton' | 'ember' | 'felled' | 'gas';
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
  /** The trade caravan's buy/sell screen (docs/api/caravan.md). */
  | { type: 'caravan' }
  /** A telegraph office or radio mast (docs/api/telegraph.md): the wire's news, the caravan by wire, the signal mode. */
  | { type: 'telegraph'; x: number; y: number; z: number }
  /** The Town page: Gruk's building, the town's standing, who lives where, and the camp goals. */
  | { type: 'town' }
  | { type: 'pause' }
  /** Dev Mode's item browser (docs/api/dev-mode.md). */
  | { type: 'creative' }
  /** The pipe screen for the pipe (network segment) at this position. */
  | { type: 'pipe'; x: number; y: number; z: number }
  /** The field notebook: scanned things, aspects, research boards (docs/api/magic.md). */
  | { type: 'notebook'; /** Opened at a Research Table: the notes can be written on. */ table?: boolean }
  /** The Workshop Guide: parts, basin recipe cards, rules (docs/api/workshop.md). */
  | { type: 'workshop' }
  /** The settlement's jobs (docs/api/jobs.md): what each resident carries between two stops. `person` is the one to show first. */
  | { type: 'jobs'; person?: string }
  /** The waypoint stone `stone` (docs/api/waypoints.md): pick a visited stone to travel to, rename this one. */
  | { type: 'waypoints'; stone: number }
  /** The Rune Desk at this position: arcane recipes with essentia costs (docs/api/magic.md). */
  | { type: 'rune_desk'; x: number; y: number; z: number; /** The Arcane Workbench: the bench's recipes instead of the desk's. */ bench?: boolean }
  /** The distillery rig panel for the module at this position (docs/DISTILLERY_PLAN.md). */
  | { type: 'distill_rig'; x: number; y: number; z: number };

/** Every one-shot sound. src/audio synthesises all of them; anything may request one with the 'sfx' event. */
export type FxBurstKind = 'splash' | 'dust' | 'snow' | 'sparkle' | 'hearts' | 'steam' | 'glow' | 'hit';

export type SfxName =
  | 'dig_stone'
  | 'dig_dirt'
  | 'dig_wood'
  | 'dig_sand'
  | 'dig_metal'
  | 'break'
  | 'place'
  | 'step'
  | 'step_stone'
  | 'step_wood'
  | 'step_sand'
  | 'step_snow'
  | 'step_metal'
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
  | 'jukebox_note'
  // The clock tower striking the hour (src/workshop/signals.ts).
  | 'tower_bell'
  | 'age'
  | 'ui_click'
  | 'coin'
  | 'door_open'
  | 'door_close'
  /** A soft bright note when good news appears as a toast. */
  | 'toast_good'
  /** A low soft double thud when a warning or bad news appears as a toast. */
  | 'toast_warn'
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
  // ---- Current Age engines: chainsaw and tractor ----
  | 'saw_cut'
  | 'tree_fall'
  /** A felled tree's warning creak, before it goes. */
  | 'tree_creak'
  /** One axe blow on a tree or a fallen log. */
  | 'tree_chop'
  | 'engine'
  | 'engine_start'
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
  | 'automaton_break'
  // ---- brewing (BREWING_PLAN 2): positioned where they happen, except `sip` ----
  /** Water bubbling in a heated container: a soft, short burble. Positioned at the bucket or kettle. */
  | 'boil_bubble'
  /** Boiling water poured from a bucket over the cone: a gentle rush. */
  | 'pour'
  // Essentia & Research (src/audio/sfxMagic.ts).
  | 'scan_chime'
  | 'essentia_pour'
  | 'rod_hum'
  | 'research_solve'
  | 'infuse'
  | 'cast'
  /** One drop falling from the cone into the cup. */
  | 'drip'
  /** Drinking a cup: a quiet sip and swallow. */
  | 'sip'
  // ---- Ember handwork (docs/api/handwork-content.md): one stroke sound per station kind, and the metal pour ----
  /** An axe bites wood: the Chopping Block stroke. */
  | 'chop'
  /** Stone on stone: the Hand Quern and (lower) the Mortar. */
  | 'grind'
  /** A hammer on the Stone Anvil: a bright metallic tap. */
  | 'hammer'
  /** A wooden shuttle thrown through the Loom. */
  | 'loom'
  /** Wet clay worked by the palm: the Clay Table. */
  | 'scrape'
  /** Molten metal poured into a mould: a gurgle and a hiss (not the water 'pour' of brewing). */
  | 'cast_pour'
  // ---- the glass distillery (docs/DISTILLERY_PLAN.md 15; src/audio/sfxDistill.ts) ----
  /** A bubble in heated glass: a short burble. Positioned at the module. */
  | 'distill_bubble'
  /** One drop leaving a condenser or coil. Positioned at the module. */
  | 'distill_drip'
  /** A glass chime when a distillery step completes. Positioned at the module. */
  | 'distill_chime'
  /** Liquid trickling through a tube or down a condenser while it runs. Positioned at the module. */
  | 'distill_trickle'
  /** A stopcock turned by hand on the separatory funnel. Positioned at the module. */
  | 'distill_tap';

/** Buffs the player can carry. */
export type BuffName = 'well_warmed' | 'well_fed' | 'sugar_rush' | DrinkBuff;

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
  /**
   * A leaf block fell away because no log held it any more (world/leafDecay.ts). `drops` is its rolled drop table: there
   * are no item entities, so game/leafDrops.ts hands them to the player when one is close, else they are lost.
   */
  'leaves:decayed': { x: number; y: number; z: number; voxel: Voxel; drops: ItemAmount[] };
  /** A block was placed by the player. */
  /**
   * Hand the player a blueprint (docs/api/blueprint.md): `id` is a catalog id (`stone_hut`), or, with `blueprint`, a stable id for that
   * layout so a repeat is noticed. Ruins, daily goals and the like emit this instead of importing the blueprint book.
   */
  'blueprint:grant': { id: string; blueprint?: { name: string; size: [number, number, number]; cells: Array<{ dx: number; dy: number; dz: number; block: string; facing: number; item?: string }> } };
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
  /** The town has a moment worth a diary line (a newcomer, a camp goal): the journal writes it once per `key`. */
  'town:note': { key: string; text: string };
  /** A named one-off thing happened (objective conditions of type 'flag' listen for these). */
  'flag': { flag: string };
  /** The player started an emote (wave, sit, cheer, dance). */
  /** Photo mode switched on or off (the HUD hides while it is on). */
  'photo:mode': { on: boolean };
  /** The player took a picture: the game saves the next frame as a framed shot. */
  'photo:snap': Record<string, never>;
  'emote': { kind: 'wave' | 'sit' | 'cheer' | 'dance' };
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
  /** Someone in the tavern speaks: the dialogue box shows their portrait, name and the text (src/ui/hud/npcDialogue.ts). */
  'npc:say': { id: string; role: string; name: string; title: string; text: string; /** The dialogue offers to give this person work (the Jobs screen). */ work?: boolean };

  // ---- audio ----
  /** Play a one-shot sound, optionally positioned in the world. */
  /** A small one-off particle burst at a world point (render/emitters.ts `fxBurst`). */
  'fx:burst': { kind: FxBurstKind; x: number; y: number; z: number; count?: number };
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
  /** A legendary weapon's verb fired (src/game/legendary.ts): the renderer shows a small burst of sparks, capped per event. */
  'legendary:proc': { effect: LegendaryEffect; x: number; y: number; z: number };
  /** Orrin's Spare Pick hums: `level` 0..1, louder the nearer the ore (sent about twice a second while ore is within reach). */
  'legendary:hum': { level: number };
  /** A legendary weapon was swung: a thin trail of `count` sparks along the swing from the eye (0 = none: reduced motion). */
  'legendary:swing': { effect: LegendaryEffect; x: number; y: number; z: number; yaw: number; pitch: number; count: number };
  /** An animal was hit; `health` is what it has left. */
  'mob:hurt': { id: number; species: string; health: number };
  'mob:died': { id: number; species: string };
  /** A crop advanced to `stage` (0-based; the last stage is ripe). */
  'crop:grew': { x: number; y: number; z: number; stage: number; /** The last stage: ready to harvest (a chime and a sparkle). */ ripe?: boolean };

  // ---- weather (spec 15) ----
  /** The weather began changing (once per change, when the blend from `previous` to `kind` starts). */
  'weather:changed': { kind: WeatherKind; previous: WeatherKind };
  /**
   * A storm's lightning flashed `distance` blocks away, towards `bearing` (radians, the camera's yaw convention:
   * 0 = north, positive turns left). Visual only - it never strikes anything. The thunder 'sfx' follows after
   * distance / SOUND_SPEED seconds.
   */
  'weather:lightning': { distance: number; bearing: number };
  /**
   * A disaster telegraph (docs/api/disasters.md): a boiler building pressure, a chimney sooting up, a storm aiming at
   * exposed wiring. 'watch' is a heads-up, 'warning' / 'imminent' mean act now, 'struck' it happened, 'averted' the
   * counterplay held. A toast and a sound go with it; this is for the HUD and tests.
   */
  /** A stick was used on a Brick Chimney at x,y,z: the disasters sweep the furnace it stands on (src/player/toolUses.ts). */
  'disaster:sweep': { x: number; y: number; z: number };
  'disaster:warn': { kind: 'boiler' | 'chimney' | 'storm'; level: 'watch' | 'warning' | 'imminent' | 'struck' | 'averted'; x: number; y: number; z: number };

  // ---- multiblock hearths (spec 17) ----
  /**
   * The furnace at x,y,z now sits in a formed hearth of structural `tier` (sim, on a change of formed state or
   * tier). `min` / `max` are the inclusive world corners of the shell (render: the light sweep; UI: the STRUCTURE tab).
   */
  /** A Use on an air block (BRONZE_PLAN 5.3): the sim reads its pressure and, on a compressor, works the hand crank. */
  'air:use': { x: number; y: number; z: number };
  /** A Use on a plumbing block (docs/api/plumbing.md): the sim reads its line and, on a hand pump, takes a stroke. */
  'water:use': { x: number; y: number; z: number };
  /** A sprinkler at x,y,z sprays (sim, twice a second while it has water): the renderer throws droplets. */
  'water:spray': { x: number; y: number; z: number };
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

  // ---- brewing (BREWING_PLAN 2, 11) ----
  /** Boiling water was poured over a loaded cone: the cup at x,y,z started to drip. `drink` is the drink item it will hold. */
  'brew:started': { x: number; y: number; z: number; drink: string };
  /** The cup at x,y,z finished brewing `drink` (a drink item key); it can be taken now. */
  'brew:done': { x: number; y: number; z: number; drink: string };
  /** A container on a furnace top (or a kettle) at x,y,z came to the boil. */
  'water:boiling': { x: number; y: number; z: number };
  /** The player drank one `item` (a drink item key). */
  'player:drank': { item: string };

  // ---- Ember handwork (docs/api/handwork-content.md, docs/api/handwork.md) ----
  /** One counted stroke at a hand station (x,y,z = the block); `double`: the tool or the hot window doubled it. */
  'hand:stroke': { x: number; y: number; z: number; station: string; progress: number; needed: number; double: boolean };
  /** A hand station finished a job: `output` x `count` now waits in it (timed stations too). */
  'hand:done': { x: number; y: number; z: number; station: string; output: string; count: number };
  /** The player took a finished output from a hand station. */
  'hand:taken': { x: number; y: number; z: number; station: string; item: string; count: number };
  /** Molten metal was poured into a mould (`at`: where it came from; x,y,z = that furnace, alloy pot or bench). */
  'cast:poured': { x: number; y: number; z: number; mould: string; metal: string; item: string; count: number; at: 'furnace' | 'alloy_pot' | 'bench' };

  // ---- the glass distillery (docs/DISTILLERY_PLAN.md 2, 15) ----
  /**
   * A distillery module changed state. Objectives listen for `state: 'done'` and the process key
   * ("Run your first spirit"). `process` is omitted when no process card is running.
   */
  'distill:step': { x: number; y: number; z: number; state: string; process?: string };
}
