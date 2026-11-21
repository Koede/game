# Food in the HUD and screens (spec 12.8) - src/ui

The UI half of food: the HUD food meter, the Hungry / starving state, the Well-Fed pill, "+N food" wherever an
item or recipe is shown, the "returns the bucket" note, and the furnace's Kitchen chips. Reads only what the food
rules already expose (`player.food`, `player.buffs.wellFedS`, `survival.hunger.wellFedTimeLeftS`; see
`docs/api/food-rules.md`). **No wiring change is needed**: everything lives inside GameUI, the HUD and the screens
that already exist.

Tests: `npx vitest run src/ui` (`src/ui/screens/food.test.ts` 11 tests, plus Kitchen / stew cases in
`furnace/furnaceLogic.test.ts`).

## src/ui/screens/food.ts (DOM-free, shared by the HUD and the screens)

```ts
const KITCHEN: RecipeCategory                       // { id: 'kitchen', label: 'Kitchen' }
function buffDuration(seconds: number): string       // 360 -> "6 min", 90 -> "1.5 min", 45 -> "45 s"
function buffText(food: FoodSpec): string | null     // "Well-Fed 6 min"; null without a buff
const foodText: (food: FoodSpec) => string           // "+8 food"
function foodLine(itemKey: string): string | null    // "+12 food, Well-Fed 6 min"; null when not edible
function foodRows(itemKey: string): [string, string][]   // item-card rows: ["Eat", "+8 food"], ["Buff", "Well-Fed 6 min"]
function byproductNotes(recipe: RecipeDef): string[] // "Returns the bucket" (any byproduct named "...Bucket"), else "Also gives 2 Slag"
function productBadges(recipe: RecipeDef): RecipeRequirement[]  // food / buff (kind 'food') + byproduct notes (kind 'note')
function isKitchenRecipe(recipe: RecipeDef): boolean // the output or any input is food (category 'food' or ItemSpec.food)
type HungerState = 'fed' | 'hungry' | 'starving'
function hungerState(food: number): HungerState      // hungry at <= HUNGRY_AT (6), starving at 0
function hungerLevel(food: number): number           // vignette strength: 0 while fed, 0.35 at 6 rising to 1 at 0
function hungerNote(cause: DamageCause | null, food: number): string | null  // the death screen's starving line
function clockTime(seconds: number): string          // 251 -> "4:11" (buff timers)
```

## HUD (src/ui/hud)
- **Food meter** (`vitals.ts`): a third bar under health and warmth, glyph `bowl` (a steaming bowl, new in the kit),
  colour `--hw-food` (a herb green, distinct from health red and warmth orange), 10 cells of 2 points, the value as
  whole points (`ceil`). Hungry (`data-hunger="hungry"`, food <= 6): the bar breathes, the bowl throbs, value and
  glyph turn warn yellow and a "!" sits in the fourth column, the row's title explains (no sprint, no healing).
  Starving (`data-hunger="starving"`, food 0): faster, red value and glyph, the track edged in red.
- **Well-Fed pill** next to Well-Warmed (`.hw-buffs` holds both): bowl glyph, "Well-Fed 5:59" in the food colour.
  On phones (portrait and landscape) when BOTH buffs are on, the pills drop their names and sit side by side as
  glyph + time (the glyphs match the meters); one pill alone keeps its name. Desktop always shows names.
- **Hunger vignette** (`feed.ts` `Vignettes.update(warmth, wellWarmed, food)`): a dull umber shadow in the corners
  while Hungry, opacity from `hungerLevel`, breathing slowly (faster when starving). Subtle by design: it darkens
  the corners, it does not cover the view.
- **Hotbar name flash** on selecting a food: "Roast Chop · +8 food".
- All new animations stop under `prefers-reduced-motion`.

## Screens
- **Item cards** (`slotViews.itemCard`, the desktop hover / focus tooltip): rows "Eat +8 food" and "Buff Well-Fed 6 min";
  fuels that hand back a container add "Leaves Bronze Bucket" (lava).
- **Carry bar** (`slots.ts`, the touch substitute for tooltips): the picked item's food line on a second line under
  its name ("+12 food, Well-Fed 6 min"), so phone players learn what a food does. `.hw-carry__text` now holds
  `.hw-carry__name` and `.hw-carry__note`.
- **Recipe rows** (hand, workbench, furnace SMELT and FORGE): facts badges "+8 food", "Well-Fed 6 min" (food colour)
  and "Returns the bucket" (dotted, neutral) on their own line under the name (`.hw-recipe__facts`, grid area `facts`;
  on wide lists in the name column). They come from `productBadges`, as `RecipeRequirement`s of kind `'food'` /
  `'note'` (new kinds in the kit: facts, never met / unmet).
- **Kitchen chip**: FORGE categories are now Kitchen, Tools, Parts, Machines, Power, Building (`forgeCategory` returns
  `'kitchen'` for stews); SMELT's reference list has chips for the first time: Kitchen, Materials, Fuel
  (`SMELT_CATEGORIES`, `smeltCategory(recipe)`; the roasts, the baked potato and bread). Kitchen sits right after All
  in both, because the chip bar scrolls sideways on a phone and a chip at the end is off-screen. The kit's
  `RecipeList.setCategory` now scrolls the picked chip into view.
- **Stew variants**: `forgeRowViews` shows every variant of one product the player holds the ingredients for, or else
  only the one they are closest to (so FORGE lists one "Hearth Stew", not three identical-looking rows).
- **Death screen**: the hunger cause reads "Hunger wore you down - An empty stomach drains your health. Cook meat or
  bake bread in the furnace, then hold it and press Use to eat." Since starvation never takes the last health point,
  that cause should not occur; what does happen is dying of something else while starving, so the screen adds
  "You were starving, and an empty stomach had worn your health down. Eat before you head out again." when the
  bar was empty at death.

## Verification
Harness in the scratch directory (`scratchpad/food-ui/`): real `PlayerState`, `Survival`, `Simulation`,
`ObjectiveTracker`, `GameClock` on the FakeWorld, the real GameUI with the station screens, the real touch overlay
and item icons. Screenshots at 390x844, 844x390 and 1280x800, all looked at: HUD full, half, hungry, starving,
Well-Fed + Well-Warmed, both buffs + Hungry + air (the tallest vitals), furnace SMELT (All and Kitchen) and FORGE
(All and Kitchen), inventory, workbench with dough, carry bar with a stew, desktop item cards for a roast and a
stew, the hotbar flash, death while starving and death by hunger. An automated check found no text overflow, nothing
off-screen, and no overlap between the vitals, goal tracker, compass, dial, hotbar and the touch buttons at any size.

## Deviations and decisions
- The food meter is green ("herb"), not a bread colour: every warm colour is taken (health red, warmth orange,
  Well-Warmed amber, warn yellow).
- Kitchen gathers by the product (and inputs) being food, not by a recipe field: no new content data was needed.
- Hunger vignette is a colour tint, not a desaturation filter (a full-screen `backdrop-filter` costs too much on phones).

## Known gaps
- Touch still has no item card; food facts reach phones through the carry bar, the hotbar flash and recipe rows.
- The furnace chip bars still scroll sideways when they do not fit (Fuel on the desktop SMELT list, Building on FORGE).
