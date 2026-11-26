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
