# Unit 18 - Magic aspects, research and vials

Status: build spec, written 2026-11-22 against `docs/build/SYSTEMS.md` (binding). Owner: Unit 18. Wave 1 (parallel).
Where this file and SYSTEMS.md disagree, SYSTEMS.md wins; where this file and the code disagree about something that exists,
the code wins and the builder tells the coordinator.

**Threads:** T4 (material web: `vial_soul` gets a second producer, essences and tinctures get their magic consumers, a new
tool `steel_rod`), T7 (knowledge and gating: nine new research entries, the flags `late_draw`, `golem_walk`, `steady_tubes`,
`essence_ward`, `aura_dial`, `essence_study`, a `gates` list for recipes owned by other units), T8 (crosshair and desk
phrasing of the rest of a vial, the rod's tuning), T9 (reuses existing magic sounds only), T10 (two optional save fields).

Legend: names marked **NEW** do not exist in the code today; everything else was grepped and exists (section 14 lists the
verification).

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

The notebook has always listed 21 aspects, but three of them - **Spark** (electric current), **Soul** (creatures and
servants) and **Void** (emptiness and storage) - could never be held in a vial: the rod refused them and only four late
furnace overrides carried them at all. This unit finishes the magic layer's top floor:

1. **The deeper aspects.** After the Forge-age entry **The Deeper Aspects** (`late_draw`) a gathering rod draws Spark from
   a battery room and its cables, Soul from the living company around you (tame animals, a clay servant, later a golem),
   and Void from the places where things are kept (item vaults, tanks, crates) and from the corestone at the bottom of the
   world. The deeper aspects answer the rod first: stand in your battery room and the rod hums Spark.
2. **A tuned rod.** Use a rod on a jar and it is tuned to that jar's aspect: from then on it draws only that aspect (when
   the land has any). Use it on an empty jar to untune it. This is the long-promised "Use on a jar to choose" of
   OVERHAUL_PLAN B.4, and it is how a player draws Cinder in a room full of batteries.
3. **Nothing poured away.** The Rune Desk used to swallow the rest of a vial it broke open (bronze rod: Rune 2 from a vial
   of 4 - two units gone). Now the rest pours back into a jar within reach (or tubed) that holds the same aspect or is empty;
   the desk row says so before you press Make. Only when no jar has room is it lost, and the row warns you first.
4. **Research that reaches out.** Nine new entries tie the notebook to the rest of the build: golems that walk (Unit 17),
   tubes that flow twice as fast (Unit 19), elixirs that stretch to six with a ward vial (Unit 10), the aura dial (Unit 19),
   studying potion essences for lore, steeping tinctures into Soul at the altar, and a fourth rod tier of steel.

Fantasy: *the notebook grows up with the base.* The player who has built a battery room, tamed a herd and filled a vault
finds that each of those places now hums with an aspect only they could have made. Magic stays optional (T7): the spine
never needs any of it, and the progression solver still completes without it.

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 Threads

| thread | what this unit reads | what this unit defines |
|---|---|---|
| T4 material web | `essence_<buff>` x6 and `tincture_<herb>` (+ `_cloudy`) keys from Unit 10; `steel_ingot`, `iron_rod`, `glass_vial` (exist) | consumers: essence study (all six essences), `steel_rod` desk row (essence_vigor), `soul_steep` / `soul_steep_cloudy` infusions (tea-leaf and wildberry tinctures); producer: second source of `vial_soul`; end product `steel_rod` (a tool) |
| T7 knowledge | `RESEARCH`, `RESEARCH_GATES`, `hasFlag`, `craftGateReason` (exist) | entries `essence_ward`, `aura_dial`, `reading_essences`, `steeped_soul`, `late_draw`, `golem_walk`, `steady_tubes`, `steel_rod`; optional `ResearchEntry.unlocks.gates` (NEW) |
| T8 reading | `rodReading()` (exists, now shows late aspects automatically through `drawable`) | desk row note, refund toasts, tuning toasts (section 6.1) |
| T9 sound | `essentia_pour`, `rod_hum`, `scan_chime`, `infuse` in `src/audio/sfxMagic.ts` (exist) | no new `SfxName` (Unit 19 owns new magic sounds) |
| T10 save | `MagicSnapshot`, `sanitizeResearch` (exist) | optional `MagicSnapshot.tuned?`, research entries load by key (no shape change) |

### 2.2 Contracts with other units (SYSTEMS 6.2 row "18")

| other unit | contract | if the other unit has not merged |
|---|---|---|
| **10** potions | Unit 10's ward elixir rows carry `research: 'essence_ward'` and run only when `Distillery.researched('essence_ward')` is true (UNIT-10 spec section on the research gate). Unit 18 defines the entry and the flag `essence_ward` - nothing else. | the flag exists, nothing reads it: harmless |
| **10** items | Unit 18's `soul_steep` rows name `tincture_tea_leaves`, `tincture_wildberries` and their `_cloudy` twins; essence study names the six `essence_<buff>` keys (exact keys from UNIT-10 tables: `essence_spring`, `essence_hearthkept`, `essence_mending`, `essence_swift`, `essence_vigor`, `essence_lasting`). The `steel_rod` desk row consumes `essence_vigor`. | rows exist and are gated, but their ingredients cannot be had yet; the content test lists these keys in `PENDING_UNIT10_ITEMS` (section 9.4) and the coordinator deletes that set after Wave 2 |
| **17** golems | Unit 17 adds an `INFUSIONS` row with id exactly **`clay_golem`** (output `clay_golem`). Unit 18's entry `golem_walk` lists `clay_golem` in `unlocks.gates`, so `RESEARCH_GATES` gates it and `startInfusion` (which already calls `this.craftGate(r.id)`) refuses it with `Research "The Walking Clay" in your notebook first`. Unit 17 may additionally read `hasFlag(research, 'golem_walk')` (SYSTEMS 6.3). | the gate names a recipe that does not exist yet; `gates` ids are exempt from the "recipe exists" test |
| **19** aura dial and tubes | Unit 19 reads `hasFlag(research, 'steady_tubes')` (tube flow `TUBE_UPS` x2) and `hasFlag(research, 'aura_dial')` (the HUD dial). Unit 18 defines both entries and flags. | flags exist, nothing reads them |
| **17** soul from life | the Soul land source counts loaded non-hostile mobs; harnessed animals and golems are mobs, so they count with no Unit 17 change | - |
| **8 / 14 / 16** words | `LATE_RULES` lists the words `vacuum` (Unit 8 `vacuum_cap`, `vacuum_pump`; also existing `vacuum_collector`), `electromagnet` (Unit 14), `chest` (Unit 16 `padlock_chest`), `golem` (Unit 17) | a word with no key simply matches nothing |

