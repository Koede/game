# src/player - controls, physics, targeting, interaction (spec 7.3 and 10.5)

Import everything from `src/player` (index re-exports `./input` too). Never imports `src/sim`, `src/render` or
`src/ui`: it draws through `IView` (src/core/context.ts), opens screens with `'ui:open'` and changes machines only
by editing voxels (the simulation reacts to `'block:changed'`). 120 unit tests: `npx vitest run src/player`.

## Wiring (what main.ts does)

```ts
const input = new InputManager({ container: app, touchLayer: uiRoot.layers.touch, settings, state, bus });
const controller = new PlayerController({ world, bus, player, view: renderer, input, settings, state });
// every animation frame, before world.update and render:
controller.update(dt);                       // dt in seconds, clamped to 0.1 by the loop
// tee the target to the HUD (GameUI.setTarget has IView.setTarget's signature):
//   pass a view that forwards setTarget to both renderer and gameUI, or call gameUI.setTarget(...) yourself
//   with controller.target / controller.miningProgress after update.
```
- `world.spawnPoint()` returns a block corner (integers). Put the player's feet at `x + 0.5, y, z + 0.5`,
  otherwise the player straddles four columns.
- The first click on the view asks for pointer lock (that click does not mine). Call
  `input.requestPointerCapture()` from the title screen's Play / Continue button as well.

## PlayerController (controller.ts)
- `new PlayerController(options: PlayerControllerOptions)` with
  `{ world: IWorld; bus: GameBus; player: PlayerState; view: IView; input: IntentSource; settings: Settings; state: InputState; rng?: () => number }`.
- `interface IntentSource { frame(dtSeconds: number): Intent; requestPointerCapture?(): Promise<boolean>; releasePointerCapture?(): void }` - `InputManager` implements it; tests pass a script.
- `update(dt: number): void` - one frame: intent -> yaw/pitch (pitch clamped just short of +-90 deg) -> hotbar ->
  menus -> physics -> raycast -> use / mining -> view. Physics keeps running while a screen is open (neutral
  intent); a dead player does not move or act.
- `readonly target: RayHit | null` - block under the crosshair after the last update.
- `readonly miningProgress: number` - 0..1 on the target, -1 when not mining.
- `teleport(x, y, z): void` - moves the feet and forgets the fall in progress (no fall damage). Debug / respawn helpers should use it.
- `readonly physics: PlayerPhysics`, `readonly interaction: Interaction`; `dispose(): void`.
- `SPRINT_FOV_KICK = 8` (degrees).
- Drives the view: `setView` every frame (eye = feet + PLAYER_EYE, plus a small walk bob and a glide after
  stepping onto a slab), `setFov` only when it changes (settings.fov + kick while sprinting, eased),
  `setTarget` every frame (mining progress only for the cell being mined), `setHeldItem` on change,
  `triggerSwing` on every dig tick (4/s), place, pail use and screen open.
- Emits: `'ui:open'` `{ type: 'inventory' | 'log' | 'pause' }` from E / L / Escape / bag / pause buttons;
  sfx `jump`, `land` (falls > 1.2 blocks), `splash` (entering water), `step` (every 1.75 blocks on the ground),
  all positioned.
- Listens: `'ui:opened'` -> stop mining and release pointer lock; `'ui:closed'` -> capture the pointer again
  (only on non-touch devices once the player has used pointer lock; a refusal is harmless, the next click
  captures); `'player:respawn'` -> reset the fall tracker.

## PlayerPhysics (physics.ts, collision.ts)
- `new PlayerPhysics(world: IWorld, player: PlayerState)`; `step(dt, input: MoveInput): StepResult` (the
  result object is reused); `reset()`; `inLiquid: boolean`; `solidHeight(x, y, z): number` (0 / 0.5 / 1);
  `intersectsCell(x, y, z, height = 1): boolean`.
- `MoveInput { moveX; moveZ; jump; sprint }` (an `Intent` fits). `StepResult { landedFrom; jumped; enteredWater; walked; steppedUp; fellOut; sprinting }`.
- Writes `player.position / velocity / onGround / inWater / headInWater`. Fall damage
  (`fallDamage` from src/game, i.e. floor(height - 3.5)) via `player.damage(n, 'fall')`; water resets the fall.
- Box 0.6 x 1.8 swept one axis at a time over the whole swept region (exact at any speed; also sub-stepped at
  0.45 blocks); terminal fall speed `MAX_FALL_SPEED = 60`. Steps up to `STEP_HEIGHT = 0.52` while walking
  (slabs, not full blocks). Walk 4.3, sprint 5.8 (only pushing mostly forward, not in liquids), swim 2.6 m/s;
  ground response fast, air control low. Liquids (water and lava, sampled at the waist): slow sink, Space rises
  at 3.2 m/s, pushing into a bank while rising climbs out.
