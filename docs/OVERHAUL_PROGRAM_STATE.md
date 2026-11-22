# Overhaul program - state at handoff (2026-11-21/22)

The owner asked to "overhaul each plan and step, add each feature in the plan, and make sure there is congruency amongst systems",
run as a team of advisors, architects and builders, "multilane builders with architects heading each lane", finished quickly.
This file says exactly how far that program got, so a fresh session can resume it in minutes.

## Done
| Item | Where | Notes |
|---|---|---|
| Six-age refactor (BRONZE_PLAN W0) | `4f2abb4`, `b062df1`, `5c37df5` | Ember, Bronze, Forge, Current, Atomic, Star; single-block Bronze Furnace is tier 2; hearths from tier 3; save migration v1->v2; old-save fixture `tests/fixtures/save-before-bronze.json`. 1994 tests green when verified. |
| Congruency audit | `docs/CONGRUENCE.md` | systems matrix, conventions sheet, contradiction list, streams A-G, cross-stream ideas, playtest checklist. |
| Seven advisor dossiers | `docs/advice/*.md` | tech-spine, distillery-workshop, magic-and-food, world-progression-art, phone-ux, balance-economy, engineering-risk (about 3,400 lines, builder-ready task lists with file ownership and acceptance checks). |
| Team file and lane protocol | `docs/team.md`, `docs/lanes/README.md`, `docs/lanes/ROSTER.md` | working agreement, gates, collision rules, roles. |
| Foundation step R10 | `1a74ab6` | `.gitattributes` eol=lf. |
| Foundation step R4 | `d71a41f` | `WorldSave.rev` migration chain (six-age folded in), alias table, rolling `.prev` backup, golden-save manifest. 2005 tests green. |

## Partial / not started
- **Foundation steps R1 (block-id lock + folder registration), R2 (content-test roster refactor), R3 (move Workshop/Magic/Vehicles persistence into
  `GameState`), R9 (lane tooling, e2e `--out`, pinned playwright, perf project)**: spec in `docs/advice/engineering-risk.md` sections 2-5. The foundation
  session was asked to stop at a green state and write `docs/lanes/FOUNDATION.md` with the exact remainder; read that file first if it exists.
- **Seven lane architects (A steam/Bronze, B distillery, C workshop, D magic, E food/brewing, F world/art, U phone UX) never started**: Claude Desktop refused to
  start worktree sessions until the owner clicks **Trust repository** for `E:\Projects\game`. Nothing was lost; their briefs are reproduced by the protocol
  (`docs/lanes/README.md`) plus the dossier named for each lane in that file. The lane branches `lane/a` .. `lane/u` do not exist yet.
- Builders, the integration lane (apply `balance-economy.md` numbers, playtest checklist), the fresh-eyes review and the final republish: not started.

## How to resume (fastest path)
1. Click Trust for the repo in Claude Desktop (or run lanes as ordinary sessions on the shared checkout using the `.gate-heavy` lock and disjoint files).
2. Finish the foundation first (R1, R2, R3, R9; see FOUNDATION.md), serially, one session, because every lane touches the block ids, registries and saves.
3. Start the six lanes + U in parallel from the dossiers: per lane an architect writes `docs/lanes/<x>.md` (contract, task cards, file ownership), then builders
   implement; the coordinator verifies each lane (tsc, full vitest, the lane's e2e with `HW_GPU=1 HW_DIAG=1`) before merging; whoever wrote code never certifies it.
4. Integration lane: balance numbers, full e2e chain, playtest checklist (`CONGRUENCE.md` section 7, `world-progression-art.md` section 7); then a fresh-eyes review;
   then rebuild, `bash scripts/make-handoff-bundle.sh`, and ask the owner before pushing / creating `main` (publishes the game page).

## Verified state when this was written
`npx tsc --noEmit` clean and the unit suite green at the last commit the coordinator verified (1994 passed after the refactor, 2005 after R4 per the foundation
session's report). The full e2e chain has NOT been run end to end since the six-age refactor: the main e2e had two flaky steps (mining with ground items,
sandbox restore), the rest was not run. Run `HW_GPU=1 HW_DIAG=1 npm run e2e` first.

## UPDATE: foundation complete (HEAD `29bd0b4` and later; verified by the coordinator)
All six foundation steps are done and green: R10 `1a74ab6` line endings, R4 `d71a41f` save `rev` migration chain + alias table + `.prev` backup, R1 `1af5d03` block-id
lock + folder-registered content areas (`src/content/areas/<name>.ts`, `npm run ids:sync`, generated gitignored indexes), R2 `bff75aa` roster tests as subset checks + golden
snapshot (`npm run golden:update`), R3 `88bd507` Workshop/Magic/Vehicles persisted in `GameState` with `.bad` copies of damaged modules, R9 `29bd0b4` lane tooling
(`lane-new/rm`, heavy lock, per-worktree build dirs for every e2e script, `local-check` fast/full/ci, serial perf project `npm run test:perf`, pinned playwright, phone render distance cap 6).
Read `docs/lanes/FOUNDATION.md` for the exact how-to. Verified: `npx tsc --noEmit` clean; `npx vitest run` 175 files, 2010 passed + 11 skipped (timing tests); `npm run test:perf` 153 passed.
GitHub: the working branch `ccr-3c8b169f-e78nk2` carries everything (the offline `main` and the Cursor fixture branch were merged in at `f6b0d79`/`385736c`; the Pages workflow is manual-dispatch only).
`origin/main` was NOT fast-forwarded (a permission prompt blocked it); it still contains only the old history plus the Pages-disable commit and is fully contained in the working branch.
The seven lane architects are still NOT running (Claude Desktop needs the owner's Trust-repository click for worktree sessions; their session records show `failed`). Foundation is no longer a blocker:
the next step is simply to start the lanes (see "How to resume" above), now with `lane-new` for worktrees.
