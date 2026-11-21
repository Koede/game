# Distillery plan - modular glass chemistry (design, crafting tree, pseudocode, work list)

Status: **plan only, no code yet** (written 2026-11-21). Owner's brief: a modular multiblock of interchangeable glass
chemistry blocks that runs liquid crafting jobs, with liquids visibly dripping, boiling and changing colour, and a
deep product tree: potions, alcohols, syrups, lubricants, and crude oil refined to gasoline, kerosene, diesel,
bitumen and asphalt. Blocks and textures must change in the world when a step completes.

Names marked (verify) were not checked against the code and must be confirmed before use.

## 0. The five ideas that make this tractable

1. **Mixtures, not recipes, for separation.** Every liquid inside a rig is a vector of components
   (`{ ethanol: 120, water: 850, fusel: 30 }` litres). Each component has a boiling point. Distilling is then one
   piece of physics for everything: wash to spirit, sap to syrup, crude to fractions, residue to lubricant are the
   same 40 lines of code with different inputs. Conservation of volume is true by construction (section 5).
2. **Geometry is the wiring.** Vapour goes up, liquid goes down or sideways, never up. The player never configures
   a port: where a block sits says what it does. This removes the N x N interaction table (section 3).
3. **Capabilities, not layouts.** Modules contribute capabilities to the vessel they touch (heated, sealed,
   cooled, stirred, vacuum, catalyst). A reaction asks for capabilities and a temperature window; it never names a
   layout. 12 block kinds give dozens of distinct rigs with no per-rig code (section 4).
4. **Round-down naming at the boundary.** Pipes, tanks and containers carry one named fluid. A mixture leaving a rig
   is named by its largest component and its purity grade, rounded down; a named fluid entering a rig expands to
   that grade's minimum composition. Volume is exact, purity can only be lost at a boundary, never invented. This
   is what makes re-input chains (distil twice) meaningful and safe (section 5.4).
5. **Executable process cards.** Each Codex process carries a rig blueprint string. The same string draws the Codex
   diagram, feeds the ghost preview, is built and run by a unit test, and gives the progression solver its cost.
   The documentation cannot drift from the simulation (section 7).

## 1. Scanner choice: a module graph, reusing the hearth plumbing

The hearth scan (`src/sim/hearthScan.ts`) validates a hollow cuboid. A still is a free-form tree of touching
blocks, so it gets its own **flood-fill module graph** (`src/sim/distillScan.ts`). Reused as is, not copied:

| reused | from | for |
|---|---|---|
| problem shape `{ code, text, cells }`, cap of 8, tap-to-pulse highlight | `hearthScan.ts`, `HEARTH_MAX_PROBLEMS`, `HEARTH_HIGHLIGHT_S` | STRUCTURE tab of the rig |
| when to rescan (dirty on `block:changed` in range, 1 s while near or screen open) | `hearth.ts`, `HEARTH_RESCAN_S/RANGE` | `DistillSet` |
| `structureView` + ghost preview pipeline | `hearthView.ts`, `src/render/tech/ghosts.ts` | blueprint ghosts |
| proxy map "this block stands for that controller" | `shellOwner` in `hearth.ts` | chem ports reaching module buffers |
| `FluidEndpoint` / `ItemEndpoint` | `src/sim/endpoints.ts` | chem ports on pipes |
| heat draw via `furnace.extractW`, `furnaceBelow` | `brewing.ts` `BrewHost` | the still base on a furnace top |
| entities as plain JSON, never machine nodes | `brewing.ts` | every chem module |
| instanced boxes | `src/render/tech/boxBatch.ts` | glassware and liquids |

## 2. Blocks (all in `src/content/blocksDistill.ts`, appended last so voxel ids never move)

Look: each module is a translucent cube, a brass-framed glass case (existing translucent batch, no mesher change).
The glassware inside, the liquid, bubbles and drips are drawn by `src/render/distill/` (section 8).

