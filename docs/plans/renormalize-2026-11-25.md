# Renormalize 2026-11-25: 99c9ab5..730dd3e

## Range

215 commits on `ccr-3c8b169f-e78nk2` since it split from `origin/main` (2026-11-22). About 60 features: the living tavern and its
people, the camp start with Gruk, Gruk's town and building board, housing and contentment (pure), the wooden door, tree felling and
growth, structures and landmarks, waypoints, treasure maps, fishing, seasons and weather, hot springs, night creatures, ground items,
inventory moves and pockets, build tools, blueprints, belts, the storage network, caravans, discovery, cooking and tool quality, dyes
and furniture, magic (Thaumcraft-style research, wands, golems, mirrors, aura, taint, void), the distillery and glassware, brewing,
mechanics (drivetrain, cam drum, logic gate), enchantments, loot v2, achievements, the journal and map, photo mode, emotes, settings,
haptics and phone quality of life.

Audited by four read-only passes (NPCs and town; world and crafting; magic, alchemy and machines; UI, phone and cross-cutting), then
spot-checked by hand. Excluded as in progress: the lodge and its room upgrades (`docs/plans/just-you-and-orrin.md` phases 3-4).

Counts: 14 cheap wins, 9 loose ends, 11 unwired, 14 synergy, 10 hindsight, 7 risks, 11 stale docs.

## Cheap wins (high value, small cost)

1. **The storage bay crate pays like the board.** Items put in the crate count as delivered but pay no coin, standing or trust:
   `syncCrate` adds them to stock directly (src/npcs/townBuilder.ts `syncCrate`, the `if (d > 0) this.add(item, d)` line). Route
   crate deposits that match an open bounty through the board's payout.
2. **Gruk says what he is building.** No build or town lines exist (src/npcs/scripts/orc.ts has none). Add lines for the current
   building and stage, and what the board is waiting on.
3. **A way to find the town site.** The site is 24 to 64 blocks out with no marker (src/npcs/townPlan.ts SITE_MIN/MAX). Point the
   "What next?" compass at the board when a bounty is open (src/game/nextStep.ts).
4. **Camp bedrolls sleep to dawn.** `sleepToDawn` is called only from Rosa's paid room (src/npcs/rooms.ts:72); the camp's two
   `wool_bedding` cannot skip the night.
5. **Hiring Gruk pauses his building.** `tickTown` has no companion check (src/npcs/manager.ts `tickTown`); he builds while following
   the player.
6. **Show quality names.** Tool quality (Fine, Masterwork) and dish quality (Tasty, Exquisite) are saved (src/core/types.ts:83) but no
   UI shows them: `qualityLabel` and `DISH_NAME` have no non-test caller (src/game/toolQuality.ts, src/game/cookingQuality.ts).
7. **Spread daily tree growth over frames.** On a day change `growChunkAt` runs for every loaded chunk in one frame, outside the
   frame budget (src/world/world.ts `update`, the `for (const chunk of this.chunks.values()) this.growChunkAt(...)` loop).
8. **"Run your first spirit" can fire.** `distill:step` is emitted (src/sim/distill.ts:694) but nothing listens, so the planned
   objective (docs/DISTILLERY_PLAN.md:476) never fires.
9. **Journal and achievements in the pause menu.** On a phone, the only route is tapping the goal tracker (src/ui/hud/goal.ts:28);
   the pause menu has no entries (src/ui/menus/pause.ts:117-121).
10. **How to Play covers Photo, Emote and What next.** None are in src/ui/menus/howto.ts.
11. **Achievements and journal lines for the new features.** ACHIEVEMENTS has 16 generic entries (src/game/achievements.ts:30-45);
    the journal records only goals, ages, deaths, storms, first kills and first makes (src/game/journal.ts:88-102). Add: first town
    building finished, first bounty filled, first fish, first waypoint travel, first treasure dug, first enchant, first pet, a festival
    medal.
12. **Generated structures use the new door.** Structures clear doorways only (src/world/structureDefs.ts:123); only the lodge places
    `wooden_door`.
13. **Fishing reads the season.** `CastContext` has only night and raining (src/sim/fishing.ts:22-26); seasons already reach crops
    (src/sim/simulation.ts:70).