### 2.3 T4 rows this unit adds (coordinator merges into SYSTEMS T4)

| item | made by (unit) | consumed by | age | stack |
|---|---|---|---|---|
| `vial_soul` (exists, had no producer) | rod after `late_draw` near living things (18); altar `soul_steep` from 2 tinctures (18) | Unit 17 golem infusion cost (Soul essentia via jars); research boards via vial study (18); clay servants? no (they eat Spring) | forge (draw) / bronze (steep) | 8 |
| `vial_spark`, `vial_void` (exist, had no producer) | rod after `late_draw` (18) | vial study for lore (18); `steel_rod` desk cost Spark 4 (18); Unit 17/19 may cost them | forge | 8 |
| `steel_rod` (NEW, tool, end product) | rune desk: 1 iron_rod, 2 steel_ingot, 1 essence_vigor + Spark 4, Vein 8, Mind 6 (18) | the player (draws 4, holds 96) | forge | 1 |
| `essence_<buff>` (Unit 10) | Unit 10 | elixirs (10); **essence study in the notebook (18)**; `steel_rod` (18, vigor only) | bronze | 16 |
| `tincture_tea_leaves`, `tincture_wildberries` (+ `_cloudy`) (Unit 10) | Unit 10 | elixirs (10); **`soul_steep` infusions (18)** | ember / bronze | 16 |

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code

All paths below exist today.

- `src/magic/aspects.ts`: `PRIMALS` (6), `COMPOUNDS` (12), `LATE = ['spark', 'soul', 'void']`, `ASPECTS` with `tier` 3 and parts
  spark = glow+drive, soul = spring+mind, void = wane+ward. `kin(a, b)`: equal or a direct component.
- `src/magic/aspectTable.ts`: `KEYWORD_RULES` (spark appears only in `battery`, `cable`, `circuit`, `coil`, `solar`, `fission`;
  soul and void in no rule), `CATEGORY_BASE`, `AGE_BONUS_PER_AGE` 1, `MAX_ASPECTS` 4, `MAX_AMOUNT` 8, `OVERRIDES` (soul only in
  `furnace_plasma`; void only in `furnace_star`, `star_core`).
- `src/magic/fingerprint.ts`: `aspectsOf(key)` = OVERRIDES, else first recipe (`craftedOf`, which adds `rawOf(key)`), else
  `rawOf`; then `normalise` keeps the four strongest (ties by `aspectOrder`). Measured today (bundled dump of every key):
  only **six** keys carry a late aspect at all - `furnace_arc` (spark 4), `furnace_plasma` (spark 4, soul 1), `heavy_cable`
  (spark 2), `corium` (spark 3), `furnace_star` (void 2), `star_core` (void 3). `battery` is `{vein 8, craft 8, loam 8,
  cinder 8}`: its keyword spark 3 is cut by `normalise`. `clay_servant` and `void_jar` (infusion outputs, so raw) are
  `{loam 3, craft 2, brook 1, drive 1}` and `{craft 3, drive 1}`.
