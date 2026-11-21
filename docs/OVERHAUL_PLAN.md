# Overhaul plan - the Bronze workshop (Create-style kinetics) and Essentia & Research (original magic)

Status: written 2026-11-21 by the overhaul session. Style follows STEAM_PLAN.md: contracts, numbers, files, tests, an ordered
work list with acceptance checks. All numbers are starting values and live in `src/content` / `src/magic`.

Owner steer (2026-11-21, mid-session): "we already have some Create mechanics with the rotation stuff, so just fill that whole era
in with goodies and trinkets and fun modular things." So part A does NOT redesign the kinetic core; it adds a large catalogue of
parts that plug into the shaft / speed / stress contract of STEAM_PLAN section 1 and BRONZE_PLAN. Owner's earlier words for magic:
"Thaumcraft research based magic unlocking over time from essentia for every block would be a perfect addition."

## 0. Ground truth (checked against the repo, 2026-11-21)

- The rotation system (`MechSpec`, axles, cogs, `mechGraph.ts`, `mech.ts`) is a PLAN. `grep MechSpec src/core` finds nothing; there
  are no shaft blocks in `src/content`. Everything in part A that says "mech" is written against the STEAM_PLAN contract
  (`MechSpec { role, rpm, capacity, minRpm, stress, maxRpm, cog }`, `MECH_BASE_RPM = 16`, events `mech:seized/freed`) and is built
  AFTER STEAM_PLAN items W1-W3 land. Part A therefore ships in two layers: (1) pieces that need no rotation today (goggles,
  funnels, chutes, depots, basins, belts driven by a hand crank through a tiny provider interface, section A.9) and (2) the
  rotation consumers, which are content rows plus a `MechSpec` the moment the core exists.
- Layering: core <- content <- world, game <- sim <- render, audio <- player, ui <- app. `src/player` and `src/ui` never import
  `src/sim` values. All numbers in content or constants. Voxel bits: id 10, facing 2, active 1, variant 3.
- Content is mirrored by a test fixture (`src/content/specRoster*.ts`, counted in `content.test.ts`). New content adds its own
  `specRosterMagic.ts` / `specRosterWorkshop.ts` and a one-line merge in `specRoster.ts` plus the count line in `content.test.ts`.
- Five furnace tiers and five ages exist in code until BRONZE_PLAN W0 (six-age renumbering). Everything here is keyed by AGE NAME
  (`'ember' | 'bronze' | 'forge' | 'current' | 'atomic' | 'star'`) through one map, `src/magic/ageMap.ts` (section C.1), so W0 changes
  one file. Today `ember = 0 (Clay Furnace tier 1)`, `bronze = 1` placeholder, `forge = 2`, `current = 3`, `star = 4`.
- Handwork stations (Ember) already exist: chopping block, quern, anvil, rack, trough, loom, clay table, mortar (`src/sim/handWork.ts`,
  stroke-based). Ground items exist (`src/game/collectors.ts`, entity drops). Fluid / item pipes and the distillery mixture model
  (`src/core/chem.ts`) exist. Ember = handwork only; machines begin in Bronze; electricity in Current.

## A. The Bronze workshop (Create-style, adapted, original names)

### A.1 Gaps found (what a kinetic-contraption player expects and Hearthwatt lacks)

| gap | today | answer in this plan |
|---|---|---|
| see speed and stress | nothing (power is watts, no inspector) | Engineer's Goggles (A.3) |
| belts / carry items between machines | item pipes only (instant, no spacing); ground items just lie there | Belts, chutes, funnels, depots (A.5) |
| direction of rotation, ratio, clutching | planned axle/cog/junction/clutch only | reverse gearbox, differential, ratio dial, sequenced gearshift (A.2) |
| overload protection | planned seize only | shear pins, governor, flywheel (A.2) |
| machines doing what hands do | hand stations are stroke-based only | machine twins of every hand station (A.6) |
| arms that place / use / mine | tractor only (Current) | deployer and mechanical arm (A.7) |
| basin processing (mix, press, fill) | none | basin, press, mixer, spout, drain (A.6) |
| moving structures | none | bearing, rail skiff; piston as stretch (A.8) |
| tie-ins with fluids | lubricant is on the distillery list | lubricant raises stress capacity (A.2) |