| key | role | buffer | notes |
|---|---|---|---|
| `still_base` | heat adapter | - | on a furnace top (`FURNACE_TOPS`) it takes the furnace temperature; on the ground it burns a fuel item itself (charcoal 250 C, ethanol beaker 300 C) |
| `boiling_flask` | boiler vessel | 4000 L | must stand on a `still_base`. Borosilicate limit 450 C |
| `reaction_vessel` | reactor | 4000 L + 4 item slots | reactions happen here; heated only if on a `still_base` |
| `column_segment` | vapour riser | 200 L holdup | stacks on a flask, up to 8. Each is one theoretical plate |
| `reflux_head` | top of a column | - | wrench cycles return 0 / 50 / 75 %: more purity, less flow |
| `condenser_coil` | vapour to liquid | 100 L | beside a column segment = side draw (a cut); on top of the stack = head |
| `cooling_jacket` | modifier | 1000 L water | touching a condenser: head 30 C instead of 60 C, x3 rate. Touching a vessel: capability `cooled` |
| `receiver` | collection vessel | 2000 L | where liquid ends up; beakers, canisters and ports take from it |
| `glass_tube` | liquid line | 50 L | carries liquid sideways and down, never up; shows the stream's colour |
| `filter_bed` | inline filter | 500 L + 1 slot | liquid in from above, out below; uses up a medium (charcoal, sand, clay) |
| `catalyst_bed` | modifier in the vapour path | 1 slot | sits in the column stack like a segment; holds a catalyst with durability |
| `airlock_cap` | cap | - | on a vessel: capability `sealed` (fermenting) |
| `vacuum_cap` | cap | - | on a stack or vessel: pressure 0.1 bar, boiling points x0.7. Needs power or shaft rpm |
| `pressure_cap` | cap | - | pressure 5 bar, boiling points x1.3, capability `pressure` |
| `chem_port` | fluid endpoint | proxy | touching a flask or vessel it is an inlet, touching a receiver an outlet. One block, direction from position |
| `chem_hopper` | item endpoint | proxy | item pipes into a vessel's or bed's slots |

### 2.1 Step-completion states in the world (owner's requirement)

Every module shows its state on the block itself, readable from across the room with no screen open. The voxel has
one free state bit (ACTIVE), so each stateful module is **two block variants x the active bit = four states**,
exactly the cup-stage pattern of brewing (`CUP_BLOCK`, block swaps done by the sim):

| state | block | active bit | frame lamp on the tile | glass |
|---|---|---|---|---|
| idle / empty | `X` | 0 | dark | clear |
| working | `X` | 1 | amber, flickers (`_on` twin) | fogged at the top, lit by `lightActive` |
| step complete | `X_done` | 0 | green | clear, liquid settled |
| blocked | `X_done` | 1 | red | - |

- Stateful modules: `boiling_flask`, `reaction_vessel`, `receiver`, `filter_bed`, `catalyst_bed`, `still_base`
  (base: cold / firing only). The `_done` variants are `item: false` and drop the plain block.
- What "complete" means per module: flask - the charge is spent (nothing left that boils at this temperature);
  vessel - the reaction ran to its end; receiver - full, or its source finished; filter and catalyst beds -
  medium spent (shown red: blocked, needs a new one).
- **Extra visible changes that cost no textures**: the fermenter's liquid goes cloudy then clears; a spent filter
  medium is drawn dark; a column draws one colour band per cut actually flowing; a `still_base` with the whole rig
  finished gets a small green flag drawn by the renderer; each change of state emits `distill:step`
  `{ x, y, z, state, process? }` with a `sfx` (glass chime on complete, dull clunk on blocked) and one toast per
  finished run ("Spirit run finished - 1.4 buckets in the receiver").
- Texture budget: 2 shared frame tiles (`chem_case`, `chem_case_top`) x 4 lamp states = 8 tiles, plus one emblem
  tile per module kind composited into the frame at paint time (16 kinds x at most 4 states, painted from one
  function, so no hand-drawn duplicates). The atlas already splits past 256 layers; raise the content-test cap.
- Objectives hook on `distill:step` with `state: 'done'` and the process key ("Run your first spirit").

## 3. How blocks connect: the adjacency rules (the whole interaction table)

Each kind declares what it does through each face class. `U` up, `D` down, `H` any horizontal face.

