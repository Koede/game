# Tech UI (src/ui) - the STRUCTURE tab, the pipe screen, fluid tanks on machine screens

> **Numbering note (BRONZE_PLAN W0, done):** furnace tiers and ages below that were written for five tiers are now six: tier 2 is the single-block Bronze Furnace, so the old tiers 2-5 are 3-6 and the old ages 1-4 are 2-5 (`docs/api/ages.md`). A furnace without a formed hearth runs as the Bronze Furnace (tier 2), not the Clay Furnace.


Spec 16.3 (pipe screen) and 17.4 (STRUCTURE tab, problem highlight, ghost preview), on the simulation views of
`docs/api/hearth.md` (`structureView`) and `docs/api/transport.md` (`pipeView`, `setPort`, `MachineView.fluids`), built on
the kit, GameUI's `registerScreen` and the station screens of `docs/api/furnace-screens.md`. The UI only ASKS for world
overlays (`'ghost:show'`, `'ghost:clear'`, `'highlight:block'`); `src/render/tech` draws them.

Tests: `npx vitest run src/ui` - `furnace/structureLogic.test.ts` (9), `pipe/pipeText.test.ts` (5),
`machines/fluidText.test.ts` (3), all against real simulation views (`src/sim/testKit`, `pipeKit`).

## Wiring