14. **Stale docs sweep.** See "Stale docs" below.

## Loose ends (said and dropped)

- Sapling replanting and forest regrowth: no sapling item exists (docs/api/felling.md:71, docs/plans/tree-felling.md:94). Stumps and
  fallen logs never sprout (src/world/treeGrowth.ts header). High, M.
- Cooking quality on furnace dishes (stew, bread): `dishQuality` is called only from src/game/crafting.ts:242
  (docs/api/cooking-quality.md, last bullet). Med, S.
- Town phase 3 (Gruk walks to the site, hammer animation, plaza sign): `tickTown` only places blocks. Med, M.
- Town phase 4 templates (bakery, smithy, market, gardens, town hall): only five templates exist (src/npcs/townTemplates.ts);
  after the plan's last building the board says "nothing waiting on materials", which reads as a fault. Med, M.
- Trader phase 4 (friendship discount, rare slot): no trust in src/npcs/trader.ts. Low, S.
- Enchant Ember is level I only; no burn state (docs/plans/enchantments.md:102). Low, M.
- Night life: trader visits at night, owl and bat sounds, per-model meshes (docs/api/nightlife.md:11). Low, M.
- ~~Distillery rig screen~~: built after all (src/ui/screens/distill/rigScreen.ts, registered as `distill_rig` in src/app/gameWiring.ts:85-86;
  corrected 2026-11-26).
- Casting Bench is inert: `outputItem`, `addMelt`, `hasPot`, `mouldPoursLeft` have no non-test caller (src/sim/casting.ts;
  docs/WHATS_LEFT.md section 5). Med, M.

## Unwired (built, not connected)

- `src/npcs/contentment.ts`: no importer outside its test. Bram's price mood is random 0.7 to 1.4 (src/npcs/manager.ts, `traderStock`
  area) and favour pinning ignores mood. High, M. (Planned as phase 7.)
- `src/npcs/housing.ts`, `housingView.ts`, `moveIn.ts`: imported only by each other and tests. High, M. (Planned as phases 5-6.)
- `src/game/blueprint.ts` (`captureBlueprint`, `materialsOf`, `BuildJob`): no non-test caller; no corner-picking tool
  (docs/api/blueprint.md:10). High, M.
- `src/game/belts.ts` `BeltGrid`: pure sim, no blocks, renderer or save (docs/api/belts.md:3,9). Med, L.
- Waypoints have no UI beyond a toast (no `waypoint` in src/ui; src/game/exploration.ts:123-128). High, M.
- Treasure and waypoint markers are absent from the journal map (src/ui/screens/log/journalMap.ts). Med, M.
- The Mech bench is reachable only from the Dev Mode creative menu (src/ui/screens/creative/creativeScreen.ts:42-47). Med, S.
- Hydraulics, planetary/CVT/differential/rack gear math, drum spring and escapement are unused by the workshop
  (src/workshop/mech/hydraulics.ts, gearMath.ts, drum.ts:107-133; acknowledged in docs/api/mechanics.md:42-46). Low, M.
- `knockDown`, `returnsOn`, `isGrumpy` (contentment) have no caller: nothing damages NPCs. Low, S.
- Town status is reachable only through `window.__hw.town()` (src/app/debug.ts). High, M (see Hindsight: town page).
- The debug handle `window.__hw` is installed unconditionally (src/app/app.ts:93). Med, S: gate it behind dev builds or a flag the
  e2e scripts set.

## Synergy (should talk, does not)

- Veyra never buys, stocks or grades the player's brews; her service menu is fixed tonics (src/npcs/manager.ts:257,
  src/npcs/alchemy.ts:6-19). High, M.
- Rosa's bar has no distillery drink; the planned spirit drinks are absent (docs/DISTILLERY_PLAN.md section 15 item 4,
  src/npcs/drinks.ts). Med, M.
