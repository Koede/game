# src/ui/hud, src/ui/gameUI.ts, src/ui/screens (7.4a) - public API

GameUI, the HUD, the shared slot-interaction controller, and the inventory, workbench, Hearth Log, death and
win screens. Built on `src/game`, the kit (`docs/api/ui-kit.md`) and `src/core`; never imports `src/sim`,
`src/render` or `src/player`. Tests: `npx vitest run src/ui` (hudMath, slot rules, recipe rows, plus the kit's).

## 1. GameUI (src/ui/gameUI.ts)

```ts
class GameUI {
  constructor(root: UIRoot, deps: GameUIDeps)
  frame(dt: number): void                    // every animation frame, ALSO while paused: HUD + ~8 Hz screen refresh
  setTarget(target: { x: number; y: number; z: number } | null, mining: number): void  // same as IView.setTarget
  registerScreen<T extends ScreenRequest['type']>(type: T, factory: ScreenFactory<Extract<ScreenRequest, { type: T }>>): void
  open(request: ScreenRequest): boolean      // same as emitting 'ui:open'; false: nothing registered / factory refused / death screen up
  close(): void                              // same as 'ui:close'; never closes the death screen
  readonly current: ScreenRequest | null     // null when nothing (or the death / win screen) is open
  readonly isOpen: boolean                   // any screen, death and win included
  readonly hud: Hud
  setSim(sim: UISimQuery): void              // the simulation may be created after the UI
  setIconProvider(provider: IconProvider | null): void  // kit setIconProvider + refresh visible icons
  dispose(): void
}

interface GameUIDeps {
  bus: GameBus; input: InputState; settings: Settings /* by reference: showFps */; world: IWorld;
  player: PlayerState; clock: GameClock; objectives: ObjectiveTracker; survival: Survival;
  sim?: UISimQuery;                          // default NO_UI_SIM
  releasePointer?: () => void;               // pass () => inputManager.releasePointerCapture(); GameUI never touches pointer lock itself
  pause?: { onSettingsChange(settings: Settings, key: keyof Settings): void; onQuit(): void };  // registers the kit PauseMenu as 'pause'
}
```

Behaviour:
- Listens to `'ui:open'` / `'ui:close'`. One screen at a time: opening another switches directly (no `'ui:closed'`
  in between; `uiOpen` stays true). Re-opening the screen that is already open does nothing.
- Open: factory -> window opened in `root.layers.windows` -> `input.uiOpen = true` -> `deps.releasePointer()` ->
  `'ui:opened' { screen }` + sfx `ui_open`. `'pause'` also sets `input.paused = true` and emits `'game:paused' { paused: true }`.
- Close (X, Escape, outside tap, browser/Android back, E for any screen, L for the log, `'ui:close'`, `close()`):
  `screen.dispose()`, slot controller disposed, `input.uiOpen = false` (and paused false + `'game:paused'` for
  pause), `'ui:closed'` + sfx `ui_close`. E / L while a screen is open close it before the input layer sees them.
- Refresh: the open screen's `refresh()` at ~8 Hz, and on the next frame after `inventory:changed`, `item:made`,
  `furnace:*`, `machine:job/placed/removed`, `power:alert`, `objective:completed`, `time:phase`, a slot move, or
  `ctx.invalidate()`.
- Death (`'player:death'`): modal card (not closable by Escape / E / back / `'ui:close'`), cause, "your pack is safe",
  where you wake and at what health; Respawn calls `survival.respawn()`. Win (`'game:won'`): celebration, run
  stats, Keep playing (queued behind the death screen if both happen). Both set `uiOpen`, call `releasePointer`
  and emit `'ui:closed'` when dismissed, but no `'ui:opened'` (ScreenRequest has no member for them).
- `'player:respawn'` from anywhere closes the death screen.

## 2. Plugging in a screen (the 7.4b contract)

```ts
type ScreenFactory<R extends ScreenRequest = ScreenRequest> = (request: R, ctx: ScreenContext) => GameScreen | null;
interface GameScreen {
  readonly window: Window;   // built, NOT opened: GameUI opens it and watches it close (Window.whenClosed)
  refresh(): void;           // ~8 Hz + after events; update in place
  dispose(): void;           // once, after the window closed for any reason
}
interface ScreenContext {
  readonly request: ScreenRequest; readonly root: UIRoot; readonly bus: GameBus; readonly world: IWorld;
  readonly player: PlayerState; readonly clock: GameClock; readonly objectives: ObjectiveTracker; readonly survival: Survival;
  readonly sim: UISimQuery;        // getter: follows setSim
  readonly slots: SlotController;  // fresh per screen, disposed by GameUI (bindings, tooltips, ghost)
  invalidate(): void;              // refresh on the next frame
  close(): void;
}
```
Return null from the factory to refuse (nothing there any more). A throwing factory or refresh is caught and
logged. The 7.4b harness check (a furnace screen registered from outside, bag <-> firebox / crucible with the
simulation's accept rules, double-tap and action-bar moves, `'ui:close'`) passes in the browser.

## 3. Query interface (src/ui/hud/query.ts)

```ts
interface UIFurnaceState { tier: number; tempC: number; lit: boolean; ignited: boolean }
interface UINetworkStats { generationW; demandW; deliveredW; storedJ; capacityJ; satisfaction; overloaded }
interface UISimQuery {
  furnaceAt(x, y, z): UIFurnaceState | null;       // home compass
  allNetworks(): readonly UINetworkStats[];         // power strip (sampled at 2 Hz)
  stationSources(x, y, z): Inventory[];             // workbench: crates near it (player inventory filtered out)
}
const NO_UI_SIM: UISimQuery
```
`Simulation` satisfies it structurally (checked in the harness). Alerts come from `'power:alert'` on the bus.

## 4. Slot interaction (src/ui/screens/slots.ts)

Selection model (nothing ever "in the air"): tap a filled slot to PICK it (white outline, dimmed icon, valid
targets blink dashed, a ghost icon follows a mouse), tap another slot: drop / merge / swap (`moveStack`); a
target that refuses but holds something becomes the new pick; tap the picked slot again to put it back.
Long-press / right-click: with nothing picked = pick HALF; on the picked slot = toggle half, then cancel; on
another slot = drop ONE and keep the pick. Double-tap (a tap that picked, then the same slot within 380 ms),
double-click or shift-click = quick move. While picked, the action bar shows the stack and one "To <group>"
button per destination that accepts the item, plus a put-back button. Moves play `ui_click`, refusals `error`.
Hover / keyboard focus on a slot shows an item card (name, description, count, tool tier and uses, fuel burn
time and flame); touch has no tooltip (long-press is the half pick) - the action bar names the picked item.

```ts
class SlotInteraction {               // DOM-free rules (unit-tested); indices are inventory slot indices
  readonly groups: Map<string, Group>; picked: SlotPick | null;
  addGroup({ id, label, inventory, start?, size, quickTo? }): void; removeGroup(id): void
  primary(group, index): SlotOutcome; secondary(group, index): SlotOutcome; quickMove(group, index): SlotOutcome
  sendPicked(group): SlotOutcome; canDrop(group, index): boolean; validate(): void
  quickTargets(group): { group, inventory, start, end }[]
}
type SlotOutcome = 'none' | 'picked' | 'cancelled' | 'moved' | 'refused';
interface SlotPick { group: string; index: number; half: boolean }
type QuickTarget = string | { group: string; start: number; end: number };

class SlotController {
  constructor(bus: GameBus, ghostLayer?: HTMLElement | null, tooltip?: Tooltip | null)
  readonly logic: SlotInteraction
  bind(spec: SlotGroupSpec): SlotBinding   // takes over the ItemSlots' handlers (ItemSlot.setHandlers)
  refresh(): void                          // re-read inventories; only changed slots touch the DOM
  readonly picked: Readonly<SlotPick> | null
  cancel(): void
  readonly actionBar: HTMLDivElement       // GameUI docks it over the window footer unless you place it yourself
  onChange: (() => void) | null            // after every move (GameUI sets it to invalidate the screen)
  dispose(): void
}
interface SlotGroupSpec { id: string; label: string; inventory: Inventory; views: readonly ItemSlot[]; start?: number; quickTo?: readonly QuickTarget[] }
interface SlotBinding { unbind(): void }
```
Default `quickTo`: every group over ANOTHER inventory in binding order (accept rules decide where things land:
coal -> firebox, ore -> crucible); when there is none, the other groups over the same inventory (hotbar <-> backpack).
Do not put the action bar ABOVE slots yourself: it would push them down when it appears.

Stack views (src/ui/screens/inventory/slotViews.ts, re-exported from slots.ts):
`slotView(stack | null): SlotView | null` (tool wear as 0..1), `itemCard(stack): TooltipCard`.

## 5. Screens and reusable pieces

- `class InventoryPanel(slots: SlotController, inventory: Inventory, opts?: { id? = 'bag'; label? = 'Backpack'; quickTo? })`
  (src/ui/screens/inventory/inventoryPanel.ts): `el`, `pack: SlotGrid` (slots 9..35), `hotbar: SlotGrid` (0..8, marked
  with the heat colour), groups `<id>-pack` / `<id>-hotbar`, `dispose()`. Nine columns down to 32 px slots on narrow phones.
- `class HearthLogView(objectives: ObjectiveTracker)` (src/ui/screens/log/hearthLog.ts): `el`, `refresh()` - age strip,
  current goal card with progress and reward, next four goals, completed list. Embed it in the furnace LOG tab.
- `createCraftingScreen(ctx, { title, subtitle, listTitle, recipes, crates: () => Inventory[], note? }): GameScreen`
  (inventory/craftingScreen.ts): bag + recipe list. `slotHint()`, `SLOT_HINT_TOUCH`, `SLOT_HINT_MOUSE` for footers.
- `recipeRows(recipes, sources, destination): RecipeRowView[]`, `recipeRowView(recipe, sources, destination, counts)`,
  `makeRecipe(player, recipe, times, crates): CraftResult`, `nameOf(key)`, `BATCH = 5` (inventory/recipeRows.ts, DOM-free).
- Factories GameUI registers itself: `createInventoryScreen` ('inventory'), `createWorkbenchScreen` ('workbench'),
  `createLogScreen` ('log'); internal: `createDeathScreen(ctx, respawn)`, `wakeText(ctx)`, `createWinScreen(ctx)`.
- Shared screen CSS (styles.css section 13): `.hw-carry` (action bar), `.hw-slot-ghost`, `.hw-bag*`, `.hw-craft*`,
  `.hw-log*`, `.hw-death*`, `.hw-win*`.

## 6. HUD (src/ui/hud)

```ts
class Hud {   // created by GameUI; reach it as gameUI.hud
  frame(dt): void; setTarget(target, mining): void; setScreenOpen(open: boolean): void; refreshIcons(): void; dispose(): void
}
```
Parts: `Hotbar` (9 slots, counts, durability, selection, tap selects via `player.selectSlot`, name flash on change,
key numbers on desktop), `Vitals` (health, warmth with trend arrow, air only under water, Well-Warmed m:ss or
"Warming N s" while earning it), `Compass` (needle towards home relative to the view every frame, distance,
"640°" in the heat colour / "cold" / "gone"), `GoalTracker` (goal n of 37, title, progress, tap -> `'ui:open' log`),
`DayDial` (sun / moon on a day-night dial, day number, time to the next sunset / sunrise), `PowerStrip` (shown
once a network generates, consumes or stores: generation, demand marker, "uses X", stored, brown-out / overload),
`Crosshair` (mining ring 0..1 and the targeted block's name), `FeedView` (+N item lines, merged per item, 3.2 s),
`Vignettes` (red pulse on damage, frost below 30 warmth, amber while Well-Warmed), FPS when `settings.showFps`.
Toasts: every `'toast'` event, plus `'power:alert'` (except meltdown_warning, which the simulation toasts).
Banners: `'objective:completed'` (md, "Goal complete" + next goal; held until a screen closes, and the tracker's
matching "Done: ..." toast is dropped) and `'age:advanced'` (lg). CSS lives in `src/ui/hud/hud.css` (injected once).
DOM-free helpers (hudMath.ts, tested): `relativeBearing`, `wrapAngle`, `summarizeGrid` -> `GridSummary`,
`dayInfo`, `formatCountdown`, `frostLevel`, `GainFeed`. `BackGesture` (backGesture.ts): the back-closes-screen history guard.

Layout: phone portrait - goal across the top (left of the touch overlay's bag / pause buttons), vitals and the
compass / dial / power cluster on the second row, hotbar full width at the bottom, gain feed in the toast column.
Landscape phone - one row along the top (vitals, goal, cluster), hotbar in the bottom-centre 60% strip.
Desktop - vitals top left, goal top centre, cluster top right. `data-touch` (from `input.touch`) reserves 116 px
at the top right. Checked against the real touch overlay: no HUD element overlaps a touch control at 390x844 or 844x390.

## Wiring notes for integration (7.5)
```ts
const ui = new GameUI(root, { bus, input, settings, world, player, clock, objectives, survival, sim,
  releasePointer: () => inputManager.releasePointerCapture(), pause: { onSettingsChange, onQuit } });
ui.setIconProvider(createIconProvider());
// per frame: const intent = inputManager.frame(dt); if (intent.inventory) bus.emit('ui:open', { screen: { type: 'inventory' } });
//            intent.log -> { type: 'log' }; intent.pause -> { type: 'pause' }; ... ui.frame(dt);
// tee the controller's view: setTarget(t, m) { renderer.setTarget(t, m); ui.setTarget(t, m); }
// on 'ui:closed': inputManager.requestPointerCapture() (desktop) if appropriate.
```

## Deviations from the spec
- Slot interaction uses a pick-then-drop SELECTION model instead of carrying the stack on the cursor: nothing
  can be lost or stranded when a screen closes or a machine changes a slot. On desktop a ghost icon follows
  the mouse, so it still feels like carrying.
- Death and win screens are not ScreenRequest types (the union is fixed in core), so they emit no `'ui:opened'`.
- `GameUIDeps` adds `releasePointer` (the input layer treats an unexpected pointer unlock as a pause request, so
  the UI must not call `document.exitPointerLock()` itself) and `pause`.
- Recipe variants with the same output (planks from oak or pine, torches from charcoal or coal) share one row.
- Kit changes made for this module: `ItemSlot.setHandlers`, `Window.whenClosed`, `PauseMenu.window`, glyphs
  (heart, air, home, needle, sun, moon, up, down, chevron), long-press echo window fixed in `bindPress`
  (a real tap 0.4 s after a long-press was swallowed), objective (md) banners are a centred plate.

## Known gaps
- No node test drives GameUI / the HUD DOM (vitest runs in node without a DOM); they are verified by the browser
  harness flows (touch on 390x844 and mouse on 1280x800: pick, drop, swap, half, one, merge, double-tap /
  shift-click, action bar, make, close by X / Escape / E / L / back, hotbar tap, workbench with a crate, death and
  respawn, pause / resume) and by screenshots at all three sizes.
- Banners use the kit's queue: a cascade of several completed goals shows them one after another (3 s each).
- Touch has no item tooltip; item descriptions are only visible on desktop (hover / focus).
- `src/ui/screens/slots.ts` is about 380 lines (rules + controller), a little above the 350-line aim.
