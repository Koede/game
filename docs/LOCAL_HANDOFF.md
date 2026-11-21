# Local handoff - continue Hearthwatt on your own machine

This file is for a Claude Code session running LOCALLY (on the owner's machine, attached to a checkout of this
repository). The cloud session that built the game up to here stopped at the point described in section 1.
Everything below can be done locally; the browser tests run on your own GPU, which is faster and does not
depend on the cloud VM.

## 0. Setup (once)

```
git clone https://github.com/Koede/game && cd game
bash scripts/local-setup.sh        # checks Node 22+, switches to the branch, installs, runs typecheck/tests/build
```
Branch: `ccr-3c8b169f-e78nk2` (the only branch; the repository had no base branch, so there is no PR).
Gate for every phase: `bash scripts/local-check.sh` (typecheck + unit tests + build) and, where noted,
`bash scripts/local-check.sh --e2e` (adds `npm run e2e`, which drives headless Chromium on desktop, phone
portrait, phone landscape, a sandboxed frame and the feature scripts; 5-15 minutes).

## 1. State when the cloud session stopped

See `HANDOFF.md` (status table + "Release state") for the authoritative state; the table below is the shape.

| Area | State |
|---|---|
| Game as released | v3 artifact = commit 2c247eb: five ages, flowing water, buckets, workbench shows hand recipes, 54 review fixes. Published at the artifact link the owner has. |
| Emberbound (hostile automatons) | Data, AI, combat rules, ward beacon, safe zones merged. Visuals, HUD hooks and `scripts/e2e-ember.mjs` were in progress in the cloud: check `docs/api/emberbound-render.md` and `git log --oneline -30`. |
| Brewing (tea and coffee, Ember Age) | Plan: `docs/BREWING_PLAN.md`. Cloud agents were building data, simulation, buffs, meshes/effects, UI/controls. Check `docs/api/brewing*.md`. |
| Ember handwork (hand stations, casting, leather, cloth) | Plan: `docs/EMBER_PLAN.md`. Cloud agents were building data, station simulation, casting, front end. Check `docs/api/handwork*.md`, `casting.md`. |
| Six ages + Bronze Age + steam | PLANS ONLY: `docs/BRONZE_PLAN.md`, `docs/STEAM_PLAN.md`, `docs/PROGRESSION.md`, SPEC sections 20-21. Nothing built; the repo still has FIVE furnace tiers. |
| Codex page generator | In the repo: `npm run codex`; preview with `node scripts/codex/preview.mjs <outDir>`. |

First thing to do locally: `git log --oneline -40`, read `HANDOFF.md`, run `bash scripts/local-check.sh --e2e`,
and fix whatever the cloud agents left red (they were told failures from other engineers' unfinished work
were theirs - expect a few). Unfinished agent pieces are identifiable from `docs/api/*.md` notes that list
"remaining" items and from commits titled "Checkpoint".

## 2. The owner's decisions (do not relitigate)

- The furnace is the heart of the base; workbench is minor but offers every hand recipe.
- Six ages: Ember (handwork, no steam/machines/electricity), Bronze (steam begins: kettle, rotor, shafts with
  speed and stress, then thermocouples, the boiler MULTIBLOCK, pressure, pneumatics, vacuum-drawn Bronze Chute),
  Forge (iron, steel, heavy industry, the dynamo at the END), Current, Atomic, Star.
- Bronze Furnace is one block; the steam boiler is the FIRST multiblock; the Blast hearth is the second.
- The furnace upgrade list is shown from the first minute of each age and opens the next age.
- Modern steam turbine (Current) converts steam straight to electricity; Ember/Bronze steam devices drive shafts.
- Tea/coffee: six drinks each its own boost, regrowing bushes, boiling water from any container and the Kettle Pot.
- Water flows; buckets take source blocks only. Enemies are the Emberbound automatons. Phone first, original art.
- Open: Star hearth casings (93 - keep or reduce).