- Unloaded columns and y < 0 are solid, y >= 96 is air. Blocks the player already overlaps are ignored (so a
  stuck player walks out); a loaded block appearing inside the player lifts it up to 2 blocks. Below y = -8 or
  with a non-finite position the player is put back at `player.spawn` (on the surface if that column is loaded).
- `collision.ts` (pure): `solidHeight(world, x, y, z)`, `boxIntersectsCell(pos, x, y, z, height?)`,
  `sweepAxis(world, pos, axis: 0 | 1 | 2, d): number` (distance moved), `overlapsLoadedSolid(world, pos)`, `HALF_WIDTH`, `EPS`.

## raycast.ts
- `raycast(world, ox, oy, oz, dx, dy, dz, maxDist, includeLiquids, out: RayHit): RayHit | null` - exact DDA;
  skips the origin cell, air, and liquids unless `includeLiquids`; stops at unloaded columns and y < 0.
- `interface RayHit { x; y; z; face: Face; px; py; pz; voxel; block: BlockDef; distance }` - `face` is the face
  of the hit cell the ray entered through, `p*` the cell across it. `createRayHit(): RayHit`.
- Thin shapes (cross, torch, cable, slab) are targeted through their WHOLE cell (easier with a thumb).
  The controller casts with liquids only while an empty pail is held.

## Interaction (interaction.ts)
- `new Interaction(world, bus, player, body: BodyProbe, swing: SwingTarget, rng = Math.random)`.
- `updateMining(dt, mineHeld: boolean, hit: RayHit | null): void` - every frame. Time per spec 3.6
  (`miningTime` from src/game, re-evaluated each frame so switching tools mid-dig counts). Emits
  `'block:mining'` at start (0), every 0.1 s, and -1 when stopped without breaking; dig sfx by material every
  0.25 s (`digSound(def)`). Breaking: voxel -> air (source 'player'), drops via `player.give` (`harvest`),
  `player.wearHeld`, `'block:broken'`, sfx `break`, then a 0.12 s pause before the next block. Liquids are not mined.
- `use(hit): UseOutcome` (`'none' | 'screen' | 'pail' | 'placed' | 'refused'`) - priority: station / machine
  -> `'ui:open'` (`screenFor(def, x, y, z)`: workbench, furnace, crate, else machine); else pail / water pail;
  else place the held block item.
- `placeBlock(hit, def): boolean` - into the hit cell when it is replaceable (tall grass), else across the
  face; the target must be loaded, inside 0..95 and replaceable; `placeOn` checked against the block below;
  solid blocks never intersect the player (torches, plants, cables may); oriented blocks face the player
  (`facingTowards(yaw)`); takes one item; emits `'block:placed'` and sfx `place`; 0.15 s repeat delay.
- `progress`, `mx/my/mz` (cell being mined), `mining`, `edits` (counter of world edits made), `stopMining()`.
- Constants: `DIG_INTERVAL_S 0.25`, `MINING_EVENT_INTERVAL_S 0.1`, `BREAK_COOLDOWN_S 0.12`, `PLACE_COOLDOWN_S 0.15`.
- Advisory toasts (at most once per 8 s per subject): "Stone needs a flint pickaxe or better to drop anything",
  "Corestone cannot be broken", "Tall Grass can only be placed on grass, dirt", pail on lava.

## Input layer (src/player/input)
- `new InputManager({ container, touchLayer, settings, state, bus })`:
  - `frame(dtSeconds): Intent` - returns and clears accumulated deltas and edges; the returned object is reused.
    While `state.uiOpen || state.paused` it is neutral and everything held is released (keys pressed while
    blocked are ignored, so the key that closes a screen never leaks into the game). Updates
    `state.pointerLocked`, shows/hides the touch overlay.
  - `requestPointerCapture(): Promise<boolean>`, `releasePointerCapture(): void` (not reported as a pause),
    `readonly touchEnabled: boolean`, `readonly usingDragLook: boolean`, `readonly core: InputCore`, `dispose()`.
  - Keeps `state.touch` = touch controls enabled (settings 'on'; 'auto' = coarse pointer, touch points, or a touch
    was seen). Re-reads on `'settings:changed'`.
- `Intent` (intent.ts): `moveX, moveZ` (vector length <= 1; z forward), `lookYaw` (> 0 = turn RIGHT; the
  controller subtracts it from the yaw), `lookPitch` (> 0 = up; sensitivity and invertY applied), `jump, sprint,
  mine` (held), `use` (press + every `USE_REPEAT_S = 0.25` s while held), `hotbarSlot: number | null`,
  `hotbarStep: -1 | 0 | 1`, `inventory, log, pause` (edges). `createIntent()`, `clearIntent(i)`.
