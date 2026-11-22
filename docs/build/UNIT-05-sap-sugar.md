# Unit 5 - Sap tap and sugar food

Status: build spec, written 2026-11-22 against `docs/build/SYSTEMS.md` (binding). Design pass only: nothing here is built yet.
Where this file and SYSTEMS.md disagree, SYSTEMS.md wins; where this file and the code disagree about something that EXISTS,
the code wins (and this file is wrong). Ids marked **NEW** do not exist in the code today; everything else was grepped.

**Threads:** T4 (material web: three baked goods, six sweetened drinks, sugar as a chem input), T5 (sweetened drinks x1.5 buff
time + 30 s Sugar Rush through the existing `Buffs` slots and `sugarS`), T9 (a tap sound, a stir sound, amber drips and a growing
amber bead, idle silent), T10 (tap state saved through `world.persist('sap')`, optional and sanitised). Touches T3 (sugar into a
vessel is a table row, not a code path) and T7 (side goal `tap_and_wait`, Ember, never on the main track) and T8 (pine log
crosshair line).

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

Hearthwatt's sugar chain is the Ember age's first "chemistry": you hold a thin glass beaker against a pine log and catch its sap,
boil it down to amber resin on the furnace, and distil that to pale sugar. Today the chain stops abruptly. The tap is invisible
(only a `sip` sound and a toast), forgets itself on reload, and sugar goes into exactly three baked goods. This unit makes the
whole chain feel like a living kitchen-chemistry corner of the base:

1. **The tap remembers and shows itself.** A tapped pine log grows a small **amber bead** on the face you tapped. While the log
   is recovering, slow amber **drips** run down the bark into the bead, which swells from a pinhead to a fat drop over the 120 s
   cooldown. When the bead is full it stops dripping and catches the light with a slow glint: *ready to tap again*. Look at the
   log and the crosshair says so: `"Pine Log - weeping, ready in 40 s"` / `"Pine Log - a full bead, ready to tap"`. Save and come
   back tomorrow: the bead is still there, still the same size.
