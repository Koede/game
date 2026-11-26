# Balance model and invariants (docs/advice/balance-economy.md)

## Time model (`src/content/timeModel.ts`, pure)
- `TIME_PARAMS`: `attendedS` 2 (taps per hand / workbench / forge recipe), `passiveShare` 0.25 (share of a smelt's or
  machine's seconds counted), `playerFactor` 2 (expert -> phone player; unmeasured), `defaultRawS` 5, `rawS` (gather
  seconds per raw item, dossier table 1.2), `containers` (reusable, cost 0; every `*_mould` too).
- `craftSeconds(recipe)`: strokes / (strokesPerS x 2 with the station's tool) at a stroke station, else taps + passive share.
- `itemCosts()`: expert seconds per item, cheapest route over `RECIPES` (fixed point, cached). Tool outputs and expected
  bonus outputs count (the expert holds the tool).
- `AGE_KITS[age]`: the tools and machines each age teaches beyond its goals (Bronze: tools only until the boiler kit lands).
- `ageBundle(age)`: goals of that age (make / have / place; cheapest branch of `any`) + kit + next furnace's
  `upgradeCost` + `hearthMaterials(next tier)`, merged by max count. `expertMinutes(age)`, `playerMinutes(age)`.
- Today (expert min): Ember ~10, Bronze ~12, Forge ~41, Current ~57, Atomic ~77.

## Tests
- `timeModel.test.ts` (T1): dossier bands Ember 8-18, Bronze 28-42, Forge 20-32, Current 24-36, Atomic 28-48, ratio
  0.6-2.5x, total <= 190. `PENDING` widens the four ages outside today, each with its reason; a test fails once an age
  is back in band so the widening goes with the fix.
- `balance.test.ts`: T2a loops through `CONVERSIONS` (core/constants: `W_PER_SU` 50, `ETA_*`) multiply to <= 0.6, and the
  machines use the table; T2b no recipe gains fuel energy beyond charcoal x2, coke x1.25 and the split-wood gap (plank
  x1.2, stick x2), nothing the distillery makes is fuel; T2c two lithium banks carry the 300 kW x 90 s ignition; T3 work
  per stress unit is equal from 4 to 144 rpm; T8 speed <= 1.4, mining x Well-Warmed <= 1.6, regen <= 4, Well-Fed x
  Lasting drain >= 0.4.
- Not yet: T4 (generators double-dip shaft and watts; the shaft share needs wiring in `src/app/state.ts`).

## Numbers changed by the balance pass
`DRINK_BUFF_S` 180 -> 300; `CINDER_BURN_S` 90 -> 45; coke 1.2 MJ / 120 s -> 1 MJ / 100 s (same 10 kW fire);
`sugar_cookie` 4 x 3 food -> 3 x 2; `LASTING_DRAIN_MULT` 0.5 -> 0.7, `WELL_FED_DRAIN_MULT` 0.5 -> 0.6, Sugar Rush
hunger x1.25 (`SUGAR_DRAIN_MULT`); stress `base x clamp(16/rpm, .25, 4)` -> `base x |rpm|/16`; clockwork 48 -> 24 su,
treadwheel 24 -> 12 su; wind / solar `shareRadius` 12 / 6; distillery 16/8/4 -> 8/4/2 (wash 12%, low wines 36%),
ethanol grade 0.25/0.2 -> 0.5/0.4; `mech_millstone` +2 bronze_plate, `mech_loom` +2 bronze_plate +1 bronze_cog;
`plasma_casing` 2 -> 4 per forge, `star_casing` 2 -> 6 per forge without a magnet ring, `star_core` 6 -> 3 rings,
Starhearth upgrade 8 -> 4 deuterium_cell.