- `src/magic/magic.ts`, class `Magic`:
  - `private drawable(a: Aspect): boolean` (~line 345): `PRIMALS.includes(a) || hasFlag(this.research, 'compound_draw')` -
    so late aspects become drawable with `compound_draw` today, but no block in the world carries enough of them to matter.
  - `landAspects(cx, cy, cz)` sums `aspectsOf` of every block within `GATHER_RADIUS` 3; `richest()` picks the drawable aspect
    with the most `left = min(DRAW_CAP 24, floor(n / 8)) - drawn`; `gather(rod)` keeps `this.rod.aspect` only while bottling
    (`toVial`) and only if it has `left >= 1`, else silently switches to `richest`.
  - `private take(x, y, z, radius, aspect, n, withVials)` (~line 566): drains jars from `jarsFor(...)`, then whole carried
    vials: `need -= VIAL_UNITS` - the rest of the last vial is lost. `deskMake` (~line 657) calls it per cost aspect.
  - `deskRow` builds `DeskRow { id, output, count, inputs, cost, problem }`; `deskMake` toasts `Made <name>`.
  - `notebook().study(vial)`: `vial_study` flag, `STUDY_LORE` 3, gives `glass_vial` back, `stats.studied++`.
  - `load()` clamps `charge` to `Math.min(64, ...)` (the iron rod's capacity, hard-coded).
- `src/content/itemsMagic.ts`: `VIAL_UNITS` 4, `JAR_UNITS` 32, `VOID_JAR_UNITS` 128, `RODS` (vis 16/1, bronze 32/2, iron
  64/3), 21 `vial_<aspect>` items generated from `ASPECTS` (stack 8).
- `src/content/recipesMagic.ts`: `MAGIC_RECIPES` (7 registry rows), `ARCANE_RECIPES` (7: bronze_rod, iron_rod,
  infusion_altar, four foci), `INFUSIONS` (4: vein_lens, clay_servant, void_jar, steel_infusion). `arcaneRecipe(id)`,
  `infusionRecipe(id)`.
- `src/magic/entries.ts`: `RESEARCH`, 24 entries (Ember 7, Bronze 10, Forge 7), helpers `pair`, `corners`, `triple`, `quad`,
  `wall(gap)`; `age: AgeName` strings. Flags in use: `vial_study`, `hearth_cinder`, `still_clarity`, `aura_reading`,
  `node_tap`, `hearth_siphon`, `compound_draw`.
- `src/magic/gates.ts`: `RESEARCH_GATES` derived from `unlocks.recipes`; `craftGateReason` returns
  `Research "<title>" in your notebook first`.
- `src/magic/research.ts`: `hasFlag`, `unlockedRecipes`, `sanitizeResearch` (drops unknown entry keys, keeps known ones -
  so adding entries never breaks a save).
- `src/magic/research.test.ts`: "every board can be solved with aspects of objects from its own age" uses items with
  `age <= ageIndexOf(e.age)` **plus every block regardless of age** (weak for late aspects). "requires only earlier
  entries, and every gated recipe exists" checks `recipe(id) ?? arcaneRecipe(id) ?? infusionRecipe(id)`.
- `src/content/specRosterMagic.ts`: `MAGIC_SPEC.items` (10 + 21 vials), `textures: 48`, `MAGIC_RECIPE_COUNT` counts registry
  rows only (arcane and infusion rows are not registry recipes).
- `src/render/textures/iconsMagic.ts`: `item_vis_rod: icon(rod)`, `item_iron_rod: icon((c) => rodOf(c, IRON_R, P.rgb(0x9fd6ff)))`.
- `src/ui/screens/notebook/notebookScreen.ts`: entries grouped by `e.age` with an `.hw-nb__age` heading; Notes tab lists
  carried `vial_*` with `Study <name>` buttons (`data-study`) when `api.canStudy()`.
- `src/ui/screens/notebook/deskScreen.ts`: one card per row, chips `.hw-nb__need` (`is-ok` / `is-short`), `Make` button
  `data-make`, a `role=status` line showing `api.make(id)`'s answer.
- `scripts/e2e-magic.mjs`: steps up to "the rune desk screen makes a bronze rod from ingredients and carried vials" (gives
  `vial_gale`, `vial_loam`, `vial_rune`; bronze_rod costs gale 4, loam 4, rune 2 - so today 2 Rune are lost) and the
  infusion step.

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 Which blocks carry Spark, Soul and Void

**Why a new rule and not more keywords.** `KEYWORD_RULES` words are already added to crafted objects (`craftedOf` adds
`rawOf(key)`), but a battery's recipe sum (vein, craft, loam, cinder all at 8) pushes spark out in `normalise`. Raising the
keyword to 9+ would break `MAX_AMOUNT`. So late aspects get their own small table that is applied **after** `normalise` and
is guaranteed a place among the four.

**`LATE_RULES` (NEW, `src/magic/aspectTable.ts`).** `Record<string, Partial<Record<'spark' | 'soul' | 'void', number>>>`, keyed
by key words (split on `_`, exactly like `KEYWORD_RULES`):

| aspect | word -> amount | real keys it touches today (others: future units) |
|---|---|---|
| spark | `battery` 3, `lithium` 4, `cable` 2, `solar` 2, `generator` 2, `thermopile` 2, `electrode` 2, `electrolyzer` 3, `circuit` 3, `coil` 2, `fission` 4, `electromagnet` 3 | `battery`, `lithium_bank`, `copper_cable`, `heavy_cable`, `super_cable`, `solar_panel`, `burner_generator`, `thermopile`, `electrode`, `electrolyzer`, `circuit`, `copper_coil`, `fission_pile`; Unit 14 `electromagnet` |
| soul | `servant` 4, `golem` 5, `hide` 1, `leather` 1, `treadwheel` 2 | `clay_servant`, `hide`, `leather`, `treadwheel`; Unit 17 `clay_golem` |
| void | `vault` 4, `void` 6, `tank` 2, `crate` 2, `chest` 2, `corestone` 3, `airlock` 2, `vacuum` 3, `hatch` 1 | `item_vault`, `void_jar`, `tank`, `crate`, `corestone`, `airlock_cap`, `vacuum_collector`, `item_hatch`, `fluid_hatch`; Unit 8 `vacuum_cap`, `vacuum_pump`; Unit 16 `padlock_chest` |

**Pinning rule (NEW `pinLate(out, key)` in `src/magic/fingerprint.ts`), applied in `aspectsOf` after `normalise`, and NOT
to keys that have an `OVERRIDES` row** (an override is hand-authored and wins over everything, as today):

1. `late` = sum over the key's words of `LATE_RULES[word]` (per late aspect).
2. For each late aspect `a` with `late[a] > 0`: `out[a] = min(MAX_AMOUNT, max(out[a] ?? 0, late[a]))`.
3. While `out` has more than `MAX_ASPECTS` aspects, delete the weakest **non-late** aspect; ties broken by deleting the one
   with the HIGHER `aspectOrder` (the later in `ASPECT_LIST`). A key never loses a late aspect to this step.
4. Deterministic, memoised in the same `cache`.

Worked examples (builder: assert the first five in tests):

| key | before | after |
|---|---|---|
| `battery` | vein 8, craft 8, loam 8, cinder 8 | cinder 8, loam 8, vein 8, **spark 3** (craft dropped: all 8, craft is latest in order) |
| `clay_servant` | loam 3, craft 2, brook 1, drive 1 | loam 3, craft 2, brook 1, **soul 4** (drive dropped: weakest tie, later than brook) |
| `item_vault` | craft 8, loam 8, spring 8, vein 8 | loam 8, spring 8, vein 8, **void 4** |
| `void_jar` | craft 3, drive 1 | craft 3, drive 1, **void 6** |
| `corestone` | loam 5, rune 2 | loam 5, rune 2, **void 3** |
| `copper_cable` | vein 6, craft 6, cinder 2, loam 2 | vein 6, craft 6, cinder 2, **spark 2** (loam dropped: tie with cinder, later in order) |
| `furnace_star` | override | unchanged (override) |

Consequences (intended): scanning a battery now teaches Spark (lore 3); scanning a clay servant teaches Soul; scanning a
crate teaches Void at Ember. Board solvability of the 24 existing entries cannot get worse (anchors are fixed and the
palette only grows).

**Soul from living company (NEW).** Blocks alone would make Soul a statue aspect. `Magic.landAspects` adds Soul for living
creatures near the centre: `soul += livingNear(cx, cy, cz, SOUL_RADIUS) * SOUL_PER_LIFE`, where:

- `MagicHooks.livingNear?(x: number, y: number, z: number, radius: number): number` (NEW optional hook) returns a weighted count
  of loaded, non-hostile mobs whose position is within `radius` (3-D distance from the cell centre): wild animal 1, tame 2.
  Harnessed animals and Unit 17's golems are tame mobs and count 2. Missing hook = 0 (tests and old wiring keep working).
- `SOUL_RADIUS` = 6 (NEW, `magic.ts`): wider than `GATHER_RADIUS` 3 because animals wander.
- `SOUL_PER_LIFE` = 4 (NEW, `magic.ts`).

**Amounts in play** (`richest` gives `floor(sum / 8)` units, capped at `DRAW_CAP` 24, recovering 1 unit per `DRAW_RECOVER_S`
30 s per chunk and aspect - unchanged):

| place | late sum within reach | drawable units (fresh) | vials (4 units) |
|---|---|---|---|
| battery room: 4 `battery` + 8 `copper_cable` | 4 x 3 + 8 x 2 = 28 spark | 3 | 0.75; one vial every ~1.5 min of waiting |
| lithium room: 3 `lithium_bank` + 6 `heavy_cable` | 12 + 12 = 24 spark | 3 | as above |
| pen of 4 tame goats, player inside | 4 x 2 x 4 = 32 soul | 4 | 1 |
| clay servant at its crank + 2 tame hens | 4 + 2 x 2 x 4 = 20 soul | 2 | 0.5 |
| wall of 6 `item_vault` | 24 void | 3 | 0.75 |
| standing on the corestone floor (7 x 7 at the bottom, `GATHER_RADIUS` 3 cube) | 49 x 3 = 147 void | 18 | 4.5 |
| one `void_jar` + 4 `tank` | 6 + 8 = 14 void | 1 | - |

Design intent: Spark and Soul are where the player BUILT something (a battery room, a herd); Void is plentiful only at the
bottom of the world - a reason to dig all the way down once. All amounts are modest and recover like any other aspect.

**No late wellsprings.** `nodeInChunk` is untouched (its hash order decides every existing world's wellsprings; changing the
list would move them). Late aspects come from the land only.

### 4.2 Drawing them: `late_draw`, priority and the tuned rod

**`drawable(a)` becomes (NEW body):**

```ts
private drawable(a: Aspect): boolean {
  if ((PRIMALS as readonly string[]).includes(a)) return true;
  if ((LATE as readonly string[]).includes(a)) return hasFlag(this.research, 'late_draw');
  return hasFlag(this.research, 'compound_draw');
}
```

This closes today's accidental path (late aspects drawable with only `compound_draw`). `late_draw` requires `compound_draw`
in the tree, so a player with `late_draw` can always draw compounds too.

**Late first (NEW rule in `richest`).** When at least one late aspect is drawable here with `left >= 1`, `richest` returns
the late aspect with the most `left` (ties by `aspectOrder`), ignoring primals and compounds. Otherwise it behaves exactly as
today. `rodReading()` is not changed: it still lists the three strongest drawable aspects by amount (so it now shows e.g.
`Loam 6, Vein 4, Spark 3` in a battery room once `late_draw` is done, before `late_draw` it shows no Spark).

**Tuning (NEW).** A held rod used on a jar (`essentia_jar` or `void_jar`, i.e. `JAR_BLOCKS`) no longer gathers; it tunes:

| jar state | result | toast (`advise` for refusals) |
|---|---|---|
| holds aspect X, X drawable | `this.tuned = X`; `rod.n` partial units are kept only if `rod.aspect === X`, else reset | `The rod is tuned to X - it draws only X now` |
| holds aspect X, X not drawable yet | refused, tuning unchanged | `You cannot draw X yet - research "<title of the entry that unlocks it>"` (compound: `Drawing the Compounds`; late: `The Deeper Aspects`) |
| empty jar, rod tuned | `this.tuned = null` | `The rod is untuned - it draws the richest aspect again` |
| empty jar, rod untuned | refused | `Use the rod on a jar of the aspect you want to draw` |

Use on the infusion altar keeps priority (it is checked first, as today). Gathering with a tuned rod:

- Bottling (`toVial`) AND charging: the aspect is `tuned` when `leftOf(tuned) >= 1`; else refused with
  `advise('No X left here - the rod is tuned to X (Use it on an empty jar to untune)')`. (Charge has no aspect, but a tuned rod
  still only drinks X - simple and predictable.)
- A wellspring within reach (`nearNode`, research `node_tap`) wins only if its aspect equals `tuned` (or the rod is untuned);
  otherwise the land is used.
- The existing "keep `rod.aspect` while bottling" rule stays for untuned rods.

`this.tuned` is saved as optional `MagicSnapshot.tuned?: string` (section 7).

### 4.3 The vial's rest goes back into a jar (desk refund)

**Rule.** At the Rune Desk, essentia is paid jars first (within `DESK_REACH` 3 or tubed, `jarsFor` order), then whole carried
vials, exactly as today. When the last vial of an aspect over-pays (`need < VIAL_UNITS`), the **rest** (`VIAL_UNITS - need`
units, 1-3) is poured into jars in reach in this order:

1. jars holding that aspect, in `jarsFor` order (including a jar the payment just emptied, which still counts as "that
   aspect"), each up to its capacity (`JAR_UNITS` 32 / `VOID_JAR_UNITS` 128);
2. then empty jars (no aspect, 0 units), in `jarsFor` order;
3. what still has no room is lost.

Jars of another aspect are never used. Units are conserved and exact: units before (jar contents in reach + carried vials x 4)
= units after (jar contents) + cost + lost.

**Pure planner (NEW file `src/magic/payment.ts`)** so the row preview and the payment use the same arithmetic:

```ts
export interface JarSlot { key: string; aspect: Aspect | null; n: number; cap: number }
export interface PaymentPlan {
  fromJars: [key: string, aspect: Aspect, n: number][];
  vials: Partial<Record<Aspect, number>>;           // vials broken open per aspect
  refunds: [key: string, aspect: Aspect, n: number][];
  lost: Aspects;                                     // rest with no jar room
  short: Aspects;                                    // non-empty = cannot pay; nothing else is meaningful then
}
/** Plans paying `cost` from jars (in order) then carried vials, and where each vial's rest goes. Pure, deterministic. */
export function planPayment(cost: Aspects, jars: readonly JarSlot[], vials: Partial<Record<Aspect, number>>, vialUnits = VIAL_UNITS): PaymentPlan;
```

Aspects are processed in `ASPECT_LIST` order so a plan is deterministic when two aspects compete for the same empty jar (the
earlier aspect gets it). Jar state is updated as the planner walks (a jar filled by a Rune refund is no longer empty for a
Gale refund).

**Desk row note (NEW optional `DeskRow.note?: string | null`).** `deskRow` runs `planPayment` and sets:

| plan | note text (shown under the chips) |
|---|---|
| no vial opened, or the vials divide evenly | `null` |
| rest, all refunded | `Opens 1 Vial of Rune: 2 Rune go back into a jar` |
| rest, part refunded | `Opens 1 Vial of Rune: 1 Rune back into a jar, 1 lost - no more room` |
| rest, none refunded | `Opens 1 Vial of Rune: 2 Rune will be lost - set an empty jar within 3 blocks` |

Several aspects: one clause per aspect joined by `; ` (e.g. `Opens 1 Vial of Rune, 1 Vial of Mind: 2 Rune and 1 Mind go back into
a jar`). Keep under ~90 characters for the common one-aspect case (it wraps in the card; it is not a crosshair line).

**`deskMake` (changed).** Applies the plan: removes inputs, drains `fromJars`, removes `vials` (giving `glass_vial` back per
vial, as today), applies `refunds` via `setJar`, emits `essentia_pour` at the first refunded jar, and toasts:

- `Made Bronze Gathering Rod - 2 Rune back into the jar` (all refunded),
- `Made Bronze Gathering Rod - 2 Rune lost, no jar with room in reach` (kind `warn`),
- `Made Bronze Gathering Rod` (nothing left over, as today).

The infusion altar pays from jars only (`withVials` false) and is unchanged. `take()` stays for the altar, servants and
siphon; the desk no longer calls it.

### 4.4 New research entries (nine)

All boards were checked with `solveBoard` against the aspects of **items only** (no blocks) with `age <= ageIndexOf(age)`,
excluding vials and excluding late aspects from the palette (tokens never need a late aspect: anchors provide them and kin
reaches them through their parts). Every board below solved; token counts from that run. Bronze entries go at the END of
the Bronze block of `RESEARCH`, Forge entries at the END of the Forge block, in the order listed (every `requires` is
earlier in the array, as the existing test demands).

Lore text is in the notebook's voice: second person, plain, ends with the board instruction where natural (see existing
`'Link Clarity to Craft and you will know how to blow a vial that keeps essentia.'`).

#### Bronze

| key | title | requires | board | unlocks | tokens (solver) |
|---|---|---|---|---|---|
| `essence_ward` | Warded Essences | `still_trace`, `wellsprings` | `triple('ward', 'clarity', 'spring', [cellAt(2, 2)])` | flag `essence_ward` | 7 |
| `aura_dial` | The Aura Dial | `aura_reading`, `wellsprings` | `corners('mind', 'glow', [cellAt(2, 2), cellAt(1, 3), cellAt(3, 1)])` | flag `aura_dial` | 7 |
| `reading_essences` | Reading Essences | `distilled_lore`, `still_trace` | `pair('soul', 'clarity', [cellAt(1, 1), cellAt(1, 3), cellAt(3, 1), cellAt(3, 3)])` | flag `essence_study` | 3 |
| `steeped_soul` | Steeped Soul | `infusion`, `still_trace` | `triple('soul', 'spring', 'clarity', wall(2))` | recipes `soul_steep`, `soul_steep_cloudy` | 9 |

Texts:

- `essence_ward`: `'Ward keeps what is poured from spilling. Set a Vial of Ward among an elixir's makings and the batch stretches from four to six. Link Ward, Clarity and Spring.'`
- `aura_dial`: `'A rod held long enough leaves its reading in the corner of your eye. While you hold a rod, a small dial shows the strongest aspects of the land. Link Mind to Glow.'`
- `reading_essences`: `'A cup boiled down to its essence still remembers who drank from it. Study an essence in the notebook: it gives Soul lore and lore of its own nature, and the vial back. Link Soul to Clarity.'`
- `steeped_soul`: `'Herbs steeped in spirit keep a little of what grew them. On the altar, a vial between a Tea Leaf and a Wildberry tincture fills with Soul. Link Soul, Spring and Clarity across the wall.'`

#### Forge

| key | title | requires | board | unlocks | tokens (solver) |
|---|---|---|---|---|---|
| `late_draw` | The Deeper Aspects | `compound_draw` | `quad('spark', 'soul', 'void', 'mind', [cellAt(2, 2)])` | flag `late_draw` | 9 |
| `golem_walk` | The Walking Clay | `clay_servant`, `late_draw` | `triple('soul', 'drive', 'craft', [cellAt(1, 2), cellAt(3, 2), cellAt(2, 1)])` | flag `golem_walk`, gates `clay_golem` | 8 |
| `steady_tubes` | Steady Tubes | `essentia_tubes`, `void_jar` | `corners('void', 'brook', wall(4))` | flag `steady_tubes` | 7 |
| `steel_rod` | A Steel Rod | `iron_rod`, `late_draw` | `pair('spark', 'vein', wall(0).concat([cellAt(1, 2)]))` | recipe `steel_rod` | 7 |

(The key `steel_rod` is both an entry key and an arcane recipe id, exactly like the existing `bronze_rod` / `iron_rod`
entries and rows. Entry keys and recipe ids live in different maps.)

Texts:

- `late_draw`: `'Three aspects sit under all the others: Spark in the wires, Soul in the living, Void in what is kept and at the bottom of the world. You reach them only through their parts. Once linked, a rod draws them first.'`
- `golem_walk`: `'A servant that only turns a crank has Soul enough to stand. Give it Drive and it walks. On the altar, a clay servant fed Soul and Drive wakes as a Clay Golem. Link Soul, Drive and Craft.'`
- `steady_tubes`: `'Tubes carry essentia in fits and starts. Lined with a breath of Void, they run steady - twice as fast. Link Void to Brook past the wall.'`
- `steel_rod`: `'Steel drinks the deep aspects without cracking: the steel rod draws four units a Use and holds 96 charge. Made at the Rune Desk from the iron rod. Link Spark to Vein.'`

**What each unlock does (behaviour owner in brackets):**

| unlock | behaviour |
|---|---|
| `essence_ward` | (Unit 10) a ward elixir row with `vial_ward` in a vessel slot makes 6 elixirs instead of 4 (`ELIXIR` 4 / 6 per batch). Unit 18 only sets the flag. |
| `aura_dial` | (Unit 19) the HUD aura dial appears while a rod is held. Unit 18 only sets the flag. |
| `essence_study` | (Unit 18) the notebook's Notes tab also lists carried `essence_<buff>` items with `Study <name>` buttons; studying one consumes it, gives `glass_vial` back, adds `ESSENCE_LORE` (section 4.6) and makes those aspects known. |
| `soul_steep`, `soul_steep_cloudy` | (Unit 18) altar infusions that make a `vial_soul` (section 4.5). |
| `late_draw` | (Unit 18) Spark, Soul and Void become drawable, late first (4.2). |
| `golem_walk` | (Unit 17 content, Unit 18 gate) the `clay_golem` infusion can start; Unit 17 may read the flag. |
| `steady_tubes` | (Unit 19) tube flow `TUBE_UPS` 4 -> 8 units/s per network. Unit 18 only sets the flag. |
| `steel_rod` | (Unit 18) the desk row `steel_rod`. |

`unlocks.gates` (NEW optional member of `ResearchEntry.unlocks`): recipe ids from tables owned by other units that this
entry gates. `RESEARCH_GATES` and `unlockedRecipes` include them exactly like `recipes`; the only difference is that the
"every gated recipe exists" test skips `gates` ids. Today only `golem_walk.unlocks.gates = ['clay_golem']`.

Goal impact: `goals()`'s `all_research` counts boards, so it reads `Finish every research (24/32)` for a player who had
finished all 24 boards (24 old boards + 8 new boards; `field_notes` has no board). This is intended: there is more to do.
Its `done` flips back to false for such a player - goals are derived, not saved, so nothing breaks.

### 4.5 New items and recipes

**`steel_rod` (NEW item)** in `MAGIC_ITEMS`, after `iron_rod`:

```ts
tool('steel_rod', 'Steel Gathering Rod', FORGE, 'Draws four units a Use and holds 96 charge for foci. Tuned on a jar, it draws only that aspect.'),
```

`RODS` gains `{ key: 'steel_rod', capacity: 96, draw: 4 }` as the LAST row (`bestRod()` returns the last carried row, so order
is the tier order). Everything that reads `RODS` picks it up (`heldRod`, `bestRod`, foci, charge cap). New exported constant
`MAX_ROD_CAPACITY = Math.max(...RODS.map((r) => r.capacity))` (NEW, `itemsMagic.ts`) replaces the literal `64` in
`Magic.load`.

Icon (`src/render/textures/iconsMagic.ts`): `item_steel_rod: icon((c) => rodOf(c, STEEL_R, P.rgb(0x6ae0ff)))` - the same rod
painter as the iron rod, a darker blue-grey shaft (`STEEL_R`, a new palette constant next to `IRON_R`, e.g. `0x5d6b78` with a
`0x8a99a6` highlight line) and a Spark-blue vial tip (`#6ae0ff`, the Spark aspect colour). `MAGIC_SPEC.textures` 48 -> 49.

Desk row (`ARCANE_RECIPES`, appended):

```ts
arcane('steel_rod', 'steel_rod', '1 iron_rod, 2 steel_ingot, 1 essence_vigor', { spark: 4, vein: 8, mind: 6 }),
```

Cost reasoning: iron rod costs mind 6, vein 6, rune 4; the steel rod is one step up and asks for the new aspect (Spark 4 = one
vial) so it cannot be made before `late_draw` has paid off. `essence_vigor` (Unit 10, Dark Roast boiled down) is the "vigor of
the drinker" in the steel; it is the desk consumer of the essence family required by SYSTEMS T4.

**Infusions (`INFUSIONS`, appended):**

```ts
infuse('soul_steep', 'vial_soul', 'glass_vial', ['tincture_tea_leaves', 'tincture_wildberries'], { spring: 4, mind: 4 }, 12),
infuse('soul_steep_cloudy', 'vial_soul', 'glass_vial', ['tincture_tea_leaves_cloudy', 'tincture_wildberries_cloudy'], { spring: 8, mind: 8 }, 24),
```

The heart (`glass_vial` on the altar) becomes the `vial_soul`; the two tinctures on pedestals are consumed (as every infusion
does today). Cloudy tinctures work at double cost and double time ("cloudy accepted" per UNIT-10). Soul = spring + mind,
so the cost is paid in its parts - no Soul needed to make the first Soul. This is the Bronze-age route to Soul lore (study the
vial) before `late_draw`.

No registry recipe is added: `MAGIC_RECIPE_COUNT` is unchanged (it counts registry rows only).

**Progression solver.** `src/content/progression.ts` already iterates `ARCANE_RECIPES` and `INFUSIONS`; the new rows gain
their outputs only when their inputs are obtainable. No edit. `content.test.ts` must still complete (it does not need magic).

### 4.6 Essence study numbers

`ESSENCE_LORE` (NEW, `magic.ts`): `Record<string, Aspects>` keyed by item:

| essence | lore gained | why |
|---|---|---|
| `essence_spring` | soul 2, spring 3 | Spring buff, growth |
| `essence_hearthkept` | soul 2, cinder 3 | warmth kept |
| `essence_mending` | soul 2, ward 3 | healing, shelter |
| `essence_swift` | soul 2, gale 3 | speed, air |
| `essence_vigor` | soul 2, drive 3 | mining force |
| `essence_lasting` | soul 2, steam 3 | the slow-burning trail blend |

Studying makes each aspect known (as vial study does), `stats.studied++`, gives `glass_vial` back, and returns
`Studied Swift Essence: +2 Soul, +3 Gale lore`.

### 4.7 What this unit does NOT change

`VIAL_UNITS` (4), jar capacities, `DRAW_CAP`, `DRAW_RECOVER_S`, `GATHER_RADIUS`, wellspring generation, existing boards and
entry keys, existing recipes' costs, the altar's payment, `take()`'s behaviour for the altar/servants/siphon.

---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour and rules, with edge cases

### 5.1 Drawing

| situation | result |
|---|---|
| `late_draw` not done, battery room | rod draws primals (compounds with `compound_draw`), never Spark; `rodReading` shows no Spark |
| `late_draw` done, battery room, untuned | Spark first (late-first); toast on each filled vial `Filled a Vial of Spark` (existing string) |
| `late_draw` done, Spark drained (`left < 1`) | falls back to the normal richest aspect (late-first only applies while a late aspect has `left >= 1`) |
| tuned to Cinder in a battery room | Cinder only; when Cinder runs out: `No Cinder left here - the rod is tuned to Cinder (Use it on an empty jar to untune)` |
| tuned to Void, standing beside a Void wellspring? | impossible (no late wellsprings); tuned to Glow beside a Glow wellspring: draws the wellspring (x2) |
| tuned, wellspring of another aspect in reach | the wellspring is ignored; the land is drawn |
| a pen of tame animals walks away mid-draw | `landAspects` is recomputed each Use; `left` drops; the rod refuses when nothing is left (`The land here is drained. Move on, or wait for it to recover`) |
| hostile automaton nearby | counts 0 (`livingNear` skips `mob.hostile`) |
| the rod is full and no empty vial | existing refusal (`The rod is full (96 charge). Carry an empty vial to bottle what it draws`) |

### 5.2 Desk refund

| situation | result |
|---|---|
| no jar in reach, vial over-pays by 2 | row note warns before Make; Make succeeds; 2 lost; toast `... 2 Rune lost, no jar with room in reach` (warn) |
| empty jar within 3 | refund 2 into it; jar text `Essentia Jar - Rune 2/32` |
| jar of Gale in reach, paying Rune | Gale jar ignored for the refund (it is still used to pay Gale costs) |
| jar of Rune 31/32 and an empty jar | 1 into the Rune jar, 1 into the empty jar |
| jar of Rune 31/32, nothing else | 1 refunded, 1 lost; note says so |
| jar tubed to the desk, 20 blocks away | counts (`jarsFor` follows tubes), same as for payment |
| jar paid first, then a vial | the drained jar receives the vial's rest (net: the player pays exactly the cost) |
| void jar | capacity 128 respected |
| cost paid entirely from jars | no vial opened, no note |
| `problem` set (missing ingredients, short essentia, gated) | note is `null`; nothing is planned past `short` |

### 5.3 Research and solvability per age

- Every new board is solvable with aspects that items of its own age provide (test 9.2). Late aspects are anchors only.
- Palette: aspects known with lore > 0 (unchanged). Late lore comes from: scanning `battery` (spark 3), `copper_cable`
  (spark 2), `clay_servant` (soul 4), `hide` / `leather` (soul 1), `crate` / `item_vault` / `tank` (void 2-4), studying late
  vials, studying essences (soul 2 each). None of these are needed to solve the new boards; they are needed to *use* late
  aspects as tokens in a player's own path choices.
- `golem_walk` with Unit 17 unmerged: the entry is solvable and sets the flag; the gate names a recipe that does not exist; the
  altar never matches it. Nothing else happens.
- An old save with all 24 entries done: the new entries appear as `open` where their requires are done (e.g. `late_draw`
  open immediately for a player with `compound_draw`), `locked` otherwise.

### 5.4 Messages (complete list, T8)

| when | text | channel |
|---|---|---|
| rod tuned | `The rod is tuned to Spark - it draws only Spark now` | toast info |
| rod untuned | `The rod is untuned - it draws the richest aspect again` | toast info |
| tune refused (not drawable) | `You cannot draw Spark yet - research "The Deeper Aspects"` / `You cannot draw Vein yet - research "Drawing the Compounds"` | advise |
| tune refused (empty jar, untuned) | `Use the rod on a jar of the aspect you want to draw` | advise |
| tuned aspect exhausted | `No Spark left here - the rod is tuned to Spark (Use it on an empty jar to untune)` | advise |
| desk note | see 4.3 | desk card |
| desk made, refunded | `Made <name> - 2 Rune back into the jar` | toast good |
| desk made, lost | `Made <name> - 2 Rune lost, no jar with room in reach` | toast warn |
| desk made, part | `Made <name> - 1 Rune back into the jar, 1 lost` | toast warn |
| essence studied | `Studied Swift Essence: +2 Soul, +3 Gale lore` | Notes status line |
| essence study before research | `Research "Reading Essences" first` | Notes status line |
| golem infusion before research | `Research "The Walking Clay" in your notebook first` | advise (existing `craftGateReason`) |
| research done (existing) | `Research done: The Deeper Aspects` | toast good |

Plural rule: `1 Rune`, `2 Rune` (aspect names are mass nouns, as in the existing `Not enough essentia: Rune 2`).

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Notebook (phone first)

- **Research tab:** the nine entries appear under their age headings (`Bronze`, `Forge`) by the existing grouping on
  `e.age`; no layout change. The 5 x 5 board with 44 px cells and aspect chips already fits 390 px portrait. Late anchors
  draw with the existing aspect glyphs (`iconsMagic.ts` already paints all 21) and colours (Spark `#6ae0ff`, Soul
  `#ff9ad0`, Void `#3a2a55`). Void's dark colour on the dark board: the builder checks the anchor cell keeps its existing
  light outline (`.hw-nb__cell` anchor style); if contrast is below 3:1 against the cell background, the glyph is drawn with
  the existing light stroke - verify in the phonePortrait screenshot.
- **Notes tab:** under the existing vial study row, when `api.canStudyEssence()` (NEW) is true and essences are carried, a
  second row `Study Swift Essence` buttons (`data-study-essence="essence_swift"`), 44 px, wrapping, preceded by the muted
  line `Studying an essence gives Soul lore and lore of its nature, and the vial back.` When the flag is missing and
  essences are carried, no row (the research text explains it).
- **Goals tab:** unchanged code; the count grows.

### 6.2 Desk screen

- Under each row's chips, when `r.note` is non-null: a `p.hw-nb__muted` (or `.hw-nb__note`, NEW class, same font as muted,
  amber `#e0a060` text when the note contains `lost`) with the note text, `data-note` attribute = row id (for e2e).