2. **Sugar becomes a pantry, not a dead end.** Three new baked goods at the Clay Furnace: **Toffee** (sugar alone - the pocket
   sweet you carry on long walks), **Berry Tart** (flour, sugar and wildberries from the bushes), **Syrup Bread** (dough brushed
   with the distillery's syrup - the first food that needs a still).
3. **Sweetened drinks.** Drop a spoon of sugar into a finished cup (Use Sugar on the full cup) or stir one in at the workbench:
   the drink lasts half again as long (270 s instead of 180 s) and gives a 30 s Sugar Rush on top. A sweet Light Roast is the
   explorer's breakfast; a sweet Black Tea is the winter walker's flask.
4. **Sugar is a reagent.** Use Sugar on a Reaction Vessel or a Boiling Flask: it dissolves as 25 L of `sugars`. Ten sugars and a
   bucket of water under an Airlock Cap ferment into five beakers of Sugar Wash - the Ember route to wash that does not need a
   syrup still first. The same `sugars` feed Unit 10's elixir base.

The fantasy: *a woodland homestead where the pines weep amber, the kitchen smells of caramel, and the first glass jar of wash
bubbles in the corner.* Everything stays Ember (Clay Furnace, handwork, glass) and everything is optional (T7).

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 Thread map

| thread | what this unit reads | what this unit defines |
|---|---|---|
| T3 | `CHEM_CONTAINERS`, `chemUse`, `pour`, `expand`, `add`, `total`, `share`, `FERMENT_MAX_SUGARS` 0.3, `CHEM_CAPACITY_L.reaction_vessel` 4000 | **NEW** `CHEM_SOLIDS` table in `src/core/distill.ts` (`sugar` -> 25 L `sugars`); the one code path in `chemUse` that reads it |
| T4 | `flour`, `dough`, `wildberries`, `syrup_beaker`, `glass_beaker`, `water_pail`, the six drinks, `sugar` | **NEW** items `toffee`, `berry_tart`, `syrup_bread`, six `sweet_*` drinks; process card `ferment_sugar_wash` |
| T5 | `Buffs.grant`, `Buffs.sugarS`, `SUGAR_SPEED_MULT` 1.12, `SUGAR_WELL_FED_BURN_MULT` 2.5, `DRINK_BUFF_S` 180 | **NEW** constants `SWEET_DRINK_BUFF_S` 270, `SWEET_DRINK_SUGAR_S` 30; **NEW** optional `DrinkSpec.sugarS`, `DrinkSpec.sweetOf` |
| T7 | Unit 0 side goal mechanism (`SIDE_OBJECTIVES`, `ObjectiveSpec`, condition `{ type: 'flag' }`) | **NEW** `SUGAR_SIDE_GOALS` with `tap_and_wait`; **NEW** flag `tapped_twice` |
| T8 | crosshair chain `Game.showStationName` in `src/app/game.ts` | **NEW** pine log line (`SapTools.label`), sweet cup line through `brewView` |
| T9 | `drip` and `sip` patches (`src/audio/sfxBrew.ts`), `Particles`, `ParticleLook.Puff` | **NEW** `src/audio/sfxSugar.ts` with `sap_tap`, `cup_stir`; **NEW** `src/render/sapFx.ts` (bead + drips) |
| T10 | `world.persist(key, save)`, `world.extra(key)` | **NEW** world extra `'sap'` = `SapSnapshot` |

### 2.2 Provided to other units (exact)

| id / API | shape | consumer |
|---|---|---|
| `CHEM_SOLIDS` (NEW, `src/core/distill.ts`) | `Readonly<Record<string, { component: Component; litres: number }>>`, row `sugar: { component: 'sugars', litres: 25 }` | Unit 10 may add rows (e.g. a dried herb) instead of writing a second code path; Unit 0's slot path must run AFTER this lookup (2.4) |
| sweet drinks `sweet_<base>` (NEW) | `ItemSpec` with `drink.sweetOf`, `drink.sugarS` | Unit 10 essences: "4 drinks of that buff" - a sweet drink of the same buff counts (its `drink.buff` is the base buff); Unit 2 six_cups (2.4) |
| `SWEETENED` (NEW, `src/core/brewing.ts`) | `Readonly<Record<string, string>>` base drink key -> sweet key | brew sim (cup), recipes, tests |
| `sugars` component in vessels | existing component; fermenting reads it | Unit 0 `rx_ferment_wash`; Unit 10 syrup elixir base |
| `SapTools.toJSON/load/beads/label` (NEW) | see section 7 | `src/app/game.ts` only |

### 2.3 Consumed from other units

| from | what | if it has not landed yet |
|---|---|---|
| Unit 0 | `SIDE_OBJECTIVES` in `src/content/objectivesSide.ts` | write `SUGAR_SIDE_GOALS` anyway in `src/content/objectivesSugar.ts`; the coordinator concatenates once Unit 0 is in. The `tapped_twice` flag is emitted from day one, so the goal completes retroactively (the tracker records flags from minute one, T7). |
| Unit 0 | fermenting moved into `rx_ferment_wash` | Nothing changes for this unit: sugar only adds `sugars` litres; whichever fermenter runs (`Distillery.stepVessel` today, the reaction engine later) consumes them. The process card test proves it either way. |
| nobody else | - | - |

### 2.4 Contracts the coordinator must enforce

1. **Order inside `chemUse`.** Unit 0 adds "Use with an item on a vessel puts it in a slot". The `CHEM_SOLIDS` lookup must run
   BEFORE that slot path, otherwise sugar would sit in a slot as an item and never dissolve. Unit 0's slot path keeps working for
   every item that is not in `CHEM_SOLIDS`.
2. **six_cups counts base drinks only.** `drink()` in `src/game/drink.ts` emits `FLAG_SIX_CUPS` when `DRINKS.every(...)`. With six
   sweet drinks registered, `DRINKS` becomes twelve items and the goal would silently need twelve cups. This unit changes the check
   to base drinks (a sweet drink counts as its base, section 5.4). Unit 2 moves six_cups into side goals; if Unit 2 merges first it
   must keep this "base drinks" rule, if this unit merges first Unit 2 inherits it.
3. **Sound count.** `src/audio/sfx.test.ts` expression gains `+ Object.keys(SUGAR_SFX).length`. Units 12/13/14/16/19 also edit
   this line; merge by keeping every term.

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code

| file | what is there (quoted) | gap this unit closes |
|---|---|---|
| `src/player/sapTools.ts` (75 lines) | `TAP_COOLDOWN_S = 120`, `SAP_LOGS = new Set(['pine_log'])`, `EMPTY_BEAKER = 'glass_beaker'`, `SAP_ITEM = 'pine_sap'`; class `SapTools` with private `clock`, private `tappedAt: Map<string, number>` keyed `"x,y,z"`, `update(dt)` (prunes when size > 256), `waitS(x,y,z)`, `use(hit): SapOutcome \| null`. Refusal `"This log is still weeping: give it ${Math.ceil(wait / 10) * 10} s"`, full pack `"Your pack is full"`, toast `"You catch a beaker of sticky sap"`, sfx `sip`. Header comment says "not saved". | not saved; no face remembered; no view for render/crosshair; no flag |
| `src/player/interaction.ts` | `private readonly sap: SapTools` (line 89), built at line 132 with host `{ player, bus, advise, swing, stopMining }`; `this.sap.update(dt)` in `updateMining` (line 159); `this.sap.use(hit)` at line 233 before brewing/handwork/pipes | `sap` is private: game.ts cannot save it or feed the renderer |
| `src/app/game.ts` | `world.persist('vehicles' / 'magic' / 'workshop', ...)` with `load(world.extra(key))` (lines 128-186); controller built at line 236; crosshair names in `showStationName()` (around line 431) | no `'sap'` persist; no pine log line |
| `src/content/itemsSugar.ts` | `SUGAR_RUSH_S = { sugar: 45, sugar_cookie: 90, sweet_bun: 150, sugar_cake: 240 }`, helper `rush(hunger, s)`, `SUGAR_ITEMS` (glass_beaker, pine_sap, pine_resin, sugar, sugar_cookie, sweet_bun, sugar_cake). All `age: 0` literal. | three new foods |
| `src/content/recipes.ts` lines 124-130 | `forge(1, '4 sugar_cookie', '1 flour, 1 sugar', 190)`, `forge(1, 'sweet_bun', ...)`, `forge(1, 'sugar_cake', '2 flour, 2 sugar, 1 water_pail', 200, { byproducts: '1 pail' })` | three forge rows after `sugar_cake` |
| `src/content/itemsBrew.ts` | helper `drink(key, name, desc, spec)` sets `stack: 1`, `buffS: DRINK_BUFF_S`; six drinks `green_tea`, `black_tea_cup`, `berry_tea`, `light_roast`, `dark_roast`, `trail_blend_cup` with colours | six sweet twins |
| `src/content/recipesBrew.ts` | `bench(output, inputs)` helper (workbench) | six bench rows |
| `src/core/brewing.ts` | `CUP_ITEM = 'clay_cup'`, `DRINK_BUFFS`, `DRINK_BUFF_KEYS` | `SWEETENED` table |
| `src/sim/brewActions.ts` | `useCup` case `'done'` gives `e.drink` back and returns the cup to `'cone'`; `brewView` case `'done'` -> `` `${name(c.drink)} - take it` `` | sugar on a full cup |
| `src/game/drink.ts` | `drink()` grants `spec.buff` for `spec.buffS`, warmth, hunger; six_cups via `DRINKS.every((d) => drunk[d.key])`; toast `` `${name}: ${effect}` `` | grant `sugarS`; base-drink six_cups |
| `src/game/buffs.ts` | `sugarS`, `speedMult` = Swift x `SUGAR_SPEED_MULT`, Well-Fed burns x`SUGAR_WELL_FED_BURN_MULT` while `sugarS > 0`; snapshot `sugarS?` | unchanged (reused) |
| `src/game/hunger.ts` lines 109-112 | eating a `sugar_rush` food: `player.buffs.sugarS = Math.max(player.buffs.sugarS, food.buffS)` + `buff:gained` | same rule reused by drinks |
| `src/core/types.ts` | `DrinkSpec { buff, family, buffS, colour, warmth?, hunger? }`, `FoodSpec.buff?: 'well_fed' \| 'sugar_rush'` | two optional DrinkSpec members |
| `src/core/chem.ts` | `Component` includes `'sugars'` (bp null, colour `0xc07a18`); grades `syrup` (sugars >= 0.55), `sugar_wash` (ethanol >= 0.05, water >= 0.6), `sap` | none |
| `src/sim/distill.ts` `stepVessel` (line ~311) | ferments while sealed, `sugars` share <= `FERMENT_MAX_SUGARS` (0.3), ethanol < `FERMENT_MAX_ETHANOL` (0.14), at `FERMENT_LPS` 1.5 L/s, out 0.6 ethanol / 0.3 water / 0.09 fusel / 0.01 methanol | none (consumed) |
| `src/sim/distillActions.ts` `chemUse` (line 34) | `CHEM_CONTAINERS[heldKey]` pour path, then empty-container take path; refusal `` `The ${moduleName(e)} is full` ``; vessel blocked word `'too sweet - add water'` (line 114) | sugar dissolve path |
| `src/content/recipesDistill.ts` | `PROCESS_CARDS` incl. `card('ferment_wash', 'reaction_vessel', '1 syrup_beaker, 1 water_pail, 4 glass_beaker', '5 wash_beaker', '1 pail', 20, 110, 0, 'A/V')` | new card |
| `src/sim/distillKit.ts` `feed(card, into)` | pours only `CHEM_CONTAINERS` inputs | must also dissolve `CHEM_SOLIDS` inputs |
| `src/render/brewFx.ts` | `BrewFx` drives `Particles` with `ParticleSpec` (`look: ParticleLook.Puff`), `BREW_FX_RANGE` 48, `BREW_SOURCES` 48, scans the world | pattern to copy for `SapFx` |
| `src/render/textures/iconsSugar.ts` | palettes `GLASS`, `AMBER`, `SUGAR_W`, `CRUST`, `CHOC`; painters `beaker`, `resin`, `sugar`, `cookie`, `bun`, `cake`; `SUGAR_ICONS` | 3 new icons |
| `src/render/textures/iconsBrew.ts` | private `cupIcon(palette, extra)`; `item_green_tea: cupIcon(GREEN_TEA, ...)` (line 166) | 6 sweet icons |
| `src/audio/sfxBrew.ts` | patches `drip`, `sip` | reused |
| `src/content/specRosterGround.ts` | `GROUND_SPEC.items` lists the sugar items; `furnaceAfterWrench` lists the sugar forge rows in order | add rows |
| `src/content/specRosterFood.ts` | `FOOD_SPEC.hunger` and `.buffs` rows for the sugar foods | add rows |
| `src/content/food.test.ts` line 28 | exact sorted list of furnace food recipe ids | add 3 ids |
| tests | `src/player/sapTools.test.ts` (4 cases), `src/player/glassTap.test.ts`, `src/game/sugarRush.test.ts`, `src/sim/distillProcess.test.ts` | extend |
| `docs/api/sugar.md` "Gaps" | "The tap has no animation or particles yet", "Tapping state is not saved." | rewrite |
| e2e | sap/sugar appear only in `scripts/e2e-distill.mjs` (pours `pine_sap` into a flask, step at line 158) | new steps there |

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

All ages are written `ageIndexOf('ember')` (from `src/magic/ageMap.ts`) in new code - never `age: 0`. All furnace rows use the
local `forge(1, ...)` helper (tier 1 = Clay Furnace) and stay below the stick flame (450 C) so `food.test.ts` "cooks in a Clay
Furnace that only burns sticks" still passes.

### 4.1 The tap (state, bead, drips)

Numbers (all in `src/player/sapTools.ts`, exported):

| constant | value | status | meaning |
|---|---|---|---|
| `TAP_COOLDOWN_S` | 120 | exists | seconds before the same log gives sap again; the bead grows over exactly this time |
| `BEAD_LINGER_S` | 600 | NEW | a full bead stays visible this long after it is ready, then the entry is forgotten (the log is simply ready, like any untapped log) |
| `MAX_TAPS` | 256 | NEW (replaces the literal `256` in `update`) | most entries kept and saved; the oldest are dropped first |
| `SAP_SIDE_FACES` | `[Face.PX, Face.NX, Face.PZ, Face.NZ]` | NEW | faces a bead may hang on |

Why 600 s linger: long enough that a player walking a ring of tapped pines sees which ones are ready ("fat bead = go"), short
enough that a forest does not fill with permanent beads. After the linger, an untapped-looking log is also ready, so nothing
lies to the player.

**Face.** The tapped face is `hit.face`. A bead cannot hang on the top or bottom of a log, so if `hit.face` is `Face.PY` or
`Face.NY` the bead goes on the side face that points toward the player: compare `|dx|` and `|dz|` of
`player.position - (cell centre)`; the larger axis wins, sign picks `PX/NX` or `PZ/NZ`. Pure helper `sideFaceToward(face, dx, dz)`.

**Bead growth.** `fill = clamp(ageS / TAP_COOLDOWN_S, 0, 1)` where `ageS = clock - tappedAt`. Visual radius
`r = BEAD_MIN_R + (BEAD_MAX_R - BEAD_MIN_R) * easeOutQuad(fill)`, `BEAD_MIN_R` 0.025, `BEAD_MAX_R` 0.075 blocks (render constants
in `sapFx.ts`). The bead sits 0.01 block out from the face, at height `y + 0.32` (low on the log, where a beaker would be held),
centred horizontally on the face. It sags: scale y = `1 + 0.25 * fill` (a teardrop, not a sphere).

**Drips.** While `fill < 1`, each visible bead emits one drip every `DRIP_EVERY_S` 2.5 s (jittered +-0.5 s): an amber particle
born 0.25 block above the bead, falling to the bead (`vy` -0.35, gravity 0, life 0.7 s, size 0.035 -> 0.02, colour `0xe3a02c` ->
`0xc07a18`, `look: ParticleLook.Puff`). At most `SAP_FX_BEADS` 24 beads drip at once (nearest to the camera within
`SAP_FX_RANGE` 32 blocks) - with one live drip each that is <= 24 particles, the T9 per-emitter cap. A full bead does not drip.

**Glint when ready.** A full bead's material emissive pulses between 0.05 and 0.35 with a 2.4 s period (sine). One shared
material, so all ready beads pulse in phase (cheap; reads as "these are the ready ones").

**Bead mesh.** One `THREE.InstancedMesh` of `IcosahedronGeometry(1, 1)` with `MeshStandardMaterial({ color: 0xe3a02c, roughness:
0.25, metalness: 0, emissive: 0xc07a18, emissiveIntensity: 0.05, transparent: true, opacity: 0.88 })`, `count` capped at
`SAP_FX_BEADS` 24 (nearest first). Two instanced meshes are not needed: the glint is per-material, so ready and growing beads use
two meshes sharing the geometry (`growing`, `ready`), each with up to 24 instances. Matrices are written in place into a preallocated
`Matrix4`; no per-frame allocation (T9/6d).

### 4.2 Baked goods (NEW items, all Ember, all furnace forge at tier 1)

Reasoning anchor (existing): sugar 1 hunger / 45 s rush; cookie 3 / 90; bun 6 / 150; cake 9 / 240; bread 6 / no buff;
wildberries 2 raw. Rush never stacks (longest wins), so a food's **per-item** rush length is what matters, and its hunger is what
it costs you in Well-Fed (rush burns Well-Fed x2.5).

| key | display name | stack | recipe (forge, Clay Furnace) | hunger | Sugar Rush | why |
|---|---|---|---|---|---|---|
| `toffee` | Toffee | 32 | `forge(1, '4 toffee', '2 sugar', 160)` | 1 | 75 s | Sugar alone: the farm-free sweet. Twice as much rush per sugar as raw sugar (4 x 75 vs 2 x 45 per 2 sugar) and pocketable (stack 32 like `sugar`; T4 allows 16/8 for foods, 32 argued: it is a sweet the size of a sugar lump and `sugar` itself is 32). 160 C = the caramel point. |
| `berry_tart` | Berry Tart | 16 | `forge(1, '2 berry_tart', '1 flour, 1 sugar, 2 wildberries', 210)` | 5 | 120 s | Ties the berry bushes into the kitchen. 2 tarts = 10 hunger from berries (4) + flour + sugar: a fair upgrade, between bun and cake in rush. |
| `syrup_bread` | Syrup Bread | 16 | `forge(1, '2 syrup_bread', '1 dough, 1 syrup_beaker', 220, { byproducts: '1 glass_beaker' })` | 7 | 180 s | The first food that needs the still (`distil_syrup` card makes `syrup_beaker`). Best single-item rush short of cake, more filling than bread (6), the beaker comes back (T1 rule 3 in spirit: containers come back). 220 C = bread's bake temperature. |

Tooltips (`desc`, T8 voice: names the use and the number):

- `toffee`: `"Sugar cooked to a hard amber sweet at 160 C. Light and quick: a 75 s Sugar Rush in your pocket, but Well-Fed wears off quicker while it lasts."`
- `berry_tart`: `"Flour, sugar and wildberries baked at 210 C. A real meal (5 food) and a 2 min Sugar Rush."`
- `syrup_bread`: `"Dough brushed with pine syrup and baked at 220 C. Filling (7 food) with a 3 min Sugar Rush; the beaker comes back."`

`SUGAR_RUSH_S` gains `toffee: 75, berry_tart: 120, syrup_bread: 180` (one table for every rush length; the roster mirrors it).

### 4.3 Sweetened drinks (NEW items)

Rule (SYSTEMS T5, canonical): a drink made with sugar grants its buff for `SWEET_DRINK_BUFF_S` 270 s (= 1.5 x `DRINK_BUFF_S`
180) plus `SWEET_DRINK_SUGAR_S` 30 s of Sugar Rush. Both constants are NEW in `src/core/constants.ts` next to `DRINK_BUFF_S`:

```ts
/** A drink sweetened with sugar lasts half again as long (SYSTEMS T5). */
export const SWEET_DRINK_BUFF_S = DRINK_BUFF_S * 1.5; // 270
/** ...and starts a short Sugar Rush on top. */
export const SWEET_DRINK_SUGAR_S = 30;
```

Why 30 s of rush: it is a taste, not a meal - shorter than raw sugar (45 s), so a sweet drink never replaces eating sugar, and the
Well-Fed cost (30 s x 2.5 = 75 s of Well-Fed burnt instead of 30 s) is small. The x1.5 is "stronger means longer" (T5: there are no
strength levels). Elixirs (Unit 10) at 540 s stay the top of the ladder: cup 180 < sweet cup 270 < elixir 540.

| key (NEW) | display name | sweet of | buff | buff time | rush | extra kept from base |
|---|---|---|---|---|---|---|
| `sweet_green_tea` | Sweet Green Tea | `green_tea` | spring | 270 s | 30 s | - |
| `sweet_black_tea` | Sweet Black Tea | `black_tea_cup` | hearthkept | 270 s | 30 s | `warmth: HEARTHKEPT_DRINK_WARMTH` |
| `sweet_berry_tea` | Sweet Berry Tea | `berry_tea` | mending | 270 s | 30 s | - |
| `sweet_light_roast` | Sweet Light Roast | `light_roast` | swift | 270 s | 30 s | - |
| `sweet_dark_roast` | Sweet Dark Roast | `dark_roast` | vigor | 270 s | 30 s | - |
| `sweet_trail_blend` | Sweet Trail Blend | `trail_blend_cup` | lasting | 270 s | 30 s | - |

Key naming: `sweet_` + the base drink's name in snake case (not its key: `black_tea_cup` and `trail_blend_cup` carry `_cup` only to
dodge the ingredient keys `black_tea` / `trail_blend`; `sweet_black_tea` collides with nothing). Grep before merge: none of the six
keys exists today.

