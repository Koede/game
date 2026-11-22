# Advice: magic depth and living systems (food, brewing, farming)

Written 2026-11-21 by the magic-and-food ADVISOR (read-only session; nothing built or run). Audience: the builder sessions that
start after the six-age refactor. Read with `docs/CONGRUENCE.md` (streams D and E), `docs/OVERHAUL_PLAN.md` part B,
`docs/api/{magic,sugar,brewing-buffs,food-rules,crops,weather}.md`, `docs/DISTILLERY_PLAN.md` sections 9 and 12.
Owner decisions are fixed (six ages, Ember = handwork, furnace is the heart, in-world beats screens, original names, magic is
"a little" and research based, essentia on every block). Code facts below were checked in the repo on this date; items marked
**(verify)** are guesses the builder must confirm in one grep before relying on them.

Facts checked that shape the design:
- `Buffs` has one slot per drink family (tea: spring/hearthkept/mending, coffee: swift/vigor/lasting) plus `wellFedS`, `wellWarmedS`,
  `sugarS`. Constants: Swift 1.2, Spring 1.35, Vigor 1.25, Hearthkept 0.5, Lasting 0.5, Mending x2, Sugar 1.12 speed and x2.5 Well-Fed
  burn, `DRINK_BUFF_S` 180, Well-Fed 360 s. Today the speed of Swift and Sugar Rush MULTIPLY (1.344).
- `LIGHTNING_MIN_DIST` is 60 blocks: real strikes are always far away, so a lightning rod cannot "catch" the existing flash (see M7).
- `DAY_LENGTH_S` is 900. `aspectTable.ts` has keywords for egg, milk, salt, meat but **no `egg`/`milk`/`cheese`/`salt` items exist**
  in `src/content` (verify): animal products are new content. Existing mobs: hen, goat, boar (`creatures.ts`) and the Emberbound
  automatons (`ember_core`, `scrap_metal` drops).
- Magic today: 24 research entries (Ember 7, Bronze 10, Forge 7), rods 16/32/64 charge, foci kindle/light/ward/blink, clay servants
  turn hand cranks only, tubes are a private network (`essentiaNet.ts`, 256 tube cap), spark/soul/void exist only as overrides.

---

## 0. The guardrails (every feature below must pass these)

**G1. The tech spine leads.** Magic never makes a raw material, an ingot, fuel units, or a tier. It makes conveniences, saves
trips, and gives a few small tricks. Every magic convenience has a tech equivalent that arrives later in the same age or the next
one and is better at scale (golem carry 1.3 items/s vs a belt; hearth siphon vs a bellows; infused kettle vs a boiler).
**G2. Magic costs a trade.** Each device draws essentia continuously; supply is bounded (wellsprings 1 in 10 chunks, rod draw
1-5 units/s, aura recovery 1 per minute per aspect per chunk). An infusion changes one number by at most x1.5 (x1.25 for
anything that touches electricity) and never adds an output.
**G3. Nothing on the winning path.** The solver never reads magic or the new food/brew content (`content.test.ts` keeps proving
completion). New foods, drinks and potions are optional comfort and are not in the required-item closure of `game:won`.
**G4. The furnace stays hands-on.** Golems and essentia never stoke, light or tend the furnace; only the existing hearth siphon
(one-way, near the end of a burn) and Vial of Cinder (+90 s) touch it, and both stay as they are.
**G5. Every new item and block gets a real fingerprint** (section 4.3 test) and every new aspect gets a tier, two parts, a colour
and an entry (CONGRUENCE 4.1).
**G6. In-world first, phone first.** One status sentence (<= 70 chars) per device on the target line; a screen only for the
notebook, the rune desk and the stewpot-free recipes below. Touch targets 44 px, long-press 420 ms is the secondary action.
**G7. Ages by NAME** via `ageIndexOf('forge')`; never a bare number. No recipe raises more than one gate (CONGRUENCE rule 3).

---

# Part 1. Magic depth

## 1.1 Research tree growth: 24 -> 40 entries

Conventions: entries live in `src/magic/entries.ts` with the helpers `pair/corners/triple/quad/wall/cellAt`; each gets a board the
existing "boards solvable with each age's aspects" test proves; recipes are gated through `gates.ts`; flags go in
`unlocks.flags` and are read with `hasFlag(state, flag)`. Lore for a late aspect is only awarded from its age on (rule L below).
New aspects used as anchors appear only in entries of their own age or later, so a board never asks for lore the player cannot own.

| # | key | title | age | requires | board anchors (+ blockers) | unlocks | what the player gets |
|---|---|---|---|---|---|---|---|
| 25 | `hedge_lore` | Hedge Lore | ember | `gathering_rod` | pair spring/ward | flag `green_thumb` | spring jar boosts nearby crops (F4) |
| 26 | `steam_sense` | The Sense of Steam | bronze | `infusion` | pair steam/drive | recipes `inf_kettle_cinder` | altar infusion: Kettle of Cinder; goggles-like aspect line on steam parts |
| 27 | `aura_dial` | The Aura Dial | bronze | `aura_reading` | corners gale/loam/brook | flag `aura_dial` | the HUD dial (M1) |
| 28 | `tincture_craft` | Tincture Craft | bronze | `still_trace`, `essence_jar` | triple clarity/spring/ward | flag `tincture_vial`, recipes `elixir_*` (gated in F3) | essence in the blend vessel; elixirs |
| 29 | `workshop_infusions` | Hands of Drive | bronze | `infusion`, `rune_desk` | quad rune/craft/drive/clarity | recipes `inf_driven_crank`, `inf_ever_oil` | two workshop infusions (M5) |
| 30 | `storm_draw` | Drawing the Storm | bronze | `aura_reading` | triple gale/frost/rift | flag `storm_draw`, recipe `storm_spire` | weather draws (M7) |
| 31 | `soul_draw` | The Quiet Draw | forge | `clay_servant` | pair spring/mind via `soul` anchor | flag `soul_draw` | rod draws soul from living things (M2) |
| 32 | `golem_walker` | The Clay Walker | forge | `clay_servant`, `soul_draw` | quad spring/mind/craft/drive | recipes `clay_walker`, `waypoint_seal` | walking golems (M6/G) |
| 33 | `golem_hands` | Willing Hands | forge | `golem_walker` | triple craft/drive/rune | flag `golem_tasks` | treadwheel seat, carry task (G2) |
| 34 | `tube_ports` | Ports and Valves | forge | `essentia_tubes`, `iron_rod` | corners clarity/steam/ward | flag `tube_ports`, recipe `essentia_valve` | tubes feed machines (M3) |
| 35 | `ash_stave` | The Ash Stave | forge | `iron_rod`, `focus_ward` | corners vein/gale/spring | recipes `ash_stave` | stave, two foci (M4) |
| 36 | `focus_mend` | Mending Focus | forge | `ash_stave`, `soul_draw` | quad spring/ward/mind/soul | recipes `focus_mend` | small heal focus |
| 37 | `spark_draw` | Gathering Sparks | current | `soul_draw` | corners spark/glow/drive | flag `spark_draw`, recipe `spark_jar` | spark from storm spire and dynamo leak |
| 38 | `spark_walker` | The Spark Walker | current | `golem_hands`, `spark_draw` | triple spark/soul/drive | recipe `spark_walker` (infusion) | fast golem |
| 39 | `focus_arc` | Arc Focus | current | `ash_stave`, `spark_draw` | pair spark/ward | recipe `focus_arc` | stun focus |
| 40 | `void_seed` | The Seed of Emptiness | current | `void_jar`, `spark_draw` | triple void/ward/wane | flag `void_draw` | void from deep dark; void cell (M5) |