### A.2 Transmission, sources and safety parts (mech layer; all Bronze unless noted)

Numbers use STEAM_PLAN units (rpm, stress units "su"). `rev` = reverses rotation direction (needs `dir: 1|-1` per node, added to the
solve as a sign; chains of gears alternate).

| key | role | numbers | recipe (bench/furnace, Bronze unless noted) |
|---|---|---|---|
| hand_crank | source | 8 rpm, capacity 8 while a player holds Use (1 stroke = 2 s) | workbench: 3 plank, 1 stick, 1 cord |
| treadwheel | source | 12 rpm, capacity 24 when a tame animal or the player stands on it | workbench: 10 plank, 2 bronze_ingot |
| clockwork_motor | source + store | winds with Use (each wind +30 s); 24 rpm, capacity 48 while unwound | furnace T2: 3 bronze_ingot, 1 spring, 1 small_cog |
| spring | material | coiled bronze wire | furnace T2: 1 bronze_ingot -> 2 |
| reverse_box | junction, `rev` | inverts direction of one output | furnace T2 700: 2 bronze_ingot, 2 small_cog |
| split_box | junction | 1 in, 2 out; stress shared | as bronze_gearbox +1 small_cog |
| ratio_dial | junction | Use cycles ratio 1:2, 1:1, 2:1, 3:1 (variant bits); output rpm = in x ratio; stress scales inversely | furnace T2: 2 bronze_ingot, 1 large_cog, 1 stick |
| differential | junction | output = (a+b)/2 rpm, adds capacity; two inputs may be opposed | furnace T2: 3 bronze_ingot, 2 large_cog |
| drive_belt | cog pair link | joins two parallel axles up to 9 blocks apart, ratio from the two pulleys' sizes; stress overhead 1 su | workbench: 4 leather, 2 small_cog (pulley_small/large items) |
| chain_link | cog pair link | like drive_belt, range 16, no slip, max 128 rpm | furnace T2: 6 bronze_ingot |
| worm_gear | cog | 1:8 reduction, only drives from the worm side (cannot back-drive) | furnace T2: 2 bronze_ingot, 1 large_cog |
| sequence_gearshift | junction + program | engages / reverses / ratio changes on a loop; program = punched card (item), 8 steps x (rpm ratio, direction, seconds) | furnace T2 750: 4 bronze_ingot, 1 clockwork_motor; card = workbench: 1 paper, 1 flint |
| shear_pin | axle part | breaks at 1.5x rated stress instead of seizing the net (item returned as `bent_pin`; re-forge for 1 copper) | workbench: 1 copper_ingot -> 4 |
| governor | gauge-like | caps net speed to a notch (Use cycles 32/64/96 rpm), bleeds the rest as steam hiss | furnace T2: 2 bronze_ingot, 1 flywheel |
| lubricant_can | item | Use on any axle/cog/gearbox within the net: net stress capacity x1.25 for 10 minutes; fuel = Distillery `lubricant` fluid (DISTILLERY_PLAN 15 leftover). Without the distillery: tallow from the trough gives x1.10 | furnace T2: 1 bronze_ingot, 1 pail; refill by Use on lubricant fluid or 1 tallow |
| speed_gauge, stress_gauge, flywheel, clutch, bronze_gearbox | as STEAM_PLAN | unchanged | unchanged |

Rule: every part has a one-line status sentence (shown by goggles) per BRONZE_PLAN section 10 style, e.g. "Reverse box: turning left, 24 rpm".

### A.3 Engineer's Goggles (inspector)

- Item `engineer_goggles` (head slot is NOT needed; carried in the pack or held). While in the pack, aiming at any machine or
  shaft part adds a second HUD target line: speed, stress used / capacity, direction arrow, and the limiting part (lowest `maxRpm`).
  Also shows for existing machines today: power W in/out, fluid level and temperature, furnace heat, item buffer counts.
