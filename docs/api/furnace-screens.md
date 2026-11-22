# src/ui/screens/furnace and src/ui/screens/machines (7.4b) - public API

> **Numbering note (BRONZE_PLAN W0, done):** furnace tiers and ages below that were written for five tiers are now six: tier 2 is the single-block Bronze Furnace, so the old tiers 2-5 are 3-6 and the old ages 1-4 are 2-5 (`docs/api/ages.md`). A furnace without a formed hearth runs as the Bronze Furnace (tier 2), not the Clay Furnace.


The furnace screen (the game's main screen), every machine screen and the crate. Built on the UI kit, GameUI's
`registerScreen` contract and its slot controller (docs/api/hud.md). Reads the simulation through `ScreenSim`
(types only; `Simulation` satisfies it as is). CSS ships with the module (`furnace.css`, `furnaceTabs.css`,
`machines.css`, injected once as `<style id="hw-station-css">`) and uses only the kit's `--hw-*` tokens.

Tests: `npx vitest run src/ui/screens/furnace src/ui/screens/machines` (18 tests, DOM-free logic against real
simulation views from `src/sim/testKit`).

> **Tech UI (spec 16.3, 17.4):** the furnace screen now has a STRUCTURE tab (between Forge and Grid), the upgrade sheet
> a "Plan the hearth" button, machine screens fluid tanks (and layouts `tank`, `boiler`, `part`), and
> `registerStationScreens` also registers the `'pipe'` screen. `ScreenSim` gained `structureView`, `pipeView`, `setPort`.
> See `docs/api/ui-tech.md`.

## Wiring (integration, 7.5) - one line in main.ts

```ts
import { registerStationScreens } from './ui/screens/furnace';
registerStationScreens(gameUI, sim);   // after both exist; sim = the Simulation
```

GameUI then opens the screens on `'ui:open'` `{ type: 'furnace' | 'machine' | 'crate', x, y, z }`. A `'machine'`
request on a furnace block opens the furnace screen, and on a crate the crate screen, so the player module may
send `'machine'` for every machine block. Opening the furnace screen emits `'ui:opened'` (GameUI), which makes it
home (src/sim). GameUI was not edited.

## Exports

`src/ui/screens/furnace/index.ts`
- `registerStationScreens(ui: Pick<GameUI, 'registerScreen'>, sim: ScreenSim): void` - registers 'furnace',
  'machine' and 'crate'.
- `createFurnaceScreen(request: { x, y, z }, ctx: ScreenContext, sim: ScreenSim): GameScreen | null` - null when no
  furnace stands there (GameUI then opens nothing).
- `interface ScreenSim` (simApi.ts) - `furnaceView`, `furnaceSlots`, `light`, `douse`, `pump`, `setElectric`,
  `forge`, `upgrade`, `startIgnition`, `rest`, `networkAt`, `machineView`, `machineSlots`, `setMachineOn`,
  `stationSources`, with the exact signatures of `Simulation`. `pretty(text)` turns the simulation's "700 C" into
  "700 °C".

`src/ui/screens/machines/index.ts`
- `createMachineScreen(request, ctx, sim): GameScreen | null`, `createCrateScreen(request, ctx, sim): GameScreen | null`
- `machineLayout(kind, role): MachineLayout` - `'generator' | 'burner' | 'processor' | 'consumer' | 'storage' |
  'bore' | 'fission' | 'crate'`.
- `class NetworkPanel({ compact?, emptyText? })` - `update(net: NetworkStats | null, alone?)`, `setEmptyText`,
  `dispose`. Generation / demand / stored, 60 s sparkline (G and used), supplied and cable-load meters, alert line,
  member list (not when compact).

DOM-free helpers (unit-tested): `forgeRows.ts` (`forgeCategory`, `forgeRowView(s)`, `SMELT_CATEGORIES`, `smeltCategory`, `forgeAvailable`,
`forgeReady`, `forgeShortfall`, `smeltRowView(s)`, `FORGE_CATEGORIES`), `furnaceText.ts` (`thermoNotches`,
`statusTone`, `flameLook`, `burnText`, `burnFraction`, `upgradeProgress`, `sourceText`, `bestFuelSlot`, `slotOf`,
`clockText`, `shortName`, `IGNITION_TEMP_C`), `machineText.ts` (`alertText`, `cableText`, `memberWatts`,
`lonelyFurnaceText`, `headline`, `subline`, `fuelText`, `machineTone`).

## The furnace screen

- Header: tier name, "Age - tier n of 5 - home", accent strip in the colour of the fire. **Upgrade** button with
  "have/need materials", glowing (brightness pulse) when affordable; it opens the upgrade sheet: what the next tier
  brings (table now/next), every material as a have/need chip, where each missing one comes from ("forge it here at
  800 °C", "make it at the workbench", "made by the Crusher"), the temperature check, and a hold-to-upgrade
  (700 ms) button that says what is missing. Escape closes the sheet first. "Final tier" at the Starhearth.
- FIREBOX panel, always visible: kit Thermometer on the heat ramp (0..tier max) with notches for loaded crucibles,
  the recipe last touched in FORGE, the upgrade temperature, "Ignite" (3000) at tier 5 and the flame (or electric)
  ceiling as a dashed limit; trend caption ("Rising 3.2 °C/s"). Live pixel flame (canvas, 36x22 cells, ~16 steps/s):
  height follows draft, colours follow the flame temperature; embers when hot and unlit, glowing elements on
  electric heat, a white star once ignited; pumping throws sparks. Fuel slots (bound as group `fuel`), "Add fuel"
  (about two minutes of the best fuel per tap - see "Phone pass" below), burn bar with the burning item and its
  time left. Light / Douse (one button). PUMP (large; sparks, a kick animation, a short vibration on phones, the
  flame notch and draft readout jump; the simulation plays the bellows sound; P on a keyboard). Electric heating
  switch with delivered watts and satisfaction (tier 3+). A readings list (flame, heading for, tier maximum, heat
  to machines) where there is room. The one-line status (the simulation's, toned: warn / bad / heat / power /
  good). "Rest until dawn" at night, disabled with the simulation's reason when not allowed.
- Tabs (no window panels; the screen swaps its own panes so the firebox stays):
  - SMELT: one row per crucible (input slot, recipe, required-temperature badge, progress meter with time left,
    output slot; groups `cru-in`, `cru-out`), then "What the crucibles take": every smelt recipe as a kit
    RecipeRow with heat and time badges, have/need and a **Load** button (moves a stack from the pack or a nearby
    crate into the crucibles and scrolls back to them). Routes to the same product show only the ones the player
    holds input for. Chips Kitchen / Materials / Fuel (food rows carry "+N food"; see `docs/api/food-ui.md`).
    Badge: "n done".
  - FORGE: kit RecipeList of every forge recipe in tech-tree order, category chips Kitchen / Tools / Parts /
    Machines / Power / Building with ready counts (stew variants: only those the player can make, else the closest), heat badge, locked rows with the furnace that unlocks them, have/need
    chips, Forge and ×N (N = min(5, ingredients, heat allows)). Refusals and short batches are toasted. Badge:
    recipes forgeable now.
  - GRID: the furnace's network (NetworkPanel), or an explanation of how to get power at this tier; at tier 5
    the ignition panel above it (conditions, hold-to-ignite 900 ms, progress with seconds left, failure text). The grid
    conditions come from `FurnaceView.ignition.power`, each its own badge: "Supply 66.3 kW + 3 kW storage - needs 327 kW",
    "Cable limit 120 kW - needs 327 kW: lay super cable" (or "Cables carry 2 MW"; hidden without cables), "Storage 1.18
    MJ - lasts 4 s of 90 s" (only when generation alone falls short); a red badge adds "As the grid stands now, it would
    fail." to the intro. The button stays disabled while the cable cannot carry it (the sim refuses that start).
    Badge "!" on brown-out or overload.
  - LOG: the Hearth Log view of 7.4a.
- Backpack: side column at >= 1100 x 600; elsewhere a drawer with a handle (on phones a corner button, see below) ("Backpack 13/36", B on a keyboard)
  over the tab column (portrait: from the bottom edge). The drawer state is remembered for the session. Quick
  move from the pack goes to the firebox first, or the crucibles first on the SMELT tab; from the furnace's slots
  to the pack (hotbar first). The slot controller's carry bar sits on the drawer (below the bag, or on top of the
  bottom-anchored phone drawer) so it never moves a slot from under the finger between two taps.
- Refresh: GameUI's ~8 Hz `refresh()` builds one `furnaceView` (plus `networkAt` for the GRID badge and pane);
  only the visible tab pane is updated, everything writes the DOM only on change. A furnace upgrade rebinds the
  fuel and crucible slots in place. The screen closes itself when the furnace disappears.

### Phone pass (review fixes)
- **Compact layout** (`.hw-fx[data-compact]`, set from `matchMedia('(pointer: coarse) and (max-width: 499.98px),
  (pointer: coarse) and (max-height: 519.98px)')`, CSS in `furnaceCompact.css`): on every tab the firebox folds to a
  strip - temperature, a small flame, the fuel slots, Pump (Light while unlit), the status and the fuel hint; a tap on
  the temperature, the flame or the chevron unfolds the whole panel (`FireboxPanel.setOpen`, remembered for the
  session). Portrait: the strip runs across the top. Landscape: a 118 px rail at the left. The backpack handle is a
  corner button (bag glyph and count) while closed; panes keep 60 px of bottom padding so nothing hides under it.
  The upgrade sheet's footer is one row in landscape, and its scroll area stops 28 px clear of the footer.
- **Add fuel** loads about two minutes of burn per tap (`fuelLoadCount`), never the whole stack. `bestFuelSlot(slots,
  { spareSmeltable, maxTempC })`: real fuels first (the coolest that still reaches the furnace's top temperature,
  else the hottest), then sticks, planks, and logs last; while the goal is "Bake charcoal" logs are skipped unless
  nothing else burns.
- **Fuel advice** (`fuelText.ts`): `fuelQueueHint(burnItem, fuelSlots)` - "Coke waits behind 6 Charcoal - take the
  charcoal out to burn hotter" under the status; `heatRoute(needC, electric)` - forge rows too cold (tier allows them)
  say how to get there: "Needs 1400 °C - coke, or coal with the bellows".
- **Upgrade sheet** (`upgradeText.ts`): crucibles from the hearth rule (`crucibleText`: "2 - up to 6", or "5 (this
  hearth)" when one of that tier stands; "Now" is the crucibles working today); the hold button says "Hearth not
  built" first, then "Materials missing", then "Too cold" (`upgradeBlock`); the header button says "Build the hearth"
  when only the hearth is missing (`upgradeSub`).
- SMELT badge: the number of finished crucibles in green ("1"; "1 done" from 720 px wide).

## Machine screens

Header: machine name, role, an on/off switch (`setMachineOn`), accent cyan while running. Body: the machine panel,
the backpack, then the compact network panel (on phones in that order: machine, backpack, network). Every panel has
the icon, a headline figure (Output / Stored / Drawing), the status line toned by meaning, the placement problem in
red and the placement hint. By layout: burner - fuel slot, fuel energy and time at this load, what it burns;
processor - in slot, recipe and progress, out slot, power supplied, the machine's recipe list (folded on phones);
consumer - power supplied and description; storage - charge meter; bore rig - depth, current block progress, the
9-slot buffer; fission pile - core thermometer (Running 600 / Danger 900 / Meltdown 1200), cooling state, rod slot,
rod energy left; generator - output and description. Crate: 27 slots and the backpack, quick move across. Desktop
machine windows are anchored at the top (not centred) so a growing carry bar cannot shift the slots.

## Verification

Harness and drivers in the scratch directory (`scratchpad/furnace/`): real `Simulation`, `PlayerState`,
`ObjectiveTracker`, `Survival`, `GameClock` on the FakeWorld, the real GameUI with these screens registered and the
renderer's real item icons. Screenshots at 390x844, 844x390 and 1280x800 of: cold furnace, roaring mid-smelt
(smelt, forge, drawer open, upgrade sheet), Arc Furnace on electricity with a network (smelt, grid, forge), a
brown-out, Starhearth ready to ignite, igniting, ignited (win screen), night with Rest, log, and every machine
layout (burner, thermopile, steam engine, battery, lithium bank, combustion engine, crusher, still, crate, fission,
bore rig, wind turbine, lamp, water wheel). An automated layout check reports text overflow and anything
off-screen: none. Click-through flows with taps (touch emulation) at both phone sizes and clicks at desktop, all
passing: load coal by tapping it in the bag then the fuel slot, light, pump three times (draft 0.92), Load copper
ore, smelt, collect by double-tap / shift-click, forge bronze ingots and a bronze pickaxe, the Upgrade button glows,
hold to upgrade to the Blast Furnace (title, two fuel slots, two crucibles follow), P pumps, Escape / close;
machines: swap coal into a burner's fuel slot, switch it off, double-tap ore into a crusher, double-tap a crate
stack into the pack. No page errors.

## Deviations and decisions
- Requirement of "notches for the selected recipe": the selected recipe is the FORGE row the player last touched
  (pointer or focus); the notch shows while the FORGE tab is open.
- The furnace window is wider than the kit's `lg` (up to 1220 px) on desktop so firebox, tab and backpack fit side
  by side; on phones it is the kit's full-screen sheet.
- In landscape the status line sits above the thermometer and the firebox column scrolls when a tier needs more
  height (tier 3+ with the electric switch); everything else of the firebox stays in view.
- "Add fuel" and "Load" are additions: one-tap ways to fill the firebox and crucibles on a phone (the slot
  interaction works as everywhere else too).
- The PUMP button is disabled with "Not lit" while the furnace is cold and unlit (the simulation would accept it,
  but it does nothing useful then).

## Known gaps
- `furnace.css` is 495 lines (layout, firebox, drawer and the three breakpoints); split from `furnaceTabs.css`.
- The flame and sparks are drawn on a canvas in heat-ramp colours from `kit/format.heatRgb` (the kit's source of
  truth for the ramp), not CSS tokens.
- Verified against the FakeWorld only (no real World or renderer in the harness); the integration must still call
  `registerStationScreens`.
- Machine screens show the network compactly (no member list); the furnace's GRID tab has the full list.
