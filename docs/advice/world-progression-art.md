# Hearthwatt - advisor dossier: world, progression and presentation

Written 2026-11-21 by the world/progression/art ADVISOR (read-only session, branch `ccr-3c8b169f-e78nk2`, taken while the six-age refactor was running).
Builders implement this AFTER the refactor lands. It extends `docs/CONGRUENCE.md` (section 1 themes, 4.6-4.8 conventions, Stream F) and does not replace it.
Sources read: `PROGRESSION.md`, `SPEC.md` 2.6/2.7/7.2/14/15/19, `WHATS_LEFT.md`, `team.md`, `CONGRUENCE.md`, `docs/api/{world,world-features,textures,hud,audio,weather,magic,sugar,emberbound-content}.md`,
`src/content/{objectives*,loot,oreVeins,progression,automatons}.ts`, `src/render/textures/palette.ts`, `src/world/*` file list, `src/audio/*` file list.
**Not done:** the game was not run or screenshotted; nothing was built. Statements about code are from docs and file reads; anything marked **(verify)** must be checked by the builder first.

Owner decisions taken as fixed: six ages Ember / Bronze / Forge / Current / Atomic / Star ("start with a clay furnace, end with a star"); Ember is handwork only; the furnace is the heart of the base;
phone first; original names and art; in-world interaction over screens. Ages below are by name; indices are whatever the refactor's `AGE_INDEX` says (Ember 0 ... Star 5).

---

## 0. Summary for the coordinator (read this if nothing else)

