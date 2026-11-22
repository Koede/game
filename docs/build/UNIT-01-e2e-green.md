# Unit 1 - E2E chain green (build spec)

Status: design pass, written 2026-11-22 against `docs/build/SYSTEMS.md` (the binding shared design). This is a TEST-AND-FIX
plan: it records what the eleven browser scripts actually do today on this container (headless Chromium, software WebGL,
no `HW_GPU`), why each red step is red, the exact fix, and the protocol that keeps the chain green while Units 0 and 2-19 land
on top of it.

Threads: none new; Unit 1 guards all ten (SYSTEMS section 7: "Re-runs `npm run e2e` headless and fixes real regressions so
every later unit's e2e step lands on a green baseline"). It reads, and never changes, every shared id of section 6. It
DEFINES three things every later unit consumes (section 6.2 row "e2e chain green -> everyone"):

| defined here | what it is | consumed by |
|---|---|---|
| `scripts/lib/e2eHarness.mjs` | one argument parser, one step wrapper, one new-world opener, one timeout scale for all scripts | every unit that adds an e2e step |
| `scripts/e2e-all.mjs` (+ `npm run e2e` pointing at it) | sequential runner with a summary table, no `&&` short-circuit, a flake retry policy | coordinator, every unit's acceptance |
| `window.__hw` set-up/read helpers `clearYard`, `events` / `eventsOf` / `clearEvents` (`src/app/debug.ts`, logic in `src/app/debugHelpers.ts`) | the set-up and event recorders the scripts keep re-implementing inline | Units 2-19 |

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and purpose

Hearthwatt's e2e scripts are the only thing in the repository that plays the game the way a player does: real keys, real
mouse buttons, CDP multi-touch fingers on phones, the real HUD and screens. `docs/SESSION_CONTEXT.md` section 9 records the
lesson the project already paid for: "a failing step can be a real game bug (the handwork front end was missing entirely and
only the e2e showed it)". `docs/WHATS_LEFT.md` section 0.1 lists "run the whole e2e chain ... and fix what is red" as the
FIRST item of the whole remaining build, because nobody has run the chain end to end since the last merges.

This unit:

1. Runs every script headless (desktop first; phone portrait where the script has UI on phones) and records the result
   (section 4).
2. Classifies each red step as (a) a game bug, (b) a stale script (content changed under it), or (c) a timing flake of
   software WebGL, and gives the exact fix per class (sections 5 and 6). Game bugs are fixed in `src/`; scripts are changed
   only where the script is wrong, with a sentence of justification each.
3. Replaces the `&&`-chained `npm run e2e` with a runner that runs every script even after one fails, prints one summary
   table, and applies a written flake policy (section 7).
4. Writes the protocol every later unit follows when it adds e2e steps (section 8), so 19 units do not each invent a
   step wrapper, a timeout, a seed and a screenshot folder.

Headline of the investigation (section 4): on commit `2b24bdc`, run one browser at a time, 9 of 11 scripts pass on desktop
and 6 of 11 device runs fail on phones; every red step traces to the test harness or a stale script - none to game code.
Nine root causes are listed in section 5 with exact fixes (plus a table of flag inconsistencies); the deterministic ones
were proven by re-running a patched scratch copy of `scripts/` (section 4.3), which turned every red script that was
re-run green.

Why it matters to the game and not only to CI: the scripts walk the player's first hour (logs -> chopping block -> workbench
-> flint pickaxe -> clay furnace -> fire -> copper -> mould -> death -> respawn at the hearth -> save/continue). That is the
spine of SYSTEMS section 1.1 ("the furnace is the heart") as a test. If it is red, every later unit's own step either
cannot run (the scripts stop at the first failing step of a device and skip the rest) or runs on top of a broken hearth.

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads and contracts

- **T1-T10: guarded, not changed.** Unit 1 changes no number of section 5, no id of section 6, no shape of section 6.5. If a
  fix below touches game code, it is a bug fix in the existing behaviour of the file named, never a new rule.
- **SYSTEMS 6c (E2E conventions) is made executable here.** "extend the feature's existing script with named steps", "use
  `window.__hw` only for setup and reading state, real input for the action", "run `--device=desktop` and, for any UI, also
  `--device=phonePortrait`", "save a screenshot per new step to `test-results/e2e-<feature>/`" - section 8 turns each sentence
  into a helper and a check.
- **SYSTEMS 6d anti-patterns that apply to scripts:** no hard-coded lists where a registry exists (a script that asserts a
  recipe list by hand goes stale; assert through `window.__hw` reads of the registry instead); nothing that teleports the
  ACTION under test (teleport is set-up only).
- **Wave order (6.3):** Unit 1 runs in Wave 0 beside Unit 0. Unit 0 must leave every existing test green; Unit 1's runner is
  the tool that proves it for the browser side. If Unit 0 merges first, Unit 1 re-runs the chain on top of it before merging.
- **Files Unit 1 may touch:** `scripts/e2e*.mjs`, `scripts/lib/*.mjs`, `package.json` (`scripts.e2e` only),
  `src/app/debug.ts` (helpers), and any `src/` file named in section 5 as the root cause of a red step. It never edits
  `docs/build/SYSTEMS.md` or `docs/WHATS_LEFT.md`.

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state (what exists, measured)

### 3.1 The chain

`package.json` `scripts.e2e` is eleven commands joined by `&&`:

```
node scripts/e2e.mjs && node scripts/e2e-features.mjs --no-build && node scripts/e2e-tech.mjs --no-build
&& node scripts/e2e-ember.mjs --no-build && node scripts/e2e-handwork.mjs --no-build && node scripts/e2e-ground.mjs --no-build
&& node scripts/e2e-vehicles.mjs --no-build && node scripts/e2e-dev.mjs --no-build && node scripts/e2e-distill.mjs --no-build
&& node scripts/e2e-magic.mjs --no-build && node scripts/e2e-workshop.mjs --no-build
```

Consequences: the first red script hides the other ten; a fully green chain on software WebGL takes well over an hour; there
is no summary. CI (`.github/workflows/ci.yml`) runs `typecheck`, `test`, `build` only - no e2e.

### 3.2 Inventory of scripts

| script | steps (incl. lib) | default devices | build behaviour | dir flag | seed |
|---|---|---|---|---|---|
| `scripts/e2e.mjs` (+ `lib/e2eFurnace.mjs`, `lib/e2eSandbox.mjs`) | 17 + 5 + 7 | desktop, phonePortrait, phoneLandscape, sandbox | builds `dist/` unless `--no-build` | none (dist/) | `hearth-e2e` |
| `scripts/e2e-features.mjs` (+ `lib/e2eFeatures.mjs`) | 4 + 10 | desktop, phonePortrait | builds `dist/` unless `--no-build` | none | constant in file |
| `scripts/e2e-tech.mjs` (+ `lib/e2eTech.mjs`) | 4 + 11 | desktop, phonePortrait | builds unless `--no-build` | `--dist=` | constant |
| `scripts/e2e-ember.mjs` (+ `lib/e2eEmber.mjs`) | 4 + 7 | desktop, phonePortrait | builds unless `--no-build` | none | constant |
| `scripts/e2e-handwork.mjs` (+ `lib/e2eHandwork.mjs`) | 4 + 11 | desktop, phonePortrait | builds unless `--no-build` | `--dist=` | constant |
| `scripts/e2e-ground.mjs` | 9 | desktop ONLY (`--device` takes one) | never builds; ignores `--no-build` | `--out=` | constant |
| `scripts/e2e-vehicles.mjs` | 10 | desktop ONLY | ALWAYS builds to `$TMP/hw-e2e-vehicles`; ignores `--no-build` | `--out=` | constant |
| `scripts/e2e-dev.mjs` | 13 | desktop, phonePortrait, phoneLandscape | builds to `$TMP/hearthwatt-e2e-dev` unless `--no-build` | `--dist=` | Dev Mode world |
| `scripts/e2e-distill.mjs` | 12 | both under `--no-build` or with no `--device`; one with `--device=` | never builds | `--out=` | constant |
| `scripts/e2e-magic.mjs` | 18 | desktop, phonePortrait | builds to `$TMP/hearthwatt-e2e-magic` unless `--no-build` | `--dist=` | `hearth-magic` |
| `scripts/e2e-workshop.mjs` | 12 | desktop, phonePortrait | builds to `$TMP/hearthwatt-e2e-workshop` unless `--no-build` | `--dist=` | `hearth-workshop` |

