# Wandering trader

## Goal

A character who arrives, stays a few days and leaves, with a stock that changes and stories worth hearing. A reason to look up at the road.

## What is fun

Never knowing what is in the pack; finding the thing you were missing; a character with opinions. Seeing them arrive at dusk with a
lantern and a goat.

## What exists

NPC systems in `src/npcs` (routines, friendship and gifts, services, dialogue banks, coins from bounties), the hermit's buy-back shelf, and
the loot tables that can stock a pack.

## Design

1. **Arrival.** Every few in-game days, at dusk, the trader walks in along the road and settles in the yard; leaves after three days. A
   horn or lantern light tells the player they are here.
2. **Stock.** Drawn from named loot tables (`trader_common`, `trader_rare`): three to five items, one rare, prices in coin. Stock is
   fixed per visit and seeded by the world and the day, so it can be planned around.
3. **Wants.** The trader also buys: one thing they ask for this visit at a bonus (a favour pinned to the quest board style).
4. **Personality.** A small phrase bank per visit (a rumour about a structure, a complaint about weather) that hints at a real location.
5. **Friendship.** Repeat visits and gifts unlock a better rare slot and a discount.

## Phases

1. Arrival, departure and a static stock from tables.
2. Buying and the wanted item.
3. Dialogue and rumours that point at real structures.
4. Friendship rewards.

## Tests

Arrival and departure schedule deterministic by seed and day; the stock respects the age cap; purchases move coin and items; rumours name
structures that exist; saved mid-visit and loaded.

## Risks

Coin inflation (cap earnings and price the rare slot high); a trader who is always there is not special, so keep visits sparse.
