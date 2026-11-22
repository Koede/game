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
| `window.__hw` set-up helpers `clearYard`, `describe`, `events` (`src/app/debug.ts`) | the setup/read helpers the scripts keep re-implementing inline | Units 4-19 |

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
- Runs were `node scripts/e2e-<x>.mjs [--no-build] --device=desktop`, with `HW_DIAG=1` for the second pass.

---------------------------------------------------------------------------------------------------------------------------

## 4. Investigation results

### 4.1 The one fact that explains most of the timing behaviour

Measured on this container with a probe that opens the desktop viewport, starts the `hearth-e2e` world and counts
`window.__hw.state().frames` over 10 s: **0.8-1.6 frames per second** at the default render distance (6) and the same at
render distance 3 (`render.cpuMs` 1-5 ms: the JavaScript is idle, the cost is SwiftShader filling 1280 x 800 pixels).
The `HW_DIAG` state samples of the features run show the consequence: `frames` +3 and `ticks` +6 every ~2 s.

`src/app/loop.ts` clamps a frame to `MAX_FRAME_DT` 0.1 s, so each frame advances the simulation by at most 2 ticks
(0.1 s). At ~1.5 fps the game runs at roughly **one sixth of real time** (0.15 game-s per wall-s). On the owner's RTX 3060
(`HW_GPU=1`) it runs at real time. Every script assertion written as a wall-clock wait for something that happens in GAME
time (an animal calming down, a leaf falling, a drop flying to the player, a screen's first frame) is therefore 6x tighter
here than on the machine it was written on, and every wall-clock interval that is supposed to be SHORT in game time (the
moment right after a cut) is 6x longer in ticks on a GPU than here or vice versa. That is the flake class (c) of section 1.
Lowering render distance does not help (measured); lowering the pixel count is not allowed (the viewports are the device
contract). Section 7 therefore scales timeouts and moves game-time waits onto ticks.

A second fact: two Chromium instances on 4 cores roughly halve each other's frame rate again. The first pass of this
investigation ran `e2e.mjs` and `e2e-magic.mjs` side by side and both failed on timing; both passed when run alone (4.3).
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
| `e2e-vehicles.mjs` | **FAIL** 2/7 ok | 0 m 33 s | `leaf decay: the crown does not vanish at once, then falls away on its own: leaves still there right after the cut` | (b)/(c) racy assertion, see 5.2 |
| `e2e-dev.mjs` | **PASS 11/11** | 1 m 22 s | - | - |
| `e2e-distill.mjs` | **PASS 10/10** | 4 m 52 s | - | - |
| `e2e-magic.mjs` run 1 (in parallel with e2e) | FAIL 10/16 ok | 6 m 16 s | `the rune desk screen makes a bronze rod ...: page.waitForSelector: Timeout 5000ms exceeded.` - Playwright's own call log says `locator resolved to visible <div class="hw-nb__recipe" data-recipe="bronze_rod">`; the failure screenshot shows the Rune Desk open with "Bronze Gathering Rod - Ready" | (c) timing, see 5.4 |
| `e2e-magic.mjs` run 2 (alone) | **PASS 16/16** | 3 m 22 s | - | - |
| `e2e-workshop.mjs` | **PASS 10/10** | 3 m 4 s | - | - |

Summary of desktop: **9 of 11 scripts pass when run alone; 2 fail deterministically on stale/racy script logic
(ember, vehicles); 2 more fail only under CPU contention (e2e, magic).** No red step on desktop traced to a game bug in
`src/`. No console errors in any passing run.

<!-- PHONE -->

### 4.3 Verification of the proposed script fixes

<!-- VERIFY -->

---------------------------------------------------------------------------------------------------------------------------
## 5. Root causes and exact fixes

Each entry: the failing step, the evidence, the root cause in code, the fix (file, function, change), and how the fix is
proven. None of the red steps of section 4 is a game bug; the game code changes of this unit are the three debug helpers of
section 8.3 (which also remove the duplicated set-up code the root causes below grew out of). If a later re-run on top of
Unit 0 shows a step red because of game code, the builder adds an entry here in the same shape and fixes `src/`.

### 5.1 `e2e-ember.mjs` - "the bronze maul breaks mites apart and salvages scrap" (deterministic, stale script)

- **Evidence.** `no scrap after 8 mites: {"bronze_maul":1,"bronze_ingot":4,"stick":2}`. The assertion before it
  (`salvaged.length >= kills`, from the recorded `automaton:salvaged` events) passed, so 8 mites were broken by the player.
- **Root cause.** Since ground items landed (`docs/api/ground-items.md`, SESSION_CONTEXT 9 "drops are world entities"),
  an automaton's salvage does not go into the pack. `src/mobs/hostileHurt.ts` `hurtHostile` rolls
  `rollDrops(m.spec.drops, env.rng)` and passes them to `env.died`; the manager's death listener in `src/app/state.ts`
  (`this.mobs.onDeath((d) => this.player.dropAll(d.drops, ...))`) spills them as ground items at the mite. They reach the
  pack only inside `PICKUP_RADIUS` 1.4 (`src/game/groundItems.ts`). The mite dies 1.5-2.5 blocks away (the fight keeps
  the player out of bite range), so the scrap lies there. `cinder_mite` drops `scrap_metal` with `chance: 0.5`
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
  do not collect and the 12 s wall budget ran out with one log still lying (often on a leaf block of the canopy, where the
  teleport to `Math.floor(t.y)` stands the player inside the crown and the game pushes it up).
- **Fix (driver, justified: the budget is wall time for a game-time process).** In `Driver.collectDrops`:
  1. replace the wall-clock loop with a TICK budget: `maxTicks = 200` (10 game-s) AND a wall cap
     `maxMs = 60_000 x E2E_SLOW` (section 7.2);
  2. after each teleport wait until either the item is gone from `groundItems()` or 30 ticks passed (`waitTicks` helper,
     section 8.2), instead of `settle(800)`;
  3. teleport to the item's cell standing on the first free cell at or above `Math.floor(t.y)` (use `standBeside`'s free
     test), so an item resting on leaves does not put the player inside them;
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

### 5.6 Inconsistencies fixed while the scripts are touched (no red step, but they mislead the chain)

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
| features: re-aim at a moving animal (5.5) | animals wander by design (`src/mobs/`); a player re-aims too |
| flags and devices (5.6) | no game behaviour involved |

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
export async function newWorld(page, d, seed, { mode = 'survival' } = {}) { /* title -> seed -> New World -> playing -> settle */ }
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
- **Scale.** `E2E_SLOW` = 1 with `HW_GPU=1`, 4 on software WebGL (measured: ~1-1.5 fps vs ~6 fps the timeouts were tuned
  at), overridable with `HW_E2E_SLOW=<n>` for a slower machine. `T(5000)` = 20 s here.
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