All six: `category: 'food'`, `age: ageIndexOf('ember')`, `stack: 1` (like every drink: the cup is the stack), colour = base colour
(the tint quad in the cup; sugar does not change the colour). `drink: { ...base.drink, buffS: SWEET_DRINK_BUFF_S, sugarS:
SWEET_DRINK_SUGAR_S, sweetOf: '<base key>' }`. Built by a helper so the base and its twin can never drift:

```ts
// src/content/itemsBrew.ts (NEW helper, appended after BREW_ITEMS is defined)
function sweeten(base: ItemSpec, key: string): ItemSpec {
  if (!base.drink) throw new Error(`content: ${base.key} is not a drink`);
  return {
    key, name: `Sweet ${base.name}`, category: 'food', age: ageIndexOf('ember'), stack: 1,
    desc: `${base.name} with a spoon of sugar stirred in. ${DRINK_BUFFS[base.drink.buff].name} lasts 4.5 minutes instead of 3, with a 30 s Sugar Rush. Returns the cup.`,
    drink: { ...base.drink, buffS: SWEET_DRINK_BUFF_S, sugarS: SWEET_DRINK_SUGAR_S, sweetOf: base.key },
  };
}
export const SWEET_DRINK_ITEMS: ItemSpec[] = Object.entries(SWEETENED).map(([base, sweet]) => sweeten(BREW_ITEMS.find((i) => i.key === base)!, sweet));
```

Example tooltip: `"Light Roast with a spoon of sugar stirred in. Swift lasts 4.5 minutes instead of 3, with a 30 s Sugar Rush. Returns the cup."`
Register `SWEET_DRINK_ITEMS` in the items index right after `BREW_ITEMS` (find where `BREW_ITEMS` is spread in
`src/content/index.ts`/`items.ts` and append; append-only rule, §2).

`SWEETENED` (NEW, `src/core/brewing.ts`, pure data next to `CUP_ITEM`):

```ts
/** A drink -> the same drink with sugar stirred in (Unit 5). Sweet drinks are never sweetened again. */
export const SWEETENED: Readonly<Record<string, string>> = {
  green_tea: 'sweet_green_tea', black_tea_cup: 'sweet_black_tea', berry_tea: 'sweet_berry_tea',
  light_roast: 'sweet_light_roast', dark_roast: 'sweet_dark_roast', trail_blend_cup: 'sweet_trail_blend',
};
export const SUGAR_ITEM = 'sugar';
```

Validation: `src/core/brewValidation.ts` (it already validates brewing tables against content) gains: every key and value of
`SWEETENED` is a registered drink item; every value's `drink.sweetOf` equals its key; no value is itself a key.

**Two ways to sweeten (both Ember):**

1. **In the world (the fun one).** Use Sugar on a cup block in stage `'done'` (`cup_full`). The cup entity's `drink` becomes
   `SWEETENED[drink]`, one sugar is consumed, sfx `cup_stir`, a short toast `"Stirred in the sugar: Sweet Green Tea"`. The crosshair
   then reads `"Sweet Green Tea - take it"` (existing `brewView` 'done' text, it just names the new drink). Taking it gives the
   sweet drink. Uses the existing `BrewResult` `{ ok: true, consume: true }` - no new result shape.
2. **At the workbench (for cups already in the pack, and for helpers).** Six rows `bench('sweet_green_tea', '1 green_tea, 1 sugar')`
   ... in `recipesBrew.ts`. Output stack 1; no byproduct (the cup is inside the drink).

Drinks still return the clay cup when drunk (`drink()` unchanged in that respect).

### 4.4 Sugar as a chemistry input

`CHEM_SOLIDS` (NEW, `src/core/distill.ts`, next to `CHEM_CONTAINERS`):

```ts
/** Solid items that dissolve into a vessel's mix when Used on it (T3: a table row, not a code path). */
export interface ChemSolid { component: Component; litres: number }
export const CHEM_SOLIDS: Readonly<Record<string, ChemSolid>> = {
  // One sugar = 25 L of sugars. Ten sugars and a bucket of water ferment to five beakers of wash.
  sugar: { component: 'sugars', litres: 25 },
};
export const SOLIDS_INTO: ReadonlySet<ChemKind> = new Set(['reaction_vessel', 'boiling_flask']);
```

Why 25 L: SYSTEMS T4 row ("sugar item Use on a vessel adds 25 L sugars"). Checked against the existing fermenter: 10 sugar
(250 L sugars) + 1 water pail (1000 L) = 1250 L, sugars share 0.20 (<= `FERMENT_MAX_SUGARS` 0.3, ferments). Fermenting 250 L of
sugars gives 150 L ethanol, +75 L water, 22.5 L fusel, 2.5 L methanol; total stays 1250 L. Final shares: water 0.86, ethanol 0.12
(< `FERMENT_MAX_ETHANOL` 0.14, so the batch finishes by running out of sugar, not by poisoning itself) -> `nameOf` = `sugar_wash`
(needs ethanol >= 0.05, water >= 0.6). 1250 L = exactly 5 wash beakers. Time: 250 / `FERMENT_LPS` 1.5 = 167 s.

Cost comparison (to show it is a sidegrade, not a replacement): the syrup route needs a still rig and 4 pine sap for 162.5 L of
sugars (one syrup beaker); the sugar route needs 10 sugar = 3.33 forge runs = 6.67 resin = 6.67 sap beakers for 250 L - more sap,
but no Boiling Flask, Condenser or Receiver: a Reaction Vessel and an Airlock Cap on the floor suffice. Too sweet: 18 sugar in one
bucket = 450/1450 = 0.31 > 0.3 -> the vessel shows the existing blocked word `"too sweet - add water"`.

Process card (NEW, appended to `PROCESS_CARDS`, after `ferment_wash`):

