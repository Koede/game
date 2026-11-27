# Build queue (held until the current batch ends)

Launch in this order as slots free up. Each entry names the plan, the files it must not touch while others run, and its dependencies.

1. **Modular tools** (docs/plans/modular-tools.md, phases 1-2 first). Touches ItemStack, src/game/inventory*.ts, item content. Wait for: inventory moves agent and enchantments core to report. Dependency: none beyond those.
2. **Auto-build assist** (docs/plans/auto-build-assist.md). Touches src/player/interaction.ts placement and building code. Wait for: felling agent (interaction.breakBlock). Dependency: inventory moves (materials and stack counts).
3. **Caves and depths** (docs/plans/caves-and-depths.md). Touches src/world generation. Wait for: tree growth agent. Dependency: none.
4. **Legendary weapons** (docs/plans/legendary-weapons.md). Touches item specs, combat, visuals. Wait for: altar enchanting agent, loot agent (named finds already in). Dependency: enchantments phase 3-4 and modular tools' unique-part hook if available.
5. **Improvements to existing features** (docs/plans/improvements-to-existing.md), split into three briefs: (a) HUD and crosshair info line and food preview; (b) NPC routines and the topic menu; (c) technical items (flaky e2e waits, save migration tests, perf overlay). Wait for: touch controls agent (HUD) for (a).
6. **Loot phases 4-5** (docs/plans/loot-and-containers.md): mob and fishing tables, locked crates, loot log page. Wait for: loot agent finished (done) and enchantments done. Dependency: none beyond those.
7. **Tree felling follow-up**, only if the felling agent reports gaps (quick-mode polish, stump sprouting).
8. **Orrin builds a town** (docs/plans/orrin-builds-a-town.md). Phases 1-2 launched first (plan and templates, then the builder). Touches new files under src/npcs/town*, the npcs snapshot, NpcHost, src/app wiring for laying blocks. Dependency: none.

9. **Renormalize R1: town polish** (docs/plans/renormalize-2026-11-25.md). Touches src/npcs/manager.ts, townBuilder.ts, buildBoard.ts, scripts/orc.ts, src/game/nextStep.ts. Wait for: the lodge agent. Dependency: none.
10. **Renormalize R2: quality names and enchant tooltips.** Touches src/ui/screens/slots.ts and tooltip code. Wait for: nothing. Dependency: none.
11. **Renormalize R3: day-change hitch.** Touches src/world/world.ts, treeGrowth.ts. Wait for: nothing. Dependency: none.
12. **Renormalize R4: feature integration pass** (achievements, journal, objectives, pause menu, How to Play, sounds). Touches src/game/achievements.ts, journal.ts, objectives, src/ui/menus/*, src/audio cues. Wait for: R1 for the town achievement events. Dependency: none.
13. **Renormalize R5: doors in structures, season in fishing.** Touches src/world/structureDefs.ts, ruins.ts, src/sim/fishing.ts. Wait for: R3 (both in src/world). Dependency: none.
14. **Renormalize R6: stale docs sweep.** Docs only. Wait for: nothing.
15. **Renormalize R7: next wave**, one at a time in the order in the plan, starting with newcomers and the housing view (just-you-and-orrin.md phases 5-6). Touches src/npcs/manager.ts. Wait for: the lodge agent and R1.

Rules for every brief: commit only own files, never push, never stash or reset, re-read shared files before editing, report under 150 words.
