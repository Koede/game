# Daily and seasonal goals

`src/game/dailyGoals.ts`. A side track apart from the age goals (`objectives.ts`), which it never touches.

- **Time** is the in-game clock (`clock.day`) and `sim/seasons.ts` (`seasonOf`, `DAYS_PER_SEASON`); no wall-clock time.
- **Daily**: three goals of different kinds, picked from `DAILY_POOL` by a hash of the world seed and day. Rewards are dyes. Finishing all three drops one unowned daily keepsake (else eight white stained planks).
- **Seasonal**: two goals per season, each paying one keepsake, then the season's two festival goals (`FESTIVAL_GOALS`: enter a contest at the festival for its keepsake, win gold in its own contest for its trophy; metrics `festival` and `crowns` from `NpcManager.festivalRecord()`, docs/api/npcs.md). An older save's bases lack those two metrics and start them from the present on the next sync, so no goal is paid by history. `paid` keys (`year:season:id`) stop a reload paying twice.
- **Progress** is growth of made / placed / broken / drunk / explored since the day or season began (`facts()` in `GameState`), so nothing listens to the bus.
- **Rewards** are the `Reward` union: `item` (held in `pending` until the pack has room) or `cosmetic` (a keepsake, worn as the Hearth Log's title). `blueprint` emits `blueprint:grant { id }` on the bus (winter's placing goal pays `stone_hut`); nothing else here knows blueprints, so it is harmless when no listener exists.
- **Save**: optional `dailyGoals` field of the world save; older or damaged saves start a fresh track. No `SAVE_REV` bump.
- **UI**: the Hearth Log shows today's goals, the season's goals and the keepsake shelf (tap to wear).
