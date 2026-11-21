# src/ui/hud, src/ui/gameUI.ts, src/ui/screens (7.4a) - public API

STATUS: contract published first so the furnace / machine screens (7.4b) can be built against it. Every
signature below is what the code implements; the "Implementation notes" section at the end is filled in when
the module is finished.

## 1. GameUI (src/ui/gameUI.ts)

```ts
class GameUI {
  constructor(root: UIRoot, deps: GameUIDeps)
  /** Call once per animation frame, ALSO while paused: HUD readouts, coalesced screen refreshes (~8 Hz). */
  frame(dt: number): void
  /** Same signature as IView.setTarget: tee the controller's call here for the target name and mining ring. */
  setTarget(target: { x: number; y: number; z: number } | null, mining: number): void
  /** Adds (or replaces) the factory for one ScreenRequest type. Works before or after construction of screens. */
  registerScreen<T extends ScreenRequest['type']>(type: T, factory: ScreenFactory<Extract<ScreenRequest, { type: T }>>): void
  /** Same as emitting 'ui:open' / 'ui:close' on the bus. */
  open(request: ScreenRequest): boolean      // false when no factory or the factory refused (returned null)
  close(): void
  /** The request of the open screen (null when none, or when the death / win screen is up). */
  readonly current: ScreenRequest | null
  readonly isOpen: boolean                  // any screen, including death / win
  readonly hud: Hud
  /** Swap the simulation query later (the simulation may be created after the UI). */
  setSim(sim: UISimQuery): void
  /** Installs the renderer's item icons (kit setIconProvider) and refreshes visible icons. */
  setIconProvider(provider: IconProvider | null): void
  dispose(): void
}

interface GameUIDeps {
  bus: GameBus;
  input: InputState;          // GameUI writes uiOpen (and paused for the 'pause' screen)
  settings: Settings;         // read by reference: showFps
  world: IWorld;              // block names for the crosshair target
  player: PlayerState;
  clock: GameClock;
  objectives: ObjectiveTracker;
  survival: Survival;
  sim?: UISimQuery;           // default NO_UI_SIM (everything empty)
  /** When given, GameUI registers the 'pause' screen itself (kit PauseMenu). */
  pause?: { onSettingsChange(settings: Settings, key: keyof Settings): void; onQuit(): void };
}
```

Behaviour:
- Listens to `'ui:open'` and `'ui:close'`. One screen at a time: opening another closes the current one first.
- Opening: factory -> `window.open(root.layers.windows)` -> `input.uiOpen = true` -> `document.exitPointerLock()`
  (guarded) -> emits `'ui:opened' { screen }` and sfx `ui_open`. A 'pause' screen also sets `input.paused = true`
  and emits `'game:paused' { paused: true }`.
- Closing (close button, Escape, outside tap, Android/browser back, E for any screen, L for the log, `'ui:close'`,
  `close()`): `screen.dispose()`, `input.uiOpen = false` (and `paused = false` + `'game:paused' { paused: false }`
  for pause), emits `'ui:closed'` and sfx `ui_close`.
- Refresh: the open screen's `refresh()` runs about 8 times per second, plus on the next frame after
  `inventory:changed`, `item:made`, `furnace:*`, `machine:*`, `power:alert`, `objective:completed`, `time:phase`.
- Death and win screens are internal (not ScreenRequest types): opened on `'player:death'` / `'game:won'`,
  set `input.uiOpen`, release pointer lock, emit `'ui:closed'` when dismissed (no `'ui:opened'`, because
  ScreenRequest has no member for them). Respawn calls `survival.respawn()`.

## 2. Plugging in a screen (the 7.4b contract)

```ts
type ScreenFactory<R extends ScreenRequest = ScreenRequest> = (request: R, ctx: ScreenContext) => GameScreen | null;

interface GameScreen {
  /** Built by the factory, NOT opened: GameUI opens it in the windows layer and watches it close. */
  readonly window: Window;
  /** ~8 Hz while open and after relevant events. Update in place; never rebuild unchanged DOM. */
  refresh(): void;
  /** Once, after the window closed (for any reason). Release listeners, timers, observers. */
  dispose(): void;
}

interface ScreenContext {
  readonly request: ScreenRequest;
  readonly root: UIRoot;
  readonly bus: GameBus;
  readonly world: IWorld;
  readonly player: PlayerState;
  readonly clock: GameClock;
  readonly objectives: ObjectiveTracker;
  readonly survival: Survival;
  /** Current simulation query (a getter: follows setSim). Cast/extend in your own module for richer calls. */
  readonly sim: UISimQuery;
  /** A fresh slot-interaction controller for this screen; GameUI disposes it on close. */
  readonly slots: SlotController;
  /** Ask for a refresh on the next frame (after an action button, for instance). */
  invalidate(): void;
  /** Close this screen. */
  close(): void;
}
```