1. **The world is already rich; the gaps are age-shaped.** Five biomes, Old Works ruins, wellsprings (1 in 10 chunks), oil seeps, geodes and lava falls exist. What is missing is that nothing in the world says
   *which age you are standing in*: every ruin is the same Old Works, every ore band is age-blind, loot is capped at "Forge". Fix: **one ruin family per age**, **three ore "provinces"** (not new biomes), **one new biome (mesa)**,
   and **prospect rules** (the next age's raw materials are visible at the surface within a set walk).
2. **Do not add biomes casually.** `BIOME_KEYS` order, `BIOME_PRECIPITATION`, mob habitats and ore multipliers all key on it, and any worldgen change alters unedited chunks of existing saves.
   Add exactly one biome (`mesa`, appended at index 5) and add everything else as **overlays** (provinces, structures, tree kinds). Add `genVersion` to the world snapshot (section 6, W0) so old saves keep their old terrain.
3. **One presentation law:** *the hearth ladder is the palette.* Each age owns one 5-step ramp (section 4.1), one motif voice (section 4.5) and one UI accent; everything of that age is painted from its ramp, with the shared violet shadow / warm highlight shift already in `palette.ts`.
4. **Teach without text walls:** every objective is <= 2 sentences, has a *world cue* (a pulse, a sound, a ghost) and a *hint ladder* (nothing for 5 min -> tracker nudge -> compass arrow at 10 min). Codex is a vertical tree, one age per sticky section.
5. **Pacing:** idealised 45/45/55/60/60 min (PROGRESSION) is a floor for an expert. A first-time phone player is budgeted at **x1.8** (Ember ~80 min). Sessions are 10-15 min; every age must have a *natural stopping point* ("save point" moment) at minute ~12 and ~25.
6. **Three builder lanes, disjoint files** (section 6): `W` worldgen, `O` objectives/Codex, `U` textures/audio/UI. `U0` and `W0` are the only contract steps that must land first; everything else is parallel.

---

## 1. The six ages as a lived arc

Convention for every row: **T** theme, **M** signature material, **P** palette ramp (name in section 4.1), **L** light mood, **S** sound mood.
Existing numbers (furnace temperature, minutes) come from `PROGRESSION.md`; new numbers are starting values to tune with `balance.test.ts` (task O5).

### 1.1 Ember - "the fire is a living thing you feed" (Clay Furnace, to 800 C, idealised 45 min, phone ~80)

| | |
|---|---|
| T | Everything is made by hand, stroke by stroke. You are small, the night is cold, the furnace is the only warm place. |
| M | fired clay, charcoal, copper, flint, leather, cloth |
| P | `EMBER_AGE`: fired clay `#753f2d -> #d59b75` (existing `FIRED_CLAY`), soot `#0e0c10`, flame `EMBER` ramp |
| L | Low sun-gold days; blue-violet nights lit only by the furnace and torches. Block light tint warm `#ffb060`. Furnace glow is the brightest thing for 100 blocks. |
| S | crackle, wind in leaves, crickets, stone-on-stone strokes, clay slap, kettle hiss; sparse: silence is allowed |

**World features.** Woodland spawn with wild wheat within 44, an Old Works within 30-78 (exists). Marsh (peat, wild tea, clay; never within 150 of spawn) is the Ember side-quest biome. Resource placement:

| Resource | Where | Existing rule | Prospect rule (new) |
|---|---|---|---|
| logs, flint, rubble, clay, gravel, water | spawn radius 48 | `SPAWN_RESOURCE_RADIUS` | keep |
| copper ore | y 16-60, outcrops on cliffs, dunes x2 | `oreVeins.ts` | an outcrop within **120 blocks** of spawn (test) |
| tin ore | y 30-66, 2.5 x 5 | `oreVeins.ts` | an outcrop within **160 blocks**; tin is the "go on a walk" moment of Ember |
| coal / peat / charcoal | peat in marsh; charcoal from logs | exists | charcoal needs no walk; peat is a bonus |
| tea bushes / coffee shrubs | woodland edge (tea), dunes edge (coffee) | planned (BREWING_PLAN) | tea within 200, coffee within 300 |

**Dangers.** Cold nights (warmth drain; the furnace warm zone and torches are safe). Cinder Mites in the dark (light level <= 7, 24-40 blocks away). Forge Wardens and Kiln Sentries guard Old Works ruins (1-2 wardens, `RUIN_WARDENS`).
Rule kept: **every Ember hazard has a hand-made answer** (torch, furnace zone, flint maul).

**Signature moments (scripted by sfx + objective, never a cutscene):**
1. *First fire* - the clay furnace lights at dusk; a warm light disc pushes the dark back, the Cinder Mites stop at its rim, a low "hearth" chord plays once (motif note 1, section 4.5).
2. *First pour* - the crucible tilts, molten copper runs into the fired mould, the mould glows `EMBER[4]` then dims over 6 s; the pour sound is the only loud thing on the map.
3. *First cup* - a boiling pail, cup and cone; steam curls up; a green/brown buff pill slides into the HUD with its glyph (section 4.3).

**Objective chain** (existing ids kept; `E` = existing, `N` = new): gather_logs (E) -> place_chopping_block (E) -> make_planks (E) -> place_workbench (E) -> find_flint (E) -> flint_pickaxe (E) -> rubble 12 / clay 6 (E) -> place_furnace_clay (E) ->
furnace_lit (E) -> charcoal (E) -> well_warmed (E) -> cook a meal (E) -> clay table, fire a mould (E) -> smelt copper, **first pour** (E) -> hand quern, grind flour (E) -> till, plant wheat (E) -> stone anvil, hammer plate (E) ->
reach 800 C (E) -> alloy bronze, cast a pickaxe head (E) -> bronze pickaxe (E) -> forge a maul (E) -> salvage an automaton (E) -> bake bread (E) -> boil a bucket, brew a cup (E) -> **N: `visit_old_works`** (flag `ruin_entered_old_works`, see lore, section 2.5) ->
**N: `fill_upgrade_list`** (furnace upgrade list: 8 bronze ingots, 4 firebricks, 1 bellows, 2 bronze plates, 1 leather at 700 C -> condition `furnaceTier 1`). `six_cups` stays optional (side goal in the Field Journal, WHATS_LEFT 0.3).
World cue per goal: the next resource gets a faint motes column visible to 24 blocks *only after the 10-minute hint rung* (section 3.3).

### 1.2 Bronze - "heat learns to move" (Bronze Furnace to 1100 C, idealised 45 min, phone ~80)

| | |
|---|---|
| T | The fire's work travels: water, steam and turning shafts carry it across the yard. The first machines are wooden, noisy and a little alive. |
| M | bronze, oak axles, leather belts, brass-warm glass, pine resin |
| P | `BRONZE_AGE`: bronze `#4a3418 #7a5a22 #a8802f #cfa84a #eed582`, verdigris `#1f4a43 #2f6f62 #4f9a85 #7bbfa5 #b4e0c8` |
| L | Amber-green: block light `#ffc870` near steam (steam scatters a faint pale `#e6ecf0` haze at 2-3 blocks); mornings fog slightly; the boiler's gauge glass is a small warm window at night. |
| S | cog ticks (pitch follows rpm), chuff, belt hum, valve whistle, water wheel splash, a **bell** when something seizes |

**World features.**
- **New biome `mesa` (clay flats):** dry, banded strata (red-ochre `#a8603c`, buff `#cba960`, grey), flat-topped buttes 6-14 high, sparse scrub, clay seams at the surface, copper x1.5 and tin x1.5, **no** marsh water. Rain falls normally. Hostile spawn places: `surface`, `cave`. Placement: dry land between woodland and dunes (appended noise field; never within 220 blocks of spawn; ~12% of temperate land).
- **Pitch pine stands:** `PITCH_PINE` tree kind (`PINE_TALL` shape, amber-streaked bark `pitch_pine_log`, leaves unchanged) in groves of 5-9 at cold/high woodland edges and frostfell margins. Tapping gives `pine_sap` at x2 and sap flows 1.5x in sun (sugar chain, `docs/api/sugar.md`).
  Prospect rule: a stand within **140 blocks** of spawn. Resin is *the* Bronze glue: belts, valve seals, kettle gaskets use `pine_resin` (proposal, coordinate with Stream A).
- **Streams for water wheels:** worldgen guarantees one flowing-water cell (a stream of source blocks dropping >= 2 blocks) within 180 blocks of spawn (rivers/cliffs exist; add a rule + test, not new terrain).
- **Gearhouse ruin** (Bronze ruin family, section 2.2).
- **Seep Mounds** (section 2.3) in dunes and the marsh fringe: crude oil for the distillery/lubricant (belts and gearboxes jam without it; `lubricant` exists in the workshop).

**Dangers.** Scald and burst (visible, telegraphed: the boiler's gauge needle and a 5 s warning), Bellows Hounds at night (dash attack; they drop leather for belts, CONGRUENCE F5), seized shafts (bell rings, nothing explodes).

**Signature moments:**
1. *The first shaft turns* - goggles read "16 rpm, load 6/24 su"; cog tick starts; every wooden part visibly rotates; the cogs' pitch rises with rpm.
2. *The valve sings* - pressure crosses the set point, the whistle blows, a white steam plume rises 3 blocks; the boiler does not burst. The player *hears* the rescue.
3. *The chute inhales* - the first Vacuum Pump pulls a stack of items along a Bronze Chute in one visible whoosh (items drawn as a stream of dots), lands in a crate with a "tock".

**Objective chain** (`N` unless stated; ids final): place_bronze_furnace -> boil_water (kettle) -> place_hand_crank (E, workshop) -> shaft_turns (flag from sim: `rpm >= 16`, see 6.O1 flags table) -> place_mech_millstone (E) -> make_bronze_cog (E) -> place_ratio_dial (E) -> saw_planks (saw bench) ->
shaft_bellows -> move_heat (thermocouple heats a hot plate) -> build_boiler (ghost-planner multiblock) -> raise_steam (>= 1 bar) -> fit_safety_valve -> piston_power (steam engine 16 rpm / bar) -> compress_air (>= 2 bar in tank) -> pneumatic_post (vacuum chute delivers) -> press_plates -> forge_blast_nozzle -> **gate:** Blast hearth forms.
Existing workshop goals (mixer, arm, saw arm, vault, lever, bell, piston) become *optional side goals* (Field Journal) except `place_bell`, which is a required step after `fit_safety_valve` (teaches the seize alert). `six_cups` and distill/sugar goals are side goals.

### 1.3 Forge - "the furnace gets a blast and iron becomes steel" (Blast hearth to 1500 C, idealised 55 min, phone ~100)

| | |
|---|---|
| T | Machines get heavy. You build around a roaring hearth and the ground starts to look like a place that was industrial once. |
| M | iron, steel, coke, refractory brick, slag |
| P | `FORGE_AGE`: slate `#2a3038 #3f4852 #5a6672 #7a8794 #a9b6c2`, white-hot highlight `EMBER[4]` |
| L | Hard, high-contrast: black shadows, white-orange blast light `#ffd0a0`; the hearth lights its own courtyard like a stage. Dust haze (render-only) on windy days. |
| S | trip-hammer thud (on the beat of the shaft), blast roar (rises with air bar), rolling-mill grind, anvil ring, deep tank hum |

**World features.**
- **Coal Ridge province** (section 2.1): hills with exposed coal seams, iron outcrops on the cliff faces, limestone terraces; carries x2 coal/iron/limestone, not a biome. Prospect rule: coal AND iron outcrops within **220 blocks** of spawn.
- **Blast Row ruin** (section 2.2): collapsed hearth stacks, slag heaps, a rusted rolling mill. Guards: Forge Wardens (2) + a Kiln Sentry on the chimney.
- **Lava with the bronze bucket** (exists), **oil shale** (exists).

**Dangers.** Heat burns when touched (thermocouples glow by temperature), lava, wardens at Blast Row, 16-bar steel boilers if over-pressured. Emberbound ruins here are the toughest non-boss encounters before Atomic.

**Signature moments:**
1. *The blast* - air through the nozzle, the hearth mouth flares white, a flare of sparks, first iron runs; screen-edge warm vignette for 1 s.
2. *First steel bar* - a glowing bar goes through the rolling mill with a rising grind, comes out flat; the sound lands on the shaft's beat.
3. *The dynamo's first spark* (end of the age) - a copper cable lights a lamp *at dusk*; the lamp is the only electric light for 100 blocks, and the hearth "hands the night to it".

**Objective chain:** place_blast_nozzle (gate step from Bronze) -> blast_hearth_formed -> smelt_iron -> make_steel_ingot -> place_rolling_mill -> iron_axle -> forge_iron_thermocouple -> place_dynamo -> generate 100 W -> place_lamp ->
place_crusher -> machine_job -> generate 2 kW -> store 1 MJ -> **gate:** Arc Electrode in the roof, grid can feed 8 kW. (Existing `thermopile` goal moves from Forge to **Bronze** side goals: the thermopile is a heat -> watts device and ruin loot; decide with Stream A.)

### 1.4 Current - "invisible power in copper veins" (Arc hearth to 2100 C, idealised 60 min, phone ~110)

| | |
|---|---|
| T | Light and signal everywhere. The base stops being a place you light and becomes a place that is lit. |
| M | copper cable, silicon, glass, aluminium, quartz |
| P | `CURRENT_AGE`: `ARC_GLOW` + `ARC_STEEL` (existing), lamp warm `#ffd95a`, cyan accent `#8fd8ff` |
| L | Clean cyan-white by day-night contrast: lamps are `#ffd95a`, arcs `#a9d8ff`; wet surfaces glossy in rain; storms flash (<= 3 flashes/s). Night bases look like constellations. |
| S | mains hum (pitch = load), relay clicks, turbine whine, arc crackle, solar "tink" at dawn, thunder |

**World features.** **Quartz Flats province** (dunes/mesa margins; quartz, bauxite, spodumene x2, glass-glinting crystal geodes at the surface); wolframite deep in frostfell (exists x2). **Relay Hall ruin** (section 2.2). Storms boost wind and bring Arc Drones (exists): storms are the age's weather identity - **forecast line** ("A storm is coming") becomes a goal hint ("Turbines love storms").
Prospect rule: quartz outcrop within **320 blocks**; bauxite within 400; wolframite is a deliberate *expedition* (frostfell, y 3-20, **not** required to be on the surface).

**Dangers.** Arc Drones in storms/new moon (zap x wetMult in water: "stay out of the pond"), brown-outs (power strip warning), electric shock at damaged cables is NOT added (keep survival simple). Fire safety: none new.

**Signature moments:**
1. *The arc strikes* - electrodes in the hearth roof light, cyan flash, the hearth turns from orange to blue-white; the colour change on the furnace mouth is the age change.
2. *Lights out, lights on* - at dusk the player throws one switch and a line of lamps ripples on at 0.1 s spacing along the cable (ripple travels the actual graph, deterministic).
3. *Storm harvest* - first storm with turbines: blades spin up, power strip peaks, the thunder is *good news*.

**Objective chain:** place_arc_electrode -> arc_hearth_formed -> pump_water -> reach_1900C -> make_circuit x2 -> generate 10 kW -> ward_beacon -> make_tungsten_rod x4 -> **gate:** plasma casing shell, two power ports, 40 kW.

### 1.5 Atomic - "quiet danger and control" (Plasma hearth to 3200 C, idealised 60 min, phone ~110)

| | |
|---|---|
| T | Cool water around a hot heart. The game gets calmer and more careful, not louder. |
| M | superalloy, fused quartz, heavy water, graphite |
| P | `ATOMIC_AGE`: reactor `#0d2a2a #14524a #2a8f7c #5cf0c0 #c8fff0` over graphite `#16151a`; `STAR_ALLOY` for casings |
| L | Cold: block light shifts to the cool share (exists: `LIGHT_COOL_SHIFT`) - green-blue `#5cf0c0` from fission things, violet from plasma. Fog 8% cooler near the pile. Nights are darker (no warm emitters). |
| S | Geiger-soft ticks (rate = pile output), coolant flow, low drone (A1), a single calm rising chord at criticality. No alarms unless a cell is truly lost. |

**World features.** **Deepworks province** (below sea - 8; deep ruin tier, pitchblende x3 in the scar already): ruined concrete vaults and flooded galleries reached by caves; 6-10 blocks of lit corridors (glowcap + dim reactor-teal). **Pile Vault ruin** (section 2.2). **Slag Colossus** in the deep (exists, `maxLoaded: 1`).
Prospect rule: none above ground; a **marked cave mouth** (steam vent + basalt columns, `scar`) within 500 blocks guides down; the Field Journal reveals "Pile Vault" when the player holds a pitchblende chunk (compass arrow).

**Dangers.** Slag Colossus (boss, slam), flooded galleries (air meter), heat at the pile (shield suit). Calm failure language: "Coolant low" with the water-level window, not siren spam.

**Signature moments:**
1. *The pile goes critical* - a calm rising hum, faint blue glow in the water, Geiger ticks accelerate to a steady tick, and **nothing else happens**. The restraint is the point.
2. *Heavy water* - the first electrolyzer bubbles deuterium; a cell glows `#5cf0c0` in the hand.
3. *Down the Deepworks* - crossing the threshold into a vault: sound dims to a drone, then the colossus's step is heard 20 s before it is seen.

**Objective chain:** plasma_hearth_formed -> superalloy x8 -> place_fission_pile -> generate 60 kW -> make_deuterium_cell x8 -> make_star_core -> **gate:** star casing shell (93 casings or fewer: X7), four power ports, star core, 8 cells.
Owner decision pending (WHATS_LEFT 0.3): **recommend reducing to 61 casings** (a 5x5x5 shell minus corners and bevels) - 93 blocks of superalloy on a phone is a chore, not a climax; if kept, add a *ghost planner with counts* (already planned).

### 1.6 Star - "the base finally burns like a small sun" (Starhearth, idealised 5-10 min of holding plus build)

| | |
|---|---|
| T | A deliberate finale, not an age of new systems: assemble, hold 300 kW for 90 s, and then everything is warm and quiet. |
| M | star core, plasma-white metal |
| P | `STAR_AGE`: `STARFIRE` + `GOLD` (existing), white `#fff2b0` |
| L | Gold-white. During the hold the sky above the base tints 8% gold and the horizon glows; after ignition the base is "forever warm" (permanent faint gold ambient inside 48 blocks, no gameplay change beyond recipes at any heat and 1 MW). |
| S | one rising harmonic chord built from all five previous motif voices (section 4.5), then **calm** (wind and crickets return, no music) |

**World features.** A **Starhearth Ring** ruin (section 2.2) 400-700 blocks from spawn that the player may visit *before* building: the ring is dark, a plaque slate says what it needs ("Hold 300 kW for 90 s"). Seeing it early makes the ending visible all game (a distant faint gold glint at night beyond 200 blocks, render-only).
**Signature moments:** (1) the ring plaque at first visit; (2) the 90-second hold - a countdown ring around the hearth, power strip pinned, if power dips the chime softens and the ring cools, no fail state; (3) ignition - sky tint, chord, `ignited` flag, afterglow.
**Objectives:** star_casing_shell -> place_star_core -> star_hearth_fed (300 kW line) -> hold_90s -> `ignited`. After ignition: the Field Journal shows completion %, the world continues.

---

## 2. World depth

### 2.1 Provinces (overlays, not biomes) and the one new biome

A **province** is a low-frequency noise (appended field in `Terrain`, own seed salt, scale ~192 blocks, threshold chosen so each province covers ~15% of land) that multiplies ore weights and re-skins surface rock. It never changes `BiomeKey`.

| Name | Age | Where | Surface | Ore multipliers (on top of biome) | Extra |
|---|---|---|---|---|---|
| Coal Ridge | Forge | any land biome except marsh/frostfell summit | coal seams in cliff faces (every 8th terrace cell), limestone terraces | coal x2, iron x1.5, limestone x1.5, sulfur x1.2 | 1 ruin `blast_row` per 11x11 chunks inside |
| Quartz Flats | Current | dunes, mesa, plains | glinting `quartz` crystals; `crystal_cluster` outcrops 1 in 24 surface cells | quartz x2, bauxite x1.5, spodumene x1.3 | glassy wind sound layer (high, thin) |
| Deepworks | Atomic | below y 10 anywhere with caves | vault corridors (section 2.2) | pitchblende x2 below y 14 | `RUIN_DEEP_BELOW_SEA` unchanged |
| Mesa (BIOME) | Bronze | dry temperate | banded strata, buttes, clay seams | copper x1.5, tin x1.5, clay surface | precipitation rain; weather identical to woodland |

New block keys these need (all mapped to texture names in 2.9): `ochre_rock`, `ochre_sand`, `mesa_clay`.
Spawn rule remains: *the world always starts in woodland*; provinces and mesa never within 150 blocks of spawn (mesa 220).

### 2.2 Ruin families (one per age, same generator skeleton)

Reuse `squareRuin` / `drawRuin` / `ruinLootTier`; each family is a `RuinStyle` with a footprint, wall materials, a "centrepiece" and a loot table whose **max age = its age** (the existing content test "never anything past the Forge Age" becomes "never past the ruin's own age + 0").

| Family (age) | Footprint | Centrepiece | Walls | Guards | Loot table (key items; counts) | Frequency |
|---|---|---|---|---|---|---|
| Old Works (Ember, exists) | 5x5-7x7 | collapsed furnace | stone brick, cracked, mossy | 1-2 Forge Wardens or Kiln Sentry | `near`/`deep` unchanged | 1 per 7x7 chunks, ~65% (exists) |
| Gearhouse (Bronze) | 9x7, by water if possible | dry wheel frame + 3 `rusted_gearbox` + a broken shaft run | oak frame + brick | 2 Bellows Hounds (night) + 1 Warden | `gear`: bronze_cog 2-5, bronze_plate 1-3, leather 2-4, pine_resin 2-4, copper_ingot 2-4, kettle 1 (weight 2), goggles 1 (weight 2) | 1 per 9x9 chunks, guaranteed one within 220 |
| Blast Row (Forge) | 15x9 on Coal Ridge | 3 collapsed hearth stacks + slag heaps + rusted rolling mill | slate brick, `slag_brick` | 2 Wardens + Kiln Sentry on chimney | `row`: iron_ingot 3-6, coal 6-12, steel_ingot 1-3 (weight 3), firebrick 4-8, iron_axle 1-2, dynamo_coil 1 (weight 2) | 1 per 11x11 chunks inside the province |
| Relay Hall (Current) | 11x11 | glass dome, 4 pylons, dead lamps on an intact cable | pale concrete | 2 Arc Drones only in storm/new moon, else none | `relay`: copper_cable 6-12, lamp 2-4, circuit 1-2 (weight 3), glass 6-10, silicon 2-4 | 1 per 13x13 chunks in Quartz Flats |
| Pile Vault (Atomic) | 17x11, sunk 6 | cold pile shell, coolant hall, flooded lower level | concrete + `graphite_block` | Slag Colossus nearby (maxLoaded 1) | `vault`: superalloy_ingot 1-3, fused_quartz 2-4, heavy_water 1-2 (weight 2), graphite 4-8 | 1 per 15x15 chunks below y 10 |
| Starhearth Ring (Star) | 25 diameter | dark ring, plaque slate | `star_alloy` ribbed | none (silence) | **no loot**; slate only | exactly one per world within 400-700 of spawn |

All tables obey: no item of a later age than the ruin; no machine that skips its age's gate (e.g. `relay` gives circuits but never a fission part). Deep variant (distance > 400 or below sea - 8): +50% rolls, one extra weight-3 entry of the same age. Crates, guard placement and persistence use existing mechanics (`ruinCrates.ts`, `ruinGuards.ts`).

### 2.3 Systems-fed world structures

| Structure | Feeds | Numbers | Where | How the player reads it from afar |
|---|---|---|---|---|
| **Pitch Pine Stand** | sugar chain, belts/seals (resin) | 5-9 trees, 1 per ~14x14 cells at cold edges, ~2% of pine cells convert | woodland high ground, frostfell margin | amber-tinted canopy streaks, amber particle drips at dawn |
| **Seep Mound** | distillery crude oil, lubricant, bitumen (verify `bitumen` key in `itemsDistill.ts`) | 3x3 oil pool + 2-block crusted mound (`bitumen_crust` drops 1-2 bitumen); refill 1 bucket / 3 min | dunes, scar (exist as oil bowls), marsh fringe | black-gloss pool, heat-shimmer, faint tar smell = low rumble layer |
| **Spring Stones (aura sites)** | essentia / magic (`aura_reading`, `node_tap`) | a ring of 5-7 `standing_stone` (3-4 high) around ~40% of wellsprings, radius 5; wellsprings already 1 in 10 chunks | woodland, frostfell, marsh | slow violet motes (`#a77fe0`) rising 6 blocks, visible from 48; rod reading "bright" inside; land-aura regen x2 in the ring |
| **Waymarks (ley-like lines)** | exploration; leads to far ruins | cairns every 12 blocks, 3-9 per line, between an Old Works and a later-age ruin; point to the *next* ruin family | between ruins | a stacked-stone cairn with a lit slit; compass-style notch toward the target ruin |
| **Slate Cairns (lore)** | notebook `lore` (ResearchState already has it) | 12 lore slates in total (2.5) | inside ruins and at waymark ends | a single standing slab with etched lines |
| **Barter Cairn (trade)** | exploration reward, no UI | drop 4 of any one food (or 1 ingot) on the cairn top; 10 s later a counter-gift appears on the far side | at waymark crossings (rare, ~1 per 6 lines) | a cairn topped with a flat stone and a hollow bowl |
| **Workshop ruin pieces** | workshop/steam | rusted shaft lines (decor `rusted_shaft`) that *line up with real shaft rules* so a player can restore one: replacing missing cogs wakes it (an optional "restore the mill" mini-objective: gives a free working water wheel) | Gearhouse | cogs visible as silhouettes; a missing piece is an obvious gap |

### 2.4 Exploration reward ladder (distance from spawn, never skipping the gate)

| Ring | Distance | Reward class | Example |
|---|---|---|---|
| 0 | 0-96 | bootstrap | Old Works, wheat, first ore outcrops |
| 1 | 96-220 | age material, one-off | Gearhouse loot, pitch stand, stream, mesa clay |
| 2 | 220-400 | age *convenience* | goggles, a Barter Cairn gift (seed packs, a cup, a blueprint slate), Coal Ridge |
| 3 | 400-700 | relic (cosmetic or comfort, never a skip) | Starhearth Ring plaque, a "Hearthkeeper's lantern" (lamp that needs no fuel but is dim), a clay figure |
| Deep | y <= sea - 8 | next-age *sample* (1 piece, not enough to build) | one superalloy ingot in a Pile Vault |

**Field Journal** (Codex page `Places`, in-game notebook tab): 10 discoveries (Old Works, Gearhouse, Blast Row, Relay Hall, Pile Vault, Starhearth Ring, Pitch Stand, Seep Mound, Spring Stones, Barter Cairn). Each entry is a 2-line text + a small painted glyph; completing 5 unlocks "Wayfinder's compass" (compass can point at the nearest *known type*). No XP, no points.

### 2.5 Lore (12 slates, <= 140 characters each, original)

Story: the Hearthkeepers lit each hearth in turn and taught their automatons to guard the fire; the Starhearth was lit once, held, then they went quiet and the guards kept watch.
Ember (3): "We banked the first fire in clay. It did not go out for nine winters." / "The guards were built to keep the cold from the fire. They are still keeping it." / "Copper first, then tin. Bronze remembers what each forgets."
Bronze (3): "Water turns the wheel; the wheel turns the stone. Do not ask it to do more." / "Bell on every shaft. A silent machine is a dying machine." / "The valve sings so you need not."
Forge (2): "Iron wants air. Give it a blast and it will give you a blade." / "Heavy things need a patient hand."
Current (2): "Copper veins under the floor, light in every window." / "Storms are a gift. Hold the sky by the wire."
Atomic (1): "Cool water around a hot heart. That is all the secret there is."
Star (1): "Three hundred for ninety. Then rest."

Rule: a slate adds a `lore` entry to the notebook (existing `ResearchState.lore`), plays `slate_read` (soft chime) and shows one toast with the line. Nobody is made to read it.

### 2.6 Balance curve (time-to-next-age)

| Age | Idealised (PROGRESSION) | First-time phone (x1.8) | Objectives (required) | Main time sinks (idealised) | Walk budget to resources | Natural stops |
|---|---|---|---|---|---|---|
| Ember | 45 min | ~80 | 31 (+ visit ruin, fill upgrade list) | wood 6, clay/furnace 6, copper+tin 10, casting 8, farm/food 8, bronze 7 | <= 160 blocks one way | after first fire (~min 12); after bronze pickaxe (~min 55) |
| Bronze | 45 | ~80 | ~18 | boiler build 10, steam/pressure tuning 8, air + pump 8, workshop 12 | <= 220 (pitch stand, stream) | after shaft turns (~min 12); after safety valve (~min 30) |
| Forge | 55 | ~100 | ~14 | iron + coal mining 15, blast hearth 8, rolling/steel 10, dynamo 8 | <= 260 (Coal Ridge) | after the blast (~min 15) |
| Current | 60 | ~110 | ~12 | cable runs 12, arc hearth 10, circuits 10, storm wait 8 | <= 340 | after arc strike (~min 15) |
| Atomic | 60 | ~110 | ~9 | superalloy 15, pile build 12, deep trip 10 | <= 520 | after criticality (~min 25) |
| Star | 10-15 | ~20 | 4 | casings, hold | ring visit | ignition |

Tuning knobs: furnace speed multiplier, ore vein frequency (prospect rules in tests), stress capacity numbers (Stream A), crate loot rolls. **Acceptance for balance:** `balance.test.ts` (O5) prints idealised time-to-gate per age under a cost model (gather seconds per item from tool tier, craft time from recipe, build time from block count x 2.5 s, walk at 4.3 blocks/s with the prospect distances above) and asserts each age within **+-15%** of table; a failing age fails CI.

---

## 3. Teaching without text walls

### 3.1 Rules for objectives
- Title <= 4 words, text <= 2 sentences, units on every number. No objective introduces more than **one** new verb.
- Each has a **world cue** (table 3.2) and an `opt` flag for side goals. Tracker shows the first incomplete *required* goal whose `requires` are met (prevents "place a boiler" before a kettle).
- Conditions beyond today's types (`rpm`, `fluid`, `aspect`, `research`, `pressure`) are produced by owning systems as **flags** (builders of O must not edit sim). Flag names (owners in brackets): `shaft_turns` [A], `steam_raised` [A], `valve_set` [A], `air_tank_2bar` [A], `vacuum_delivered` [A], `ruin_entered_old_works/gearhouse/blast_row/relay_hall/pile_vault/ring` [W], `lore_read_n` [D/W], `scanned_first` [D], `essentia_drawn` [D].

### 3.2 World cues (one per required goal; none is text)

| Goal type | Cue | Rule |
|---|---|---|
| "place X" | a faint ghost silhouette of X at the target cell *only while X is in hand and the goal is active* (placement preview exists) | disappears when placed |
| "reach temperature" | furnace glow ramps; thermometer segment pulses at the target | once per 30 s |
| "find resource" | after hint rung 2: faint motes column over the nearest unmined outcrop within 120 blocks, 24-block draw distance | cap 1 column |
| "visit ruin" | waymark cairn nearest the player glows; distant ruin chimney smoke | |
| "machine runs" | goggles auto-open the status sentence for 6 s when the player stands within 3 blocks of the target machine | |

### 3.3 Hint ladder (`coach.ts`, owner O)

| Rung | Time on goal | What happens |
|---|---|---|
| 0 | 0-5 min | nothing (the goal text is enough) |
| 1 | 5 min | tracker pulses once; one-line nudge in the existing hint style: "Try the marsh for peat." (from a per-goal table, <= 60 chars) |
| 2 | 10 min | compass arrow switches target to the needed resource (`Compass` already shows bearing + distance); motes column appears |
| 3 | 20 min | the Codex entry for the goal's item opens as a bottom sheet with "Show me" (pins the compass) |
All rungs reset on goal completion; any rung is suppressed on Peaceful play for goals completed by `FLAG_PEACEFUL`.

### 3.4 Codex tree (phone-first)
- **Layout:** a vertical scroll. One sticky age header per section (age name, hearth silhouette in the age ramp, "min 0:00-0:45" optional). Nodes are **48 px** icon chips on a 3-column grid; the spine is a vertical line in the heat colour with branch lines in system colours.
- **Node states:** done (filled, age ramp), available (outlined, soft pulse 2 s), locked (grey + lock glyph, tap shows "needs X"), planned (dotted).
- **Branch colours** (always with a glyph so colour is never the only signal): heat `#e8622a` flame, motion `#b89a4a` cog, fluid `#3a86b4` drop, power `#8fd8ff` bolt, magic `#a77fe0` rune, food `#5cc060` leaf, distill `#e2bc3a` flask.
- **Tap a node:** bottom sheet, 2 sentences + the status sentence example + "Pin" (sets the compass/goal). **Long-press:** the item's recipe tree.
- **Mockup (portrait, 390 px):**
```
 EMBER  ●━━━━━━━━━━━━●        <- sticky age bar (hearth glyph, accent underline)
  ┃  [flame][clay][pick]      <- spine nodes row 1
  ┃     ╲      ┃
  ┣━ [cup]━[tea]━[dry]         <- food branch (green) hangs off spine
  ┃
 BRONZE ●━━━━━━━━━━━━●
  ┃  [kettle][shaft][quern]
  ┣━ [boiler][valve][chute]
  ┗━ [lubricant]... (planned: dotted)
```
- Build: `scripts/codex/*` (owner O) reads the same `OBJECTIVES` index and `progression.ts`; Codex build must print zero warnings and every *required* objective appears exactly once.

---

## 4. Presentation congruence (one art direction)

### 4.1 Palette ramps per age (extends `palette.ts`; add `src/render/textures/agePalette.ts`)
Each ramp runs shadow -> highlight (5 steps), obeys the existing hue shift (shadows toward `#1c1630`, highlights toward `#fff4d8`).

| Age | Ramp name | Steps (dark -> light) | Where it appears (rule) | Accent |
|---|---|---|---|---|
| Ember | `FIRED_CLAY` (exists), `EMBER` (exists) | `#753f2d #915238 #ab6846 #c0805a #d59b75` | clay furnace, mould, cups, pots, leather, hand-station wood | ember orange `#e8622a` |
| Bronze | `BRONZE` (new) | `#4a3418 #7a5a22 #a8802f #cfa84a #eed582` | bronze plate, cogs, pipes, kettle, gauges | verdigris `#4f9a85` edges and wear |
| Bronze | `VERDIGRIS` (new) | `#1f4a43 #2f6f62 #4f9a85 #7bbfa5 #b4e0c8` | patina on old bronze, brass-warm glass trim, ruin metal | |
| Forge | `BLAST_SLATE` (new) | `#2a3038 #3f4852 #5a6672 #7a8794 #a9b6c2` | iron, steel (lighter), hearth shell, rolling mill | white-hot `#ffe27e` |
| Current | `ARC_STEEL` + `ARC_GLOW` (exist) | `#1b202c ... #66778c`; `#1c3f9e ... #fff` | machine casings, cables, lamps, glass | lamp `#ffd95a`, cyan `#8fd8ff` pip |
| Atomic | `REACTOR` (new) | `#0d2a2a #14524a #2a8f7c #5cf0c0 #c8fff0` | pile, coolant, shield suit trim | graphite `#16151a` |
| Star | `STARFIRE` + `GOLD` (exist) | `#7a4a10 ... #fff` | Starhearth, ring, afterglow | white `#fff2b0` |

**Rule of three:** any one texture uses at most 3 ramps (base material + one age accent + one state colour). Natural materials (stone, wood, leaves, sand) never use age ramps. **Aspect colours are untouched** (`AspectInfo.color`).

### 4.2 Texture and icon rules
- 16x16, nearest-neighbour, five-step ramps, 1 px darker outline on every item icon, light from top-left, deterministic painters (existing test regime).
- **Silhouette per category** (existing: ingots trapezoid, plates lozenge, crushed pile, powder mound, rod diagonal): add **gear** (circle + 6 teeth, always 12 px wide), **pipe segment** (two flanges), **jar** (round belly + cork), **slate** (rounded rectangle with 3 lines), **cell** (capsule). New categories added only here.
- **Age notch:** machine *casings* have a 2x2 px corner rivet in the age's accent (clay-orange, bronze, white-hot, cyan, reactor-teal, gold), so a machine's era reads at a glance without a legend. (Existing power pip stays bottom-right.)
- **Wear:** ruin versions of blocks are the same texture with `VERDIGRIS` or rust streaks + 2 missing pixels per row (never a new silhouette).
- **Readability test** (extend `readability.test.ts`): every interactive block face has luminance contrast >= 1.6:1 (L* difference >= 18) against the *three* most common neighbour terrains' average colours; failures listed with names. Ores: fleck colour distinct from the host by >= 22 L* or hue distance >= 40 degrees.
- **Glass** keeps the shared blue-white transparency; fluids keep `FluidSpec.colour`.

### 4.3 UI chrome and HUD for buffs, essentia, stress

**Chrome.** The existing UI kit stays; add an **age accent token** `--hw-age` (set on `:root` from the player's current age) used for: window title underline, Codex age header, goal tracker bar, furnace screen's hearth ladder strip. Surfaces never change colour; only accents.
**Furnace screen:** the **hearth ladder strip** on top: six small furnace silhouettes in the age ramps, the current one lit, the next one outlined; below it the upgrade list with progress bars. (The list must fit 390 px without scrolling for Ember's 5 items.)

**Status pills row** (HUD, under vitals; max 4 visible, then a `+N` chip that opens a bottom sheet):

| Pill | Size | Colour | Glyph | Text |
|---|---|---|---|---|
| Warmth (Well-Warmed) | 28 px high | amber `#e8a23a` | flame | m:ss |
| Tea buff | 28 | green `#5cc060` | leaf + drink icon | m:ss |
| Coffee buff | 28 | brown `#8a6a3c` | bean | m:ss |
| Essentia (aspect in jar/hand) | 28 | aspect colour | aspect sigil | amount (only while a jar is in reach or rod/jar held) |
| Well-Fed | 28 | umber | bread | m:ss |
Pill = rounded 14 px, 1.5 px border in the colour, dark fill, glyph + number in `hw-num`; blinks once at 10 s left and once at 0; never more than 1 s animation.
- **Stress/speed** is **not** a permanent HUD item. Three readouts only: (a) **target line** when aiming at a machine: "Quern: grinding wheat, 14 rpm, load 4/24 su" (<= 70 chars); (b) **goggles overlay**: a ring dial around the crosshair, 3 segments (idle / ok / near limit), colour + a shape (circle / half / exclamation); (c) **in-world**: shaft textures tint toward red at > 80% load and tick faster; the bell rings at seizure.
- **Aura dial** (WHATS_LEFT 3, "not built"): a small arc under the compass, visible only while a gathering rod or `aura_reading` research is active: arc fill = local aura strength, violet; 3 pips for aspects present.
- **Power strip** (existing) is unchanged; Current-age additions: brown-out pill and "Storm - turbines up" micro-toast.
- **Mockup (phone portrait HUD, 390 x 844):**
```
┌──────────────────────────────┐
│ [Goal: Boil a bucket  3/3 ▮▮▮] [bag][pause]   <- goal bar, age accent underline
│ ♥ 18/20  ❄ warm ↗  🍞 food   [◉ compass 42m] [☀ 14:20 rain-soon]
│ (flame 2:41) (leaf 1:12) (+1)                  <- pills
│                                                │
│            ·  crosshair ring  ·                │
│     Quern: grinding wheat, 14 rpm, load 4/24   │ <- target line
│                                                │
│ [1][2][3][4][5][6][7][8][9]                    │ <- hotbar
│ (stick)                              (use) (jump) │
└──────────────────────────────┘
```

### 4.4 Light and weather mood (render-side, small)
No global age grading (the world is shared by all ages). Mood comes from **emitters**: block light tint per emitter via the existing hue flags (`LIGHT_HUE`): torch/furnace warm `#ffb060`; steam gauge glass `#ffc870`; blast `#ffd0a0`; lamp `#ffd95a`; arc `#a9d8ff` (cool share); fission `#5cf0c0`; star `#fff2b0`. Weather (exists) supplies the rest; add *dust haze* (Forge) and *glossy wet* (Current) as parameters of existing wet/haze systems, not new passes. Phone budget: no new full-screen passes; particle cap per age-new emitter 24.

### 4.5 Sound palette

All synthesised in `src/audio/sfx*.ts` (names `<area>_<what>`; no speech; pitch = state). **The hearth motif:** a 5-note phrase (A3 C4 E4 D4 A3; pentatonic) played on one *voice per age*, each age adding a voice to the same phrase, so the soundtrack is the arc itself:

| Age | Voice added | Timbre (synth) | When it plays |
|---|---|---|---|
| Ember | `hearth_flute` | triangle + breath noise, slow attack | age start, first fire, first cup |
| Bronze | `bronze_bell` | 2-op FM bell, short decay | shaft turns, valve sings, age advance |
| Forge | `forge_low` | saw + low-pass, 80-110 Hz | the blast, steel, age advance |
| Current | `current_pluck` | square arpeggio, fast decay | arc strike, lamps ripple, age advance |
| Atomic | `pile_drone` | sub sine + slow tremolo | criticality, vault entry |
| Star | `star_chord` | stacked all five voices | ignition only |

Rules: music-like stingers play only at moments (>= 90 s apart), never in loops; muted by default on **Reduce sound** setting; ambience has no melody.

New sfx and ambience (builders name them exactly; all go in `src/audio/*`; each needs an entry in the sfx tests):

| System / age | One-shots (`SfxName`) | Ambient layer (loop, budget 0.12 of master) |
|---|---|---|
| Ember handwork | `chop_stroke`, `quern_grind`, `anvil_ring`, `clay_slap`, `pour_metal`, `slate_read` | furnace crackle (exists), night crickets, leaf rustle |
| Brewing | `kettle_boil` (exists-ish), `cup_pour`, `drink_sip` | boil simmer (exists `ambienceBoil`) |
| Bronze steam | `cog_tick` (pitch = rpm), `valve_whistle`, `steam_chuff`, `bell_seize`, `belt_hum`, `chute_whoosh`, `wheel_splash` | shaft hum (pitch/loudness by rpm and load), steam hiss |
| Forge | `hammer_thud`, `blast_roar`, `mill_grind`, `slag_hiss` | blast bed (rises with air bar) |
| Current | `relay_click`, `arc_strike`, `lamp_ripple`, `turbine_whine`, `thunder` (exists) | mains hum (pitch by load) |
| Atomic | `geiger_tick`, `coolant_flow`, `pile_critical` | drone A1, coolant trickle |
| Star | `star_charge` (rises 90 s), `star_ignite` | none (silence after) |
| Magic | `essentia_pour` (exists), `scan_chime` (exists), `aspect_attune`, `node_hum` | spring-stone hum (very quiet, 20-block radius) |
| World | `ruin_enter_cue` (per family: a 1.2 s phrase of that age's motif voice, played at 12 blocks inside the ruin footprint, a **teaser** for later ruins), `seep_bubble`, `cairn_tick` | wind through ruins |
| Emberbound | `automaton_*` (exist) | none |

Budgets: simultaneous one-shot voices <= 8 (phone), looped layers <= 5 active, each layer attenuated by distance (existing `furnaceDistance` model); a new loop must be added to the ambience volume-budget test.

### 4.6 Accessibility and phone readability

| Area | Rule | Check |
|---|---|---|
| Contrast | text >= 4.5:1 on surfaces; pills' border colour >= 3:1 against HUD background | automated in `layout.test.ts` helpers (add `contrast()` helper in `src/ui/kit/format.ts`, U) |
| Colour-only | every colour-coded thing has a glyph or shape; Codex branches, pills, power strip, goggles ring | review checklist |
| Text size | HUD body 14 px min, readings 16 px (`hw-num`), tap targets >= 44 px (exists); **UI size** setting Normal / Large (+20%) (known gap in WHATS_LEFT 6) | e2e at 390x844 and 844x390 |
| Motion | `Reduce motion` setting: no camera shake, no screen flash, pulses become static outlines, particles halved | e2e checks flag respected |
| Flash | lightning, arcs, ignition: <= 3 flashes per second, <= 25% screen luminance change | unit test on the flash scheduler (U) |
| Sound | **Captions for sound** toggle: a small toast-column line for important cues with direction arrow ("<- Bellows Hound growl", "valve whistling", "bell"); haptics opt-in (`navigator.vibrate` 20 ms on pour/strike, 60 ms on seize) | settings test |
| Phone one-hand | goal tracker and hotbar reachable by the right thumb; Codex sheets are bottom sheets; long-press 420 ms (exists) | e2e |
| Performance | no per-frame allocation in new render code; new particle emitters pooled; textures all painted at load (< 1.5 s total painting, existing test cap) - re-measure after adding ~60 tiles | `textures.test.ts` cap kept |

---

## 5. New content keys the dossier needs (so the lanes agree on names)

Block / structure keys (owner W in `blocksWorld.ts` + `specRosterWorld.ts`): `ochre_rock`, `ochre_sand`, `mesa_clay`, `pitch_pine_log`, `bitumen_crust`, `standing_stone`, `waymark_cairn`, `barter_cairn`, `slate_cairn`, `rusted_gearbox`, `rusted_shaft`, `slag_brick`, `slag_heap`, `relay_pylon`, `pale_concrete`, `graphite_block`, `star_ring_rib`.
Texture names (owner U, painter file `src/render/textures/worldAges.ts` + `iconsAges.ts`): the same keys plus `item_slate`, `item_pitch_pine_sap` if distinct, `icon_age_*` (6 small hearth glyphs used by the Codex and furnace ladder), `glyph_*` for the status pills (flame, leaf, bean, bread, cog, drop, bolt, rune).
Sfx names: section 4.5 table. Flags: section 3.1.

---

## 6. Ordered, dependency-correct task list for three parallel builder sessions

**Gate T0 (not ours):** six-age refactor merged; `AGE_INDEX` updated; tests green. Nothing below starts before T0. After T0, the three lanes run **in parallel** on disjoint files with these *two* ordering contracts (U0, W0) that must be done first inside their lanes:
- `U0` must land before `W1` commits (painters exist before block specs name them).
- `W0` must land before anything in W that changes generated terrain.
Everything else has no cross-lane dependency. Lane O depends on W only for the *ruin flags* and slate keys (O6), which can be written after W1.

### Lane U - textures / audio / UI (owner of: `src/render/textures/**`, `src/audio/**`, `src/ui/**` except `src/ui/hud/goal.ts` and `coach.ts`, `src/core/gameEvents.ts` SfxName union only, settings additions in `src/core/types.ts` Settings only)

| ID | Task | Depends | Acceptance |
|---|---|---|---|
| U0 | Contract stubs: add `SfxName`s from 4.5 (append, one commit) with **silent-or-simple** placeholder synths; add painters (recolours) for every key in section 5 so `hasPainter` is true; add `agePalette.ts` with the 7 ramps | T0 | `npx tsc --noEmit` clean; `npx vitest run src/render/textures src/audio` green (extra painters for not-yet-registered names do not fail; if they do, register names in the same commit). Commit message lists the names so W1 copies them. |
| U1 | Real painters for world/age blocks (mesa, pitch pine, seep, standing/waymark/barter/slate cairns, rusted pieces, slag, relay, concrete, graphite, ring) from the ramps; age rivet on every machine casing; ruin wear variants | U0 | `node scripts/texture-sheet.mjs --out=<dir> --scale=6` reviewed; `readability.test.ts` extended (L* contrast rules in 4.2) passes; no duplicate tiles; paint-all < 1.5 s |
| U2 | Item icon categories (gear, pipe, jar, slate, cell) and pill/age glyph sets | U0 | icon tests: transparent bg, 1 px outline; glyphs 16x16 legible at 28 px |
| U3 | Sound: real synths for 4.5 one-shots and layers; hearth motif voices; `ruin_enter_cue` per family | U0 | `sfx.test.ts`, `ambience.test.ts` budget (<= 5 layers, <= 8 voices); each `SfxName` has a recipe (G2 rule) |
| U4 | HUD: pills row + `+N` sheet, target line status sentence cap (<= 70 chars asserted), goggles ring dial, aura dial, `--hw-age` token, furnace screen hearth-ladder strip | U2 | `hudMath.test.ts` additions; e2e screenshots at 390x844 and 844x390: no overlap with touch controls (existing check) |
| U5 | Accessibility: UI size, Reduce motion, flash limiter, sound captions, optional haptics; settings screen entries | U3 U4 | unit tests for flash limiter and caption queue; e2e with each setting on |
| U6 | Phone/GPU review: `HW_GPU=1` screenshots of every age's signature block set (a "wall of every block" harness exists) | U1-U5 | reviewed images in `docs/advice/screens/` (optional) and a short list of fixes |

### Lane W - worldgen and ruins (owner of: `src/world/**` except tests of other lanes, `src/content/{blocksWorld,specRosterWorld,loot,oreVeins,emberbound,automatons,creatures,itemsGround?}.ts` (read before editing), `src/mobs/**`, `scripts/world-map.mjs`, `docs/api/{world,world-features,world-content,emberbound-content}.md`)

| ID | Task | Depends | Acceptance |
|---|---|---|---|
| W0 | `genVersion`: add optional `genVersion` to `WorldSnapshot` (absent = 1); `generateChunk(seed, cx, cz, genVersion = CURRENT)`; new features gated by `genVersion >= 2`; fresh worlds get 2; loading an old save keeps 1 | T0 | `world.test.ts`: old snapshot (fixture) loads and regenerates byte-identical chunks vs a recorded hash; new world has `genVersion 2` |
| W1 | Content keys of section 5: blocks, ruin loot tiers (`gear/row/relay/vault`) with age caps; roster fixture updates; mapping to U0 texture names | U0, W0 | `npx vitest run src/content` green incl. loot age-cap test (no item past its ruin's age); roster fixture updated |
| W2 | Provinces (noise field, ore multipliers, surface re-skin) + `mesa` biome (append `BIOME_KEYS`, `BIOME_PRECIPITATION`, mob habitat, ore mults); spawn never inside | W1 | `world-map.mjs --prospect` prints distances to each prospect rule (1.1-1.5); a test asserts them over **12 seeds** (copper <= 120, tin <= 160, pitch stand <= 140, stream <= 180, coal+iron <= 220, quartz <= 320, ruin gearhouse <= 220) |
| W3 | Ruin families (Gearhouse, Blast Row, Relay Hall, Pile Vault, Starhearth Ring) with `RuinStyle`, guards via `ruinGuards.ts`, loot via `ruinCrates.ts`, and entry **flags** (`ruin_entered_*`) + `ruin_enter_cue` sfx | W2, U0 | `features.test.ts` extended: each family places for seeds 1-10; crates exist; chunk-order independence kept; node timing test (<4 ms best of five 12-chunk batches) still passes |
| W4 | Pitch pine stands, seep mounds, spring stones, waymarks, slate cairns, barter cairn | W3 | determinism tests; `world-map.mjs` legend shows all; a barter cairn e2e (drop 4 bread, receive a gift) |
| W5 | Guardian scaling and teasers: re-age data for Emberbound per age (Bellows Hound -> Bronze, Wardens at Blast Row), ruin guard counts by family; drops per CONGRUENCE F5 | W3 | `emberbound.test.ts` green; spawn tests per place; first-night Mite spawn still guaranteed near spawn |
| W6 | Prospect and exploration tests, docs/api notes, handoff: `docs/api/world-features.md` updated | W2-W5 | all W tests green; world map screenshot saved; `npx vitest run src/world src/content` pasted counts |

### Lane O - objectives / Codex / balance (owner of: `src/content/{objectives,objectivesHand,objectivesBrew,objectivesWorkshop,progression}.ts`, new `objectivesBronze.ts`, `objectivesForge.ts`, `objectivesLate.ts`, `lore.ts`, `src/ui/hud/goal.ts`, `src/ui/hud/coach.ts`, `scripts/codex/**`, `src/content/balance.test.ts` (new), `docs/PROGRESSION.md`, `docs/api/hud.md` (goal/coach parts))

| ID | Task | Depends | Acceptance |
|---|---|---|---|
| O0 | Single ordered `OBJECTIVES` index per age with `requires`, `opt`, and `hint` fields; renumber `age` to the six ages; keep ids stable; `ageIndexOf` everywhere | T0 | `content.test.ts` objective-chain tests green; every id unique; old-save progress (completed ids) still resolves |
| O1 | Bronze chain (1.2) with flags; workshop goals moved to `opt`; `place_bell` required | O0 | solver in `progression.ts` proves reachability to Blast hearth; `objectives.test.ts` playthrough extended through Bronze |
| O2 | Forge/Current/Atomic/Star chains (1.3-1.6); the Star hold objective; casing-count decision applied | O1 | playthrough test to `ignited` with flags stubbed; no goal's reward from a later age |
| O3 | Hint ladder: per-goal nudge table (<= 60 chars), rungs 1-3 (3.3), world-cue requests (motes column event `goal:hint`) emitted for renderer (U) | O0 | `coach.test.ts`: rung timing with fake clock; suppressed on Peaceful flag; no text > 60 chars |
| O4 | Codex tree (3.4) in `scripts/codex`; Field Journal page (places + lore + side goals) | O1 O2 | `npm run codex` zero warnings; every required objective once; mobile layout screenshot at 390 px |
| O5 | `balance.test.ts`: cost model and +-15% bands (2.6); prints table | O1 O2 | prints table to test output; failing when out of band |
| O6 | Lore slates (2.5) in `lore.ts` + `lore_read_n` flag glue; Field Journal discoveries | W1 (keys), O4 | content test: every slate <= 140 chars; Field Journal lists 10 discoveries |

### Cross-lane sequence (who waits for whom)
```
T0 (six-age refactor, exclusive)
 ├─ U0 ──────────────► U1, U2, U3 ─► U4 ─► U5 ─► U6
 │     └──────────────► W1 (needs painters) ─► W2 ─► W3 ─► W4 ─► W5 ─► W6
 ├─ W0 ──► W1 ...
 └─ O0 ─► O1 ─► O2 ─► O3 (parallel to O4) ─► O4 ─► O5 ─► O6 (needs W1)
Final: stream G (integration) runs the playtest below after all three lanes merge.
```
File-ownership collisions to watch: `src/core/gameEvents.ts` (U0 appends SfxNames; nobody else edits it in this window), `src/core/types.ts` (Settings only for U5; objective fields only for O0 - sequence O0 before U5 or rebase), `src/content/blocksWorld.ts` / `specRosterWorld.ts` (W only), `src/ui/hud/*` (U owns all but goal.ts/coach.ts), `docs/api/*` each lane updates its own notes.
**Commit rule:** each task one commit on its own files; run `npx tsc --noEmit` and the lane's vitest subset; leave `dist/` and e2e to the `.run-lock` mutex (team.md).

---

## 7. Final playtest checklist (stream G; phone portrait 390x844 first, then 844x390, then desktop; Dev Mode off, fresh world; then once with an old-save fixture)

Global passes (every age): no text wall (any panel > 2 sentences fails), every machine shows a status sentence <= 70 chars, tap targets reachable by thumb, Reduce motion and captions work, sound muted/unmuted correctly, frame time stays smooth (target 30 fps mid-range phone), save/load round-trip mid-goal, `genVersion` old-save unaffected.

**Ember (first 30 minutes of the age)**

| Minute | A phone player should... | Pass if |
|---|---|---|
| 0-3 | break wood, split planks at a chopping block | first goal done without asking; hint rung 0 only |
| 3-10 | flint pickaxe, rubble, clay, place the furnace | spawn resources found within 48 blocks; dark/cold felt (vignette) but not lethal |
| 10-15 | **first fire** at dusk, charcoal, warmth | moment 1 plays: light disc, Mites stop at the rim, motif note 1; natural stop |
| 15-25 | clay table, fire a mould, smelt copper, **first pour** | pour moment readable; first tin trip < 160 blocks and found without compass |
| 25-30 | hammer a plate, grind flour, farm a row | every hand station gives feedback per stroke; hunger bar behaves |
| (later) | bronze, boil a bucket, **first cup**, visit Old Works, upgrade list | buff pill appears; ruin cue plays; list fits on screen |

**Bronze**
| 0-5 | place the Bronze Furnace, boil water, see steam | kettle pot vs copper kettle never confused (names + glyph) |
| 5-12 | hand crank, **first shaft turns**, millstone grinds | goggles readout appears at 3 blocks; cog tick pitch follows rpm |
| 12-20 | gears, ratio dial, saw bench, heat via thermocouple | status sentences obey the 70-char rule; seize -> bell, never an explosion |
| 20-30 | boiler multiblock via ghost, raise steam | gauge needle readable; **valve sings** moment plays; 5 s burst warning visible |
| later | piston power, air tank, vacuum chute, blast nozzle | chute moment; Gearhouse visited by minute ~35 (loot fits the gate) |

**Forge**
| 0-8 | build the blast hearth around the nozzle | structure ghost lists missing blocks; **the blast** moment |
| 8-20 | iron smelted, coal/limestone from Coal Ridge, heavy axles | Coal Ridge reachable <= 260 blocks; Blast Row guards beatable with bronze/iron maul |
| 20-30 | steel, rolling mill, thermocouple upgrades | bar moves visibly; hammer thuds on the shaft beat |
| later | dynamo, first lamp at dusk, crusher | lamp moment at dusk; 2 kW/1 MJ goals reachable |

**Current**
| 0-10 | cable run, arc electrode, hearth turns blue | colour change on the mouth is unmistakable; power strip appears at first watt |
| 10-20 | pump water, circuits, 1900 C | brown-out warning clear; lamp ripple moment |
| 20-30 | storm with turbines; ward beacon | forecast line mentions storms; flashes <= 3 Hz; Arc Drones only in storm/new moon |

**Atomic**
| 0-10 | plasma hearth shell, superalloy | shell planner counts; superalloy time matches table |
| 10-25 | fission pile, 60 kW, coolant | **criticality** is calm; Geiger ticks track output |
| 25-30 | deuterium, star core; Deepworks trip | colossus heard before seen; flooded gallery air meter works; one superalloy sample in Pile Vault |

**Star**
| 0-5 | assemble the star shell, place the core | casing count text matches the final decision |
| 5-15 | feed 300 kW, hold 90 s | countdown ring visible; dips soften, never fail; **ignition** chord uses all voices; afterglow persists |
| after | continue playing | `ignited` flag set; Field Journal shows %; 1 MW state works |

---

## 8. Decisions for the owner (defaults in parentheses)

1. Star hearth casings: **61** (default recommendation) vs 93.
2. `mesa` as a real biome (default **yes**) vs province only.
3. Cosmetic Field Journal rewards (default **yes**: compass, lantern) vs none.
4. Barter Cairn / lore slates / Waymarks (default **yes, small**; they are the lightest-weight exploration rewards and the first things to cut if usage is tight).
5. Moving the `thermopile` goal to Bronze (default **yes**).
6. Reduce-sound default off, captions default off, haptics default off (all opt-in).

## 9. Risks and what I did not verify
- `genVersion` is the one thing that can corrupt a save if skipped; keep W0 first and test with a recorded old-save fixture.
- Adding ~17 block keys and ~60 tiles raises the atlas layer count: check the layer limit and memory on phone (`DataArrayTexture` max layers >= 256 on WebGL2 baseline; current 164 + ~60 is fine; verify).
- `bitumen` and some `itemsDistill` keys, the `ageMap` after refactor, the location of `TEXTURE_NAMES`, and the final `RuinSite` extension points were **not** inspected in code; builders must read them first.
- Numbers in 2.6 and the ring tables are starting values; the cost model in `balance.test.ts` is the arbiter.
- Not played: nothing here was judged on-screen. U6 and the playtest exist to correct the art and pacing calls.
