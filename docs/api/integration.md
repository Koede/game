# Integration (7.5) - src/main.ts, src/app, src/save/document.ts, scripts/e2e.mjs, scripts/e2e-features.mjs

How the modules are wired into one game, the boot flow, the save document, the debug handle and the
end-to-end checks. Unit tests: `npx vitest run src/app src/save src/player src/render src/ui`. Browser: `npm run e2e`
(the opening on three devices, then `scripts/e2e-features.mjs` and `scripts/e2e-tech.mjs` on desktop and phone
portrait).

The second integration pass (animals, buckets, polish) is summarised in "Integration and polish pass 2", the third
(wrench, buckets on tanks, pipe screen, hearth and pipe e2e) in "Integration pass 3", both at the end.

## Boot flow (src/main.ts -> src/app/app.ts)

`main.ts` mounts `new App(#app)`. The App owns the `UIRoot`, the save slot, the shared `Settings` object and
the animation-frame loop.

- No WebGL2 (`hasWebGL2()` at boot, or the Renderer throwing later): a full-screen notice
  (`.hw-notice`, "This device cannot draw the world"), nothing else is shown.
- Title (`TitleScreen` from the kit): New World (optional seed field; hold-to-confirm when a save exists),
  Continue (only with a save), Settings, How to Play.
- Loading (`LoadingScreen`, `.hw-loading`): progress = meshed chunks / chunks within 2 of the player; play
  starts when `world.isReadyAround(player, 2)`. Two animation frames pass before the heavy synchronous work
  so the screen paints first.
- Play: the pause menu is GameUI's `'pause'` screen (Esc, the touch pause button). Its "Save and quit to title"
  saves, disposes the whole Game (WebGL context released with `forceContextLoss`) and shows the title.
- A world whose snapshot cannot be loaded leaves the save untouched and returns to the title with a toast.
- Entering play requests pointer lock (desktop) and, when the saved player was dead, re-shows the death screen.
- Audio: `AudioEngine.resume()` on the first `pointerdown` / `touchstart` / `keydown` (capture phase, every time).
- `visibilitychange` to hidden: save, and open the pause menu if nothing else is open. `pagehide`: save.

## Classes

```ts
// src/app/state.ts - DOM-free, node-tested
class GameState {
  static create(seed: number, seedText: string | null, options?: { pool?: WorkerPool; bus?: GameBus }): GameState
  static restore(save: WorldSave, options?): GameState        // throws on an unusable world snapshot
  readonly bus; world: World; player: PlayerState; clock: GameClock; sim: Simulation; survival: Survival; objectives: ObjectiveTracker
  readonly weather: Weather; mobs: MobManager; mobPlayer: MobPlayer          // animals: drops go to player.give
  readonly seedText: string | null; playTimeS: number; ticks: number
  prepareAroundPlayer(radiusChunks = 1): void                 // ensureLoadedAround the player
  faceOpenView(): void                                         // new worlds: look at the most open horizon
  tick(dt = DT): void                                          // clock -> weather -> sim -> mobs -> survival -> objectives
  toSave(): WorldSave
  dispose(): void
}
seedFrom(text: string | null, random?): number                 // digits as is, words hashed, empty = random

// src/app/game.ts - one playable world in the browser
class Game {
  constructor(opts: { app; root: UIRoot; settings: Settings; state: GameState; pool: WorkerPool; onQuit(); onSettingsChange(s, key) })
  readonly state; input: InputState; renderer: Renderer; mobRenderer: MobRenderer; inputManager: InputManager; ui: GameUI;
  readonly controller: PlayerController; audio: AudioEngine; ambience: AmbienceProbe
  readonly loadingProgress: number; readonly ready: boolean; frames: number
  loadingFrame(dt): void      // stream + draw only
  frame(dt): void             // one frame of play (see order below)
  teleport(x, y, z): void; tick(n): void; toSave(): WorldSave; dispose(): void
}
chunksInView(r): number; STREAM_BUDGET_MS = 4; LOADING_BUDGET_MS = 14; READY_RADIUS = 2

// src/app/loop.ts
clampFrameDt(dt): number      // 0..0.1 s, garbage -> 0
class FixedStep { advance(dt): number /* ticks to run, max 5, backlog dropped */; alpha; reset() }

// src/app/ambience.ts
class AmbienceProbe { constructor(world, player, clock); update(dt): AmbienceState; invalidate(): void }
furnaceHeatLevel(tempC, lit, ignited): number
```

