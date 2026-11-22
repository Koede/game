# Lane protocol (every lane architect and builder reads this first)

The overhaul runs as parallel **lanes**. Each lane has an **architect** (heads the lane: contract, task cards, review, never certifies
its own code) and **builders** (one task card each, disjoint files). The coordinator (the owner's main session) merges lanes after
verifying them. Rules of `docs/team.md` apply: whoever writes code does not certify it; the coordinator re-runs the gates itself.

Lanes: **A** Steam and Bronze mechanics, **B** distillery, **C** workshop (Create-style), **D** magic (Essentia and Research),
**E** food, farming, brewing, sugar, **F** world, progression, art and audio, **U** phone UX, HUD and onboarding.
Source of truth per lane (advisor dossiers, builder-ready, with task lists and file ownership): `docs/advice/`:
A `tech-spine.md`, B and C `distillery-workshop.md`, D and E `magic-and-food.md`, F `world-progression-art.md`, U `phone-ux.md`;
cross-cutting: `CONGRUENCE.md` (conventions, name clashes, streams), `balance-economy.md` (numbers; applied by the integration lane),
`engineering-risk.md` (perf, saves, tests, merge safety).

## Setup (once per lane)
1. Your worktree is your own checkout on branch `lane/<x>` cut from `ccr-3c8b169f-e78nk2`. Work ONLY inside it, never in `E:\Projects\game`
   (the main checkout) and never in `C:\Users\admin\game` (a junction to it).
2. No `npm install`: junction the shared modules: `New-Item -ItemType Junction -Path <worktree>\node_modules -Target E:\Projects\game\node_modules`
   (PowerShell). Playwright and Chromium live there; never run `npm install` in a lane.
3. Ports and dirs: use `HW_LANE=<x>` and pick your dev port as 5180 + the lane's index (A=0 ... U=6); build to `<worktree>\.cache\dist` with
   `node scripts/build.mjs --out=<worktree>\.cache\dist`, never into the main checkout's `dist/` (the owner serves that on 5173).
4. Foundation: a serial **foundation** session lands shared fixes on `ccr-3c8b169f-e78nk2` (line endings, save `rev` + migration chain, block-id
   lock file, folder registration, content-test refactor, hardened save modules, lane tooling). The coordinator messages you when it merged:
   then `git merge ccr-3c8b169f-e78nk2` into your lane branch (resolve in favour of the foundation for shared registries) BEFORE builders start coding.
   Until then, architects write only docs (`docs/lanes/<x>.md`) and spikes that do not touch shared registries.

## Gates (a task is Done only after all of these, run by someone other than its author)
- `npx tsc --noEmit` clean; `npx vitest run` green (use `vitest related` or a path filter inside a lane, the full run before reporting).
- The lane's own e2e script on desktop and phone portrait with `HW_GPU=1 HW_DIAG=1` (build to your own dir; e2e scripts take `--no-build`/`--out` where
  they exist; if one still hardcodes `dist/` or a shared tmp dir, fix the script first as the lane's first task).
- Solver still completes the game; roster/Codex fixtures updated; `docs/api/<system>.md` written; screenshots LOOKED at.
- Heavy jobs (full vitest, full e2e) take a machine-wide lock so only one runs at a time on this 12-thread/16 GB box: `mkdir E:\Projects\game\.gate-heavy`
  (wait 60 s and retry while it exists), `rmdir` when done, also on failure. Fast gates need no lock.

## Collision rules
- New systems go in NEW files/folders (`src/<system>/`, `content/*<Name>.ts`, `render/<system>/`, `scripts/e2e-<name>.mjs`); touch shared registries
  (`items.ts`, `recipes.ts`, `blocks.ts`, `progression.ts`, `objectives.ts`, `game.ts`, `types.ts`, `gameEvents.ts`, `painters.ts`, `package.json`) with the
  smallest possible one-line additions, APPEND-ONLY, re-reading the file right before editing. Block ids are positional and saved: only append blocks, never
  reorder or delete (the foundation's id lock file enforces it). Renaming or removing an item key needs an alias entry so old saves keep their items.
- Every persisted system needs: a save key, load that never throws and never overwrites good data with empty, a golden-save row, `diag()` points
  (`<sys>.load/.rebuild/.state`), a perf row, and an e2e step.
- Commit often to your lane branch with the attribution line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; commit only your own files; never
  revert others' edits; no push, no `main`.

## Roles and reporting
- **Architect:** reads the dossier and `CONGRUENCE.md`, writes `docs/lanes/<x>.md` (contract: data types, file ownership per task card, order, acceptance checks,
  what other lanes must provide or consume, and which of the dossier's open questions you answered), then runs the lane: starts or briefs builders
  (a builder is a session started with `use_worktree: false` INSIDE the lane worktree path via `cwd`, or by messaging the coordinator to start one), reviews every
  builder's diff and gate output (never their summary), and reports to the coordinator at each milestone and when the lane is done: commits, gate counts,
  what is left. If you cannot start sessions yourself, say so and implement the task cards yourself in order with an independent review pass from a builder
  the coordinator starts.
- **Builder:** one task card at a time, its files only, tests first where possible, stop and report when the card's acceptance checks pass.
- Messages between lanes go through the other architect (`SendMessage` to its session id, which the coordinator lists in `docs/lanes/ROSTER.md`).