- Town standing feeds nothing: favours pay coin and trust only (src/npcs/favours.ts); trader and Rosa ignore it. Med, S.
- Building board and tavern board are separate economies asking for the same goods (logs, glass) with no link. Med, M.
- Contentment has no aura or taint tag (src/npcs/contentment.ts:13 TAGS; src/magic/aura.ts feeds no NPC). Med, M.
- Linked mirrors ignore labelled chests (src/magic/magic.ts:1921-1936 vs src/game/storage.ts). Med, M.
- Golems haul only to crate, item_vault and depot (src/magic/golems.ts:33), not the town's storage bay. Low, M.
- Blueprints cannot pull from the storage network (blueprint unwired). High, M.
- Enchantments never read tool quality (src/game/enchantEffects.ts vs src/game/toolQuality.ts). Med, M.
- Logic gates and cam drums cannot open doors (src/workshop/signals.ts has no door hook). Med, M.
- Dyes stain planks only (src/content/areas/decor.ts:37-39); doors, beds and wool take no dye. Med, M.
- Tree growth stops at felled trees (src/world/treeGrowth.ts header) and felling yields nothing to replant. High, M.
- Gruk rests on festival days (src/npcs/townBuilder.ts `workDay`) even at the camp where no festival can run (needs the tavern and
  three people, src/npcs/manager.ts festival gate). Low, S.
- Caravan and trader schedules never overlap and the caravan opens only from Bram (src/game/caravan.ts:10-12, src/npcs/trader.ts:5,
  src/npcs/manager.ts caravan opener), so a camp world never sees it. Low, S.

## Hindsight (the obvious next thing)

- A town page: the current building, its stage and percent, what is missing, days left, town standing, the next unlock. Today only
  toasts and `__hw.town()`. High, M.
- Something defends the camp at night: mobs have no camp awareness and Gruk fights only when hired (src/npcs/companion.ts). High, M.
- A waypoint picker screen and map markers. High, M.
- Replant a sapling; see a stump sprout. High, M.
- A blueprint capture tool that works on a phone. High, M.
- Enchant level and effect visible on the tool's tooltip. Med, S.
- Inventory item stats on touch (src/ui/screens/slots.ts:503 `touch: 'none'`). Med, S.
- Sounds for fishing, waypoints, pets, festival, gossip and sparring (none emit sfx). Med, S.
- Story beats for the camp, the first town building and the first newcomer (src/game/storyBeats.ts covers ages only). Med, M.
- Music and ambience volume separate from master (src/core/context.ts:18-19). Low, S.

## Risks found

- **Nobody can move in yet.** People are added only at camp start, `settle()` and load; the move-in roll is never called. In a real
  new world only Gruk ever lives there, so the festival, trader, gossip, Rosa's bar, the jukebox and Bram never start. Must land
  (just-you-and-orrin.md phase 5) before this branch goes to `main`. High.
- **The tavern flag follows the camp, not the lodge:** `hasTavern` is `at && !camp` and only `settle()` clears `camp`. Passed to the
  lodge agent to fix with its stage (d). High.
- **Day-change hitch** from tree growth (cheap win 7). High.
- **Free logs:** `tendFire` puts 12 oak logs into an empty fire every 8 s (src/npcs/host.ts), a log source outside the economy. Low.
- **The full e2e chain was not re-run** after the last merges, and nothing new has been played by hand on a phone
  (docs/WHATS_LEFT.md section 0). High, M.
- **CI perf budget:** src/workshop/mech/perf.test.ts holds 12 ms for 200 parts and runs in CI; it failed once under load in this
  session and passes alone. Med, S (loosen or move to test:perf).
- **Save keys default:** new magic keys (taint, mech `v: 1`) are additive under SAVE_VERSION 2, but not every new key is shown to
  default when absent (src/save/migrations.ts). Med, S: add an old-save fixture without them.

## Stale docs

Swept 2026-11-26 (R6). Fixed: docs/api/housing.md:13 (DOOR_KEYS is `wooden_door`); docs/plans/orrin-builds-a-town.md:97 and phase 5
(reputation unlocks are built, `UNLOCK_REP` in src/npcs/buildBoard.ts); docs/WHATS_LEFT.md sections 4 to 7; docs/CONGRUENCE.md:134-137
and :327; docs/DISTILLERY_PLAN.md section 15 (`distill:step`, reflux head, filter bed, lubricant consumer, rig screen);
docs/plans/touch-and-settings.md (graphics control, radial menu and photo PNG exist); docs/api/sugar.md:17 (sap taps are saved);
docs/team.md (`.gate-heavy`, not `.run-lock`); docs/plans/README.md (status column instead of "nothing here is built yet").
Not stale on recheck: docs/api/felling.md cites only `treeDamage.test.ts` (which exists) and the `treeDamage` setting; no doc cites
src/game/waypoints.ts or src/game/fishing.ts any more.