Wiring order in `Game`: Renderer (before any `world.update`, it only builds meshes from events) ->
InputManager (touch layer of the UI root) -> GameUI (`releasePointer` -> `InputManager.releasePointerCapture`,
pause screen callbacks) -> `setIconProvider(createIconProvider())` -> `registerStationScreens(ui, sim)` ->
PlayerController with an IView that tees `setTarget` to the renderer AND `GameUI.setTarget` -> AudioEngine ->
AmbienceProbe. The Simulation is created by GameState after the player and clock are loaded and before the
tracker; `sim.resync()` runs after the world snapshot was loaded.

Frame order (`Game.frame`): `controller.update(dt)` (input, physics, mining/placing, hitting/feeding animals;
skipped while paused, but `inputManager.frame` still runs) -> up to 5 fixed 20 Hz ticks of `GameState.tick` (not
while paused) -> `world.update(player, renderDistance, 4 ms)` -> `audio.setListener` + `audio.setAmbience(...)` ->
the crosshair's animal name (`ui.setTargetName`, refreshed when the animal or its health changes) -> `ui.frame(dt)`
(also while paused) -> `mobRenderer.update(dt, mobs.views(step.alpha))` (interpolated; frozen with alpha 1 while
paused) -> `renderer.render(dt)`. Screens other than pause do not stop the world. The PlayerController gets
`animals: state.mobs`.

Ambience: the nearest furnace that makes any sound within 24 blocks (heat from its temperature, electric
when tier >= 3 and heat is delivered, Starhearth ignition progress), running machines within 14 blocks,
wind from eye height (calm at y 36, full at 80) and open sky, night, head under water, cold below 50 warmth.
Entities are scanned every 0.25 s.

## Save document (src/save/document.ts)

One versioned document under the localStorage key `hearthwatt.save`, through `SaveStore` (never throws,
memory fallback, quota detection).

```ts
SAVE_VERSION = 1; SAVE_KEY = 'hearthwatt.save'
interface SaveDocument { settings: Settings; world: WorldSave | null }
interface WorldSave { seed; seedText: string | null; world: WorldSnapshot; player: PlayerSnapshot;
  clock: ClockSnapshot; survival: SurvivalSnapshot; objectives: ObjectivesSnapshot; playTimeS;
  weather?: WeatherSnapshot; mobs?: MobsSnapshot }   // both optional: older saves load (animals start fresh)
class SaveSlot { constructor(storage?: StorageLike | null); persistent; lastProblem: string | null; read(): SaveDocument; write(doc) }
sanitizeSettings(raw): Settings          // complete, clamped to SETTINGS_BOUNDS (the settings panel's ranges)
isWorldSave(w): w is WorldSave           // structural check of every snapshot load() relies on
normalizeDocument(raw, onDropped?)       // a damaged world is dropped, the settings are kept
migrateSave(data, fromVersion)           // nothing older than version 1 exists yet
```

When it saves: on entering play, every 30 s of unpaused play, when the pause menu opens, on "Save and quit",
on `visibilitychange` (hidden) and `pagehide`. Settings changes are written 400 ms after the last change
(the title screen too). A refused write keeps the save in memory: quota -> red toast; storage blocked ->
one warning toast "This page cannot keep saves: progress lasts until it is closed".

## window.__hw (src/app/debug.ts)

