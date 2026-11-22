# Unit 10 - Potions, spirits and bandage

Status: build spec, written 2026-11-22 against `docs/build/SYSTEMS.md` (binding) and `docs/build/UNIT-00-foundations.md` (the
reaction engine this unit fills). Wave 2: builds after Unit 0 and Unit 8 have merged (it needs the vacuum cap/pump and the filter
bed). Where this file and SYSTEMS.md disagree, SYSTEMS.md wins and the coordinator fixes this file; every place this spec bends a
SYSTEMS number says so in a sentence and is repeated in section 14.

**Threads:** T3 (fluids and containers: spirit drunk from its beaker, the glass vial as the potion bottle, the `elixir_` /
`tincture_` / `essence_` naming rule), T4 (material web: essences, tinctures, elixirs, glowcap draught, bandage, each with a
producer and consumers), T5 (bodies and buffs: elixirs x3 time in their family slot, new `tonic` family with `night_sight`, Warmed
+ Tipsy + Blurred, heal-over-time), T10 (optional `BuffsSnapshot.tipsyS` / `blurredS`, optional `SurvivalSnapshot.mendHp` /
`mendS`). It also reads T1 (heat: reactions draw `REACT_HEAT_W` from the base or burner), T7 (side goal `bottle_elixir`, gate
table), T8 (crosshair and toast grammar) and T9 (sounds and the visual vocabulary).

Legend: names marked **NEW** do not exist in the code today; everything unmarked was grepped and exists at the path given. Names
marked **(Unit 0)** / **(Unit 5)** / **(Unit 8)** / **(Unit 12)** are defined by that unit's spec and assumed merged.

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

Brewing gave the player six cups: three minutes of Spring, Swift or Mending, drunk at the hearth before a trip. The distillery gave
the player glass, heat and vacuum. This unit marries them. The player who has both learns to **concentrate** a brew: four cups of
Light Roast boiled down gently under a vacuum pump into one vial of Swift Essence; a handful of glowcaps steeped warm in spirit,
then run through charcoal until the tincture turns clear; the two blended with pine syrup into four corked **elixirs**, each one
nine minutes of Swift instead of three. A cave expedition now starts with a **Glowcap Draught** (five minutes of night sight, the
dark turned a soft blue-green), a Swift Elixir and a stack of **bandages** cut from cloth soaked in the spirit the same still made.
And the spirit itself, the first real product of the pot still, finally has a use in the hand: a swig warms you like the fire does
(Well-Warmed, five minutes) and leaves you a little **Tipsy** - the world sways by 0.6 degrees and your fists hit 10% harder for
two minutes. A second swig while tipsy blurs the edges of the screen and slows you down for twenty seconds: the game's gentle "that
is enough".

What it feels like, in order of the player's day:

1. *Ember, first spirit.* "Run your first spirit" (Unit 12) gives a beaker of Spirit. Use it in the open air: the toast reads
   `"Warmed and Tipsy: warm for 5 min, hits 10% harder for 2 min"`, the HUD gains a flame pill and a cup pill, the horizon rocks.
2. *Ember, first wound.* At the workbench: 1 Spirit + 2 Cloth = 4 Bandages and the beaker back. Hurt by a Cinder Mite, the player
   Uses a bandage: 6 health come back over 12 s, the health bar pulses "+".
3. *Ember -> Bronze, the tincture.* Glowcaps from the cave floor + a beaker of Spirit + an empty vial in a Reaction Vessel on a
   still base set to 50 C: a Cloudy Glowcap Tincture. Use it on a Filter Bed loaded with charcoal: it comes back clear.
4. *Bronze, the essence.* Four cups of Light Roast + a vial + a beaker of water in a vessel whose stack carries a Vacuum Cap, a
   Vacuum Pump turning at 16 rpm beside it, base at 60 C. The water is drawn off as vapour, the vial fills: Swift Essence.
5. *Bronze, the elixir.* Essence + clear tincture + two empty vials + a beaker of syrup, stirred or warmed: four Swift Elixirs. The
   HUD reads `Swift 9:00`. Side goal "Bottle an elixir".

The design rule that keeps this congruent: **nothing here is a new kind of buff strength.** SYSTEMS T5 is explicit - "stronger"
means "longer". Elixirs use the same six `DrinkBuff`s, the same family slots, the same refresh rule (`Buffs.grant`). The only new
body states are the ones SYSTEMS names: `night_sight` (family `tonic`), `tipsy` (with its `blurred` tail) and a heal-over-time
that is not a buff at all.

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 Threads

| thread | what this unit reads | what this unit defines |
|---|---|---|
| T3 | `CHEM_CONTAINERS` (`spirit_beaker` 250 L spirit, `syrup_beaker` 250 L syrup, `water_beaker` / `water_pail` water), `EMPTY_BEAKER` `'glass_beaker'`, `glass_vial` (src/content/itemsMagic.ts:45), rule 4 (no `vial_<x>` for potions) | item keys `essence_<buff>` x6, `tincture_<herb>` x4, `tincture_<herb>_cloudy` x4, `elixir_<buff>` x6, `glowcap_draught`, `bandage`. The glass vial is the potion bottle and always comes back (drinking returns it). No new `FluidKey`, no new `Component`, no new grade: potions are ITEMS, made by reactions; litres stay in the vessel. |
| T4 | Unit 0 reaction engine (`ReactionSpec`, vessel slots, `gives`), Unit 8 `filter_bed`, Unit 5 `sugars` / `SWEETENED`, Unit 12 `chem_stirrer` (`stirred`) | the potion rows of the T4 table, each with producer and consumers (section 4.6) |
| T5 | `Buffs.grant`, `DrinkGrant`, `DRINK_BUFFS`, `DRINK_BUFF_KEYS`, `Buffs.wellWarmedS`, `WELL_WARMED_DURATION_S` 300, `Buffs.speedMult`, `MAX_HEALTH` 20 | `ELIXIR_BUFF_S` 540, `NIGHT_SIGHT_S` 300, `TIPSY_S` 120, `BLURRED_S` 20, `TIPSY_MELEE_MULT` 1.1, `BLURRED_SPEED_MULT` 0.9, `TIPSY_SWAY_DEG` 0.6, `SPIRIT_WARMED_S` 300, `BANDAGE_HP` 6, `BANDAGE_S` 12; `DrinkBuff` + `'night_sight'`, `DrinkFamily` + `'tonic'`, `BuffName` + `'tipsy'`; getters `meleeMult`, `nightSight`, `swayDeg`, `blurred`; `Survival.healOverTime(hp, seconds)` |
| T10 | `BuffsSnapshot`, `SurvivalSnapshot`, `Buffs.load` sanitising with `finite()` | optional `BuffsSnapshot.tipsyS?`, `BuffsSnapshot.blurredS?`; optional `SurvivalSnapshot.mendHp?`, `SurvivalSnapshot.mendS?`; `drinks.night_sight` rides the existing `drinks` record (no new field) |
| T1 | Unit 0 `REACT_HEAT_W` 2000 W drawn while a heated reaction runs; Unit 7 burner caps (charcoal 250 C ... ) | nothing new: every potion row sits at or under 80 C, so a charcoal burner in the field can run all of them |
| T7 | Unit 0 side-goal mechanism, gating table (bandage/spirit/cloudy tincture = ember; essences/clear tinctures/elixirs = bronze) | side goal `bottle_elixir` "Bottle an elixir", flag `bottled_elixir` |
| T8 | Unit 0 vessel line phrases (`needs 4 Light Roast`, `output slots full - take the finished items out`, `ruined - pour it out`) | potion reaction `verb`/`done` words, drink toasts, refusal sentences, filter bed line |
| T9 | `sip` (exists), `drip` (exists), `pour` (exists), `glass_chime` (Unit 12, optional) | no new `SfxName` (section 6.6 argues why) |

### 2.2 Contracts with other units

| other unit | what Unit 10 needs from it | fallback if it is not merged / named differently |
|---|---|---|
| **0** reaction engine | `ReactionSpec` (with Unit 0's optional `verb`, `done`, `flag`), `REACTIONS` array in `src/content/reactionsDistill.ts`, input slots `items`, output slots `out`, `VESSEL_SLOTS`, items consumed at batch completion, `gasLoss` (0..0.5), vessel temperature capped at `bubblePoint x BP_MULT` | none: Unit 10 is Wave 2 and cannot start without it |
| **0** slot count | **`VESSEL_SLOTS` raised from 4 to 6.** An essence batch holds four cups (each `stack: 1`) and one empty vial = five stacks; SYSTEMS J2 step 1 and the T4 row both say so. Unit 0's arrays are already length `VESSEL_SLOTS` and its sanitiser pads/truncates, so the change is one constant; old saves with 4-length arrays pad to 6. | If the coordinator keeps 4: essences take 3 cups (rows' `items` count 3) and the T4 row is amended. This is the ONLY fallback; do not invent a "pot of coffee" intermediate. |
| **0** research gate | ONE optional member on `ReactionSpec`: `research?: string` (a row that runs only when `Distillery.researched?.(flag)` is true), and the hook `Distillery.researched: ((flag: string) => boolean) \| null`, Game-wired to the magic research flags. Needed for `essence_ward` (Unit 18). SYSTEMS 6.5 allows optional members. | If Unit 0 already merged without it, Unit 10 adds the member and the hook itself (2 lines in `chooseReaction`, 1 in Game). |
| **8** vacuum | capability `vacuum` on a vessel whose stack carries a `vacuum_cap` that a turning `vacuum_pump` (>= 16 rpm) pulls on; Unit 0's vessel temperature then caps water at 100 x 0.7 = 70 C | none (Wave 2) |
| **8** filter bed | the `filter_bed` block (`CHEM.filter`), its single load slot. Unit 10 adds `charcoal` as a second accepted load beside Unit 8's `clay` (one row in Unit 8's load table, or a one-line `||` if Unit 8 hard-coded clay) | if Unit 8's bed has no load slot API, Unit 10 reads the slot through `Distillery.slotsOf(x,y,z)` (Unit 0) |
| **5** sugar | `sugars` component (exists in `COMPONENTS`); Unit 5's `CHEM_SOLIDS.sugar` (25 L sugars per sugar item put in a vessel) is a second way to feed the elixir base; Unit 5's `SWEETENED` table (base drink key -> sweet key) | without Unit 5 there are simply no sweet essence rows |
| **12** stirrer | capability `stirred` (speed-up x2 on elixir rows); `glass_chime` sfx on a batch done | elixirs still run heated or cold, just slower |
| **17** golem | reads `elixir_*` (feeding a golem an elixir: 2x pace 5 min) and `bandage` (repairs a golem) by key | none needed by Unit 10 |
| **18** research | sets flag `essence_ward`; Unit 10's ward rows read it through `Distillery.researched` | flag never set = ward rows never run |
| **2** six_cups | the `six_cups` check must count only the six base cups (Unit 5 changes it to base drinks; section 5.9 makes it robust to elixirs too) | Unit 10 makes the change if neither has |

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code (grepped 2026-11-22)

