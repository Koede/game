# Advice dossier - lanes B (distillery) and C (Create-style workshop)

Advisor note, read-only pass, 2026-11-21. Written for the two architects and their four builders. It does not repeat
`docs/advice/tech-spine.md` (steam, shared kinetic/heat/fluid model); where this dossier needs something from that
spine it names the seam and a stand-in. Facts below were checked in the code on this branch; anything not checked is
marked **(verify)**. Names are original; every sentence a player reads is under 70 characters.

## 0. What the code already does (so nobody builds it twice)

| fact | where | consequence |
|---|---|---|
| Workshop oil exists: `LUBE = { residue: 1.25 / 600 s, pine_resin: 1.10 / 300 s }`; Use of `residue_canister` or `pine_resin` on any part oils the WHOLE network (`capacityFactor` into `solveNetwork`) | `workshop.ts:39,245-252,383-392` | Lubricant work is a re-key of this table, not a new system. `residue` as oil is a *placeholder* (it is the dirty residue, not lube) and must drop to 1.10 when real lubricant lands |
| `lube_base` (bp 370, viscosity 12) and `bitumen` (bp 520) are components; a crude run leaves `residue` = lube_base .34 + bitumen .66 | `chem.ts`, plan 5.1 | Vacuum residue run needs only the `pf = 0.7` pressure factor of plan 5.2 + a setpoint of 260-280 C |
| A flask's temperature comes from `Distillery.baseTemp(base)` = `min(setC, furnace below, 450)`; no furnace -> `null` -> flask "blocked" | `distill.ts:192,217-230` | Ground burner = one more branch in `baseTemp` |
| `Still` = `{ flask, base, segments[], draws[], head }`; the stack walker only knows `column_segment` | `distillScan.ts:36` | Reflux head and catalyst bed are two more stack members, same walker |
| `stepStill` uses `stagesOf(height)`, `trayTemps`, `vapourShares`, `leakShare`; BOIL_LPS 20 | `distill.ts:217-310` | Reflux = raise the stage count and cut `want` by (1-r) |
| Chem modules are entities, never machine nodes; rigs are derived on load, never saved | api/distillery.md | Everything new that persists lives on module entities (`ChemEntity`) |
| Contraption steps are instant: `commit()` clears old voxels, `relocate`s per-block state, writes new voxels in one `hold()`. A structure floods through ANY movable block, belts included, up to 48 | `contraption.ts:84-110,127-160` | Tween needs a two-phase move; belt borders need a pin rule (section C.8) |
| `standingOn(x,y,z)` is the only treadwheel input (the player only) | `game.ts:164`, `workshop.ts:349` | Animals plug in by widening this one hook |
| `GEARSHIFT_PROGRAMS` = 3 presets of `[seconds, factor][]`; `Part.s` is the program index | `kinetics.ts:20-45` | A card is a 4th kind of program, `Part.s >= 3` or a stored pattern |
| `ItemStack` is `{ item, count, durability? }` only | `core/types.ts:79` | Per-stack data (a punched card, sips left in a flask) needs either `durability` abuse or one append-only field `tag?: number`. **Recommended: add `tag?: number`** in one tiny shared commit (inventory save + stack-merge compare + sanitizer) |
| `DRINK_BUFFS`: spring, hearthkept, mending (tea); swift, vigor, lasting (coffee) | `core/brewing.ts:81` | Elixirs are these six, longer |
| Ghost pipeline: `GhostLayer` (one instanced geometry, `solid` and `xray` materials, `GHOST_CAP` 512), `GhostCell {x,y,z,role,want,has,state}` | `render/tech/ghosts.ts`, `sim/hearthView.ts` | Rig ghosts and moving blocks both reuse it |

Age table for both lanes (single table each, so the six-age refactor edits one place). The distillery docs use the old
five-age names; the owner's six ages (Ember = handwork only) move every glass rig out of Ember:

| age | distillery (`DISTILL_AGE`) | workshop (`WORKSHOP_AGE`) |
|---|---|---|
| Ember | nothing (no glass, no machines) | nothing |
| Bronze | still_base, flask, condenser, receiver, tube, vessel, airlock, **ground burner**; syrup, wash, low wines, spirit, tinctures; filter_bed | cranks, shafts, belts, stations, depot/funnel/chute, basin, spouts, arm, deployer, signals, **trinkets**, cards |
| Forge | column_segment, **reflux_head**, jacket, chem_port, canisters; crude run, fuel ethanol, **vacuum_cap** (powered by a Bronze shaft), lubricant, grease, bitumen, asphalt, elixirs | piston, bearing, skiff + rail, vault growth, treadwheel animals |
| Current | pressure_cap, catalyst_bed, steel shell (900 C), cracker | electric stirrer variant, magnet collector |
| Atomic | refinery tower multiblock | - |

The tower is "late Forge" in `CONGRUENCE` and "Atomic+" in the plan; this dossier recommends **Atomic** (a 16x throughput
box is a late reward; Forge already has a three-cut column) and flags it as an owner decision (section H).

---

# LANE B - DISTILLERY

## B.1 Ground burner (Bronze comfort: a still without a furnace)

**Player sees.** A Still Base set on bare ground (not on a furnace) shows an empty fire cup. Use with charcoal (up to 8) or a
Fuel Ethanol Beaker loads it; the cup glows amber, a tiny flame and heat shimmer rise through the flask, a quiet
fire crackle plays, the base block takes its `_on` look (existing active bit). It burns down on its own; the lamp goes dark
and a faint ember ticks when it dies. Empty hand on a burning base still cycles the setpoint, but a ground burner never
exceeds its fuel's temperature.

**Numbers (`BURN_FUELS` in `core/distill.ts`).**

| fuel | holds | temp cap | burn time per item | note |
|---|---|---|---|---|
| `charcoal` | 8 | 260 C | 150 s | enough for syrup, low wines, spirit, tinctures. Not crude (350) |
| `fuel_ethanol_beaker` | 1 (250 L) | 320 C | 240 s, beaker handed back empty | self-fuelling loop: spirit run makes its own fuel |
| `residue_canister` | 1 | 300 C | 400 s | smoky: spawns soot particles, no other cost |

Heat-up is the existing first-order lag towards `min(setC, cap)`. Draw on a furnace: none (a ground burner has no
`extractW` sink; the heat is free but small: the vapour latent heat is checked against a power budget `BURNER_W` 6000 W:
`V = min(heatW / BOIL_J_PER_L, ...)`, so a burner boils 15 L/s at most, 25 % slower than a furnace).

**Contract.** `ChemEntity` (base only) gains `fuel?: { item: string; n: number; leftS: number }` (saved). `Distillery.baseTemp`:

```
baseTemp(base):
  f = host.furnaceUnder(base)
  if f: return min(base.setC, f.tempC, GLASS_MAX_C)            # unchanged
  b = base.fuel
  if b and b.leftS > 0: return min(base.setC, BURN_FUELS[b.item].cap)
  return null                                                  # cold: flask "blocked"/idle as today
tickBase(base, dt):                                            # new, 4 Hz, only for bases with fuel
  if base.fuel.leftS > 0: base.fuel.leftS -= dt
  if leftS <= 0 and base.fuel.n > 1: n -= 1; leftS = burnS      # next piece
  if leftS <= 0 and n <= 1: base.fuel = undefined; show(idle)
```
Fuel only burns while a flask with a charge sits above (otherwise 10x slower: "banked"), so a burner is not wasted
while the player gathers. `chemUse` table gains: held fuel on a base -> load; wrench -> unload (refunds `n-1`).

**Phone.** Tap the base with fuel in hand (the big Use button); the crosshair line says "Burner - 4 charcoal, 210 C, 2 min".

**Extend.** `core/distill.ts`, `sim/distill.ts` (`baseTemp`, new `tickBase`), `sim/distillActions.ts` (`chemUse`), `distillFx.ts`
(flame instance on bases with `fuel`: reuse the bubble shader, `rate` = 1).

**Acceptance.** Unit: `buildRig('B F / ...')` on stone, load 2 charcoal, run: flask reaches 92 C, a `spirit` card yields
>= its `expect`; fuel burns out then flask goes `done`/idle; 2 charcoal = 300 s of heat (+/-1 step); save and load keeps
`fuel.leftS`. E2E (`e2e-distill.mjs`): place base on grass, give charcoal, Use, screenshot shows flame instance count > 0
(`window.__hw.distillStats()`), phone portrait too.

## B.2 Reflux head

**Player sees.** A tall glass finial block on top of a column. Wrench on it cycles 0 / 50 / 75 % return; its liquid
slab shows a falling drip loop proportional to the ratio; the crosshair line says "Reflux head - 75% back, purer, slower".
Visibly the output slows (a drip every ~2 s instead of a stream) and the spirit grade rises.

**Rules.** Stack member exactly like a segment (valid top of the column; the head condenser sits on its top or on its H side).
It adds no holdup (like a segment). `ratio` in `{0, .5, .75}` saved on its entity.

```
# distillScan.ts: stack walk accepts reflux_head as the LAST member; Still gains reflux: string | null
# distill.ts stepStill (replace stagesOf(height) and `want`):
  r        = reflux ? mod(reflux).ratio : 0
  stages   = stagesOf(height) * (1 + 2 * r)       # plan 5.2: n = 1 + plates*(1+2r)
  want     = BOIL_LPS * min(1,(ts-tb)/2) * dt * (1 - r)
  # liquid never returned in litres: the effect is purity (more stages) and throughput (less want)
  # => conservation untouched, no new buffer, the fuzz test stays valid
```
Worked numbers (check with the existing 38/74/93 hand figures): sugar_wash, 3 segments, r = .75 gives ethanol share >=
0.90 (`fuel_ethanol` grade) in one pass at 25 % rate; r = 0 gives about 0.65.

**Data.** `CHEM.reflux = 'reflux_head'`, `CHEM_CAPACITY_L.reflux_head = 0`, `ChemEntity.ratio?: 0|0.5|0.75`; new block + texture
tile (`chem_case` frame x lamp states, emblem painted by the existing function; no `_done` twin). Problem codes appended to
`RigProblemCode`: `reflux_not_top` ("The Reflux Head belongs at the top of the column"), `no_column` (reflux on a bare flask).

**Extend.** `core/distill.ts` (kind), `distillScan.ts`, `distill.ts` (stepStill, `chemUse` wrench branch), `blocksDistill.ts`,
`textures/distill.ts`, process card `rectify_spirit` gains a variant `reflux_ethanol` (rig string with `H`, legend letter added in
`distillKit.buildRig`). **Acceptance.** Unit: reflux 0 vs .75 with the same 3-segment rig: purity up, litres delivered per
second down, conservation fuzz extended to include the head. Card test `reflux_ethanol` yields `fuel_ethanol`.

## B.3 Filter bed

**Player sees.** A glass cylinder you pour through. Use with charcoal / clay / sand loads the medium (4 slots, shown as a dark
layer that visibly greys as it spends). Liquid from above drips through to below; a spent medium turns the lamp red
("blocked": needs a new one) and the layer is drawn black.

```
FILTERS (core/distill.ts):  medium -> { capacityL, removes: Component[], converts: [{from,to}] }
  charcoal : 150 L per piece, removes fusel + methanol + turpentine     (clean-up: raises the ethanol share)
  clay     : 200 L per piece, converts lube_base -> lubricant           (the lubricant polish, B.4)
  sand     : 400 L per piece, removes solids only (cloudy -> clear), converts nothing
stepFilter(f, dt):                       # runs in rig.order, before drain()
  m = medium slot; if none or spent: state = blocked; return (liquid waits above)
  pass = min(FLOW_LPS / sqrt(visc) * dt, f.mix litres, m.left)
  for c in components of pass:
      if rule.removes has c:  absorbed += x          # litres taken by the medium: m.left -= x; counted in rig.absorbed
      elif rule.converts has c: out[to] += x          # same litres, new component
      else out[c] += x
  m.left -= pass; if m.left <= 0: consume one item, next piece, or blocked
```
Conservation: `absorbed` is added to the fuzz test's litre ledger (total + absorbed constant). New components `lubricant`
(non-volatile, colour 0xc9a227, viscosity 8) and `clear` is not needed (purity grades read the share).

**Data.** `CHEM.filter = 'filter_bed'`, stateful (`_done` twin = medium spent), entity `slot?: { item, left }` saved. Items go in by
Use of the item or by a `chem_hopper` (B.10). **Extend.** `distill.ts` (`stepFilter` in `stepRig`), scan (liquid in U, out D),
`textures`, `distillFx` (layer slab colour = medium wear). **Acceptance.** Unit: spirit wash with fusel 3 % through charcoal
raises ethanol share; 151 L exhausts a 150 L charcoal piece mid-pass; `blocked` lamp; save/load keeps `left`.

## B.4 Lubricant and grease, end to end (B x C)

**Chain (Forge).** crude -> 3-segment column 350 C -> `residue` -> **vacuum still** 270 C (vacuum_cap on the stack, powered) ->
`lube_base` head + `bitumen` in the flask -> `filter_bed` with clay -> `lubricant` -> `lubricant_beaker` (250 L). Grease:
heated vessel 90 C, lubricant 3 : rosin 1 : tallow 1 (items) -> `grease` item (3 per 750 L batch).

**Vacuum cap.** `CHEM.vacuum = 'vacuum_cap'`; capability `vacuum` only while powered: a kinetic part (shaft, any) touching the
cap or the pump block below it turns >= 16 rpm. Draw 3 su on the workshop network (hook C.10 `registerLoad`). Unpowered =
red lamp and sentence "The Vacuum Cap needs a turning shaft". `pf = 0.7` is already in the stepStill spec; `STILL_SETPOINTS`
gains 60, 270 (new list: 60 78 92 97 130 200 260 270 350 420). Lube_base bp 370 x 0.7 = 259: at 270 C the run starts 219 C and
finishes when the flask holds only bitumen (the existing "nothing boils -> done"). A 1000 L residue run: 340 L lube_base,
660 L bitumen (the mix itself), about 90 s at BOIL_LPS (4 Hz steps).