```ts
card('ferment_sugar_wash', 'reaction_vessel', '10 sugar, 1 water_pail, 5 glass_beaker', '5 wash_beaker', '1 pail', 20, 170, ageIndexOf('ember'), 'A/V'),
```

(5 beakers in, 5 wash beakers out: the card counts the empty beakers that carry the wash out, like `ferment_wash` counts 4 + the
syrup beaker. The `age` argument of `card()` is a plain number: pass `ageIndexOf('ember')`, not the literal 0 the older rows use.)

A flask also takes sugar (`SOLIDS_INTO` includes `boiling_flask`): sugar dissolved into a flask of water makes syrup-like liquor
when boiled down (water leaves, `sugars` stays) - this needs no new code (bp null components stay behind) and gives Unit 10 a way to
make syrup without sap. Not advertised with a card (no new card needed; mention in `docs/api/sugar.md`).

### 4.5 Side goal (T7)

```ts
// src/content/objectivesSugar.ts (NEW)
export const SUGAR_SIDE_GOALS: ObjectiveSpec[] = [{
  id: 'tap_and_wait', title: 'Tap a pine twice', age: ageIndexOf('ember'),
  text: 'Catch sap from a pine log, then wait for the amber bead to fill (2 min) and tap the same log again.',
  condition: { type: 'flag', flag: 'tapped_twice' },
  reward: [{ item: 'toffee', count: 4 }],
}];
```

Flag `tapped_twice` (NEW, past tense per §4) is emitted by `SapTools.use` when a successful tap lands on a cell that still had an
entry (it was tapped before and has refilled). Emitted every time (the tracker dedupes flags); cheap.

### 4.6 T4 material web rows (this unit's, for the coordinator to merge into SYSTEMS §3 T4)

| item / fluid | made by | consumed by | age | stack |
|---|---|---|---|---|
| `sugar` (existing) | forge from resin | baked goods (cookie, bun, cake, toffee, tart); sweet drinks (cup Use, workbench); vessel `sugars` -> wash (distillery); Unit 10 syrup base | ember | 32 |
| `syrup_beaker` (existing) | `distil_syrup` card | `ferment_wash` (existing); `syrup_bread` (NEW consumer); Unit 10 elixirs | ember | 16 |
| `wildberries` (existing) | berry bushes | food raw; `berry_tea_blend`; `berry_tart` (NEW consumer) | ember | (existing) |
| `toffee`, `berry_tart`, `syrup_bread`, six `sweet_*` | this unit | player (end products) | ember | 32/16/16/1 |

---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour and rules (with edge cases)

### 5.1 Tapping

Unchanged rules: only `SAP_LOGS` (`pine_log`); held `glass_beaker` or `glass_vial`; Shift (forcePlace) skips tapping; the refusal
on a recovering log is the existing `"This log is still weeping: give it 40 s"` (rounded up to 10 s); full pack refusal
`"Your pack is full"` puts the glass back and does NOT record a tap (no bead).

New:
1. A successful tap records `{ at: clock, face }` (face per 4.1) and emits sfx `sap_tap` (NEW) instead of `sip` - `sip` is the
   drinking sound and was a stand-in. Volume 0.6 (small tier), positioned at the face. Toast unchanged.
2. If the cell already had an entry whose wait was 0 (bead full or lingering), the tap succeeds as before, replaces the entry
   (new face, new clock) and emits `bus.emit('flag', { flag: 'tapped_twice' })`.
3. **Log broken or replaced.** `SapTools` subscribes to `'block:changed'` on the bus; if the changed cell is in the map and the new
   voxel's block key is not in `SAP_LOGS`, the entry is deleted (the bead vanishes with the log). A pine log placed back at the
   same cell starts fresh (ready, no bead). Unloaded chunks never fire the event, so their beads survive.
4. **Pruning.** `update(dt)` drops entries with `ageS >= TAP_COOLDOWN_S + BEAD_LINGER_S`; if the map still exceeds `MAX_TAPS`, it
   drops the oldest. Prune runs at most once per second (a `pruneTimer`), not every frame.
5. **Clock across saves.** The clock is session time; saving writes each entry's `ageS` (clock - at), loading sets
   `at = clock - ageS`. Time does not pass while the game is closed (consistent with every other timer in the game: crops, buffs,
   furnace fuel all pause in a closed save).
6. **Respawn / death.** Taps are world state, not player state: unaffected.
7. **Dev Mode / creative.** No special case.

### 5.2 Baked goods

Ordinary forge recipes: shown at the furnace screen FORGE tab, locked rows say what they need as every other row does. Eating:
the existing `eat` path in `src/game/hunger.ts` (lines 104-112) already handles `food.buff === 'sugar_rush'`: longer rush wins,
`buff:gained` emitted. Foods with a buff may be eaten on a full stomach (existing rule in `FoodSpec` comment).

### 5.3 Sweetening a cup in the world

`useCup` in `src/sim/brewActions.ts`, case `'done'`, before the take:

| held | cup drink | result |
|---|---|---|
| `sugar` | a key in `SWEETENED` | `e.drink = SWEETENED[drink]`, `{ ok: true, consume: true }`; sfx `cup_stir` at the cup; toast `"Stirred in the sugar: Sweet Green Tea"` (via the brew host's bus, kind `'good'`, item = sweet key) |
| `sugar` | already sweet (`drink.sweetOf` set) | refuse `"It is already sweet - take it"` |
| `sugar` | not in the table (future drinks) | refuse `"Sugar does not go in this"` |
| anything else / empty hand | any | existing take behaviour (gives the drink, cup back to `'cone'`) |

Other stages with sugar held: `'cup'` -> existing `"Set a drip cone on the cup"`; `'cone'` -> existing
`"Load the cone with tea leaves or ground coffee"` (sugar has no `brews`); `'loaded'` -> existing `"Pour boiling water over it"`;
`'brewing'` -> existing `"Still dripping"`. No new refusal there: the rule "sugar goes in the finished cup" is taught by the item
description of `sugar` (updated, 6.1) and by the cup line.

Note: today `brewUse` passes `held` but the empty-hand take is triggered by any held item that is not special. With sugar now
special in 'done', a player holding sugar who wants the unsweetened drink must switch slot - acceptable, and the refusal text makes
the alternative obvious for the already-sweet case.

Workshop deployers (`actHook` -> `sim.stroke`) do not reach `brewUse`; sweetening by automation goes through the workbench recipe
(an arm on a crafting station) or is out of scope.

### 5.4 Drinking a sweet drink

`drink()` in `src/game/drink.ts`:
1. Grants `spec.buff` for `spec.buffS` (270) through `buffs.grant` - same family slot, same refresh/replace rules (T5). A sweet
   Light Roast while an unsweetened Light Roast runs with 100 s left: refresh to 270. An unsweetened cup while a sweet one runs with
   200 s left: stays 200 (never shortens).
2. If `spec.sugarS > 0`: `buffs.sugarS = Math.max(buffs.sugarS, spec.sugarS)` and a second `buff:gained` `{ buff: 'sugar_rush',
   durationS: spec.sugarS }` (only when it actually lengthened the rush).
3. Toast: the existing text plus `", and a Sugar Rush"` when the rush was granted: `"Swift: Walk, sprint and swim 20% faster, and a
   Sugar Rush"`. Replacement case: `"Swift replaces Vigor, and a Sugar Rush"`.
4. six_cups: `const base = spec.sweetOf ?? item;` record `drunk[item]` as today (stats), but the flag check becomes
   `DRINKS.filter((d) => !d.drink!.sweetOf).every((d) => drunk[d.key] || drunk[SWEETENED[d.key]])` - a sweet cup counts for its
   base. `firstOfKind` is evaluated on `base`.
5. `player:drank` carries the actual item (sweet key).

### 5.5 Sugar into a vessel

`chemUse` in `src/sim/distillActions.ts`, right after the `heldKey === null` branch and BEFORE `CHEM_CONTAINERS` (and before Unit
0's slot path):

```ts
const solid = CHEM_SOLIDS[heldKey];
if (solid) {
  if (!SOLIDS_INTO.has(e.kind)) return { ok: false, reason: `Stir it into a Reaction Vessel or a Boiling Flask, not ${an(moduleName(e))}` };
  const room = CHEM_CAPACITY_L[e.kind] - total(e.mix);
  if (room < solid.litres) return { ok: false, reason: `The ${moduleName(e)} is full` };
  add(e.mix, solid.component, solid.litres);
  d.touched();
  return { ok: true, consume: true, toast: `${itemOrNull(heldKey)?.name ?? heldKey} stirred in (${litresText(total(e.mix))})` };
}
```

Toast example: `"Sugar stirred in (1.3 buckets)"` (litres per T8: below 1000 `<n> L`, else buckets - `litresText` already does it).
Litres are created from the item, which is consumed: conservation in the T3 sense is "nothing creates litres for free"; this is a
declared conversion like pouring a beaker. A dry vessel (no water) takes sugar fine; pure sugars share 1.0 > 0.3, so it shows
`"too sweet - add water"` once sealed - the fix is in the text.

An open (unsealed) vessel with sugar water: existing word `'open (an Airlock Cap ferments it)'`.

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Strings (exact; T8 grammar)

Crosshair (pine log, from `SapTools.label(x, y, z, heldItem)`; returns null when nothing special, so the plain block name shows):

| situation | line |
|---|---|
| tapped, recovering | `"Pine Log - weeping, ready in 40 s"` / `"Pine Log - weeping, ready in 1.5 min"`. Wait text from a NEW pure `waitText(s)` in `sapTools.ts`: under 60 s -> `Math.ceil(s / 10) * 10` + ` s` (the same rounding as the existing refusal, so line and refusal agree); 60 s and over -> `Math.ceil(s / 30) / 2` + ` min` (`1.5 min`, `2 min`). Do NOT use `formatCountdown` (`src/ui/hud/hudMath.ts`): it prints `2 m`, not the T8 `min`. |
| tapped, bead full (lingering) | `"Pine Log - a full bead, ready to tap"` |
| not tapped, holding `glass_beaker` or `glass_vial` | `"Pine Log - Use the beaker to catch its sap"` |
| not tapped, other item | null (plain `"Pine Log"`) |

Refusals and toasts:

| where | text | kind |
|---|---|---|
| tap, recovering (existing) | `This log is still weeping: give it 40 s` | advise |
| tap, full pack (existing) | `Your pack is full` | advise |
| tap ok (existing) | `You catch a beaker of sticky sap` | toast good |
| cup sweetened | `Stirred in the sugar: Sweet Green Tea` | toast good |
| cup already sweet | `It is already sweet - take it` | refusal |
| cup drink not sweetenable | `Sugar does not go in this` | refusal |
| sugar on wrong chem module | `Stir it into a Reaction Vessel or a Boiling Flask, not a Receiver` | refusal |
| vessel full | `The Reaction Vessel is full` (existing pattern) | refusal |
| sugar dissolved | `Sugar stirred in (1.3 buckets)` | toast |
| sweet drink drunk | `Swift: Walk, sprint and swim 20% faster, and a Sugar Rush` | toast good |
| side goal | `Side goal: Tap a pine twice` (Unit 0 mechanism) | toast |

Description updates (existing items, append-only edits of `desc`):
- `sugar`: `"Pale crystals distilled from resin. Bake with it, stir it into a finished cup (the drink lasts half again as long), or Use it on a Reaction Vessel to sweeten a wash. Eaten alone: a short Sugar Rush."`
- `glass_beaker`: unchanged.
- `pine_sap`: unchanged.

Food card (`src/ui/screens/food.ts`): `foodText` already prints `"Sugar Rush 2 min"` from `buffS`; `drinkText` prints
`` `${name} ${buffDuration(drink.buffS)}` `` -> `"Swift 4.5 min"`. Extend `drinkText`: when `drink.sugarS` append
`` ` + Sugar Rush ${buffDuration(drink.sugarS)}` `` -> `"Swift 4.5 min + Sugar Rush 30 s"`. (Check `buffDuration` output for 30 and 270;
if it prints `0.5 min`, special-case seconds under 60 as `N s`, T8.)

HUD: no new pill. Sugar Rush pill (`vitals.ts`, "Sugar Rush" with `clockTime`) and drink pills already show. A sweet drink shows
two pills (e.g. "Swift 4:30", "Sugar Rush 0:30"), order per T5 (sugar before tea/coffee) - already the order in `Buffs.active()`.

### 6.2 Phone layout

No new screen, no new button. Every action is a Use on a block with an item held (tap, sweeten, dissolve) or a workbench row
(existing screen, 44 px rows). Crosshair lines are <= 60 characters (longest: `"Pine Log - Use the beaker to catch its sap"`, 42).
Toasts <= 60 characters (longest: `"Stir it into a Reaction Vessel or a Boiling Flask, not a Receiver"` is 64 - acceptable as a toast,
which wraps; the crosshair rule is the 60 limit). Verify at 390 px portrait in the e2e screenshot that the pine log line fits on one
line.

### 6.3 Sound (T9)

NEW `src/audio/sfxSugar.ts` exporting `SUGAR_SFX` (merged in `src/audio/sfx.ts` like `MAGIC_SFX`), names added to the `SfxName`
union in `src/core/gameEvents.ts` under a `// ---- sugar (Unit 5) ----` comment:

| name | when | loudness | patch idea (synth, like `sfxBrew.ts`) |
|---|---|---|---|
| `sap_tap` | a successful tap | 0.6 (small) | a soft glassy "tink" (sine 1800 Hz, 40 ms, fast decay) then a sticky low pull (filtered noise 300-600 Hz, 180 ms, slow attack) |
| `cup_stir` | sugar stirred into a cup | 0.6 (small) | three quick spoon-on-ceramic ticks (triangle 2400 Hz, 25 ms each, 90 ms apart, falling volume) |

Drips are visual only: no sound per drip (a forest of beads would tick constantly; 6d "sounds that loop while idle"). The existing
`drip` patch is NOT used for beads. When a bead becomes full, no sound (state change is visual; a sound from a log you may not be
looking at would confuse).

`src/audio/sfx.test.ts`: `expect(SFX_NAMES.length).toBe(72 + Object.keys(MAGIC_SFX).length + Object.keys(SUGAR_SFX).length)`.

### 6.4 Particles and animation

As 4.1. Visual vocabulary T9: amber = working (drips running, bead growing), the full bead's glint = done (amber, not green: a
green bead would look wrong on a tree; the "done" signal is the glint and the stop of the drips - document this exception in
`docs/api/sugar.md`). No red state (the tap has no blocked state).

Sweetening a cup adds no particle effect: the `cup_stir` sound, the toast and the renamed crosshair line are the feedback; the cup's
existing `BrewFx` steam carries on unchanged.

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

### 7.1 Types

```ts
// src/player/sapTools.ts
export interface SapTap { at: number; face: Face }            // in memory; at = SapTools clock seconds
export interface SapBead { x: number; y: number; z: number; face: Face; fill: number }  // 0..1; 1 = ready (render + crosshair)
/** world.persist('sap') payload. Every field optional; anything malformed is dropped on load. */
export interface SapSnapshot {
  /** "x,y,z" -> [ageS, face]. ageS = seconds since tapped when saved. */
  taps?: Record<string, [number, number]>;
}

export class SapTools {
  // existing: update, waitS, use
  /** NEW: fills caller-owned `out` (preallocated SapBead objects) with every live bead; returns the count. Allocation-free.
   *  Nearest-first selection and the 24 cap are the renderer's job. */
  beads(out: SapBead[]): number;
  /** NEW: crosshair line for a sap log, or null. */
  label(x: number, y: number, z: number, held: string | null): string | null;
  /** NEW */ toJSON(): SapSnapshot;
  /** NEW: tolerant; replaces the current map. */ load(data: unknown): void;
  /** NEW: unsubscribes the 'block:changed' listener. */ dispose(): void;
}

// src/core/types.ts DrinkSpec (two OPTIONAL members, SYSTEMS §6.5 allows optional additions)
export interface DrinkSpec { /* existing */ sugarS?: number; sweetOf?: string }
```

`beads(out)` writes into `out[0..n-1]` (the renderer preallocates `MAX_TAPS` objects once) and returns `n`; it never allocates.
`fill = clamp((clock - at) / TAP_COOLDOWN_S, 0, 1)`.

The `SapToolsHost` gains nothing; `SapTools` gets the bus from the host already (`host.bus`) for `'block:changed'`, `'flag'` and
`'sfx'`. Block key from voxel: use the registry helper `blockOf(voxelId)` as `createRayHit` does (`blockOf(0)`); check the exact name
of the voxel->id accessor in `src/core/types.ts` (`makeVoxel` exists; its inverse is the one to use).

### 7.2 Save / load rules (T10)

- Saved under the world extras key `'sap'` (not the player snapshot: taps belong to the world, and a second player profile on the
  same world would see the same beads). No `SAVE_VERSION` bump, no `WORLD_SNAPSHOT_VERSION` bump.
- `toJSON()` writes at most `MAX_TAPS` entries: `taps[cell] = [round1(clock - at), face]`; entries past
  `TAP_COOLDOWN_S + BEAD_LINGER_S` are not written. Empty map -> `{}`.
- `load(data)`: `this.tappedAt.clear()`; if `data` is not an object or `taps` is not a plain object, stop (= every log ready, the
  old default). For each entry: cell must match `/^-?\d+,-?\d+,-?\d+$/`; `ageS` finite and `>= 0` (clamp; drop if beyond cooldown +
  linger); `face` integer in `SAP_SIDE_FACES`, else `Face.PZ`. `at = this.clock - ageS`. Max `MAX_TAPS` entries read (extra ignored).
- Old saves (no `'sap'` extra): `world.extra('sap')` is `undefined` -> load is a no-op -> identical to today's behaviour.
- Note: `world.toJSON` merges `loadedExtras` with savers; registering the saver means the key is rewritten each save.

### 7.3 Wiring in `src/app/game.ts`

After the controller is built (line ~236):

```ts
const sap = this.controller.interaction.sap;
sap.load(world.extra('sap'));
this.offs.push(world.persist('sap', () => sap.toJSON()));
this.offs.push(() => sap.dispose());
this.renderer.setSapBeads((out) => sap.beads(out));
```

`Interaction.sap` changes from `private readonly sap` to `readonly sap` (public, read-only reference). No other Interaction change.

Brew entities (sweet cups) need no save change: `BrewCup.drink` is a string key; `src/sim/sanitize.ts` validates it against the
registry and the six new keys are registered. Vessels need no save change: `sugars` is an existing component in `mix`.

---------------------------------------------------------------------------------------------------------------------------

## 8. Implementation plan (ordered)

1. **Constants and types.** `src/core/constants.ts`: `SWEET_DRINK_BUFF_S`, `SWEET_DRINK_SUGAR_S`. `src/core/types.ts`: optional
   `DrinkSpec.sugarS`, `DrinkSpec.sweetOf`. `src/core/brewing.ts`: `SWEETENED`, `SUGAR_ITEM`. `src/core/distill.ts`: `ChemSolid`,
   `CHEM_SOLIDS`, `SOLIDS_INTO`.
2. **Content.** `src/content/itemsSugar.ts`: extend `SUGAR_RUSH_S`; append `toffee`, `berry_tart`, `syrup_bread` to `SUGAR_ITEMS`
   with `age: ageIndexOf('ember')` (import from `../magic/ageMap`; check content files may import it - if `src/content` must not depend
   on `src/magic` - it already does: `src/content/itemsWorkshop.ts` imports `ageIndexOf` from `'../magic/ageMap'`). Update the `sugar` desc.
   `src/content/itemsBrew.ts`: `sweeten()` + `SWEET_DRINK_ITEMS`; register them after `BREW_ITEMS`.
   `src/content/recipes.ts`: three `forge(1, ...)` rows directly after the `sugar_cake` row (comment `// Unit 5: more sweet baking.`).
   `src/content/recipesBrew.ts`: six `bench(...)` rows appended at the end.
   `src/content/recipesDistill.ts`: `ferment_sugar_wash` card after `ferment_wash`.
   `src/content/objectivesSugar.ts` (NEW): `SUGAR_SIDE_GOALS`; add to `SIDE_OBJECTIVES` in `objectivesSide.ts` (Unit 0 file).
3. **Validation.** `src/core/brewValidation.ts`: `SWEETENED` checks (4.3).
4. **Progression solver.** `src/content/progression.ts`: nothing for the forge/bench rows (they are ordinary recipes).
   The process card is a `chem` station recipe: `chemReady` handles cards generically - confirm `ferment_sugar_wash` resolves
   (inputs sugar, water_pail, glass_beaker all reachable in Ember). `content.test.ts` must still complete.
5. **Brew sim.** `src/sim/brewActions.ts` `useCup` case `'done'`: sugar branch (5.3). The toast and sfx: `BrewResult` has no toast
   field; emit via `b.bus.emit('toast', ...)` and `b.bus.emit('sfx', { name: 'cup_stir', x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5 })`
   (the `'loaded'` case already emits `pour` this way).
6. **Drinking.** `src/game/drink.ts`: sugar rush grant, toast suffix, base-drink six_cups (5.4).
7. **Chem.** `src/sim/distillActions.ts` `chemUse`: solids branch (5.5). `src/sim/distillKit.ts` `feed()`: also dissolve
   `CHEM_SOLIDS` inputs: `for (const i of card.inputs) { const s = CHEM_SOLIDS[i.item]; if (s) add(into.mix, s.component, i.count * s.litres * k); }`
   and include their litres in the `litres` sum used for `k`.
8. **Sap state.** `src/player/sapTools.ts`: `SapTap` map value (was number), face via `sideFaceToward`, `sap_tap` sfx, `tapped_twice`
   flag, `'block:changed'` listener, prune timer, `beads(out)`, `label(...)`, `toJSON`, `load`, `dispose`. Update the header comment
   (it now IS saved). Keep `waitS` semantics (tests use it).
   `src/player/interaction.ts`: make `sap` public readonly.
9. **Game wiring.** `src/app/game.ts`: load/persist/dispose (7.3); crosshair: in `showStationName()` add, before the goggles
   branch: `else if (hit && SAP_LOGS.has(hit.block.key) && (label = this.controller.interaction.sap.label(hit.x, hit.y, hit.z, this.state.player.heldStack()?.item ?? null)) !== null) { /* sap log */ }`.
   Because `showStationName` caches by label string, the line only re-renders when `waitText` changes (every 10 s under a minute,
   every 30 s above) - visible progress, no per-frame DOM work.
10. **Render.** `src/render/sapFx.ts` (NEW): `export class SapFx { readonly group: THREE.Group; constructor(particles: Particles); update(dt: number, camX: number, camY: number, camZ: number, beads: readonly SapBead[], count: number): void; dispose(): void }`
    with constants `SAP_FX_BEADS` 24, `SAP_FX_RANGE` 32, `DRIP_EVERY_S` 2.5, `BEAD_MIN_R` 0.025, `BEAD_MAX_R` 0.075. Pure helper
    exported for tests: `beadTransform(bead: SapBead, out: { x: number; y: number; z: number; r: number; sy: number }): void` (face
    offset + growth curve). Renderer (`src/render/renderer.ts`): construct after `brewFx`, add `sapFx.group` to the scene, a field
    `private sapFeed: ((out: SapBead[]) => number) | null`, public `setSapBeads(feed)`, and in the frame update call the feed into a
    preallocated `SapBead[]` (MAX_TAPS objects) then `sapFx.update(...)`. Renderer must not import `src/player` at runtime: import
    the `SapBead` type with `import type` only.
    Render does not import `src/player/sapTools.ts` constants at runtime; `TAP_COOLDOWN_S` is not needed by render (fill comes in).
11. **Icons.** `src/render/textures/iconsSugar.ts`: `item_toffee` (two twisted amber sweets: AMBER ramp, a highlight pixel each),
    `item_berry_tart` (CRUST shell, 3-4 red berry pixels using the wildberry red from the berry icon palette, a sugar sparkle
    SUGAR_W[4]), `item_syrup_bread` (bread loaf in CRUST with an AMBER glaze band on top). `src/render/textures/iconsBrew.ts`: six
    `item_sweet_*` = the base drink's `cupIcon(...)` painter plus a 2x2 sugar cube (`SUGAR_W`-like whites, define a local
    `SUGAR_CUBE = [0xcbc6b4, 0xf6f3e8, 0xffffff]`) on the rim at (11,5)-(12,6). Must pass `readability.test.ts`.