Still open, owned by other sessions: docs/api/door.md:13 (door pathing is fixed, 5fb7455); docs/api/npcs.md:53-55 (shop and quest
board shipped) and :129 (Veyra's skull smoke is wired); src/npcs/manager.ts:3 docstring (new worlds use startCamp; `buildStart` has no
callers); docs/api/hud.md:139.

## Briefs

Each is self-contained. Order and file ownership are in docs/plans/QUEUE.md (items 9 onwards).

### R1. Town polish (after the lodge agent reports)
Goal: cheap wins 1 to 5 and the festival rest fix. Files: src/npcs/manager.ts, townBuilder.ts, buildBoard.ts, scripts/orc.ts,
src/game/nextStep.ts. Do: crate deposits that match an open bounty pay through the board (coin, standing, trust), anything else
still goes to stock; Gruk's lines name the building, stage and what is missing; "What next?" points at the board when a bounty is
open; camp bedrolls call `sleepToDawn` (same rules as the paid room: only at night, not with hostiles near); hiring Gruk pauses
building for the hire's length; no rest on festival days while no festival can run; after the last planned building the board
says the town is finished. Tests for each; keep the suite and tsc green. Must not touch the lodge files while that agent runs.

### R2. Quality names and enchant tooltips
Goal: cheap win 6 plus enchant info. Files: src/ui/screens/slots.ts and the tooltip code, src/game/toolQuality.ts,
cookingQuality.ts, src/core/enchant.ts (read only). Do: item names and tooltips show Fine/Masterwork and Tasty/Exquisite; tools show
their enchants with level and a one-line effect; touch gets a long-press tooltip (src/ui/screens/slots.ts:503). Tests on the label
functions and a UI snapshot or e2e step.

### R3. Day-change hitch
Goal: cheap win 7. Files: src/world/world.ts, src/world/treeGrowth.ts. Do: queue the day's chunk growth and process it within the
frame budget (a few chunks per frame), keeping the result identical. Test: growth after the queue drains equals growth done at once.

### R4. Feature integration pass
Goal: cheap wins 8 to 11, plus sounds for fishing, waypoints, pets, festival, gossip and sparring. Files: src/game/achievements.ts,
journal.ts, objectives (src/content/objectives*.ts, src/game/objectives.ts), src/ui/menus/pause.ts, howto.ts, src/audio cue tables.
Do: a listener for `distill:step` that completes "Run your first spirit"; Journal and Achievements entries in the pause menu; How to
Play entries; achievements and journal lines for the listed firsts (listen to existing events; add an event where none exists,
emitted from the feature, not polled). Tests for each new achievement and journal entry.

### R5. Doors in structures, season in fishing
Goal: cheap wins 12 and 13. Files: src/world/structureDefs.ts, src/world/ruins.ts, src/sim/fishing.ts. Do: houses and lodges among
the generated structures get a `wooden_door` in their doorway; fishing catch odds read the season (one or two fish per season
more likely). Tests: structure tests see a door; fishing tests per season.

### R6. Stale docs sweep
Goal: cheap win 14. Files: the docs listed under "Stale docs" and the src/npcs/manager.ts:3 docstring. Do: correct each claim against
the code; no code changes.

### R7. Next wave (larger, one at a time)
In order: newcomers and the housing view (just-you-and-orrin.md phases 5-6, unblocks the whole settlement); contentment wiring
(phase 7, plus town standing into favours and prices); a town page; waypoint picker and map markers; sapling item, replanting and
stump sprouting; Veyra buys and grades brews, Rosa serves spirits; camp defence at night; town phase 3
(Gruk on site) and phase 4 templates; the blueprint capture tool with storage-network pull; full e2e chain and a phone play-through.