Read: `state()` -> `{ phase, ready, hasSave, persistent, lastSave, frames, ticks, seed, player {x y z yaw pitch
health warmth food dead onGround selectedSlot home}, inventory [{slot item count durability?}], time {timeOfDay day
phase}, objective {id completed[] age}, furnaces [{x y z tier tempC lit draft ignited fuel crucibleIn
crucibleOut}], ui {open uiOpen paused touch pointerLocked}, target {x y z block mining}, targetAnimal {id name} |
null, mobs [{id species x y z health baby state d}] (loaded, living, nearest first), render {drawCalls triangles
chunks precipitation particles}, world {loaded meshed mode}, weather {...WeatherState, forced} }`; `getBlock(x, y, z)` -> `{ block facing active solid
replaceable }`; `findBlocks(key, radius = 24, limit = 16)`; `surfaceY(x, z)`; `sampleFrame()` (draws a frame and
reads it back: `{ width height distinctColors brightness }`).
Set up: `give(item, n)`, `teleport(x, y, z)`, `look(yaw, pitch)`, `lookAt(x, y, z)`, `setTime(t)`, `setDay(d)`,
`setWeather(kind | 'auto', instant?)`, `setFood(n)`, `clearInventory()`, `damage(n, cause?)`,
`spawnMob(species, x, y, z, baby?)` (returns the id),
`setVoxel(x, y, z, key, facing?, active?)` (source 'sim'), `open(screen)`, `close()`, `selectSlot(i)`,
`tick(n)`, `save()`, `newWorld(seed?)`, `continueWorld()`, `quit()`, `reset()` (drops the world and the save).
`__hw.app` is the App (console debugging).

## scripts/e2e.mjs

`npm run e2e` (or `node scripts/e2e.mjs [--no-build] [--device=desktop|phonePortrait|phoneLandscape|sandbox]
[--shots=dir]`). Builds, serves dist/, and in headless Chromium for desktop, phonePortrait and phoneLandscape:
title without errors -> New World with a typed seed -> chunks render (frame read back from the GPU) -> walk
(W key / touch joystick via CDP) -> mine four oak logs by holding Mine (mouse / press-and-hold on the world in
portrait / the Mine button in landscape) -> planks and a workbench through the inventory screen -> place it
-> sticks, cord and a flint pickaxe by hand -> clay furnace at the workbench, placed, becomes home -> furnace
screen: charcoal into the firebox (pick + "To Firebox"), Light, the temperature rises in real time, Pump ->
copper ore into the crucible, smelted (ticks fast-forwarded), the ingot collected into the pack -> copper wire
forged -> nine objectives completed in order and the tracker shows the next -> pause -> Save and quit ->
reload -> Continue restores position, view, inventory, furnace, objectives and clock -> no console errors.
Then `sandbox`: storage and pointer lock blocked, dialogs counted - boots, drag-to-look, mining without the
lock, save and quit to memory with a warning, Continue; and a browser without WebGL2 gets the notice.
Screenshots of every step in `test-results/e2e/`. Driver helpers: `scripts/lib/e2eDriver.mjs`,
`e2eFurnace.mjs`, `e2eSandbox.mjs`; `openGame` gained an `init` option (a page init script).

## Edits made to other modules (integration fixes)

- `src/player/input/inputManager.ts`: Chromium sends one bogus mouse movement (the jump to the lock point)
  just BEFORE `pointerlockchange`; movement while the lock is not yet announced and for 120 ms after is now
  dropped (`LOCK_SETTLE_MS`). Without it the view snapped by ~1 radian when entering the game with the mouse.
- `scripts/lib/browser.mjs`: `openGame({ init })`.

## Deviations from the spec

- Settings live in the same document as the world (`{ settings, world }`), so they persist without a world.
- `DEFAULT_SETTINGS` (src/core/context.ts) is per device: render distance 4 on a touch-first device (touch points and a
  coarse pointer, `isTouchFirst()`), 6 elsewhere; `defaultSettings(touchFirst)` builds either. A saved value wins.
- Screens other than the pause menu do not pause the simulation (the furnace keeps burning while you sort
  your pack); only the pause menu does.
- Hiding the tab / switching apps opens the pause menu (and saves), so a phone player returns to a paused game.
- New worlds turn the player towards the most open horizon (`faceOpenView`).

## Known gaps