12. **Sound.** `src/audio/sfxSugar.ts` (NEW), merge in `src/audio/sfx.ts`, names in `SfxName`, `sfx.test.ts` count.
13. **Food card.** `src/ui/screens/food.ts` `drinkText`: the `+ Sugar Rush` suffix.
14. **Docs** (section 11), **tests** (section 9), **e2e** (section 10).

Helpers to reuse (do not rewrite): `forge`/`bench` local helpers, `amounts`, `itemOrNull`, `an`, `moduleName`, `litresText`,
`add`/`total`/`share` from `core/chem`, `Buffs.grant`, `makeStack`, `record(bus, ...)` and `flatWorld`/`makePlayer` from
`src/player/testKit.ts`, `buildRig`/`feed`/`runUntil` from `src/sim/distillKit.ts`.

---------------------------------------------------------------------------------------------------------------------------

## 9. Tests (vitest)

### 9.1 `src/player/sapTools.test.ts` (extend; uses the existing `setup()` there)

1. `'a tap remembers the face it was tapped on'` - tap from the -z side (aim at (0.5, 10.5, -1.5) as today); `sap.beads(out)`
   returns 1 with `face` = the face `aim` hit (`Face.PZ` toward the player at the origin) and `fill` 0.
2. `'a tap on the top of a log hangs its bead on the side toward the player'` - pure test of `sideFaceToward(Face.PY, 2, -0.5)` ->
   `Face.PX`; `(Face.NY, -0.1, -3)` -> `Face.NZ`.
3. `'the bead fills over the cooldown and is full when the log is ready'` - after `updateMining(60, false, null)` fill = 0.5
   (+-0.01); after another 60: fill 1 and `waitS` 0.
4. `'a full bead lingers, then is forgotten'` - after `TAP_COOLDOWN_S + BEAD_LINGER_S + 2` seconds (in 1 s steps or one big step
   followed by a 1 s step so the prune timer runs), `beads` count 0.
5. `'tapping the same log again after it refills raises tapped_twice'` - `record(bus, 'flag')`; tap, wait 121 s, tap; flags contain
   `{ flag: 'tapped_twice' }` exactly once; a first tap on a different log raises none.
6. `'breaking a tapped log forgets its bead'` - tap, `world.put(0, 10, -2, 'air')` (or the testKit's setter that emits
   `'block:changed'`; if `flatWorld.put` does not emit, emit `bus.emit('block:changed', {...})` directly with `to` = air voxel);
   beads count 0; put a pine log back: `waitS` 0.
7. `'a full pack leaves no bead'` - fill the pack so `give('pine_sap')` fails; beads count 0.
8. `'tap state survives a save'` - tap, advance 50 s, `const snap = JSON.parse(JSON.stringify(sap.toJSON()))`; a fresh `setup()`,
   `sap.load(snap)`; `waitS` = 70 (+-0.1); bead face preserved.
9. `'a save without sap state loads with every log ready'` - `sap.load(undefined)`, `sap.load({})`, `sap.load({ taps: 5 })`,
   `sap.load({ taps: { 'x,y': [1, 4], '1,2,3': ['a', 4], '4,5,6': [-3, 9], '7,8,9': [10, 99] } })`: no throw. `'x,y'` (bad cell) and
   `'1,2,3'` (non-number age) are dropped; `'4,5,6'` (negative age clamps to 0, face 9 invalid) and `'7,8,9'` (face 99 invalid) are
   kept with the fallback face. Assert `beads` count 2, both faces `Face.PZ`, and `waitS(4,5,6)` = 120.
10. `'tapping plays the tap sound, not the sip'` - `record(bus, 'sfx')` contains `name: 'sap_tap'` and not `'sip'`.
11. `'the pine log line says how long the bead needs'` - `label(0,10,-2,'glass_beaker')` before tapping =
    `'Pine Log - Use the beaker to catch its sap'`; with `'stick'` = null; after tap + 80 s = `'Pine Log - weeping, ready in 40 s'`;
    after 121 s = `'Pine Log - a full bead, ready to tap'`. Pure `waitText`: 40 -> `'40 s'`, 41 -> `'50 s'`, 80 -> `'1.5 min'`,
    120 -> `'2 min'`.
12. Existing 4 cases stay green unchanged (`'the same log is spent for a while, then weeps again'` etc.).

Accessing `sap`: `interaction.sap` (now public).

### 9.2 `src/render/sapFx.test.ts` (NEW)

1. `'a bead sits just outside the face it hangs on'` - `beadTransform({x:0,y:0,z:0,face:Face.PX,fill:0}, o)`: `o.x` = 1.01, `o.y` =
   0.32, `o.z` = 0.5, `o.r` = 0.025; `Face.NZ`: `o.z` = -0.01.
2. `'a bead grows to its full size and sags'` - fill 1: `r` = 0.075, `sy` = 1.25; fill 0.5: `r` between 0.025 and 0.075.
3. `'at most 24 beads drip and no particle comes from a full bead'` - with a fake `Particles` (count spawns; mirror the pattern of
   `brewFx.test.ts`), 40 growing beads within range, update 10 s in 0.1 s steps: live drips <= 24 at every step; 5 full beads only: 0
   spawns.