| file | what is there | what Unit 10 changes |
|---|---|---|
| `src/core/types.ts:139-157` | `type DrinkBuff = 'spring' \| 'hearthkept' \| 'mending' \| 'swift' \| 'vigor' \| 'lasting'`; `type DrinkFamily = 'tea' \| 'coffee'`; `interface DrinkSpec { buff; family; buffS; colour; warmth?; hunger? }`; `CoolsSpec`; `ItemSpec.drink?`, `ItemSpec.food?` | `DrinkBuff` + `'night_sight'`; `DrinkFamily` + `'tonic'`; `DrinkSpec.returns?` **NEW**; `ItemSpec.spirit?: SpiritSpec` **NEW**; `ItemSpec.heal?: HealSpec` **NEW** |
| `src/core/gameEvents.ts:151` | `type BuffName = 'well_warmed' \| 'well_fed' \| 'sugar_rush' \| DrinkBuff`; `'buff:gained'`, `'player:drank'` events; `SfxName` has `'sip'`, `'drip'`, `'pour'` | `BuffName` + `'tipsy'` (night_sight arrives via `DrinkBuff`); event `'player:bandaged'` **NEW** `{ hp: number; seconds: number }` |
| `src/core/brewing.ts` | `CUP_ITEM = 'clay_cup'`; `DRINK_BUFFS: Record<DrinkBuff, DrinkBuffText>` (`name`, `family`, `effect`); `DRINK_BUFF_KEYS` (six) | `DRINK_BUFFS.night_sight` row; `DRINK_BUFF_KEYS` + `'night_sight'` (last); `CUP_BUFFS` **NEW** (the six cup buffs, for `six_cups` and validation) |
| `src/core/constants.ts:325-345` | `DRINK_BUFF_S` 180, `DRINK_COOLDOWN_S` 1, `SPRING_JUMP_MULT` 1.35, `HEARTHKEPT_DRAIN_MULT` 0.5, `HEARTHKEPT_DRINK_WARMTH` 10, `MENDING_REGEN_MULT` 2, `SWIFT_SPEED_MULT` 1.2, `VIGOR_MINING_MULT` 1.25, `LASTING_DRAIN_MULT` 0.5, `FLAG_SIX_CUPS`; `WELL_WARMED_DURATION_S` 300 (line 65); `MAX_HEALTH` 20 (line 45) | a "potions and spirits (Unit 10)" block of constants (section 7.1) |
| `src/game/buffs.ts` | class `Buffs` with `wellWarmedS`, `wellFedS`, `sugarS`, private `slots: Record<DrinkFamily, DrinkSlot>` = `{ tea, coffee }`, `FAMILIES = ['tea','coffee']`, `grant(buff, seconds): DrinkGrant` (refresh never shortens, same family replaces), `tick`, `clear`, `active()`, getters `jumpMult`, `speedMult` (Swift x Sugar), `miningMult`, `warmthDrainMult`, `regenMult`, `foodDrainMult`; `toJSON`/`load` with `finite()` | `tonic` slot; `tipsyS`, `blurredS` fields; `drinkSpirit()` timer logic `takeSpirit(): SpiritGrant` **NEW**; getters `meleeMult`, `nightSight`, `swayDeg`, `blurred` **NEW**; `speedMult` gains the Blurred factor; save fields |
| `src/game/drink.ts` | `drink(player, slot)`: removes one, puts `CUP_ITEM` back, `buffs.grant`, warmth/hunger, `DRINK_COOLDOWN_S`, `stats.drunk`, `six_cups` check `DRINKS.every((d) => drunk[d.key])`, events `player:drank`, `buff:gained`, toast `"<Name> replaces <Old>"` or `"<Name>: <effect>"`, sfx `sip`; `drinkRefusal`; `coolStack`/`coolCarried` | container back = `spec.returns ?? CUP_ITEM`; elixir/draught toasts with the time; `six_cups` restricted to cup buffs; `drinkSpirit(player, slot)` **NEW**; `applyBandage(player, survival, slot)` **NEW** (in a new file, section 8) |
| `src/player/interaction.ts:255-263` | Use dispatch: canister refuel, then `if (itemOrNull(held.item)?.drink) return this.drinkHeld();`, then food | two branches after drink: `spirit` -> `drinkSpiritHeld()`, `heal` -> `bandageHeld()`; block-targeted uses (chem pour) are earlier in the chain, so Use of a Spirit beaker on a vessel still POURS |
| `src/game/survival.ts` | `SurvivalSnapshot { nearFurnaceS, coldS, drownAcc, contactAcc, radiationS, regenS, starveS? }`; `tickRegen` (1 HP per `REGEN_INTERVAL_S` 4 s when quiet, warm, fed); `respawn()` resets timers; Well-Warmed timer counted at line 337 | `healOverTime(hp, seconds): boolean` **NEW**, `mendHp`/`mendS` private + saved optional; `tickMend(dt)` **NEW**; reset on respawn |
| `src/game/playerState.ts:360` | `heal(amount)` clamps to `MAX_HEALTH`; `stats.drunk?: Record<string, number>` | none (reused) |
| `src/player/animals.ts:65` | `strike()`: `this.animals.hit(this.target, hitDamage(item), ...)` | damage x `player.buffs.meleeMult` |
| `src/player/physics.ts:141` | `speed = (...) * p.buffs.speedMult * ...` | none: Blurred lives inside `speedMult` (section 5.5) |
| `src/ui/hud/vitals.ts` | `BuffPill(kind, glyph)`; pills `burn`, `warm` (flame), `fed` (bowl), `sugar` (hourglass); `drinkPills` built from `DRINK_BUFF_KEYS` + `DRINK_GLYPHS` | a `tipsy` pill (glyph `cup`) after the drink pills; night sight appears automatically as a drink pill (glyph `moon`); "+" pulse on the health vital |
| `src/ui/hud/drinkBuffs.ts` | `DRINK_GLYPHS: Record<DrinkBuff, GlyphName>`, `drinkChips`, `chipDensity` | `DRINK_GLYPHS.night_sight = 'moon'` |
| `src/ui/kit/icons.ts` | glyphs incl. `moon`, `cup`, `heart`, `flame` | none |
| `src/render/renderer.ts:285` | shared uniforms `u.uSkyLight` from `sky.skyLight`; `lightColor(...)` for probes | `uNightSight` uniform **NEW** (section 6.5); camera roll for sway |
| `src/content/itemsBrew.ts` | helper `drink(key, name, desc, spec)` (stack 1, `buffS: DRINK_BUFF_S`), six cups | none (potions live in a new file) |
| `src/content/itemsDistill.ts:16` | `spirit_beaker` 'Spirit', "A beaker of clear distilled spirit, more than half alcohol." `stack: 16`, age 0 | adds `spirit` field and a description naming the drink and the bandage |
| `src/content/itemsMagic.ts:45` | `glass_vial` 'Glass Vial', stack 16, age 0; forge `2 glass_vial <- 1 glass` 650 C (recipesMagic.ts:21) | none (reused as the potion bottle) |
| `src/content/itemsHand.ts:48` | `cloth` | none (bandage input) |
| `src/content/blocksWorld.ts:41` | block `glowcap` (its item is generated, key `glowcap`), woodland and cave floors | none (tincture herb) |
| `src/content/items.ts:231` | `wildberries` (food 2) | none (tincture herb) |
| `src/content/itemsBrew.ts` | `tea_leaves`, `coffee_cherries` (resources) | none (tincture herbs) |
| `src/core/chem.ts` | 12 components incl. `ethanol`, `water`, `sugars`; `GRADES` (`spirit` needs ethanol >= 0.58, mix ethanol .65 water .32 fusel .02 methanol .01; `syrup` sugars .65) | none |
| `src/core/distill.ts` | `STILL_SETPOINTS = [78, 92, 97, 130, 200, 260, 350, 420]`, `CHEM_CONTAINERS` | `STILL_SETPOINTS` gains **50** and **60** at the front (section 5.2) |
| `scripts/e2e-distill.mjs` | steps "a new world loads into play" ... "no console errors during the run"; uses `window.__hw.app.game.state.sim`, `window.__hw.tick`, `getBlock` | four new steps (section 10) |

Not in the code: any reaction (Unit 0 adds the engine), `vacuum_cap`, `vacuum_pump`, `filter_bed` (Unit 8), `chem_stirrer`
(Unit 12), `objectivesSide.ts` (Unit 0).

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 Three processes, three rigs (each a different capability)

DISTILLERY_PLAN 8 asked that "the advanced recipes are longer graphs, each step a different rig". Unit 10 keeps that:

| step | rig (smallest form) | capability | window | ruin | why this rig |
|---|---|---|---|---|---|
| **Essence** | still base -> reaction vessel, `vacuum_cap` on the vessel's stack, `vacuum_pump` touching the cap and turning >= 16 rpm | `heated` + `vacuum` | 50-80 C | above 80 C | Drink actives cook above 80 C (SYSTEMS 5.1). Under vacuum water "boils" at 70 C (Unit 0 caps the vessel at `bp x BP_MULT.vacuum` = 70), so the water can be drawn off without cooking the brew. Without the pump the base must be set to 60 to be safe, and the row does not run at all (it needs `vacuum`). |
| **Tincture (cloudy)** | still base (or Unit 7 burner) -> reaction vessel | `heated` | 45-60 C | above 75 C | Maceration (SYSTEMS 5.1: 45-60). Spirit's own bubble point is about 82 C, so a base left at 78 or 92 heats the vessel past 75 and stews the herbs: the player must learn the new 50 C setpoint. |
| **Clearing** | `filter_bed` loaded with charcoal (Unit 8 block) | none | - | - | DISTILLERY_PLAN 4 "Polishing line ... cloudy to clear". One Use clears up to 4 held vials and eats one charcoal. |
| **Elixir / draught** | reaction vessel, stirred (Unit 12) or heated or neither | none required; `stirred` x2, `heated` x1.5 | 15-70 C | above 80 C | SYSTEMS J2 "stirred vessel ... or heated vessel". `needs: []` makes a plain cold vessel work too (slowly, 120 s), so the product never depends on Unit 12. |

All four sit at or under 80 C, under every burner cap (charcoal 250 C): the whole chain works far from the furnace (T1).

### 4.2 The full roster

Ages are written `ageIndexOf('<name>')` (src/magic/ageMap.ts); "bronze" equals ember today and moves by itself when W0 lands.
Every vial item is `stack: 16` (SYSTEMS T4 "vials of potion 16"); the bandage is 16 (T4 row). Drinkables return their container
to the same slot when the stack was 1, otherwise into the pack (exactly what `drink()` does for cups today).

#### 4.2.1 Essences (6) - intermediate

| id | display name | tooltip (`desc`) | age | stack | made by | consumed by |
|---|---|---|---|---|---|---|
| `essence_spring` | Spring Essence | "Four cups of Green Tea boiled down under vacuum. Blend it with a clear Tea Leaf Tincture and syrup for Spring Elixirs." | bronze | 16 | `rx_essence_spring`: 4 `green_tea` + 1 `glass_vial` + water, vacuum, 50-80 C | `rx_elixir_spring`; rune desk research (Unit 18 M6) |
| `essence_hearthkept` | Hearthkept Essence | "Four cups of Black Tea boiled down under vacuum. Blend it with a clear Tea Leaf Tincture and syrup for Hearthkept Elixirs." | bronze | 16 | `rx_essence_hearthkept`: 4 `black_tea_cup` | `rx_elixir_hearthkept`; Unit 18 |
| `essence_mending` | Mending Essence | "Four cups of Berry Tea boiled down under vacuum. Blend it with a clear Wildberry Tincture and syrup for Mending Elixirs." | bronze | 16 | `rx_essence_mending`: 4 `berry_tea` | `rx_elixir_mending`; Unit 18 |
| `essence_swift` | Swift Essence | "Four cups of Light Roast boiled down under vacuum. Blend it with a clear Coffee Cherry Tincture and syrup for Swift Elixirs." | bronze | 16 | `rx_essence_swift`: 4 `light_roast` | `rx_elixir_swift`; Unit 18 |
| `essence_vigor` | Vigor Essence | "Four cups of Dark Roast boiled down under vacuum. Blend it with a clear Coffee Cherry Tincture and syrup for Vigor Elixirs." | bronze | 16 | `rx_essence_vigor`: 4 `dark_roast` | `rx_elixir_vigor`; Unit 18 |
| `essence_lasting` | Lasting Essence | "Four cups of Trail Blend boiled down under vacuum. Blend it with a clear Coffee Cherry Tincture and syrup for Lasting Elixirs." | bronze | 16 | `rx_essence_lasting`: 4 `trail_blend_cup` | `rx_elixir_lasting`; Unit 18 |

Essences are not drinkable (no `drink` field): they are too strong to sip and exist to be blended. Using one in the air does
nothing (falls through Use like any material). Category `'material'`. Icon: `item_essence` tinted by the buff colour (section 6.4).

Sweet cups (Unit 5): for every pair in `SWEETENED` (base -> `sweet_<base>`), Unit 10 generates `rx_essence_<buff>_sweet` with
`items: 4 sweet_<base>` and the same output. A sweet cup gives no better essence (sweetness is a sugar effect, not a buff
strength); the row exists so a player holding sweet cups is not stuck. Mixed stacks (2 sweet + 2 plain) do not combine: the line
says `needs 4 Light Roast` (Unit 0 nearest-miss text names the first row).

#### 4.2.2 Tinctures (4 herbs x cloudy/clear = 8) - intermediate

| id | display name | tooltip | age | stack | made by | consumed by |
|---|---|---|---|---|---|---|
| `tincture_glowcap_cloudy` | Cloudy Glowcap Tincture | "Glowcaps steeped warm in spirit. Run it through a Filter Bed of charcoal to clear it." | ember | 16 | `rx_tincture_glowcap`: 4 `glowcap` + 1 `glass_vial` + spirit, heated 45-60 C | filter bed (charcoal) -> clear; infusion altar ingredient (Unit 18, cloudy accepted) |
| `tincture_glowcap` | Glowcap Tincture | "A clear blue-green tincture of glowcaps. Blend two with syrup for Glowcap Draughts." | bronze | 16 | filter bed on the cloudy one | `rx_glowcap_draught`; infusion altar (Unit 18) |
| `tincture_wildberries_cloudy` | Cloudy Wildberry Tincture | "Wildberries steeped warm in spirit. Run it through a Filter Bed of charcoal to clear it." | ember | 16 | `rx_tincture_wildberries`: 4 `wildberries` | filter bed; Unit 18 |
| `tincture_wildberries` | Wildberry Tincture | "A clear red tincture of wildberries. Blend it with Mending Essence and syrup." | bronze | 16 | filter bed | `rx_elixir_mending`; Unit 18 |
| `tincture_tea_leaves_cloudy` | Cloudy Tea Leaf Tincture | "Fresh tea leaves steeped warm in spirit. Run it through a Filter Bed of charcoal to clear it." | ember | 16 | `rx_tincture_tea_leaves`: 4 `tea_leaves` | filter bed; Unit 18 |
| `tincture_tea_leaves` | Tea Leaf Tincture | "A clear green tincture of tea leaves. Blend it with Spring or Hearthkept Essence and syrup." | bronze | 16 | filter bed | `rx_elixir_spring`, `rx_elixir_hearthkept`; Unit 18 |
| `tincture_coffee_cherries_cloudy` | Cloudy Coffee Cherry Tincture | "Coffee cherries steeped warm in spirit. Run it through a Filter Bed of charcoal to clear it." | ember | 16 | `rx_tincture_coffee_cherries`: 4 `coffee_cherries` | filter bed; Unit 18 |
| `tincture_coffee_cherries` | Coffee Cherry Tincture | "A clear brown tincture of coffee cherries. Blend it with Swift, Vigor or Lasting Essence and syrup." | bronze | 16 | filter bed | `rx_elixir_swift`, `rx_elixir_vigor`, `rx_elixir_lasting`; Unit 18 |

Key choice: SYSTEMS T4 names the family `tincture_<herb>`; the clear one is the canonical `tincture_<herb>` (it is what elixirs,
Unit 18 and the codex name), and the cloudy stage carries the suffix `_cloudy` (T4 "ember (cloudy) / bronze (clear)"). The herb
part is the herb's real item key (`tea_leaves`, `coffee_cherries`, `wildberries`, `glowcap`), so a table drives everything.

Herbs are raw, not processed: fresh tea leaves (not dried tea) and raw cherries (not roasted beans). Reason: the tincture is the
herb's *other* life - an Ember player who has picked a bush but has no furnace-dried tea still has a use for leaves, and a
glowcap gets its first consumer beyond decoration (T4: glowcap had none).

#### 4.2.3 Elixirs (6) and the Glowcap Draught - end products (drinks)

| id | display name | tooltip | age | stack | container back | made by | buff | magnitude | duration | family |
|---|---|---|---|---|---|---|---|---|---|---|
| `elixir_spring` | Spring Elixir | "Spring, bottled. You jump 35% higher for nine minutes. Returns the vial." | bronze | 16 | `glass_vial` | `rx_elixir_spring` | `spring` | `SPRING_JUMP_MULT` 1.35 | `ELIXIR_BUFF_S` 540 | tea |
| `elixir_hearthkept` | Hearthkept Elixir | "Hearthkept, bottled. The cold drains your warmth half as fast for nine minutes, and you are warmed at once. Returns the vial." | bronze | 16 | `glass_vial` | `rx_elixir_hearthkept` | `hearthkept` | `HEARTHKEPT_DRAIN_MULT` 0.5, +`HEARTHKEPT_DRINK_WARMTH` 10 warmth | 540 | tea |
| `elixir_mending` | Mending Elixir | "Mending, bottled. You heal twice as fast for nine minutes. Returns the vial." | bronze | 16 | `glass_vial` | `rx_elixir_mending` | `mending` | `MENDING_REGEN_MULT` 2 | 540 | tea |
| `elixir_swift` | Swift Elixir | "Swift, bottled. You walk, sprint and swim 20% faster for nine minutes. Returns the vial." | bronze | 16 | `glass_vial` | `rx_elixir_swift` | `swift` | `SWIFT_SPEED_MULT` 1.2 | 540 | coffee |
| `elixir_vigor` | Vigor Elixir | "Vigor, bottled. You mine 25% faster for nine minutes. Returns the vial." | bronze | 16 | `glass_vial` | `rx_elixir_vigor` | `vigor` | `VIGOR_MINING_MULT` 1.25 | 540 | coffee |
| `elixir_lasting` | Lasting Elixir | "Lasting, bottled. Hunger comes half as fast for nine minutes. Returns the vial." | bronze | 16 | `glass_vial` | `rx_elixir_lasting` | `lasting` | `LASTING_DRAIN_MULT` 0.5 | 540 | coffee |
| `glowcap_draught` | Glowcap Draught | "A cool blue-green draught. Night Sight: the dark lifts for five minutes, in caves and under the night sky. Returns the vial." | bronze | 16 | `glass_vial` | `rx_glowcap_draught` | `night_sight` | sight floor `NIGHT_SIGHT_LIGHT` 0.45 (section 6.5) | `NIGHT_SIGHT_S` 300 | tonic |

