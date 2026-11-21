# Tea and coffee - brewing plan (Ember Age)

Design and implementation spec for brewing. Nothing here is built. It belongs to the EMBER AGE (owner: "the
brewing can be done at ember era") and needs only the Clay Furnace. Companion plans: `docs/STEAM_PLAN.md`,
`docs/BRONZE_PLAN.md`, `docs/PROGRESSION.md`. Function names inside files must be checked against the code
before use; file and module names are as they are in the repository today.

## 0. The owner's words

- "there should be a way to make tea and coffee by boiling water collected in a bucket placed upon a furnace
  then a drip coffee item must be placed and then with coffee or tea in hand placed on a cup with tea drip
  coffee item on top and one must grab the boiling water and use it on the setup to brew coffee. gives speed
  boost and jump boost"
- "after of course harvesting the grown crop of such type"
- "the brewing can be done at ember era"

DECIDED by the owner (these override anything below that disagrees - see section 11 for the details):
1. "different types of tea and coffee give different types" of boost: varieties, each with its own effect.
2. Tea and coffee are regrowing bushes.
3. The kettle also gives boiling water - "and if we ever add bowls or other containers, those too": boiling
   water is a property of CONTAINERS, not of the bucket alone.

## 1. Player-facing rules

1. Pick wild tea bushes and coffee shrubs, plant them, harvest them when ripe. They regrow like the berry bush.
2. Dry leaves or roast cherries in a furnace crucible. Grind roasted beans at the workbench (or the millstone).
3. Place a Water Bucket on top of a hot furnace. It becomes boiling water.
4. Place a Clay Cup on a surface and a Drip Cone on the cup. Use tea leaves or ground coffee on the cone.
5. Pick up the boiling bucket and use it on the setup. It drips for 4 seconds. You get the empty bucket back.
6. Take the cup and drink. Coffee gives speed, tea gives jump. The cup and cone are reusable.

The growing chain in full: find it wild (tea in marsh and woodland edges, coffee in warmer woodland near the
dunes) -> picking gives leaves or cherries plus sometimes a cutting -> plant the cutting -> it grows in stages
in daylight or under a powered lamp, faster near water or in rain -> harvest -> process -> brew.

## 2. Contracts (src/core, append only)

```ts
// types.ts
export interface DrinkSpec { buff: 'swift' | 'spring'; buffS: number; warmth?: number; hunger?: number }
// ItemSpec gains: drink?: DrinkSpec
// MachineRole gains: 'brew'   (cup setup and the bucket on a furnace; no power, no machine screen)
// BlockShape gains: 'cup', 'bucket'

// gameEvents.ts
// BuffName gains 'swift' | 'spring'
// events: 'brew:started' {x,y,z,drink}, 'brew:done' {x,y,z,drink}, 'water:boiling' {x,y,z}, 'player:drank' {item}
// flags:  FLAG_BOILED_WATER, FLAG_BREWED
// SfxName: 'boil_bubble', 'pour', 'drip', 'sip'

// constants.ts
BOIL_TEMP_C = 100          BOIL_SECONDS = 12        BOIL_DRY_SECONDS = 180
BREW_SECONDS = 4           BOILING_KEEPS_S = 90     // a carried boiling bucket cools back to water
SWIFT_SPEED_MULT = 1.2     SPRING_JUMP_MULT = 1.35  DRINK_BUFF_S = 180
DRINK_COOLDOWN_S = 1
```
Exhaustive tables that need a new entry in the same change: machine role labels in
`src/ui/screens/machines/machineScreen.ts`, the sound table in `src/audio/sfx.ts`, buff labels in the HUD,
block shapes in `src/world/blockTables.ts`.

## 3. Content (src/content)

**Blocks**

| Key | Shape | Notes |
|---|---|---|
| tea_bush, tea_bush_bare | cross | role bush, `regrowS: 360`, `harvestLeaves: 'tea_bush_bare'`. Drops 2-3 tea_leaves, 25% tea_cutting. |
| coffee_shrub, coffee_shrub_bare | cross | same pattern. Drops 2-3 coffee_cherries, 25% coffee_cutting. |
| clay_cup | cup | not solid, 6/16 wide, 5/16 tall, `placeOn` any solid top. Machine kind `brew_cup`. |
| cup_cone, cup_cone_tea, cup_cone_coffee, cup_tea, cup_coffee | cup | states of the same cell; `item: false`; each drops what the state holds. |
| furnace_bucket, furnace_bucket_boiling | bucket | only on top of a furnace or a hearth roof. Machine kind `boil_bucket`. `item: false`. The boiling one steams. |

**Items**: clay_cup (block item), drip_cone, tea_cutting, coffee_cutting (place the bare bush on farmland or
grass), tea_leaves, dried_tea, coffee_cherries, roasted_beans, ground_coffee, boiling_pail (stack 1, like
water_pail), tea and coffee (stack 1; `drink: { buff: 'spring' ... }` / `{ buff: 'swift' ... }`; drinking
returns clay_cup).

**Recipes**
- Furnace FORGE, tier 1 (clay already smelts to firebrick and smelt inputs must be unique, so these are forge
  recipes): clay_cup x2 <- 1 clay at 400 C; drip_cone <- 1 clay + 1 fiber at 400 C.
- Furnace SMELT, tier 1: dried_tea <- tea_leaves, 150 C, 5 s; roasted_beans <- coffee_cherries, 220 C, 8 s.
- Workbench: ground_coffee <- 2 roasted_beans. Millstone (Bronze Age, STEAM_PLAN): ground_coffee <- 1
  roasted_beans.

**Other content work**
- Worldgen: tea bushes in marsh and woodland edges, coffee shrubs in woodland near dunes, small patches,
  placed by the same deterministic flora pass as berry bushes (`src/world/flora.ts` / `plants.ts`).
- Goals, after `bake_bread`: `boil_bucket` ("Boil a bucket", flag FLAG_BOILED_WATER) and `first_brew` ("Brew a
  cup", flag FLAG_BREWED).
- Solver and roster: both drinks reachable at tier 1. Regrowth already works for role bush in CropField.
- Textures: bushes (4), cup states, cone, bucket on furnace (2), icons for every item.

## 4. Simulation (src/sim, new file brewing.ts)

Entities (plain JSON, created from 'block:changed' like every machine):
```ts
BoilBucket { kind: 'boil_bucket', x, y, z, heatS: number, boiling: boolean, dryS: number }
BrewCup    { kind: 'brew_cup',   x, y, z, stage: 'cup' | 'cone' | 'loaded' | 'brewing' | 'done',
             drink: 'tea' | 'coffee' | null, brewS: number }
```
The block id is the source of truth for the look; the entity holds timers. Both kinds are excluded from the
machine node set, as crops are, so they never appear in grids or open a machine screen.

**Boil tick** (once per tick per bucket)
```
furnace = furnaceBelow(x, y-1, z)          // same lookup the boiler and steam engine use,
                                           // including a formed hearth's roof cell via shellOwner
T = furnace ? furnace.tempC : AMBIENT
if !boiling:
    heatS = T >= BOIL_TEMP_C ? heatS + dt * clamp((T-100)/200 + 0.5, 0.5, 2) : max(0, heatS - dt)
    if heatS >= BOIL_SECONDS:
        boiling = true; swapBlock('furnace_bucket_boiling'); emit water:boiling; flagOnce(FLAG_BOILED_WATER)
else:
    if T < BOIL_TEMP_C - 20: boiling = false; heatS = BOIL_SECONDS * 0.5; swapBlock('furnace_bucket')
    else dryS += dt
    if dryS >= BOIL_DRY_SECONDS: removeBlock(); giveOrLeave('pail'); toast "The bucket boiled dry"
furnace.extractW += boiling ? 300 : 600 * (T >= 100)     // small heat draw, shown on the firebox panel
```

**Brew tick**
```
if stage == 'brewing':
    brewS += dt
    every 0.5 s: sfx 'drip' at position
    if brewS >= BREW_SECONDS:
        stage = 'done'; swapBlock(drink == 'tea' ? 'cup_tea' : 'cup_coffee')
        emit brew:done; flagOnce(FLAG_BREWED); sfx 'smelt_done' pitched up
```

**Player action** on Simulation, returning `{ ok }` or `{ ok: false, reason }`:
```
brewUse(x, y, z, heldKey) -> { ok, held?: string | null, give?: string, reason?: string }

switch (blockAt(x,y,z), heldKey):
  clay_cup        + drip_cone         -> block = cup_cone; consume 1
  cup_cone        + dried_tea         -> block = cup_cone_tea; drink = 'tea'; consume 1
  cup_cone        + ground_coffee     -> block = cup_cone_coffee; drink = 'coffee'; consume 1
  cup_cone_*      + boiling_pail      -> stage = 'brewing'; held = 'pail'; sfx 'pour'; emit brew:started
  cup_cone_*      + water_pail        -> refuse "The water must be boiling - heat the bucket on the furnace"
  cup_cone_*      + anything else     -> refuse "Pour boiling water over it"
  cup_tea|coffee  + empty hand or any -> block = cup_cone (cone stays); give 'tea' | 'coffee'
  brewing         + any               -> refuse "Still dripping"
  furnace_bucket_boiling + empty/any  -> remove block; give 'boiling_pail'
  furnace_bucket  + any               -> remove block; give 'water_pail'
```
The furnace top is the one case decided in src/player: holding water_pail and aiming at the TOP face of a
furnace or hearth roof places `furnace_bucket` instead of pouring a water source.

Cooling in the pack: boiling_pail reverts to water_pail after BOILING_KEEPS_S. Store the seconds remaining in
the stack's `durability` field (shown as a heat bar); tick it down in Survival.

## 5. Player (src/player)

Use priority in `Interaction.use` (new entries marked NEW):
1. Animal under the crosshair with a liked item.
2. NEW Brewing blocks (cup*, furnace_bucket*): call the injected `brew.use(...)` callback.
3. NEW Water bucket aimed at a furnace top: place `furnace_bucket`.
4. Wrench and bucket on pipes or tanks.
5. Stations and machines open their screens.
6. NEW Held item with `drink`: drink it.
7. Food, planting, placing.

Drinking: a `drinkCooldown` timer like the swing timer; `Buffs.grant('swift', 180)` like Hunger's Well-Fed.
Emits player:drank, plays sip, returns the cup to the same slot.

Buffs in physics: `physics.ts` multiplies walk, sprint and swim speed by 1.2 while Swift, and JUMP_VELOCITY by
1.35 while Spring. Fall damage must not get worse: add (mult^2 - 1) x normal jump height to SAFE_FALL while
Spring is active.

## 6. World and render

- Mesher: shapes `cup` and `bucket` are small boxes like the torch; the cone is a second inverted box on top;
  tea and coffee states show a dark liquid quad at the rim; the boiling bucket's top quad uses the liquid
  shimmer flag.
- Emitters: steam wisps over `furnace_bucket_boiling` and over a cup for 20 s after brew:done; drips are
  1-pixel particles from cone to cup while brewing.
- Target boxes: real small bounds in `src/render/target.ts`, padded to at least 8/16 so they are tappable on a
  phone.

## 7. UI and audio

- HUD: buff chips "Swift 2:41" and "Spring 2:41" beside Well-Warmed and Well-Fed; compact glyph-and-time form
  on phones when more than two are active.
- Target name shows the state: "Cup with drip cone - add tea or ground coffee", "Brewing 3 s", "Coffee - take
  it", "Water Bucket - 8 s to the boil".
- Tooltips and recipe rows: "Swift 3 min" / "Spring 3 min", like "+N food".
- How to Play: one card with the steps.
- Audio: the four sounds; the bubbling is an ambience field `boil: 0..1`, not repeated one-shots.

## 8. The hardest parts

- **Multi-step interaction on a tiny stacked block, touch first.** The whole flow is taps on one cell, the
  held item decides the step. The risk is a tap doing the wrong thing (pouring a source next to the cup,
  eating, placing a block on top). The priority list in 5 and the single `brewUse` table handle it; every
  refused combination returns a sentence that says what to do next.
- **A bucket as a placed, heated block.** Buckets are items today. Furnace-top placement must work on a single
  furnace and on a formed hearth's roof, survive the furnace upgrading in place, and return the bucket if the
  furnace is broken. Hook `boil_bucket` into the same "machine above a furnace" refresh the steam engine and
  boiler use, and into removeMachine's return-contents path.
- **Boiling water that cools in the inventory.** A timer on a stack is new. Reusing `durability` avoids a save
  change but the inventory UI must draw it as a heat bar and stacking must stay off.
- **Jump boost without breaking movement.** Add tests: jump apex with and without Spring; no fall damage from
  a boosted jump on flat ground; sprint with Swift while Hungry stays refused.
- **Six blocks for one cup.** State is in block ids so the mesher and saves need nothing special; the cost is
  more textures and one exhaustive stage <-> block key table, kept in `src/core` so sim, player and UI agree.

## 9. Tests and acceptance

- **Sim:** boil timing at 150 C and 400 C; cooling below 80 C; boil-dry returns the bucket; every row of the
  `brewUse` table incl. refusals; brew timer and events fire once; save/load mid-brew and mid-boil; furnace
  broken under a boiling bucket.
- **Game:** buffs grant, refresh, expire, save; the pail cools.
- **Player:** priority order (animal beats cup, cup beats placing); water bucket on a furnace top places the
  bucket, not a water source; physics tests above.
- **Content:** solver reaches both drinks at tier 1; bushes regrow.
- **End to end** (desktop and phone portrait, real input): harvest a ripe tea bush; dry leaves in the
  crucible; bucket on a lit furnace boils; cup, cone, leaves, pour; wait 4 s, take, drink; the HUD shows
  Spring and a measured jump is higher; the same for coffee measuring walking speed. Look at the screenshots.

## 10. Order of work

One engineer can do it all in this order, each step green: contracts + content + textures + sounds ->
`brewing.ts` + tests -> player priority + physics buffs + tests -> mesher shapes, emitters, target boxes ->
HUD chips, target names, How to Play -> worldgen bushes -> e2e step in `scripts/e2e-features.mjs`.
It does not depend on the steam or Bronze plans; do it before or after them. If the six-tier refactor
(BRONZE_PLAN W0) has landed, "tier 1" is still the Clay Furnace.

## 11. Owner decisions in detail (override sections 1-9 where they differ)

### 11.1 Varieties - each drink its own boost
Six drinks from the two bushes. Processing decides the variety; all brew the same way (cup, cone, pour).
Smelt inputs stay unique (each item has one crucible recipe).

| Drink | Made from | How the ingredient is made | Buff (3 min) | Effect |
|---|---|---|---|---|
| Green Tea | dried_tea | tea_leaves in a crucible, 150 C, 5 s | Spring | jump x1.35 |
| Black Tea | black_tea | dried_tea in a crucible, 250 C, 6 s | Hearthkept | warmth drain x0.5, +10 warmth on drinking |
| Berry Tea | berry_tea_blend | workbench: 1 dried_tea + 2 wildberries | Mending | health regeneration x2 |
| Light Roast | ground_coffee | coffee_cherries -> roasted_beans 220 C 8 s; ground | Swift | walk, sprint, swim x1.2 |
| Dark Roast | ground_dark_coffee | roasted_beans -> dark_beans 400 C 8 s; ground | Vigor | mining speed x1.25 |
| Trail Blend | trail_blend | workbench: 1 ground_coffee + 1 ground_dark_coffee -> 2 | Lasting | food drain x0.5 |

- Contract change: `DrinkSpec.buff` becomes `'spring' | 'hearthkept' | 'mending' | 'swift' | 'vigor' | 'lasting'`
  (BuffName gains the same six). Buff numbers live in constants (`SPRING_JUMP_MULT`, `HEARTHKEPT_DRAIN_MULT`,
  `MENDING_REGEN_MULT`, `SWIFT_SPEED_MULT`, `VIGOR_MINING_MULT`, `LASTING_DRAIN_MULT`), each used at the one
  place the base rule already lives (physics, survival warmth, survival regen, mining.ts, hunger.ts).
- Stacking rule: at most ONE tea buff and ONE coffee buff at a time; drinking another of the same family
  replaces it (toast "Spring replaces Mending"). Buffs from Well-Warmed and Well-Fed multiply with these.
- Blocks: the cup states become data-driven instead of six hard-coded blocks: `cup_cone_loaded` and `cup_full`
  with the drink key on the entity (`drink: string`), and the liquid colour taken from the drink item's
  `drinkColour` field (the parts layer or a tinted quad draws it). Items: one per drink (`green_tea`,
  `black_tea_cup`, `berry_tea`, `light_roast`, `dark_roast`, `trail_blend_cup`), all returning the clay cup.
- `brewUse` table rows "cup_cone + dried_tea / ground_coffee" generalise to "cup_cone + any item with
  `brews: <drink key>`" (new ItemSpec field on the six ingredients).
- Goals: `first_brew` unchanged; add an optional later goal `six_cups` ("Taste them all": all six drunk,
  tracked in PlayerState stats) with a small reward.
- Tests: each buff's effect at its hook; family replacement; six ingredients brew six drinks; solver reaches
  all at tier 1 (dark roast needs 400 C: charcoal or bellows).

### 11.2 Regrowing bushes
As written in section 3 (role bush, regrowS 360, cuttings to plant). No change.

### 11.3 Boiling water from any container, and from the kettle
- New ItemSpec field `container?: { holds: 'water'; boilsTo: string; emptyTo: string }` on `water_pail`
  (boilsTo `boiling_pail`, emptyTo `pail`). Future bowls or flasks only need this field and a furnace-top block.
  The sim's `brewUse` pour row accepts any held item that is the `boilsTo` of some container.
- Furnace top: any water-holding container can be set on a hot furnace top (the block shows that container's
  model: `furnace_bucket` today; a future `furnace_bowl` plugs in through a `CONTAINER_BLOCKS` table in content).
- Kettle Pot (EMBER_PLAN; the Ember kettle - NOT the Bronze Copper Kettle of STEAM_PLAN, which may optionally accept the same rows): Use on a kettle that is boiling (furnace >= 120 C and water in it) with an EMPTY
  container fills it with boiling water directly (takes 1000 L per bucket; "The kettle is not boiling yet"
  otherwise). Using a water container on a kettle still pours water in. Add both rows to the kettle's use table
  and a test for each.
- Later (Bronze): a container on a Hot Plate boils the same way (the Hot Plate reports delivered temperature).