- The e2e fast-forwards smelting with `__hw.tick` (copper takes ~1 minute of game time; software WebGL runs
  at 5-20 fps) and gives the raw materials after the first four logs; mining, crafting, placing, fuelling,
  lighting, collecting and forging are all real input.
- Software-rendered headless Chromium is the only browser this was run in; no real phone was used.
- Autosave writes the whole document (world edits included) every 30 s; a very large world (hundreds of
  thousands of edits) would make that write noticeable.

## Integration and polish pass 2 (animals, buckets, polish, feature e2e)

### Animals wired (spec 12.5, docs/api/mobs.md)
- `GameState`: `mobs = new MobManager(world, bus, clock, world.seed)` after the tracker; `onDeath` drops go to
  `player.give`; ticked after the simulation; `toSave().mobs`; `restore` loads `save.mobs` in a try/catch (a damaged
  or missing herd starts fresh, never refuses the world); disposed before the simulation.
- `Game`: `MobRenderer(renderer, world)` right after the Renderer; updated before every `renderer.render` (also in
  `loadingFrame`), disposed before the Renderer.
- `src/player/animals.ts` (new): `AnimalTargets` (raycast / hit / feed; MobManager fits it structurally),
  `AnimalHands` (`aim`, `strike`, `use`), `likedByAnimals(item)`, `Advisor`. `PlayerControllerOptions.animals?`,
  `PlayerController.targetAnimal: number | null`. Each frame the controller casts the blocks, then the animals; an
  animal nearer than the block wins: no block outline, no block mining (`setTarget(null, -1)`). Mine held: one hit
  whenever the animal's cooldown allows, damage `hitDamage(held)` (spec table), `wearHeldTool(1)` (the helper the
  mobs engineer asked for already existed in PlayerState from the food pass), swing; knockback, flash, flee, sounds
  are the manager's. Use: a held item some animal likes -> `feed` (one item taken, swing) or the refusal toasted
  ("Goats eat wheat", "This hen is too young", ...; throttled); anything else falls through to the normal Use on the
  block behind the animal, as if it were not there (eat, plant, place). Touch is the same code path: tap = Use,
  hold = Mine.
- HUD: `GameUI.setTargetName(text | null)` / `Hud.setTargetName` - replaces the block name under the crosshair
  (mining ring hidden) while an animal is targeted: "Boar - 10/10", "Young Hen - 4/4".
- Audio: unchanged; species calls, hurt and eat sounds arrive positioned through 'sfx' from the manager.

### Buckets (spec 13) and berry bushes (spec 14) - src/player/buckets.ts (new), interaction.ts
- `Buckets.use(item, hit)`: `pail` fills at water (endless spring, sfx splash - superseded by spec 18: it takes a source
  block, see docs/api/water.md); `bronze_bucket` scoops lava ->
  `lava_bucket`, **the lava block is removed** (source 'player'), sfx `scoop_lava`; `water_pail` pours water and
  returns the pail; `lava_bucket` pours a lava block and returns the bronze bucket (sfx `scoop_lava`,
  'block:placed', never into the cell the player stands in). Refusals (toasts, throttled, `BUCKET_HINTS`): wooden
  bucket on lava, bronze bucket on water, any bucket on crude oil. `SCOOPING_BUCKETS` makes the controller's ray stop
  at liquids while an empty bucket is held.
- Use on a fruiting `berry_bush` (any held item, before eating): its drops into the pack, the voxel becomes
  `berry_bush_bare` (same flags, entity kept), sfx `harvest`, UseOutcome `'picked'`; breaking it does the same
  (harvestLeaves is a block rule); breaking the bare bush removes it. `screenFor` returns null for role 'bush'
  (no machine screen).

### Render polish (src/render)
- `vents.ts` (new) `SteamVents`: steam_vent blocks within `VENT_RANGE` 40 of the camera breathe a wisp
  (1.4 puffs/s) and gush every 2.5-6 s; each vent hisses every `HISS_MIN_S`..`HISS_MAX_S` (4-9 s) while within
  `HISS_RANGE` 16, positioned at the vent, never two hisses within `HISS_GAP_S` 1.5 s. A covered vent is silent.
  Chunks around the camera are scanned once (one per frame, through `World.chunkVoxels` when available) and again
  only when a vent block changes. Counted in `stats.effectSources`.
