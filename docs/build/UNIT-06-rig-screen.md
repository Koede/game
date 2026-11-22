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