Shared helpers: `scripts/lib/browser.mjs` (`openGame`, `waitFor`, `createReporter`, `VIEWPORTS`, `loadPlaywright`),
`scripts/lib/e2eDriver.mjs` (`Driver`: real-input movement, mining, Use, screens, placing, hand stations),
`scripts/lib/diag.mjs` (`HW_DIAG=1` JSONL log + failure screenshots), `scripts/lib/bundle.mjs`, `scripts/lib/png.mjs`.

Drift between scripts (each one is small; together they are why a later unit cannot "just add a step"):
- Eleven copies of the same `step` closure (skip-after-first-failure + `FAILED-<name>.png`), three flag parsers
  (`flag(name)` returning arrays, `flag(name, fallback)` returning a string, `arg(name, fallback)`).
- Three spellings of the build directory flag (`--dist=`, `--out=`, none) and two meanings of `--no-build` (honoured,
  ignored).
- Device defaults differ per script without a stated reason (ground and vehicles are desktop-only).
- Timeouts are literal milliseconds chosen on the author's machine, mostly with `HW_GPU=1` on an RTX 3060
  (SESSION_CONTEXT 9). On this container software WebGL renders the 1280 x 800 desktop viewport at a few frames per second
  and every `page.evaluate` waits behind a frame (section 4.1). A 5 s `waitForSelector` that is generous on a GPU is a
  coin-toss here.

### 3.3 Environment used for the investigation

- Linux container, 4 cores, 16 GB, Node 22, Playwright from `NODE_PATH=/usr/local/lib/node_modules_global`, Chromium
  157 from `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` (headless shell), no GPU: SwiftShader software WebGL.
- `npm ci` (clean), `node scripts/build.mjs` builds `dist/` in under 1 s.
- Commit under test: `2b24bdc` (Docs: shared systems design) on top of `8bfb3f0` (workshop contraptions).
- Runs were `node scripts/e2e-<x>.mjs [--no-build] --device=<desktop|phonePortrait|phoneLandscape|sandbox>`, one at a
  time except the first desktop pair (noted), with `HW_DIAG=1` from the second pass on. Not run: `e2e-ember` on
  phonePortrait (its default list includes it; left for the acceptance run).

---------------------------------------------------------------------------------------------------------------------------

## 4. Investigation results

### 4.1 The one fact that explains most of the timing behaviour

Measured on this container with a probe that opens the desktop viewport, starts the `hearth-e2e` world and counts
`window.__hw.state().frames` over 10 s: **0.8-1.6 frames per second** at the default render distance (6) and the same at
render distance 3 (`render.cpuMs` 1-5 ms: the JavaScript is idle, the cost is SwiftShader filling 1280 x 800 pixels).
The `HW_DIAG` state samples of the features run show the consequence: `frames` +3 and `ticks` +6 every ~2 s.