**None new.** `registerStationScreens(gameUI, sim)` (already called by `src/app/game.ts`) now also registers `'pipe'`.
The player module opens it on Use with an empty hand on a pipe (`{ type: 'pipe', x, y, z }`). `ScreenSim`
(`src/ui/screens/furnace/simApi.ts`) gained three members with `Simulation`'s exact signatures - `structureView(x, y, z,
target?)`, `pipeView(x, y, z)`, `setPort(x, y, z, dir, change)` - so `Simulation` still satisfies it as is.

## Files

| file | what |
|---|---|
| `screens/furnace/structureTab.ts` | `StructureTab` - the tab's DOM |
| `screens/furnace/structureText.ts` | DOM-free: ghost payload, checklist / material / tier wording, problem groups, tier-1 intro |
| `screens/furnace/hearthGhost.ts` | `HearthGhost` / `ghostFor` - the ghost preview that outlives the screen |
| `screens/furnace/structure.css` | the tab, the stepper, five tabs on phones, the folded firebox |
| `screens/pipe/pipeScreen.ts` | `createPipeScreen` |
| `screens/pipe/portRow.ts` | `PortRow` - one end: mode, status, settings fold, filter picker |
| `screens/pipe/pipeText.ts` | DOM-free: tones, summaries, filter edits, choices, priority text, nearest ports |
| `screens/pipe/pipe.css` | the pipe screen and the machine screens' fluid tanks |
| `screens/machines/fluidTanks.ts`, `fluidText.ts` | `FluidTanks` widget and its DOM-free rows |
| `screens/stepper.ts` | `Stepper` - [−] value [+] with 44 px targets |

Changed: `furnace/furnaceScreen.ts` (tab, badge, 4 Hz structure refresh), `furnace/upgrade.ts` ("Plan the hearth"),
`furnace/index.ts` (registers 'pipe'), `furnace/simApi.ts`, `furnace/styles.ts` (injects the two new CSS files),
`machines/machineScreen.ts`, `machines/machinePanel.ts`, `machines/machineText.ts` (layouts `tank`, `boiler`, `part`).

## Public API

### STRUCTURE tab (furnace screen, tab id `'structure'`, between Forge and Grid)
```ts
class StructureTab {
  constructor(opts: { sim: StructureSource; pos: { x, y, z }; bus: GameBus; ghost: HearthGhost; changed: () => void })
  readonly el: HTMLElement
  update(): void      // one structureView (with the keeper's target for this furnace) -> DOM, writing only what changed
  dispose(): void
}
interface StructureSource { structureView(x, y, z, target?: StructureTarget): StructureView | null }
```
- Status chip (`view.status`, tone good / warn / neutral) and one line on what the hearth means for the furnace
  ("Until its Blast hearth forms, the Blast Furnace runs like a Clay Furnace: 800 °C at most.").
- Tier 1 (`controllerTier === 1`): a "What is a hearth?" card - the hollow box, the furnace set in a wall with its front
  out, the Blast hearth as brick walls around it, the brick recipe read from the registry ("Forge Brick here at 400 °C
  from 4 Firebrick."), and a pointer to "Show in world".
- Checklist chips with tick / cross and counts ("Floor 24/25", "Walls 30/31", "Inside: 1 block in the way",
  "Electrodes 0/1", "Power ports 0/2").
- Problems in the simulation's words; identical texts fold into one row with "×6". Tapping a row emits
  `'highlight:block' { x, y, z, seconds: HEARTH_HIGHLIGHT_S }` for its block (taps cycle through a folded row's blocks),
  closes nothing, and shows "Shown in the world" (or "... - 2 of 6") under it for 1.8 s.
- Plan: tier picker (Blast / Arc / Plasma / Star), Across / Deep / High steppers bounded by the tier's `minInner` /
  `maxInner`, the tier's rules in one line, the **Show in world** switch with a legend, and the materials (icon, name,
  "54/56 placed", "Have 6 / need 2" in warn when short, good when all placed).
- Badge `!` on the tab while the furnace runs below its own tier for want of its hearth (`structureBadge`).
- The furnace screen refreshes the tab at most every 240 ms (and at once when it opens or after a tap).
- Upgrade sheet: while `UpgradeView.structureOk === false` it shows **Plan the hearth** (sub "Structure tab"), which
  closes the sheet, sets the plan to the next tier and opens the Structure tab.

### Ghost preview keeper (src/ui/screens/furnace/hearthGhost.ts, DOM-free)
```ts
class HearthGhost {
  constructor(bus: GameBus, sim: StructureSource)
  isShown(x, y, z): boolean
  target(x, y, z): StructureTarget | undefined            // the player's last choice for this furnace (session only)
  choose(x, y, z, target: StructureTarget): void           // remembers it; a preview that is on: 'ghost:clear' then 'ghost:show' for it
  show(x, y, z, target: StructureTarget): boolean          // 'ghost:show' { key: 'hearth:x,y,z', cells }; false = nothing to show
  hide(x, y, z): void                                      // 'ghost:clear' { key }
}
function ghostFor(bus: GameBus, sim: StructureSource): HearthGhost   // one keeper per game (bus), made by the first furnace screen
```
- Cells: every `structureView(...).target.cells` entry that is not `ok`, as `{ x, y, z, block: want, state }`
  (`'missing'` blue, `'wrong'` red; inside clutter is `block: 'air'`, `'wrong'`).
- While shown it follows the world: a block change inside the plan's box re-emits `'ghost:show'` once per burst (a
  microtask after the simulation's own listener), with the size the simulation fitted pinned so the plan does not jump.
- It goes away (`'ghost:clear'`) when turned off, when `'hearth:formed'` reaches the target tier at that furnace, when
  every cell is in place, or when the furnace is removed. It stays while the screen is closed.

### Pipe screen
```ts
function createPipeScreen(request: { x, y, z }, ctx: ScreenContext, sim: ScreenSim): GameScreen | null  // null: no pipe there
class PortRow { constructor(port: PortView, deps: PortRowDeps, expanded: boolean, onExpand: (open: boolean) => void); el; update(port); dispose() }
interface PortRowDeps { family: 'item' | 'fluid'; pack: () => readonly Slot[]; change(port, change: PortChange): void; locate(port): void }
```
- Title = the pipe's name, subtitle "Item line - 6 pipes, 3 ends" / "Hot fluid line - ...", accent heat (items) or power
  (fluids). A line panel: "1 bundle moving (4 items)" / "Water - 1,210 of 3,000 L" / "Water flowing through - none held
  (room for 1,250 L)" / "Empty - holds up to 500 L", a fill bar in the fluid's colour, and the network's warnings plus
  open joints ("Parted with the wrench").
- One row per end, nearest first (the nearest 8, then "Show N more ends"): the block's icon, name and distance
  (tap: `'highlight:block'` for 6 s on that block, "Shown in the world"), the status line toned (moving good, idle
  neutral, a reason to act warn, Blocked / Too hot / Network too long bad), Push / Pull / Off, and **Settings** with a
  one-line summary ("Nearest · Only Copper Ore and Tin Ore · +1"). The fold: Distribution Nearest / Round (item lines
  only), up to 5 filter slots (filled ones plus one "+"; tap a slot, then pick from the pack's distinct items - icon and
  name - or, on a fluid line, one of the five fluids as colour swatches; "Empty slot" removes it; chosen entries are
  marked), Allow / Deny, "Lets through all but Coal.", and the priority stepper −2..+2 with what it means.
- Every change goes through `sim.setPort`; success plays `pipe_clunk` at the pipe, a refusal toasts the reason and plays
  `error`. Refreshes about 4 times a second (and at once after a change); rows are keyed by pipe + side and updated in
  place; their fold state survives refreshes. Closes itself when the pipe is gone. Desktop: anchored at the top.

### Machine screens with fluids
```ts
class FluidTanks { constructor(kind: string); el; update(view: MachineFluidView): void }
function tankRows(kind: string, f: MachineFluidView): TankRow[]   // a tank stack as one row, else 'in' / 'out'
function flowText(kind: string, f: MachineFluidView): string      // "Pumping 200 L/s", "Boiling 400 L of steam a second", "Using 800 L/s", ''
function fluidList(keys): string; const fluidColour: (key: FluidKey) => string
interface TankRow { id: 'in' | 'out' | 'stack'; label; fluid; colour: string | null; glow; litres; capacityL; text }
```
- Every machine whose view has `fluids` (pump, tank, boiler, steam turbine, steam engine, still, combustion engine,
  electrolyzer, fission pile, geothermal tap, fluid hatch) shows a **Fluids** block under its status: a swatch and a
  bar in the fluid's colour per buffer - "In: Water 375 / 1,000 L", "Out: empty - gives Steam", a tank stack as
  "Water 20,000 / 32,000 L" - and the flow line.
- `machineLayout` adds `tank` (headline "Holds 2,500 L", "of 32,000 L (2 tanks)"), `boiler` ("Steam 400 L/s", "from the
  furnace below - 1 L of water makes 10 L") and `part` (hearth parts: no headline figure, the description).
- The backpack appears only beside machines with slots, the power network panel only for blocks on cables
  (`power: 'device'`), and the on/off switch not on tanks and hearth parts. Role subtitles: Steam, Fluid storage, Hearth part.

### Shared
`class Stepper({ label, min, max, value, format?, onChange })` - `el`, `value`, `set(value, min?, max?)` (silent); the
buttons say `aria-disabled` at the ends; a fixed range hides them.

DOM-free helpers (all tested): `structureText.ts` - `ghostKey`, `ghostCells`, `checkText`, `tierShort`, `AXIS_LABEL`,
`innerBounds`, `sizeText`, `tierRules`, `materialTexts`, `statusTone`, `effectText`, `structureBadge`, `wallSource`,
`hearthIntro`, `groupProblems`; `pipeText.ts` - `NEAR_PORTS`, `portKey`, `portTone`, `keyName`, `filterSummary`,
`setFilterSlot`, `filterChoices`, `priorityText`, `priorityNote`, `lineSummary`, `contentText`, `MODE_HELP`,
`nearPorts`, `distanceText`.

### Phone pass fixes
- STRUCTURE tab: when a hearth stands and the plan is a higher tier (`view.formed && target.tier > view.tier`), the
  tab shows "<Hearth> - standing" with that hearth's own checklist (a second `structureView` with
  `{ tier: view.tier, inner: view.inner }`), then a "Next: Arc hearth - n to build" button. The next tier's checklist
  and list ("To build (n)", neutral colours, `.hw-st[data-ahead]`) stay folded until the player taps it or picks a
  tier in the Plan picker.
- Pipe screen: `pullAdvice(ports)` - with no end pulling, the content line says "No end is pulling - set the end you
  take from to Pull" (warn) and the likeliest source end (crate or pump, then a machine, the furnace last) gets
  `PortRow.setAttention(true)`: its Pull option is outlined and pulses. `pipeFooter(touch)` words the footer with
  "Tap" or "Click" (`ScreenContext.touch`).
- Machine fluids: `tankRows(kind, view, waterBeside)` and `usesWaterBeside(view)` - a machine with a water-nearby rule
  (params.minWater) that has no placement problem and nothing piped in shows "In: the water beside it" (full water
  bar) instead of "In: empty - takes Water". Tank labels are normal case and wrap to two lines; figures and units
  are joined with non-breaking spaces.

## Verification
- Harness (scratch `ui-tech/`): real `Simulation`, `PlayerState`, `GameClock`, `Survival`, `ObjectiveTracker` on the
  FakeWorld, the real GameUI + station screens + touch overlay + item icons. Screenshots at 390x844, 844x390 and
  1280x800, all looked at: clay furnace with half a hearth (intro, plan), Blast Furnace unformed with problems, formed
  3x3x2, Arc hearth with the Plasma plan and the ghost on, upgrade sheet with Plan the hearth, an item line with three
  ends (closed, and a fold open with the picker), a fluid line (closed, fluid picker open), tank, pump, boiler and
  turbine screens. An automated check found no text overflow or anything off-screen.
- Touch flows (Playwright taps at 390x844 and 844x390, clicks at 1280x800), all passing: tap the Structure tab, tap a
  problem (`highlight:block`, hint, screen stays), pick Plasma, widen with the stepper, Show in world (`ghost:show`),
  pick Blast (clear + show), close (ghost stays), place a block (ghost updates), complete the shell (forms, ghost
  cleared, toggle off, "Formed - Blast hearth 3x3x2"); upgrade sheet -> Plan the hearth -> Structure tab on Arc; pipe
  screen: Off, open settings, + then Coal, Deny, priority to +2 (+ disabled), Round, Empty slot, tap a name (highlight).
- Real built game (desktop, portrait and landscape phone): real Use opens the furnace; Structure tab, problem tap,
  High +, Show in world, then in the world the renderer draws the blue ghost cubes of the missing top course and the red
  outline on the problem block; completing the shell forms it (seams glow, toast, ghost gone); Use on a pipe with an
  empty hand opens the pipe screen (3 ends, filter set by taps); a pump -> pipes -> 2 stacked tanks line's pipe screen
  and tank screen ("Water", 2,500 of 32,000 L). No page errors.

## Deviations and decisions
- **The firebox folds on portrait phones while the Structure tab is open** (to its status line): with the firebox
  shown in full a tier-3 furnace left ~250 px for building plans. Landscape phones and desktop keep it whole.
- Choosing another target while the ghost is on keeps it on for the new target (`'ghost:clear'` then `'ghost:show'`),
  rather than switching it off - so the steppers can be used while watching the plan.
- The ghost follows the world while it is shown (not a snapshot), and also goes when every cell is in place.
- Problems with identical words are folded into one row ("Wall is not Plasma Casing ×6"); taps cycle their blocks.
- The pipe screen lists the nearest 8 ends first ("near you"), the rest behind "Show N more ends".
- Item filters are picked from the pack only (the brief), so an item must be carried to be filtered.
- Machine screens without slots drop the backpack; machines not on cables drop the network panel; tanks and hearth
  parts have no on/off switch.

## Known gaps
- The pump's "Full - connect a pipe that pulls" (src/sim/fluidMachines.ts) is still said when a pulling pipe is
  attached but the line downstream is full; the wording belongs to the simulation.
- A shown ghost can only be dismissed from the furnace's Structure tab (or by forming the hearth); there is no HUD
  control for it away from the furnace. Ghost state is per session (not saved).
- Touch has no item card in the filter slots; their names are in the summary line and the picker.
- The tab's status line partly repeats the firebox status on phones (both say the hearth is missing; the tab adds the
  temperature cap).