| kind | vapour in | vapour out | liquid in | liquid out | attaches as modifier to |
|---|---|---|---|---|---|
| still_base | - | - | - | - | vessel on its U (gives heat) |
| boiling_flask | - | U | U, H (ports, tubes) | D-side drain cock (H tube at the base) | - |
| reaction_vessel | - | U (only if heated) | U, H | H, D | - |
| column_segment | D | U, H (to a condenser) | U (reflux falling back) | D | - |
| catalyst_bed | D | U | - | - | the stack it is in |
| reflux_head | D | U, H | - | D | the stack below |
| condenser_coil | D or H | - | - | D, H | - |
| receiver | - | - | U, H | H, D | - |
| glass_tube | - | - | U, H | H, D | - |
| filter_bed | - | - | U | D | - |
| caps | - | - | - | - | the block on their D |
| cooling_jacket | - | - | - | - | every condenser or vessel on its H, U, D |
| chem_port / chem_hopper | - | - | - | - | the first vessel-like block they touch |

Edges are derived, never stored:

```
vapourEdge(a -> b)  iff  a.vapourOut has the face towards b  and  b.vapourIn has the face towards a
liquidEdge(a -> b)  iff  a.liquidOut has the face towards b  and  b.liquidIn has the face towards a
                         and b is not above a
```

Because liquid never goes up, **the liquid graph has no cycles inside one rig except through a vapour edge**
(boil up, drip back: that is reflux, and it is legal). Lifting liquid needs a `chem_port`, a normal fluid pipe and
a pump, so every long re-input loop passes through the named-fluid boundary of idea 4. A cascade down a hillside
needs no pump at all: receiver, tube, next flask one block lower.

Tie-breaks that keep it deterministic: several liquid targets split evenly (fixed order: D first, then N, E, S, W);
a condenser touching two columns serves the lower-indexed one and reports a problem.

## 4. Capabilities and the rigs they make

```
caps(vessel) = { heated      if on a still_base that is firing
                 sealed      if airlock_cap on top
                 vacuum      if vacuum_cap on top of it or of its stack (and powered)
                 pressure    if pressure_cap likewise
                 cooled      if a cooling_jacket with water touches it
                 stirred     if a mech shaft >= 16 rpm touches it (STEAM_PLAN mech graph; later)
                 catalyst:k  if a catalyst_bed holding k is in its stack
                 plates:n    column segments above it x reflux factor }
```

| rig (smallest form) | blocks | capabilities | what it does |
|---|---|---|---|
| Pot still | base, flask, condenser on top, receiver beside | heated | one-pass distilling, evaporating |
| Fractionating column | base, flask, n segments, side condensers, head condenser, receivers | heated, plates:n | n+1 cuts in one pass |
| Reflux still | pot still + segments + reflux_head | heated, plates x(1+2r) | high purity (fuel ethanol) |
| Fermenter | vessel + airlock_cap | sealed | wash, wine, must (no heat) |
| Heated reactor | base, vessel | heated | infusions, asphalt mix, soap, blending |
| Crystalliser | vessel + cooling_jacket | cooled | syrup to sugar + molasses |
| Vacuum still | any still + vacuum_cap | heated, vacuum | gentle concentration (potions), residue to lube base |
| Cracker | column with catalyst_bed + pressure_cap | heated, pressure, catalyst | heavy oil to gasoline |
| Polishing line | receiver, filter_bed, receiver | - | lube base to lubricant, cloudy to clear |

Everything composes: a fermenter draining through a filter into a flask with a 3-segment column is one rig that
turns berries into brandy unattended. No code knows that rig exists.

## 5. The mixture model (`src/core/chem.ts`, pure, DOM-free)

### 5.1 Components

| component | bp C | colour | viscosity | notes |
|---|---|---|---|---|
| methanol ("heads") | 65 | 0xdfe8ee | 0.6 | comes first; makes Rough Spirit if kept |
| ethanol | 78 | 0xf1efe2 | 1.0 | |
| gasoline | 90 | 0xf2d24a | 0.5 | |
| water | 100 | 0x3a86b4 | 1.0 | |
| fusel ("tails") | 130 | 0xb9a36a | 2.0 | |
| turpentine | 160 | 0xcfe0a6 | 1.2 | from pine sap |
| kerosene | 190 | 0x9fc4e8 | 1.5 | |
| diesel | 280 | 0xc98f2e | 3.0 | |
| lube_base | 370 | 0x7a5a1e | 12 | |
| bitumen | 520 | 0x15120f | 200 | never boils in glass |
| sugars, rosin, essence_*, solids | none | per key | 30 | non-volatile: stay in the flask |