**What lubricant does on a shaft (C-side contract, one table).**

| oil | item | factor | lasts | notes |
|---|---|---|---|---|
| pine resin | `pine_resin` | x1.10 | 5 min | stays |
| residue (old) | `residue_canister` | x1.10 | 5 min | was 1.25: lower it so lubricant matters |
| lubricant | `lubricant_beaker` | x1.25 | 10 min | glass back |
| grease | `grease` | x1.50 | 40 min | friction halved: also -50 % squeal threshold |

Change in `workshop.ts` (owner C): `LUBE` becomes `Record<item, { factor, s }>`; `use()` checks `LUBE[held.item]`; the
`lube` map keeps the strongest. The goggles sentence already shows oil: new text "oiled x1.25, 9 min left". **Player
sees**: a sheen strip (a one-box `bars` instance, colour amber, alpha pulsing) on every oiled shaft; an un-oiled network above
85 % load squeals (a pitched saw-tooth `pipe_clunk` loop at 0.4 volume, gone when oiled).

**Chainsaw bar oil.** Use `lubricant_beaker` on the held chainsaw: `Game.barOil = BAR_OIL_LOGS` (60 logs) and while > 0
`fuelPerLog x 0.8`; state saved `world.persist('barOil')` (not on the item, until `tag` exists). Shown in the saw line:
"Chainsaw - 14 fuel, oiled (41 cuts)". Files: `game/felling.ts` (B owns the constant only), `app/game.ts` (one hook).

**Acceptance.** Unit: vacuum run on residue gives lube_base within 5 % of .34 of input; filter turns it to `lubricant`;
`solveNetwork` capacity 1.25x; grease recipe. Golden e2e (`e2e-distill`): crude -> residue -> vacuum (shaft turning) -> filter ->
beaker -> Use on shaft: sheen visible, goggles "oiled", load % falls; desktop + phone.

## B.5 Bitumen, asphalt and tarred planks (road blocks)

**Bitumen out of the flask.** A flask of pure bitumen is a thick black pool. Empty `empty_canister` on the flask's lower half
(the drain cock): allowed only below 150 C ("Too hot to pour - let it cool"), gives `bitumen_canister`. New grade
`bitumen` 0.80, container entry in `CHEM_CONTAINERS`. Drips in the flask one per 2 s (viscosity 200: already in the shader rate).

**Asphalt** (heated vessel, `REACTION_SPECS`): `in: bitumen 1`, `items: gravel 4, sand 4` per 1000 L, needs `heated`, window 140-180 C,
`ruinC` 220, seconds 60, `gives: asphalt_block x8`, emits `distill:step done`. A `chem_hopper`/arm takes the blocks.
**Tarred planks**: a Workshop basin recipe (fluid input, C.9): `bitumen 125 L + 8 planks` mixer 16 rpm -> 8 `tarred_planks`.
No rot, no burning (`flammable: false`, block flag `rot: false` **(verify the existing key)**).

**Road effect (`speedMult`)**. Add an append-only optional `BlockDef.surface?: { walk: number; vehicle: number; mud: false }`
(core/types.ts: shared edit). `asphalt_block`: walk 1.25, vehicle 1.4, never churns to mud; `tarred_planks`: walk 1.1. Player
physics multiplies walk/sprint by the block under the feet (one `getBlock` per frame already read for friction **(verify
`src/player/physics`)**); `vehicles/tractor.ts` multiplies `topSpeed` and skips the churn rule on `surface.mud === false`.
Sound: footsteps use a new `step_asphalt` name only if the audio table accepts it; otherwise `step_stone`. Texture
`asphalt` (dark speckle, 16 px, drawn from the existing procedural gravel generator) + a faint lane line variant is out of
scope.

**Acceptance.** Unit: bitumen cannot be taken at 200 C; asphalt card yields 8; tractor `step()` on an asphalt strip reaches
1.4x top speed, on dirt-with-mud does not; player walk 1.25x. Content test: item reachable (process card as pseudo-recipe).

## B.6 Potions, spirits and tinctures

Pipeline (all vessels or stills, no new machine): **macerate -> filter -> concentrate -> blend -> bottle**.

| step | rig | recipe (`REACTION_SPECS` / card) | result |
|---|---|---|---|
| macerate | heated vessel 50 C | 3 herb items + 500 L `spirit`, 90 s | component `tincture_<buff>` in the spirit |
| clarify | filter_bed (charcoal) | pass | `clear_tincture` (named fluid, bottle-able) |
| concentrate | vacuum still 60 C | clear tincture in the flask; ethanol+water come off, extract stays | component `essence_<buff>` (non-volatile; **above 80 C it scorches to slop**, rule `HEAT_SENSITIVE`) |
| blend | vessel, sealed 20 C | essence 1 : syrup 1 : water 2 | `elixir_<buff>` fluid, 250 L per vial |
| bottle | receiver, vial | `vial` (glass) | `elixir_<buff>_vial` |

`<buff>` is each of the six `DRINK_BUFFS`; herbs: tea buffs use the existing tea leaf items, coffee buffs coffee beans, glowcap
for Glowcap Draught (a seventh buff `nightsight`, **(verify)** or a timed `lightActive` extension). Elixir = `DrinkSpec` with
`buffS` x3 of the cup, same `buffs.grant`; drinks reuse `game/drink.ts` (the vial returns `glass_vial`).
Generated tables (`ELIXIRS` in `itemsDistill.ts`): 6 x (tincture, essence component, elixir fluid, vial item) = 24 specs
generated, not written; fluids are `pipe-only` (not tanks) until needed.

**Spirits as drinks.** `spirit_beaker`: 5 sips (`durability` 5 or `tag`); each sip: Warmed (existing `well_warmed` 90 s) and
Tipsy 60 s: melee +10 %, aim sway +0.6 deg (a camera yaw noise from `Buffs.sway`, **(verify) where look input is read**); a
fourth sip in 120 s adds "Dizzy": sprint off 10 s. `Rough Spirit` (methanol > 2 % grade) = Tipsy plus "Blurred" 20 s (vignette).
Hunger: `DRINK_HUNGER` shared with lane E (spirit 1, elixir 0). Antiseptic bandage: basin recipe `fuel_ethanol 50 L + 2 cloth ->
2 antiseptic_bandage` (heal over time 12 s, `mending`-class regen without the buff). Kerosene lamp: block, no power, burns
`kerosene` from an adjacent canister slot 1 L/min, light 13; gated Forge.

**Acceptance.** Unit: every elixir chain is built by a card string and run (`distillProcess.test.ts`); essence scorch above 80 C;
drink grants 3x; content tests count 24 generated specs and each item reachable. E2E: build maceration + still rig, make
one vial, drink it, HUD chip appears.

## B.7 Rig screen, ghost previews and sentences (in-world first)

Owner rule: in-world over screens. So the "rig screen" is three small things plus one thin sheet.

