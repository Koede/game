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