4. `'beads beyond 32 blocks are not drawn'` - instance count of the meshes.

### 9.3 `src/game/sugarRush.test.ts` (extend)

1. `'the new sweets give a Sugar Rush of their own length'` - for `toffee` 75, `berry_tart` 120, `syrup_bread` 180: `food.buff` =
   `'sugar_rush'`, `food.buffS` = `SUGAR_RUSH_S[key]`; eating one sets `buffs.sugarS` to it.
2. `'the sweets are baked at the Clay Furnace'` - each output has exactly one recipe: station furnace, kind forge, `minTier` 1,
   inputs exactly as section 4.2; `syrup_bread` byproducts `[{ item: 'glass_beaker', count: 1 }]`.
3. `'a sweet drink lasts half again as long and starts a Sugar Rush'` - give `sweet_light_roast`, `drink(player)`;
   `buffs.timeLeftS('swift')` = 270; `buffs.sugarS` = 30; `record(bus,'buff:gained')` has both swift 270 and sugar_rush 30; the cup is
   back; toast text ends with `', and a Sugar Rush'`.
4. `'a sweet drink never shortens a longer rush'` - `buffs.sugarS = 200`; drink a sweet drink: still 200; only one `buff:gained`
   (swift).
5. `'an unsweetened cup does not cut a sweet cup short'` - sweet light roast then plain light roast (after `DRINK_COOLDOWN_S`):
   swift still >= 268.
6. `'a sweet black tea still warms you'` - warmth rises by `HEARTHKEPT_DRINK_WARMTH`.
7. `'six cups counts a sweet cup as its base'` - drink the six base drinks except green tea, then `sweet_green_tea`:
   `FLAG_SIX_CUPS` emitted once. Drinking all six sweet ones (no base) also emits it.

### 9.4 `src/sim/brewing.test.ts` (extend, existing fixtures in that file)

1. `'sugar on a finished cup sweetens it'` - drive a cup to `'done'` with green tea (the file's existing helper); `brewUse(...,
   'sugar')` -> `{ ok: true, consume: true }`; `brewView` text `'Sweet Green Tea - take it'`; empty-hand use gives `sweet_green_tea`.
2. `'a sweet cup cannot be sweetened twice'` - second sugar -> `ok: false`, reason `'It is already sweet - take it'`.
3. `'sugar on an empty or dripping cup says what to do'` - stages cup/cone/loaded/brewing give their existing refusals.
4. `'stirring sounds and toasts'` - sfx `cup_stir`, toast `'Stirred in the sugar: Sweet Green Tea'`.
5. `'a sweet cup survives a save'` - the brewing round-trip used by that file with `drink: 'sweet_green_tea'`.

### 9.5 `src/sim/distill.test.ts` (extend)

1. `'sugar dissolves into a reaction vessel as 25 L of sugars'` - `sim.chemUse(x,y,z,'sugar')` -> `ok, consume: true`; mix.sugars =
   25; toast `'Sugar stirred in (25 L)'`.
2. `'sugar is refused by a receiver and a full vessel'` - receiver: reason starts `'Stir it into a Reaction Vessel or a Boiling Flask'`;
   vessel at 3990 L: `'The Reaction Vessel is full'`.
3. `'ten sugars and a bucket of water ferment to sugar wash'` - vessel with 1000 L water + 10 sugar, airlock: run until done; `nameOf`
   = `'sugar_wash'`, total 1250 L (+-1e-6, conservation), ethanol share 0.12 (+-0.005).
4. `'too much sugar is too sweet'` - 1000 L water + 18 sugar sealed: state `'blocked'`, chemView text contains `'too sweet - add water'`.

### 9.6 `src/sim/distillProcess.test.ts`

No edit: the loop covers `ferment_sugar_wash` once `feed()` dissolves solids (step 8.7). It must reach `'done'` within 1500 s and
show >= 5 x 250 L of `sugar_wash`.

### 9.7 Content / roster updates

- `src/content/specRosterGround.ts`: `items` += `'toffee', 'berry_tart', 'syrup_bread'`; `furnaceAfterWrench` += (after the
  `sugar_cake` line)
  `'toffee: 4 toffee <- 2 sugar @160 T1'`, `'berry_tart: 2 berry_tart <- 1 flour, 1 sugar, 2 wildberries @210 T1'`,
  `'syrup_bread: 2 syrup_bread <- 1 dough, 1 syrup_beaker @220 T1'` (match the exact line format of the neighbours; byproducts are
  not shown in that format today - copy whatever `sugar_cake` does with its pail).
- `src/content/specRosterFood.ts`: `hunger` += `toffee: 1, berry_tart: 5, syrup_bread: 7`; `buffs` += `toffee: ['sugar_rush', 75],
  berry_tart: ['sugar_rush', 120], syrup_bread: ['sugar_rush', 180]`.
- `src/content/specRosterBrew.ts`: the six sweet drinks in its items list and the six workbench rows (match its format).
- `src/content/specRosterDistill.ts`: `reaction_vessel` += `'ferment_sugar_wash: 5 wash_beaker <- 10 sugar, 1 water_pail, 5 glass_beaker 170s 0J'`.
- `src/content/food.test.ts` line 28: add `'berry_tart'`, `'syrup_bread'`, `'toffee'` to the sorted list.
- `src/content/brewing.test.ts`: if it counts drinks (e.g. "six drinks"), make it count base drinks
  (`DRINKS.filter((d) => !d.drink!.sweetOf)`) and add `'every drink has a sweet twin that lasts 270 s'`.
- `src/content/content.test.ts`: progression completes; every new item reachable in Ember (the solver's age check).
- `src/render/textures/readability.test.ts`: the nine new icons are found and pass.
- `src/audio/sfx.test.ts`: count expression (6.3).
- A new `src/content/objectivesSugar.test.ts` is not needed; Unit 0's side-goal test covers the mechanism; add one case to
  `sapTools.test.ts` #5 asserting the flag name equals `SUGAR_SIDE_GOALS[0].condition.flag`.

---------------------------------------------------------------------------------------------------------------------------

## 10. E2E (`scripts/e2e-distill.mjs`)

Sap/sugar appear only in `scripts/e2e-distill.mjs` today (step `'pine sap pours in from the hand, ...'`). Add three named steps
after `'each run completes on its own and the flask turns to the green done look'` and before `'no console errors during the run'`.
Use `window.__hw` for setup and reading state only; the actions are real input (`d.use()`, `d.selectItem`). Screenshots go through
`d.shot(name)` into `test-results/e2e-distill/`. Run: `node scripts/e2e-distill.mjs --device=desktop` (no `HW_GPU`), then
`--device=phonePortrait` for the crosshair line.

```js
await step('a beaker taps a pine log, which grows an amber bead and remembers it through a save', async () => {
  const p = await d.hw(() => {
    const s = window.__hw.state(); const x = Math.floor(s.player.x) + 2, z = Math.floor(s.player.z), y = window.__hw.surfaceY(x, z);
    window.__hw.setVoxel(x, y, z, 'pine_log'); window.__hw.setVoxel(x, y + 1, z, 'pine_log');   // check setVoxel's signature in src/app/debug.ts:223
    window.__hw.give('glass_beaker', 2);
    return { x, y, z };
  });
  await d.selectItem('glass_beaker');
  await d.aimAt({ x: p.x, y: p.y, z: p.z });             // driver helper (scripts/lib/e2eDriver.mjs aimAt(pos))
  await d.use();
  const tap = await d.hw((c) => {
    const sap = window.__hw.app.game.controller.interaction.sap;
    return { wait: sap.waitS(c.x, c.y, c.z), sapCount: window.__hw.app.game.state.player.inventory.count('pine_sap') };
  }, p);
  assert(tap.sapCount === 1 && tap.wait > 100, `tapped: ${JSON.stringify(tap)}`);
  // The sap clock advances in Interaction.updateMining (per frame), not in the fixed sim tick, so advance it directly (setup):
  await d.hw(() => window.__hw.app.game.controller.interaction.sap.update(60));
  await d.settle(800);                                   // a few frames: the bead is half grown, drips running
  const fx = await d.hw(() => window.__hw.app.game.renderer.sapFx?.counts ?? null);   // NEW getter { beads, drips }, read like distillFx.counts at e2e line 189
  assert(fx && fx.beads === 1 && fx.drips <= 24, `sap fx ${JSON.stringify(fx)}`);
  const line = await d.hw(() => document.querySelector('.hw-cross__label')?.textContent ?? '');
  assert(/^Pine Log - weeping, ready in \d+ s$/.test(line), `crosshair: ${line}`);
  await d.shot('sap-bead-growing');
  await d.hw(() => window.__hw.save());
  await d.hw(() => window.__hw.continueWorld());        // reload the save; wait for phase 'playing' as the first step does
  await waitFor(page, () => window.__hw.state().phase === 'playing', 'play after reload', { timeout: 120_000 });
  const after = await d.hw((c) => window.__hw.app.game.controller.interaction.sap.waitS(c.x, c.y, c.z), p);
  assert(after > 50 && after < 70, `bead kept through the save: ${after}`);
});

