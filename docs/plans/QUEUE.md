# Build queue (held until the current batch ends)

Launch in this order as slots free up. Each entry names the plan, the files it must not touch while others run, and its dependencies.

1. **Modular tools** (docs/plans/modular-tools.md, phases 1-2 first). Touches ItemStack, src/game/inventory*.ts, item content. Wait for: inventory moves agent and enchantments core to report. Dependency: none beyond those.
2. **Auto-build assist** (docs/plans/auto-build-assist.md). Touches src/player/interaction.ts placement and building code. Wait for: felling agent (interaction.breakBlock). Dependency: inventory moves (materials and stack counts).
3. **Caves and depths** (docs/plans/caves-and-depths.md). Touches src/world generation. Wait for: tree growth agent. Dependency: none.
4. **Legendary weapons** (docs/plans/legendary-weapons.md). Touches item specs, combat, visuals. Wait for: altar enchanting agent, loot agent (named finds already in). Dependency: enchantments phase 3-4 and modular tools' unique-part hook if available.
5. **Improvements to existing features** (docs/plans/improvements-to-existing.md), split into three briefs: (a) HUD and crosshair info line and food preview; (b) NPC routines and the topic menu; (c) technical items (flaky e2e waits, save migration tests, perf overlay). Wait for: touch controls agent (HUD) for (a).
6. **Loot phases 4-5** (docs/plans/loot-and-containers.md): mob and fishing tables, locked crates, loot log page. Wait for: loot agent finished (done) and enchantments done. Dependency: none beyond those.
7. **Tree felling follow-up**, only if the felling agent reports gaps (quick-mode polish, stump sprouting).

Rules for every brief: commit only own files, never push, never stash or reset, re-read shared files before editing, report under 150 words.
