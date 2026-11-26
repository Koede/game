# Hearthwatt - team and working agreement

Who does what on this project, how work is dispatched and accepted, and what each worker has actually proven. Maintained by
the coordinator (the owner's main Claude session). Machine: Saturn (Windows 11, 12 threads, 16 GB, RTX 3060). Workers are
Claude Code desktop sessions started by the coordinator; no other agent CLI (Codex, agy, kiro, opencode) is installed here.

## Working agreement (set by the owner, 2026-11-21)
- **Cadence: continue.** The owner said "just do it all": the coordinator keeps dispatching and accepting without asking
  between tasks. Ask the owner only for: pushing/creating `main` (publishes the game page), destructive actions, and
  decisions listed in `docs/WHATS_LEFT.md` section 0.
- **Execution: parallel streams, disjoint files.** Every stream has an owner and a file list (from `docs/CONGRUENCE.md`).
  The six-age refactor is the one exclusive phase: nobody else edits while it runs.
- **Usage: local and lean.** Everything runs on Saturn; workers read trimmed output; no sub-agent fan-out inside a worker.
- **Shared resources:** `dist/` and the e2e chain are guarded by the `.gate-heavy` folder in the main checkout (`mkdir` to take, `rmdir` to release; scripts take it themselves, see `docs/lanes/FOUNDATION.md` and `scripts/lib/lock.mjs`).
- **Notification channel:** the desktop app notes the coordinator when a session ends a turn; nobody polls.

## Roles
| Role | Who | Notes |
|---|---|---|
| Coordinator | main session (this conversation) | splits work, dispatches, verifies, decides; never delegated |
| Plan/audit author | read-only audit session (docs only) | `docs/CONGRUENCE.md`; the coordinator reviews, does not rewrite |
| Executors | one session per stream (A Steam/Bronze, B distillery, C workshop, D magic, E food/brewing, F world/progression) | one stream's files per session |
| Integration + playtest | a separate session from the stream authors | stream G: final seams, playthrough checklist |
| Adversarial reviewer | a session that did NOT write the code under review | per phase, before the coordinator signs off |

**Rule: whoever writes the code does not certify it.** After every worker reports, the coordinator re-runs
`npx tsc --noEmit`, `npx vitest run`, and the relevant `HW_GPU=1 npm run e2e` steps itself and reads the diff/commit list,
never the worker's summary. A task is Done only after that. Reports are leads, not evidence.

## Acceptance gates (each stream, before the next dispatch that depends on it)
1. Typecheck clean and the full unit suite green (coordinator-run, pasted counts).
2. The stream's e2e script passes on desktop and phone portrait with `HW_GPU=1`; screenshots looked at.
3. Solver still completes the game from a fresh world; roster/Codex fixtures updated; docs/api note written.
4. Committed (only the stream's own files), nothing left uncommitted, no stray files in `C:\Users\admin\game`.
5. For risky areas (save migration, tier gating, shared sims): an independent review session before merge.

## Observed capability (with evidence)
| Worker kind | Did well | Failed / needed correction | Last used |
|---|---|---|---|
| Feature session (Opus, auto mode) | Distillery slice (5 commits, 1865 tests green, e2e-distill); Essentia magic (24 research entries) and the Create-style workshop built to a plan with tests and e2e; Dev Mode with creative menu | Reports of "done" overstated twice: handwork front end was missing until an e2e step exposed it; e2e green claims need re-running | 2026-11-21 |
| Merge-conflict session (hand-stations) | Resolved a 16-file, ~40-hunk merge against upstream cleanly with typecheck green | Needed an explicit rule set (upstream canonical where overlapping) | 2026-11-21 |
| Unit-test session | Took 13 failures to 0 without loosening assertions (`4460f87`) | none observed | 2026-11-21 |
| E2E session | Made the chain green on the GPU; diagnosed mining, placement, sandbox-restore issues from `HW_DIAG` logs | Believed uncommitted work was lost when the repo moved to E: (it was not); verify before panicking | 2026-11-21 |
| Any session | - | Wrote into `C:\Users\admin\game` after the DiskOrganizer move: always tell sessions the canonical path (`E:\Projects\game`) | 2026-11-21 |

## Undecided
- **Independent reviewer on a different model family:** none available locally. Until one is installed (the `~/.codex`
  folder exists but no `codex` binary), adversarial review is a fresh Claude session that has not seen the code's author.
- Whether to create `main` (owner decision).