- Liquid surfaces (shaders/chunk.ts): crude oil is shuffled per block (turn, mirror, whole-texel shift, drifting
  together; mip level from the smooth coordinate via the new `atlasTexelGrad` in ATLAS_GLSL) - the sheen no longer
  lines up in a grid; water and lava blend in a quarter-turned copy under a slow noise mask; every liquid varies
  in brightness over several blocks.
- Steam engine: `MachineAnim.openSide`; `openSideYaw(world, x, y, z)` turns the flywheel flank to the most open side
  (air > thin blocks > solid / liquid; ties keep +X).
- `LightProbe.cool` / `violet` / `tint(warm, out)`: the share of cool light (glowcaps cyan, crystals violet); the
  held item and particle debris now take that colour (emitters' `LightProbe` callback returns RGB).

### scripts/e2e-features.mjs (+ scripts/lib/e2eFeatures.mjs)
Desktop and phonePortrait (seed `hearth-e2e`), real input for every action under test: an adult animal near spawn
is hit with Mine (mouse / press-and-hold on the world) until it dies and its meat arrives (axe worn); the furnace
(placed with Use) cooks the meat in its crucible through the furnace screen; the meal is eaten with Use (food up);
a flint hoe tills grass; wheat seeds plant on that farmland; a workbench (placed) makes dough from 2 flour and a
water bucket (bucket returned); the dough bakes into bread; a bronze bucket scoops a lava pool (block gone) and
pours it back (bronze bucket returned); `__hw.setWeather('rain')` and rain falls (precipitation drawn, screenshot).
`__hw` only gives, teleports to open ground, aims, sets time / weather / food, clears the pack, and fast-forwards
smelting with ticks. Screenshots in `test-results/e2e-features/`. `Driver.useBlock` now retries a tap up to 4
times (a tap spanning a slow software frame reads as a hold). The sandbox check (random seed) now mines the plant
the player stands in when there is one (wild wheat grows around spawn and caught the downward aim), and records
every toast so the one-time storage warning (shown on the first save, gone after 6 s) is not missed.
Note: the opening's "W key walks" step fails when the machine is busy (low fps = short clamped frames); it passes
on a quiet machine.

### Deviations
- An animal under the crosshair blocks targeting of the block behind it, but a Use that means nothing to animals
  still acts on that block (spec "as if no animal were there").
- A liked item aimed at an animal that will not take it (wrong species, baby, cooldown) is not eaten or planted:
  the reason is toasted instead.
- Lava is never poured into the cell the player stands in ("Step back before pouring lava").

### Known gaps
- ~~The MobRenderer's own probe and the machine parts still light with firelight only~~ - done in pass 3.
- ~~A hurt boar stayed in 'flee' for over 10 s~~ - explained in pass 3 (game time vs real time, not a bug).

## Integration pass 3 (wrench, buckets on tanks, pipe screen, hearth and pipe e2e)

### Wiring
- `Game` passes the simulation to the controller: `new PlayerController({ ..., animals: state.mobs, transport: sim })`.
  `Simulation` fits the player module's `TransportHands` interface structurally (`wrench(x, y, z, dir)`,
  `bucketUse(x, y, z, face, heldKey)`), so src/player still never imports src/sim.
