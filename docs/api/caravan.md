# Trade caravans

`src/game/caravan.ts` - pure rules; no content changes.

- A caravan is in town on days where `day % 5 === 3` (`caravanHere`, `nextCaravanDay`). Its stock (`caravanStock(day)`) is three
  distinct rare goods (`RARE_GOODS`) with 2-5 units each, fixed per day.
- `new Caravan()`; call `setDay(day)` as the game day changes (fades surplus 25%/day, resets the visit's purchases).
- `sell(inv, item, count)` pays in `CURRENCY` (copper ingots) at `BASE_VALUE x 0.6`, each unit sold adds surplus that lowers the
  price (`1/(1+surplus/12)`); `buyPrice` quotes it. `buy(inv, item, count)` sells stock at `x1.6`, dearer as it runs low.
- `toJSON` / `Caravan.fromJSON` save it. Wiring left: a merchant NPC/screen, saving beside the clock, `setDay` from the game clock.

## Wiring (done)
`PlayerState.caravan` is saved as `PlayerSnapshot.caravan`; `GameState.tick` calls `setDay(clock.day)`. Screen request
`{ type: 'caravan' }` (`src/ui/screens/caravan/caravanScreen.ts`: sell rows, buy rows, purse). Old Bram opens it when used
with an empty hand on caravan days (`NpcHost.caravanPresent/openCaravan`).

## Prices fitted to the time model
`BASE_VALUE` is what the caravan buys, in copper-ingot units (fractions allowed): the item's expert seconds divided by a copper
ingot's (`src/content/timeModel.ts`), so selling never beats mining copper. A sale pays `floor(sum of unit prices)`; a lot that
pays under one ingot is refused. Cheap goods are quoted per 10 in the screen. `RARE_PRICE` is what its own goods cost (>= 1.5x
their time cost, dearer when few are left); the caravan never buys them back. `src/content/caravanBalance.test.ts` bounds all of
this at tool tiers 3-5. Saves are unchanged: old ones load, keys that are no longer bought are dropped.

## Market: supply, demand and prices
Prices now move on both sides of the counter (`src/game/caravan.ts`):
- **Supply** (your sales): unchanged. Every unit sold adds surplus that lowers that good's price (`1/(1+surplus/12)`), fading 25%/day.
- **Demand** (`demandFor(item, day)`): a per-good random walk over the last four visits (deterministic per world day, so it
  holds for a few visits instead of flickering), plus `WANTED_BONUS` on the visit's two `wantedGoods(day)`. Clamped to
  `[MIN_DEMAND 0.75, MAX_DEMAND 1.2]`; days between visits quote the coming visit. `MAX_DEMAND` stays under the time
  model's headroom, so a wanted good still never beats mining copper (`caravanBalance.test.ts` checks this at max demand).
- **Rare goods**: each one you buy raises its price on later visits by 6% (cap +60%), fading 10%/day (`rareDemandOf`).
- **Trends**: when a new visit starts, the previous visit's opening price of every good is kept (`lastQuote`), and
  `trend(item)` says up / down / steady against it (4% dead band). Glut you made shows as down.
- Save: `rareDemand` and `lastQuote` are optional in `CaravanSave`; older saves load with no history.

Screen: a news line ("Wanted this visit: ..." or, between visits, "Next caravan on day N. It will want ..."), wanted goods
listed first, each sell row has a trend arrow and a Wanted / in demand / slow / glutted tag. Phone check:
`/mnt/project-files/market-check/e2e-market.mjs` (copy into the repo's `.cache/` and run with node).
