# Resin, sugar and sweet baking (Sugar Rush)

> **Numbering note (BRONZE_PLAN W0, done):** furnace tiers and ages below that were written for five tiers are now six: tier 2 is the single-block Bronze Furnace, so the old tiers 2-5 are 3-6 and the old ages 1-4 are 2-5 (`docs/api/ages.md`). A furnace without a formed hearth runs as the Bronze Furnace (tier 2), not the Clay Furnace.


Owner's brief: spruce resin can be taken and refined into sugar, then baked into baked goods with wheat in the
furnace; eating anything with sugar gives a small speed boost, but while it lasts the Well-Fed buff runs out faster
(hunger itself drains as usual). Everything is done in game with glass beakers and rudimentary chemistry. The only
conifer in the world is the **pine**, so pine logs weep the sap ("spruce" in the owner's words).

## The chain (all at the Clay Furnace, tier 1, and by hand)

| Step | Recipe / action |
|---|---|
| Glass | `smelt` sand 700 C -> glass (existing) |
| Chemistry supplies | forge `2 glass_beaker` from `1 glass`, 650 C |
| Tap | **Use** a Glass Beaker on a pine log: the beaker becomes `pine_sap`; that log weeps again after 120 s (`TAP_COOLDOWN_S`; the seconds left are saved with the world as `extras.sap`) |
| Boil | forge `pine_resin` from `1 pine_sap`, 180 C, beaker returned |
| Distil | forge `3 sugar` from `2 pine_resin + 1 water_pail + 1 glass_beaker`, 260 C, bucket and beaker returned |
| Bake | forge `3 sugar_cookie` (flour + sugar, 190 C); `sweet_bun` (dough + sugar, 220 C); `sugar_cake` (2 flour + 2 sugar + water bucket, 200 C, bucket returned) |

Flour comes from wheat at the Hand Quern; dough is the existing flour + water bucket recipe.

## Sugar Rush (`src/game/buffs.ts`)

- Foods carry `food.buff = 'sugar_rush'` and `buffS`: sugar 45 s (1 food), cookie 90 s (2), bun 150 s (6), cake 240 s (9).
- `Buffs.sugarS` counts down; `speedMult` = Swift x `SUGAR_SPEED_MULT` (1.12) so it applies to walking, sprinting and swimming
  in `PlayerPhysics` with no further wiring.
- While `sugarS > 0` the **Well-Fed timer burns `SUGAR_WELL_FED_BURN_MULT` (2.5) times faster** (`Buffs.tick`), and hunger
  drains `SUGAR_DRAIN_MULT` (1.25) times faster (`Buffs.foodDrainMult`). Regeneration and every other buff are untouched.
- A longer Sugar Rush is never shortened by a shorter one (same rule as Well-Fed). Cleared on respawn. Saved as
  `BuffsSnapshot.sugarS` (optional; older saves load with none). `buff:gained` is emitted with `buff: 'sugar_rush'`.
- HUD: a "Sugar Rush" pill (`src/ui/hud/vitals.ts`); the food card reads "Sugar Rush 1.5 min" (`src/ui/screens/food.ts`).

## Code map

- Items: `src/content/itemsSugar.ts`; recipes: `src/content/recipes.ts` (search `itemsSugar.ts`); icons: `src/render/textures/iconsSugar.ts`.
- Tapping: `src/player/sapTools.ts`, called from `Interaction.use` before placing and screens (Shift places the beaker instead).
- Solver: `src/content/progression.ts` knows sap comes from tapping (a beaker and a pine log); roster tables in `specRosterFood.ts`.
- Tests: `src/game/sugarRush.test.ts`, `src/player/sapTools.test.ts`, `src/content/food.test.ts`.

## Gaps

- The tap has no animation or particles yet, only the `sip` sound, a toast and the arm swing.
- Tapping state is not saved. The six-age refactor (BRONZE_PLAN W0) should keep these recipes at the Clay Furnace (Ember age).
