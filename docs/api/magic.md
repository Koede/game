# Essentia & Research (src/magic) - API note

Design: `docs/OVERHAUL_PLAN.md` part B. Original names; Thaumcraft is only the inspiration.

## Data (pure, no registry import unless noted)
- `aspects.ts`: `PRIMALS` (cinder, loam, brook, gale, rune, rift), `COMPOUNDS` (12, each two primals), `LATE` (spark, soul, void),
  `ASPECTS` (name, tier, parts, meaning, colour), `kin(a, b)` (equal or direct component), `kinOf`, `aspectsText`.
- `aspectTable.ts`: THE table: `KEYWORD_RULES` (key word -> aspects), `CATEGORY_BASE`, `AGE_BONUS_PER_AGE`, `OVERRIDES`, caps.
- `fingerprint.ts` (imports the registry): `aspectsOf(key)` for every block/item key, memoised, deterministic. Order: override,
  else first recipe making it (inputs summed / output count, +1 craft, + the key's own words), else keyword rules + category +
  age bonus; then the 4 strongest, clamped 1..8. `resetFingerprints()` for tests.
- `board.ts`: 5 x 5 research board. `BoardSpec { anchors, blocked }`, tokens `Record<cell, Aspect>`, `boardSolved`,
  `solveBoard(spec, aspects)` (BFS over cell x aspect, joins anchors one by one), `boardHint`.
- `entries.ts`: `RESEARCH` (7 entries: field_notes, glassware, gathering_rod, essence_jar, still_trace, warm_hearth,
  aura_reading) with `requires`, `board`, `unlocks { recipes, flags }`, age by name. `ageMap.ts`: `AgeName`, `ageIndexOf`.
- `research.ts`: `ResearchState { v, scanned, known, lore, entries }`, `freshResearch`, `scanObject` (first scan: lore = amount
  capped at 4 per aspect, teaches unknown aspects, finishes board-less entries), `placeToken` / `removeToken` (spend / refund
  1 lore), `hintFor`, `unlockedRecipes`, `hasFlag`, `sanitizeResearch`.
- `gates.ts`: `RESEARCH_GATES` (recipe id -> entry, derived from the entries), `craftGateReason(state, recipeId)`.

## Runtime (`magic.ts`, class `Magic`, one per world, owned by `Game` in src/app/game.ts)
- `use(target | null)` - called first by `Interaction.beforeUse`: notebook (scan block / open the 'notebook' screen at the sky),
  gathering rod (1 unit per Use from the richest aspect of the blocks within 3; 4 units fill one empty `glass_vial` into
  `vial_<aspect>`; the land's draw per 16 x 16 chunk recovers 1 unit / 30 s), vial or empty vial on an `essentia_jar`
  (32 units of one aspect), Vial of Cinder on a burning furnace (+90 s fire, needs research `warm_hearth`; hook `stokeFurnace`).
- `craftGate(recipeId)` is installed with `setCraftGate` (src/game/crafting.ts); `craftByPlayer` refuses gated recipes with the
  reason. Gated now: `glass_vial` (forge), `vis_rod`, `essentia_jar` (workbench). The solver treats them as craftable.
- `notebook(): NotebookApi` for the UI; `jarText(x,y,z)` names a jar under the crosshair; `toJSON()` / `load()` persisted with
  `world.persist('magic')` (research, jars, draws); damaged data is dropped, never thrown.
- Content: `src/content/itemsMagic.ts` (field_notebook, glass_vial, vis_rod, 21 `vial_<aspect>`, block essentia_jar),
  `recipesMagic.ts`, fixture `specRosterMagic.ts`; icons `src/render/textures/iconsMagic.ts`; progression solver: rod + vial
  gives every vial (source 'gather').

## UI
`src/ui/screens/notebook/notebookScreen.ts` (`createNotebookScreen(ctx, api)`, registered by Game as screen 'notebook'):
tabs Research (entry chips, text, 44 px board, aspect chips with lore, Take back, Hint), Aspects, Notes (scan carried items).

## Tests and checks
`src/magic/*.test.ts` (fingerprints cover every key, boards solvable with each age's aspects, state, runtime with a fake world);
`node scripts/e2e-magic.mjs [--no-build] [--device=desktop|phonePortrait]` (scan, notebook, gated vial, board by taps, forge,
rod, jar), chained in `npm run e2e`.

## Not built yet (see OVERHAUL_PLAN B and SESSION_CONTEXT 10)
Jar fill rendering, wellsprings/nodes, essentia tubes, rune desk, infusion altar, foci, servants, vial in a still (entry
`still_trace` exists, its effect does not), aura reading HUD, Codex aspect page, optional side objectives, scan of creatures.

## Glassware (src/content/itemsGlass.ts) - vials in the chemistry
- A Glass Vial works wherever an empty Glass Beaker is taken: the sap tap (`src/player/sapTools.ts`) and taking liquid from a
  distillery module (`src/sim/distillActions.ts` maps the vial to a beaker); both hand back beaker-sized fills. Sugar has a
  vial row (`sugar_vial`, forge). Vials and beakers are made at the same rate (1 glass -> 2).
- Beaker of Water / Vial of Water (filled at the workbench from a water bucket, 4 at a time) set on a hot furnace top on their
  own boil through the brewing `boil_bucket` machine (`CONTAINER_BLOCKS` in src/core/brewing.ts): `ContainerSpec.boilScale`
  makes a beaker boil in half, a vial in 0.3 of a bucket's time. Boiling ones cool like the boiling bucket and brew a cup
  over a loaded cone (the glass comes back); a kettle fills an empty beaker/vial with boiling water.
- A Pine Sap beaker on a furnace top cooks to resin (`ContainerSpec.holds: 'sap'`, `returns: 'glass_beaker'`): it never boils
  dry, never counts as water (registry `containerBoilingTo` / `containerEmptiedTo` and the solver filter on `holds`).
- Tests: `src/sim/glassware.test.ts`, `src/player/glassTap.test.ts`; e2e-magic step "a vial of water ... boils".
- Not yet: a slimmer shape for glass on the furnace (it uses the bucket shape), filling glass straight from water.