1. **Goggles sentence** on any module: `"Pot still - 92 C, 2 cuts, 1 problem (tap)"`; Engineer's Goggles' `inspect()` (src/workshop/inspector.ts)
   gains a chem branch calling `sim.brewView` (exists) so the sentence needs no screen. Each tap on the module cycles the
   next problem text and **pulses the offending cells red** (`HEARTH_HIGHLIGHT_S`, `GhostLayer` set `rig:problem`, state `wrong`).
2. **Plan ghosts.** Wrench on a still base cycles the *plan*: nothing, then each process card whose blocks the player owns
   (`PROCESS_CARDS` filtered by inventory + unlocked ages). A chosen plan stores `plan?: string` on the base entity (saved) and
   draws only the **next missing piece** as a ghost with the sentence "Next: Column Segment on the flask" (one ghost at a time is
   readable on a phone; the full rig is on the long-press "show all"). Orientation: the four rotations of the card relative to
   the base; pick the one with the fewest conflicts (the `structureView` best-placement idea).
3. **Capability line** under the sentence: "This rig can: distil, 2 cuts, ferment" and, computed on demand, "One more Column
   Segment would add: Kerosene" (re-run the scan with one block added over the 17 kinds: 17 cheap scans, only when the tap happens).
4. **Rig sheet (the only screen).** Empty hand on a flask while sneaking, or goggles on a module: a bottom sheet (existing
   `furnaceScreen` shell, `ui-tech`), two tabs only: PROCESS (thermometer with each component's bp marked and contents bars)
   and PLAN (card list with a Preview button that sets `plan`). Nothing is editable that is not also doable in-world.

**Data.** `core/rigString.ts` (new, extracted from `distillKit.parse`): `parseRig(rows) -> RigBlock[]` and `rotateRig`.
`sim/distillPlan.ts` (new): `planGhosts(world, base, planKey): GhostCell[]` (next missing piece + whole-rig list),
`GhostLayer.set('rig:'+baseKey, cells)`. `ChemView` gains `problems`, `caps`, `plan`.
**Tests.** `distillPlan.test.ts`: for each card, building the pieces one by one in the ghost order empties the list and the
rig then runs; wrong block in a cell yields `wrong`; rotation choice minimises conflicts. E2E: select card, ghost visible in the
screenshot, place the pieces, run.

## B.8 Tank and pipe support for the new fluids

The tank spec `accepts` list is the five old fluids. Add one derived list `DISTILL_FLUIDS` (the 11 plus lubricant, bitumen, 6
elixirs excluded) in `fluids.ts` (append-only) and let `tank`, `pump`, `chem_port` use it; keep `FluidKey` widening in the
**contract commit** (section E.0). `fuel` (old refined fuel): alias to `gasoline` in the save sanitizer. E2E: receiver ->
`chem_port` (outlet) -> pipe -> tank -> spout -> canister (the golden bottling line, B x C).

## B.9 Catalyst bed, pressure cap, cracker (Current)

`catalyst_bed`: stack member (like a segment), holds 1 catalyst item with durability (zeolite chips `catalyst_zeolite`,
2000 L of throughput). `pressure_cap`: `pf = 1.3`, needs the steel shell (flask kind `steel_still` 900 C, 4000 L) and a pressure
gauge sentence; blows its pop-off (toast, sfx, loses its cap) above 6 bar-equivalents (sum of heat input without a vent):
never destroys glass (steel only) so the Current age is safe to play on a phone.
Cracker rule, in `stepStill` after cut routing: for vapour passing a `catalyst_bed` with `pressure` capability at >= 450 C, each
litre of `diesel` becomes 0.7 L `gasoline` + 0.3 L `kerosene` (litres constant) and the catalyst spends 1 L of life per litre.
`slop` gets a consumer: fertiliser basin recipe `slop 100 L + bone meal -> 4 fertiliser` (lane E consumes). Cards:
`crack_diesel`. Acceptance: conservation fuzz includes catalyst; catalyst spends; unpowered/unsteel rig reports `no_pressure`.

## B.10 Chem hopper and arms feeding stills (B x C)

`chem_hopper` (already in the plan list, not built): an **ItemEndpoint** with a facing. Contract with the workshop (hook C.10):

```
Workshop.itemSinks: { accept(x,y,z,item,n): number; peek(x,y,z): {item,count}|null; take(x,y,z,filter,max) }   # set by Game
Distillery implements it for: reaction_vessel (4 slots), filter_bed (medium), catalyst_bed, chem_hopper (proxy to the first
vessel it touches; output side = vessel's `gives` and spent media)
```
Result: a `mech_arm` can be set (wrench source then target) onto a vessel or a hopper; a belt ending at a hopper feeds it;
the hopper in front of a belt puts asphalt, sugar, elixir vials on the belt. Failure mode to avoid: the arm must never pull a
liquid; `peek` returns items only.

## B.11 Refinery tower multiblock (Atomic)

**Player sees.** A hearth-style hollow stack of `tower_casing` 3 x 3 footprint, height 6-12, with a `tower_feed` port at the
base (pipe in crude), `tower_heater` on the lowest layer (steel base on a Star-tier furnace, or electric element: watts via
the tech spine, **(verify the heat source seam)**), `tower_tap` blocks anywhere on the wall (each is a side draw at its height), and
a `tower_hatch` for catalyst and spent media (item sink, B.10). Rig sheet shows the stack's cut heights.

```
scanTower(world, controller): cuboid scan reusing hearthScan helpers (problem shape, highlight, MAX 8)
   layers n = height - 2  -> stages = n, draws = taps by height, head = top cap (needs a jacket or a `tower_cooler`)
stepTower(t, dt) == stepStill with: BOIL_LPS x16, MAX_SEGMENTS = 12, buffers 16x, no glass limit
```
It reuses `stepStill` entirely (a tower is a `Still` whose parts are cells of one cuboid), so there is no second physics. A
tower runs continuously: feed from a pipe, products leave by `chem_port`-like taps into pipes; the catalyst hatch is fed by belts.
Autonomy loop for the e2e: crude -> pump -> tower -> three tank taps -> canisters by spouts -> belt -> crate.
**Acceptance.** Unit: tower of 6 layers reproduces the 3-cut result of the column card at 16x rate; scan problems for gaps;
sleeping when idle. This is last; it must not block B.1-B.8.

## B.12 Polish list for B (same lane, last)

`distill:step` event `{x,y,z,state,process?}` (bus, plus the existing sfx/toast); objectives "Run your first spirit" in
`objectives*.ts` reading it (stream F owns the file: send them the event contract); sounds: `bubble_loop` (filtered noise, rate
by boil), `drip` (short tick, pitch by viscosity), `glass_chime` on done: three entries in `audio` tables, synthesized
(owner: audio lane, 1-line recipes); Codex progression branch (scripts session, `scripts/codex/progression.json`); balance pass
on `FUEL_GRADES` and yields after playing.

---

# LANE C - WORKSHOP (Create-style)

## C.1 Tweened moving structures

**Player sees.** A piston pushes its machine along over 0.7 s on a sine ease with a soft thump at the end; a bearing swings a
platform through its quarter turn smoothly and settles with a clunk; a skiff glides along a rail at 5 blocks/s with a slight
bob; belts and cogs on the moving structure keep turning and items keep riding.

**Design (two-phase move).** Today `commit()` writes voxels instantly. New flow:

```
beginMove(moves, kind, dur):                    # replaces the body of commit()
  validate targets (same as today)
  record pending = { id, kind, t0 = clock, dur, cells: [{from,to,turn,voxel}], items: [...] }
  hold(): clear the FROM voxels (air); relocate() per-block state to the TO keys (logical cell = destination)
  mark TO cells `reserved` (Contraptions.reserved: Set<string>) -> placement there refuses "A contraption is moving here"
  emit bus 'contraption:move' { id, cells, kind, dur }          # the renderer starts the tween
endMove(id):                                    # at t0 + dur
  hold(): setVoxel(to, voxel with facing turned, active); clear reserved; items snap to final positions
tick(dt): for each pending: if clock >= t0+dur endMove; ground items on moved blocks have their pos set by the SAME
          interpolation (lerp or rotate) every frame while pending (they are carried, not teleported)
actuators: do not start a new step while their structure is pending (piston/bearing timers wait; skiff chains steps with no
          gap: the next beginMove runs at endMove, so a rail trip is one continuous glide)
```
**Rules that keep the Workshop consistent.** `Workshop.verify()` ignores keys in `moving` (else it drops parts whose voxel is
temporarily air); machine ticking pauses for pending cells (they hold their work); belts of a pending structure carry items
only visually (the carried item list is locked until `endMove`); the signal/gate lookups use the logical (destination) key.
**Save.** `Contraptions.toJSON` adds `pending: [{ cells: [[fx,fy,fz,tx,ty,tz,turn]], kind }]`; `load()` completes them instantly
(`endMove` immediately) so a save mid-move never loses blocks. Close-game mid-move test is mandatory.

**Renderer.** New `src/render/workshop/movingLayer.ts` (C1): reuses `GhostLayer`'s geometry with the **solid** material and the
atlas layer of each voxel (`aTex`); per pending cell one instance; matrix = lerp(from,to,ease(t)) or, for bearings, rotation about
the pivot `a = ease(t) * turn * 90 deg`. 48 instances max per structure, 4 structures at once cap (`MOVING_CAP` 192).
Ease: `sineInOut` for pistons/bearings, linear for skiffs. Cog/bar overlays of the moving parts take the same offset: the
`WorkshopRenderer` reads `MovingLayer.offsetOf(key)` when drawing `view.spin` rows of a pending cell.
**Sound.** Piston: low wooden thump at the end (`pipe_clunk` 0.7 pitch, existing) plus a creak loop while moving (a new
`creak` synthesized name, 0.35 volume, pitch by speed). Bearing: ratchet ticks every 22.5 deg (4 per turn, `step` pitch 1.2). Skiff:
wheel tick per block crossed, soft hum at 1 block/s multiples.
**Acceptance.** Unit (fake clock): at t = 0.4 s the FROM cell is air, TO cell is `reserved`, the ground item on the moved belt sits
midway; at dur voxels and state are final; a block placed into a reserved cell is refused; verify() keeps the parts; save mid-move
loads completed. E2E: piston pushes a mill with a belt of wheat; screenshot mid-move shows the block offset; end state equals
today's end state (golden compare).

## C.2 Riding the skiff (and platforms)

**Player sees.** Use on a skiff (empty hand) sits you on it; the camera lowers 0.2 blocks and bobs 0.01 per block of speed; a
single "Hop off" pill appears above the hotbar on phone (jump key on desktop). While seated you look freely, cannot walk.
Standing on a piston platform or a skiff with no seat just carries you.

```
# player side (src/app/game.ts, one hook): Player.ride: { provider: () => { x,y,z } | null } | null
# each frame: if ride: pos = provider() + seatOffset; velocity = 0; skip collision; if provider returns null -> dismount
# platform carry (no seat): MovingLayer.surfaceDelta(feetX, feetY, feetZ): [dx,dy,dz] | null
#   if the feet are on the top face of a moving cell, add the per-frame delta of that cell (lerp derivative) to position;
#   bearing: rotate the offset about the pivot by the frame's angle delta (position carried, yaw untouched)
# dismount: nearest free cell around the skiff (check 8 neighbours + up), toast none
```
Collision desync guard: at `endMove` the passenger is set exactly on `to` top (tolerance 1e-3) **before** voxels are
written, so the written block can never overlap the player's AABB.
Riding is not saved (load dismounts and puts the player on the skiff's top).
**Files.** `render/workshop/movingLayer.ts` (carry maths), `workshop/contraption.ts` (`passengerOf(skiffKey)`), `app/game.ts`
(ride hook, HUD pill via `ui/hud`: the HUD owner approves the pill). **Acceptance.** Unit: skiff with a passenger along a 6-block
rail ends with passenger at the end cell +/- 1e-3, never inside a solid; dismount finds a free cell; piston lift carries a player
up 4 blocks without falling through. E2E: ride the skiff, screenshot (desktop + phone portrait with the pill visible).

## C.3 Treadwheel with tame animals

**Player sees.** A broad wooden wheel on a flat block. Lead a tamed goat onto it (a lead rope item) and it plods in place, the
wheel rolls, a shaft beside it turns at 12 rpm / 24 su. The animal tires: after 90 s it slows, sits and pants; the wheel
stops; it recovers in 45 s. It eats from a trough (a depot or crate holding wheat) beside the wheel: one wheat per 120 s of
work. Without food it works 60 s more then walks off (job cancelled, toast "The goat wandered off hungry").

```
TREAD_BEASTS (src/workshop/animals.ts):   species -> { rpm, su, workS, restS, food: item, mealS }
   goat 12 / 24 su, 90, 45, wheat, 120     hound 10 / 16, 120, 30, meat scrap, 150     ox (when it exists) 8 / 48 (verify species keys, mobs/species)
Workshop.walkers: (x,y,z) => null | { kind: 'player' } | { kind: 'mob', species, id }       # widens standingOn (keep standingOn as the player branch)
sourceFor(treadwheel): w = walkers(...); if !w -> null; if mob: if mob.tired or no food -> null; else { rpm: beast.rpm, capacity: beast.su }
```
**Mob side (stream F's folder, so a seam, not an edit).** New `src/mobs/jobs.ts`: `Job = { k: 'tread', x, y, z }`, stored on the
tame mob (`SavedMob.job?`, `stamina?`); `brain.ts` gets ONE line: `if (mob.job) return runJob(mob, ctx)`. `runJob` walks the
mob to the wheel's top, locks position (yaw tangent), plays the existing walk animation phase at the wheel's rpm, drains stamina,
sits at 0, and eats from an adjacent container via `Workshop.take`. Assigning the job: Use `lead_rope` on a tame mob (ties),
then Use on the wheel (job set); Use on the mob with an empty hand (releases). **Brass horn** (C.7) calls: every tame mob within
24 blocks drops its job and follows. Clay servants (lane D) already stand in via `walkers` kind `servant`: same interface.
**Save** `SavedMob.job`/`stamina` (optional fields, old saves load). **Acceptance.** Unit with a fake mob: stamina curve, feeding,
hunger cancel, job save/load, source rpm 12; no player needed. E2E: lead a goat, shaft turns, screenshot.

## C.4 Continuous spouts and drains from pipes

**Today.** `spout` under a *tank* fills an empty container on the depot/belt below via `bucketUse`. **Remaining.** A spout wired
straight to a pipe and a drain wired to a pipe, flowing continuously.

```
Spout (C Cell): if a pipe/fluid endpoint touches its TOP face and it is powered (3 su, 16 rpm) -> outlet at SPOUT_LPS = 250
   target below, in order: (1) an empty container item on the depot/belt cell below: progress cell.fill += litres; when fill >= capacity
      swap to the full container via CHEM_CONTAINERS.filledWith(empty, fluid) (beaker 250, canister/bucket 1000), pass it on along the belt
   (2) a `basin` below: litres go straight in (the basin holds 1000 L), no container
   fluid shown: a falling 0.12-wide bar in the fluid's colour (workshopRenderer `bars`), alpha scroll, + soft `pour` loop
Drain (item_drain): a pipe touching its side or top: while a full container sits on it, empties at DRAIN_LPS = 250 into the pipe
   (pushes into the net as the FluidEndpoint inlet), empty container passes on. Spout and drain never hold litres: partial `fill`
   is saved on the spout cell (saved JSON) so a reload does not lose or invent litres.
```
Conservation: `litres_removed_from_net == litres_in_containers + basin gains + cell.fill`. Needs tank/pipe acceptance of the new fluids (B.8)
and `FluidEndpoint` lookup through `Workshop.fluidBlock` (extend with `pull(x,y,z,face,fluid?,max): {fluid,L}|null` and
`push(x,y,z,face,fluid,L): number`). The bottling line: receiver -> chem_port -> pipe -> spout -> beaker on a belt -> crate.
**Acceptance.** Unit: a 4000 L tank, 4 canisters on a belt under a spout fill in 16 s +/- 1; basin below fills; litres
conserved to 1e-6; unpowered spout does nothing; save mid-fill. E2E: golden bottling line (shared with B.8).

## C.5 Punched gearshift cards

**Player sees.** A stiff paper card with 8 holes in a row. The **card punch** bench (a small block) opens a thin sheet with an
8-cell strip: tap a cell to cycle `still / forward / reverse` (3 states; hold = skip); a speed notch row of 4 (x0.5, 1, 2, 3) is
under it; the Punch button writes the pattern onto the card (cost: the card). Use a card on a `sequence_gearshift` loads it (the
gearshift shows 8 coloured pips on its front, running one lit at a time as it plays); Use with an empty hand ejects it. The
three presets stay as defaults when there is no card.

```
Card pattern (24 bits ... 8 steps x { state: 2 bits (0 stop, 1 fwd, 2 rev), notch: 2 bits }) = 32-bit int, stored in
   ItemStack.tag (recommended) or, until then, encoded in `durability` = 1 + pattern (never shows wear: item flag noWear).
Playback: step = 1.0 s (or 0.5 s with a metronome signal touching); factor = state fwd: +notch, rev: -notch, stop: 0
   cardFactor(t, pattern) = table lookup, loops; `GEARSHIFT_PROGRAMS` gets a 4th element type 'card' with the pattern on Part
Part.s holds program; Part.card?: number (saved in the workshop snapshot)
```
Files: `workshop/kinetics.ts` (`cardFactor`), `workshop/workshop.ts` (use: card/empty-hand eject, `Part.card` in snapshot),
`content/itemsWorkshop.ts` (`punch_card` blank, `card_punch` bench), `ui/screens/workshop/cardPunch.ts` (new thin sheet),
`render/workshop/workshopRenderer.ts` (pips), recipe at the workbench with a punch tool (iron nail). **Acceptance.** Unit: pattern
round-trips pack/unpack; a card `[F,F,S,R,R,S,F,S]` yields factors at the right seconds; goggles "Card: fwd, fwd, stop, ..." under
70 chars (abbreviate to arrows: `>> . << << . > .`); save/load keeps `Part.card`. E2E: punch, load, watch the loop.

## C.6 Item vault growth

**Today** one block holds 108 stacks (Use empty hand gives the biggest stack). **Rule.** Face-adjacent `item_vault` blocks that form a
**solid cuboid up to 3 x 3 x 3** share one inventory: capacity `108 + 54 x (n - 1)` stacks (max 1512). Anything else (ragged shape)
reports "The vault must be a solid block (up to 3x3x3)" and each cell works alone. Controller = the minimum (x,y,z) cell, which
owns the stacks; belts, funnels and arms may attach to any cell (the `logi.accept/take` lookup maps a vault cell to its controller).
**Break**: if the rest is still a cuboid it re-forms; stacks beyond the new capacity drop as ground items at the broken cell.
**Sound/animation**: the lid hinge opens (one bar) when something enters; the front face shows fill as 5 pips.
**Save** controller key re-keyed on place/break (like relocate). **Acceptance.** Unit: 2x1x1 vault has 162 stacks; shape rule;
break spills only the excess; a contraption (never carries a vault: vault is not in `movable`) refuses to pick it up (assert).

## C.7 Trinkets (all blocks except spyglass and horn item; all `decor` for the congruence test)

| trinket | form | behaviour (numbers) | status sentence | signal |
|---|---|---|---|---|
| wind vane | block | rotates to the wind direction from `windAt`/`weather.ts` (tween 1 s), fast flutter in storms | "Wind from the north-west, gentle" | lights an adjacent signal cell when wind speed >= storm level |
| weather cock | block | turns to the wind; crows once (sfx `rooster`, synthesized) at dawn | "Fair weather" / "Rain on the way" (from `weather.ts` next `kind`) | lit while raining and sky open (`openSkyAbove`) |
| spyglass | held item | Use toggles zoom: FOV x0.33; phone: second tap exits, drag looks; cannot sprint | - | - |
| brass horn | block + item | item Use: calls every tame mob within 24 blocks (they drop jobs, follow 30 s) + `horn` sfx (synthesized, 2 notes); block version pulses a signal 1 s | "Horn - tap to call" | pulse |
| padlock chest | block | a crate that refuses taking by belt/arm/funnel unless a `brass_key` item is held (Use with key opens the UI-less take of the biggest stack); inputs allowed | "Chest - locked (2 stacks)" | - |
| lantern chain | block | hangs from any solid above up to 8 blocks, light 12, sways with wind (render sin on one bar), breaks into the lantern item | "Lantern - swinging" | - |

Each is one entry in `src/workshop/trinkets.ts` (`TRINKETS` table: key, tick(dt, ctx), describe(), save) with `Workshop` calling
`trinkets.tick` once; renders through `workshopRenderer.bars` (no new draw call). Aspects: each needs a fingerprint beyond
`CATEGORY_BASE` (lane D's test): propose wind vane `gale`, weather cock `gale+brook`, spyglass `glow`, horn `drive`, chest
`loam`, lantern `glow`. **Acceptance.** Unit per trinket (vane yaw follows a fake wind, cock signal in rain, horn calls fake
mobs, chest refuses an arm without key).

## C.8 Belts that cross structure borders

**Actual bug to fix first.** `Contraptions.structure()` floods through *every* movable block including belts, so a fixed belt next
to a carried one is swallowed and dragged. Fix:

```
structure(start): propagate ONLY through contraption_frame, and from a frame/actuator to every neighbouring movable part
   (a part is carried only if it touches a frame or an actuator face directly; parts do not spread to other parts)
Pin: Wrench on any part toggles `pinned` (saved, goggles "pinned"): a pinned part is never carried and ends propagation
```
Then **hand-over across a border** (belts, funnels, arms) works under one rule: items pass between a belt on a structure and a
fixed belt/depot/crate only while that structure is idle (not pending) AND the two cells are face-aligned (the existing
end-to-start check, run against the logical cell). Skiff docks: the 2 s dwell at the rail end is the unloading window. **Belts into
crates** already works (`acceptCrate`); add the lid-open bar. **Acceptance.** Unit: a fixed belt beside a framed belt is NOT in
`structure()`; hand-over works idle, blocked while pending; skiff dwelling aligned with a belt unloads. E2E: field -> belt -> mill ->
chute -> crate loop (already planned), plus piston docking.

## C.9 Workshop hooks the distillery needs (the interlock seams)

All in `src/workshop/`, owner C, written as stubs in the contract commit (section E.0):

| hook | signature | used by |
|---|---|---|
| `registerLoad(key, su, when: () => boolean)` | adds a consumer to the network of the part that touches `key`; on over-capacity the usual jam | vacuum cap (3 su), stirrer (2 su), pump |
| `rpmAt(x,y,z): number` | max abs rpm of kinetic parts touching the cell (exists internally as `signedRpm`) | vacuum cap, stirred vessel |
| `itemSinks` | see B.10 | arms, belts, hoppers |
| `fluidBlock.pull/push` | see C.4 | spouts, drains |
| basin recipes with fluid inputs | `BasinRecipe.fluid?: { key; L }` (inputs list) | tarred planks, antiseptic bandage, fertiliser |
| lube table | `LUBE: Record<item,{factor,s}>` | lubricant, grease |

---

# D. HOW THE TWO LANES INTERLOCK (data flow, numbers, owners)

| link | flow | contract | test |
|---|---|---|---|
| lubricant -> stress | `lubricant_beaker` Use -> `LUBE` -> `capacityFactor` x1.25 / 10 min; grease x1.5 / 40 min | B ships items, C owns `LUBE` (table keyed by item, B appends rows) | `solveNetwork` capacity 1.25x; golden e2e |
| residue -> lubricant + bitumen | vacuum cap powered by shaft: `rpmAt >= 16` -> `capability vacuum` | C `rpmAt` + `registerLoad`; B scan reads `host.shaftRpm` | unit with a fake workshop host |
| fuels -> engines | `FUEL_GRADES` table: gasoline saw 1.3 / tractor 1.2; diesel tractor 1.5; ethanol 0.25/0.2; **add `engine` column** for the combustion generator (tech spine owns it) and `burner` column (B.1) | single table in `core/distill.ts`; consumers read it | existing `distillFuel.test.ts` + new columns |
| fuels -> chainsaw/tractor PTO | tractor drains the same canister while turning a shaft (24 rpm / 30 su, workshop PTO) | C's PTO reads `FUEL_GRADES[...].tractor` burn rate | PTO drains 1.2x slower on gasoline |
| spouts/drains <-> basins/stills | pipes -> spout -> container/basin; drain -> pipe -> tank -> `chem_port` -> flask | C.4 + B.8 | litre ledger across the whole line |
| arms feeding stills | `mech_arm` target = vessel/filter/catalyst/hopper via `itemSinks` | B.10 | arm loads yeast into a vessel, a hopper outputs asphalt |
| belts through the refinery | belts deliver catalyst and filter media to `tower_hatch`, spent media and asphalt leave on belts, canisters ride belts under spouts | `itemSinks` + spout fill | e2e golden "plant" |
| treadwheel animals <-> farming/food | goat eats wheat from a depot, hound meat; tired -> sits | C.3 `Workshop.take` | unit |
| contraptions <-> chem | chem modules are entities with liquid, so **never movable**; a piston never pushes one; `movable()` returns false for all `CHEM_KINDS` and `tower_*` | assert in `contraption.test.ts` | unit |
| skiff carrying liquids | a skiff carries one stack: canisters/beakers ride it to the vault; never a flask | stack rule | unit |
| bitumen -> roads -> tractor | `asphalt_block` surface 1.4 vehicle | `BlockDef.surface` | B.5 |
| vacuum + stirrer on the same shaft | both `registerLoad`: over capacity jams as usual; goggles shows "load 14.5/24 su" | C solver | unit |

Seam ownership: **types and tables are B's, hooks are C's, the glue lines in `app/game.ts` are made once in the contract commit.**

---

# E. BUILDER ORDERING - 2 builders per lane, conflict-free

## E.0 Contract commit (before any builder; by the lane architects, one commit each; run `tsc` + the transport tests)

- **B-0** (shared, append-only): `FluidKey` += `lubricant`, `bitumen` and one
  `elixir_<buff>` per buff (6); `fuel` alias in the sanitizer); `ItemStack.tag?: number` (+ save sanitizer, merge compare); `BlockDef.surface?`; empty
  stubs `core/rigString.ts`, `sim/distillPlan.ts`, `sim/distillBurner.ts` exporting typed signatures. **No logic.**
- **C-0**: `workshopHooks.ts` interface file (`registerLoad`, `rpmAt`, `itemSinks`, `walkers`, `fluidBlock.pull/push`) wired in
  `Game` with no-op defaults; `LUBE` converted to an item-keyed table (behaviour identical); `contraption.ts` split into
  `contraption.ts` (rules) and `contraptionMove.ts` (the new two-phase mover; initially calls the old instant commit).

## E.1 Lane B

| builder | owns (exclusive) | sequence |
|---|---|---|
| **B1 chemistry** | `core/chem.ts`, `core/distill.ts`, `sim/distill.ts`, `sim/distillScan.ts`, `content/{blocksDistill,machinesDistill,fluidsDistill}.ts`, `sim/distill*.test.ts` | W1 reflux head (B.2) -> W2 filter bed + lubricant component (B.3) -> W3 vacuum cap + residue run + bitumen grade (B.4/B.5) -> W4 asphalt/grease reactions, `HEAT_SENSITIVE`, essence (B.6) -> W5 catalyst/pressure/steel shell (B.9) -> W6 tower scan/step (B.11) |
| **B2 player and content** | `sim/distillPlan.ts`, `sim/distillBurner.ts`, `sim/distillActions.ts`, `core/rigString.ts`, `content/{itemsDistill,recipesDistill}.ts` (+ new `itemsPotion.ts`), `render/distill/*`, `ui/screens/distill/*`, `scripts/e2e-distill.mjs`, `docs/api/distillery.md` | W1 ground burner (B.1, 3-line `baseTemp` hook agreed in B-0) -> W2 plan ghosts + problem pulse + goggles sentence (B.7) -> W3 tank/pipe support + bottling e2e (B.8) -> W4 potions, drinks, elixirs, bandage, lamp (B.6) -> W5 rig sheet -> W6 hopper/itemSinks (B.10) -> polish (B.12) |

Conflict rules: only B1 edits `sim/distill.ts` and `distillScan.ts`; B2 gets what it needs through the stub `DistillHost` fields added in
B-0 (`burnerTemp`, `planAt`). If B2 needs a change in `distill.ts` it asks B1 (one line request in the shared notes). B2's W3 waits for B-0
fluid keys; B1's W3 waits for C-0's `rpmAt`.

## E.2 Lane C

| builder | owns (exclusive) | sequence |
|---|---|---|
| **C1 motion** | `workshop/contraption*.ts`, `render/workshop/movingLayer.ts`, `workshop/animals.ts`, `mobs/jobs.ts` (new), `app/game.ts` ride/walkers hook lines, contraption tests | W1 pin rule + `structure()` fix (C.8) -> W2 two-phase mover + tween + save-mid-move (C.1) -> W3 skiff glide, riding, platform carry (C.2) -> W4 treadwheel animals + horn calling (C.3) -> W5 belt docking and crate lid |
| **C2 logistics and things** | `workshop/logistics.ts`, `workshop/signals.ts`, `workshop/trinkets.ts` (new), `content/{itemsWorkshop*,recipesWorkshop,basinWorkshop,objectivesWorkshop}.ts`, `ui/screens/workshop/*`, `render/workshop/workshopRenderer.ts`, `scripts/e2e-workshop.mjs`, `docs/api/workshop.md` | W1 itemSinks + fluid `pull/push` + `basin` fluid recipes (C.9) -> W2 continuous spouts/drains (C.4) -> W3 punched cards + bench (C.5) -> W4 vault growth (C.6) -> W5 trinkets (C.7) |

`workshop/workshop.ts` is the hot file: C1 touches `relocate/verify/solve/tick moving`, C2 touches `use/describe/snapshot`. Rule: C1 lands
W1-W2 first (they only add a `moving` set and the pin flag); C2's `workshop.ts` edits start after C1-W2 merges; both keep edits inside
disjoint method bodies and rebase before commit.

## E.3 Cross-lane order (the four dependencies)

```
B-0, C-0  ->  [B1 W1-W2, B2 W1-W2, C1 W1-W2, C2 W1]  in parallel (no shared files)
          ->  C2 W2 (spouts) needs B2's tank fluids  ->  then B2 W3 bottling e2e
          ->  B1 W3 (vacuum) needs C-0 rpmAt/registerLoad (stub then real by C2 W1)
          ->  B1 W4 potions/essence, B2 W4 elixirs; C2 W3-W5, C1 W3-W5 in parallel
          ->  B1 W5-W6 (Current/Atomic) last, after the six-age refactor tiers are final
```
"Whoever writes the code does not certify it": each builder's wave is certified by the *other* lane's builder re-running
`tsc`, `vitest` and the lane e2e; the architect signs only after reading the diff.

---

# F. TEST AND E2E CHECKLIST (what "done" means per item)

| item | unit (file) | e2e step |
|---|---|---|
| ground burner | `distillBurner.test.ts` | place base on grass, charcoal, flame count > 0, spirit run completes (desktop + phone) |
| reflux head | `distill.test.ts` | card `reflux_ethanol` yields `fuel_ethanol` |
| filter bed | `distillFilter.test.ts` (conservation incl. absorbed) | wash -> filter -> cleaner spirit |
| lubricant | `distillProcess.test.ts` + `workshop.test.ts` (x1.25) | crude -> vacuum -> filter -> beaker -> oil shaft, goggles "oiled" |
| asphalt/roads | `asphalt.test.ts` (tractor/walk multipliers) | drive tractor on asphalt vs dirt, screenshot |
| potions | every elixir card built and run | vial drunk, HUD chip |
| rig plan/ghosts | `distillPlan.test.ts` | ghost screenshot, then the rig runs |
| tower | `distillTower.test.ts` | pipe-fed run, three cuts into three tanks |
| tween | `contraptionTween.test.ts` (fake clock) | mid-move screenshot offset block |
| riding | `ride.test.ts` | ride skiff, pill visible on phone |
| treadwheel animals | `animals.test.ts` | goat on wheel, shaft turns |
| continuous spout | `spoutFlow.test.ts` (litre ledger) | bottling line |
| punched cards | `card.test.ts` | punch + load + playback |
| vault growth | `vault.test.ts` | 2x2 vault, belt into any cell |
| trinkets | `trinkets.test.ts` | vane turns with wind |
| belt borders | `contraption.test.ts` pin cases | field -> belt -> mill -> chute -> crate |

Fixtures to add: an **old-save fixture** with a mid-move piston and with a belt next to a frame, and one with a flask holding
`residue` (so the new components load).

# G. RISKS WORTH A BUILDER'S ATTENTION

1. **Two-phase move vs `verify()`.** Forgetting the `moving` exemption silently deletes machines mid-move (the one data-loss path). Test first.
2. **Reserved cells.** World edits (player, chunk gen, other machines, the tractor) can all write a reserved cell; the guard must live in
   the shared "place" check and in `hold()` writers, not just the player.
3. **`structure()` pin rule** changes existing contraptions that relied on belts spreading. Old saves keep structure shapes; migrate by
   treating every pre-existing structure as "all parts glued" once (`Part.glued` default true, new parts default false).
4. **Vacuum cap loops back to the shaft solver**: a vessel's `registerLoad` makes the network over-capacity and jams a mill. Show it in
   the goggles ("load 14.5/24 su") and keep 3 su small.
5. **Conservation with the filter** (absorbed litres) must be added to the fuzz ledger the same commit as the filter, or the fuzz fails
   for unrelated reasons.
6. **`ItemStack.tag`** touches inventory merge: stacks with different tags must not merge (cards, sips). One test.
7. **Heat-sensitive essences** are the first place the still can *ruin* a batch: the toast and the red lamp must say why.
8. **Phone**: every new interaction here is one Use tap; the only added control is the "Hop off" pill. No drag-and-drop anywhere.

# H. WHAT I DID NOT DECIDE (needs the owner, defaults given)

1. Tower age: Atomic (recommended) vs Forge (CONGRUENCE).
2. Lubricant item: `lubricant_beaker` (250 L, glass back, recommended) vs a reusable oil can.
3. Nightsight buff for Glowcap Draught: a seventh `DrinkBuff` (recommended small) vs reusing `lightActive`.
4. Alcohol cost: aim sway and Dizzy (recommended) vs only a timer.
5. `ItemStack.tag` (recommended) vs encoding in `durability`.

# I. CHECK LIST FOR THE ARCHITECTS

Contract commits (E.0) before builders; the age table moves with the six-age refactor (one table per lane); the four
shared-file edits are `FluidKey`, `ItemStack.tag`, `BlockDef.surface`, and the `brain.ts` job line (stream F). Everything else is in
files one builder owns.