await step('a spoon of sugar in a finished cup makes it sweet, and drinking it starts a Sugar Rush', async () => {
  // Setup by __hw: a clay cup on the ground two blocks away; every brewing action after that is a real Use press.
  const cup = await d.hw(() => {
    const s = window.__hw.state(); const x = Math.floor(s.player.x) - 2, z = Math.floor(s.player.z), y = window.__hw.surfaceY(x, z);
    window.__hw.setVoxel(x, y, z, 'clay_cup');            // setVoxel(x, y, z, blockKey, facing = 0, active = false)
    window.__hw.give('drip_cone', 1); window.__hw.give('ground_coffee', 1); window.__hw.give('boiling_pail', 1); window.__hw.give('sugar', 1);
    return { x, y, z };
  });
  // If setVoxel's 'sim' source does not create the brew_cup entity, place the cup instead: d.selectItem('clay_cup'); d.placeHeld('clay_cup').
  for (const item of ['drip_cone', 'ground_coffee', 'boiling_pail']) { await d.selectItem(item); await d.useBlock(cup); }
  await d.hw(() => window.__hw.tick(5 * 60));            // BREW_SECONDS is 4; the cup is 'done'
  await d.selectItem('sugar');
  await d.useBlock(cup);
  const text = await d.hw(() => document.querySelector('.hw-cross__label')?.textContent ?? '');
  assert(text === 'Sweet Light Roast - take it', text);
  await d.selectEmptyHand();                             // empty hand takes the drink
  await d.useBlock(cup);
  await d.selectItem('sweet_light_roast');
  await d.hw(() => window.__hw.look(0, 1.4));            // aim at the sky: Use with a drink held drinks it (Interaction.drinkHeld)
  await d.use();
  const b = await d.hw(() => { const bf = window.__hw.app.game.state.player.buffs; return { swift: bf.timeLeftS('swift'), sugar: bf.sugarS }; });
  assert(b.swift > 260 && b.sugar > 25, JSON.stringify(b));
  await d.shot('sweet-cup-pills');                       // both pills visible in the HUD
});

await step('ten sugars stirred into a vessel of water ferment under an airlock', async () => {
  const vessel = await d.hw(() => {
    const s = window.__hw.state(); const x = Math.floor(s.player.x), z = Math.floor(s.player.z) + 2, y = window.__hw.surfaceY(x, z);
    window.__hw.setVoxel(x, y, z, 'reaction_vessel'); window.__hw.setVoxel(x, y + 1, z, 'airlock_cap');
    window.__hw.give('water_pail', 1); window.__hw.give('sugar', 10);
    return { x, y, z };
  });
  await d.selectItem('water_pail');
  await d.useBlock(vessel);                              // 1000 L of water
  await d.selectItem('sugar');
  for (let i = 0; i < 10; i++) await d.useBlock(vessel); // real presses: 10 x 25 L
  const sugars = await d.hw((c) => window.__hw.app.game.state.sim.distill.entityAt(c.x, c.y, c.z)?.mix.sugars ?? 0, vessel);
  assert(Math.abs(sugars - 250) < 1e-6, `sugars ${sugars}`);
  await fastForward((c) => window.__hw.app.game.state.sim.distill.entityAt(c.x, c.y, c.z)?.state === 'done', vessel, 'the sugar wash', 400);
  const named = await d.hw((c) => window.__hw.app.game.state.sim.distill.entityAt(c.x, c.y, c.z)?.mix ?? null, vessel);
  assert(named && Math.abs(Object.values(named).reduce((a, b) => a + b, 0) - 1250) < 1e-3, 'litres conserved');
  await d.shot('sugar-wash-done');
});
```

Builder notes: driver helpers used are real (`use()`, `aimAt(pos)`, `selectItem(item)`, `selectEmptyHand()`, `useBlock(pos)` in
`scripts/lib/e2eDriver.mjs`); `look(yaw, pitch)` and `setVoxel` are `window.__hw` methods (`src/app/debug.ts`) - confirm argument order. `surfaceY(x, z)`: if it returns the top solid block rather than the first air cell, place at `surfaceY + 1` (check `src/app/debug.ts`). `game.controller` and `renderer.sapFx` may be TS-private; e2e reads them at runtime exactly as line 189 reads `renderer.distillFx` (private in `src/render/renderer.ts`). `renderer.sapFx.counts` is NEW: a getter `{ beads, drips }` on
`SapFx` and the renderer field made reachable the same way `distillFx` is read at e2e line 189. The cup setup should mirror the
existing brewing e2e steps (grep `cup_cone` in `scripts/e2e-features.mjs`); if it is long, put the sweet-cup step in
`scripts/e2e-features.mjs` beside them instead and say so in the PR.

---------------------------------------------------------------------------------------------------------------------------

## 11. Docs to update

- `docs/api/sugar.md`: chain table gains toffee/tart/syrup bread rows, a "Sweetened drinks" section (270 s + 30 s rush, two ways),
  a "Sugar in the distillery" section (`CHEM_SOLIDS`, 25 L, the ferment numbers, the card), "The tap" section (bead, drips, linger
  600 s, saved under world extra `'sap'`, the full bead's glint = ready, why amber not green), code map additions
  (`src/render/sapFx.ts`, `src/audio/sfxSugar.ts`, `objectivesSugar.ts`); delete both lines of "Gaps" (replace with "none known").
- `docs/api/brewing-buffs.md` (or `brewing.md` where drinks are listed): sweet drinks, `SWEETENED`, six_cups counts base drinks.
- `docs/api/distillery.md`: sugar as an input, the new card.
- `docs/api/food.md` / `food-rules.md`: the three foods in the food table with hunger and rush.
- `docs/api/audio.md`: `sap_tap`, `cup_stir`.
- Never edit `docs/WHATS_LEFT.md` or `docs/build/SYSTEMS.md` (coordinator merges section 4.6 rows into T4).

---------------------------------------------------------------------------------------------------------------------------

## 12. Acceptance checklist

- [ ] Tapping a pine log records the tap with a side face; a bead appears on that face within one frame.
- [ ] The bead grows from r 0.025 to 0.075 over 120 s; drips run while it grows (<= 24 drip particles total), stop when full.
- [ ] A full bead glints and lingers 600 s, then disappears; the log is ready throughout.
- [ ] Crosshair lines exactly as 6.1; <= 60 characters; fit on one line at 390 px.
- [ ] Save and reload: every bead keeps its face and remaining time (+-0.1 s); a save without `'sap'` loads with all logs ready.
- [ ] Breaking a tapped log removes its bead; a replaced log is ready.
- [ ] Re-tapping a refilled log raises `tapped_twice`; side goal "Tap a pine twice" completes (once Unit 0 is in) and gives 4 Toffee.
- [ ] `sap_tap` plays on a tap (not `sip`); no sound from beads or drips.
- [ ] Toffee, Berry Tart, Syrup Bread forge at the Clay Furnace with the 4.2 recipes and give 75/120/180 s Sugar Rush; syrup bread
      returns the beaker.
- [ ] Six sweet drinks exist; sugar on a finished cup sweetens it (`cup_stir`), workbench rows sweeten carried cups.
- [ ] A sweet drink grants its buff for 270 s and a 30 s Sugar Rush (never shortening a longer one); the cup comes back.
- [ ] six_cups still needs exactly the six base drinks (a sweet cup counts for its base).
- [ ] Sugar on a vessel or flask adds 25 L `sugars`; refusals as 6.1; 10 sugar + 1 bucket ferments to 1250 L sugar wash (5 beakers).
- [ ] `ferment_sugar_wash` card passes `distillProcess.test.ts`.
- [ ] `npm test` green (incl. roster, readability, sfx count, content progression); `npm run typecheck`/build clean.
- [ ] e2e steps pass on `--device=desktop` and the crosshair screenshot is legible on `--device=phonePortrait`.
- [ ] Docs updated (section 11); no literal `age: 0` in new code (`ageIndexOf('ember')`).

---------------------------------------------------------------------------------------------------------------------------

## 13. Out of scope

- A placed tap block / spile item, buckets hung on logs, sap collected automatically by pipes or helpers (golems may carry sap
  beakers like any item via Unit 17; no tap automation here).
- Sap from other trees (only `pine_log` is a conifer; `SAP_LOGS` stays a set so a future conifer is one row).
- Time passing while the game is closed.
- Sweetening by deployer/arm on a cup block; sweetened kettles; honey; syrup as a sweetener for drinks (syrup goes to bread, wash
  and elixirs).
- New buff kinds or strength levels (T5: stronger = longer).
- Alcoholic drinks from wash (Unit 10 owns drinking spirit; wash stays an intermediate).
- Elixir recipes (Unit 10; they read syrup/sugars as they wish).
- Rebalancing existing sugar foods or `SUGAR_SPEED_MULT`.

---------------------------------------------------------------------------------------------------------------------------

## 14. Notes for the coordinator

1. **`chemUse` order with Unit 0:** `CHEM_SOLIDS` lookup must precede Unit 0's "item into a vessel slot" path (2.4.1). If Unit 0
   lands first, insert the solids branch above its slot branch; if this unit lands first, Unit 0 inserts below.
2. **six_cups with sweet drinks:** this unit changes the check to base drinks; Unit 2 (which moves six_cups to side goals) must keep
   it (2.4.2).
3. **`sfx.test.ts` expression** gains `+ Object.keys(SUGAR_SFX).length`; merge with other units' terms.
4. **SYSTEMS edits to merge:** T4 rows of 4.6 (the existing sugar-goods row lists `toffee (2 sugar)` and `syrup_bread` with exact
   yields now: 4 toffee, 2 tarts, 2 breads); T5 line "Sweetened drinks (Unit 5)" gains the constant names `SWEET_DRINK_BUFF_S`,
   `SWEET_DRINK_SUGAR_S`; T3 rule 3 example: `CHEM_SOLIDS` is the solids twin of `CHEM_CONTAINERS`; toffee stack 32 (argued in 4.2).
5. **SYSTEMS §2 table** says `TAP_COOLDOWN_S` "not saved" - now saved under world extra `'sap'`.
6. **Unit 10** can count sweet drinks toward "4 drinks of that buff" for essences (their `drink.buff` is the base buff) - suggest
   they do; nothing to change here.
7. **T9 exception:** the full bead signals "done" with a glint in amber, not green (a green bead on a tree reads as moss/rot).
8. **`ageIndexOf` in content files** is already imported by `src/content/itemsWorkshop.ts`; no cycle concern.
9. **`brewing.test.ts` 'has six drinks'** will fail when sweet drinks register; this unit rewrites it to count base drinks.
   Any other unit's test that iterates `DRINKS` expecting six must do the same (grep `DRINKS` before merging Units 2 and 10).
