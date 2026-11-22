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

<!-- RESULTS -->

---------------------------------------------------------------------------------------------------------------------------