Usage from src/ui/screens/furnace (the furnace engineer's code, not mine):

```ts
gameUI.registerScreen('furnace', (req, ctx) => {
  const slots = sim.furnaceSlots(req.x, req.y, req.z);   // your own sim handle, passed to your factory
  if (!slots) return null;                               // refuse: nothing there any more
  const win = new Window({ title: 'Clay Furnace', size: 'lg', fit: 'tall', scroll: false, tabs: [...] });
  const fuel = new SlotGrid({ count: slots.fuel.size, label: 'Fuel' });
  ctx.slots.bind({ id: 'fuel', label: 'Firebox', inventory: slots.fuel, views: fuel.slots });
  const bag = new InventoryPanel(ctx.slots, ctx.player.inventory);   // the player's 36 slots, hotbar marked
  return { window: win, refresh: () => { ctx.slots.refresh(); /* readouts */ }, dispose: () => fuel.dispose() };
});
```

## 3. The query interface the UI needs from the simulation (src/ui/hud/query.ts)

The UI never imports src/sim. `Simulation` satisfies this interface structurally, so main.ts passes it as is.

```ts
interface UIFurnaceState { tier: number; tempC: number; lit: boolean; ignited: boolean }
interface UINetworkStats {
  generationW: number; demandW: number; deliveredW: number; storedJ: number; capacityJ: number;
  satisfaction: number; overloaded: boolean;
}
interface UISimQuery {
  furnaceAt(x: number, y: number, z: number): UIFurnaceState | null;  // home compass: temp / tier / hot
  allNetworks(): readonly UINetworkStats[];                           // power strip, brown-out / overload state
  stationSources(x: number, y: number, z: number): Inventory[];        // player inventory + crates near a station
}
const NO_UI_SIM: UISimQuery;   // no furnaces, no networks, sources = [] (screens then use the player inventory)
```

Alerts: the HUD listens to `'power:alert'` itself (toast + strip state); nothing more is needed from the query.

## 4. Slot interaction (src/ui/screens/slots.ts) - identical on every screen

Selection model (nothing is ever "in the air", so nothing can be lost when a screen closes or a machine
changes a slot underneath): tap a filled slot to pick it (highlighted, a floating icon follows a mouse),
tap another slot to drop / merge / swap (`moveStack`); tap the picked slot again to put it back.
Right-click / long-press a filled slot with nothing picked = pick HALF (`moveHalf` on drop); with something
picked, right-click / long-press another slot = drop ONE (`moveOne`) and keep the pick. Double-tap /
double-click / shift-click = quick move to the screen's other inventory. While something is picked, the
controller's action bar offers "Move to <group>" buttons (touch has no shift key) and Cancel. Valid drop
targets are highlighted using the inventories' accept rules; refused drops play sfx `error`.

```ts
class SlotController {
  constructor(bus: GameBus)
  /** Shows inventory slots [start, start + views.length) in these ItemSlots and makes them interactive. */
  bind(spec: SlotGroupSpec): SlotBinding
  /** Re-reads every bound inventory and updates only the slots that changed (call from GameScreen.refresh). */
  refresh(): void
  readonly picked: { group: string; index: number; half: boolean } | null
  /** Clears the pick (e.g. when the tab with the picked slot is hidden). */
  cancel(): void
  /** A bar to place in your layout: picked item, "Move to ..." buttons, Cancel. Hidden while nothing is picked. */
  readonly actionBar: HTMLElement
  dispose(): void
}
interface SlotGroupSpec {
  id: string;                    // unique within the controller
  label: string;                 // used in "Move to <label>"
  inventory: Inventory;          // player inventory, or a machine's Inventory view from the simulation
  views: readonly ItemSlot[];    // e.g. new SlotGrid({...}).slots
  start?: number;                // first inventory slot shown by views[0] (default 0)
  /** Where quick move sends a stack from this group, in priority order (group ids, or ranges in one inventory). */
  quickTo?: readonly (string | { group: string; start: number; end: number })[];
}
interface SlotBinding { unbind(): void }
```

Ready-made pieces screens can reuse (src/ui/screens/inventory):
- `class InventoryPanel { constructor(slots: SlotController, inventory: Inventory, opts?: { id?: string; label?: string; quickTo?: SlotGroupSpec['quickTo'] }); readonly el: HTMLElement; dispose(): void }`
  The player's 36 slots: backpack (9..35) above the marked hotbar row (0..8), bound as groups `<id>-pack` and
  `<id>-hotbar` (default id `bag`); with no quickTo, quick move swaps between hotbar and backpack.
- `class HearthLogView { constructor(objectives: ObjectiveTracker); readonly el: HTMLElement; refresh(): void }`
  (src/ui/screens/log) - the furnace LOG tab can embed it.