Feed compositions (`FluidSpec.mix`, fractions sum to 1, checked by validation):

```
crude_oil   gasoline .22  kerosene .13  diesel .30  lube_base .12  bitumen .23
pine_sap    water .60  sugars .20  turpentine .10  rosin .10
sugar_wash  water .84  ethanol .12  methanol .01  fusel .03
grain_wash  water .86  ethanol .10  methanol .01  fusel .03
berry_must  water .85  ethanol .11  methanol .01  fusel .02  essence_berry .01
residue     lube_base .34  bitumen .66            (what an atmospheric crude run leaves)
```

### 5.2 One step of a still (runs at 4 Hz, not every tick)

```
stepStill(rig, flask, dt):
  T  = flask.tempC                      # first-order lag towards the base's temperature
  pf = vacuum ? 0.7 : pressure ? 1.3 : 1
  n  = 1 + rig.plates * (1 + 2 * rig.refluxRatio)        # enrichment exponent
  for each component i in flask.mix:
      bp   = bpOf(i) * pf
      gate = clamp((T - bp + 40) / 40, 0, 1)             # starts 40 C under its boiling point
      w[i] = flask.mix[i] * gate * 2 ** ((100 - bp) / 10 * n)      # relative volatility ^ n
  if sum(w) == 0: flask.state = DONE; return             # spent charge -> block swaps to flask_done
  V = min(heatW / LATENT_J_PER_L,                        # heat limited
          sum(condenser rates) * (1 - rig.refluxRatio),  # condenser limited
          flask.litres / dt)
  for each component i:
      dL   = min(flask.mix[i], V * dt * w[i] / sum(w))
      draw = drawFor(rig, bp_i, T)                       # section 5.3
      took = draw.receiverChain.accept(i, dL)            # may be less: receiver full
      flask.mix[i] -= took                               # ONLY ever moves what was accepted
  furnace.extractW += V * LATENT_J_PER_L + lossW
```

The single `took` line is the conservation proof: litres leave the flask only as litres entering exactly one
buffer. Unit test: total litres over all modules is constant to 1e-6 across 10 000 steps of random rigs.

Tuning check done by hand: `sugar_wash` in a pot still (n = 1) gives 38 % ethanol (Low Wines); that run again gives
74 % (Spirit); three plates in one pass give 93 % (Fuel Ethanol). Plates and second passes are both real choices.

### 5.3 Where each component leaves a column

```
trayT(h) = T_flask - (T_flask - T_head) * h / H        # H = stack height, T_head 60 C (air) or 30 C (jacket)
drawFor(rig, bp, T):
  for draw in rig.sideDraws ordered bottom to top:     # a condenser beside segment h
      if bp >= trayT(draw.h): return draw              # it condenses here: this is its cut
  return rig.head                                      # light ends reach the top
  # bp > T + 40 never left the flask: it is the residue, drained from the flask's cock
smear: a share 1 / (2 + segments between this draw and the next) of each cut goes to the neighbouring draw
```

Worked example the slice must reproduce: crude at 350 C, 3 segments, 2 side draws, jacketed head:
trays at 243 / 137 / 30 C. Diesel (280) condenses at draw 1, kerosene (190) at draw 2, gasoline (90) at the head,
and `residue` (lube base + bitumen) stays. A 2-segment column merges diesel and kerosene into one worse cut: the
player sees why height matters. Stack height = number of cuts.

### 5.4 The boundary: naming a mixture and expanding a name

```
nameOf(mix):                                   # leaving a rig: receiver -> beaker, port, pipe
  major = component with the largest share s
  return highest grade g of major with g.minPurity <= s, else 'slop'
expand(fluid, L):                              # entering a rig
  g = gradeOf(fluid);  return { g.major: L * g.minPurity, ...g.rest scaled to L * (1 - g.minPurity) }
```