- The pipe screen itself is registered by the UI (`registerStationScreens`, docs/api/ui-tech.md); the renderer reads
  `sim.transportView()` through `renderer.setTransport(simTransportFeed(sim))` (render engineer's hook in game.ts).

### Use on pipes and fluid blocks (src/player/pipeTools.ts, pipeAim.ts; details in docs/api/player.md)
Decided before any machine screen opens:
- **Wrench on a pipe** -> `sim.wrench` with the side aimed at: the arm the crosshair is on (an end touching a block
  cycles push -> pull -> off; an arm towards a pipe parts the two), or, on the core, the core face turned to the player
  (joins a parted pipe again). The simulation toasts ("Pulling from Crate") and plays `pipe_clunk`; a refusal is
  toasted ("No pipe to join on that side"). One turn per 0.35 s (a held button repeats Use).
- **Bucket** (empty, water, bronze, lava) on a tank or any block with fluid ports -> `sim.bucketUse`; the held bucket
  is swapped for the one it returns; a refusal ("The Tank is full", "Lava needs a bronze bucket") is toasted and opens
  nothing; a block without fluid ports goes on as before (pour, scoop, screen).
- **Anything else on a pipe** (empty hand, food, a hoe, ...; not the wrench, a bucket or a placeable block) opens the
  pipe screen (`ui:open { type: 'pipe', x, y, z }`). Placeable blocks still place against pipes (that is how a line is
  extended). Touch: a tap is Use; no long-press (press-and-hold is mining on touch, and a long-press that mined the
  pipe before opening its screen would be worse than an empty slot and a tap).

### Animals and machine parts take the cool glow (src/render)
`src/render/coolLight.ts` (`COOL_TINT_GLSL`, `signedCool(probe)`): one float per instance, the share of block light
from cool emitters, negative for violet. `MobRenderer` (attribute `aCool`, eased with the other light values; a change
of hue switches at once) and `MachineParts` (`aCool`, written on each probe) light with
`lightColorTinted(sky, block, coolBlockTint(aCool))`, like the terrain, the hand and the particles. Tests in
mobRenderer.test.ts / machineParts.test.ts (cyan by glowcaps, violet by crystals, none by a torch).

### The "hurt boar stays in flee" report (src/mobs) - not a bug
Flight lasts `MOB_FLEE_S` = 5 s of GAME time and the manager counts it down every tick (unit-tested). The fixed step
runs at most 5 ticks per frame and drops the backlog, so at 2-3 fps (software WebGL on a busy machine) 5 s of game
time take 10 s or more of real time. `scripts/lib/e2eFeatures.mjs` now waits for the animal to calm down in ticks (up
to 140 = 7 s of game time) and reports a real fault only beyond that. Nothing changed in src/mobs.

### scripts/e2e-tech.mjs (+ scripts/lib/e2eTech.mjs) - run by `npm run e2e` after e2e-features
Desktop and phonePortrait, seed `hearth-e2e`. `__hw` only finds a level site (and mows plants when no clean site
exists), gives items, teleports, aims (`look`), sets the time and runs ticks; toasts and hearth events are read from
the bus. Real input for everything under test:
1. A Blast hearth is built block by block with Use: 9 floor bricks, a clay furnace placed from the south (its front
   faces out), fuelled and lit through its screen, 6 wall bricks (no formation yet), then an item hatch in the east
   wall -> `hearth:formed` tier 2 and the toast "Blast hearth formed"; the shell's active bit (glowing seams) is set.
2. The furnace's STRUCTURE tab reads "Formed - Blast hearth 1x1x1".
3. A crate and three bronze chutes are placed (crate -> 2 pipes on the ground -> 1 up -> the hatch); the line has two
   ends, the crate end pushing. Copper ore goes into the crate through the crate screen.
4. The wrench on the pipe arm reaching into the crate turns that end to Pull ("Pulling from Crate"); the renderer draws
   the ore moving in the pipes (`renderer.stats.tech.packets`) and it reaches the furnace's crucible through the hatch.
5. A placed tank takes a water bucket (the bucket comes back empty, the tank holds 1000 L, no screen opens), and the
   empty bucket scoops it back (tank 0 L).
6. With an empty hotbar slot, Use on a pipe opens the pipe screen; the Item Hatch row's Off is pressed and the
   simulation's port is off, the row says so.
7. At night, a hen and a pump beside glowcaps on a stone shelf far from any fire: their `aCool` attributes are > 0.5.
Screenshots in `test-results/e2e-tech/`. Taps that span a slow software frame read as a hold (as on a stalling phone);
the steps tap again only when nothing changed.

### Known gaps
- No long-press on touch for the pipe screen (see above).
- Wrench-parted joints still draw their arm (mesher, render-machines.md); the wrench targets them through the core.

