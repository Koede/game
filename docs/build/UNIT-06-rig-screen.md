# Unit 6 - Rig screen and ghosts (build spec)

Status: design, written 2026-11-22 against `docs/build/SYSTEMS.md` (binding). Builder: read this file and SYSTEMS.md sections
1.3, 1.4, T8, T9, 6.2, 6c and 6d before you start. Where this file and SYSTEMS.md disagree, SYSTEMS.md wins. Where this file
and the code disagree about something that EXISTS, the code wins; tell the coordinator.

**Threads:** T8 (reading the world: defines the rig screen, the capability line, problem rows that say the fix, `chemView`
richer fields), T9 (sound and feel: `ui_click` on taps, `machine_done` at "small" loudness when a ghost is completed, the
red/blue/green visual vocabulary reused from the hearth ghost and the distill lamps). Reads, never defines: T3 (litres and
fluid names in still lines via `nameOf` / `litresText` wording), T7 (process cards are the same `PROCESS_CARDS` the solver
and the Codex read; nothing here gates anything). No new item, fluid, block, buff or saved field, so T4, T5 and T10 are not
touched (section 7 argues the "no save" decision).

Ids this unit DEFINES (SYSTEMS 6.2 row "rig screen, ghost previews, `chemView` richer fields"): the `'rig'` screen request,
`rigView`, `fitCard` / `placeCard`, `rigCells`, the ghost key `distill:card`, `ChemView.capabilities?` and
`ChemView.problems?`. Ids it READS from other units, generically (never by name): `CHEM` / `CHEM_KINDS` (Unit 0 extends it
with `vacuum_cap`, `pressure_cap`, `filter_bed`, `catalyst_bed`, `reflux_head`, `steel_flask`), `Distillery.capabilitiesOf`
(Unit 0), `Rig.problems` (every unit that adds scan rules: 7, 8, 11), `RIG_LEGEND` rows (8, 11 append letters),
`PROCESS_CARDS` rows (7-12 append cards).

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

You have built your first glass still on the Clay Furnace. Something is wrong - the flask's lamp stays dark - and the
crosshair says one thing about one block. You take the **Wrench** out, the same bronze tool that sets pipe ends, and Use it
on any piece of the glassware. A sheet slides up: the whole rig, read like a chemist reads a bench.

- At the top, in one line, what the rig is ("Column still - 3 cuts") and **what it can do**: "This rig can: distil,
  3 cuts, cool". A fermenter says "This rig can: ferment". When Unit 8's vacuum cap sits on the stack it says "vacuum",
  and the builder of Unit 6 never had to know that block existed.
- Below it, the **problems**, each a sentence that says the fix, in the simulation's own words: "The vapour has nowhere to
  go: put a Condenser Coil on top". Tap one and the block it means glows red in the world (with an arrow at the screen edge
  when it is behind you), exactly as a hearth problem does in the furnace's Structure tab. Close the sheet and the glow is
  still there, freshly re-armed, waiting for you.