Grades: ethanol - `low_wines` 0.30, `spirit` 0.65, `fuel_ethanol` 0.90. Diesel - `diesel` 0.80. Gasoline -
`gasoline` 0.80. Kerosene - `kerosene` 0.75. Lube - `lube_base` 0.70. Sugars - `syrup` 0.55. Anything else is
`slop`, which can be poured back into a flask (it expands to a stored fixed mix: cheap, lossy, never a dead end).
Because expansion uses the minimum purity, storing a liquid can only lose quality: no exploit by round-tripping.

## 6. Reactions (`src/content/recipesDistill.ts`: `REACTION_SPECS`)

```ts
interface ReactionSpec {
  key: string; name: string;
  in: Partial<Record<Component, number>>;      // parts by volume
  items?: ItemAmount[];                        // consumed from the vessel's slots per batchL
  out: Partial<Record<Component, number>>;     // parts; sum(out) == sum(in) unless `gasLoss` is declared
  gives?: ItemAmount[];                        // solids handed out when done (sugar, rosin, asphalt)
  needs: Capability[];                         // sealed, heated, cooled, vacuum, pressure, stirred, catalyst:k
  tempC: [number, number];                     // window; outside it the reaction pauses, above `ruinC` it spoils
  ruinC?: number;  batchL: number;  seconds: number;  age: AgeKey;
}
stepVessel(v, dt):
  r = first reaction whose inputs, items, caps and window all hold      # fixed order, so deterministic
  if !r: v.state = (v.lastDone ? DONE : IDLE); return
  frac = min(dt / r.seconds, limiting reagent share)
  move frac * batchL from the `in` components to the `out` components     # same litres out as in
  when a whole batch completes: consume items, push `gives`, emit distill:step done, swap block to vessel_done
```

## 7. Process cards (`PROCESS_SPECS`) - Codex, ghosts, tests and solver from one string

```ts
{ key: 'spirit', name: 'Spirit', age: 'ember', feeds: [{ fluid: 'sugar_wash', L: 4000 }], heatC: 92,
  expect: [{ fluid: 'low_wines', minL: 900 }],
  rig: ['C R',      // layer y+2: Condenser, Receiver     legend: B base, F flask, V vessel, | segment, C condenser,
        'F .',      // layer y+1: Flask                            R receiver, T tube, X filter, K catalyst, A airlock,
        'B .'] }    // layer y  : Base                             U vacuum cap, P pressure cap, J jacket, i port
```

- **Codex**: draws the rig from the string and lists feeds, temperature and outputs.
- **Ghost preview**: choosing a card in the still's STRUCTURE tab shows the missing blocks as ghosts.
- **Test**: `distillProcess.test.ts` builds every card's rig in a fake world, pours the feeds, runs the sim and
  asserts `expect`. A card that lies fails the build.
