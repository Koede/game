# Leaf decay

Leaves that no longer hang on any log fall away: a short random delay, then they disappear a few at a time, so a
crown peels over a couple of seconds. Cheap: it is a scheduled update like the water flow (`docs/api/water.md`), not a
scan. Code: `src/world/leafDecay.ts` (engine), `src/world/world.ts` (`world.leaves`), `src/game/leafDrops.ts` (drops),
`src/app/game.ts` (the tick). Tests: `src/world/leafDecay.test.ts`.

## The rule

A leaf (`oak_leaves`, `pine_leaves`) stays while a log (`oak_log`, `pine_log`, natural or player-placed) is at most
`LEAF_LOG_DISTANCE = 6` steps away, walking face to face through leaf blocks only (a leaf touching a log is at 1).
Leaves between two trees therefore hang on whichever trunk is still standing. A search that meets a chunk that is not
loaded counts as supported: nothing decays out of sight.

## When it runs

- **Wake**: `World.setVoxel` tells `world.leaves.changed(...)`. A log replaced by anything that is not a log wakes
  every leaf reachable from that cell through leaves in <= 6 steps. Each woken leaf gets its own random delay of
  `LEAF_DELAY_MIN..MAX` = 8..48 ticks (0.4-2.4 s). Edits with source `'load'` (restoring a save, ruin crates) wake
  nothing, and natural worldgen leaves are never scanned: a forest is untouched until a log is taken.
- **Look**: `world.leaves.tick()` (20 Hz, called by `Game.tickOnce` beside `world.water.tick()`) looks at the leaves
  due this tick, at most `LEAF_MAX_PER_TICK = 24`, the rest carry over. A leaf that is still supported stays.
- **Fall**: an unsupported leaf becomes air as a `'sim'` edit (so the mesh, lighting and water react as for any edit),
  the event `'leaves:decayed' { x, y, z, voxel, drops }` is emitted, and the leaves around it, which may just have lost
  their last route to a log, are woken with a short delay (`LEAF_PEEL_MIN..MAX` = 2..12 ticks): that is the "few steps".

## Randomness and saving

The World seeds the engine's rng from its world seed (`mulberry32(seed ^ 0x1eaf)`), so tests are deterministic and a
different world decays with a different rhythm. Pending work is part of `WorldSnapshot.leaves` (`{ queue: [x, y, z,
ticksLeft, ...] }`, optional: older saves mean nothing pending; damaged data only costs the pending decay).

## Drops

`rollLeafDrops` rolls the leaf's own drop table (fiber 30 %, stick 15 %, the tree's sapling 4 %). The World
emits `'leaves:decayed'`; `collectLeafDrops(bus, player)` (`src/game/leafDrops.ts`, wired in `Game`) turns the drops into
ground items at the leaf (`player.dropAll`, docs/api/ground-items.md), so they are picked up like any other drop.

## API

```ts
class LeafDecay { constructor(host: LeafHost, rng?: () => number)
  changed(x, y, z, from, to, source): void; tick(): void; supported(x, y, z): boolean
  stats(): LeafStats; toJSON(): LeafSnapshot; load(s?: LeafSnapshot): void; clear(): void }
isLeafVoxel(v), isLogVoxel(v), rollLeafDrops(voxel, rng), checkLeafSnapshot(s)
```
