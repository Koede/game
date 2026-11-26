# Daily and seasonal goals

`src/game/dailyGoals.ts`. A side track apart from the age goals (`objectives.ts`), which it never touches.

- **Time** is the in-game clock (`clock.day`) and `sim/seasons.ts` (`seasonOf`, `DAYS_PER_SEASON`); no wall-clock time.
- **Daily**: three goals of different kinds, picked from `DAILY_POOL` by a hash of the world seed and day. Rewards are dyes. Finishing all three drops one unowned daily keepsake (else eight white stained planks).
- **Seasonal**: two goals per season (`SEASONAL_GOALS`), each paying one keepsake. `paid` keys (`year:season:id`) stop a reload paying twice.
- **Progress** is growth of made / placed / broken / drunk / explored since the day or season began (`facts()` in `GameState`), so nothing listens to the bus.
- **Rewards** are the `Reward` union: `item` (held in `pending` until the pack has room) or `cosmetic` (a keepsake, worn as the Hearth Log's title). A blueprint reward is a new `Reward` variant plus a branch in `grant`.
- **Save**: optional `dailyGoals` field of the world save; older or damaged saves start a fresh track. No `SAVE_REV` bump.
- **UI**: the Hearth Log shows today's goals, the season's goals and the keepsake shelf (tap to wear).