- **Solver**: a card is a pseudo-recipe (inputs = feeds, outputs = expect, station = the rig's blocks, minTempC).

Structure tab extra: "This rig can: distil, 2 cuts, ferment" and "One more Column Segment would add: Kerosene" -
computed by re-running the capability match with one block added, over the 16 kinds (16 cheap scans, on demand).

## 8. The crafting tree

```
SUGAR AND RESIN (Ember)
 pine log --tap--> pine_sap --pot still 115 C--> water (vented) + SYRUP (residue grade)
 syrup --crystalliser (vessel + jacket)--> sugar x3 + molasses
 pine_sap --pot still 175 C--> TURPENTINE (head) + rosin (solid residue)
 existing furnace recipes for resin and sugar stay as the slow hand route

ALCOHOL (Ember -> Forge)
 syrup or molasses + water + yeast --fermenter 120 s--> sugar_wash     (yeast: first from berries, then skimmed
 flour + boiling water --heated vessel 65 C--> mash --fermenter--> grain_wash      back from every ferment)
 berries + water --fermenter--> berry_must (drinkable as Wine)
 wash --pot still 92 C--> LOW WINES --again--> SPIRIT        or  --3-plate column--> FUEL ETHANOL in one pass
   keep the first 5 % (heads): Rough Spirit (drink: Tipsy but Blurred).  Discard heads: clean Spirit
 spirit + barrel + time --> Aged Spirit (later; better buff)
 uses: drink (Warmed: cold resistance, ties to cold.ts and well_warmed; Tipsy: +10 % melee, slight sway),
       burner fuel for a still_base off the furnace, antiseptic (fuel_ethanol + cloth -> bandage: heal over time),
       solvent for every tincture, engine fuel (weak), lamp fuel

POTIONS (Ember base, Forge for the strong ones) - concentrates of the brewing buffs
 brewed drink x4 (tea, coffee: docs/api/brewing-buffs.md) --vacuum still 60 C, ruin above 80 C--> essence_*
 herb / glowcap / berries + spirit --heated vessel 50 C (maceration)--> tincture --filter_bed (charcoal)--> clear tincture
 essence + clear tincture + syrup --vessel (blend)--> ELIXIR, bottled in vials (4 per 1000 L)
   Elixir of the drink = the same buff, 3x the time, +1 strength.  Glowcap Draught = night sight.
   Berry Tonic = regeneration.  Miner's Draught (coffee essence + syrup) = mining speed.  Ember Salts = warmth.
 3 to 5 steps each, each step a different rig: the advanced recipes are longer graphs, as asked

OIL (Forge: needs the pump and a 350 C base)
 crude_oil --3-segment column 350 C--> GASOLINE (head) + KEROSENE (draw 2) + DIESEL (draw 1) + residue (flask)
 residue --vacuum still 330 C--> LUBE BASE (head) + BITUMEN (hot residue; cools to bitumen blocks)
 lube_base --filter_bed (clay)--> LUBRICANT        lubricant + rosin + tallow --heated vessel--> GREASE
 bitumen + gravel + sand --heated vessel 150 C--> ASPHALT x8      bitumen + planks --> tarred planks
 diesel or residue --cracker (catalyst_bed zeolite, pressure_cap, 480 C steel still)--> gasoline + slop (Current age)
 gasoline + diesel 1:1 --vessel (blend)--> fuel (the existing Refined Fuel; the old `still` machine stays as the
   lossy one-box route: 80 % yield, no fractions)
```

### 8.1 What each product is for

| product | use | hook |
|---|---|---|
| gasoline | chainsaw (best: x1.3 per canister), tractor fast | `felling.ts` `SAW_FUEL_ITEM`, `tractor.ts` `FUEL_ITEM` become a `FUEL_GRADES` table lookup |
| diesel | tractor and combustion engine (x1.5 burn time), bore rig | `combustion_engine` `fluids.accepts` |
| kerosene | kerosene lantern (bright, long), heater (cold system) | new lamp block; `cold.ts` |
| fuel_ethanol | weak engine fuel (x0.7), burner, antiseptic | as above |
| lubricant | oiler on a shaft network: stress capacity x1.25, friction halved; chainsaw bar oil: wear halved | STEAM_PLAN mech solve: `capacity *= net.lube`; slice consumer = chainsaw |
| grease | stress capacity x1.5, lasts 4x longer | same hook |
| bitumen / asphalt | road block: walking x1.25, tractor x1.4, never churns to mud; tarred planks do not burn or rot | block field `speedMult` (verify the tractor's surface table) |
| turpentine | thinner (lubricant recipe alternative), varnish, lamp fuel | recipes |
| rosin | flux for solder (circuit recipes), grip, sealing wax for caps | recipes |

`FUEL_GRADES: Record<fluid, { canister: itemKey, energy: number, saw: number, tractor: number, engine: number }>`
lives in `itemsDistill.ts`; consumers read multipliers from it, and the existing `fuel_canister` keeps energy 1.

### 8.2 Containers

`FluidSpec.bucket` gains an optional `litres` (default 1000). Items are **generated from a table**, not hand
written: every drinkable or chemical fluid gets `beaker_<fluid>` (250 L, empty `glass_beaker`), every fuel gets
`<fluid>_canister` (1000 L, empty canister (verify key)), elixirs get `vial_<key>` (250 L). `fluidInBucket` and
`bucketFilledWith` then work for all of them with no new code path.

## 9. Scan and tick pseudocode (`distillScan.ts`, `distill.ts`)

```
scanRig(world, start):                               # start: any chem block; cap 64 modules
  cells = floodFill(start, isChemBlock, 6-neighbour, limit 64)
  for c in cells: m = module(c.kind); derive vapourEdges, liquidEdges (section 3)
  stacks = for each flask or heated vessel: walk U while column_segment | catalyst_bed | reflux_head; note the cap
  for each stack: sideDraws = condensers on H of a segment (with h); head = condenser on U of the top, or H of reflux_head
  receiverChain(condenser) = BFS over liquidEdges until a block with a buffer (tubes pass through)
  attach modifiers (caps, jackets, base) -> caps(vessel)
  problems (first 8):
     NO_BASE "The flask needs a Still Base under it"         NO_HEAT "The base is cold: set it on a furnace or fuel it"
     NO_CONDENSER "Vapour has nowhere to go"                 DRIPS_NOWHERE "This condenser drips onto nothing"
     UPHILL "Liquid cannot climb: lower the receiver"        TOO_TALL "A column holds 8 segments"
     TWO_CAPS  TOO_HOT_FOR_GLASS  SHARED_CONDENSER  TOO_MANY (64)  CAP_UNPOWERED  MEDIUM_SPENT
  return { modules, stacks, problems, capabilities, order: liquid edges in topological order (vapour edges cut) }

DistillSet.tick(dt):
  acc += dt; if acc < 0.25: return                    # 4 Hz
  for rig in awake rigs:
      for v in rig.order:                             # upstream first, so a drop moves at most one module per step
          stepHeat(v); if v is a still: stepStill; if v is a vessel: stepVessel; if v is a filter: stepFilter
          drain(v)                                    # liquid edges: move min(rate, space) to the next buffer
      updateStates(rig)                               # block swaps and active bits of section 2.1, events, sfx
      if nothing moved for 8 steps: rig sleeps until a block change, a pour, or its heat source changes
```

Save and load: each module is its own entity `{ kind: 'chem', mix, tempC, slots, cfg, state }`. The rig is derived
by a rescan on load and never saved (like a hearth's formed state). Breaking a module loses only its own contents
(spilled as `slop` particles; solids drop as items).

Fuzz test (the guard for "many possible combinatorics"): 500 random assemblies of up to 12 random modules in a
3x4x3 box, random feeds and temperatures, 2000 steps each: the scan never throws, every litre is accounted for, no
NaN, no negative amount, state blocks always match state, save then load then step equals step.

## 10. Rendering (`src/render/distill/`), three draw calls

- **Glass and liquid**: one `InstancedMesh` of unit boxes (boxBatch). Per module 3 to 6 boxes: glassware outline
  (translucent), liquid body scaled to the fill level, a darker meniscus slab. Liquid colour = volume-weighted mean
  of its components' colours, so wash visibly pales as the ethanol leaves and crude turns from brown to black.
- **Bubbles, drips, streams**: one more instanced mesh of tiny boxes, **animated entirely in the vertex shader**:
  `y = base + fract(uTime * rate + phase(instanceId)) * travel`. The CPU writes an instance only when a module's
  rate or colour changes (4 Hz at most); between changes the frame cost is zero CPU. Bubble size and drip period
  scale with viscosity (bitumen drips once every 2 s, gasoline runs).
- **Column bands**: each segment's liquid slab takes the colour of the component condensing at its tray
  temperature: gold over blue over amber over black for crude. Bands appear bottom-up as the column warms.
- **Tubes**: a thin core box in the stream colour with the same shader offset scrolling along the tube's axis;
  this is the sight-glass look of `pipeOverlay.ts`, reused for fluid pipes leaving a `chem_port`.
- Data: `sim.distillViews(camX, camZ, range)` fills a reused Float32Array (kind, fill, r, g, b, rate, viscosity,
  state). Range 32 blocks, cap 128 modules, light from `LightProbe`.

## 11. Ages (one table, `DISTILL_AGE` in `itemsDistill.ts`, so the six-age refactor edits one place)

| age key today | furnace | parts unlocked | rigs |
|---|---|---|---|
| ember | T1 clay | beaker, tube, flask, condenser, receiver, vessel, airlock, still_base, filter_bed | pot still, fermenter, tinctures, syrup |
| forge | T2 | column_segment, reflux_head, cooling_jacket, chem_port, chem_hopper | 3-cut crude column, fuel ethanol, lubricant |
| current | T3 | vacuum_cap, pressure_cap, catalyst_bed, steel still shell (900 C) | vacuum residue run, cracker, strong elixirs |
| atomic+ | T4 | refinery tower: a hearth-style cuboid running the same `stepStill` at x16 throughput | continuous refining |

Recipes use `minTier` of the forge and the block `age` field only. **Nothing existing depends on any distillery
item**, so the progression solver still completes the game; `content.test.ts` gains "every distillery item is
reachable in its age" using the process cards as pseudo-recipes.

## 12. Player and UI

- Pour: a filled beaker, bucket or canister on a flask or vessel pours in (`expand`). An empty one on a receiver
  takes out (`nameOf`); on a flask's lower half it opens the drain cock for the residue.
- Items (yeast, herbs, filter medium, catalyst): use on the vessel or bed. Wrench on a `reflux_head` cycles its ratio.
- Empty hand: the rig screen with tabs PROCESS (thermometer with each component's boiling point marked, contents
  bars per module, live outputs), STRUCTURE (problems, capabilities, process picker with ghosts), CODEX link.
- Target name line without a screen: "Boiling Flask - 2.1 buckets, 92 C, distilling Low Wines".

## 13. Ordered work list (each step leaves `npm test` green)

First slice (W1 to W9):
1. W1 `src/core/chem.ts` + tests: components, mixtures, `nameOf`, `expand`, `stepStill` maths, conservation.
2. W2 content: `blocksDistill.ts` (kinds of section 2 needed for the slice: base, flask, vessel, segment, condenser,
   jacket, receiver, tube, airlock, port; with `_done` variants), `itemsDistill.ts` (generated containers,
   `FUEL_GRADES`), fluids appended to `fluids.ts`, `FluidKey` widened, validation `distillValidation.ts`.
3. W3 `distillScan.ts` + tests (every problem code, every row of section 3, the fuzz scan).
4. W4 `distill.ts`, `distillActions.ts`, wiring in `simulation.ts` (the five one-line touchpoints brewing uses),
   state swaps of section 2.1, save and load tests.
5. W5 processes: sugar_wash ferment, low wines and spirit, syrup, crude 3-cut; `distillProcess.test.ts`.
6. W6 textures (frame x lamp states, emblems) and `src/render/distill/` (liquid, bubbles, drips, bands).
7. W7 player: pour and take, rig screen, Codex page from the process cards.
8. W8 fuel integration: `FUEL_GRADES` in chainsaw and tractor; gasoline and diesel canisters.
9. W9 `scripts/e2e-distill.mjs` (build to a scratch dir, phone and desktop screenshots of a running crude column),
   chained into `package.json` `e2e`; `docs/api/distillery.md`.

After the slice, by value:
10. Reflux head, filter bed, lubricant and the chainsaw bar-oil consumer.
11. Vacuum cap, residue run, bitumen and asphalt road blocks (speed effect).
12. Potions: essences, tinctures, elixirs and their buffs; vials.
13. Drinks: Warmed, Tipsy, heads and Rough Spirit; antiseptic bandage; kerosene lantern.
14. Chem hopper and full pipe automation; structure-tab "one more block would add".
15. Shaft hooks: stirrer capability, oiler on the mech graph (after STEAM_PLAN lands shafts).
16. Catalyst bed, pressure cap, cracker; steel still shell.
17. Refinery tower multiblock.

## 14. Risks

- `FluidKey` is a closed union read by tanks, pipes and UI: widening it is a shared-file edit; do it in one small
  commit and run the transport tests.
- Glass cases are translucent cubes: liquid boxes inside must draw before the translucent chunk pass (render
  order), as `BrewLiquid` already does with polygon offset. Check on a phone GPU.
- Litres are small in this game (a bucket is 1000 L): all numbers above use that scale.
- Balance of fuel multipliers and elixir strength is a first guess; the process cards make retuning one-line edits.
