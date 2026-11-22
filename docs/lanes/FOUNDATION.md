# Foundation (what changed, how lanes register content, gates)

Landed serially on `ccr-3c8b169f-e78nk2` by the foundation session. Merge it into your lane branch before builders start coding
(`git merge ccr-3c8b169f-e78nk2`; for shared registries take the foundation's side). Spec: `docs/advice/engineering-risk.md` sections 0, 2-5.

## Commits
| Step | What |
|---|---|
| R10 | `.gitattributes` (`* text=auto eol=lf`, merge=union for `docs/lanes/*.md`, HANDOFF.md, the id lock, the save manifest); `.gitignore` gains `.cache`, `.locks`, `.gate-heavy`, `_generated/`. The index was already LF, so the renormalise was a no-op. Working copies stay CRLF on Windows (`core.autocrlf=true`): harmless. |
| R4 | `WorldSave.rev` (current `SAVE_REV = 2`, `src/save/migrations.ts`), `SAVE_VERSION` stays 2. Chain `MIGRATIONS[n]` upgrades rev n -> n+1 in place; the six-age v1->v2 migration is entry 1. `normalizeDocument` runs the chain on every read, a throwing step or a newer rev holds the save (existing "held" flow: `.bak` copy, never overwritten). Rolling `hearthwatt.save.prev` (previous text, refreshed when the stored save is >= 10 min older than the new write, dropped first on quota). `src/content/aliases.ts` + `canonicalItemKey()` (registry) used by slot sanitising, inventory, ground items, logistics cells, machine buffers: unknown keys are counted and toasted once ("N item stacks from an old version ... removed"). Golden saves: `tests/fixtures/saves/manifest.json` + `src/save/saves.test.ts` (loads clean, summary, 200 ticks, byte-identical re-serialise, no lost items). Rows: `before-bronze` (immutable), `sixage-rev2`, `modules-all` (workshop, magic, vehicles). |
| R1 | Block-id lock `src/content/blockIds.lock.json` (220 ids, one `"key": id` per line) + `blockIds.test.ts` (ids stay, no deletion, nothing unlocked). Folder registration (below). |
| R2 | `specRoster*.ts` rosters now PIN what existed (subset checks via `rosterCheck.ts`, no count literals); golden snapshot `tests/golden/content.json` (`npm run golden:update`): fails when an existing block/item/recipe/machine/objective changes or disappears, lists additions. |
| R3 | Workshop, Magic and Vehicles are created, loaded, persisted and ticked in `GameState` (headless; `Game` only adds renderers/screens and the craft gate). `World.loadExtra(key, fn)`: a throwing module load keeps the raw data as `extras["<key>.bad"]` (written back on every save) and toasts once. |
| R9 | `scripts/lane-new.ps1` / `lane-rm.ps1`, `scripts/lib/lock.mjs`, `scripts/with-lock.mjs`, `scripts/e2e-all.mjs`, `scripts/lib/e2eArgs.mjs`, `scripts/local-check.sh` modes, perf vitest project, `playwright` pinned (1.65.1), phone render distance capped at 6. |

## How a lane registers content now (no shared file is edited)
1. New file `src/content/areas/<name>.ts` with `export default { blocks, items, recipes, machines, fluids, objectives, objectivesAfter, naturalBlocks, itemAliases } satisfies AreaContent`
   (`src/content/area.ts`). Data only: import types and `./amounts`, never the registry or `items.ts` (cycle). Objectives are inserted after the goal id
   in `objectivesAfter` (default: end of list; the order of `OBJECTIVES` is the goal order).
2. Textures: `src/render/textures/areas/<name>.ts`, default export a `PainterSet`.
3. New blocks: run `npm run ids:sync` and commit `blockIds.lock.json` (appends next free ids; ids are permanent, never reorder or delete; a duplicate id after a merge keeps its first key and
   `ids:sync` moves the other). Items/recipes/objectives/flags/aspects/research keys are also permanent: rename = `itemAliases` entry.
4. Existing entries are pinned by the golden snapshot: changing one needs `npm run golden:update` and a reviewed diff of `tests/golden/content.json`. New entries pass (listed in test output).
5. The indexes `src/content/_generated/areas.ts` and `src/render/textures/_generated/areas.ts` are generated and gitignored: `npm run` hooks (`pretest`, `pretypecheck`, `prebuild`), `build.mjs`,
   the vitest global setup and `lane-new` regenerate them. A bare `npx tsc` in a fresh checkout needs `node scripts/gen-indexes.mjs` once.
6. Still shared and edited by hand (append-only, one line): `game.ts` wiring for UI screens, `types.ts` closed unions, `gameEvents.ts`, `core/registry.ts` validators (R6/R5 are later work).
7. A persisted system: put its state under `extras.<key>` (`world.persist` + `world.loadExtra`), create it in `GameState`, add a row to the save manifest. Never add top-level `WorldSave` fields.
   Never bump `SAVE_VERSION`. A reshaping change bumps `SAVE_REV` and appends `MIGRATIONS[oldRev]` with a golden pair.

## Gates
- `bash scripts/local-check.sh --fast`: gen check, ids check, tsc, vitest on files changed vs `$HW_BASE` (default `ccr-3c8b169f-e78nk2`). No lock.
- `bash scripts/local-check.sh`: + full vitest + build to `.cache/dist-check` (heavy lock). `--perf` adds `npm run test:perf` (serial), `--e2e[=a,b]` adds `e2e-all`, `--ci` = all of it,
  writes `test-results/check.json` (commit, lane, counts, per-step seconds): the coordinator pastes this.
- Heavy lock: one directory `<main checkout>/.gate-heavy`, shared by all worktrees (`mkdir`/`rmdir` by hand still works; scripts take it themselves, steal it from a dead pid or after 40 min).
  `HW_LOCK_HELD=1` marks a parent that holds it.
- e2e: `node scripts/e2e-all.mjs [--only=a,b] [--jobs=2] [--no-build] [--out=<dir>]` (builds once to `.cache/dist-e2e`, runs every `scripts/e2e*.mjs`, continues after failures, table, exit 1,
  `test-results/e2e-all.json`). Every e2e script accepts `--dist=`/`--out=` and `--no-build`; none uses `dist/` or a fixed tmp dir any more. `npm run e2e` is `e2e-all`. Run a single one with
  `node scripts/e2e-workshop.mjs [--no-build]`. Use `HW_GPU=1 HW_DIAG=1` as before.
- Timing tests are out of the default run: whole files `*.perf.test.ts`, embedded ones use `perfIt` (`src/testing/perf.ts`, skipped unless `HW_PERF=1`); `npm run test:perf` runs them serially.
  New timing assertions: use `perfIt` or a `*.perf.test.ts` file (add embedded files to `vitest.perf.config.ts`).
- Lanes: `powershell -File scripts/lane-new.ps1 -Lane B` (worktree `E:\Projects\hw-lanes\B`, branch `lane/b`, `node_modules` junction, indexes generated, no install);
  `lane-rm.ps1 -Lane B [-DeleteBranch]` removes the junction first. With `HW_LANE=<A..F|U>`: dev port 5180 + index, build dir `.cache/dist`.

## Decisions recorded (owner answers and mine)
- Playwright pinned in `devDependencies` (1.65.1, lock file updated). `rev` migration chain, rolling `.prev` save, eol renormalise: yes. Phone render distance capped at 6 (slider and saved values).
- A damaged module is kept as `<key>.bad` but the live module's state still overwrites `<key>` on the next save (nothing is lost: `.bad` keeps the old data); the dossier's "skip overwriting until the player acts" was not needed.
- Not done (outside the asked steps; for lanes or later): multi-tab `storage` event warning, `savePerf.test`, `corruption.test` fuzz, R5-R8, `diagEvery`, a golden row per FUTURE module (a lane adds its own row + fixture),
  `docs/team.md` still mentions `.run-lock` (replace with `.gate-heavy`; it is the coordinator's untracked file).
- Known flake source: timing tests under CPU contention. They are now out of the default run.