## 3. Work order (one phase at a time; each ends with local-check.sh green, and e2e where noted)

1. **Land the cloud work.** Triage red tests/typecheck; finish any agent piece marked remaining; make sure each of
   Emberbound, brewing, handwork has its e2e script (`scripts/e2e-ember.mjs`, plus brewing and handwork steps -
   add `scripts/e2e-brewing.mjs` / `e2e-handwork.mjs` if missing and chain them in `package.json`'s `e2e`
   script). Real input only; `window.__hw` just for setup (docs/api/integration.md). Gate: `--e2e`.
2. **Full test run with fixes**, then rebuild and republish the game artifact (below).
3. **Six-age refactor** - `docs/BRONZE_PLAN.md` section 2 and work item W0. HIGH RISK, touches every module:
   commit the OLD-SAVE FIXTURE first (`tests/fixtures/save-before-bronze.json`, produced by the current build),
   renumber tiers/ages everywhere (`rg -n "minTier|furnaceTier|MAX_FURNACE_TIER|tier:|age:" src scripts docs/api`),
   save migration with a version bump, update solver/roster/objectives/UI text/e2e scripts, add the new tier 2
   Bronze Furnace (single block). A test must load the fixture and keep a formed Blast hearth formed. Gate: `--e2e`.
4. **Ember mechanics move**: nothing to do except confirm no steam/shaft/electric item is craftable before the
   Bronze Furnace (solver test "no electricity before tier 3").
5. **Steam, first half of Bronze** - `docs/STEAM_PLAN.md` (waves in its section 11-12; pseudocode in 14).
6. **Bronze second half** - `docs/BRONZE_PLAN.md` B1-B4 (netGraph refactor first, then heat+boiler / steam / air in
   parallel only if you have budget; the pseudocode is in its section 14).
7. **Review pass, republish**: test the game as a phone player, fix, run the full suite, republish.

## 4. Working rules that paid off

- One task per run with its plan section named; do not edit the same files from two agents at once. If you use
  sub-agents, give each a directory scope and tell them to re-read shared files before editing.
- Commit often (the cloud environment auto-committed checkpoints; locally commit when a step is green).
  Attribution line used so far: `Co-Authored-By: Claude <model> <noreply@anthropic.com>`.
- Verify visually: build to a scratch dir (`node scripts/build.mjs --out=/tmp/hw`), drive with
  `scripts/lib/browser.mjs` + `window.__hw`, and look at screenshots - screens and shaders cannot be judged from code.
- Test counts: about 1350+ unit tests; keep them green. Re-run a flaky phone e2e step alone before believing it.
- `scripts/codex/` regenerates the Codex reference page (recipes, blocks, progression tree, item map).

## 5. Publishing the playable artifact (if your session has the Artifact tool)

```
npm run build
# publish dist/artifact.html as the page with dist/game.js as a supporting file
# existing artifact (keep the URL): https://claude.ai/artifact/7pNzaEZk3XDtL2XCqtB2bj
# Codex page: https://claude.ai/artifact/9e1iDAs328yXKQSbkqxVVx  (npm run codex -> dist-codex/codex.html + codex-data.json)
```
`dist/index.html` also works from any static server (`npx serve dist`), which is the simplest way to play locally.

## 6. First message to paste into the new local session

```
You are continuing the game "Hearthwatt" in this repository (a voxel sandbox about heat, power and the furnace at
the heart of the base; the owner plays on a phone). Read docs/LOCAL_HANDOFF.md first, then HANDOFF.md, then
docs/PROGRESSION.md and the plan file for each phase as you reach it. Start with the setup/status check in
sections 0-1 (bash scripts/local-check.sh --e2e), tell me what is red, fix it, and then work through section 3
one phase at a time. Do not start the next phase until the current one passes the gate. Ask me before spending
large amounts of usage (parallel sub-agents, long e2e loops) - I am usage-limited. Commit as you go.
```