- The **stills and vessels**, one line each, in crosshair grammar ("Still 1 - set 350 C, holding 348 C, boiling,
  3.2 buckets Crude Oil").
- A second tab, **Processes**: every process card the game knows (Distil syrup, Ferment wash, Refine crude, ...), each
  with a status against THIS rig: "Ready", "2 to place", "Does not fit here". Tap one: a side-view diagram of the card's
  rig with every cell marked - green where your glass already stands, blue where a piece is missing, red where something is
  in the way - the list of what to place with "have 2" from your pack, and the heat to set. Flip **Show in world** and the
  missing pieces appear as the same breathing blue ghost cubes the hearth planner uses, fitted onto your rig the right way
  round. Build into them; each ghost goes as its block arrives; when the last one lands the rig chimes and the toast says
  "The rig matches the card: Refine crude".

The fantasy is the furnace's Structure tab, transposed to glass: **the rig explains itself, and shows you where the next
piece goes.** It is phone first: everything is a tap on a 44 px row, the sheet works at 390 px portrait and 844 x 390
landscape, and nothing needs drag, hover or long-press.

Why a screen at all (SYSTEMS 1.3 "a screen only when a choice has more than three options"): the process picker is a
choice among 7 cards today and more after Units 7-12; the problem list can hold 8 entries; neither fits a 60-character
crosshair line. Everything that does fit a line stays in the crosshair (`chemView().text` is unchanged).

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 T8 - reading the world

| what | rule this unit follows |
|---|---|
| Crosshair line | unchanged: `chemView(d, x, y, z).text`. The screen never replaces the line, it extends it. |
| Still / vessel lines in the screen | T8 grammar `<Name> - <fact>, <fact>`: temperatures integer `C` in these LINES (they are copied crosshair-style facts); `°C` via `formatTemp` only in screen chrome (headings, the heat badge, the card's heat line). Litres `<n> L` below 1000, `<x.x> buckets` at or above (the existing `litresText` in `distillActions.ts`). |
| Problems | shown verbatim from `Rig.problems[].text` (the scan owns the words; Unit 3 / owning units polish them). Problems the screen derives itself (section 4.7) are sentences that say the fix. |
| Capability line | `This rig can: <word>, <word>` - lowercase words, comma separated, no trailing period (matches the SYSTEMS 7 brief example "This rig can: distil, 2 cuts, ferment, stirred"). |
| Ghosts | blue = missing, red = in the way; the same `GhostLayer` and payload as the hearth ghost (`'ghost:show'`). |

### 2.2 T9 - sound and feel

| moment | sound (`'sfx'` request) | loudness tier |
|---|---|---|
| screen opens / closes | `ui_open` / `ui_close` - already played by GameUI (`gameUI.ts` lines ~298 / ~329); do not add | small |
| tap a problem row, a card row, Turn, Show in world | `ui_click` (as `structureTab.ts` and `pipeScreen.ts` do) | default (UI) |
| a disabled button is tapped | kit `Button.setDisabled(true, reason)` already plays its refusal nudge; add nothing | - |
| the last ghost cell is filled | `machine_done`, `pitch: 1.4`, `volume: 0.6`, positioned at the card's anchor cell | small (0.6) |

`machine_done` at pitch 1.4 is what the distillery plays today for "run finished" (docs/api/distillery.md "Events"). When
Unit 12 lands `glass_chime` it may swap this one call (section 14 note 5); Unit 6 adds no `SfxName` and does not touch
`sfx.test.ts`.

### 2.3 Contracts with other units (exact)

| other unit | what Unit 6 assumes | what Unit 6 promises |
|---|---|---|
| 0 (foundations) | `CHEM` gains keys (`vacuumCap`, `pressureCap`, `filter`, `catalyst`, `reflux`, `steelFlask`) and `CHEM_CAPACITY_L` rows; `Distillery.capabilitiesOf(x, y, z): Capability[]` exists; `Capability` type in `src/core/reactions.ts`. | Iterates `CHEM_KINDS` for the glassware list; calls `capabilitiesOf` for every flask and vessel; unknown capability strings still print (section 4.6 fallback). |
| 7 (ground burner) | A base with no furnace may be hot (`Distillery.baseTemp(base)` returns non-null). | Reads heat ONLY through `baseTemp`; the cold-base text is one constant `COLD_BASE_TEXT` in `rigText.ts` that Unit 7 may reword (e.g. "... or burn fuel in it"). |
| 8, 11 (new modules, new scan rules) | New problems are pushed into `Rig.problems` by `scanRig` with `cells`; new modules have a `RIG_LEGEND` letter when a card uses them. | Shows any `RigProblem` without a code switch; ghosts any legend letter; new modules appear in the glassware list with no edit. |
| 11 (refinery tower) | The tower is reachable from `scanRig` (its problems land in `Rig.problems`), and a tower card is a rig string. | `rigCells` already understands a depth separator `;` (section 4.8), so a cuboid card can be ghosted. |
| 12 (stirrer, `distill:step`) | `stirred` arrives as a capability from `capabilitiesOf`. | Prints "stirred". Unit 6 does not listen to `distill:step`. |
| 3 (structure tab machines list) | none | Unit 6 does not edit `structureTab.ts` / `structureText.ts`; it copies their patterns into its own files. |

**Anti-pattern guard (SYSTEMS 6d):** no module list, problem-code list, capability list or card list is written by hand
anywhere in Unit 6's code. The only tables Unit 6 owns are WORDING tables with a generic fallback (`CAPABILITY_WORDS`,
`RIG_TITLES`), and a unit test (section 9) fails if any `CHEM` kind lacks a display name in the registry.

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code (verified 2026-11-22)

| fact | where |
|---|---|
| Module kinds: `CHEM = { base: 'still_base', flask: 'boiling_flask', vessel: 'reaction_vessel', segment: 'column_segment', condenser: 'condenser_coil', jacket: 'cooling_jacket', receiver: 'receiver', tube: 'glass_tube', airlock: 'airlock_cap', port: 'chem_port' }`, `CHEM_KINDS`, `chemKindOf(blockKey)` (strips `_done`), `MAX_MODULES` 64, `MAX_SEGMENTS` 8, `STILL_SETPOINTS`, `GLASS_MAX_C` 450 | `src/core/distill.ts` |
| `scanRig(world, x, y, z): Rig \| null` with `Rig { modules: Map<string, RigModule>; stills: Still[]; edges; sealed: Set<string>; jackets; problems: RigProblem[] }`, `RigProblem { code: RigProblemCode; text; cells: string[] }` (cells are `posKey` strings `"x,y,z"`), `MAX_PROBLEMS` 8 (module-private), `Still { flask; base; segments; draws: SideDraw[]; head }` | `src/sim/distillScan.ts` |
| Problem codes today: `no_base no_condenser drips_nowhere too_tall loose_segment shared_condenser too_many`; texts e.g. `'The Boiling Flask needs a Still Base under it'`, `'The vapour has nowhere to go: put a Condenser Coil on top'`, `'This condenser drips onto nothing: set a Receiver or a Glass Tube beside or below it'`, `` `A rig holds at most ${MAX_MODULES} pieces of glassware` `` | `src/sim/distillScan.ts` |
| `Distillery`: `entityAt`, `rigAt(x, y, z)` (rescans when dirty), `baseTemp(base)`, `all()`, `touched()`; entities `ChemEntity { kind, x, y, z, mix, state, setC?, tempC?, ... }` | `src/sim/distill.ts` |
| `chemUse(d, x, y, z, heldKey)` returns `null` for any held item that is not a container (so a held **wrench returns null today**); empty hand on a base cycles setpoints, elsewhere toasts the view line | `src/sim/distillActions.ts` |
| `chemView(d, x, y, z): ChemView` `{ kind: 'chem', stage, text, progress, secondsLeft, drink: null, tempC }`; a module named in a problem shows `"<Name> - <problem text>"`; private helpers `moduleName`, `fluidName`, `litresText` | `src/sim/distillActions.ts` |
| `PROCESS_CARDS: ProcessCard[]` (`ProcessCard extends RecipeSpec { rig: string }`), 7 cards: `distil_syrup` (130 C, `'CR/F./B.'`), `ferment_wash` (20, `'A/V'`), `distil_low_wines` (97), `distil_spirit` (92), `refine_crude` (350, `'..CR/..\|./RC\|./..\|CR/..F/..B'`), `rectify_spirit` (92), `refine_crude_short` (350); `RIG_LEGEND` (B F V \| C R T J A P; **P = `chem_port`** in code), `rigBlocks(rig)`, `PROCESS_BY_ID` | `src/content/recipesDistill.ts` |
| Rig string format: layers TOP first separated by `/`, each layer a row along +x, `.` air; `buildRig` parses it by reversing layers | `src/sim/distillKit.ts` |
| Player Use order: `beforeUse` (workshop `use` - an arm being configured with the wrench takes chem blocks as targets first - then magic), sap, **`BrewTools.use`** (role `chem` -> `chemUse`), handwork, `PipeTools.use` (wrench only on pipe blocks), then `screenFor` (role `chem` -> `{ type: 'machine' }` -> `createMachineScreen` returns null because chem blocks are not machine nodes: **today a wrench on glassware does nothing visible**) | `src/player/interaction.ts`, `src/player/brewTools.ts`, `src/player/blockRules.ts`, `src/app/game.ts` |
| `WRENCH = 'wrench'`, `WRENCH_COOLDOWN_S` 0.35 | `src/player/pipeTools.ts` |
| Wrench item desc: `'Use it on a pipe end to make it push, pull or rest; use it on the middle of a pipe to join or part it from its neighbour.'` | `src/content/items.ts` |
| Screens: `ScreenRequest` union (no `'rig'`), `registerStationScreens(ui, sim)` registers furnace/machine/crate/pipe; `GameScreen { window; refresh(); dispose() }`, `ScreenContext { request, bus, player, touch, invalidate, close, ... }` | `src/core/gameEvents.ts`, `src/ui/screens/furnace/index.ts`, `src/ui/gameUI.ts` |
| Overlay events: `'ghost:show' { key, cells: { x, y, z, block, state: 'missing' \| 'wrong' }[] }`, `'ghost:clear' { key? }`, `'highlight:block' { x, y, z, seconds }`; renderer keeps previews per key, `GHOST_CAP` 512 | `src/core/gameEvents.ts`, `src/render/tech/ghosts.ts`, `src/render/tech/highlight.ts` |
| Patterns to copy: `StructureTab` problem rows (tap cycles a group's cells, note "Shown in the world - 2 of 6" for `HINT_MS` 1800), `groupProblems`, `HearthGhost` (follows `block:changed` in its box via one microtask flush, pins placement, hides when complete), `ghostFor(bus, sim)` keeper per bus, `HEARTH_HIGHLIGHT_S` 10 | `src/ui/screens/furnace/structureTab.ts`, `structureText.ts`, `hearthGhost.ts`, `src/core/constants.ts` |
| Kit: `Window` (tabs, `size`, `fit`, `scroll`), `Tabs.setBadge(id, badge, { tone })`, `Button.setDisabled(d, reason)`, `Toggle`, `Badge`, `ItemIcon`, `glyph`, `h`, `setText`, `setAttr`, `formatTemp` | `src/ui/kit/*` |
| E2E: `scripts/e2e-distill.mjs` builds a pot still at `x0` and a 3-cut column at `x0+5` with `window.__hw`, `Driver` has `selectItem`, `selectEmptyHand`, `approach`, `use`, `waitScreen`, `closeScreen`, `press`, `settle`, `shot` | `scripts/e2e-distill.mjs`, `scripts/lib/e2eDriver.mjs` |

Not in code yet (Unit 0 lands first): `src/core/reactions.ts`, `Capability`, `Distillery.capabilitiesOf`. Unit 6 builds on
them as SYSTEMS 6.5 sketches them. If Unit 6 is somehow built before Unit 0 merges, see section 8 step 0.

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 How the screen is opened

- **Wrench + Use on any chemistry module** (any block whose `machineOfBlock(def).role === 'chem'`, `_done` twins
  included) opens `{ type: 'rig', x, y, z }` for that block.
- Order of precedence inside `BrewTools.use` (section 8 step 6): `chemUse(x, y, z, 'wrench')` runs FIRST; if it returns a
  result (Unit 11 will make a wrench on a `reflux_head` cycle its ratio, DISTILLERY_PLAN 12 and SYSTEMS J6), that result
  wins and no screen opens. Only when it returns `null` and the held item is `WRENCH` does the rig screen open. So the
  reflux head keeps its one-tap wrench action; the screen opens from any other piece of the same rig.
- The workshop's wrench comes even earlier (`beforeUse` -> `workshop.use`): while a mechanical arm is being configured, a
  wrench on a vessel sets it as the arm's target and no screen opens. That is correct and needs no change.
- Empty hand behaviour does NOT change: an empty-hand Use on a base still cycles `STILL_SETPOINTS`, elsewhere it toasts
  the crosshair line. After an empty-hand Use on a module whose rig has at least one problem, BrewTools advises ONCE per
  session (advise key `rig:wrench-tip`): **"A Wrench on any glassware opens the rig screen"** (52 chars, fits the HUD).
- The Wrench item description gains one sentence (section 11): "Use it on a pipe end to make it push, pull or rest; use it
  on the middle of a pipe to join or part it from its neighbour. On glassware it opens the rig screen."
- Respect `placeCooldown` exactly as `chemUse` does (a held Use button repeats every 0.25 s; the screen must not reopen
  after it is closed while the button is still held). Return the new `BrewOutcome` `'screen'`; Interaction maps it to
  `UseOutcome` `'screen'` (already in the union) and swings.

### 4.2 Screen anatomy

One kit `Window`, title + subtitle + two tabs. Size `'md'` (720 px) on desktop, `fit: 'tall'`, `scroll: false`; each tab
panel scrolls inside itself (`height: 100%`, `overflow-y: auto`). Phones: the kit's full-screen sheet; landscape phones put
title, tabs and close on one row (kit behaviour, nothing to add).

```
Window
  title     = RigView.title                   "Column still"
  subtitle  = RigView.summary                 "12 pieces of glassware - 1 still, 3 cuts"
  accent    = tone colour: bad if problems, good if a still/vessel is working, neutral otherwise
  tabs
    'rig'        label "Rig"        badge: problem count (tone bad) or none
    'processes'  label "Processes"  badge: number of cards Ready here (tone good) or none
  footer    = none (the kit footer is not used; hints live in the panels)
```

**Rig tab** (top to bottom):

1. **Can line** (`.hw-rig__can`, `hw-panel`): `RigView.canLine` - "This rig can: distil, 3 cuts, cool".
2. **Problems** heading `Problems (2)` (`hw-heading`), then one row per problem group (identical texts folded, "x3" count
   chip, like `groupProblems`). Each row is a `<button>` 44 px min height: warn glyph, the text (wraps to 3 lines), the
   count chip, and a note line that appears for `HINT_MS` 1800 after a tap. With no problems: a single line in good tone
   `No problems - every piece is connected`.
3. **Stills and vessels** heading `At work`, then one line per still (`Still 1 - ...`) and per vessel (`Reaction Vessel -
   ...`), at most 6 lines, then `and 3 more` (muted). Each line is a 44 px button too: a tap highlights that flask or
   vessel (`'highlight:block'` with `seconds: HEARTH_HIGHLIGHT_S`), so "which still is Still 2?" is answered in the world.
   Lines are toned: working = heat tone (amber), done = good, blocked = bad, idle = neutral (T9 visual vocabulary).
4. **Glassware** heading `Glassware`, a wrap of small chips, one per `CHEM_KINDS` entry present in the rig, in
   `CHEM_KINDS` order: item icon (24 px), `3 Column Segment`. Display only (not buttons; no touch target needed, but chips
   are 32 px tall so they never look tappable-yet-small... they carry no `button` role).

**Processes tab**:

1. Intro line (muted, 2 lines max): `Pick a process to see what this rig still needs. Show in world marks each missing
   piece.`
2. One **card row** per `PROCESS_CARDS` entry, in that array's order (stable: rows never jump while you build). A row is a
   44 px+ `<button aria-expanded>`: the card's output icon (32 px), title (`processTitle(card)`), the heat badge
   (`formatTemp(card.minTempC)` when the card has a `B`, else `No heat`), and the status chip (`Ready` good / `2 to place`
   warn / `1 in the way` bad / `Does not fit here` neutral). Chevron at the right.
3. Tapping a row toggles its **detail** open under it (accordion: one open at a time; opening another closes the first).
   The detail:
   - What it makes: `4 Pine Sap -> 1 Syrup Beaker` then, muted, `Gives back 3 Glass Beaker` (from `byproducts`, omitted
     when empty).
   - Heat line: with a `B` in the rig: `Set the Still Base to 130 °C` and, when the rig's matched base exists and its
     `setC` differs, a second line in warn tone `Now set to 97 °C - tap the Still Base with an empty hand to step it`.
     Without a `B`: `No heat - it works at room warmth`.
   - **Diagram** (side view): the card's cells as a grid, one cell per legend letter, top layer first, each 32 px square on
     desktop and 28 px on phones; a letter cell shows the module's `ItemIcon` and its state border: matched = solid good
     border with a 10 px check badge, missing = dashed `--hw-power` (blue) border with the icon at 45% opacity, in the way
     = solid bad border with a 10 px cross badge; `.` = empty, transparent, no border. Caption under it (muted): `Side view.
     Green stands, blue is missing, red is in the way.` For a multi-slice (depth) card, slices are drawn side by side with
     a 12 px gap and the caption adds `Slices front to back.`
   - **To place** list (only when missing > 0): one row per missing module kind: icon, `Condenser Coil`, `need 1`, `have 0`
     (have = count in the player's pack of that block's item key; warn tone when have < need, good otherwise).
   - **In the way** row (only when wrong > 0): `1 block in the way - break it` as a 44 px button; tapping highlights the
     first wrong cell, cycling through them on further taps (note `Shown in the world - 1 of 2`).
   - Controls row: `Toggle` **Show in world** (the ghost) and `Button` **Turn** (`kind: 'quiet'`, `size: 'sm'`, label
     `Turn (1 of 3)`) which moves the fit to the next candidate (section 4.5). Turn is disabled with reason `Only one way
     fits` when there is one fit. Show in world is disabled with reason `Every piece is in place` when the card is Ready,
     and `Nothing here to build on` when it does not fit.
   - With the card Ready, a good-tone line replaces To place: `This rig matches the card.` and, when the heat is right,
     nothing more; else the warn heat line above remains the only action.

### 4.3 Wireframes

Desktop (1280 x 800, window 720 px wide):

```
+------------------------------------------------------------------------------+
| Column still                                                            [x]  |
| 12 pieces of glassware - 1 still, 3 cuts                                     |
| [ Rig  (2) ] [ Processes  1 ]                                                |
+------------------------------------------------------------------------------+
| +--------------------------------------------------------------------------+ |
| | This rig can: distil, 3 cuts, cool                                        | |
| +--------------------------------------------------------------------------+ |
| PROBLEMS (2)                                                                 |
| [!] This condenser drips onto nothing: set a Receiver or a Glass Tube   x1  |
|     beside or below it                                                       |
|     Shown in the world                                                       |
| [!] The Still Base is cold - light the furnace under it                 x1  |
| AT WORK                                                                      |
| [ Still 1 - set 350 C, cold, 4 buckets Crude Oil                          ] |
| GLASSWARE                                                                    |
| (#) 1 Still Base  (#) 1 Boiling Flask  (#) 3 Column Segment                  |
| (#) 3 Condenser Coil  (#) 3 Receiver  (#) 1 Cooling Jacket                   |
+------------------------------------------------------------------------------+
```

Desktop, Processes tab with Refine crude open:

```
| Pick a process to see what this rig still needs. Show in world marks each    |
| missing piece.                                                               |
| (o) Distil syrup               130 °C   [Does not fit here]              v  |
| (o) Ferment wash               No heat  [Does not fit here]              v  |
| (o) Refine crude               350 °C   [1 to place]                     ^  |
|   8 Crude Canister -> 2 Diesel Canister                                      |
|   Gives back 1 Gasoline Canister, 1 Kerosene Canister, 2 Residue ...         |
|   Set the Still Base to 350 °C                                               |
|      .  .  [C][R]                                                            |
|      .  . [|]  .                                                             |
|    [R][C] [|]  .        Side view. Green stands, blue is missing,            |
|      .  . [|]  .        red is in the way.                                   |
|      .  . [F]  .                                                             |
|      .  . [B]  .                                                             |
|   TO PLACE                                                                   |
|   (#) Receiver            need 1   have 2                                    |
|   [ Show in world  (o-) ]        [ Turn (1 of 2) ]                           |
| (o) Rectify spirit             92 °C    [2 to place]                     v  |
```

Phone portrait (390 x 844): full-screen sheet; same order, one column; the problem text wraps; glassware chips wrap two
per row; the diagram cells are 28 px (a 4-wide, 6-high card is 4 x 28 + gaps = 124 px wide, fits easily); the controls row
stacks Toggle above Turn, each full width, 44 px tall.

```
+----------------------------------+
| Column still               [x]   |
| 12 pieces of glassware - 1 still,|
| 3 cuts                           |
| [ Rig (2) ] [ Processes 1 ]      |
+----------------------------------+
| This rig can: distil, 3 cuts,    |
| cool                             |
| PROBLEMS (2)                     |
| [!] This condenser drips onto    |
|     nothing: set a Receiver or a |
|     Glass Tube beside or below it|
|     Shown in the world - close   |
|     this to see it               |
| [!] The Still Base is cold -     |
|     light the furnace under it   |
| AT WORK                          |
| [ Still 1 - set 350 C, cold,   ] |
| [ 4 buckets Crude Oil          ] |
| GLASSWARE                        |
| (#) 1 Still Base (#) 1 Boiling.. |
+----------------------------------+
```

Phone landscape (844 x 390): title, tabs and close on one row (kit); the panel below is ~300 px tall and scrolls; on the
Processes tab an open card's diagram sits LEFT of its text (CSS grid `auto 1fr` under `(max-height: 519.98px)`), so a
6-high diagram (6 x 28 = 168 px) and the To place list are visible together without scrolling past the diagram.

```
+------------------------------------------------------------------------------------------------+
| Column still - 12 pieces of glassware...  [ Rig (2) ] [ Processes 1 ]                     [x] |
+------------------------------------------------------------------------------------------------+
| (o) Refine crude                350 °C   [1 to place]                                      ^  |
|   . . C R     8 Crude Canister -> 2 Diesel Canister                                            |
|   . . | .     Set the Still Base to 350 °C                                                     |
|   R C | .     TO PLACE   (#) Receiver   need 1  have 2                                         |
|   . . | .     [ Show in world (o-) ]  [ Turn (1 of 2) ]                                        |
|   . . F .                                                                                      |
|   . . B .                                                                                      |
+------------------------------------------------------------------------------------------------+
```

### 4.4 Every string (exact; T8 grammar)

| id | string | notes |
|---|---|---|
| tab labels | `Rig`, `Processes` | |
| title (`rigTitle(rig)`, first rule that holds) | 1 still with >= 1 segment: `Column still`; 1 still with no segment: `Pot still`; 2+ stills: `Still house`; no still but a sealed vessel: `Fermenter`; no still, a vessel: `Reaction vessel`; else `Glassware` | computed from the rig, not from module names, so new modules never need a rule; Unit 11 may add `Refinery tower` as the FIRST rule when its scan marks a tower (section 14 note 3) |
| summary | `<n> piece(s) of glassware` + (` - ` + parts joined by `, `) where parts are `<k> still(s)` (if > 0), `<c> cuts` (max cuts of any still, if >= 2), `<v> vessel(s)` (if > 0) | e.g. `5 pieces of glassware - 1 still`; `1 piece of glassware`; `12 pieces of glassware - 1 still, 3 cuts` |
| can line | `This rig can: ` + words | |
| can line, nothing | `This rig cannot run anything yet` | when the word list is empty |
| problems heading | `Problems (<n>)` (n = groups) | |
| no problems | `No problems - every piece is connected` | good tone |
| problem note | `Shown in the world`; with a group of k > 1: `Shown in the world - <i> of <k>`; on touch (`ctx.touch`) append ` - close this to see it` | 1800 ms |
| cold base problem | `COLD_BASE_TEXT` = `The Still Base is cold - light the furnace under it` | derived, code `cold_base` |
| glass limit problem | `The Still Base is set above 450 C - glass cracks there; it holds 450 C` | derived, code `over_glass`, only when `setC > GLASS_MAX_C` (420 is the top setpoint today, so this never fires until Unit 11 adds 480/560 without a steel flask; it is the generic guard SYSTEMS T1 rule 1 asks for) |
| at work heading | `At work` | |
| still line | `Still <i> - set <setC> C, <heat>, <state>[, <contents>]` where heat = `holding <t> C` or `cold`, state = `boiling` / `run done` / `stopped` / `not boiling` (the existing `chemView` words), contents = `<litres> <Fluid>` or omitted when empty | e.g. `Still 1 - set 130 C, holding 128 C, boiling, 1.0 buckets Sap` (contents via `litresText` + fluid name, exactly the `chemView` flask wording) |
| still without a base | `Still <i> - no Still Base, <contents>` | |
| vessel line | `Reaction Vessel - <contents or empty>, <word>` with the existing `chemView` vessel words (`fermenting`, `done`, `too sweet - add water`, `waiting`, `open (an Airlock Cap ferments it)`) | reuse: call `chemView(d, x, y, z).text` for the vessel - it already has this shape |
| more | `and <n> more` | |
| glassware heading / chip | `Glassware`; chip `<count> <Name>` | name from `item(kind).name` |
| processes intro | `Pick a process to see what this rig still needs. Show in world marks each missing piece.` | |
| card title | `processTitle(card)`: id with `_` -> space, first letter upper; a trailing `short` becomes ` (short column)`: `Distil syrup`, `Ferment wash`, `Distil low wines`, `Distil spirit`, `Refine crude`, `Rectify spirit`, `Refine crude (short column)` | generic for future ids |
| heat badge | `formatTemp(card.minTempC)` (`130 °C`), or `No heat` when the rig string has no `B` | |
| status chip | `Ready` / `<n> to place` / `<n> in the way` (only when missing = 0 and wrong > 0) / `Does not fit here` | when both missing and wrong > 0 the chip says `<n> to place` and the detail shows both |
| makes line | `<inputs> -> <output>`; amounts `<count> <Item Name>` joined by `, ` | |
| gives back | `Gives back <byproducts>` | omitted when empty |
| heat line | `Set the Still Base to <formatTemp(minTempC)>`; no B: `No heat - it works at room warmth` | |
| heat mismatch | `Now set to <formatTemp(setC)> - tap the Still Base with an empty hand to step it` | warn tone |
| diagram caption | `Side view. Green stands, blue is missing, red is in the way.` (+ ` Slices front to back.` for depth cards) | |
| to place heading / row | `To place`; `<Name>`, `need <n>`, `have <m>` | |
| in the way row | `<n> block(s) in the way - break it` | button |
| matched | `This rig matches the card.` | good tone |
| no fit | `This rig has none of this card's glassware. Build it beside the rig, or start it here with one of its pieces.` | neutral |
| toggle | `Show in world` | |
| turn | `Turn (<i> of <n>)` | |
| disabled reasons | `Every piece is in place`, `Nothing here to build on`, `Only one way fits` | kit hint line |
| ghost complete toast | `The rig matches the card: <processTitle>` | kind default, once |
| one-time tip | `A Wrench on any glassware opens the rig screen` | advise key `rig:wrench-tip` |

No exclamation marks anywhere. `°C` only in the heat badge / heat lines / mismatch line (screen chrome); still lines use
`C` because they are crosshair-grammar facts and must read the same as `chemView` (the screen is checked against them in
tests).

### 4.5 The view data model (sim side, DOM-free)

New file `src/sim/rigView.ts` (NEW):

```ts
import type { Cell, Rig, RigProblem } from './distillScan';

/** One line of the "At work" list. */
export interface RigWorkLine {
  at: Cell;                         // the flask or vessel (tap highlights it)
  text: string;                     // T8 line, see 4.4
  tone: 'heat' | 'good' | 'bad' | 'neutral';
}

/** A problem the screen shows: the scan's problem with its cells as coordinates, or one derived from live state. */
export interface RigProblemView {
  code: string;                     // RigProblemCode or a derived code ('cold_base', 'over_glass'); display never switches on it
  text: string;
  cells: Cell[];                    // at least one; parsed from RigProblem.cells ("x,y,z")
}

export interface RigGlass {
  kind: string;                     // a CHEM kind
  name: string;                     // item(kind).name
  count: number;
}

export interface RigView {
  anchor: Cell;                     // the module the view was built from (requested cell, or a re-anchor, 4.7)
  title: string;
  summary: string;
  canLine: string;
  capabilities: string[];           // the words of canLine, in order (tests read this)
  problems: RigProblemView[];       // scan problems first (scan order), then derived ones; at most RIG_MAX_PROBLEMS 10
  work: RigWorkLine[];              // stills first (scan order), then vessels; at most RIG_WORK_LINES 6
  moreWork: number;                 // lines left out
  glass: RigGlass[];                // CHEM_KINDS order, count > 0 only
  modules: string[];                // every module posKey (re-anchoring and the ghost's "is this rig" checks)
  stills: number;
  cuts: number;                     // max over stills of draws.length + (head ? 1 : 0)
  vessels: number;
}

export const RIG_MAX_PROBLEMS = 10;  // the scan's 8 + up to 2 derived
export const RIG_WORK_LINES = 6;

/** The rig screen's model for the rig holding x, y, z; null when no module stands there. Pure over the Distillery. */
export function rigView(d: Distillery, x: number, y: number, z: number): RigView | null;
```

Card fitting lives in `src/sim/rigFit.ts` (NEW), pure over a read-only world:

```ts
/** One cell a card's rig string asks for, relative to the card's origin (bottom layer y = 0, first column x = 0, slice z = 0). */
export interface CardCellSpec { letter: string; block: string; dx: number; dy: number; dz: number }

/** Where a card is laid: translation of its origin plus a quarter-turn about the vertical axis. */
export interface RigPlacement { card: string; ox: number; oy: number; oz: number; turn: 0 | 1 | 2 | 3 }

export type CardCellState = 'ok' | 'missing' | 'wrong';
export interface CardCell { x: number; y: number; z: number; letter: string; block: string; state: CardCellState }

export interface CardFit {
  placement: RigPlacement;
  cells: CardCell[];                // every letter cell of the card, in rigCells order
  ok: number; missing: number; wrong: number;
  touchesAnchor: boolean;           // the anchor module is one of the ok cells
}

export const FIT_MAX = 4;           // candidates kept for Turn

/** Evaluates a card at one fixed placement (used for pinned ghosts). */
export function placeCard(world: IWorld, card: ProcessCard, at: RigPlacement): CardFit;
/** Best fits of a card onto a rig, best first, at most FIT_MAX, at most one per turn; [] when nothing matches. */
export function fitCard(world: IWorld, rig: Rig, card: ProcessCard, anchor: Cell): CardFit[];
/** turn k maps a card offset (dx, dz) to world (rx, rz). */
export function turnOffset(dx: number, dz: number, turn: 0 | 1 | 2 | 3): [number, number];
```

`rigCells(rig: string): CardCellSpec[]` goes into `src/content/recipesDistill.ts` (NEW export) beside `rigBlocks`, so the
content module owns the string format; `distillKit.buildRig` is refactored to call it (one parser, same behaviour).

Simulation façade (`src/sim/simulation.ts`, NEW methods, thin):

```ts
rigView(x: number, y: number, z: number): RigView | null            // rigView(this.distill, x, y, z)
rigFits(x: number, y: number, z: number, cardId: string): CardFit[]  // rig = distill.rigAt; card = PROCESS_BY_ID; [] if either missing
placeCard(at: RigPlacement): CardFit | null                          // null for an unknown card id
```

`ScreenSim` (`src/ui/screens/furnace/simApi.ts`) gains the same three members with the same signatures, so `Simulation`
still satisfies it structurally (exactly how `structureView` was added).

UI-side model (DOM-free, `src/ui/screens/rig/rigText.ts`, NEW):

```ts
export interface CardRowView {
  id: string; title: string; icon: string;           // icon = card.output.item
  heat: string;                                      // "130 °C" | "No heat"
  status: string; tone: 'good' | 'warn' | 'bad' | 'neutral';
  fits: number;                                      // candidates (Turn shows "i of fits")
}
export function processTitle(card: Pick<ProcessCard, 'id'>): string;
export function cardStatus(fit: CardFit | undefined): { text: string; tone: CardRowView['tone'] };
export function cardRow(card: ProcessCard, fits: readonly CardFit[]): CardRowView;
export function makesLine(card: ProcessCard): { makes: string; back: string | null };
export function heatLines(card: ProcessCard, baseSetC: number | null): { line: string; mismatch: string | null };
export function toPlace(fit: CardFit, pack: (item: string) => number): Array<{ block: string; name: string; need: number; have: number }>;
export function diagram(card: ProcessCard, fit: CardFit | undefined): DiagramCell[][][]; // [slice][row top-first][col]
export interface DiagramCell { letter: string; block: string | null; state: CardCellState | 'air' | 'none' } // 'none' = no fit
export function groupRigProblems(problems: readonly RigProblemView[]): Array<{ text: string; at: Cell[] }>;
export function problemNote(i: number, k: number, touch: boolean): string;
export function ghostPayload(fit: CardFit): GhostPayloadCell[];  // missing -> { block, state: 'missing' }, wrong -> { block, state: 'wrong' }
export const GHOST_KEY = 'distill:card';
export const COLD_BASE_TEXT = 'The Still Base is cold - light the furnace under it';
```

`rigText.ts` must not import DOM; `rigView.ts` and `rigFit.ts` must not import from `src/ui`.

### 4.6 Capability words (generic over CHEM and Capability)

`capabilityWords(rig, d): string[]` in `rigView.ts`, built in this order, without duplicates:

1. `distil` - when at least one still has a base AND (a head or a side draw), i.e. the scan found it can boil and condense.
2. `<c> cuts` - when `cuts >= 2` (one cut is implied by "distil").
3. Every capability of every flask and vessel in the rig, from `d.capabilitiesOf(x, y, z)` (Unit 0), unioned, then mapped
   through `CAPABILITY_WORDS` in the order of that table, unknown ones after it alphabetically:

   | capability | word | note |
   |---|---|---|
   | `heated` | `heat` | dropped when every heated module is the flask of a still that is already counted under `distil` (heat is implied); kept for a heated `reaction_vessel` (a heated reactor) |
   | `sealed` | `ferment` | the SYSTEMS 7 example word |
   | `cooled` | `cool` | |
   | `vacuum` | `vacuum` | |
   | `pressure` | `pressure` | |
   | `stirred` | `stirred` | |
   | `catalyst:<item>` | `catalyst (<Item Name>)` | `itemOrNull(item)?.name ?? item` |
   | anything else | the raw string with `_` -> space | the generic fallback: a capability Unit 0 or a later unit invents still prints |

4. `cool` also comes from a jacket on a CONDENSER (`rig.jackets.size > 0`) - the scan's existing "watered jacket = x3
   condensing" - so today's e2e column (jacket on its head condenser) reads "distil, 3 cuts, cool" even before
   capabilitiesOf reports `cooled` for vessels.

Result for today's rigs: pot still -> `distil`; 3-cut column with the head jacket -> `distil, 3 cuts, cool`; fermenter
(`A/V`) -> `ferment`; a lonely flask on a base with nothing above -> `This rig cannot run anything yet` (plus the
`no_condenser` problem).

### 4.7 Problems: scan problems plus two derived ones

- Scan problems: `rig.problems` in scan order, each mapped to `RigProblemView` with `cells` parsed from `"x,y,z"` keys.
  Never filtered, never re-worded, never switched on by code.
- Derived (appended after the scan's, only if `problems.length < RIG_MAX_PROBLEMS`):
  - `cold_base`: for every still whose base exists, `d.baseTemp(base) === null` AND whose flask holds more than 0.5 L.
    Text `COLD_BASE_TEXT`, cells `[base]`. (An empty rig with a cold base is not a problem; it is simply idle.) One row per
    base; identical texts fold in the UI into "x2".
  - `over_glass`: a base with `setC > GLASS_MAX_C`. Text as 4.4. Cells `[base]`.
- Why derived ones live in the view and not in `scanRig`: the scan is pure over blocks (its header says so: "Pure: it reads
  blocks only") and heat is live state. Units 7, 8 and 11 that add BLOCK-shaped problems put them in `scanRig`; live-state
  problems (a vacuum pump below 16 rpm, Unit 8's `cap_unpowered`) may be added either in `scanRig` via the Distillery hooks
  or here by appending a row to `derivedProblems()` - the screen shows both without change.

### 4.8 Process picker behaviour and the fitting algorithm

**`rigCells(rig)`** (content): split on `;` into depth slices (slice index = dz, front to back; no `;` = one slice dz 0);
each slice split on `/` into layers TOP first; reverse so the bottom layer is dy 0; each character at column index dx;
characters with a `RIG_LEGEND` entry become a `CardCellSpec`; `.` and unknown characters (spaces) are air. `;` is not a
legend letter today and must stay reserved (test in section 9).

**`turnOffset(dx, dz, turn)`**: turn 0 `(dx, dz)`; turn 1 `(-dz, dx)`; turn 2 `(-dx, -dz)`; turn 3 `(dz, -dx)`. Every rule of
the scan treats the four horizontal faces alike (section 3 of DISTILLERY_PLAN: "H any horizontal face"), so a card works the
same in any of the four turns. Mirroring is not offered: for a planar card mirror = turn 2, and for depth cards a mirror
would be a different build.

**Cell state at a placement** (`placeCard`): for each `CardCellSpec`, world cell = `(ox + rx, oy + dy, oz + rz)` with
`[rx, rz] = turnOffset(dx, dz, turn)`; read `world.getBlock(...)`:
- `chemKindOf(block.key) === spec.block` -> `ok` (the `_done` twins count as the plain module);
- `block.replaceable === true` (`BlockDef.replaceable`: air, tall grass, water and lava sources - the cells a placement
  replaces, `src/core/types.ts`) -> `missing`;
- anything else -> `wrong` (a stone, a different module, water).

Card `.` cells are never checked: extra glassware or blocks next to the card's shape are fine (a rig may be a superset of a
card).

**`fitCard(world, rig, card, anchor)`**:
1. For each turn 0..3, for each card cell `s` and each rig module `m` with `m.kind === s.block`: candidate origin =
   `m - (turnOffset(s.dx, s.dz, turn), s.dy)`. Deduplicate candidates per turn.
2. Evaluate each candidate with `placeCard`. Discard candidates with `ok === 0` (cannot happen by construction, kept as a
   guard) and candidates with `wrong > ok` (a fit that mostly collides is not a fit).
3. Order by: `ok` descending; `wrong` ascending; `touchesAnchor` first; `turn` ascending; then `oy`, `ox`, `oz` ascending
   (fully deterministic).
4. Keep the best candidate of each turn, then the top `FIT_MAX` of those in the order above. Return `[]` when none.

Cost: a card has at most ~20 letter cells and a rig at most 64 modules: <= 4 x 20 x 64 = 5120 candidates, ~20 block reads
each, ~100k reads - about 1-3 ms in JS. It runs only (a) when the Processes tab is visible, at most every 500 ms, for each
card (7 today: <= 20 ms worst case every 500 ms, typically < 2 ms because rigs are small), and (b) once on Turn / select.
The builder must measure with the e2e column (12 modules) and keep `fitCard` for all cards under 5 ms per refresh on the
desktop e2e machine; if a rig is `too_many` (64 modules), the picker computes fits only for the OPEN card and shows the
other rows' status as `-` (neutral) with the intro line `This rig is very big - open a card to check it.`

**Status of a row** = the best fit (`fits[0]`): none -> `Does not fit here`; `missing === 0 && wrong === 0` -> `Ready`;
`missing > 0` -> `<missing> to place`; else `<wrong> in the way`. The Processes tab badge counts Ready rows.

**Turn**: cycles an index `0..fits.length-1` for the open card (kept in the keeper, 4.10); the detail, the diagram and (if
on) the ghost follow the chosen fit. When a refresh produces a different `fits` list (the player built something), the
index resets to 0 unless a ghost is pinned (then the pinned placement is shown, 4.9).

**Selection memory**: the open card id and the active tab are remembered for the session by the keeper (not saved; T10
untouched). Reopening the screen on any rig reopens the same tab and card.

### 4.9 Ghost rules

- **One distillery ghost at a time**, key `GHOST_KEY = 'distill:card'`. Showing a card replaces the previous card's ghost
  (`'ghost:show'` with the same key replaces, renderer behaviour). The hearth ghost (`hearth:x,y,z`) is a different key and
  coexists.
- **Payload**: `ghostPayload(fit)`: every `missing` cell as `{ x, y, z, block: cell.block, state: 'missing' }` and every
  `wrong` cell as `{ x, y, z, block: cell.block, state: 'wrong' }` (red hatched cube round the block in the way, the hearth's
  convention). `ok` cells are not sent. Never more than `GHOST_CAP` (cards are tiny; the cap guards Unit 11's tower).
- **Pinned placement**: when the player turns Show in world on, the keeper stores the fit's `RigPlacement` and from then on
  re-evaluates only that placement (`sim.placeCard(placement)`), never re-fits. Building into the ghost therefore never
  makes it jump to another spot. Turn while the ghost is on re-pins to the newly chosen fit (`'ghost:show'` again).
- **Follows the world**: the keeper listens to `'block:changed'`; a change inside the pinned card's bounding box grown by 1
  marks it dirty; one `queueMicrotask` flush per burst re-evaluates and re-emits (same pattern as `HearthGhost.onChange` /
  `flush`, after the simulation's own listener so `rigAt` sees the change).
- **Ends** (`'ghost:clear' { key: GHOST_KEY }`) when: the player turns the toggle off; every cell is `ok` (then also the
  toast `The rig matches the card: <title>` and `sfx machine_done` pitch 1.4 volume 0.6 at the first card cell); the player
  picks Show in world for another card (replaced, not cleared); the game's bus ends (keeper lives per bus via a
  `WeakMap<GameBus, RigGhost>` like `ghostFor`).
- It **stays** when the screen closes - that is the point: build with the screen closed, reopen to check. It also stays if
  the player breaks every matched piece (they may be rebuilding). Section 5.4 says how the player can always turn it off
  from any rig screen.
- No ghost is ever shown for the furnace under a `B`: heat is a problem line (`cold_base`), not a block, because Unit 7's
  ground burner makes the furnace optional.

### 4.10 The keeper (`src/ui/screens/rig/rigGhost.ts`, DOM-free, NEW)

```ts
export interface RigGhostSource { placeCard(at: RigPlacement): CardFit | null }
export class RigGhost {
  constructor(bus: GameBus, sim: RigGhostSource)
  readonly shown: RigPlacement | null          // the pinned placement, or null
  tab: 'rig' | 'processes'                      // session memory
  openCard: string | null                       // session memory
  turnIndex: number                             // for openCard
  show(placement: RigPlacement): boolean        // pins + emits; false (and nothing shown) when the fit has nothing missing or wrong
  hide(): void                                  // 'ghost:clear' { key: GHOST_KEY }
  isShownFor(cardId: string): boolean
  current(): CardFit | null                     // last evaluated pinned fit (the detail uses it while shown)
}
export function rigGhostFor(bus: GameBus, sim: RigGhostSource): RigGhost
```


---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour and rules, including edge cases

### 5.1 Refresh

- GameUI calls `refresh()` ~8 Hz. The rig screen rebuilds `sim.rigView(anchor)` at most every `RIG_REFRESH_MS` 250 ms
  (and at once on open, after a tap, and when `ctx.invalidate()` is called), and computes card fits at most every
  `FIT_REFRESH_MS` 500 ms and only while the Processes tab is active. DOM writes only on change (`setText`, `setAttr`, rows
  keyed by problem text / card id and updated in place, like `StructureTab`).
- Rebuilding is cheap: `rigAt` rescans only when the Distillery is dirty (a block change, a pour), the view walks <= 64
  modules.

### 5.2 The rig changes while the screen is open

| change | behaviour |
|---|---|
| a module is added or removed elsewhere in the rig | next refresh shows it: counts, summary, title, problems, statuses all follow. Open card stays open; its status and diagram update in place. |
| the anchor block itself is removed | re-anchor: the screen keeps `lastModules` (the `RigView.modules` of the previous view) and picks the first key in that list where `distill.entityAt` still returns a module; `rigView` from there. The title and everything follow the rig that remains. |
| the rig splits in two (a middle module broken) | the anchor rule above decides which half is shown (the anchor's own half when it stands). No message. |
| nothing of the old rig remains | the screen closes itself (`ctx.close()`), silently, like the pipe screen when its pipe is gone. A pinned ghost is NOT cleared by this (5.4). |
| the rig grows past 64 modules | the scan's `too_many` problem shows first; the picker switches to "open a card to check it" mode (4.8). |
| a flask boils / finishes | the At work line and its tone change; nothing else (no toast from the screen; the simulation already toasts "Distilling run finished"). |

### 5.3 Multiple rigs

The screen is always about ONE rig: the one holding the wrenched block (`rigAt`). Two stills that touch are one rig by
definition (the scan's flood fill) and are listed as `Still 1`, `Still 2` in scan order; a tap on a line highlights that
flask so the numbering is learnable in the world. A rig that does not touch is a different rig: wrench it to see it. The
ghost is global (one key), so building a card next to rig B while the ghost was pinned from rig A simply keeps showing A's
pinned placement until the player turns it off or completes it.

### 5.4 Ghost cleanup and how the player always gets rid of it

- The toggle in the Processes tab shows ON for the card whose ghost is pinned (`isShownFor(card.id)`) in ANY rig screen,
  because the keeper is global. Turning it off clears it.
- If the pinned card does not fit the rig the screen is open on, its row still shows a small `Shown in world` power-tone
  tag next to the status chip, and opening that row shows the toggle ON and ENABLED (so it can be switched
  off) with the detail of the pinned placement evaluated by `placeCard`. So the ghost can always be dismissed from any rig
  screen.
- The ghost is session-only: a reload clears it (the renderer starts empty; the keeper is new). Not saved (section 7).

### 5.5 Closing

- Escape, the close button, an outside tap, the back gesture (kit and GameUI behaviour) close the window. GameUI plays
  `ui_close`.
- On `dispose()`: if a problem or work line was tapped less than `HEARTH_HIGHLIGHT_S` seconds ago, re-emit
  `'highlight:block'` for that same cell with the full `HEARTH_HIGHLIGHT_S` seconds - **re-arm on close** - so on a phone
  (where the sheet covered the world) the red outline is fresh when the world becomes visible. Tested in the logic test
  through a pure helper `rearm(lastTapAtMs, nowMs, seconds): boolean`.
- No other state is torn down: the ghost stays; the keeper's memory stays.

### 5.6 Interaction with other wrench and Use behaviours (exhaustive)

| held | target | result |
|---|---|---|
| wrench | any chem module, no arm being configured, `chemUse` returns null | rig screen opens |
| wrench | `reflux_head` (after Unit 11) | Unit 11's `chemUse` handles it (cycle) - no screen |
| wrench | chem module while a mechanical arm is being configured | workshop takes it (arm target) - no screen |
| wrench | a pipe | unchanged: pipe end / joint |
| empty hand | chem module | unchanged: base cycles setpoint / toast line; plus the one-time tip when the rig has problems |
| container | chem module | unchanged: pour / take |
| any other item | chem module | unchanged (`chemUse` null -> falls through as today) |
| goggles | chem module | unchanged (goggles only add the kinetic line; they are not the wrench) |

### 5.7 Messages (complete list of what Unit 6 makes the game say)

Only: the one-time tip, the ghost-complete toast, the problem / line notes inside the screen, the derived problem texts,
and the disabled-button reasons - all in section 4.4. No other toast is added. Refusals in the screen are disabled buttons
with reasons, never toasts.

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Touch targets and sizes

- Every interactive element is >= 44 px tall (`--hw-tap`) and >= 44 px wide: problem rows, work lines, card rows, the in
  the way row, the Toggle, the Turn button. The kit already sizes `Toggle` / `Button`; rows set `min-height: var(--hw-tap)`.
- Text: body `--hw-font-body` 14 px (13 px under the phone breakpoint), never below 12 px; headings `hw-heading`; numbers in
  lines are plain text (the lines are sentences; no `hw-num` inside them, to keep the crosshair look).
- Diagram cells 32 px desktop / 28 px phone (display only, not targets); the largest card today is 4 x 6 = 124 x 178 px on a
  phone. Depth cards (Unit 11) with up to 9 x 9 cells per slice and 3 slices may exceed the panel width: the diagram wrapper
  scrolls sideways (`overflow-x: auto` + kit `edgeFade`), never the page.
- Breakpoint: the kit's phone query `(max-width: 719.98px), (max-height: 519.98px)`; landscape `(max-height: 519.98px)`.
  CSS ships as `src/ui/screens/rig/rig.css`, class prefix `hw-rig`, only `--hw-*` tokens, injected once as
  `<style id="hw-rig-css">` (same mechanism as `furnace/styles.ts`).

### 6.2 Highlight visuals

- Problem / work / in-the-way taps emit `'highlight:block' { x, y, z, seconds: HEARTH_HIGHLIGHT_S }` - the existing thick
  red pulsing outline drawn through everything, with the edge arrow when off-screen (`src/render/tech/highlight.ts`). No
  renderer change.
- A folded group cycles its cells on each tap (`next` index, as `StructureTab.ProblemRow.next`).
- Ghosts: `src/render/tech/ghosts.ts` unchanged (blue missing, red wrong, breathing pulse, self-lit, faint through leaves).
- In the screen: the diagram uses the same three meanings (good border = stands, power-blue dashed = missing, bad = in the
  way) so screen and world read alike.

### 6.3 Accessibility details

- Problem rows: `<button type="button">` with `aria-describedby` on the note. Card rows: `aria-expanded`, the detail has
  `role="region"` and `aria-label` = card title.
- Diagram: `role="img"` with `aria-label` like `Refine crude: 11 pieces, 10 in place, 1 missing`.
- Keyboard: Tab moves through rows; Enter / Space activates (native buttons). Escape closes (kit).

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

**Nothing is saved.** Justification against T10:
- The rig is derived from blocks (the plan: "The rig is derived by a rescan on load and never saved"); the view is derived
  from the rig and the entities, which are already saved by the Distillery.
- The ghost and the session memory (tab, open card, Turn index, the one-time tip) are conveniences. The hearth ghost is
  per session for the same reason (docs/api/ui-tech.md "Ghost state is per session (not saved)"). Saving them would add a
  field to a snapshot for no gameplay value.
- No item, block, fluid, recipe or flag is added: no content roster, icon or progression change.

The only shared-type edits are: `ScreenRequest` gains `| { type: 'rig'; x: number; y: number; z: number }`; `ChemView`
gains two OPTIONAL fields (`capabilities?: string[]`, `problems?: RigProblemView[]`), filled by `chemView` from the same
helpers (so goggles / later units can read them); `BrewOutcome` gains `'screen'`; `ScreenSim` gains three members. None is
persisted.

---------------------------------------------------------------------------------------------------------------------------

## 8. Implementation plan (ordered; each step leaves `npm test` green)

0. **Precondition.** Unit 0 merged (`Capability`, `Distillery.capabilitiesOf`). If it is not, write `capabilityWords` to
   call `(d as { capabilitiesOf?: ... }).capabilitiesOf?.(...) ?? []` and derive `ferment` from `rig.sealed` as well (the
   union is idempotent), so the unit works either way; remove nothing later.
1. **`rigCells`** in `src/content/recipesDistill.ts` (NEW export, section 4.8). Refactor `buildRig` in
   `src/sim/distillKit.ts` to use it (`cells` keeps its current shape `{ ch, x, y, z }`; z = slice index). Update the
   `ProcessCard.rig` doc comment: legend list as in `RIG_LEGEND` (note `P` is the chem port), and the `;` depth separator.
   Tests: section 9.1.
2. **`src/sim/rigFit.ts`** (NEW): `turnOffset`, `placeCard`, `fitCard`, `FIT_MAX`. Free-cell test: `world.getBlock(x, y, z).replaceable`
   (the same flag placement honours); an unloaded cell counts as `wrong` (never ghost into unloaded terrain). Tests: 9.2.
3. **`src/sim/rigView.ts`** (NEW): `rigView`, `capabilityWords`, `derivedProblems`, `RIG_MAX_PROBLEMS`, `RIG_WORK_LINES`,
   title and summary rules. Export `litresText`, `moduleName` and `fluidName` from `distillActions.ts` (today private) so
   the still lines share them; reuse `chemView(d, x, y, z).text` for vessel lines. Extend `ChemView` with the two optional
   fields and fill them in `chemView` from `rigView`'s helpers (compute once per call; `rigAt` is cached). Tests: 9.3.
4. **Simulation façade**: `rigView`, `rigFits`, `placeCard` on `Simulation` (`src/sim/simulation.ts`, next to
   `brewView` / `chemUse`); export the new types from `src/sim/index.ts`. Add the three to `ScreenSim`
   (`src/ui/screens/furnace/simApi.ts`).
5. **`ScreenRequest`**: add `{ type: 'rig'; x; y; z }` with a doc comment `/** The distillery rig screen for the module at
   this position (docs/api/distillery.md). */` in `src/core/gameEvents.ts`.
6. **Opening**: in `src/player/brewTools.ts` `BrewTools.use`, inside the `kind?.role === 'chem'` branch:
   ```ts
   const r = this.brew.chemUse(hit.x, hit.y, hit.z, held);
   if (r !== null) return this.apply(r, held);
   if (held === WRENCH) return this.openRig(hit);   // NEW: stopMining, swing, bus 'ui:open' { type: 'rig', ... }, placed()
   return null;
   ```
   `openRig` emits through `this.host.player.bus` (PlayerState carries the bus - `brewTools.give` already uses
   `player.bus.emit`), calls `host.placed()` so the press delay applies, returns `'screen'`. `BrewOutcome` becomes
   `'brewed' | 'placed' | 'refused' | 'screen'`. `Interaction.use` already returns `brewed` as the UseOutcome; `'screen'`
   is a member. Add the one-time tip in `apply` when `held === null`, the role is chem and the rig has problems: needs a
   query; add an OPTIONAL `rigProblems?(x, y, z): number` to `BrewHands` (Simulation implements it as
   `this.distill.rigAt(x, y, z)?.problems.length ?? 0`), and advise with key `rig:wrench-tip` once per BrewTools instance
   (a private boolean).
7. **Keeper**: `src/ui/screens/rig/rigGhost.ts` (NEW, section 4.10), modelled on `hearthGhost.ts`.
8. **Text helpers**: `src/ui/screens/rig/rigText.ts` (NEW, section 4.5) with every string of 4.4 as an exported constant
   or function.
9. **Screen**: `src/ui/screens/rig/rigScreen.ts` (NEW):
   ```ts
   export function createRigScreen(request: { x: number; y: number; z: number }, ctx: ScreenContext, sim: ScreenSim): GameScreen | null
   ```
   Returns null when `sim.rigView(x, y, z)` is null. Builds the `Window` (4.2), a `RigPanel` (Rig tab) and a
   `ProcessPanel` (Processes tab) as small classes in `rigPanel.ts` / `processPanel.ts` (NEW) so no file passes ~400 lines.
   Uses kit `Window`, `Tabs.setBadge`, `Toggle`, `Button`, `Badge`, `ItemIcon`, `glyph('warn')`, `glyph('chevron')`,
   `glyph('check')`, `glyph('close')`, `h`, `setText`, `setAttr`, `edgeFade`, `formatTemp`. The pack count for "have" is
   `ctx.player.inventory.count(itemKey)` (`Inventory.count`, `src/game/inventory.ts`).
10. **Register**: in `src/ui/screens/furnace/index.ts` `registerStationScreens` add
    `ui.registerScreen('rig', (req, ctx) => createRigScreen(req, ctx, sim));` and update the file comment.
11. **CSS**: `src/ui/screens/rig/rig.css`, injected by a `styles.ts` in the same folder (copy `furnace/styles.ts`'s once-only
    pattern).
12. **Docs** (section 11) and the wrench description (`src/content/items.ts`).
13. **E2E** (section 10), run desktop and phonePortrait.

Helpers to reuse, not copy: `groupProblems` logic (re-implement for `RigProblemView` as `groupRigProblems` in rigText.ts -
it is 8 lines and the types differ; do NOT import furnace types into the rig folder), `HEARTH_HIGHLIGHT_S`,
`chemKindOf`, `CHEM_KINDS`, `item` / `itemOrNull` from `src/core/registry`, `PROCESS_CARDS`, `PROCESS_BY_ID`,
`RIG_LEGEND`, `Distillery.rigAt`, `Distillery.baseTemp`, `Distillery.entityAt`, `posKey`.

---------------------------------------------------------------------------------------------------------------------------

## 9. Tests (vitest, co-located, DOM-free)

### 9.1 `src/content/recipesDistill.test.ts` (extend if it exists, else NEW)

1. `rigCells('CR/F./B.')` returns 4 cells: `B (0,0,0)`, `F (0,1,0)`, `C (0,2,0)`, `R (1,2,0)` with the right block keys.
2. `rigCells('A/V')` -> `V (0,0,0)`, `A (0,1,0)`.
3. `rigCells('B.;.B')` -> two cells, `(0,0,0)` and `(1,0,1)` (depth separator).
4. Every `PROCESS_CARDS` rig parses to at least 2 cells and every cell's block is in `CHEM_KINDS` (the legend never points
   outside CHEM).
5. `RIG_LEGEND` has no `;`, `/` or `.` key, and its values are unique.
6. `buildRig` (refactored) still builds every card (the existing `distillProcess.test.ts` stays green - run it).

### 9.2 `src/sim/rigFit.test.ts` (NEW; uses `makeKit` from `src/sim/testKit` and `buildRig` from `distillKit`)

1. `turnOffset` maps `(1, 0)` to `(1,0)`, `(0,1)`, `(-1,0)`, `(0,-1)` for turns 0..3 and is a bijection on a 3x3 grid.
2. A built `distil_syrup` rig: `fitCard(..., distil_syrup)` -> `fits[0]` has `ok 4, missing 0, wrong 0`, `touchesAnchor`.
3. The same rig with the receiver broken: `missing 1`, the missing cell is exactly where the receiver stood, its block
   `receiver`.
4. Pot still built along z instead of x (receiver at `z+1`): the best fit has `turn 1` and `ok 4`.
5. A stone where the receiver goes: `wrong 1`, `missing 0`; the status helper says `1 in the way`.
6. `refine_crude` onto a pot still (flask, base, head condenser, receiver): best fit `ok >= 3` with missing segments;
   the fit is anchored on the flask/base column (base cell ok).
7. `ferment_wash` onto a pot still: `fitCard` returns `[]`.
8. Determinism: the same world gives deep-equal results across two calls and across insertion orders of the rig map
   (build the rig twice placing blocks in different orders).
9. `placeCard` at a pinned placement after building the missing receiver: `missing 0`.
10. At most `FIT_MAX` results and at most one per turn.
11. `_done` twins count: set the flask to `boiling_flask_done`; still `ok`.

### 9.3 `src/sim/rigView.test.ts` (NEW)

1. Pot still on a lit furnace: `title 'Pot still'`, `summary '5 pieces of glassware - 1 still'`, `capabilities ['distil']`,
   `canLine 'This rig can: distil'`, `problems []`, `glass` in `CHEM_KINDS` order with names from the registry.
2. The e2e column (3 segments, 2 side draws + head, jacket on the head condenser): `title 'Column still'`,
   `cuts 3`, `capabilities` starts `['distil', '3 cuts', 'cool']`, summary ends `1 still, 3 cuts`.
3. Fermenter `A/V`: `title 'Fermenter'`, `capabilities ['ferment']`.
4. A flask on a base, nothing above: `canLine 'This rig cannot run anything yet'`, one problem `no_condenser` with
   `cells` = the flask coordinates as a `Cell`.
5. Cold base with 1000 L in the flask (no furnace lit): a derived `cold_base` problem with text `COLD_BASE_TEXT` and the
   base cell; with an empty flask: none.
6. Unknown capability fallback: stub `capabilitiesOf` to return `['heated', 'magic_hum']` on a vessel -> words include
   `magic hum` after the known ones; `catalyst:catalyst_pellets` -> `catalyst (Catalyst Pellets)` (or the raw key when the
   item is not registered yet).
7. Every `CHEM_KINDS` entry has a registry item name (guards the generic glassware list).
8. Still line text equals `Still 1 - set 130 C, holding 130 C, boiling, <litres> Sap` shape: assert with a regex
   `/^Still 1 - set 130 C, holding \d+ C, (boiling|not boiling), /` after running the rig a few seconds.
9. Work lines capped at `RIG_WORK_LINES` with `moreWork` counted (build 8 flasks on 8 bases in one rig).
10. `chemView(...).capabilities` equals `rigView(...).capabilities` for a module of the same rig; `chemView(...).text`
    is unchanged from before (snapshot the pot-still flask line against the pre-change format).

### 9.4 `src/ui/screens/rig/rigText.test.ts` (NEW)

1. `processTitle` for all 7 ids gives the 4.4 list (`Refine crude (short column)` included).
2. `cardStatus(undefined)` -> `Does not fit here`/neutral; ready -> `Ready`/good; 2 missing -> `2 to place`/warn;
   0 missing 1 wrong -> `1 in the way`/bad.
3. `makesLine(distil_syrup)` -> `{ makes: '4 Pine Sap -> 1 Syrup Beaker', back: 'Gives back 3 Glass Beaker' }` (names from
   the registry; assert against `item(k).name`).
4. `heatLines(distil_syrup, 97)` -> line `Set the Still Base to 130 °C`, mismatch `Now set to 97 °C - tap the Still Base
   with an empty hand to step it`; `heatLines(distil_syrup, 130).mismatch === null`; `heatLines(ferment_wash, null)` ->
   `No heat - it works at room warmth`.
5. `toPlace` groups missing cells by block and reads `have` from the pack function.
6. `diagram(refine_crude, fit)` -> 1 slice, 6 rows, 4 columns; `.` cells are `'air'`; a missing receiver cell is
   `'missing'`; without a fit every letter is `'none'`.
7. `ghostPayload` sends missing and wrong only, with `block` = the wanted module.
8. `groupRigProblems` folds identical texts and keeps cell order; `problemNote(1, 3, true)` ->
   `Shown in the world - 2 of 3 - close this to see it` (i is 0-based).
9. `rearm(lastTap, now, 10)` true within 10 s, false after; false when never tapped (`null`).
10. Every string in 4.4 is free of `!` (scan the exported constants).

### 9.5 `src/ui/screens/rig/rigGhost.test.ts` (NEW; fake bus recording emits, fake `RigGhostSource`)

1. `show` emits `'ghost:show'` with key `distill:card` and returns true; a fit with nothing missing returns false and emits
   nothing.
2. A `'block:changed'` inside the box -> exactly one re-emit after a microtask, even for 5 changes in one burst; outside
   the box -> none.
3. When the re-evaluated fit is complete: `'ghost:clear' { key }`, one `'toast'` `The rig matches the card: Distil syrup`,
   one `'sfx'` `machine_done` with `pitch 1.4, volume 0.6`.
4. `show` for a second card replaces (no clear in between; `isShownFor` follows).
5. `rigGhostFor(bus, sim)` returns the same keeper for the same bus.

### 9.6 `src/player/brewTools.test.ts` (extend or NEW)

1. Wrench on a chem block with `chemUse` -> null: one `'ui:open' { screen: { type: 'rig', x, y, z } }`, outcome `'screen'`.
2. Wrench where `chemUse` returns a result (stub): the result is applied, no `'ui:open'`.
3. Place cooldown > 0: no screen (outcome `'refused'`, as today for chem).
4. Empty hand on a rig with problems: the tip is advised once, not on the second Use.

---------------------------------------------------------------------------------------------------------------------------

## 10. E2E (`scripts/e2e-distill.mjs`, new steps after "the gasoline refuels a chainsaw...", before "no console errors")

Run: `node scripts/build.mjs --out=<dir>` then `node scripts/e2e-distill.mjs --out=<dir> --device=desktop` and
`--device=phonePortrait` (no `HW_GPU`). Screenshots land in `test-results/e2e-distill/<device>-<name>.png`.

1. `step('a wrench on the column opens the rig screen with its can line', ...)`:
   - setup: `window.__hw.give('wrench', 1)`; `d.selectItem('wrench')`.
   - action: `d.approach(P.col.flask)`; `d.use()`; `d.waitScreen('rig')` (waits for `window.__hw.state().ui.open === 'rig'`,
     which `src/app/debug.ts` reads from `ui.current?.type`).
   - assert: the text of `.hw-rig__can` is `This rig can: distil, 3 cuts, cool`; the window title is `Column still`;
     `.hw-rig__problem` count is 0 and `No problems - every piece is connected` is visible.
   - `d.shot('4-rig-screen')`.
2. `step('a missing receiver shows as a problem, and tapping it highlights the condenser', ...)`:
   - setup (close first with `d.closeScreen()`): `hw.setVoxel(low.x, low.y, low.z, 'air')` (the lowest side cut's
     receiver) and record `highlight:block` events: `window.__hlog = []; bus.on('highlight:block', e => __hlog.push(e))`
     through `window.__hw.app.game.state` / the bus handle the other e2e scripts use (grep `bus.on(` in
     `scripts/e2e-tech.mjs` for the exact path).
   - action: wrench Use on the column flask again; in the Rig tab press the first `.hw-rig__problem` with `d.press(...)`.
   - assert: the row text contains `drips onto nothing`; `__hlog` has one event at the condenser beside segment 1
     (`cx + 1, gy + 3, z0`) with `seconds 10`; the note `Shown in the world` is visible.
   - `d.shot('5-rig-problem')`.
3. `step('the Processes tab fits Refine crude and the ghost marks the missing receiver', ...)`:
   - action: press the `Processes` tab, press the `Refine crude` row.
   - assert: its status chip reads `1 to place`; the detail's To place row names `Receiver`; press `Show in world`;
     `window.__hw.app.game.renderer` tech stats `ghosts === 1` after a frame (`RenderStats.tech.ghosts`), or a
     recorded `'ghost:show'` with key `distill:card` and exactly one cell at the broken receiver's position, state
     `missing`, block `receiver`.
   - `d.shot('6-rig-ghost')` with the screen open, then `d.closeScreen()` and `view('7-rig-ghost-world')` (the existing
     helper) so the blue cube shows in the world.
4. `step('placing the receiver completes the card: ghost gone, chime and toast', ...)`:
   - action: `give('receiver', 1)`, `selectItem('receiver')`, place it with real input onto the cell (approach the
     condenser's neighbour cell and Use against the side face of the stone/floor - mirror how the e2e scripts place blocks,
     `d.placeHeld` / `aimAt`), or, if the geometry makes a real placement unreliable, place by `setVoxel` and say so in a
     comment (the action under test is the ghost following the world, not placing).
   - assert: a recorded `'ghost:clear' { key: 'distill:card' }`; the toast `The rig matches the card: Refine crude` is in
     the DOM (`.hw-toast`); wrench Use again shows `Ready` on the Refine crude row.
   - `d.shot('8-rig-ready')`.
5. On `phonePortrait` additionally assert that `document.documentElement.scrollWidth <= innerWidth` while the screen is
   open (no horizontal page scroll) and that each `.hw-rig__problem` and card row has `getBoundingClientRect().height >= 44`.

---------------------------------------------------------------------------------------------------------------------------

## 11. Docs to update (same PR)

- `docs/api/distillery.md`: a "Rig screen" section (opening rule, tabs, `rigView` / `rigFits` / `placeCard`, the ghost key,
  `rigCells` and the `;` separator, `ChemView` optional fields, the files table rows for `rigView.ts`, `rigFit.ts`,
  `src/ui/screens/rig/*`), the tests line (add the new test files), and the e2e line (new steps).
- `docs/api/ui-tech.md`: one paragraph "The distillery rig screen" pointing at distillery.md, noting the second ghost key
  `distill:card` coexists with `hearth:x,y,z`.
- `docs/api/furnace-screens.md`: `registerStationScreens` also registers `'rig'`; `ScreenSim` gained `rigView`,
  `rigFits`, `placeCard`.
- `docs/DISTILLERY_PLAN.md` section 15 item 1: mark built (one line, "built in Unit 6: see docs/api/distillery.md").
- The Wrench item description (`src/content/items.ts`) as in 4.1; How to Play (`src/ui/menus` HowToPlay "Building big"
  section mentions pipes and the wrench): add one sentence `A Wrench on glassware opens the rig screen: problems, what the
  rig can do, and ghosts for a process.` if the section lists wrench uses; otherwise leave it.
- Never `docs/WHATS_LEFT.md`, never `docs/build/SYSTEMS.md` (coordinator).

---------------------------------------------------------------------------------------------------------------------------

## 12. Acceptance checklist

- [ ] Wrench + Use on any chem module opens the rig screen; empty-hand and container behaviour unchanged (tests 9.6).
- [ ] The can line reads `This rig can: distil, 3 cuts, cool` on the e2e column and `This rig can: ferment` on a
      fermenter (9.3).
- [ ] Problems are the scan's words verbatim plus `cold_base` / `over_glass`; a tap emits `'highlight:block'` with
      `HEARTH_HIGHLIGHT_S`; folded groups cycle; closing re-arms (9.4, e2e 2).
- [ ] Every card row shows a status; a card opens to a diagram, a To place list with have/need, a heat line and controls.
- [ ] Show in world emits `'ghost:show'` key `distill:card` with only missing/wrong cells; the ghost is pinned, follows
      block changes, clears with toast + `machine_done` when complete; stays after close; can be turned off from any rig
      screen (9.5, e2e 3-4).
- [ ] No hand-written module / capability / problem / card list in code (review grep: no string `'boiling_flask'` etc. in
      `src/ui/screens/rig/` or `rigView.ts` except through `CHEM` constants; `capabilityWords` has a fallback).
- [ ] The glassware list is built by iterating `CHEM_KINDS` (code review) and every kind has a registry name (9.3 test 7),
      so a kind Unit 0 / 8 / 11 adds appears with no rig-code edit.
- [ ] Phone: 390 x 844 and 844 x 390 screenshots show no clipped text and no horizontal page scroll; every target >= 44 px
      (e2e 5).
- [ ] `npm test` green; `npx tsc --noEmit` clean; `node scripts/e2e-distill.mjs --device=desktop` and
      `--device=phonePortrait` pass with screenshots 4-8.
- [ ] Docs of section 11 updated.

---------------------------------------------------------------------------------------------------------------------------

## 13. Out of scope

- The PROCESS tab of DISTILLERY_PLAN 12 (thermometer with each component's boiling point, contents bars per module, live
  outputs) - a later polish unit; the At work lines carry the essentials.
- "One more Column Segment would add: Kerosene" (DISTILLERY_PLAN 7 / 13 step 14): needs a what-if scan over every kind;
  left for a later unit. The picker's "1 to place" already answers "what next" for a chosen card.
- A Codex link from the screen; drawing rig diagrams in the Codex page (the Codex is owned by the scripts / Unit 12).
- Opening the screen without a wrench (empty hand keeps its setpoint / line behaviour).
- Any new scan rule, problem code in `scanRig`, module, card, sound name, or reaction.
- Saving ghosts or screen memory.
- A HUD control to dismiss a ghost away from any rig (same known gap as the hearth ghost).
- Auto-turning the camera to a highlighted block.

---------------------------------------------------------------------------------------------------------------------------

## 14. Notes for the coordinator

1. **Legend letter clash.** DISTILLERY_PLAN 7 writes `P` = pressure cap and `i` = port, but the code's `RIG_LEGEND` has
   `P: 'chem_port'`. Code wins. Units 8 and 11 must pick new letters; suggested reservations (please put them in SYSTEMS
   section 6): `U` vacuum_cap (8, as SYSTEMS J1 already says), `X` filter_bed (8), `K` catalyst_bed (11), `H` reflux_head
   (11), `Q` pressure_cap (11), `S` steel_flask (11). `;` `/` `.` are reserved by the rig-string format (Unit 6 tests it).
2. **Refinery tower and ghosts (J6).** A planar rig string cannot describe a cuboid tower. Unit 6 adds the `;` depth-slice
   separator to `rigCells` so Unit 11 can write a tower card; Unit 11 must also surface the tower's problems through
   `Rig.problems` (with cells) for the rig screen to list them. If Unit 11 keeps the tower in a separate `refineryScan`,
   it must merge that scan's problems into the Rig returned by `rigAt` for any tower cell.
3. **Titles.** Unit 11 may add `Refinery tower` as the first title rule (`rigTitle` in rigView.ts) - a one-line edit.
4. **Unit 7 wording.** `COLD_BASE_TEXT` ("The Still Base is cold - light the furnace under it") should become "... light
   the furnace under it or burn fuel in it" when the ground burner lands; Unit 7 owns that edit.
5. **Unit 12 sound.** The ghost-complete chime is `machine_done` pitch 1.4 volume 0.6; Unit 12 may switch it to its
   `glass_chime` (one call in `rigGhost.ts`).
6. **Unit 0 dependency.** Unit 6 reads `Distillery.capabilitiesOf`; section 8 step 0 makes it robust if Unit 0 lags.
7. **Reflux head wrench.** SYSTEMS J6 / DISTILLERY_PLAN 12 give the wrench on a `reflux_head` to Unit 11 (cycle). Unit 6
   respects it by asking `chemUse` first. Unit 11 must implement the cycle inside `chemUse` (held `'wrench'`) for this to
   work; if it implements it elsewhere (before BrewTools), nothing breaks either.
8. Ownership-table addition for SYSTEMS 6.2: `rigCells` (and the `;` separator) defined by 6, consumed by 11.