- Implementation: a pure function `inspect(view): string[]` in `src/game/inspector.ts` over the machine views the sim already
  exposes (`machineView`), plus an optional `mechView` provider (null until the rotation core exists). The HUD target line gets
  one extra hook, no new screen. Recipe: furnace T1 (so it exists in Ember's top): 2 copper_ingot, 1 glass, 1 leather.
  Gate: Bronze. Test: lines for a furnace, for a battery, for a null aim.

### A.4 Mechanical hand-station twins (tie-in with the handwork stations)

Same recipes as the hand stations (read from `src/content/recipesHand.ts`), but driven by shaft power so the stroke count is
replaced by time; a hopper above and a chute below make them automatic. Each is a consumer with `minRpm 16`.

| machine | hand twin | stress | speed | output rule |
|---|---|---|---|---|
| mech_quern | quern | 4 | recipe seconds / (rpm/16) | same recipes, outputs to chute below |
| mech_hammer | anvil/trip hammer | 8 | 3 s per plate at 16 rpm | plates and tools heads; ignores hot-window, uses held-hot depot |
| mech_loom | loom | 4 | cloth 6 s | reads cord/fibre from a funnel |
| mech_rack | rack | 2 | dry-time x0.5 | weather independent |
| mech_mortar | mortar | 4 | crush 2 s | crushed ore, 25% double yield like the hand mortar |
| trip_hammer, millstone, saw_bench, mech_bellows, mech_pump, mech_drill, draft_fan | STEAM_PLAN | as listed there | | |

### A.5 Logistics: belts, funnels, chutes, depots (works today, no rotation required except where noted)

- `belt` (block, shape 'axle'-like slab, 4 directions + corner states via variant): carries GROUND ITEMS standing on it at
  1 block per 1.0 s at 16 rpm (hand crank gives 8 rpm = half). Item entities on a belt cell get a velocity vector; nothing is
  teleported, so it uses the existing ground-item entity and its physics. Length cap 24 per run; stress 1 su per 4 cells.
  Recipe: workbench 8 leather-or-cloth + 2 stick -> 8 belt. Corner / lift (belt ramps 1 up) by facing + variant.
- `funnel` (block): one-way item gate; takes items from a belt/depot/inventory above, drops to a belt/chute; has a filter slot
  (Use with an item to set it). `brass`-style names are avoided: `hopper_cone` is the art name.
- `chute` (block): 1-block vertical pipe that drops ground items one at a time; stacks into a long drop.
- `depot` (block): a flat plate that holds 1 item stack in the world (visible); machines above/beside read it (hammer works the
  depot item; deployer uses it; arm picks it). Stays a ground item entity pinned to the block.
- `item_vault` (stretch): 2x2x? multiblock inventory of 4x the crate.
- `basin` (block): holds up to 2 items + 1 fluid (1000 L) in the world. Mixer / press act from above; spout fills from the side;
  `item_drain` empties containers (bucket, vial) into a fluid pipe.
- `spout`: fluid pipe end that fills a container on a belt or depot beneath it (vial, bucket, beaker); the distillery output goes
  through spouts to bottle fluids.
- `mech_press`: consumer (min 16 rpm, stress 8). Presses items in a basin or on a depot: plates (2 ingots -> 1 plate), pressing
  seeds for oil, flattening dough. `mixer`: consumer (min 32 rpm, stress 6): combines basin contents (flour+water, alloys cold,
  potion bases, resin+sand glue) using `recipesWorkshop.ts` rows `basin:<id>`.
- Arrangement targets for the e2e: grain field -> belt -> funnel -> mech_quern -> chute -> basin + water -> mixer -> dough.

### A.6 Fun small modular things ("trinkets")

All Bronze, cheap, each a block or item with a purpose and a one-line status:

- `wind_vane` (shows `windAt`, feeds windmill placement), `weather_cock`; `bell` (rings when any machine in 12 blocks seizes);
  `tally_board` (counts items passing a belt cell: Use to reset); `metronome` (pulses a signal every N seconds for sequence
  gearshifts); `pressure_plate` / `trip_wire` (signal sources: signals are a 1-bit cheap link read by deployers, gearshifts, gates);
  `signal_lamp`; `crank_lever`; `spyglass`; `brass_horn` (bronze horn that calls tamed animals: see mobs.md); `padlock_chest`;
  `lantern_chain` (chain link item decor); `clockface` (block that shows the sim time as an animated dial); `rail` + `ore_skiff`
  (simple rail cart for hauling ore; boarding as a seat, 6 blocks/s, gravity-assisted).
- Decor-and-use: `gear_frame` (decorative cog wall tile that turns when attached to a net), `shaft_cover` (hides an axle).
- Signals are NOT redstone: one signal layer `src/sim/signal.ts` (planned), a 15-step decaying link along `signal_wire` and
  touching blocks. Only slice-3 stretch; the plan reserves the name.

### A.7 Arms and deployers

- `deployer` (consumer min 16 rpm, stress 8): faces a block; each cycle (2 s at 16 rpm) takes the item in its depot/hand and
  Uses it on the block in front (place a block, till soil with a hoe, strike with a tool, bucket empty/fill, apply an item to a
  station: calls the SAME player `Interaction` code with a "machine actor" whose position is the deployer's face, reach 1.5).
  Strikes at hand stations drive `sim.stroke`. Cannot open screens; cannot attack mobs at first.
- `mech_arm` (consumer min 16 rpm, stress 6): picks from the first source it finds within 3 blocks of its base (depot, belt end,
  crate, machine output buffer) and drops at the target(s) set by two Use clicks with the wrench (source, target; up to 4 targets
  round robin). Cycle 1.5 s at 16 rpm. Reads filter funnels.
- `mech_saw_arm`: deployer + axe tool head: fells and cuts a trunk using `src/game/felling.ts` (chainsaw logic, slower, no fuel).
- `reaper` (consumer, min 16, stress 6): harvests a 3x3 of ripe crops in front, outputs to a chute (the Bronze tractor harvester).
- Test: a deployer on a quern station finishes a hand recipe with no player stroke (golden) once the rotation core exists.

### A.8 Contraptions (stretch, last)

- `bearing` (consumer): rotates an attached platform of up to 4x4 blocks 90 deg per step by a signal; blocks are not rotated
  physically in v1: the platform swaps between pre-baked "positions" (cheap: a ring of ghost voxels). A full contraption entity
  system is out of budget; the plan only fixes the name and interface `Contraption { cells, pivot, step() }`.
- `rail` / `ore_skiff` as in A.6 is the cheap "minecart equivalent".

### A.9 Interim drive for pieces built before the rotation core

`src/sim/mechLite.ts` (planned, small): `driveAt(x,y,z): { rpm: number; dir: 1|-1 } | null` reading hand cranks only (a crank
adjacent to a belt / quern / press drives it at 8 rpm for 2 s per Use). It is deleted when `mech.ts` lands; consumers call the
same function name through a provider so nothing else changes.

### A.10 Ties to the rest of the game

- Distillery: lubricant (A.2); `spout` bottles distillate; `basin` + mixer makes potion bases (B.8).
- Tractor / chainsaw: deployer arms re-use their felling and tilling code; `reaper` is the earlier tool.
- Ground items: belts, chutes, depots are all ground-item physics; the vacuum pump and the planned electromagnet remain a
  separate collector mechanism.
- Ages: pieces marked Bronze go to `bronze` in the age map; heavy ones (vault, bearing) `forge`.

### A.11 Ordered work (A)

| id | work | acceptance |
|---|---|---|
| A1 | `engineer_goggles` + `src/game/inspector.ts` + HUD hook | unit: inspect lines; e2e screenshot of a furnace readout |
| A2 | belts, chute, funnel, depot (hand-crank drive via mechLite) | unit: item on belt advances 1 cell/s at 16 rpm; e2e: item carried 6 cells into a chest |
| A3 | rotation consumers (quern/hammer/loom twins, press, mixer, basin) | after STEAM_PLAN W1-W3: golden run: field -> dough automated |
| A4 | deployer + arm | unit with a fake actor; e2e: deployer tills and plants |
| A5 | transmission parts (reverse, ratio, differential, belts-drive, sequence, shear pin, governor, lubricant) | solver unit tests per part: speed, sign, stress |
| A6 | trinkets and signal layer | per item unit test + codex entries |
| A7 | rail / skiff, then bearing | stretch |

## B. Essentia and Research (original magic)

Design pillars: (1) every block and item has an aspect fingerprint derived by rules from one table; (2) the notebook teaches the
player aspects by SCANNING; (3) research entries are unlocked by solving a small board with aspects; (4) magic is modest: it saves
trips, unlocks conveniences and a few spells, never replaces the furnace/tech spine; (5) nothing in the progression is ever gated
behind magic in a way the solver cannot prove (B.9). Original names throughout.

### B.1 Aspects (21)

Primal (6, scanned directly): `cinder` (heat, fire), `loam` (solid, earth), `brook` (flow, water), `gale` (air, motion),
`rune` (order, structure), `rift` (breaking, entropy).

Compound (12 = a pair of primals; two aspects are "kin" when equal, or one is a component of the other):

| aspect | = | meaning | | aspect | = | meaning |
|---|---|---|---|---|---|---|
| glow | cinder+gale | light, energy | | spring | loam+brook | growth, life |
| vein | loam+rune | metal, crystal | | frost | brook+gale | cold, mist |
| ash | cinder+rift | ruin, burnt | | wane | brook+rift | decay, rot |
| drive | gale+rift | force, motion (kinetics) | | craft | rune+cinder | making, tools |
| mind | rune+gale | thought, scrying | | ward | loam+rift | shelter, defence |
| steam | cinder+brook | pressure, boil | | clarity | brook+rune | glass, purity |

Tier 3 (late, 3): `spark` = glow+drive (electric), `soul` = spring+mind (creatures, constructs), `void` = wane+ward (emptiness, storage).

### B.2 Fingerprints (one data table)

`src/magic/aspectTable.ts` holds all data; `src/magic/fingerprint.ts` derives `aspectsOf(key: string): Aspects` (a record of at most
4 aspects, amounts 1-8) for EVERY block key and item key in the registry, memoised, deterministic, no randomness.

Derivation order (first rule that applies wins for "raw" objects; crafted objects use their recipe):
1. `OVERRIDES[key]` (hand-authored, about 40: furnace tiers, special items, mobs).
2. A raw object: sum of every `KEYWORD_RULES` hit on the key (`ore` -> vein 3 + loam 1, `log` -> spring 2 + craft 1, `water` -> brook 4,
   `lava` -> cinder 5 + rift 1, `glass` -> clarity 3, ...), then `CATEGORY_BASE[category]` (block: loam 1, material: craft 1,
   tool: craft 2, food: spring 2, ...), then `TIER_BONUS` by item age/tier (+1 to the strongest aspect per tier above 0).
3. A crafted object (has a recipe in `RECIPES`): sum of the first recipe's inputs' fingerprints divided by output count,
   rounded up, plus `craft` +1 (machines and tools) or `rune` +1 (structures); cycles are cut by marking an in-progress key.
4. Reduce to the 4 strongest (ties by aspect order), clamp amounts 1..8, drop zeros. Every key must end with at least one aspect.

Tests: determinism (twice equal), coverage (every registry key has >= 1 aspect), amounts in range, kin graph connected,
primal aspect reachable from the starting inventory (stick/fibre/stone give loam, spring, craft).

### B.3 Aura and nodes

- Aura: per 16x16 chunk, per primal aspect, level 0..64. Base from biome (`BIOME_AURA` table) with a deterministic hash tweak;
  `aura.sample(x, z, aspect)` is O(1), no storage. Draws are stored as deltas `{chunkKey: {aspect: -n}}` and recover 1 per
  minute per aspect (lazy: store the time of the draw, recompute on read).
- Wellsprings (nodes): rare world-gen features (about 1 per 8x8 chunks), one primal or compound aspect, a glowing crystal over
  stone. They emit 1 essentia per 20 s into an adjacent jar or a tube (B.5), and boost nearby aura x2 within 24 blocks. Placed by
  `src/magic/nodes.ts` from the world seed (no world-gen edits: they are found by scanning near each chunk's hash; rendered as a
  decorative entity). Slice 2 does aura + rod; nodes are slice 2b.
- Ages: aura/rod in Ember (small amounts, only `loam/spring/cinder/gale/brook/rune` primals), nodes from Bronze, compounds drawn
  from nodes only from Forge, tier-3 aspects only through research.

### B.4 Containers and the rod

- `essentia_vial` (item, stack 16; glass): holds 8 units of ONE aspect (an NBT-like `{aspect, n}` stored in the stack's
  `meta` field). `essentia_jar` (block, glass + wood, holds 64 of one aspect, accepts a vial by Use, empties into a vial).
  `essentia_tube` (block, reuses the fluid pipe machinery: carries one aspect per tube segment run; 4 units/s). Jars show a
  coloured level in-world (no UI screen needed).
- `vis_rod` (item, 3 tiers: wood/bronze/iron): Use on the ground or in the air gathers `rodPower` units per second of the
  selected aspect (Use on a jar to cycle) from the aura into the rod's internal charge (cap 16/32/64), then Use on a vial or
  jar to pour. Rod upgrades come from research. Original name; no Thaumcraft wand names.
- Sound/FX: a soft chime and a faint coloured mote trail toward the rod (render/magic, <= 24 particles).

### B.5 Essentia in existing systems (the interlocks)

- Alchemical furnace tie-in: a `rune`/`cinder` jar next to the furnace (or vial in the fuel slot) adds 10% burn time per 4 cinder.
- Distillation: `essentia_vial` in a still adds its aspect as a trace component to the mixture (distillery `chem.ts`); a `clarity`
  vial purifies (removes the `water` component penalty); gives magic its first use in the potion chain.
- Golems/constructs (`soul`, Forge): a "clay servant" mob construct that runs a hand crank, carries belt items, tends a deployer
  (modest: 1 task, walks 8 blocks). Built at the Infusion Altar (B.6).
- Infusion altar (Bronze late): pedestals around a central block; consumes essentia from adjacent jars to turn an item into a
  higher item (e.g. `bronze_ingot` + 4 vein -> `vein_bronze` lamp-lit alloy; `clay_servant`).
- Aspect costs in crafting: the `rune_desk` (arcane-bench equivalent) recipes cost essentia pulled from vials in your pack or
  jars within 3 blocks, besides ingredients.

### B.6 Research system

State per player (`ResearchState`, pure data, `src/magic/research.ts`):

```ts
interface ResearchState {
  v: 1;
  scanned: string[];                 // object keys (blocks, items, creatures) the player has scanned
  known: Aspect[];                   // aspects learned (primals start known: cinder, loam, brook, gale... see below)
  lore: Partial<Record<Aspect, number>>; // spendable "lore" points per aspect, earned from scans
  entries: Record<string, { state: 'locked' | 'open' | 'done'; board?: BoardState }>;
}
```

- Notebook item `field_notebook` (made at the workbench from 3 paper-ish `cloth`/`leather`, 1 stick, from minute one so it is the
  first magic touch). Use aimed at a block, ground item or creature = SCAN it: first time yields lore equal to its fingerprint
  amounts (capped 4 per aspect per scan), a second scan of the same key yields nothing and says so. Use at the air opens the
  notebook screen (phone friendly: list of scanned things, aspect chips, research list, board).
- Aspects are taught on scan: scanning an object whose fingerprint has an unknown aspect makes it known. Starting known:
  `loam`, `spring`, `craft` (what a first stick or stone teaches); everything else is learned by scanning.
- Research entries (`src/magic/researchEntries.ts`), each: `key, title, text, age, requires: key[], cost: Partial<Record<Aspect, number>>
  (lore spent as board tokens), board: BoardSpec, unlocks: Unlock[]`. `Unlock = { recipe: id } | { block/item: key } | { rodTier: n } |
  { focus: key } | { flag: string }`.
- Board (kept simple, phone friendly): a 5 x 5 square grid. A `BoardSpec` has 2-3 fixed anchor cells holding aspects and optional
  blocked cells. The player taps a cell then a palette aspect (palette = known aspects with lore > 0) to place a token (spends 1
  lore of that aspect, cancelling refunds it). Solved when every anchor is connected to every other through a 4-neighbour path of
  tokens in which each adjacent pair is KIN (same aspect or component relation; see B.1). Anchors count as nodes in the path.
  Because kinship is a graph, a puzzle between `cinder` and `rift` needs `ash` in the middle (1 token) - teaching combinations.
  Solver `solveBoard(spec, available)` (BFS over aspect assignments of free cells, bounded) proves each entry solvable and gives
  a hint; the UI offers "Hint" costing nothing but 30 s cooldown.
- Entries per age (starting list; ~28 total): Ember (6): `notes` (opens notebook; free), `glassware` (unlocks essentia_vial),
  `vis_rod_1`, `jar` ...; Bronze (9): `aura_reading`, `wellsprings`, `infusion`, `rune_desk`, `lamp_of_vein`, `scry_lens`,
  `distill_trace`, `clay_servant_notes`, `rod_2`; Forge (9): `rod_3`, `compound_draw`, `focus_blink`, `focus_ward`, `servant_arm`,
  `soul`, `void_jar`, `tubes`, `foci_2`; Current+ (4, stretch): `spark`, `focus_light`, `warded_home`, `star_light`.
- Spells/foci (Forge): a focus is an item slotted into the rod: `blink` (short hop, 8 cinder... ), `ward` (a 10 s damage cut),
  `light` (place a floating light). All consume rod charge; small numbers; no griefing.

### B.7 UI (phone first, in-world first)

- Scanning is in-world with a short reticle ring and a toast "Scanned: Copper Ore - gained 1 vein, 1 loam".
- One screen only: the notebook (`GameScreen` `'notebook'`), tabs `Scanned | Aspects | Research`. Research tab lists entries and
  opens the board. Cells are 44 px (finger), palette chips 44 px, no drag; tap-tap placement. Portrait-friendly single column.
- HUD: none new; a small aspect-chip row appears under the target name when the notebook is held and the aim has a known
  fingerprint ("loam 2, vein 3").

### B.8 Interaction with progression and objectives

- Gate mechanism: `src/magic/gates.ts` holds `RESEARCH_GATES: Record<recipeId, researchKey>`; the crafting entry (inventory
  crafting and workbench, and `furnace` rows only if marked) asks `isUnlocked(research, recipeId)`. Magic items are crafted only
  at ordinary stations; recipes whose id is not in the table are never gated.
- `progression.ts` (the solver) stays unchanged for the tech spine. It gets one new assertion (`src/magic/gates.test.ts`): every
  research entry is (a) obtainable from scanning objects reachable at its age and (b) the gated recipe's own ingredients are
  obtainable without any other gated recipe, so skipping magic never blocks completion and research never needs items you cannot
  yet own. The winning path never requires a gated recipe (test enumerates gated outputs vs the required-item closure of `game:won`).
- Objectives: three optional side goals (flag based, not on the sequential track): `scan_ten` (10 scans), `first_research`
  (done any entry), `essentia_in_still`. Added with a one-line import in `objectives.ts` when slice 1 lands.

### B.9 Save/load shape

- Player: `PlayerSave.magic?: ResearchState` (`save/document.ts` gains an optional field; missing = fresh state; migration
  trivial). Rod charge/aspect and vial contents live in the item stack `meta` (stack JSON, existing slot serialiser; added as an
  optional `meta?: Record<string, number|string>` if the stack type lacks one, check `core/types`).
- World: jars and tubes are block entities (plain JSON via `world.setEntity`: `{aspect, n}`); aura deltas in `WorldSave.aura`
  (sparse); nodes derive from seed so there is nothing to save but their cooldown timers (sparse).
- Tests: round-trip of a full research state; old save without `magic` loads; jar entity survives a chunk reload.

### B.10 Codex, sound, art, performance

- Codex: `scripts/codex` gets an Aspects page (table of all aspects, combinations, and every key's fingerprint) generated from
  `aspectsOf`; research entries appear as a tree; planned items go to `scripts/codex/progression.json`.
- Sounds (additions to `SfxName`): `scan_chime`, `essentia_pour`, `rod_hum`, `research_solve`, `infuse`. Synth-only, short.
- Art: aspect glyph icons (6 + 12 + 3, 16 px procedural painters in `src/render/textures/iconsMagic.ts`), vial/jar/rod/notebook
  icons, jar block faces, a board screen drawn with DOM + CSS (no textures).
- Budgets: fingerprint table build <= 30 ms once, lookups O(1); aura sample O(1); research UI only touches DOM when open;
  essentia tubes reuse the fluid net (no extra per-tick cost when none are placed); particles <= 24; no per-frame allocation.

### B.11 Age-gating table (keyed by age NAME)

| age | magic content | Create-side content |
|---|---|---|
| ember | notebook, scanning, 3 primals known, vial, jar, wood vis rod, board entries `notes..vis_rod_1` | goggles (T1), hand crank trial |
| bronze | wellsprings, infusion altar, rune desk, bronze rod, lens, distillation trace, servant notes | belts, funnels, chutes, depots, basin, press, mixer, twins, deployer, arm, transmission parts, trinkets |
| forge | compound draw, foci, servants, tubes, iron rod, void jar | vault, bearing, signals at scale |
| current | `spark`, light focus | electric deployers, chain link at 256 rpm |
| atomic | (reserved) warded home | |
| star | star light, `void` mastery | |

`ageIndexOf(name)` in `src/magic/ageMap.ts` returns the index in `AGES`; W0 changes only its table.

## C. Work list (B first, then slices of A that fit)

| id | work | acceptance |
|---|---|---|
| M1 | aspect table + fingerprints + tests | `npx vitest run src/magic` green; coverage over all registry keys |
| M2 | research state, board solver, entries (6 Ember), gates | solver proves every board; gate unit tests; save round trip |
| M3 | notebook item, Use = scan (world), notebook screen with board, one real recipe unlocked (`essentia_vial`) | e2e script: scan, solve a board, craft the vial; screenshots desktop + phone |
| M4 | aura + essentia vial + jar + wood vis rod; one use: vial in a still / furnace | unit tests; e2e: gather, pour, still trace |
| M5 | nodes, tubes, infusion altar, rune desk | later |
| M6 | foci, servants, void jar | later |
| A1.. | as A.11 | |

Fit rule for this session: build M1-M3 in full; M4 as far as the sim/containers allow; A1 (goggles) and A2 (belts with hand
crank) if budget remains. Open questions for the owner: (1) is the name set (cinder, loam, brook, gale, rune, rift) okay;
(2) should magic be optional per world like Dev Mode; (3) is a servant construct allowed to automate crafting at all.

## Status (2026-11-21, end of the overhaul session)
Done: M1, M2, M3 (all seven Ember/Bronze entries; vial, rod and jar gated), M4 without the still trace (aura = the summed
fingerprints of the blocks around the player, chunk draws recover; Cinder-in-furnace is the first essentia use), A1 goggles,
A2 belts with the crank drive (as `src/workshop/workshop.ts`, not `mechLite.ts`), part of A3 (mechanical twins of the saw,
quern, mortar and loom; no basin/press/mixer yet). Everything else in A.11 and C is open; order in SESSION_CONTEXT section 10.

### Status update, workshop session (2026-11-21)
Part A built beyond the first slice (code: `src/workshop/{kinetics,logistics,workshop}.ts`, content `itemsWorkshopParts.ts`, `basinWorkshop.ts`,
`objectivesWorkshop.ts`, renderer `src/render/workshop/`): signed rotation with reverse box, ratio dial, clutch, split box, sequenced
gearshift (three preset programs instead of punched cards), governor, worm gear, chain sprocket and belt pulley links, clockwork motor,
water wheel / wind turbine / steam engine turning shafts they touch, oil (Heavy Residue canister x1.25, pine resin x1.10), jam detection;
depot, funnel, chute, basin, spout, item drain, mixer, press (basin recipes with cards in the goggles), deployer, mechanical arm
(wrench setup), drill, trip hammer (stone anvil twin), drying machine (rack twin), crates as sources and targets, animated instanced
cogs/links/arms/pistons, six workshop goals, e2e steps. NOT built: shear pin, flywheel, differential, treadwheel, saw arm, item
vault, fluid-pipe tie-ins for spouts and drains, vacuum collector, tractor/chainsaw tie-ins, signals and trinkets of A.6 (wind vane,
bell, tally board...), moving contraptions (bearing/piston), rail skiff, belts through contraption blocks, a Codex screen for basin
cards (they show under the goggles on mixers and presses).