Numbers in tooltips are generated from the constants (the same `pct()` approach `DRINK_BUFFS` uses) so a balance edit cannot leave
a stale tooltip; the test in 9.1 checks every elixir tooltip contains its buff's effect number.

Why `glowcap_draught` and not `elixir_night_sight`: SYSTEMS T4 and 6.2 name it `glowcap_draught`; it has no essence (there is no
night-sight cup), so it is a draught, not an elixir. Duration 300 s (SYSTEMS T5), a deliberate middle: a cave dive, not a whole
night.

Stacking (T5): an elixir grants the existing drink buff through `Buffs.grant(buff, ELIXIR_BUFF_S)`. Same buff running: refreshed
to `max(left, 540)`, never shortened (a cup drunk while an elixir runs does nothing to the timer and the toast says so, section
5.1). Other buff of the same family: replaces it ("Swift replaces Vigor"). The draught lives in its own `tonic` slot and never
displaces a tea or coffee buff.

#### 4.2.4 Spirit as a drink (existing item, new use)

| id | display name | new tooltip | age | stack | container back | effect | duration | stacking |
|---|---|---|---|---|---|---|---|---|
| `spirit_beaker` (exists) | Spirit | "A beaker of clear distilled spirit, more than half alcohol. Drink it to warm up (5 min) and feel Tipsy, pour it into a still, or soak cloth in it for bandages." | ember | 16 (unchanged) | `glass_beaker` | **Warmed**: `wellWarmedS = max(wellWarmedS, SPIRIT_WARMED_S 300)` (the fire's buff, same field the hearth sets). **Tipsy**: `tipsyS = TIPSY_S` 120: melee x`TIPSY_MELEE_MULT` 1.1, camera roll sway amplitude `TIPSY_SWAY_DEG` 0.6 deg. | Warmed 300 s, Tipsy 120 s | Warmed refreshes (max). Tipsy refreshes to 120. **Drinking while Tipsy** (`tipsyS > 0` before the drink) also sets `blurredS = BLURRED_S` 20 (soft vignette, speed x`BLURRED_SPEED_MULT` 0.9). |

Spirit is drinkable straight from the 250 L beaker (one "swig" empties it; the litres are a fiction of the container, not a dose).
`fuel_ethanol_beaker` and `low_wines_beaker` are NOT drinkable: fuel ethanol is poison-strong (the tooltip already says it is a
fuel), and low wines are a half product. Keeping one drinkable spirit keeps the lesson clean: run it twice, then drink it.
DISTILLERY_PLAN's "Rough Spirit (heads kept)" is out of scope (section 13).

Hunger: spirit restores nothing (no `hunger`). Warmth: no instant warmth (Black Tea owns the instant +10); the Well-Warmed buff
already halves the cold's drain (`WELL_WARMED_DRAIN_FACTOR` 0.5 in survival.ts).

#### 4.2.5 Bandage

| id | display name | tooltip | age | stack | recipe | effect | stacking |
|---|---|---|---|---|---|---|---|
| `bandage` | Bandage | "Cloth soaked in spirit. Use it to heal 6 health over 12 seconds." | ember | 16 | workbench `bandage`: 1 `spirit_beaker` + 2 `cloth` -> 4 `bandage`, byproducts 1 `glass_beaker` (SYSTEMS T4). Second route `bandage_ethanol`: 1 `fuel_ethanol_beaker` + 2 `cloth` -> 6 `bandage`, byproducts 1 `glass_beaker` (age forge: fuel ethanol is a forge item; DISTILLERY_PLAN 8 "fuel_ethanol + cloth -> bandage") | `Survival.healOverTime(BANDAGE_HP 6, BANDAGE_S 12)`: 1 HP every 2 s | not a buff. Refused while a bandage is still healing (section 5.6). |

Why 6 over 12: SYSTEMS 5.2. 6 HP is 30% of `MAX_HEALTH` 20, three Cinder Mite bites; 12 s is long enough that it is no combat
potion (Tipsy's melee is a joke, not a system, SYSTEMS 1.1) but short enough to matter after a fall. Natural regen gives 1 HP per
4 s only when warm, fed and quiet; a bandage works cold, hungry and mid-fight - that is its whole value.

### 4.3 Reaction rows (exact)

All rows go in **NEW** `src/content/reactionsPotions.ts`, exported as `POTION_REACTIONS: ReactionSpec[]` and appended to
`REACTIONS` in `src/content/reactionsDistill.ts` (Unit 0's file; one import + one spread line). Rows are generated from tables,
not hand-written 30 times.

```ts
// src/content/reactionsPotions.ts (NEW)
import { ageIndexOf } from '../magic/ageMap';
import type { ReactionSpec } from '../core/reactions';
import { ESSENCE_SOURCES, TINCTURE_HERBS, ELIXIR_TINCTURE, POTION_FLAG } from './itemsPotions';

/** Essence: 4 cups of a buff + 1 empty vial, rinsed in water and boiled down under vacuum. */
const essenceRow = (buff: string, cup: string, suffix = ''): ReactionSpec => ({
  key: `rx_essence_${buff}${suffix}`, name: `${cap(buff)} essence`,
  in: { water: 1 }, out: { water: 0.5 }, gasLoss: 0.5,      // half the rinse water is drawn off by the pump
  items: [{ item: cup, count: 4 }, { item: 'glass_vial', count: 1 }],
  gives: [{ item: `essence_${buff}`, count: 1 }, { item: 'clay_cup', count: 4 }],
  needs: ['heated', 'vacuum'], tempC: [50, 80], ruinC: 80,
  batchL: 250, seconds: 60, age: ageIndexOf('bronze'),
  verb: 'concentrating', done: 'Essence done',
});

/** Tincture (cloudy): 4 herbs + 1 empty vial steeped warm in spirit. The spirit's ethanol goes into the herbs; their water stays. */
const tinctureRow = (herb: string): ReactionSpec => ({
  key: `rx_tincture_${herb}`, name: `${herbName(herb)} tincture`,
  in: { ethanol: 1 }, out: { water: 1 },
  items: [{ item: herb, count: 4 }, { item: 'glass_vial', count: 1 }],
  gives: [{ item: `tincture_${herb}_cloudy`, count: 1 }],
  needs: ['heated'], tempC: [45, 60], ruinC: 75,
  batchL: 150, seconds: 60, age: ageIndexOf('ember'),
  verb: 'steeping', done: 'Tincture done',
});

/** Elixir: essence + clear tincture + 2 empty vials, sweetened with syrup's sugars. 4 vials in, 4 out. */
const elixirRow = (buff: string, ward: boolean): ReactionSpec => ({
  key: `rx_elixir_${buff}${ward ? '_ward' : ''}`, name: `${cap(buff)} elixir`,
  in: { sugars: 1 }, out: { water: 1 },
  items: [
    { item: `essence_${buff}`, count: 1 }, { item: ELIXIR_TINCTURE[buff], count: 1 },
    { item: 'glass_vial', count: ward ? 4 : 2 }, ...(ward ? [{ item: 'vial_ward', count: 1 }] : []),
  ],
  gives: [{ item: `elixir_${buff}`, count: ward ? 6 : 4 }, ...(ward ? [{ item: 'glass_vial', count: 1 }] : [])],
  needs: [], speedUps: { stirred: 2, heated: 1.5 }, tempC: [15, 70], ruinC: 80,
  batchL: 160, seconds: 120, age: ageIndexOf('bronze'),
  verb: 'blending', done: 'Elixirs done', flag: POTION_FLAG,          // 'bottled_elixir'
  ...(ward ? { research: 'essence_ward' } : {}),
});

/** Glowcap Draught: 2 clear glowcap tinctures + 2 empty vials + syrup -> 4 draughts. */
const draughtRow: ReactionSpec = {
  key: 'rx_glowcap_draught', name: 'Glowcap draught',
  in: { sugars: 1 }, out: { water: 1 },
  items: [{ item: 'tincture_glowcap', count: 2 }, { item: 'glass_vial', count: 2 }],
  gives: [{ item: 'glowcap_draught', count: 4 }],
  needs: [], speedUps: { stirred: 2, heated: 1.5 }, tempC: [15, 70], ruinC: 80,
  batchL: 160, seconds: 120, age: ageIndexOf('bronze'),
  verb: 'blending', done: 'Draughts done', flag: POTION_FLAG,
};

export const POTION_REACTIONS: ReactionSpec[] = [
  // Order matters only between a ward row and its plain row: the ward row (more items) comes first so it wins when
  // the vial_ward is present and the flag is known (Unit 0 picks the first row that passes).
  ...ESSENCE_SOURCES.map(([buff, cup]) => essenceRow(buff, cup)),
  ...sweetEssenceRows(),                       // from Unit 5's SWEETENED when it exists, else []
  ...TINCTURE_HERBS.map(tinctureRow),
  ...Object.keys(ELIXIR_TINCTURE).flatMap((b) => [elixirRow(b, true), elixirRow(b, false)]),
  draughtRow,
];
```

Row count: 6 essence + 6 sweet essence (with Unit 5) + 4 tincture + 12 elixir + 1 draught = **29** (23 without Unit 5).

Litre and item bookkeeping, checked row by row (Unit 0 validates `sum(out) == sum(in) x (1 - gasLoss)` at load):

| row | in (parts) | out (parts) | gasLoss | check | items in | items out | glass in = out |
|---|---|---|---|---|---|---|---|
| essence | water 1 | water 0.5 | 0.5 | 0.5 = 1 x 0.5 | 4 cups + 1 vial | 1 essence (vial) + 4 clay cups | 1 = 1 |
| tincture | ethanol 1 | water 1 | 0 | 1 = 1 | 4 herbs + 1 vial | 1 cloudy tincture (vial) | 1 = 1 |
| elixir | sugars 1 | water 1 | 0 | 1 = 1 | essence + tincture + 2 vials = 4 glass | 4 elixirs | 4 = 4 |
| elixir ward | sugars 1 | water 1 | 0 | 1 = 1 | essence + tincture + 4 vials + vial_ward = 7 glass | 6 elixirs + 1 vial | 7 = 7 |
| draught | sugars 1 | water 1 | 0 | 1 = 1 | 2 tinctures + 2 vials = 4 glass | 4 draughts | 4 = 4 |

Assumption to verify at build time: an essentia `vial_<aspect>` is a glass vial with essentia in it and empties to `glass_vial`
(docs/api/magic.md "Glassware"). If the magic code returns some other empty, the ward row's `gives` names that key instead.

What the liquid numbers mean to the player:

- **Essence**: pour one Beaker of Water (250 L) and the four cups; one batch draws 125 L off as vapour (`Distillery.vented`) and
  leaves 125 L of water - enough for exactly one more batch (another 4 cups + vial) before the vessel needs topping up. 60 s per
  batch at 4 Hz. Through Unit 0's heat rule it draws 2 kW while it runs.
- **Tincture**: one Beaker of Spirit carries 162.5 L ethanol (250 x 0.65, `GRADES.spirit.mix`); one batch converts 150 L, so one
  beaker = one tincture with 12.5 L to spare. `batchL` 150 is below SYSTEMS 5.2's 250-1000 guidance on purpose: one beaker,
  one vial, the cleanest lesson (Unit 0's own `rx_ferment_wash` keeps 150 too).
- **Elixir / draught**: one Beaker of Pine Syrup carries 162.5 L sugars (`GRADES.syrup.mix` sugars 0.65); one batch takes 160 L
  -> one beaker = one batch of 4 elixirs. With Unit 5, seven Sugar items (7 x 25 L = 175 L) are the furnace-free alternative.
  This reconciles SYSTEMS' two phrasings: T4 says "syrup 250 L -> 4" (one beaker in), 5.2 says "4 per 1000 L batch" - the latter is
  **amended** to "4 per syrup beaker (160 L sugars)" (section 14).

Time per batch: elixir base 120 s (top of SYSTEMS 5.2's 30-120). Heated x1.5 = 80 s; stirred x2 = 60 s; both x3 = 40 s.

Ruin rules, as Unit 0 runs them: ruin happens only while a batch is in progress (`rx` set) and the vessel's temperature exceeds the
running row's `ruinC`. Consequences the player meets:
- Essence, pump stops mid-batch (the crank is let go): `vacuum` is lost, the row pauses, and the vessel's cap returns to the plain
  bubble point (100 C for water). If the base is set to 92, the vessel climbs past 80 and the batch is **ruined**: the liquid
  becomes slop, the vessel goes red, the cups and vial are NOT consumed (Unit 0 consumes items only at completion) - the player
  pours out the slop and starts again with the same cups. If the base is set to 60, nothing is ruined; the batch waits for the pump.
  This is the essence's one lesson: **set the base low, or keep the pump turning**.
- Tincture at 78 C or more: spirit's bubble point (about 82 C) lets the vessel pass 75: ruined. At 50 or 60: fine.
- Elixir heated to 92: ruined above 80. At 60 or 78 (78 < 80) fine; 78 is outside the window (15-70), so the batch pauses
  ("too hot (78 C), needs 15-70 C" from Unit 0's phrases) - the setpoint the player wants is 60.

### 4.4 Clearing a tincture at the filter bed

`filter_bed` is Unit 8's block (`CHEM.filter`, 500 L, one load slot). Unit 10 adds an **item use** on it, in **NEW**
`src/sim/distillPotions.ts`:

```ts
/** Use with a cloudy tincture on a filter bed loaded with charcoal: clears up to FILTER_VIALS_PER_CHARCOAL held vials, eats one charcoal. */
export function clearTincture(d: Distillery, x: number, y: number, z: number, held: ItemStack): ClearResult | null;
export type ClearResult =
  | { ok: true; from: string; to: string; count: number; charcoalLeft: number }
  | { ok: false; message: string };
```

Rules:
- Applies only when the target block's chem kind is `filter_bed` (or `filter_bed_done`) and the held item is a key in
  `CLOUDY_TO_CLEAR` (NEW table: `tincture_<herb>_cloudy` -> `tincture_<herb>`). Any other held item: return null (Unit 8's own
  handling - clay load, lube base - runs as before).
- The bed's load slot must hold `charcoal` (count >= 1). Clay in the slot: `"The Filter Bed holds clay - it clears oil, not
  tinctures. Take the clay out and load charcoal"`. Empty slot: `"Load the Filter Bed with charcoal first"`.
- `count = min(held.count, FILTER_VIALS_PER_CHARCOAL)` with `FILTER_VIALS_PER_CHARCOAL` = 4 (NEW). The held stack loses `count`
  cloudy vials; `count` clear vials go into the pack (`player.give`, which drops at the feet when full - never lost); the bed's
  charcoal loses 1. One Use per batch of up to four; no timer, no per-stack state (SYSTEMS 2: no metadata).
- The bed must not hold liquid that Unit 8 is filtering (`total(mix) > 0`): `"The Filter Bed is busy with Lube Base - let it run
  through first"`. Reason: one load slot, one job at a time; the charcoal would foul the oil.
- Sound `drip` at the bed (whisper 0.3); toast `"4 Glowcap Tinctures cleared - 2 charcoal left in the Filter Bed"` (kind `good`,
  `item` = the clear key).
- Why charcoal and not clay: DISTILLERY_PLAN 8 and SYSTEMS T4 both say "filter bed (charcoal)". Charcoal is an Ember fuel (400 kJ),
  so clearing costs a little fuel - congruent with T1 ("everything costs heat somewhere").

Unit 10 also adds `charcoal` to the bed's accepted loads (Unit 8's table or check). Charcoal does nothing for lube base: Unit 8's
lube-base path requires clay and says so.

### 4.5 Where elixirs and spirits sit on the ladders

| need | Ember answer | Bronze answer |
|---|---|---|
| move faster | Light Roast, 3 min | Swift Elixir, 9 min |
| survive cold | Black Tea / fire (Well-Warmed 5 min) / **a swig of spirit (Well-Warmed 5 min)** | Hearthkept Elixir, 9 min |
| see in the dark | torches, glowcaps planted | **Glowcap Draught, 5 min** |
| heal | Berry Tea (regen x2), food | **Bandage** (6 HP / 12 s, any conditions), Mending Elixir |

Spirit's Well-Warmed is the same buff the hearth gives (`WELL_WARMED_DURATION_S` 300) - a flask of fire for the cold walk. It does
not stack with the hearth: `max()`.

### 4.6 T4 material web rows (for the coordinator to merge)

| item | made by | consumed by | age | stack |
|---|---|---|---|---|
| `essence_<buff>` x6 | `rx_essence_<buff>` vacuum vessel 50-80 C (10) | `rx_elixir_<buff>` (10); rune desk M6 research (18) | bronze | 16 |
| `tincture_<herb>_cloudy` x4 | `rx_tincture_<herb>` heated vessel 45-60 C (10) | filter bed -> clear (10); infusion altar (18) | ember | 16 |
| `tincture_<herb>` x4 | filter bed (charcoal) (8 block, 10 use) | `rx_elixir_*` / `rx_glowcap_draught` (10); infusion altar (18) | bronze | 16 |
| `elixir_<buff>` x6, `glowcap_draught` | elixir rows (10) | drink (end product); golem pace (17) | bronze | 16 |
| `bandage` | workbench (10) | heal (end product); golem repair (17) | ember | 16 |
| `spirit_beaker` (exists) | pot still (exists) | drink (10), bandage (10), tincture solvent (10), still feed (exists), burner? (no - Unit 7 burns `fuel_ethanol_beaker` only) | ember | 16 |
| `glowcap` (exists, block item) | world | tincture (10) - its first consumer | ember | 64 |
| `charcoal` (exists) | furnace | fuel (exists), filter bed load (10) | ember | 64 |

---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour and rules (with edge cases and messages)

### 5.1 Drinking an elixir or the draught

Use with an elixir or `glowcap_draught` held, when no block-targeted use claimed the click (interaction.ts order is unchanged):
`drink(player, slot)` runs exactly as for a cup, with three differences:

1. The container back is `spec.returns ?? CUP_ITEM` (`glass_vial` for every potion). Stack 1: the vial replaces the stack in the
   same slot; stack > 1: one is removed and the vial goes to the pack via `player.give` (drops at the feet when full).
2. The toast names the time for anything not 180 s: new buff `"Swift for 9 min: Walk, sprint and swim 20% faster"`; replacing
   `"Swift replaces Vigor - 9 min"`; same buff refreshed `"Swift topped up to 9 min"`; same buff already longer (a cup drunk while
   an elixir runs, `DrinkGrant.refreshed` and the old time was larger) `"Swift already runs longer (7.5 min left)"` (kind `info`;
   the cup is still drunk - refusing would surprise more than it saves). Cups keep today's strings exactly.
3. `stats.drunk[item]` still counts (for future goals); `six_cups` is checked against `CUP_BUFFS` cups only (5.9).

Refusals are unchanged (`dead`, `cooldown` - quiet). Time format: `fmtMinutes(s)` NEW tiny helper in `src/game/drink.ts`:
`< 60 -> "<n> s"`, else one decimal minutes with a trailing `.0` dropped (`540 -> "9 min"`, `450 -> "7.5 min"`), matching SYSTEMS
T8 time grammar.

### 5.2 Still base setpoints

`STILL_SETPOINTS` becomes `[50, 60, 78, 92, 97, 130, 200, 260, 350, 420]` (Unit 11 later inserts 480 and 560 behind 420, shown
only with a steel flask). Tapping the base with an empty hand still steps through them in order and wraps. `STILL_DEFAULT_C` stays
97. The crosshair already prints `"Still Base - set 60 C, holding 60 C"`. Unit 7's ground burner reads the same list (its
temperature is `min(setC, fuelCap)`), so 50/60 work in the field.

Why add two setpoints rather than rely on vacuum alone: J2 says "base at 60 C"; maceration needs 45-60, and no existing setpoint
is in that window. Two more taps on the base is the cheapest possible UI.

### 5.3 The vessel lines the player reads (Unit 0's grammar, Unit 10's words)

| situation | crosshair line |
|---|---|
| essence running | `Reaction Vessel - concentrating 40%, 70 C, Swift essence` |
| essence, no pump turning | `Reaction Vessel - needs vacuum - turn a Vacuum Pump on the cap` (Unit 0 nearest-miss; Unit 10 supplies the `needsText` override below) |
| essence, cups missing | `Reaction Vessel - needs 4 Light Roast` |
| essence, no water | `Reaction Vessel - holds 4 Light Roast, needs water - pour in a Beaker of Water` |
| tincture too hot (paused) | `Reaction Vessel - too hot (82 C), needs 45-60 C` |
| tincture ruined | `Reaction Vessel - ruined - pour it out, 162 L Slop` |
| elixir running stirred | `Reaction Vessel - blending 75%, stirred, Swift elixir` |
| done, outputs waiting | `Reaction Vessel - done, 4 Swift Elixir ready` |

Unit 10 adds one OPTIONAL member to its rows only if Unit 0 lacks per-capability hints: `needsText?: Partial<Record<Capability,
string>>` with `vacuum: 'needs vacuum - turn a Vacuum Pump on the cap'`. If Unit 0's nearest-miss already phrases a missing
capability as `needs vacuum`, Unit 10 does nothing here.

Toasts on completion come from Unit 0's `announce` with the row's `done`: `"Essence done: Swift Essence"`, `"Tincture done:
Cloudy Glowcap Tincture"`, `"Elixirs done: 4 Swift Elixir"`. Unit 12's `glass_chime` plays if merged.

### 5.4 Drinking spirit

`drinkSpirit(player, slot)` (NEW, `src/game/drink.ts`):

1. Refusals: dead -> quiet; `player.drinkCooldownS > 0` -> quiet (shares the cup cooldown, `DRINK_COOLDOWN_S` 1 s).
2. Remove one `spirit_beaker`; give back `glass_beaker` (same slot when the stack was 1).
3. `const g = buffs.takeSpirit()` (NEW): `wasTipsy = tipsyS > 0`; `wellWarmedS = max(wellWarmedS, SPIRIT_WARMED_S)`;
   `tipsyS = max(tipsyS, TIPSY_S)`; if `wasTipsy` then `blurredS = max(blurredS, BLURRED_S)`. Returns `{ wasTipsy }`.
4. `drinkCooldownS = DRINK_COOLDOWN_S`; `stats.drunk.spirit_beaker++`; events `player:drank { item }`, `buff:gained { buff:
   'well_warmed', durationS: 300 }`, `buff:gained { buff: 'tipsy', durationS: 120 }`; sfx `sip`.
5. Toast: first swig `"Warmed and Tipsy: warm for 5 min, hits 10% harder for 2 min"` (kind `good`); swig while tipsy `"That one
   went to your head - the world blurs for 20 s"` (kind `warn`).

Where the "fire" in Warmed comes from: SYSTEMS T1 says every heat is the hearth's or a copy. Spirit is a product of a still on
the hearth: drinking it is carrying a little of the hearth's heat. The tooltip wording "warm up" keeps the joke implicit.

### 5.5 Tipsy and Blurred, exactly

| state | while | effects |
|---|---|---|
| Tipsy | `tipsyS > 0` | `meleeMult` = 1.1 (animals.ts `strike()` multiplies `hitDamage(item)`; automaton hits go through the same `animals.hit` path, so they gain too); camera roll sway `swayDeg` = `TIPSY_SWAY_DEG` x fade, where fade = `min(1, tipsyS / 10, (TIPSY_S - tipsyS + 1) / 3)` - eases in over 3 s and out over the last 10 s |
| Blurred | `blurredS > 0` | `speedMult` x `BLURRED_SPEED_MULT` 0.9; soft vignette opacity = `BLUR_VIGNETTE` 0.35 x min(1, blurredS / 3) |

- `speedMult` getter becomes `(swift ? 1.2 : 1) x (sugar ? 1.12 : 1) x (blurred ? 0.9 : 1)`. This IS the T5 speed rule's
  `(blurred ? 0.9 : 1)` term; it is put in the getter (the one place buffs' base rules live) so physics.ts:141 needs no edit and
  the tractor (which never reads `speedMult`) is unaffected. Section 14 asks the coordinator to note this in SYSTEMS T5.
- The sway is a pure camera ROLL (rotation about the view axis): the forward vector does not change, so aiming, mining and the
  crosshair ray are exactly as sober. Period `TIPSY_SWAY_PERIOD_S` 4.2 s, a sine, plus a second sine at 0.37x amplitude and 2.9 s so
  it never looks mechanical. Phase from `performance.now()`; no allocation per frame.
- `TIPSY_SWAY_DEG` = 0 disables the sway entirely (SYSTEMS 8.3 open question default; there is no reduce-motion setting).
  Blurred's vignette has its own constant `BLUR_VIGNETTE` (0 disables).
- Death clears tipsy and blurred (`Buffs.clear()`).
- Tipsy while driving the tractor or riding (Unit 13 skiff): the sway still applies to the camera (it is the head, not the feet);
  speed is unaffected (vehicle speed never reads `speedMult`). No toast, no penalty: drunk driving is not a system we want to model,
  and the sway alone says enough. The tractor's own camera path must apply the same roll (section 8 step 9).
- Tipsy has no effect on mining, jumping, warmth or hunger.

### 5.6 Bandage

Use with a `bandage` held (when no block-targeted use claimed the click): `applyBandage(player, survival, slot)` (NEW,
`src/game/bandage.ts`):

| situation | result | message |
|---|---|---|
| dead | refused, quiet | - |
| health at `MAX_HEALTH` and no bandage healing | refused | advise `"You are not hurt - keep the bandage for later"` (kind info, via `this.advise('bandage', ...)` so it does not spam) |
| a bandage is already healing (`survival.mendHp > 0`) | refused | `"A bandage is already on - 3 health still to heal"` (number = `ceil(mendHp)`) |
| otherwise | one bandage consumed, `survival.healOverTime(6, 12)` | toast `"Bandaged: 6 health over 12 s"` (kind good); event `player:bandaged`; sfx `pour` at volume 0.3 (cloth wetting) |

`Survival.healOverTime(hp, seconds): boolean` (NEW): sets `mendHp = hp`, `mendS = seconds` and returns true; it refuses (returns
false) when `mendHp > 0` (the refresh rule of SYSTEMS T5 for heal-over-time: "refreshing" is read as "you cannot waste a running
bandage"; a new one can go on once the old one is spent). `tickMend(dt)` runs every tick before `tickRegen`: while `mendHp > 0`
and the player is alive, `rate = mendHp / mendS`; `heal(min(mendHp, rate x dt))` accumulated as a fractional `mendAcc` so health
rises in whole points (1 HP every 2 s - `PlayerState.heal` takes numbers but the HUD and saves expect whole health); `mendHp` and
`mendS` count down; both reach 0 together. Healing continues at full health? No: if health reaches `MAX_HEALTH`, the remaining
`mendHp` is dropped (nothing to heal, nothing banked). Taking damage does not interrupt it (a bandage is not a regen rule; that is
its value). Death clears it (`respawn()` sets both to 0).

### 5.7 Death, respawn, save and load mid-buff

| case | behaviour |
|---|---|
| death with an elixir buff, tipsy, night sight, a bandage healing | `Buffs.clear()` already ends every buff on respawn; it now also clears the `tonic` slot, `tipsyS`, `blurredS`. `Survival.respawn()` zeroes `mendHp`/`mendS`. Potions in the pack are kept (the game keeps the inventory). |
| save while Swift Elixir has 400 s left | `BuffsSnapshot.drinks.swift = 400` (existing record); loads back via `grant('swift', 400)` |
| save with night sight 200 s | `drinks.night_sight = 200` - the existing `drinks` record, keyed by `DRINK_BUFF_KEYS`, which now includes `night_sight` |
| save while tipsy 50 s, blurred 10 s | `tipsyS: 50`, `blurredS: 10` (written only when > 0, like `sugarS`) |
| save mid-bandage | `SurvivalSnapshot.mendHp`, `mendS` (written only when > 0) |
| old save (no new fields) | `finite()` guard -> 0; `drinks` without `night_sight` -> nothing; a negative or NaN value -> 0 |
| save mid-reaction | Unit 0 saves `rx.doneL`, slots; nothing Unit 10-specific |
| an unknown future drink key in `drinks` | ignored (loop is over `DRINK_BUFF_KEYS`) |

`document.ts` validation (line 114) checks only `wellWarmedS` - no change needed; the new fields ride inside `buffs` and inside the
survival snapshot.

### 5.8 Interaction priority (what a Use with each item does)

| held | aimed at | result |
|---|---|---|
| `spirit_beaker` | a chem module (vessel, flask) | pours 250 L in (existing chem path, earlier in the chain) |
| `spirit_beaker` | anything else / sky | drinks |
| any vessel ingredient (cup, herb, vial, essence, tincture) | reaction vessel | goes into a slot (Unit 0) |
| a cup / elixir | not a vessel | drinks |
| `tincture_*_cloudy` | filter bed | clears (4.4) |
| `bandage` | anything that does not claim it | bandages |
| `glowcap` | a block top | plants (existing block item placement wins: it is a block item); the herb goes in a vessel only when aimed at the vessel |

Consequence to note in the tooltip test: a cup aimed at a vessel goes in, not down the throat - the cup tooltip does not change,
but the vessel's empty-hand toast lists its slots (Unit 0).

### 5.9 six_cups and other readers of DRINKS

`DRINKS` (registry.ts:611) is every item with `drink`; it grows from 6 (12 with Unit 5) to 19 (25). The `six_cups` flag in
`drink()` becomes: `firstOfKind && CUP_BUFFS.every((b) => cupsOf(b).some((key) => drunk[key]))` where `CUP_BUFFS` (NEW, brewing.ts)
= the six cup buffs and a cup is an item whose `drink.returns` is absent (returns the clay cup). Equivalent rule in words: "one cup
of each of the six cup buffs" - a sweet cup counts as its buff (Unit 5's intent), an elixir never counts (it is not a cup). If
Unit 2 or 5 already rewrote the check, Unit 10 only adds the `returns === undefined` filter.

Also grep every other `DRINKS` reader at build time (codex, brewValidation if it exists) and make sure none assumes "every drink
returns the clay cup" or "buffS is 180".

### 5.10 The side goal

`bottle_elixir` "Bottle an elixir": `"Concentrate four cups under vacuum, clear a tincture through charcoal, and blend them with
syrup. An elixir lasts three times as long as a cup."` Completed by flag `bottled_elixir` (`POTION_FLAG`), set by Unit 0's
`flag` member on the elixir rows and on `rx_glowcap_draught` (the first batch of either). Reward: 2 `glass_vial` (the bottles for the
next batch; cheap, on-theme). Exported as `POTION_SIDE_GOALS` from `src/content/objectivesPotions.ts` (NEW) and concatenated
in `objectivesSide.ts` (Unit 0). Never inserted in `OBJECTIVES`.

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Exact strings (T8 voice; all NEW unless quoted from the code)

| where | string |
|---|---|
| toast, new elixir buff | `Swift for 9 min: Walk, sprint and swim 20% faster` (pattern `<Name> for <time>: <effect>`) |
| toast, elixir replaces | `Swift replaces Vigor - 9 min` |
| toast, elixir refresh | `Swift topped up to 9 min` |
| toast, cup under a longer elixir | `Swift already runs longer (7.5 min left)` |
| toast, draught | `Night Sight for 5 min: The dark lifts around you` |
| toast, spirit first swig | `Warmed and Tipsy: warm for 5 min, hits 10% harder for 2 min` |
| toast, spirit while tipsy | `That one went to your head - the world blurs for 20 s` |
| toast, tipsy wears off | `Tipsy wears off` (kind info; emitted by `Buffs.tick` returning a flag, via `Game` - same place sugar/drink expiry would toast; if no expiry toasts exist today, skip this one: silence is fine) |
| bandage applied | `Bandaged: 6 health over 12 s` |
| bandage at full health | `You are not hurt - keep the bandage for later` |
| bandage while one heals | `A bandage is already on - 3 health still to heal` |
| filter bed cleared | `4 Glowcap Tinctures cleared - 2 charcoal left in the Filter Bed` (singular: `1 Glowcap Tincture cleared - ...`; `no charcoal left` at 0) |
| filter bed, clay loaded | `The Filter Bed holds clay - it clears oil, not tinctures. Take the clay out and load charcoal` |
| filter bed, empty | `Load the Filter Bed with charcoal first` |
| filter bed, busy | `The Filter Bed is busy with Lube Base - let it run through first` |
| completion toasts | `Essence done: Swift Essence`, `Tincture done: Cloudy Glowcap Tincture`, `Elixirs done: 4 Swift Elixir`, `Draughts done: 4 Glowcap Draught` |
| side goal | `Side goal: Bottle an elixir` (Unit 0's format) |
| HUD pill titles | `Night Sight: The dark lifts around you`; `Tipsy: Hits 10% harder` (+ `, blurred` while blurred) |

`DRINK_BUFFS.night_sight = { name: 'Night Sight', family: 'tonic', effect: 'The dark lifts around you' }`. A `TIPSY_TEXT = { name:
'Tipsy', effect: 'Hits 10% harder' }` (NEW, brewing.ts) feeds the pill and the toast's number (`pct(TIPSY_MELEE_MULT)`).

All crosshair lines stay under 60 characters (checked in 9.1 with the longest buff name).

### 6.2 HUD

- Order (SYSTEMS T5): warm, fed, sugar, tea, coffee, **tonic**, **tipsy**. `vitals.ts` builds drink pills from `DRINK_BUFF_KEYS`;
  `night_sight` is appended LAST in that array so it lands after the coffees, then a new `tipsyBuff = new BuffPill('tipsy', 'cup')`
  goes after all drink pills. Glyphs: `night_sight` -> `moon`, tipsy -> `cup`. Neither reuses flame/bowl/hourglass.
- Pill text: name + m:ss via the existing `clockTime` (`Swift 9:00`, `Night Sight 4:12`, `Tipsy 1:43`). Blurred has no pill; the
  tipsy pill gets `data-blurred="1"` while blurred (CSS: italic name) - no extra chip on a phone.
- Density: `chipDensity` counts every shown pill; with warm + coffee + tonic + tipsy (4) the row goes `tight` (time under glyph).
  Nothing else changes; the existing compact rules already keep the row out of the hotbar and crosshair at 390 px.
- Heal-over-time: the health vital (`.hw-vital[data-kind="health"]`) gets class `hw-vital--mending` while `mendHp > 0`: a "+"
  glyph (text, 10 px, `--hw-good` colour) at the bar's right end pulsing opacity 0.5..1 over 1 s (CSS animation, no JS per frame).
  No pill (SYSTEMS T5).
- Phone layout: no new screen, no new button. Every action is one Use (drink, bandage, clear) or Unit 0's slot Use. Tested at
  `--device=phonePortrait` (390 px) and `desktop` in e2e (section 10): the pill row must not wrap over the hotbar with 7 pills.

### 6.3 Tooltips and codex

Generated from the tables in `itemsPotions.ts`; recipe rows for reactions come from Unit 0/6's process display (the vessel's
empty-hand toast lists what a row needs). The codex picks items up through the normal extraction; Unit 10 adds a section headed
"Unit 10 - potions" in `scripts/codex/progression.json` listing the chain order (cup -> essence, herb -> tincture -> clear, ->
elixir) only if that file has per-branch sections (SYSTEMS T7: own section, Unit 12 owns the distillery branch).

### 6.4 Icons (16x16, `src/render/textures/`)

| icon | look |
|---|---|
| `item_essence` x6 (one texture painted per buff, generated by a loop) | a small stoppered vial, liquid a deep saturated version of the cup's `DrinkSpec.colour` (green_tea 0x9fae45 -> darker), with a white glint |
| `item_tincture_cloudy` x4 | the vial, liquid milky (herb colour mixed 50% with 0xd8d0c0), a few lighter specks |
| `item_tincture` x4 | the vial, clear herb colour: glowcap 0x4fd6c8, wildberries 0xa8324a, tea_leaves 0x7fae45, coffee_cherries 0x8a3a22 |
| `item_elixir` x6 | a taller corked bottle (2 px wider than the vial), buff colour, a gold band at the neck (the "x3" look) |
| `item_glowcap_draught` | the tall bottle, cyan 0x4fd6c8 with 3 bright pixels (it glows in the hotbar; no emissive needed) |
| `item_bandage` | a rolled off-white strip with a pale amber stain |

Painted with the same helpers the glass items use; each passes `src/render/textures/readability.ts` (contrast test) - the cloudy
and clear tinctures must differ by more than the readability threshold (milky vs clear), checked in the texture test.

### 6.5 Night sight (render)

- Uniform **NEW** `uNightSight` (float 0..1) in the shared lighting uniforms `u` (renderer.ts:93 "shared lighting / fog / time
  uniforms"), so terrain and mobs both read it. Value = `smoothstep(0, 1, min(1, left / 5, (NIGHT_SIGHT_S - left + 1) / 2))` -
  fades in over 2 s and out over the last 5 s, so the expiry is felt, not a pop.
- In the terrain/mob fragment light: `light = max(light, uNightSight * NIGHT_SIGHT_LIGHT * NIGHT_TINT)` where
  `NIGHT_SIGHT_LIGHT` = 0.45 (NEW, render constant; the gameplay night light is 0.04..0.12, `NIGHT_LIGHT_NEW_MOON` /
  `NIGHT_LIGHT_FULL_MOON`) and `NIGHT_TINT` = (0.75, 1.0, 0.95) (glowcap blue-green). A floor, not an add: daylight and torchlight are
  untouched; only what is darker than 0.45 rises. Works underground (block light 0) and at night (sky light low) alike.
- Fog: while `uNightSight > 0`, the night fog colour is lerped toward the day fog colour by `uNightSight x 0.6` ("no fog of
  night", SYSTEMS T5) - the far terrain reads as shapes instead of black.
- Sky dome unchanged (stars stay; the sky is not the point).
- Gameplay light (`NIGHT_LIGHT_*`, mob spawning by light level) is NOT changed: night sight is your eyes, not the world. Cinder
  Mites still spawn in the dark you now see.
- Exposure is read by the renderer from `game.player.buffs.nightSight` (NEW getter returning 0..1 with the fade) each frame through
  the existing frame-state path the renderer already reads (weather `fx`, camera) - whatever object `render()` receives gains
  `nightSight: number` and `swayDeg: number` and `vignette: number`.

### 6.6 Sway and blur (render / UI)

- Sway: in the camera update (the one that sets yaw/pitch from the player), after the yaw/pitch: `camera.rotateZ(rad(sway))` where
  `sway = swayDeg x (sin(2 pi t / 4.2) + 0.37 sin(2 pi t / 2.9 + 1.3)) / 1.37`. No effect when `swayDeg === 0`. Same call in the
  tractor's camera path.
- Blur: NO post-processing pass (phones). A fixed full-screen `div.hw-vignette` (pointer-events none, under the HUD, above the
  canvas) with `background: radial-gradient(ellipse at center, transparent 55%, rgba(20, 16, 12, 0.85) 100%)`; its `opacity` is set
  to `vignette` (0..0.35) by the HUD refresh (not per frame: the HUD refresh rate is enough for a 20 s fade). Hidden (`display:none`)
  at 0.

### 6.7 Sounds (T9)

No new `SfxName`: `sip` for every drink (elixirs, draught, spirit), `pour` at 0.3 for the bandage (cloth soaking), `drip` (0.3) at
the filter bed, Unit 12's `glass_chime` on reaction done, Unit 0's vented-vapour particles under vacuum. Reason: the existing set
already says these things, the sfx test count stays untouched, and SYSTEMS T9 rule 3 (sound only on change) holds. A tipsy hiccup
was considered and rejected: a sound every few seconds for two minutes breaks T9 rule 3.

### 6.8 Particles

- Drinking a glowcap draught: 12 cyan motes rise from the camera bottom for 0.6 s (the brewing steam emitter in `brewFx.ts`
  reused with colour 0x4fd6c8; cap 24 per emitter, SYSTEMS T9 rule 4).
- The essence vessel under vacuum: Unit 0/8's vented vapour wisps (nothing new).
- Bandage: none.

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

### 7.1 Constants (NEW, `src/core/constants.ts`, block "Potions and spirits (Unit 10)")

```ts
/** An elixir grants its drink buff this long: three cups' worth (SYSTEMS T5, 5.2). */
export const ELIXIR_BUFF_S = 3 * DRINK_BUFF_S;            // 540
/** The Glowcap Draught's Night Sight (family tonic). */
export const NIGHT_SIGHT_S = 300;
/** A swig of spirit: Well-Warmed this long (the hearth's buff), and Tipsy this long. */
export const SPIRIT_WARMED_S = WELL_WARMED_DURATION_S;    // 300
export const TIPSY_S = 120;
/** A swig while already Tipsy blurs the screen and slows you this long. */
export const BLURRED_S = 20;
export const TIPSY_MELEE_MULT = 1.1;
export const BLURRED_SPEED_MULT = 0.9;
/** Camera roll sway amplitude while Tipsy, degrees. 0 turns the sway off (SYSTEMS 8.3). */
export const TIPSY_SWAY_DEG = 0.6;
export const TIPSY_SWAY_PERIOD_S = 4.2;
/** Opacity of the Blurred vignette at full strength. 0 turns it off. */
export const BLUR_VIGNETTE = 0.35;
/** A bandage heals this much over this long (SYSTEMS 5.2). */
export const BANDAGE_HP = 6;
export const BANDAGE_S = 12;
/** Cloudy tinctures one charcoal in a Filter Bed clears. */
export const FILTER_VIALS_PER_CHARCOAL = 4;
/** Flag of the first elixir or draught batch (side goal bottle_elixir). */
export const FLAG_BOTTLED_ELIXIR = 'bottled_elixir';
```

`NIGHT_SIGHT_LIGHT` 0.45 and `NIGHT_TINT` live in the render module that owns the shader (render constant, not gameplay).

### 7.2 Types

```ts
// src/core/types.ts
export type DrinkBuff = 'spring' | 'hearthkept' | 'mending' | 'swift' | 'vigor' | 'lasting' | 'night_sight';
export type DrinkFamily = 'tea' | 'coffee' | 'tonic';
export interface DrinkSpec {
  /* existing: buff, family, buffS, colour, warmth?, hunger? */
  /** NEW: the empty container drinking hands back. Absent = the clay cup (every brewed cup). */
  returns?: string;
}
/** NEW: a spirit you can drink: Well-Warmed and Tipsy (SYSTEMS T5). */
export interface SpiritSpec {
  warmedS: number;   // SPIRIT_WARMED_S
  tipsyS: number;    // TIPSY_S
  returns: string;   // 'glass_beaker'
}
/** NEW: an item that heals over time when Used (the bandage). */
export interface HealSpec {
  hp: number;        // BANDAGE_HP
  seconds: number;   // BANDAGE_S
}
export interface ItemSpec {
  /* existing ... */
  spirit?: SpiritSpec;   // NEW
  heal?: HealSpec;       // NEW
}

// src/core/gameEvents.ts
export type BuffName = 'well_warmed' | 'well_fed' | 'sugar_rush' | 'tipsy' | DrinkBuff;
// GameEvents gains:
'player:bandaged': { hp: number; seconds: number };
```

Note: Unit 5 adds `DrinkSpec.sugarS?` / `sweetOf?`; Unit 10's `returns?` is another optional member, no conflict.

### 7.3 Buffs

```ts
// src/game/buffs.ts
const FAMILIES: readonly DrinkFamily[] = ['tea', 'coffee', 'tonic'];
export interface BuffsSnapshot {
  wellWarmedS: number; wellFedS?: number; sugarS?: number;
  drinks?: Partial<Record<DrinkBuff, number>>;   // now may carry night_sight
  /** NEW: seconds of Tipsy left. Missing in older saves. */
  tipsyS?: number;
  /** NEW: seconds of Blurred left. Missing in older saves. */
  blurredS?: number;
}
export interface SpiritGrant { wasTipsy: boolean }   // NEW
class Buffs {
  tipsyS = 0;            // NEW
  blurredS = 0;          // NEW
  private readonly slots = { tea: {...}, coffee: {...}, tonic: { buff: null, s: 0 } };
  takeSpirit(warmedS: number, tipsyS: number): SpiritGrant;   // NEW (5.4 step 3)
  get meleeMult(): number;     // NEW: tipsy ? TIPSY_MELEE_MULT : 1
  get nightSight(): number;    // NEW: 0..1 with fades (6.5)
  get swayDeg(): number;       // NEW: TIPSY_SWAY_DEG x fade (5.5)
  get vignette(): number;      // NEW: BLUR_VIGNETTE x min(1, blurredS / 3)
  get blurred(): boolean;      // NEW
  get speedMult(): number;     // CHANGED: x BLURRED_SPEED_MULT while blurred
}
```

- `tick(dt)`: also counts `tipsyS`, `blurredS` down (clamped at 0). Blurred cannot outlive Tipsy: when `tipsyS` hits 0,
  `blurredS = 0`.
- `clear()`: zeroes both and the tonic slot (FAMILIES loop covers it).
- `active()`: drinks loop now yields `night_sight` after coffees (FAMILIES order); then `if (tipsyS > 0) out.push({ buff: 'tipsy',
  timeLeftS: tipsyS })` LAST.
- `toJSON()`: `...(this.tipsyS > 0 ? { tipsyS } : {})`, `...(this.blurredS > 0 ? { blurredS } : {})` (the `sugarS` pattern).
- `load(s)`: `this.tipsyS = finite(s.tipsyS) ? clamp(s.tipsyS, 0, TIPSY_S) : 0`; `this.blurredS = finite(s.blurredS) ? clamp(s.blurredS,
  0, BLURRED_S) : 0`; and `if (this.tipsyS === 0) this.blurredS = 0`. Drinks already loop `DRINK_BUFF_KEYS` (now including
  `night_sight`); additionally clamp a loaded drink to `<= ELIXIR_BUFF_S` (a hand-edited 1e9 cannot give a day of Swift).

### 7.4 Survival

```ts
export interface SurvivalSnapshot {
  /* existing */
  /** NEW: health still to come from a bandage, and seconds over which it comes. Missing in older saves. */
  mendHp?: number;
  mendS?: number;
}
class Survival {
  private mendHp = 0; private mendS = 0; private mendAcc = 0;     // NEW (mendAcc not saved: < 1 HP)
  /** NEW: starts healing `hp` over `seconds`; false (nothing changed) while one is still running or the player is dead. */
  healOverTime(hp: number, seconds: number): boolean;
  /** NEW: health still to heal (HUD "+" and the refusal text). */
  get mending(): number;
  private tickMend(dt: number): void;   // NEW, called in tick() before tickRegen
}
```

`toJSON` writes `mendHp`/`mendS` only when `mendHp > 0`; `load` sanitises: both finite, `mendHp` in `[0, BANDAGE_HP x 2]`,
`mendS` in `(0, BANDAGE_S x 2]`, otherwise both 0 (one bad field zeroes both: they only make sense together).

### 7.5 Items file

```ts
// src/content/itemsPotions.ts (NEW)
export const ESSENCE_SOURCES: ReadonlyArray<readonly [DrinkBuff, string]> = [
  ['spring', 'green_tea'], ['hearthkept', 'black_tea_cup'], ['mending', 'berry_tea'],
  ['swift', 'light_roast'], ['vigor', 'dark_roast'], ['lasting', 'trail_blend_cup'],
];
export const TINCTURE_HERBS = ['glowcap', 'wildberries', 'tea_leaves', 'coffee_cherries'] as const;
export const ELIXIR_TINCTURE: Readonly<Record<Exclude<DrinkBuff, 'night_sight'>, string>> = {
  spring: 'tincture_tea_leaves', hearthkept: 'tincture_tea_leaves', mending: 'tincture_wildberries',
  swift: 'tincture_coffee_cherries', vigor: 'tincture_coffee_cherries', lasting: 'tincture_coffee_cherries',
};
export const CLOUDY_TO_CLEAR: Readonly<Record<string, string>>;   // tincture_<h>_cloudy -> tincture_<h>
export const POTION_FLAG = FLAG_BOTTLED_ELIXIR;
export const POTION_ITEMS: ItemSpec[];   // 6 essences, 8 tinctures, 6 elixirs, glowcap_draught, bandage = 22
export const POTION_RECIPES: RecipeSpec[]; // workbench 'bandage', 'bandage_ethanol'
```

Elixir `ItemSpec`: `{ key, name, desc, category: 'food', age: ageIndexOf('bronze'), stack: 16, icon, drink: { buff, family:
DRINK_BUFFS[buff].family, buffS: ELIXIR_BUFF_S, colour, returns: 'glass_vial', ...(buff === 'hearthkept' ? { warmth:
HEARTHKEPT_DRINK_WARMTH } : {}) } }`. `colour` = the base cup's colour (read from `BREW_ITEMS` by the `ESSENCE_SOURCES` cup key).

`spirit_beaker` (itemsDistill.ts) gains `spirit: { warmedS: SPIRIT_WARMED_S, tipsyS: TIPSY_S, returns: EMPTY_BEAKER }` and the new
`desc` of 4.2.4. Its `CHEM_CONTAINERS` row is unchanged.

Registered in `src/content/index.ts` (or wherever `DISTILL_ITEMS` is spread) after `DISTILL_ITEMS`; recipes after the distill
recipes. Block ids: none (Unit 10 adds no blocks).

### 7.6 Old-save compatibility summary

Nothing is renamed, no id reorders, no `SAVE_VERSION` bump (T10 rule 3). New fields optional and sanitised. Vessel slot arrays of
length 4 (pre-change `VESSEL_SLOTS`) pad to 6 in Unit 0's sanitiser. A save from a build with Unit 10 loaded into one without it
would drop `tipsyS` etc. silently (the load functions ignore unknown keys) - acceptable.