`src/app/loop.ts` clamps a frame to `MAX_FRAME_DT` 0.1 s, so each frame advances the simulation by at most 2 ticks
(0.1 s). At ~1.5 fps the game runs at roughly **one sixth of real time** (0.15 game-s per wall-s). On the owner's RTX 3060
(`HW_GPU=1`) the reported step times are several times shorter, i.e. close to real time; the scripts' literal timeouts
were tuned there. Every script assertion written as a wall-clock wait for something that happens in GAME
time (an animal calming down, a leaf falling, a drop flying to the player, a screen's first frame) is therefore about 6x tighter
here than on the machine it was written on; and any assertion that samples state "a little while" after an action (the
crown right after a cut) samples an interval nobody controls, which holds a different number of ticks on every machine.
Both are flake class (c) of section 1.
Lowering render distance does not help (measured); lowering the pixel count is not allowed (the viewports are the device
contract). Section 7 therefore scales timeouts and moves game-time waits onto ticks.

A second fact: two Chromium instances on 4 cores roughly halve each other's frame rate again. The first pass of this
investigation ran `e2e.mjs` and `e2e-magic.mjs` side by side and both failed on timing; both passed when run alone (4.2).
Rule: **one browser at a time** on a machine without a GPU (section 7.4).

### 4.2 Desktop results (`--device=desktop`, headless, software WebGL, one script at a time unless noted)

| script | result | wall time | failing step and message | class |
|---|---|---|---|---|
| `e2e.mjs` run 1 (in parallel with magic) | FAIL 4/20 ok | 7 m 46 s | `mines four logs by holding Mine: the pack holds 3 logs` | (c) timing (see 5.3) |
| `e2e.mjs` run 2 (alone, `HW_DIAG=1`) | **PASS 20/20** | 8 m 24 s | - (mining took 135 s, chopping 102 s) | - |
| `e2e-features.mjs` | **PASS 12/12** | 8 m 16 s | - but the animal step logged 17 x `not targeted` misses and took 254 s | (c) fragile, see 5.5 |
| `e2e-tech.mjs` | **PASS 13/13** | 6 m 33 s | - | - |
| `e2e-ember.mjs` | **FAIL** 4/9 ok | 2 m 39 s | `the bronze maul breaks mites apart and salvages scrap: no scrap after 8 mites: {"bronze_maul":1,"bronze_ingot":4,"stick":2}` | (b) stale script, see 5.1 |
| `e2e-handwork.mjs` | **PASS 13/13** | 10 m 43 s | - | - |
| `e2e-ground.mjs` | **PASS 7/7** | 1 m 12 s | - | - |
| `e2e-vehicles.mjs` (run twice, same result) | **FAIL** 2/7 ok | 0 m 33 s | `leaf decay: the crown does not vanish at once, then falls away on its own: leaves still there right after the cut` | (b)/(c) racy assertion, see 5.2; behind it 5.6 |
| `e2e-dev.mjs` | **PASS 11/11** | 1 m 22 s | - | - |
| `e2e-distill.mjs` | **PASS 10/10** | 4 m 52 s | - | - |
| `e2e-magic.mjs` run 1 (in parallel with e2e) | FAIL 10/16 ok | 6 m 16 s | `the rune desk screen makes a bronze rod ...: page.waitForSelector: Timeout 5000ms exceeded.` - Playwright's own call log says `locator resolved to visible <div class="hw-nb__recipe" data-recipe="bronze_rod">`; the failure screenshot shows the Rune Desk open with "Bronze Gathering Rod - Ready" | (c) timing, see 5.4 |
| `e2e-magic.mjs` run 2 (alone) | **PASS 16/16** | 3 m 22 s | - | - |
| `e2e-workshop.mjs` | **PASS 10/10** | 3 m 4 s | - | - |

Summary of desktop: **9 of 11 scripts pass when run alone; 2 fail deterministically on stale/racy script logic
(ember, vehicles - vehicles twice in a row with the same message); 2 more fail only under CPU contention (e2e, magic).
Behind the vehicles failure sits a third timing failure (5.6) that only shows once 5.2 is fixed.** No red step on desktop traced to a game bug in
`src/`. No console errors in any passing run.

### 4.2b Phone results (`--device=phonePortrait`, plus `phoneLandscape` and `sandbox` for `e2e.mjs`; one at a time, `HW_DIAG=1`)

Phones render 390 x 844 (a third of the desktop's pixels): the diag frame samples show ~20 fps (`dtMs` 50), i.e. the game
runs at real time on the phone viewports here. Phone failures are therefore NOT the slow-frame class of 4.1.

| script | device | result | failing step and message |
|---|---|---|---|
| `e2e.mjs` | phonePortrait | **PASS 20/20**, 1 m 56 s | - |
| `e2e.mjs` | sandbox | **PASS 6/6**, 16 s | - |
| `e2e.mjs` | phoneLandscape | **FAIL**, 4 m 15 s | `crafts sticks, cord and a flint pickaxe by hand: cannot aim at the chopping block` |
| `e2e-features.mjs` | phonePortrait | **FAIL**, 1 m 33 s | `dough is made at the workbench from flour and a water bucket: timed out waiting for a screen to open` (after 6 `not targeted` misses in the animal step) |
| `e2e-tech.mjs` | phonePortrait | **FAIL**, 36 s | `the hearth floor is laid brick by brick (real placing): locator.waitFor: Timeout 10000ms exceeded.` |
| `e2e-handwork.mjs` | phonePortrait | **PASS 13/13**, 1 m 39 s | - |
| `e2e-ground.mjs` | phonePortrait | **PASS**, 23 s | - |
| `e2e-dev.mjs` | phonePortrait | **PASS**, 18 s | - |
| `e2e-distill.mjs` | phonePortrait | **FAIL**, 39 s | `crude oil pours into the column flask and its base is set to 350 C: column base at 350 C` (one of four taps on the base was lost) |
| `e2e-magic.mjs` | phonePortrait | **FAIL 3 runs of 3** | `the notebook notes three blocks with real Use and learns their aspects: scanned ["glass","workbench"]` (run 2: `["workbench"]`) |
| `e2e-workshop.mjs` | phonePortrait | **PASS 10/10**, 35 s | - |
| `e2e-ember.mjs`, `e2e-vehicles.mjs` | phonePortrait | not run (ember's default list includes phonePortrait; vehicles is desktop-only) | - |

Causes: magic, distill and features - **lost world taps** (5.7); tech - the player killed by a Forge Warden (5.8);
landscape - the workbench placed on top of the chopping block (5.9). All verified in 4.3. A probe that aims at
three blocks and taps each once lost 0-3 of 3 taps per run; instrumenting `TouchGestures.up` showed every lost tap had a
down-to-up time of 289-314 ms by the page's event clock, although the Driver holds the finger only 60 ms.


### 4.3 Verification of the proposed script fixes

Both deterministic reds were re-run with the fix applied to a COPY of `scripts/` in a scratch directory (this design
pass does not edit the repository), against the same `dist/`, desktop, alone, `HW_DIAG=1`:

| script (patched copy) | result | evidence |
|---|---|---|
| `e2e-ember.mjs` with 5.1 (collect drops after each kill, 12 rounds) | **PASS 9/9**, 2 m 34 s | `1 mite(s) broken apart, scrap 1, maul durability 191`; the later steps (warm zone, death screen, Peaceful) all pass |
| `e2e-vehicles.mjs` with 5.2 only | FAIL at the next step, `drove 2.4 m` (5.6) | |
| `e2e-vehicles.mjs` with 5.2 + 5.6 (crown sampled at the cut, driving held for ticks) | **PASS 7/7**, 1 m 38 s | `crown at the cut 71, 0 when this step starts` - the crown was intact at the cut and fully gone before the old sample point, exactly the race described |
| `e2e-vehicles.mjs` unpatched, run 2 | FAIL at the same step, same message | the original failure is deterministic |

Phone fixes, verified the same way (patched copy of `scripts/`, one browser at a time):

| script (patched copy) | result | evidence |
|---|---|---|
| `e2e-magic.mjs` phonePortrait with 5.7 (`tapWorld`) | **PASS 16/16**, 48 s | notebook step 3.6 s (was red 3 of 3 runs) |
| `e2e-distill.mjs` phonePortrait with 5.7 | **PASS 10/10**, 1 m 6 s | the column base reaches 350 C in four taps |
| `e2e-features.mjs` phonePortrait with 5.7 | **PASS 12/12**, 1 m 9 s | `misses: not targeted` once (was 6) |
| `e2e-tech.mjs` phonePortrait with 5.7 only | FAIL, the death screen (5.8) | |
| `e2e-tech.mjs` phonePortrait with 5.7 + 5.8 (Peaceful) | **PASS 13/13**, 1 m 20 s | the floor in 14 s |
| `e2e.mjs` phoneLandscape (patched copy, 5.9 NOT yet applied) | **PASS 20/20**, 2 m 21 s | the stacking of 5.9 depends on the stance; it did not recur |
| `e2e-dev.mjs` phoneLandscape | **PASS**, 23 s | - |

The two contention failures (5.3, 5.4) were verified by re-running the unpatched scripts ALONE (4.2: both green). Their
fixes make them tolerate contention; acceptance item 10.4 tests that.

---------------------------------------------------------------------------------------------------------------------------
## 5. Root causes and exact fixes

Each entry: the failing step, the evidence, the root cause in code, the fix (file, function, change), and how the fix is
proven. None of the red steps of section 4 is a game bug; the only game-code changes of this unit are the `window.__hw` helpers of
section 8.3 (which also remove the duplicated set-up code the root causes below grew out of). If a later re-run on top of
Unit 0 shows a step red because of game code, the builder adds an entry here in the same shape and fixes `src/`.

### 5.1 `e2e-ember.mjs` - "the bronze maul breaks mites apart and salvages scrap" (deterministic, stale script)

- **Evidence.** `no scrap after 8 mites: {"bronze_maul":1,"bronze_ingot":4,"stick":2}`. The assertion before it
  (`salvaged.length >= kills`, from the recorded `automaton:salvaged` events) passed, so 8 mites were broken by the player.
- **Root cause.** Since ground items landed (`docs/api/ground-items.md`, SESSION_CONTEXT 9 "drops are world entities"),
  an automaton's salvage does not go into the pack. `src/mobs/hostileHurt.ts` `hurtHostile` rolls
  `rollDrops(m.spec.drops, env.rng)` and passes them to `env.died`; the manager's death listener in `src/app/state.ts`
  (`this.mobs.onDeath((d) => this.player.dropAll(d.drops, ...))`) spills them as ground items at the mite. They reach the
  pack only inside `PICKUP_RADIUS` 1.4 (`src/game/groundItems.ts`). The mite breaks apart wherever the fight left it
  (the patched run shows the scrap arrives as soon as the player walks over), so the scrap lies there. `cinder_mite` drops `scrap_metal` with `chance: 0.5`
  (`src/content/automatons.ts`); with eight kills the chance that none of them dropped scrap is 1/256, so the pack is
  empty because nobody walked to the drops, not because of bad luck. `e2e-features.mjs` was updated for ground items
  (`d.collectDrops(8000)` after the animal dies); `lib/e2eEmber.mjs` was not.
- **Fix (script, justified: the game behaves as designed, the script predates ground items).** In
  `scripts/lib/e2eEmber.mjs`, step `'the bronze maul breaks mites apart and salvages scrap'`:
  1. after each `fight(d, id)` add `await d.collectDrops(6000);` with the comment "Salvage lies on the ground since ground
     items (docs/api/ground-items.md): walk onto it like a player.";
  2. raise the round cap from 8 to 12 (chance of no scrap at all 1/4096);
  3. make the final assertion say which side failed: if no recorded `automaton:salvaged` event has a `scrap_metal` entry
     in `e.drops`, fail with `no mite dropped scrap in <n> kills (chance 0.5 each)`; otherwise, if the pack has none,
     fail with `scrap was dropped but never picked up: <ground items>`. That turns a future regression of pickup
     (a real game bug) into a different message from bad luck.
- **Proof.** Section 4.3: the patched copy run.

### 5.2 `e2e-vehicles.mjs` - "leaf decay: the crown does not vanish at once" (racy assertion)

- **Evidence.** `leaves still there right after the cut` (the assertion message names what should hold: it failed
  because the crown count was 0 when the step started). The previous step (chainsaw fells the trunk) passed in 19 s.
- **Root cause.** `src/world/leafDecay.ts`: a log replaced by a non-log wakes every leaf within 6 steps with a delay of
  `LEAF_DELAY_MIN..MAX` = 8..48 ticks, then peels neighbours after 2..12 ticks; the whole 5 x 5 x 3 crown of the test tree
  is gone within about 60-100 ticks (3-5 game seconds). The script counts the crown at the START of the next step, after
  the chainsaw step's remaining work (`d.settle(1200)`, fuel and ground-item reads, two screenshots). That interval is not
  controlled in game time: on software WebGL it was enough ticks for the whole crown to fall; on a GPU at 20 ticks/s it is
  also typically more than 48 ticks. The step can only pass by luck. The game is right: the unit test
  `src/world/leafDecay.test.ts` covers the delay rule.
- **Fix (script, justified: the assertion samples an uncontrolled interval).** In `scripts/e2e-vehicles.mjs`:
  1. add a module-level `let crownAtCut = null;` and a `crownCount()` helper (the same 7 x 12 x 7 count the leaf step
     uses, moved up so both steps share it);
  2. in the chainsaw step's `holdMine` done-callback, the first time the top log reads `air`, set
     `crownAtCut = await crownCount()` - the first poll after the cut, within one frame (at most 2 ticks, far below the
     8-tick minimum delay);
  3. the leaf step asserts `crownAtCut > 0` ("the crown does not vanish at once"), then `window.__hw.tick(500)` and
     `crownCount() === 0` ("then falls away on its own") as today, and logs both numbers.
- **Proof.** Section 4.3.

### 5.3 `e2e.mjs` - "mines four logs by holding Mine: the pack holds 3 logs" (timing under contention)

- **Evidence.** Failed only in the run that shared the CPU with a second browser; passed alone (135 s). The failing
  screenshot shows the hotbar with fiber, 8 sticks and 3 logs: four logs broke (the count of `mineLogs` is "block is no
  longer `oak_log`"), one log never reached the pack.
- **Root cause.** `Driver.collectDrops(maxMs = 12_000)` in `scripts/lib/e2eDriver.mjs` walks (teleports) to each ground
  item and waits `settle(800)` wall-ms for it to fly in. A drop flies only after `DROP_DELAY_S` 0.5 game-s and at
  `HOMING_SPEED` 9 b/s; at 0.5-1 fps under contention, 800 wall-ms is 1 frame = 2 ticks = 0.1 game-s, so most visits
  do not collect and the 12 s wall budget ran out with one log still lying (the run had no `HW_DIAG`, so which drop stayed is not recorded; the screenshot shows fiber and 8 sticks from leaf
  decay next to the 3 logs, i.e. the crown had fallen and its drops were competing for the same 12 s budget).
- **Fix (driver, justified: the budget is wall time for a game-time process).** In `Driver.collectDrops`:
  1. replace the wall-clock loop with a TICK budget: `maxTicks = 200` (10 game-s) AND a wall cap
     `maxMs = 60_000 x E2E_SLOW` (section 7.2);
  2. after each teleport wait until either the item is gone from `groundItems()` or 30 ticks passed (`waitTicks` helper,
     section 8.2), instead of `settle(800)`;
  3. teleport to the first free two-cell column at or above `Math.floor(t.y)` (the free test `standBeside` already uses), so
     an item resting on a leaf or a step cannot put the player inside a block;
  4. return the list of items left; `mineLogs` throws `logs broke but <n> stayed on the ground: <list>` when any oak or
     pine log is still lying after it, so the message names the cause next time.
- **Proof.** `e2e.mjs --device=desktop` passes alone (4.2); with the fix it must pass twice in a row (section 10).

### 5.4 `e2e-magic.mjs` - rune desk `waitForSelector` 5000 ms (timing under contention)

- **Evidence.** Playwright call log: the locator RESOLVED to the visible `.hw-nb__recipe[data-recipe="bronze_rod"]`, yet
  the 5 s timeout expired; the screenshot shows the screen open. Passed alone in 18 s.
- **Root cause.** The page's main thread renders a SwiftShader frame of 0.6-1.2 s; Playwright's visibility checks
  interleave with frames, so a 5 s UI timeout leaves room for only a handful of checks. The same literal `timeout: 5000`
  appears in `Driver.make`, `Driver.closeScreen` (10 000), `Driver.waitScreen` (10 000), `aimAt` (3000) and about forty
  script lines.
- **Fix (harness).** Every UI timeout in scripts and the driver goes through `T(ms)` from the new
  `scripts/lib/e2eHarness.mjs` (section 7.2): `T(5000)` is 5000 on `HW_GPU=1` and 20 000 on software WebGL. A literal
  `timeout:` number in a script is a review failure from this unit on (section 8.5). Concretely in `e2e-magic.mjs`: the
  four `page.waitForSelector(..., { timeout: 5000 })` become `{ timeout: T(5000) }`.

### 5.5 `e2e-features.mjs` - animal step passes but is fragile (17 "not targeted" misses, 254 s)

- **Evidence.** `misses: not targeted` x 17 before the first hit; the step needed 18+ of its 24 attempts. Two more
  misses-in-a-row of bad luck would be a red run.
- **Root cause.** `aimAtMob` (in `scripts/lib/e2eFeatures.mjs`) aims ONCE, then waits up to 2500 wall-ms for
  `targetAnimal` to equal the id. The boar keeps wandering (and the controller re-targets once per frame), so at ~1 fps
  the aim is two or three frames stale by the time the controller looks, and the ray misses the moving body.
- **Fix (script).** Replace the single aim + `waitFor` with a loop of up to 10 polls: re-aim (`aimAtMob`) and check
  `targetAnimal?.id === id`, `waitTicks(1)` between polls (one rendered frame). Keep the 24-attempt cap; the step must
  pass with at most 6 misses on software WebGL (logged; section 10 checks the log line).

### 5.6 `e2e-vehicles.mjs` - "tractor: W drives, A steers, F tills ahead" (hidden behind 5.2, wall-time driving)

- **Evidence.** Revealed once 5.2 was fixed in the patched copy: `drove 2.4 m` (the assertion wants more than 3 m).
- **Root cause.** The step holds W+F for `sleep(2500)` WALL ms. The tractor moves at up to 5.5 m/s in GAME time
  (`docs/api/tractor.md`); at the measured fraction of real time the tractor got about half a game second of driving.
  The same pattern follows in the step: `sleep(1200)` for steering (asserts a yaw change > 0.4 rad) and `sleep(900)` for
  the harvester's F.
- **Fix (script).** A `holdKeysTicks(keys, ticks)` helper (keys down, poll `__hw.state().ticks` every 100 ms until
  `+ticks`, wall cap `T(120_000)`, keys up in reverse order) replaces the three sleeps: W+F for 50 ticks (2.5 game-s, the
  original intent), W+A for 24 ticks, F for 18 ticks. The helper moves into the Driver as `Driver.holdKeys(keys, ticks)`
  (desktop) so Units 9 (asphalt speed: "the tractor runs 7.7 m/s on it") and 13 (skiff riding) measure speed in game
  time from day one. The fixed `sleep(800)` waits after `d.use()` in the "set it down, refuel" step become
  `waitTicks(page, 8)`.
- **Proof.** Section 4.3.

### 5.7 Phones - world taps lost (`e2e-magic`, `e2e-distill`, `e2e-features` phonePortrait)

- **Evidence.** `e2e-magic.mjs --device=phonePortrait` failed 3 of 3 runs at the first notebook step (one or two of three
  scans missing); `e2e-distill.mjs` phone set the column base to the wrong setpoint (one of four taps missing). A probe
  (the magic yard, six aim-and-tap rounds) wrapped `TouchGestures.down/up` (`src/player/input/gestures.ts`) through
  `window.__hw.app.game.inputManager.core.touch`:
  every tap that did not register was a `LOOK` pointer whose `up` came 289-314 ms after its `down` by the event clock;
  taps at 191-272 ms registered. `GESTURE_DEFAULTS.tapMaxMs` = `holdMs` = 280: a still touch longer than that is the
  start of a mining hold, not a Use - correct game behaviour for a real finger.
- **Root cause (driver).** `Driver.use()` on phonePortrait does `await fingerDown(3)` -> `sleep(60)` -> `await fingerUp(3)`.
  `Input.dispatchTouchEvent` resolves only after the renderer has handled the event (behind a frame), and Chromium stamps a
  CDP touch when it receives it. So the up is sent ~200 ms after the down was SENT, and the 60 ms tap arrives as a
  250-320 ms press. Passing CDP's `timestamp` parameter did not change the measured interval (tried: still 191-314 ms).
- **Fix (driver, justified: a real phone stamps touches in hardware; the game's tap window is right).** New
  `Driver.tapWorld(id = 3)` in `scripts/lib/e2eDriver.mjs`: send `touchStart` WITHOUT awaiting it, `sleep(60)`, send
  `touchEnd`, then `await Promise.all([down, up])`. `use()` on phonePortrait calls it. Measured with the fix: all 18 probe taps
  (three runs) were 60-63 ms by the page clock and all 9 first scans registered; without it, three probe runs lost 5 of
  9 first scans.
  The `useBlock` "tapping again" retry (written for this very symptom, "a tap that spans such a hitch reads as a
  press-and-hold") stays as a safety net but should no longer print.
- **Same pattern elsewhere.** `Driver.holdUse` and `Driver.walk` hold fingers on purpose (long presses), unaffected.
  `Driver.press(locator)` uses Playwright's `locator.tap()` on HUD buttons, which are UI targets with their own click
  handling, not gestures - unaffected. Any future helper that makes a QUICK world gesture must use the same
  send-without-await pattern; section 8.2 says so.
- **Proof.** Section 4.3 (patched copy runs of the phone scripts).

### 5.8 `e2e-tech.mjs` phonePortrait - "the hearth floor is laid brick by brick" (the player is killed by an automaton)

- **Evidence.** Still red with the 5.7 tap fix: `locator.waitFor: Timeout 10000ms exceeded ... waiting for
  locator('.hw-window button[aria-label="Close"]')`. The failure screenshot is the death screen: "FELLED BY A FORGE WARDEN",
  health 0. `placeInto` (in `scripts/lib/e2eTech.mjs`) saw a screen open after a missed placement and tried to close it
  with the Close button the death screen does not have.
- **Root cause (stale script).** `e2e-tech` predates the Emberbound automatons (docs/api/emberbound-*.md). The building
  site `findSite` picks near spawn can be within reach of a ruin's Forge Warden; on the phone viewport the game runs at
  real time (4.2b), so the warden gets six times more ticks during the 30 s step than on the desktop run, reaches the
  player and kills it. The game is right (automatons fight; `e2e-ember` tests exactly that, and that Peaceful removes them).
- **Fix (script + harness).**
  1. `scripts/lib/e2eTech.mjs`, set-up step `'a flat building site is found and the bricks are given'`: add
     `hw.setDifficulty('peaceful')` beside `hw.setTime(0.3)`.
  2. Harness rule (7.1 `newWorld`): every script except `e2e-ember.mjs` starts its world with
     `setDifficulty('peaceful')` (option `{ peaceful: false }` for scripts that test combat). A hearth, a still or a
     workshop step is not a combat test; an uncontrolled hostile is set-up noise.
  3. `makeStepper` (7.1): when a step fails and `__hw.state().player.dead` is true, the failure message gets
     ` (the player died: <combat.deathCause> by <combat.killedBy>)` appended, so the next such failure names itself
     instead of timing out on a missing button.
- **Proof.** Section 4.3.

### 5.9 `e2e.mjs` phoneLandscape - "crafts sticks, cord and a flint pickaxe by hand: cannot aim at the chopping block"

- **Evidence.** The failure screenshot shows the Workbench standing ON TOP of the Chopping Block; the diag log has ten
  `aim.approach` records for the chopping block at y 43, each with the crosshair on `workbench` at y 44, then
  `station.not_empty` and the failure. The re-run (patched copy) passed: it depends on where the player stood.
- **Root cause (driver).** `Driver.placeHeldWithin` accepts any cell whose block below is `solid && !replaceable` as
  "flat ground" - a placed Chopping Block qualifies. Step `'places the workbench'` in `scripts/e2e.mjs` calls
  `d.placeHeld('workbench')` with no `avoid`, so the nearest candidate can be the top of the chopping block placed two
  steps earlier. A player would not stack a bench on the chopping block; the game allows it (correctly).
- **Fix (driver).** `Driver.placeHeld(item, avoid = null)` takes `avoid` as one cell OR an array, and ALWAYS adds every
  cell in `this.places` (the stations the run already placed) to it; `placeHeldWithin` skips a candidate whose ground
  cell or 8-neighbourhood contains one of them (the existing `< 2` Chebyshev rule). The explicit
  `placeHeld('furnace_clay', d.places.workbench)` keeps working.
- **Proof.** Deterministic re-proof needs the same stance; acceptance 10.1 runs phoneLandscape twice.

### 5.10 Inconsistencies fixed while the scripts are touched (no red step, but they mislead the chain)

| file | problem | fix |
|---|---|---|
| `scripts/e2e-vehicles.mjs` | always builds (ignores `--no-build`), so the chain's `--no-build` is a lie and the script tests a different bundle than its neighbours | use `parseE2eArgs` (7.1): `--no-build` serves `dist/`; without it, builds to `$TMP/hw-e2e-vehicles` as today |
| `scripts/e2e-ground.mjs` | ignores `--no-build`, one device only | `parseE2eArgs`; default devices `desktop, phonePortrait` (it has a phone-specific step already: "long-press on the hotbar drops the stack") |
| `scripts/e2e-distill.mjs` | `--no-build` changes the DEVICE list (both), `--device=` changes it to one | `parseE2eArgs`: devices from `--device=` (repeatable), default `desktop, phonePortrait`; `--no-build` only means "serve dist/" |
| all eleven | `--dist=` / `--out=` / none for the build dir | one flag `--dist=<dir>`; `--out=` kept as an alias for one release with a console warning |
| `package.json` `scripts.e2e` | `&&` chain hides every script after the first red one | `node scripts/e2e-all.mjs` (7.3) |

## 6. Script-side changes only where the script is wrong (justification ledger)

The rule of SESSION_CONTEXT 9 stands: "fix stale scripts, but a failing step can be a real game bug". Every script edit of
this unit is listed here with the sentence that proves the GAME is right. A builder who wants to edit a script for any
other reason writes the same sentence first, or fixes the game instead.

| script edit | why the game is right, not the script |
|---|---|
| ember: walk onto salvage (5.1) | `docs/api/ground-items.md`: every drop is a ground item; `e2e-features` already walks onto the meat for the same reason |
| vehicles: sample the crown at the cut (5.2) | `docs/api/leaf-decay.md`: leaves wait 8..48 ticks, then peel; the unit test proves the rule; the script sampled 0.5-20 s later |
| driver `collectDrops` on ticks (5.3) | pickup is game-time physics (`DROP_DELAY_S`, `HOMING_SPEED`); a wall budget is wrong on any slow device, including a real slow phone |
| magic and all UI waits via `T()` (5.4) | the screen was open (Playwright resolved it; screenshot); only the clock was short |
| driver: never place on a station the run placed (5.9) | the game lets a player stack blocks on a chopping block; the test's intent was a bench beside it |
| tech: Peaceful for a building test (5.8) | `e2e-ember` proves automatons fight and that Peaceful removes them; a hearth test must not depend on where a warden walks |
| features: re-aim at a moving animal (5.5) | animals wander by design (`src/mobs/`); a player re-aims too |
| driver `tapWorld` without awaiting the down (5.7) | a real phone stamps a touch in hardware; the 280 ms tap window is the right rule for a finger and is unit-tested in `src/player/input/gestures.test.ts` |
| flags and devices (5.10) | no game behaviour involved |

What Unit 1 must NOT do to make a step green: lower an assertion's threshold (e.g. "4 logs" to "3 logs"), replace a real
input with `window.__hw` (e.g. `inventory.add` instead of walking onto the drop), delete a step, or add `--device` skips.
Any of those is rejected in review.

---------------------------------------------------------------------------------------------------------------------------

## 7. Flake and timeout policy for software WebGL

### 7.1 One argument parser (`scripts/lib/e2eHarness.mjs`, new)

```js
// scripts/lib/e2eHarness.mjs
export function parseE2eArgs(argv, { name, defaultDevices = ['desktop', 'phonePortrait'], scratchBuild = false }) {
  // returns { devices, noBuild, dist, shots, seed }
  //   --device=<d> (repeatable)          devices; default defaultDevices
  //   --no-build                         serve --dist (default <root>/dist) as is
  //   --dist=<dir> (alias --out=<dir>)   where the build is / goes; scratchBuild scripts default to $TMP/hearthwatt-e2e-<name>
  //   --shots=<dir>                      default <root>/test-results/e2e-<name> (e2e.mjs keeps test-results/e2e)
  //   --seed=<s>                         default the script's constant seed
}
export async function prepareBuild({ noBuild, dist }) { /* build({ quiet: true, outDir: dist }) unless noBuild */ }
export function makeStepper({ report, d, page, onFail }) { /* the skip-after-first-failure step + FAILED-<name>.png */ }
export async function newWorld(page, d, seed, { mode = 'survival', peaceful = true } = {}) { /* title -> seed -> New World -> playing -> settle; peaceful: __hw.setDifficulty('peaceful') (5.8) */ }
export async function crosshairText(page) { /* waits one slow-tick refresh, returns .hw-cross__name text (8.3) */ }
export const E2E_SLOW = process.env.HW_GPU === '1' ? 1 : Number(process.env.HW_E2E_SLOW ?? 4);
export const T = (ms) => Math.round(ms * E2E_SLOW);
export async function waitTicks(page, n, { wallMs = T(30_000) } = {}) { /* polls __hw.state().ticks until +n */ }
```

Every script's head shrinks to `parseE2eArgs` + `prepareBuild` + `makeStepper` + `newWorld`. The existing per-script
behaviour is preserved by the arguments (`e2e.mjs` default devices `desktop, phonePortrait, phoneLandscape, sandbox`;
dev `desktop, phonePortrait, phoneLandscape`; magic/workshop/dev/vehicles `scratchBuild: true`).

### 7.2 Timeouts

- **Two clocks, two kinds of wait.** A wait for something the GAME does (an animal calms down, a fire catches, a drop flies,
  a still boils, leaves fall) is measured in ticks with `waitTicks` or `waitFor(..., s.ticks - t0 > n)`, never in wall ms.
  The ember and features scripts already do this in places ("Game ticks, not wall time" in `fight`); this becomes the rule.
  A wait for something the PAGE does (a screen opens, a button appears) uses `T(ms)`.
- **Scale.** `E2E_SLOW` = 1 with `HW_GPU=1`, 4 on software WebGL, overridable with `HW_E2E_SLOW=<n>` for a slower
  machine. `T(5000)` = 20 s here. Why 4: the one UI wait that failed (rune desk screen, contended run) needed more than
  5 s while the screen was already drawn; 20 s gives 3x headroom over that without letting a truly missing screen hang a step for minutes.
- **Caps that stay literal.** World load `120_000` (already generous: measured 4-8 s) and title `30_000` stay; they are
  wrapped in `T()` only if a run shows them close (more than half used).
- **Per-script wall cap.** `e2e-all.mjs` kills a script that runs longer than `25 min x E2E_SLOW / 4` (the slowest
  measured, handwork desktop, took 10 m 43 s) and reports `TIMEOUT` for it; a hung browser can no longer stall the chain.

### 7.3 The runner (`scripts/e2e-all.mjs`, new) and `npm run e2e`

- Builds `dist/` once (unless `--no-build`), then runs each script as a child process with `--no-build` and the device
  list given (`--device=` repeatable, default each script's own default), ONE AT A TIME (7.4).
- Streams each child's output with a `[script]` prefix, records per script: exit code, steps ok/failed/skipped (parsed
  from the `  ok   ` / `  FAIL ` / `  skip ` lines the reporter already prints), wall time.
- Prints one table at the end and writes `test-results/e2e-summary.json`:
  `{ startedAt, gpu, slow, scripts: [{ name, devices, ok, failed, skipped, ms, exit, retried, firstFailure }] }`.
- Exit code 1 when any script ends red after the retry policy (7.5).
- `--only=<name,name>` runs a subset (`--only=ember,vehicles`), `--from=<name>` resumes the chain from a script.
- `package.json`: `"e2e": "node scripts/e2e-all.mjs"`. The `&&` chain is deleted.

Order (cheap and foundational first, so a red spine shows in minutes): `e2e` (spine), `ground`, `dev`, `vehicles`,
`magic`, `workshop`, `distill`, `ember`, `tech`, `features`, `handwork`.

### 7.4 Concurrency

- **Software WebGL: one browser at a time.** Measured: two browsers on 4 cores turned two passing scripts red (4.2).
  `e2e-all.mjs` never runs two scripts in parallel unless `--parallel=<n>` is given, and refuses `--parallel` > 1 without
  `HW_GPU=1`.
- **The `.run-lock` mutex** (WHATS_LEFT 7: "use the `.run-lock` mutex folder before any `npm run build` or e2e") is
  implemented in `e2e-all.mjs`: `mkdirSync('.run-lock')` (atomic), a `owner.json` inside with pid and start time, removed
  on exit and on SIGINT; a lock older than 2 h is stale and is taken over with a warning. Scripts run directly (not via the
  runner) do not take the lock; the runner prints a hint when it finds one held.
- Scripts that build to scratch dirs (`dev`, `magic`, `workshop`, `vehicles`) may still run beside a `dist/` script on a
  GPU machine; that is the only parallelism the protocol endorses.

### 7.5 Flake policy

- **Definition.** A flake is a step that fails and then passes on an immediate re-run of the same script on the same
  build with nothing else running. A step that fails twice in a row is RED, not a flake.
- **Retry.** `e2e-all.mjs` re-runs a red script ONCE (`--retries=1`, default; `--retries=0` for diagnosing). A script
  green on the retry is reported `FLAKY` in the table (yellow), not `PASS`, and its `firstFailure` is kept in the summary.
- **Budget.** A script reported `FLAKY` in two consecutive coordinator runs is treated as red: the unit that owns the
  feature (or Unit 1 while it is open) fixes the wait (move it onto ticks or `T()`), and documents the fix as a section 5
  entry in its own spec.
- **Never.** No `test.retry`-style loops inside steps around an ASSERTION (retrying an action until it works is fine, as
  `useBlock` already does for a stalled tap); no sleeps added "to be safe" (a sleep is a wall wait for a game event:
  use ticks).
- **Diagnostics on red.** The runner re-runs the red script's retry with `HW_DIAG=1` so the JSONL log and the
  `-fail-N.png` exist for the second failure, and prints `node scripts/lib/diag.mjs summary` for it.

---------------------------------------------------------------------------------------------------------------------------

## 8. Protocol for later units adding e2e steps

This is the contract Units 0 and 2-19 build against (SYSTEMS 6c, made concrete). A unit spec that adds an e2e step says
which script, which step names, which devices, and which `window.__hw` reads it uses.

### 8.1 Where a step goes

| unit | script it extends | why there |
|---|---|---|
| 0 Foundations | none new (no player-visible content); must leave the chain green | - |
| 2 Owner decisions (rack under glass, `six_cups` side goal) | `e2e-handwork.mjs` (rack stops under glass), `e2e-features.mjs` (side goal ticks out of order) | the rack step lives in handwork; the spine script `e2e.mjs` stays about the first hour and is not extended |
| 3 Small known gaps | `e2e-tech.mjs` (structure tab machines list), `e2e-features.mjs` (crop pops off farmland) | existing hearth / farming steps |
| 4 Casting and hot metal | `e2e-handwork.mjs` | the anvil hot window and mould pour steps are there |
| 5 Sap tap and sugar | `e2e-distill.mjs` (sugar into a vessel) and a new `e2e-sugar.mjs` only if more than 3 steps | the pot still is in distill |
| 6 Rig screen | `e2e-distill.mjs` | rigs are built there; phonePortrait REQUIRED (a screen) |
| 7, 8, 9, 10, 11, 12 (distillery family) | `e2e-distill.mjs`, one `describe`-style section comment per unit (`// ---- Unit 8: vacuum line ----`) | one rig yard, one world load |
| 13, 14, 15, 16 (workshop family) | `e2e-workshop.mjs`, same section comments | the yard and goggles helpers are there |
| 17 Harness and golems | `e2e-workshop.mjs` (treadwheel, golem carrying) | needs the yard and an animal: `__hw.spawnMob` exists |
| 18, 19 Magic | `e2e-magic.mjs` | research set-up exists |

A NEW script is allowed only when a unit adds more than 6 steps that need a different world set-up; it uses the harness
(7.1), is added to the runner's order list, and gets a `docs/api/<feature>.md` line saying how to run it.

### 8.2 How a step is written

1. **Name**: a sentence of what the player sees, present tense, the number in it, matching T8 voice:
   `step('a ladle of copper pours into the casting bench: three moulds fill in order', ...)`, not `step('bench test')`.
   The name is unique within the script (the failure screenshot is named after it).
2. **Set-up through `window.__hw` only** (give, teleport, setVoxel, setTime, setWeather, tick, `clearYard`); the ACTION
   under test through the Driver (`d.use()`, `d.holdUse()`, `d.holdMine()`, `d.press(locator)`, `d.selectItem()`,
   `d.walk()`, keyboard). Reading state back through `window.__hw` or the DOM.
3. **Waits**: game events with ticks (`waitTicks(page, n)` or a `waitFor` whose predicate compares `s.ticks`), UI with
   `T(ms)`. `window.__hw.tick(n)` fast-forwards when the test is about the RESULT of time passing (a still finishing),
   never when it is about what the player does during it.
4. **Assertions say what was seen**: `assert(x === y, \`bench holds ${JSON.stringify(view)}\`)`. Every assertion message
   includes the observed value.
5. **One screenshot per step** via `d.shot('<nn>-<slug>')` into `test-results/e2e-<script>/<device>-<nn>-<slug>.png`;
   `<nn>` continues the script's numbering (Unit numbers may prefix: `u4-01-bench-filled`).
6. **Devices**: desktop always; `phonePortrait` for anything with a screen, a HUD element, a button or a touch path
   (SYSTEMS 1.3). The step must use `d.touch` branches the Driver already has; a step that cannot run on phone is a design
   bug in the feature (phone first), not a reason to skip the device.
7. **Quick world gestures** (a tap, a flick) are sent without awaiting the down event (`Driver.tapWorld`, 5.7); only
   deliberate long presses await each event.
8. **No new globals in the page** except through `__hw.events` (8.3). Event recorders like the ember script's
   `window.__ember` migrate to it when that script is next touched.
9. **Cost**: a step should take under 60 s on software WebGL; anything longer fast-forwards with `tick` or is split.
   The runner prints per-step times; a unit that pushes its script over 12 min desktop software time splits it.

### 8.3 `window.__hw` helpers this unit adds (`src/app/debug.ts`, `DebugHandle`)

Small, setup-and-read only, typed in `DebugHandle`, unit-tested where pure:

```ts
/** Flattens a w x d patch at the player's feet level (or `y`): `floor` block below, air `height` blocks up. Returns the
 *  origin cell. Replaces the hand-written clearing loops in e2e-magic/-workshop/-distill. */
clearYard(x0: number, z0: number, w: number, d: number, opts?: { y?: number; floor?: string; height?: number }): { x0: number; y: number; z0: number };

/** Starts recording these bus events (with the tick they happened in) into a ring of 2000; returns how many it now
 *  records. Generalises the ember script's window.__ember recorder. */
events(types: string[]): number;
/** Recorded events of one type (oldest first), each { type, tick, e } (e is a JSON copy). */
eventsOf(type: string): { type: string; tick: number; e: unknown }[];
clearEvents(): void;
```

The crosshair line - the T8 grammar every later unit asserts on - is read from the DOM, not a new hook, because the DOM
is what the player reads: `page.locator('.hw-cross__name').textContent()` (harness helper `crosshairText(page)`, which waits
one slow-tick refresh first). Goggles lines need the goggles in the pack (`give('engineer_goggles')`), as for a player.

Helpers later units add themselves, in their own spec, following the same rule (setup and read only, never the action):
Unit 0 `__hw.vessel(x,y,z)` (slots + rx progress), Unit 5/10 `__hw.buffs()` (a `BuffsSnapshot` copy), Unit 0
`__hw.sideGoals()` (`ObjectiveTracker.side()` copy). They append to `DebugHandle`; no unit edits another's helper.

### 8.4 Before a unit merges (its own e2e acceptance)

1. `npm run build`, then `node scripts/e2e-all.mjs --no-build --only=<its scripts>` desktop + phonePortrait: green,
   no `FLAKY`.
2. `node scripts/e2e-all.mjs --no-build` once for the whole chain on desktop (the coordinator may run it instead when
   several units merge together): every script green or `FLAKY` with an existing entry in a section 5 table.
3. Attach `test-results/e2e-summary.json` (or paste its table) to the merge note.

### 8.5 Review checklist for e2e code (rejected if any is "no")

- step name is a player-visible sentence with a number; unique;
- the action is real input; `__hw` only sets up or reads;
- no literal `timeout:` number (use `T()`); no `waitForTimeout`/`settle` used as a wait for a game event;
- assertion messages contain the observed value;
- a screenshot per step, in the script's folder;
- phonePortrait covered when there is UI;
- runs under 60 s per step on software WebGL.

---------------------------------------------------------------------------------------------------------------------------

## 9. Tests

Unit tests (vitest, co-located, run in `npm test`):

- `tests/e2eHarness.test.ts` (new; `vitest.config.ts` already includes `tests/**/*.test.ts` and `tsconfig.json` includes
  `tests`): imports the pure exports of `scripts/lib/e2eHarness.mjs` and `scripts/e2e-all.mjs`'s parser (export
  `parseStepLines` from a side-effect-free module `scripts/lib/e2eSummary.mjs`, so importing it does not start a run).
  Keep the harness importable without launching anything: `openGame`/Playwright stay behind function calls (as
  `loadPlaywright` already is). Cases: default devices per script name; `--device` repeatable; `--out=` is an alias of
  `--dist=`; `--no-build` never changes the device list; `T(5000)` is 20 000 with `HW_GPU` unset and 5000 with
  `HW_GPU=1` (set `process.env` before a fresh dynamic import, `vi.resetModules()`); `parseStepLines` turns
  `  ok   x (12 ms)`, `  FAIL x: msg`, `  skip x` into `{ ok: 1, failed: 1, skipped: 1, firstFailure: 'x: msg' }`.
  A `.mjs` import from TypeScript needs a one-line `tests/e2eHarness.d.ts` (or `// @ts-expect-error` per import);
  `npx tsc --noEmit` must stay clean.
- `src/app/debugHelpers.test.ts` (new). The two helpers' logic lives in `src/app/debugHelpers.ts` as pure pieces so they
  test without an `App`: `yardCells(x0, z0, w, d, y, height)` returning the floor and air cells, applied by
  `createDebugHandle` through `world.setVoxel(..., 'sim')` as `setVoxel` does today; and `class EventRecorder { record(type,
  tick, e); of(type); clear() }` with a 2000-entry ring, which `createDebugHandle` subscribes to `game.bus`. Cases:
  exactly `w x d` floor cells and `w x d x height` air cells; ring drops the oldest at 2001; `of` filters by type;
  `clear` empties; subscribing the same type twice records once; the stored `e` is a copy (mutating the source object
  later does not change it).
- Existing suites stay green: `npx tsc --noEmit`, `npx vitest run` (1988 tests at WHATS_LEFT time).

Browser verification (the unit's real test): section 10.

---------------------------------------------------------------------------------------------------------------------------

## 10. Acceptance checklist

All on this kind of machine (no GPU, `HW_GPU` unset), `npm ci`, one `npm run build`:

1. `node scripts/e2e-all.mjs --no-build` (default devices of every script, which after 5.10 includes phonePortrait for
   every script but vehicles, and phoneLandscape + sandbox for `e2e.mjs`) ends with every script `PASS` - no `FAIL`, no
   `TIMEOUT`; at most one `FLAKY`, and that one has a section 5 entry naming the wait that caused it.
2. The same command run a SECOND time in a row: every script `PASS` (no `FLAKY`) - proves 5.3-5.5 removed the timing
   flakes rather than the retry hiding them.
3. `node scripts/e2e-all.mjs --no-build --only=ember,vehicles --retries=0` passes (the two deterministic reds of 4.2).
4. `node scripts/e2e.mjs --no-build --device=desktop` and `node scripts/e2e-magic.mjs --no-build --device=desktop` each
   pass while ANOTHER browser script runs beside them with `HW_E2E_SLOW=8` (contention tolerance with a doubled scale).
   This is the direct regression test of 5.3 and 5.4.
5. `test-results/e2e-summary.json` exists and lists 11 scripts with ok/failed/skipped/ms.
6. `npm run e2e` runs `scripts/e2e-all.mjs` (package.json), and a deliberately broken step (local edit, not committed:
   change one assertion in `e2e-ground.mjs`) shows `FAIL` for ground AND the following scripts still run.
7. `grep -rn "timeout: [0-9]" scripts/e2e*.mjs scripts/lib/e2e*.mjs` finds only the two kept literals (world load 120 000,
   title 30 000) - every other timeout goes through `T()`.
8. The features animal step logs `misses:` with at most 6 entries on desktop (5.5).
9. With `HW_GPU=1` on the owner's machine (coordinator note), the chain is still green: `T()` collapses to the old
   literals there.
10. `npx tsc --noEmit` clean; `npx vitest run` green; the self-test of 9 passes.
11. Every script's `--help`-equivalent header comment lists the harness flags (`--device`, `--no-build`, `--dist`,
    `--shots`, `--seed`).

---------------------------------------------------------------------------------------------------------------------------

## 11. Out of scope

- Any gameplay change. If a re-run on top of Unit 0 finds a red step caused by game code, the fix is in scope only if it
  is a regression of existing behaviour (a bug); new behaviour belongs to the owning unit.
- Adding e2e to CI (`.github/workflows/ci.yml`). GitHub's runners have no GPU; a 60-90 min software chain per push is not
  worth it. A nightly or manual `workflow_dispatch` job is a coordinator decision (section 12).
- Speeding up the game's software rendering (resolution scaling, a "low" graphics preset). Measured: render distance does
  not change the frame rate here; a pixel-ratio setting below 1 is a product decision for phones (UI size setting is
  Unit 3), not a test trick.
- Writing the e2e steps of later units (each unit owns its steps, section 8).
- The `phoneLandscape` device for scripts other than `e2e.mjs` and `e2e-dev.mjs` (they never ran it; nothing new needs it).
- Hand play-testing (excluded by the owner, SYSTEMS header).

---------------------------------------------------------------------------------------------------------------------------

## 12. Notes for the coordinator

1. **Baseline today (commit `2b24bdc`), software WebGL, one browser at a time.** Desktop: 9/11 green; ember and vehicles
   red on script logic (5.1, 5.2 + 5.6; proven fixed in a patched copy, 4.3); e2e and magic red only when run in parallel
   with another browser. Phone: e2e portrait, sandbox, handwork, ground, dev, workshop green; magic, distill, features
   red on the lost-tap driver bug (5.7), tech on an automaton kill (5.8), e2e landscape on a stacked placement (5.9).
   With all fixes applied in a scratch copy, every script that was run is green on both devices. No red step was caused
   by game code.
2. **Never run two e2e browsers at once on a no-GPU machine** (including two units' builders on one checkout): it turns
   green scripts red. The runner enforces it with `.run-lock`; sessions that call scripts directly must check the lock.
3. **Full chain cost here:** about 60 min desktop-only, roughly double with phonePortrait. Run the full chain once per
   wave merge; units run `--only=<their scripts>`.
4. **Merge order inside Wave 0:** Unit 1 can merge before or after Unit 0. If after, re-run 10.1 on top of Unit 0 before
   merging (Unit 0 moves fermenting into the reaction table, which `e2e-distill` exercises indirectly).
5. **`HW_GPU=1` on the owner's Windows machine** uses `--use-angle=d3d11`; on Linux the flag does nothing useful. Leave
   as is; `E2E_SLOW` keys only on `HW_GPU`.
6. Decide whether a nightly CI e2e (software, `--only=e2e,ground,dev` ~15 min) is wanted; this spec does not add it.