- Pure, node-tested parts: `InputCore` (folds everything into the intent), `TouchGestures` (multi-touch state
  machine, `GESTURE_DEFAULTS`: tap < 220 ms and 10 px, hold >= 280 ms, dead zone 0.14, sprint at 0.9 / off at
  0.78), `MouseDrag` (drag-to-look fallback), `keys.ts` (`reduceKeys`, `keyAxisX/Z`, `keyCommand`, `physicalCode`).
- `TouchOverlay` - joystick, hold ring and buttons (Jump, Mine, Use bottom right; bag + pause top right) in the
  touch layer; CSS `TOUCH_CSS` injected once (class prefix `hw-touch-`, kit variables with fallbacks).
  `PointerLock` (pointerLock.ts, internal) handles missing / throwing / rejecting / silent lock requests.
- Events outside the game surface are left alone: anything inside `.hw-window` / `.hw-ui-blocking`, and any
  element inside the UI root (`.hw-root`) other than the touch overlay (HUD widgets such as hotbar slots stay
  tappable). The container gets class `hw-touch-surface` (touch-action none, no selection / callout).
- Escape while pointer-locked: the browser's unlock (not asked for by the game, no screen open) becomes one
  `pause` edge. GameUI exits pointer lock itself after setting `uiOpen`, which is not treated as a pause.

## Layout contract with the HUD
Touch controls keep the bottom-centre strip (60% of the width x 64 px) free for the hotbar in both
orientations, and use the top-right corner (about 112 x 60 px) for the bag and pause buttons. The joystick
appears wherever the left thumb lands in the lower-left region (left half; below 40% of the height in portrait,
22% in landscape), resting at the bottom left when idle.

## Verification
- Node: physics (resting, walking/strafing/turning, jump height, walls, wall sliding, ceilings, slab step,
  60 m fall without tunnelling incl. 0.1 s steps, fall damage, water breaks a fall, unloaded columns as walls,
  out of world, unstick, swimming and climbing out), raycast (all six faces, reach, negative coordinates,
  liquids, thin shapes, unloaded stop), interaction (dig times, tool/tier rules, wear, Well-Warmed, reset on
  retarget, corestone, every screen type, placing rules, placeOn, replaceable targets, orientation, repeat delay,
  pail both ways and on lava), controller (look, bob, FOV kick, hotbar, menus, mining -> view, held item,
  pointer re-capture, death, respawn), input (keys, joystick, dead zone, sprint hysteresis, tap / hold / drag,
  three simultaneous pointers, use repeat, wheel, sensitivity / invertY, blocked release, drag fallback).
- Browser (headless Chromium, scratch harnesses, not in the repo): input harness at 1280x800, 390x844, 844x390
  with CDP multi-touch - 34 checks; real `World` (seed 7) + controller + InputManager drawn by a throwaway
  three.js IView - desktop: W walks, drag looks (lock refused), hold mines gravel and the item arrives, right
  click places, workbench opens its screen, no walking while a screen is open, with lock granted the click
  captures and holding mines; phone portrait and landscape: joystick walks while a second finger looks, Mine
  button and press-and-hold mine, tap places, Use places, Jump jumps, nothing scrolls or zooms - 26 checks,
  stable over three runs. Screenshots of the overlay over bright sky, dark cave colour and sand, and over the
  real world, were reviewed.

## Deviations and decisions
- The empty pail does not remove the water block it scoops from (water does not flow in this game, so a
  removed cell would leave a hole with hanging water walls); lakes are endless wells. Pouring a water pail
  places one water block and gives the empty pail back in the same slot. Pail on lava refuses with a toast.
- Mining a block next to water leaves air (no flowing water).
- The click that captures the pointer does not mine; hold again.
- Thin shapes are targeted by their whole cell; the controller casts through liquids only with an empty pail.
- `'block:mining'` is not emitted with progress 1 / -1 after a successful break: `'block:broken'` follows instead.

## Known gaps
- Not yet run against the real Renderer (src/render had no Renderer when this was written); verified with a
  stub view and a throwaway three.js view.
- A very slow look drag (under about 36 px/s for the first 280 ms) is read as press-and-hold and mines while it
  looks. Seen only with CDP-delivered touches on a slow software renderer; real thumbs move faster, but it is
  inherent to hold-to-mine on a still finger.
- Fall damage is applied by the physics directly (`player.damage`), not through `Survival.applyFall`; both use
  the same `fallDamage` rule and the physics already skips it in water.