- At 390 px the card already wraps chips; the note is one or two lines. No new buttons.

### 6.3 Crosshair (T8)

- `rodReading()` (aura reading) shows late aspects once drawable, e.g. `Spark 3, Loam 6, Vein 4` - no code change, it
  filters by `drawable`. When the rod is tuned, the reading prefixes `Tuned to Spark · ` (NEW, one clause; stays under ~60
  characters with three aspects).
- `jarText` unchanged.

### 6.4 Sound (T9)

No new `SfxName`. Reuse:

| event | sfx | volume tier |
|---|---|---|
| tune / untune | `scan_chime`, pitch 1.6 tune / 1.0 untune | small (default) |
| desk refund | `essentia_pour` at the first refunded jar's centre | small |
| late aspect drawn | `rod_hum` (existing call; pitch already varies with `rod.n`) | - |
| essence studied | none (vial study has none today) | - |

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

### 7.1 TypeScript sketches

```ts
// src/magic/aspectTable.ts (NEW export)
export type LateAspect = 'spark' | 'soul' | 'void';
export const LATE_RULES: Record<string, Partial<Record<LateAspect, number>>> = {
  battery: { spark: 3 }, lithium: { spark: 4 }, cable: { spark: 2 }, solar: { spark: 2 }, generator: { spark: 2 },
  thermopile: { spark: 2 }, electrode: { spark: 2 }, electrolyzer: { spark: 3 }, circuit: { spark: 3 }, coil: { spark: 2 },
  fission: { spark: 4 }, electromagnet: { spark: 3 },
  servant: { soul: 4 }, golem: { soul: 5 }, hide: { soul: 1 }, leather: { soul: 1 }, treadwheel: { soul: 2 },
  vault: { void: 4 }, void: { void: 6 }, tank: { void: 2 }, crate: { void: 2 }, chest: { void: 2 }, corestone: { void: 3 },
  airlock: { void: 2 }, vacuum: { void: 3 }, hatch: { void: 1 },
};

// src/magic/fingerprint.ts (NEW, exported for tests)
export function pinLate(out: Aspects, key: string): Aspects;

// src/magic/entries.ts (changed interface: one optional member)
export interface ResearchEntry {
  key: string; title: string; text: string; age: AgeName; requires: readonly string[]; board: BoardSpec | null;
  unlocks: { recipes?: readonly string[]; flags?: readonly string[]; gates?: readonly string[] };
}

// src/magic/magic.ts
export const SOUL_RADIUS = 6;       // NEW
export const SOUL_PER_LIFE = 4;     // NEW
export const ESSENCE_LORE: Readonly<Record<string, Aspects>> = { /* 4.6 */ };   // NEW
export interface MagicHooks { /* existing */ livingNear?(x: number, y: number, z: number, radius: number): number }  // NEW member
export interface DeskRow { /* existing */ note?: string | null }               // NEW optional member
export interface NotebookApi { /* existing */ canStudyEssence(): boolean; studyEssence(item: string): string }  // NEW members
export interface MagicSnapshot { /* existing */ tuned?: string }               // NEW optional member
class Magic { tuned: Aspect | null = null; /* NEW public field, read by rodReading and tests */ }

// src/content/itemsMagic.ts
export const MAX_ROD_CAPACITY = Math.max(...RODS.map((r) => r.capacity)); // NEW (96)
```

### 7.2 Save rules (T10)

- `MagicSnapshot.v` stays `1`. `tuned` is written only when non-null. `load`: `this.tuned = typeof s.tuned === 'string' &&
  isAspect(s.tuned) ? s.tuned : null` (a tuned aspect that is no longer drawable is kept; gathering re-checks `drawable` and
  refuses with the tune-refusal text - it does not silently untune).
- `charge` clamp: `Math.min(MAX_ROD_CAPACITY, s.charge)`; `tick` already clamps to the best carried rod.
- Research: entries are saved by key in `ResearchState.entries`; `sanitizeResearch` keeps keys that `researchEntry(k)` finds,
  so new keys load from new saves and are simply absent from old ones (status computed). No migration.
- Jars: refunds write through `setJar`, saved as today.
- Old-save test: load a `MagicSnapshot` literal without `tuned`, with `charge: 80` and research entries for the old 24 only:
  `tuned === null`, `charge === 80` (not clamped to 64 any more), `entryStatus(late_draw)` is `open` when `compound_draw` was
  done.

---------------------------------------------------------------------------------------------------------------------------