Atomic and Star stay reserved: `warded_home` (atomic) and `star_light`, `void_mastery` (star) are listed in `entries.ts` as `planned`
comments only. If the sibling world/progression advisor puts something in those ages, add it then.

Rules for the table:
- **Rule L (late lore).** `LATE_ASPECT_AGE = { soul: 'forge', spark: 'current', void: 'current' }` in `aspectTable.ts`; `scanObject` skips
  lore for an aspect whose age is later than the player's best reached age (`state` already knows `known`, add the age as a
  parameter). Before then the aspect is simply not shown on that object's chips. Prevents the early scan of a hen teaching `soul`.
- Board difficulty: free cells 14-18 of 25, one blocker for Bronze, up to three for Current; every entry's `solveBoard` hint must
  succeed with the aspects of its own age (existing test pattern, extend the list).
- Notebook list grows to 41 rows; group by age (already) and collapse finished entries (phone scroll).
- Objectives (optional, flag based): `first_golem` (flag `golem_built`), `sweet_cup` (flag `sweet_drunk`), `first_potion` (flag
  `potion_drunk`), `green_thumb_set` (flag `green_thumb_on`). One line each in the objectives file of the owning stream.

## 1.2 Aspects: spark, soul, void as drawable

Draw rules live in `Magic.gather()` (a held rod, Use). They are all **site-bound** (you go somewhere) so they stay small.

| aspect | tier | age | where it comes from | rate | player sees |
|---|---|---|---|---|---|
| soul | 3 | forge | a living thing within 3 blocks of the rod: hen, goat, boar, tame or wild, automaton | 1 per 8 s per creature, creature "listless" 20 s, 120 s cooldown, max 4 per creature per day, never damage | rod glows violet, a thin violet thread lifts from the animal, it stops grazing and its head droops; animal never flees |
| spark | 3 | current | storm spire hit (M7), `dynamo_leak`: a running dynamo/generator within 2 blocks of a spark jar | spire 8 per hit; leak 1 per 20 s costing 0.5 % of that machine's output (a hook in the power sim, optional) | blue-white arc into the jar, jar fill crackles |
| void | 3 | current | the deep dark: aura level for void = `clamp((seaLevel - y - 30) / 2, 0, 32)` in unlit cells; rod draw 1 per 10 s | slow on purpose | rod hum drops an octave, vials look "empty" with a black core |

Pseudocode, gather extension (no change for the six primals and twelve compounds):

```ts
function lateDraw(aspect: 'soul'|'spark'|'void', ctx): number {            // units this second
  if (!ageReached(AGE_OF[aspect]) || !hasFlag(research, FLAG[aspect])) return 0; // 'soul_draw' | 'spark_draw' | 'void_draw'
  if (aspect === 'soul') { const m = livingNear(ctx.pos, 3).find(canDrawSoul); if (!m) return 0;
    m.soulCooldownS = 120; m.listlessS = 20; return 1 / 8; }
  if (aspect === 'void') return voidAura(ctx.pos) > 0 ? 0.1 : 0;
  return 0;                                    // spark is never drawn by rod: it arrives by spire / dynamo into a spark jar
}
```
State: creature cooldowns are session-only (a `Map<mobId, number>` in `magic.ts`, not saved), so no save change. Fingerprints for
creatures get a one-line `soul` weight through `aspectTableLife.ts` (4.3) and are shown only with rule L.
Why this stays modest: soul draw is ~7 units/min per animal; a clay walker eats 2 Spring per minute (not soul), only the infusion
that makes it (6 soul) and the focus_mend (cost 6 charge) use soul. Spark has one source per storm, void one place.

## 1.3 Aura HUD dial (M1)

A tiny ring on the compass, shown once `aura_dial` is done (or whenever the notebook or a rod is held). Not a screen.
- Ring colour = the dominant primal/compound aspect at the player's feet (`aura.sample(x, z, a)` for all 18 non-late aspects, take
  max), ring fill 0..1 = level / 64, a second small dot = the strongest OTHER aspect.
- A pulsing outer ring when a wellspring is within `NODE_REACH` 6 (uses `compass`); the ring points toward the nearest node as a
  tick on the circle when within 48 blocks (`nodesNear`), so the dial doubles as a compass to wellsprings.
- Tap or long-press on the dial: toast "Aura: gale 38, loam 21. Wellspring (brook) 41 m NE" (<= 70 chars). 44 px tap target.
- Update at 4 Hz, one `Aspects` reused object, zero allocation per frame. File: `src/ui/hud/auraDial.ts` (new) + a three-line
  mount in the HUD (`src/ui/hud/*` compass file) **owned by the magic builder**; if the six-age refactor moves the HUD, mount it
  where the compass is.
- Sound: none while idle; `scan_chime` pitched down one step when the dominant aspect changes (<= 1 per 10 s).
- Test: `auraDial.test.ts` (pure `auraDial(x,z,nodes)` returns `{aspect, level, other, nodeBearing}`): deterministic, level in 0..1,
  nearest node bearing correct for 3 seeded cases; DOM mount smoke test under `src/ui`.

## 1.4 Essentia tubes: unify or bridge? Recommendation: BRIDGE, not rewrite

CONGRUENCE D3 proposes re-implementing `essentiaNet.ts` on `pipeGraph.ts` with a fluid key. Recommendation: **do not** (risk
without gain): 21 aspects do not fit the `FluidKey` union, the pipe machinery carries one fluid per net with litres, and the
tube network already has a 256-tube cap, tests and a save. What the player wants from "unified" is: the same placing tool, the same
look and break behaviour, and tubes that connect to machines. Deliver those:

1. **Same tool and look (reuse).** `essentia_tube` is placed with the pipe tool/line placement and uses the pipe segment mesh with
   a glass tint and an aspect-coloured inner line (the jar's aspect, or neutral grey when empty). If the pipe placement tool is
   keyed by `FluidKey`, add a second small registry `PIPE_LIKE = ['essentia_tube']` instead of touching the union.
2. **Ports (new, `tube_ports` research, Forge).** A tube that touches a machine with an `ESSENTIA_PORTS` entry is a feed:
   | machine | accepts | effect |
   |---|---|---|
   | still / flask rig | any aspect (as today's vial trace), `clarity` purifies | continuous trace, 1 unit per 30 s of boil |
   | kettle / boiler (Bronze steam, when built) | `cinder` or `steam` | each unit = 20 s of heat-equivalent; `steam` makes steam with no fuel but the furnace's warm zone dims (CONGRUENCE D4: trade-off) |
   | hearth siphon (as now) | `cinder` | as now |
   | rune desk / altar | any (as now) | as now |
   | farmland sprinkler: none; green-thumb reads jars directly | | |
3. **Valve block `essentia_valve`** (Forge, vein + clarity + gale, cost 2 iron plate, 1 glass): a facing tube segment; it moves 1
   unit/s from the upstream jar to the downstream jar. Lets a wellspring jar feed a distant store; tubes alone only let consumers
   reach jars (today's behaviour). Throughput cap for any tube run = 4 units/s (OVERHAUL B.4): the net hands out at most 4 per second
   per consumer pull. Visual: one mote per unit travelling the run (instanced, <= 24 total).
4. **Save.** Nothing changes for existing tubes. A valve is a block with facing bits; fill is in the jars. Fixture test: a world
   with 20 tubes and 3 jars loads identically.

If a later builder still wants the pipe-graph rewrite, the clean migration is "tube = pipe segment with `fluid: 'essentia'` and a
sidecar `Record<segmentKey, {aspect, n}>`", with the existing tube blocks mapped on load; record that in `docs/api/magic.md`
Known limits instead of doing it now.

## 1.5 Rods, staves, foci: progression

Today: `vis_rod` 16 / draw 1 (Ember), `bronze_rod` 32 / 2 (Bronze), `iron_rod` 64 / 3 (Forge); foci kindle (cost 2), light (1), ward
(6), blink (4), each used from the hotbar and drawing on the best carried rod.

Add (all values in `RODS` / `FOCI` tables, no new code paths except the stave's slot):
| item | age | capacity | draw/s | slots | notes |
|---|---|---|---|---|---|
| `ash_stave` | forge | 96 | 4 | 2 foci | held in hand; **hold Use 420 ms to swap the active focus** (phone-friendly, a small glyph above the hotbar slot shows it); crafted at the Rune Desk: iron_rod + 4 plank + 1 iron plate, cost ward 12 + rune 8 |
| `spark_stave` | current | 128 | 5 | 3 foci | recharges 1 unit/s from an adjacent spark jar (`spark` units cost 1:4 charge, the 4 is the bridge cost) |

Foci (cost is charge, cooldown seconds):
| focus | age | cost | cd | effect |
|---|---|---|---|---|
| `focus_mend` | forge | 6 | 40 | heal 4 health over 6 s, stops if you take damage; sound `cast` + soft rising chime; less than a Mending tea |
| `focus_reach` | forge | 3 | 8 | pulls ground items within 6 blocks to your feet (uses the ground-items system, `docs/api/ground-items.md`); a vacuum-pump style whoosh; an Ember-age convenience that does NOT beat the pump/magnet at scale |
| `focus_arc` | current | 8 | 15 | an arc to the nearest hostile automaton within 10: 2 s stun and 3 damage; light flash; no griefing |
Rod upgrade rule: a rod's `draw` multiplies gather speed on that aspect's aura only up to the aura level / 8 per second, so a Star
rod would still not outpace aura recovery; recorded in `RODS`.
Art: stave = rod model with a longer shaft and two small glass beads that glow in the focus colours; foci stay icons. Animation:
a 0.3 s forward raise, a ring of aspect motes, no recoil.

## 1.6 Infusions tied to every age (altar rows)

`INFUSIONS` rows: `center`, `around` (pedestal items), `cost` (aspects), `seconds`. Each row changes ONE number, listed with the
tech piece it improves. Existing: `steel_infusion`, `clay_servant`, `vein_bronze`.

| age | id | center + around | cost | seconds | effect |
|---|---|---|---|---|---|
| bronze | `inf_ever_oil` | oil can with lubricant + 2 `glow` vial | glow 6, clarity 2 | 30 | oiled state lasts x3 (goggles: "oiled 27 min") |
| bronze | `inf_driven_crank` | hand_crank + 2 bronze_ingot | drive 8, craft 2 | 40 | crank stress capacity x1.5 (rpm unchanged) |
| bronze | `inf_kettle_cinder` | kettle + cinder vial | cinder 8 | 30 | kettle/boiler uses 0.5x heat; needs the kettle block to exist (Bronze stream A) |
| forge | `inf_warded_coat` | padded coat + 2 iron plate | ward 12, rune 4 | 60 | permanent damage x0.9 (focus_ward remains x0.5 for 30 s); one per coat |
| forge | `inf_clay_walker` | clay_servant block + 2 `soul` vial | soul 6, drive 4, mind 4 | 90 | becomes a walker (research `golem_walker`) |
| forge | `inf_quick_quern` | quern twin (workshop) + 2 `drive` vial | drive 8 | 45 | machine speed x1.25 for that machine (flag on the machine entity, not on rpm) |
| current | `inf_spark_walker` | clay_walker + 2 `spark` vial | spark 12, soul 4 | 120 | walker moves and works x2 |
| current | `inf_storm_lamp` | lamp + 2 `glow` vial | glow 6, spark 3 | 40 | a lamp that never needs power, light 12 (a convenience, not a generator) |
| current | `inf_void_cell` | battery + 2 `void` vial | void 8, ward 4 | 90 | battery capacity x1.25 |
Atomic (reserved): `inf_warded_vault` (item vault + ward) and Star: none. The rule G2 limit x1.5 (x1.25 for electric parts) is
asserted by a test over the table: `infusions.test.ts` loops the rows, `effect.mult <= 1.5` and `<= 1.25` for rows with `electric: true`.
Per-machine effects are one boolean/number field on the existing machine entity (`infused?: string`), read by the owning sim at its
single rule (`Workshop.crankCapacity`, lube duration, kettle heat). Builders add the field only where the table needs it.
Altar feel (existing): the pedestals' items lift and spin, jars drain; add a **settling chord** on completion and a coloured ring
that shrinks as `seconds` runs, so the player sees progress without a screen.

## 1.7 Magic stays modest: a one-line budget

`MAGIC_BUDGET` (docs, enforced by two tests): (a) total essentia a single wellspring can give = 1 per 15 s = 4 per minute; a
fully-tubed base with 4 wellsprings is ~16 per minute, i.e. one infusion per 2-3 minutes at most; (b) the sum over all INFUSIONS of
the multiplier excess is capped as above; (c) the progression solver does not read `ARCANE_RECIPES` or `INFUSIONS` for any output
the tech spine requires (`content.test.ts` exists and keeps proving this); (d) golems: <= 4 within 32 blocks (section 1.8).

## 1.8 Walking golems (the constructs of the workshop)

Evolution of the existing `clay_servant` block: (1) the block still turns a crank (Forge, built); (2) the **Clay Walker** (Forge,
`golem_walker`) is an entity that walks to jobs; (3) the **Spark Walker** (Current) does the same at x2.

The Walker, as the player sees and does it:
- Made at the altar (infusion row above). It stands up from the servant block with a puff of clay dust and a soft violet eye. It
  is not a mob in `src/mobs` (no combat, spawning or population rules): it is a small entity list in `src/magic/golem.ts`
  (`GolemHost`), rendered by `src/render/magic/golemRenderer.ts` with the same part-box format as `CreaturePart` (body, head, two
  arms, two legs; `anim` swing).
- Look: clay red-brown `#b0764a` with darker cracks (painted texture), a bronze belt, an eye in the colour of `soul` (`AspectInfo.color`).
  Size 0.6 x 1.1 blocks. Idle: slow blink every 4 s and a breathing 1 px body bob. Working: arm swing in time with the job (crank:
  circles, carry: lifting a small box on its back). Tired (no Spring): slumps, eye dims, 20 s later it sits down and stops.
- Sound: `golem_step` (a low soft thud, pitch by speed, max 2 per second), `golem_work` (a short wooden knock), `golem_wake` (a
  rising two-note chime). Volume budget: one step loop per visible walker, distance-attenuated; max 3 audible at once.
- Needs: 1 Spring unit per 30 s idle, per 15 s working, from any jar within 4 blocks of its HOME (the servant block cell) or tubed to
  it. It remembers the jar position, not the tube path. Without Spring it stops where it stands and the status line says why.
- **Interaction (phone first).** Use with an empty hand: toggles Work / Stay ("Clay Walker: stays here"). Use with a Spring vial:
  feeds 4 units. Use with the notebook: scans (it teaches `soul`, `craft`, `spring` once). **Waypoint Seal** (`waypoint_seal`, item,
  cloth + 2 rune at the desk): Use on a block stores point A (a violet marker block outline for 10 s and a toast "Pickup set"),
  Use on a second block stores point B; Use on the golem with a ready seal assigns the pair; a pair of the same seal can be
  reused. No screen; an inventory-free way to say "carry from A to B".
- Status sentence (target line and goggles): "Clay Walker: carrying wheat to crate, Spring 9" (<= 70 chars).

Tasks (research `golem_hands` unlocks the last two; `clay_servant` block already does the first):
| task | rule | numbers |
|---|---|---|
| crank | stands next to a hand crank and calls `Workshop.crank` | 1 stroke per second (as the servant today) |
| treadwheel seat | a `treadwheel` within 8 blocks: walks in place on the wheel | supplies 8 rpm, 4 su (a weak source, below a crank player + below a water wheel) |
| carry | picks up to 8 items from the pickup block's inventory/ground items at A, walks to B, drops into inventory/ground | one trip per ~6 s over <= 16 blocks: about 1.3 items per second, less than a plain belt run |
| NOT | stoke, light or fuel the furnace; harvest; fight; place or break blocks; open doors it is not walked through | (G4) |

Pathing (bounded and cheap): 3D grid A* with step-up 1 and drop <= 2, radius 16, node budget 400, replan at most 2 Hz per walker;
a failed path sets `blocked` with the status "Clay Walker: no path to B" and retries every 10 s. At most 6 walkers are ticked; one
that is more than 64 blocks from the player is **suspended**: its position is frozen (it shows as a still figure when the chunk
loads), and it resumes when you return, so no offline simulation and no chunk loads. Cap: 4 working walkers within 32 blocks of each
other (a new one refuses to wake: "Too many walkers nearby").
Save shape: `WorldSave.golems?: { id: number; kind: 'clay'|'spark'; x,y,z: number; yaw: number; home: [number,number,number];
spring: number; state: 'work'|'stay'|'tired'|'blocked'; task: { kind: 'crank'|'tread'|'carry'; a?: Vec3; b?: Vec3 } | null;
carry: { item: string; n: number } | null }[]`; missing = none; each damaged entry is dropped, not the whole list (as `magic.ts`
does for jars). `docs/api/magic.md` records it.

---

# Part 2. Food, brewing and farming, congruent with sugar, the still and essentia

## 2.1 Baseline and what changes

Keep: tea/coffee/sugar rules, Sugar Rush (speed 1.12, Well-Fed burn x2.5), `eat()` and `drink()`, hearth stew Well-Fed 360 s. The one
rule change is **stacking** (2.2), implemented once in `buffs.ts`; every old number still holds when only one buff is active, and a
regression test pins them.

## 2.2 Buff stacking rules (F2, the core of the congruence request)

Buffs act on **stats**. For each stat, active contributions are sorted strongest first and combined with diminishing returns, then
capped. This replaces today's plain multiplication.

```ts
// bonus b_i = mult_i - 1 for stats where bigger is better; r_i = 1 - mult_i for drain stats (smaller mult is better)
const STACK_WEIGHTS = [1, 0.5, 0.25, 0.25];                 // strongest, second, third, rest
function combine(stat: Stat, parts: number[]): number {      // parts = bonuses (or reductions) > 0
  parts.sort((a, b) => b - a);
  const total = parts.reduce((s, p, i) => s + p * (STACK_WEIGHTS[Math.min(i, 3)]), 0);
  return clamp(stat.higherIsBetter ? 1 + total : 1 - total, stat.min, stat.max);
}
const STATS = {
  speed:   { higherIsBetter: true,  max: 1.35 },   // Swift .20, Sugar .12, Merry .00, Gale elixir .10
  jump:    { higherIsBetter: true,  max: 1.5  },   // Spring .35
  mining:  { higherIsBetter: true,  max: 1.4  },   // Vigor .25, Rift elixir .15
  regen:   { higherIsBetter: true,  max: 2.0  },   // Mending +1.0 (x2), Hale tonic +.5   (a "x2" is bonus 1.0)
  foodDrain:   { higherIsBetter: false, min: 0.3 },// Well-Fed .5, Lasting .5, Hearty .2, Gale elixir (sprint only) .4
  warmthDrain: { higherIsBetter: false, min: 0.3 },// Hearthkept .5, Merry .3, Hardy tonic .3
};
// Costs add up, they are not diminished:
wellFedBurn = clamp(1 + sum(burns), 1, 4);               // Sugar Rush burn 1.5 (=> 2.5 alone, as today), Firewater .5
```
Results, with numbers: Swift (1.2) + Sugar Rush (1.12) = 1 + .20 + .06 = **1.26** (was 1.344). Spring is a separate stat so Sweet Green
Tea still jumps and runs. Well-Fed (.5) + Lasting (.5) + Hearty (.2) = 1 - (.5 + .25 + .05) = **0.2 -> clamped 0.3**. Hearthkept + Merry:
1 - (.5 + .15) = .35. Sugar Rush + Firewater burns Well-Fed x3.0.
**Visible**: the HUD buff pill row (existing) gets a small stack number "x1.26" in the speed pill's tooltip/long-press; no new HUD.
**Back-compat**: `speedMult`, `jumpMult`, `miningMult`, `foodDrainMult`, `warmthDrainMult`, `regenMult` stay the public getters;
only their bodies call `combine`. Tests: `buffStack.test.ts`: each existing buff alone equals today's constant; Swift+Sugar = 1.26;
cap holds; Well-Fed burn with Sugar alone = 2.5 and the existing `sugarRush.test.ts` stays green.

**Slots.** Existing drink slots: tea, coffee. New slots: `liquor` (one of merry/hearty/firewater), `tonic` (one of hale/hardy/gleam),
`elixir` (one primal elixir). Up to five drink effects at once (tea, coffee, liquor, tonic, elixir) is deliberately possible
and the diminishing returns make stacking all of them a sensible small gain, not a runaway. Same-slot rule is unchanged (a new
one replaces, a longer one is never shortened). Drink cooldown 1 s.
**Costs and caps keep it a choice:** liquors add sway (2.4); Sugar burns Well-Fed; elixirs consume a vial and an essence; tonics
need spirit (a distillery product). `DrinkBuff` union grows by 9 keys; HUD labels from `DRINK_BUFFS` (`src/core/brewing.ts`).

## 2.3 Sugar chemistry, distillery spirits and potions (the chain)

All distillery processes are already designed in `DISTILLERY_PLAN` (fermenter + airlock at tier 1, `sugar_wash`, `low_wines`, `spirit`,
`fuel_ethanol`, maceration tincture, filter bed, vessel blend into elixir "bottled in vials", 4 per 1000 L). This section designs
the **drink items and buffs** on top; it adds no new vessel or fluid, only items and `DrinkSpec` rows. Where the distillery
builder has not landed a process, the item exists but its recipe note says "needs the distillery (stream B)": F3 may ship the
item data and buffs first and the recipes as cards when B lands (order in 5).

Chain, with player-visible steps:
1. Sugar: resin chain as in `sugar.md`. Sweeten a cup directly (F1) or ferment: **syrup/sugar + water + berries (as yeast) in the
   fermenter 120 s -> `sugar_wash`** (cloudy, then clears; the fermenter shows bubbles, sound `boil_bubble` very quiet).
2. Drinkable ferments, no still: `berry_must` -> **Berry Wine**; `grain_wash` diluted -> **Ale**. Bottled by Use of a glass vial on
   the fermenter/receiver spout (one vial = 125 mL; the unit rule of `amounts.ts`).
3. Still: `sugar_wash` -> low wines -> **Spirit**. Spirit in a vial is **Firewater**.
4. Maceration: herb + spirit, 50 C heated vessel, then the charcoal filter bed -> **tincture** in a vial.
5. Essence: a vial of an aspect in the still (existing trace rule) makes **essence** `<aspect>`; blend essence + clear tincture +
   syrup in the vessel -> **elixir** vial.

Drink table (all `ItemSpec.drink`; new `DrinkSpec` fields: `slot`, `sway?`, `burn?`). Durations default `DRINK_BUFF_S` 180:

| item | slot | effect (stat group) | s | cost |
|---|---|---|---|---|
| `berry_wine` | liquor | **Merry**: warmthDrain -0.3; +5 warmth now | 240 | sway 0.4 deg |
| `ale` | liquor | **Hearty**: foodDrain -0.2; +2 hunger now | 240 | sway 0.4 deg |
| `firewater` (spirit vial) | liquor | **Firewater**: heat/lava/fire damage x0.5; +10 warmth | 90 | sway 1.2 deg, Well-Fed burn +0.5 |
| `tonic_hale` (tea leaves + spirit) | tonic | **Hale**: regen +0.5 | 300 | none (rare ingredients) |
| `tonic_hardy` (pine resin + spirit) | tonic | **Hardy**: warmthDrain -0.3 and hostile knockback x0.5 | 300 | none |
| `tonic_gleam` (glowcap + spirit) | tonic | **Gleam**: ambient light floor +3 for you (dark caves are readable) | 240 | none; render: one uniform `playerLightFloor` (verify the light pipeline allows it; else drop) |
| `elixir_cinder` | elixir | fire/lava damage x0.4 | 150 | |
| `elixir_loam` | elixir | fall damage -2 blocks and knockback x0.5 | 150 | |
| `elixir_brook` | elixir | breath x2 underwater if the player has breath (verify; else Swim speed +0.1) | 150 | |
| `elixir_gale` | elixir | sprint food drain x0.6 and speed +0.10 | 150 | |
| `elixir_rune` | elixir | tool wear x0.7 for 150 s | 150 | |
| `elixir_rift` | elixir | mining +0.15 | 150 | |
Each elixir costs: 1 vial of that aspect (drawn by rod) + 250 L spirit-based tincture + 250 L syrup per bottled vial (the plan's 4 per
1000 L). Expensive enough that coffee remains the everyday boost and elixirs are for a project day. Quantities are copied from
the distillery plan; the builder reads `DISTILLERY_PLAN` section 12 for the exact `card()` ids.
Drinking: reuse `drink()` (same shape as `eat()`), the vessel is returned as `glass_vial`. Toast: "Firewater: fire hurts half as
much. You sway." Sound `sip` plus `drink_gulp` (new, low pitch) for liquors.

## 2.4 Alcohol's visible cost: sway

While a liquor with `sway` runs: camera yaw/pitch noise `a * sin(2 pi 0.7 t) * (0.6 + 0.4 sin(2 pi 0.23 t))` degrees, `a` = the
buff's sway; mining/placing aim is unaffected (cosmetic + slightly harder precise aiming). Cleared by respawn; **drinking any tea ends the sway** with the toast "The tea
clears your head". File: `src/game/sway.ts` (pure `swayDeg(t, amp)`), consumed by the camera in `src/player` (one line).
Phones: motion sickness is real; Settings gets a "Reduce screen sway" toggle (default on for the phone profile) that sets
amplitude to 0. Required, not optional.

## 2.5 Tea, coffee and sugar together (F1, Sweet Cup)

**Use sugar on a finished cup** (a cup in stage `done`, block `cup_tea`/`cup_coffee`): sugar grains dissolve with a small swirl
particle ring (6 particles, 0.6 s), the drink tints one shade lighter. State = the cup's `ingredient`... a `sweet: true` flag on the
`BrewCup` entity; the pickup `tea`/`coffee` item gets `meta.sweet = 1` (stack `meta` exists for vials; **verify** the stack field
name; cups hold 1 drink each so no stack-merge issue; items with different `meta` must not merge: set `stack: 1`, they already
are).
On drinking a sweet drink: duration x1.2, plus Sugar Rush 45 s (the burn applies, because sweetness is the cost). Sweet Green Tea,
Sweet Coffee are shown as "Sweet Tea" in the name via `meta` (inventory name override line). Cost: 1 sugar per cup (sugar yields 3
per 2 resin + pail, so a sweet cup is cheap but not free).
Also: **a pinch of sugar on tea/coffee in the cone** is not supported (one way to do it keeps the UI quiet).

## 2.6 Crops and creatures tied to essentia (F4)

Rule: every plant and creature has a fingerprint "growth + one flavour". They already inherit from keywords; the table below
adds explicit rows through `src/magic/aspectTableLife.ts` (owned by the FOOD builder, imported by `aspectTable.ts` in a one-line
spread). Amounts <= 4 for foods, creatures 3-5 (a creature scanned alive is worth more than its meat).

| key | fingerprint | key | fingerprint |
|---|---|---|---|
| wheat / wheat_seeds | spring 2, gale 1 | hen (creature) | spring 3, gale 1, soul 1 |
| potato | spring 2, loam 2 | goat | spring 3, ward 1, soul 1 |
| carrot | spring 2, vein 1 | boar | spring 3, rift 1, soul 1 |
| tea_leaves / dried_tea | spring 2, steam 1 | ember_core (automaton) | cinder 2, mind 1, soul 2 |
| coffee_cherries / roasted_beans | spring 2, drive 1 / cinder 1 | hearth_stew | spring 3, cinder 1 |
| berries | spring 2, glow 1 | sugar | spring 2, glow 1 (as keywords) |
| glowcap | glow 3, spring 1 | spirit (vial) | cinder 2, clarity 2 |
| pine_sap / pine_resin | spring 2, brook 1 / spring 1, ward 1 | hide, wool, feather | existing keywords |
`soul` shows only from Forge (rule L). Tests: `fingerprintLife.test.ts`: every food key, plant key, creature key and drink key has
>= 2 aspects and none is only a `CATEGORY_BASE` fingerprint (reuse the "meaningless fingerprint" threshold test from CONGRUENCE D0).

**Green Thumb (research `hedge_lore`, Ember).** A spring jar (the existing `essentia_jar` holding spring) within 4 blocks of an
**unripe** crop: that crop's growth rate x1.25 (on top of hydrated 1.0 / dry 0.5). The jar spends 1 unit per 45 s while at least
one unripe crop is in range (cap: boost applies to at most 12 crops per jar; a second jar adds another 12). Empty jar = no boost.
In-world: green motes drift from the jar to the crops it helps (<= 12 particles total per jar, 0.5 Hz bursts), the HUD target line on
the jar says "Spring jar: helping 7 crops, 12 left". No screen. Code: `cropRules.rateFor(...)` gets one optional input
`boost: number` computed in `crops.ts` by a function injected from `Game` (`CropField.setBoost(fn)`) so `src/sim` never imports `src/magic`.
Balance: x1.25 is worth ~1 min per 5; a tractor or a field of belts matters far more.

**Creatures.** Soul draw (1.2) is the only mechanical tie, plus husbandry products below. Keep animal essentia off combat.

## 2.7 Farming machines and shared rules (F5)

One set of pure functions in `src/sim/cropRules.ts` (owned by the food builder) is called by the player, the deployer, the arm
and the tractor so none can drift:

```ts
isRipe(blockKey): boolean
harvestPlan(blockKey, rng): { drops: ItemAmount[]; replantTo: string | null }  // regrow bushes -> bare; crops -> first stage if a seed is in drops
tillTarget(blockKey): string | null; plantTarget(seedKey, below: string): string | null
```
- **Workshop Deployer** (Bronze, built): holding a hoe it tills the block in front; holding seeds it plants; holding nothing it
  harvests a RIPE crop in front. One action per cycle (2 s at 16 rpm, scales with rpm; the deployer's `CYCLES` table is the
  workshop stream's). Replant takes 1 seed from the drops automatically (so wheat farms close their own loop, with a net -0 seed
  because seed drops are 1-3).
- **Field Arm** (arms exist: stream C): sweeps a 5 x 5 block of farmland around its pivot, 1 action per 1.5 s; Bronze players can
  run a belt of wheat to a quern twin to a basin. This is the Bronze farming payoff.
- **Tractor tiller/harvester** (Current, built): switch to `harvestPlan`/`tillTarget` calls so a tractor's replant matches the
  deployer; the tractor harvests 3-wide.
- **Golem carry** (1.8) moves the harvest from a crate to a crate; it never harvests.
- Soil: a crop whose farmland is removed today holds still; decision for the owner (WHATS_LEFT 6) is "it pops as the item with a
  `crop:popped` event". Recommended: pop it (drops its seed) and make all of the above call the same `cropRules.farmlandLost`.

## 2.8 Seasons and weather (cheap, optional S-tier)

Seasons from the clock only (no new world gen): `season = floor(day / 8) % 4` (8 days = 2 real hours; year = 8 hours): spring, summer,
autumn, winter. Effects are one multiplier table in `cropRules.ts`:
| season | growth (outdoors, open sky) | extras |
|---|---|---|
| spring | x1.15 | rain more likely? (no: weather system is seeded, leave) |
| summer | x1.0 | none |
| autumn | x1.0 | harvest drop bonus: 25 % chance of +1 drop |
| winter | x0.5 | crops under glass, a roof lit by a lamp, or in a greenhouse (lit rule exists) ignore the penalty |
Hint text on the Hearth Log page ("Winter: crops grow slowly in the open; glass and lamps keep them going"). Tie to magic: the
rod draws `frost` x2 in snow or winter, `gale` x2 in storms (M7), `cinder` x1.25 at noon, wellspring refill +25 % at night
(CONGRUENCE D9). Do not tint the sky by season; a sky tint is a render task for the world advisor if they want it. If time is
short, ship F4/F1/F2 first; seasons are the cut line.
Rain waters crops: `hydrated` becomes true while it rains (verify whether `cropRules` already reads weather; `weather.md` says crops feel it).

## 2.9 Cooking depth (F7): Stewpot and variety

**Stewpot** (block `stew_pot`, Ember, clay table row: 4 clay, fired): sits on a furnace top like the boil bucket (same machine
role `brew` family, same 'furnaceBelow' lookup), holds up to 4 items by Use (one at a time, each drops in with a plop), simmers
while the furnace is >= 120 C, ready 40 s after the last item. Take with Use on a bowl/empty hand: **a Stew** (one portion, stack 1;
4 portions per pot). Player sees: the pot lid, bubbles, steam from the top (reuse boil bucket steam), sound `boil_bubble`.
Rules (one table, `stewRules.ts` in `src/game`, pure):
```ts
groupsOf(item): 'grain'|'veg'|'meat'|'sweet'|'herb'|'dairy'|null
function stew(items: string[]): { hunger: number; wellFedS: number; buff?: ... } {
  const g = new Set(items.map(groupsOf).filter(Boolean));          // 1..5 distinct groups
  return { hunger: 6 + 1.5 * g.size, wellFedS: 240 + 40 * g.size,   // 3 groups = 360 = today's hearth stew
           buff: g.has('herb') ? 'hearthkept' : undefined /* 90 s */ };
}
```
So `hearth_stew` (existing, 10 uses) stays as the 3-group case; a lone potato "stew" is poor (hunger 7.5, 280 s). Salt/pepper-like
seasoning is out of scope (no salt item yet). Failing recipe: fewer than 2 items = "Add something more."
**Variety:** `eat()` keeps the last three distinct food keys (`stats.recentFoods?: string[]` in `PlayerSnapshot`, optional, max 3).
Eating the same item as the last one gives hunger x0.8 and the toast "You are tired of X"; any food not in the last 3 gives full value.
Corner cases: buff foods and drinks are exempt. Cheap, readable, no UI.
**Animal products and baked goods** (the CONGRUENCE E.3 list), each as one row in `itemsFood*.ts` + a rack/furnace/basin recipe:
| item | made from | hunger | Well-Fed s | note |
|---|---|---|---|---|
| `meat_pie` | meat + flour at the furnace 200 C | 8 | 240 | groups grain + meat |
| `jerky` | raw meat on the Drying Rack 180 s | 4 | 120 | stack 16, never "spoils" (no spoilage system) |
| `cheese` | milk + wait 600 s in a crock on the rack | 5 | 180 | **needs milk** (below) |
Husbandry (optional, F8, Bronze): `trough` block holding feed (wheat): tame hen within 3 blocks lays an `egg` every 360 s, tame goat
gives `milk` (bucket on Use) every 480 s, each product costs 1 wheat from the trough; a `spring` jar adjacent adds +20 % speed
(the same boost function as Green Thumb). Only if `egg`/`milk` items do not exist yet add them (verify) and a drop-only mob
path would do if time runs out. The brewing plan's drinks never need milk.

---

# Part 3. Feature cards (summary, one per feature, for builder briefs)

| id | feature | player does | numbers | art / animation / sound |
|---|---|---|---|---|
| M1 | Aura Dial | looks at the compass ring | 4 Hz, level/64, node tick within 48 | thin ring, aspect colour, outer pulse near node; `scan_chime` down a step |
| M2 | Late draws | rod near a creature / spire / deep dark | soul 1 per 8 s, void 0.1/s, spark from spire | violet thread from animal, black-cored vials |
| M3 | Tube ports + valve | tube touches still/kettle; place valve | 1 unit/s valve, 4/s cap, 20 s heat per cinder unit | tinted pipe mesh, inner line colour, motes |
| M4 | Staves, foci | holds the stave, long-press swaps focus | 96/4, 128/5; mend 6, reach 3, arc 8 | raised-arm 0.3 s, aspect motes, `cast` |
| M5 | Infusions per age | rod on altar | x1.5 max (x1.25 electric) | settling chord, shrinking ring |
| M6 | Research 24 -> 40 | solves boards | 16 entries | tree groups by age, `research_solve` |
| M7 | Storm spire + weather draws | places a spire (iron + vein + rune) | strike chance 1 in 4 per flash cycle (6-22 s) while storming and spire is highest block within 8; 8 spark per hit into a jar within 2 | local flash + close thunder (`thunder` at distance 12), arc into jar; gale x2 in storms, frost x2 in snow |
| G1 | Clay Walker | wakes, seals, feeds | 0.6 x 1.1; 1 Spring/30 s idle | dust puff, violet eye, thud steps |
| G2 | Seals and tasks | seal A, seal B, Use on walker | 8 items / ~6 s; treadwheel 8 rpm 4 su | box on back, arm swing |
| G3 | Spark Walker | infuses | x2 speed | blue eye, small arcs |
| F1 | Sweet Cup | sugar on cup | +20 % time, Sugar Rush 45 s | swirl ring, lighter tint |
| F2 | Stacking | nothing (visible via pill tooltip) | table in 2.2 | none |
| F3 | Liquors, tonics, elixirs | bottles at the fermenter, still, blend vessel | table 2.3 | `drink_gulp`, sway |
| F4 | Green Thumb + crop aspects | spring jar by the field | x1.25, 1 per 45 s, 12 crops | green motes |
| F5 | Field machine rules | deployer / arm / tractor | one shared function set | none |
| F6 | Seasons | reads Hearth Log | table 2.8 | none |
| F7 | Stewpot + variety | puts 2-4 foods in a pot | 6+1.5g hunger, 240+40g s | steam, plop sound |
| F8 | Trough husbandry | tames, feeds | 360/480 s | egg pop |

M7 pseudocode (spire): `onTick(dt)`: `if weather==='storm' && exposed(spire, 8) { t -= dt; if (t<=0) { t = rand(6,22); if (rng()<0.25) strike(spire) } }`;
`strike`: flash, `thunder` sfx at distance 12 (so it is loud, short, and never confused with the 60+ block strikes), push 8 spark
into jars within 2 blocks if `spark_draw` done and Current reached; else the spark is lost with a hissing sound (a lesson, no harm).
A spire never damages the player or blocks and never starts fires.

---

# Part 4. Risks and checks

| risk | why | mitigation / test |
|---|---|---|
| **Balance: stacking runaway** | tea + coffee + sugar + liquor + tonic + elixir | `combine()` caps and diminishing weights (2.2); unit test with every buff on: speed <= 1.35, foodDrain >= 0.3; playtest note. |
| **Balance: Sweet tea + Sugar Rush loops** | sugar cheap, burns Well-Fed | burn is additive and capped at x4; sugar tonics need cups; stew gives Well-Fed 360-440 s only. |
| **Magic outruns the tech** | golems, infusions, spark | G1-G4, caps in 1.7, `infusions.test.ts`, a `golemCap` test, and the solver test. |
| **Aspect fingerprint coverage** | ~60 new items/blocks across three builders | one shared test: `fingerprint.test.ts` coverage + "no key whose aspects are only `CATEGORY_BASE`" with a threshold <= 5 % of registry; each builder adds keywords/overrides in ITS file (`aspectTableLife.ts` for food, `aspectTableMagic.ts`... see 4.3). |
| **Late-aspect lore and boards** | soul/spark/void anchors need lore | Rule L + existing "boards solvable with each age's aspects" test extended with `AgeName` per entry; entries 31/37/40 need an object whose scan teaches the aspect at that age (hen/goat/boar for soul, battery/cable for spark, deep ore or `star_core` override for void; add a deep-rock keyword `deep` -> void 1 in `aspectTableMagic.ts`). |
| **Save shape** | five new optional keys | see 4.1; every key optional, missing = fresh; sanitisers drop bad entries; fixture round-trips (old save with none loads). No `SAVE_VERSION` bump. |
| **Content count tests collide** | `content.test.ts`, `food.test.ts`, `specRoster*.ts` counts are shared | each builder bumps counts ONLY through its own roster file (`specRosterMagic/Food/Golem...`); merge order M -> F -> G; on a conflict take both and re-add, never loosen a count. |
| **Age index drift after the refactor** | `ageMap.ts` had `bronze: 0` | all new gating via `ageIndexOf(name)`; builders start only after W0 and re-read `ageMap.ts` and `FurnaceTierSpec`. |
| **Golem pathing perf** | A* per walker | 400-node budget, 2 Hz, 6 ticked max, suspend beyond 64 blocks; `golem.perf.test.ts` ticks 6 walkers for 1000 frames under a time budget. |
| **Potion items need distillery recipes not landed** | stream B ordering | ship items and buffs first; recipes as cards only once B's vessels exist; solver ignores them. |
| **Sway on phones** | motion sickness | setting "Reduce screen sway" default ON for phone profile (2.4). |
| **Pointer-lock caveat** | automation cannot test real mouse | e2e uses tap/`Use` calls, as the existing magic e2e. |
| **Three sessions and `magic.ts` (1087 lines)** | conflicts | split into `magic.ts` (M track only) and `golem*.ts`, `magicFood.ts` seams (5.0). |
| **Tube bridge not a rewrite** | owner might expect one network | recorded in `docs/api/magic.md`; the pipe-net rewrite remains a documented option. |

### 4.1 Save shape (all optional)
- `PlayerSnapshot.buffs.drinks`: add the nine new `DrinkBuff` keys (record of seconds; already a `Partial<Record<..>>`).
- `PlayerSnapshot.stats.recentFoods?: string[]` (<= 3). `BuffsSnapshot.sugarS` unchanged.
- `WorldSave.golems?: [...]` (1.8). `WorldSave.magic` gains nothing; creature soul cooldowns not saved.
- `BrewCup` entity: `sweet?: boolean`. `ItemStack.meta.sweet?: 1` (check the stack meta field name).
- Seasons derive from the clock: nothing saved.
### 4.2 Sounds (SfxName additions, one seam commit): `golem_step`, `golem_work`, `golem_wake`, `drink_gulp`, `spire_strike`, `valve_click`. List them in `sfx.test.ts`.
### 4.3 Fingerprint files: `src/magic/aspectTable.ts` stays owned by the magic builder; the food builder owns `src/magic/aspectTableLife.ts` (plain object `LIFE_KEYWORDS`, `LIFE_OVERRIDES`) merged by a one-line spread in the seam commit; a golem/magic keyword set lives in `aspectTable.ts`.

---

# Part 5. Ordered task list for three parallel builder sessions

All start after the six-age refactor has landed (they need `ageMap.ts`, tier numbers, the HUD location, the `.run-lock`
convention). Each builder: reads this note, `docs/CONGRUENCE.md` 4.5 (registration checklist), commits only its own files, runs
`npx tsc --noEmit` and the narrow vitest set, then `HW_GPU=1 node scripts/e2e-<x>.mjs --no-build` under `.run-lock`.
No sub-agents (usage), trimmed output.

### 5.0 S0: the seam (MAGIC builder, first, small, ~half a session; the others wait for its commit)
Files: `src/core/gameEvents.ts` (SfxNames above, events `golem:woke`, `drink:sweet`), `src/core/types.ts` (`DrinkSpec` gains `slot?`,
`sway?`, `burn?`; `DrinkBuff` union +9), `src/save/document.ts` (the optional keys in 4.1 with defaults), `src/magic/aspectTable.ts`
(`import { LIFE_KEYWORDS, LIFE_OVERRIDES } from './aspectTableLife'`, empty file created), `src/magic/aspects.ts`/`research.ts`
(`LATE_ASPECT_AGE`, rule L), `magic.ts` (`golems: GolemHost` interface + `NullGolemHost`), `src/audio/sfx.test.ts`.
Accept: tsc clean, full vitest green, old-save fixture loads, no behaviour change.

### Track M (magic builder; files: `src/magic/*` except `golem*.ts` and `aspectTableLife.ts`, `src/render/magic/magicRenderer.ts`, `src/content/{itemsMagic,recipesMagic,specRosterMagic}.ts`, `src/ui/hud/auraDial.ts`, Codex Essentia tab, `docs/api/magic.md`, `scripts/e2e-magic.mjs`)
| id | task | depends | acceptance |
|---|---|---|---|
| M-1 | Aura dial (1.3) | S0 | `auraDial.test.ts` (3 seeds), DOM smoke test; e2e: the dial appears with the notebook held and tapping toasts |
| M-2 | Research 24 -> 40 (1.1) with gates, boards, flags, objectives lines | S0 | `research.test.ts` + `gates.test.ts` extended: 40 entries, every board `solveBoard`-solvable with its age's aspects, every gated recipe's own ingredients obtainable, game completes (`content.test.ts`) |
| M-3 | Late draws: soul, void; spark jar block | M-2 flags | `magicRuntime.test.ts`: soul draw cooldowns, void only below the depth line, spark only into a jar; rule L tested |
| M-4 | Tube ports, valve, 4/s cap, pipe-like placement | M-2 | `essentiaNet.test.ts`: valve moves 1/s, still pulls, cap holds, 20 tubes + 3 jars round-trip; e2e `tube-on-still` |
| M-5 | Staves + foci (mend, reach, arc) | M-2, M-3 (soul/spark) | table-driven test over `RODS`/`FOCI`; stave swap by long-press covered in `interaction` test; e2e: focus_mend heals 4 over 6 s |
| M-6 | Infusion table (1.6) + per-machine `infused` field hooks in workshop/lube/kettle | M-2, Bronze stream's parts | `infusions.test.ts` multiplier caps; each infusion's single hook test; e2e: altar infusion of a crank |
| M-7 | Storm spire and weather draws (2.8, M7) | M-3 | deterministic test with a seeded rng: 1000 s of storm gives a bounded number of strikes; `thunder` at 12 m |
| M-8 | Codex: Aspects page + research tree 40, `fingerprint.test.ts` coverage threshold, `docs/api/magic.md` | all above | `npm run codex` preview script passes |

### Track G (golem builder; files: `src/magic/golem*.ts`, `src/render/magic/golemRenderer.ts`, `src/content/{itemsGolem,specRosterGolem}.ts`, `scripts/e2e-golem.mjs`, `docs/api/golem.md`)
| id | task | depends | acceptance |
|---|---|---|---|
| G-1 | `GolemHost`: entity list, save/load, Spring feed, status sentence, cap and suspend | S0 (interface), M-2 entries (recipe only; gate can be tested with a synthetic state) | `golem.test.ts`: feed/tired/cap/suspend, save round-trip with damaged entry dropped |
| G-2 | Walker model, animation, sounds, wake/puff, altar wake | G-1 | texture test, renderer stats; screenshot of idle / working / tired (looked at) |
| G-3 | Tasks: crank (reuse servant path), treadwheel seat, carry between seals, A* | G-1 | `golemPath.test.ts` (obstacles, step-up, budget), `golemTasks.test.ts` (carry 8 per trip, treadwheel supplies 8 rpm / 4 su in the workshop solver, never touches a furnace); `golem.perf.test.ts` |
| G-4 | Waypoint Seal item + interaction (Use A, Use B, Use on walker) | G-1 | `interaction` test with a fake world; e2e on phone portrait: set seals by taps, walker carries wheat from crate to crate |
| G-5 | Spark Walker (infusion + x2 speed) | M-3 spark | test: x2 speed, needs 2 Spring/30 s, cap still holds |
G files avoid `magic.ts`; the hook in `Game` is the one line added in S0.

### Track F (food/brewing/farming builder; files: stream E's list in CONGRUENCE plus `src/magic/aspectTableLife.ts`, `src/game/{stewRules,sway}.ts`, `src/content/{itemsFood2,itemsBrew,itemsSugar,recipesBrew,specRosterFood,specRosterBrew}.ts`, `scripts/e2e-food.mjs`, `docs/api/{food-rules,brewing-buffs,sugar,crops}.md`)
| id | task | depends | acceptance |
|---|---|---|---|
| F-1 | Buff stat groups + slots (`combine`, 2.2), keep public getters | S0 | `buffStack.test.ts` as in 2.2; `sugarRush.test.ts` unchanged and green |
| F-2 | Crop and creature fingerprints (`aspectTableLife.ts`), `fingerprintLife.test.ts` | S0 | coverage test; boards still solvable (M-2's list may need soul anchors only from Forge) |
| F-3 | Sweet Cup (1 sugar on a cup), `BrewCup.sweet`, drink handling | F-1 | `brewing.test.ts` rows: sweet cup, Sugar Rush 45 s, +20 % time; e2e "tea with sugar" |
| F-4 | Liquor, tonic, elixir items + `DrinkSpec`s + HUD labels + sway + setting | F-1 | `food.test.ts` counts; `sway.test.ts` (amp 0 with the setting); drink() tests per slot; recipes as cards only if stream B vessels exist |
| F-5 | Shared `cropRules` functions; deployer/arm/tractor call them; replant | none | `crops.test.ts`: same harvest result from player, deployer, tractor; farmland-lost decision applied |
| F-6 | Green Thumb (`CropField.setBoost`, spring jar), needs `hedge_lore` flag | M-2 (flag only; test with synthetic state) | `crops.test.ts`: x1.25, 12-crop cap, jar drains 1 per 45 s, empty = none; e2e: jar next to wheat grows faster |
| F-7 | Stewpot + variety (`stewRules.ts`, `recentFoods`) | F-1 | rule tests (3 groups = 360 s), variety x0.8 toast, old save loads |
| F-8 | Seasons table | F-5 | `season.test.ts` (day -> season, glass exempt), Hearth Log line (cut line: drop first) |
| F-9 | Husbandry (trough, egg, milk, cheese, pie, jerky) | F-5 | items + recipes + tests; skip if time-boxed |

Ordering across tracks: S0 -> {M-1, M-2, F-1, F-2, F-5, G-1} in parallel -> {M-3, M-4, F-3, F-4, F-6, G-2, G-3} -> {M-5, M-6, M-7, F-7, F-8, G-4, G-5} -> {M-8, F-9} -> an independent review session
(per `docs/team.md`: save migration and shared sims need one) and then the stream-G playtest.
Merge order when two tracks touch counts: M, then F, then G (rebase, bump counts, re-run `npx vitest run`).
Shared-file watchlist (assign one writer at a time): `src/core/types.ts`, `src/core/gameEvents.ts`, `src/save/document.ts`,
`src/content/content.test.ts`, `src/audio/sfx.ts`: only S0 touches the first three; anyone needing more waits for S0 or appends a
line and rebases.

Owner decisions this dossier leaves open (defaults chosen, change here first): (1) tube network stays separate, bridged by ports;
(2) a crop whose farmland is removed pops; (3) seasons are in (optional, cut line); (4) Sugar+Swift now stack to 1.26 instead of
1.344 (an intended small nerf); (5) liquor sway ships with a phone-default reduce toggle.
