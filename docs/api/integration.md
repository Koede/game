# Integration (7.5) - src/main.ts, src/app, src/save/document.ts, scripts/e2e.mjs

How the modules are wired into one game, the boot flow, the save document, the debug handle and the
end-to-end check. Unit tests: `npx vitest run src/app src/save` (32 tests). Browser: `npm run e2e`.

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
  readonly seedText: string | null; playTimeS: number; ticks: number
  prepareAroundPlayer(radiusChunks = 1): void                 // ensureLoadedAround the player
  faceOpenView(): void                                         // new worlds: look at the most open horizon
  tick(dt = DT): void                                          // clock -> sim -> survival -> objectives
  toSave(): WorldSave
  dispose(): void
}
seedFrom(text: string | null, random?): number                 // digits as is, words hashed, empty = random

// src/app/game.ts - one playable world in the browser
class Game {
  constructor(opts: { app; root: UIRoot; settings: Settings; state: GameState; pool: WorkerPool; onQuit(); onSettingsChange(s, key) })
  readonly state; input: InputState; renderer: Renderer; inputManager: InputManager; ui: GameUI;
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

Frame order (`Game.frame`): `controller.update(dt)` (input, physics, mining/placing; skipped while paused, but
`inputManager.frame` still runs) -> up to 5 fixed 20 Hz ticks of `GameState.tick` (not while paused) ->
`world.update(player, renderDistance, 4 ms)` -> `audio.setListener` + `audio.setAmbience(probe.update(dt))` ->
`ui.frame(dt)` (also while paused) -> `renderer.render(dt)`. Screens other than pause do not stop the world.

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
  clock: ClockSnapshot; survival: SurvivalSnapshot; objectives: ObjectivesSnapshot; playTimeS }
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
health warmth dead onGround selectedSlot home}, inventory [{slot item count durability?}], time {timeOfDay day
phase}, objective {id completed[] age}, furnaces [{x y z tier tempC lit draft ignited fuel crucibleIn
crucibleOut}], ui {open uiOpen paused touch pointerLocked}, target {x y z block mining}, render {drawCalls
triangles chunks}, world {loaded meshed mode} }`; `getBlock(x, y, z)` -> `{ block facing active solid
replaceable }`; `findBlocks(key, radius = 24, limit = 16)`; `surfaceY(x, z)`; `sampleFrame()` (draws a frame and
reads it back: `{ width height distinctColors brightness }`).
Set up: `give(item, n)`, `teleport(x, y, z)`, `look(yaw, pitch)`, `lookAt(x, y, z)`, `setTime(t)`,
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
