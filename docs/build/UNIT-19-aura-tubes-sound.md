# Unit 19 - Aura dial, tube flow and magic sound

Status: build spec, written 2026-11-22 against `docs/build/SYSTEMS.md` (binding). Where this file and SYSTEMS.md disagree,
SYSTEMS.md wins; where this file and the code disagree about something that exists, the code wins.

**Threads:** T3 (essentia flow: `TUBE_UPS`, tubes stay their own network, units conserved), T8 (aura dial chips, tube crosshair
line, desk refusal sentence), T9 (`tube_flow`, `golem_step`, `aura_tick`, loudness tiers for the six existing magic sounds), T10
(nothing new saved; old saves load unchanged), T7 (reads `aura_reading` (exists) and the Unit 18 flags `aura_dial`,
`steady_tubes`; gates nothing on the spine).

Names this unit DEFINES (SYSTEMS.md 6.2 row "aura dial, `TUBE_UPS` flow, magic sounds/balance | 19"): `TUBE_UPS`,
`TUBE_BURST_S`, `TubeFlow`, `jarReach`, `Magic.auraView`, `Magic.tubeFlows`, `Magic.tubeText`, `AuraDial` (HUD),
`auraText.ts` helpers, sounds `tube_flow`, `golem_step`, `aura_tick`. Names it READS: `hasFlag(research, 'steady_tubes')`,
`hasFlag(research, 'aura_dial')` (both defined by Unit 18; plain string checks that are simply false before 18 merges,
SYSTEMS.md 6.3), `hasFlag(research, 'aura_reading')` (exists, `src/magic/entries.ts` entry `aura_reading`).

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

The magic layer already lets a player feel the land with a rod, bottle it, keep it in jars and run glass tubes from jars to the
desk, the altar, the furnace and clay servants. Three things are still missing, and they are all about *reading and feeling* the
magic rather than adding more of it:

1. **The aura dial.** Today the land's reading is a line of text that hijacks the crosshair whenever a rod is held
   (`Magic.rodReading()`, appended as the last fallback in `Game.magicLabel` in `src/app/game.ts`, so aiming at a log with a rod
   in hand shows "Cinder 6, Loam 4, Gale 2 · ..." instead of "Oak Log"). This unit moves the reading into a small,
   glanceable HUD dial in the top-right status cluster, next to the home compass: a ring of coloured arcs (one per aspect,
   longer = richer), the top three aspects as chips (`cinder 6  loam 4  gale 2`, the T8 example verbatim), and a pip on the
   rim that points at the nearest wellspring the way the compass needle points home. Raise the rod and the dial blooms with a
   soft glass tick; lower it and the dial is gone. The crosshair goes back to naming blocks.
2. **Tube flow.** Tubes are currently instant and unlimited: any jar joined by tubes is as good as a jar on the desk. This unit
   gives tubes a real, visible throughput: **4 units per second per tube network** (`TUBE_UPS`), **8 with `steady_tubes`**,
   with jars within a consumer's own reach still paying instantly. Essentia moving through a tube shows as small coloured motes
   gliding from the jar to the consumer, so a player can *see* the altar drinking Vein down 12 metres of glass. A gentle glassy
   trickle sounds at the consumer while it flows.
3. **A sound and balance pass.** Three new sounds (`tube_flow`, `aura_tick`, `golem_step` for Unit 17), every magic sound put on
   a T9 loudness tier, and a written balance table that checks every magic number against SYSTEMS.md 5.

The fantasy: *the Bronze-age alchemist's bench, where glass hums and you can see the colour moving in the tubes*. Magic stays
optional (T7): nothing here gates the spine, and a player who never learns `aura_reading` never sees a dial.

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

| thread | what this unit reads | what this unit defines |
|---|---|---|
| T3 essentia flow | `jarsFor`, `TUBE`, `JAR_BLOCKS`, `MAX_TUBES` (`src/magic/essentiaNet.ts`); `JAR_UNITS` 32, `VOID_JAR_UNITS` 128, `VIAL_UNITS` 4 (`src/content/itemsMagic.ts`) | `TUBE_UPS` 4, `TUBE_BURST_S` 2, `jarReach()`, `TubeFlow` budgets per network; tubes never join fluid pipes (the `essentia_tube` key is not in any pipe accept list and the fluid net never sees it) |
| T7 gating | `aura_reading` (exists); `aura_dial`, `steady_tubes` (Unit 18 flags) | none; the dial is a magic convenience |
| T8 reading | grammar `<Name> - <fact>, <fact>`; aura chip example `"cinder 6  loam 4  gale 2"` | dial chips, dial aria label, `Essentia Tube - ...` crosshair line, desk refusal `"The tubes are still carrying - ready in 3 s"` |
| T9 sound | `MAGIC_SFX` (`src/audio/sfxMagic.ts`), `sfxKit` (`tone`, `noise`, `bp`, `hp`, `lp`, `bell`), tiers whisper 0.3 / small 0.6 / normal 1 | `tube_flow`, `aura_tick`, `golem_step`; volume on every magic `sfx` emit |
| T10 saving | `MagicSnapshot` (`src/magic/magic.ts`) | nothing new saved (budgets and motes are transient; see 7) |

### 2.1 Contract with Unit 18 (research)

- Unit 18 adds research entries whose `unlocks.flags` contain `'steady_tubes'` and `'aura_dial'` (SYSTEMS.md T7 "Adds").
  This unit reads them only through `hasFlag(this.research, '<flag>')`. Before Unit 18 merges the flags are never set and
  everything here works at the base numbers.
- Meaning of the flags, as this unit implements them (Unit 18's entry text must match these words):
  - `steady_tubes`: every tube network carries **8 units/s** instead of 4 and its burst is 16 instead of 8. Suggested entry
    text for Unit 18: "Glass that does not shiver carries twice as much: every tube line moves 8 essentia a second."
  - `aura_dial`: the dial shows while a rod is anywhere in the pack, not only while held (the "pinned" dial). The dial
    itself is first unlocked by `aura_reading`, exactly as the crosshair reading is today (SYSTEMS.md T7: "the dial itself
    also accepts `aura_reading` as before"). Suggested text: "The rod need not be in your hand: the dial stays while you
    carry one."
- If Unit 18 chooses different entry keys, nothing here changes: only the flag strings matter.

### 2.2 Contract with Unit 17 (golems)

- This unit adds the sound `golem_step` to `MAGIC_SFX` and to the `SfxName` union. Unit 17 MAY emit it
  (`bus.emit('sfx', { name: 'golem_step', x, y, z, volume: 0.6 })`, once per block walked, i.e. every 0.5 s at
  `GOLEM_SPEED` 2 blocks/s). Unit 17 must not add its own step sound. If Unit 17 merges first and needs the name, it adds the
  union member and this unit adds only the patch (merge rule: union member appears once).
- Golems are fed "1 Spring per 30 s from a jar in its range or tubed" (T6). A golem drawing through tubes is a consumer like a
  servant: Unit 17 calls the shared `Magic` take path (whatever public wrapper it gets) and therefore automatically obeys the
  tube budget defined here. Unit 17 must not call `jarsFor` + `setJar` directly.

### 2.3 Contract with the HUD (no other unit touches the top-right cluster in this build)

The dial lives in `.hw-hud__right` (`src/ui/hud/hud.ts`), before `this.compass.el`. No other unit in SYSTEMS.md 7 adds a HUD
plate; Unit 10's buff pills live in the vitals block (left). If another unit adds something to `.hw-hud__right`, the dial
keeps first position (it is the most transient element).

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code (quoted)

### 3.1 The reading
- `Magic.landAspects(cx, cy, cz): Map<Aspect, number>` (`src/magic/magic.ts` ~331) sums `aspectsOf(b.key)` over the
  7 x 7 x 7 cube (`GATHER_RADIUS` 3) around a cell: 343 `getBlock` calls per call.
- `Magic.rodReading(): string | null` (~405): null unless `this.heldRod()` and `hasFlag(this.research, 'aura_reading')`;
  drawable aspects only (`drawable(a)`: primal, or any with `compound_draw`), value per aspect
  `max(0, min(DRAW_CAP, floor(n / 8)) - floor(this.drawn(px, pz, a)))` (`DRAW_CAP` 24), top 3, `"Land drained"` when empty,
  then the nearest wellspring from `nodesAround(p.x, p.z, 3)` as `" · Glow well 12 NE (20)"` or `"... well here (32)"`
  (`compass()` from `src/magic/nodes.ts`, eight-point names N, NE, E ...).
- Shown by `Game.magicLabel` (`src/app/game.ts` ~424: `m.jarText(...) ?? m.altarText(...) ?? m.servantText(...) ??
  m.lensLabel(key) ?? m.rodReading()`) and at the sky (`showStationName`, `!hit && (label = this.magic.rodReading())`).
  Recomputed every frame the label is evaluated: one 343-cell scan per frame while a rod is held.

### 3.2 Tubes
- `jarsFor(blockAt, x, y, z, radius)` (`src/magic/essentiaNet.ts`): jars within `radius` (cube; `radius` 1 = the six
  touching cells), plus every jar joined by `essentia_tube` (`TUBE`) blocks to a tube touching the consumer; BFS capped at
  `MAX_TUBES` 256. Returns a flat list: near and tubed jars are indistinguishable.
- `Magic.available(x, y, z, radius, withVials)` and `Magic.take(x, y, z, radius, aspect, n, withVials)` (private) are the only
  read and write paths; `take` walks `jarsFor` in order then whole carried vials.
- Consumers and their reach:

  | consumer | code | reach | demand |
  |---|---|---|---|
  | rune desk | `deskMake` -> `take(x,y,z, DESK_REACH 3, a, n, true)` | 3 + tubes + vials | one-shot, 8-16 units (`ARCANE_RECIPES` in `src/content/recipesMagic.ts`) |
  | infusion altar | `tickInfusion` -> `take(f.x,f.y,f.z, ALTAR_REACH + 1 = 4, a, 1, false)` every `INFUSE_STEP_S` 0.4 s | 4 + tubes | 2.5 units/s max; recipes 14-24 units over 10-20 s (`INFUSIONS`) |
  | clay servant | `tickServants` -> `take(x,y,z, 1, 'spring', 1, false)` when fed time hits 0 | touching + tubes | 1 unit / `SERVANT_FEED_S` 30 s |
  | hearth siphon | `tickSiphon` -> `consumersOf(jar)` then `setJar(..., j.n - 1)` | jar touching or tubed to a burning furnace | 1 unit per second per jar while fire < `SIPHON_BELOW_S` 15 |

- Only one infusion runs at a time (`private infusion: Infusion | null`).
- Rendering: `MagicRenderer.update(dt, jars, nodes, displays, eye)` (`src/render/magic/magicRenderer.ts`) draws jar fills,
  wellspring crystals, pedestal items; `stats = { jars, nodes, items }`. Nothing is drawn for tubes beyond the block itself.

### 3.3 Sound
- `MAGIC_SFX` has six patches: `scan_chime`, `essentia_pour`, `rod_hum`, `research_solve`, `infuse`, `cast`. Emits pass no
  `volume` (all at 1.0, "normal"), although `rod_hum` repeats about five times a second while Use is held.
- `src/audio/sfx.test.ts`: `expect(SFX_NAMES.length).toBe(72 + Object.keys(MAGIC_SFX).length)` (78 today). Engine:
  `MAX_VOICES` 24, `REPEAT_GUARD_S` 0.03, `HEARING_RANGE` 24.

### 3.4 HUD
- `Hud` (`src/ui/hud/hud.ts`): `.hw-hud__right` holds `Compass`, `DayDial`, `PowerStrip`; `frame(dt)` aims the compass every
  frame, `update()` runs every `SLOW_S` 0.125 s. Plates are 48 px tall (44 px at `max-width: 599.98px` and at
  `max-height: 519.98px`), class `hw-hud-plate`. `Compass` uses `relativeBearing(px, pz, yaw, tx, tz)` from `hudMath.ts`
  and a 34 px ring (`.hw-compass__dial`). On touch the right padding reserves `--hw-hud-reserve: 116px` for the bag and pause
  buttons. `GameUI` builds `Hud` with `HudDeps`; `Game` builds `GameUI` with `GameUIDeps`.

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 The aura dial

#### 4.1.1 When it shows

| condition | dial |
|---|---|
| no `aura_reading` and no `aura_dial` | hidden (never created in the DOM flow: `el.hidden = true`) |
| `aura_reading` (or `aura_dial`), a rod (`RODS`: `vis_rod`, `bronze_rod`, `iron_rod`) held in the selected slot | shown, `data-mode="held"` |
| `aura_dial`, a rod carried but not held | shown, `data-mode="carried"` (ring at 70% opacity; chips unchanged) |
| a screen open (`setScreenOpen(true)`) | hidden with the rest of the top cluster's transient parts (it follows `.hw-hud[data-screen]`; no extra code beyond CSS) |
| driving a vehicle | unchanged rules (the rod cannot be held while driving in practice) |

The rule lives in ONE place: `Magic.auraView()` returns `null` when the dial must hide.

#### 4.1.2 Data shown (`AuraView`, NEW)

```ts
// src/magic/auraText.ts (NEW, pure, no DOM, no registry import beyond aspects.ts)
export interface AuraAspect { aspect: Aspect; left: number }          // left = drawable units here, 0..DRAW_CAP
export interface AuraWell { aspect: Aspect; dist: number; dir: string; left: number; x: number; z: number }
export interface AuraView {
  mode: 'held' | 'carried';
  aspects: AuraAspect[];      // every drawable aspect with left >= 1, sorted by left desc then aspectOrder asc; at most 6
  well: AuraWell | null;      // nearest wellspring within nodesAround(p.x, p.z, 3), else null
}
```

- `left` uses exactly today's formula (`min(DRAW_CAP, floor(n / 8)) - floor(drawn)`), so the dial, `richest()` and the rod
  agree. Non-drawable aspects (compounds before `compound_draw`) are not shown: the dial shows what the rod can take.
- The ring shows up to 6 arcs; the chips show the top 3; the well appears as a pip and (desktop) a line.

#### 4.1.3 Anatomy (desktop, >= 600 px wide and >= 520 px tall)

```
 .hw-hud__right (flex, right-aligned, gap 6px)
 +--------------------------------------------+ +-------------+ +---------+ +--------+
 |  .-~~~-.   cinder 6                         | | compass     | | day dial| | power  |
 | / ##  ++\  loam 4   gale 2                  | |  (o) 12 m   | |  ...    | |  ...   |
 || #  6  + |  Glow well 12 m NE (20)          | +-------------+ +---------+ +--------+
 | \ ==  ** / *<- pip on the rim, turns with view
 |  '-___-'                                    |
 +--------------------------------------------+
   ^ 34 px ring, 2 px track, arcs coloured by aspectInfo(a).color; centre = top aspect's number
   height 48 px, padding 0 9px 0 6px (same as .hw-compass)
```

- **Ring** (`.hw-aura__ring`, 34 x 34 px, inline SVG, `viewBox 0 0 34 34`): a dark track circle (r 14, stroke 4,
  `rgba(0,0,0,.45)`), then one `<circle>` per shown aspect with `stroke-dasharray` arcs. The ring is divided into equal sixths
  (60 degrees each, 4 degrees gap); arc i fills `left / DRAW_CAP` of its sixth, starting at 12 o'clock clockwise, in
  `aspectInfo(a).color`. Six fixed `<circle>` nodes are created once and only their `stroke`, `stroke-dasharray` and
  `visibility` change (no DOM churn).
- **Centre number** (`.hw-aura__top`, `hw-num`, 13 px bold): the top aspect's `left`; empty when drained.
- **Pip** (`.hw-aura__pip`, a 6 px dot in the well's aspect colour on the ring's rim): rotated by
  `relativeBearing(p.x, p.z, p.yaw, well.x + 0.5, well.z + 0.5)` every frame, like `Compass.aim`. When `well.dist < 3` the pip
  sits in the centre and pulses (CSS `@keyframes hw-aura-here`, 1.2 s; disabled under `prefers-reduced-motion`).
- **Chips** (`.hw-aura__chips`, 12.5 px): up to 3 spans `.hw-aura__chip` = 8 px colour dot + text `cinder 6`; joined by two
  spaces visually (CSS gap 8 px) and in `textContent` of the container for tests and screen readers.
- **Well line** (`.hw-aura__well`, 11 px, `--hw-ash-1`): `Glow well 12 m NE (20)` / `Glow well here (32)`.
- Plate width: auto, max 230 px; chips never wrap (overflow hidden, ellipsis on the well line).

#### 4.1.4 Drained

`aspects` empty: ring arcs hidden, track tinted `var(--hw-iron-3)`, centre empty, chips container text `Land drained`
(the existing string). The well line still shows if a wellspring is near (that is exactly when the player wants it).

#### 4.1.5 Phone layouts

Portrait (`max-width: 599.98px`, 390 x 844 reference): the top cluster wraps to a second row (`'left right'`), right side
holds compass + day dial + power already. The dial collapses to **ring + centre number only** (44 px tall, 44 px wide incl.
padding 5 px): chips and well line `display: none`. The pip still points at the wellspring. The ring is the only addition, so
the right column grows by 50 px (44 + gap 6), which fits beside a 140 px vitals block at 390 px:
`390 - 16 pad - 140 vitals - 6 gap = 228 px` for the right column; compass (~92) + dial (~44 compact at portrait already
measured by the day dial's own collapse rules) + aura (44) fits on one line or wraps right-aligned below (flex-wrap is already
on). Never covers the hotbar or the crosshair (it is in the top band).

```
 390 px portrait
 +--------------------------------------+
 | [ goal tracker ...................]  |   <- 'mid mid'
 | [vitals 140px]   (o)  (☾) (aura 6)   |   <- 'left right', aura ring = 44 px plate
 |                                      |
 |                  +                   |   crosshair (block names again)
```

Landscape phone (`max-height: 519.98px`, 844 x 390): one row along the top; the dial shows ring + up to **3 compact chips
showing the number only** with the colour dot (`● 6 ● 4 ● 2`, names in the `title` and aria label), no well line. Height
44 px.

Touch targets: the dial is display-only (`pointer-events: none`, like the compass), so the 44 px rule for buttons does not
apply; it still matches the 44 px plate height for visual rhythm.

#### 4.1.6 Update rate and cost

- `Magic.auraView()` caches its result in a private `auraCache: { cell: string; t: number; view: AuraView | null }`. It
  recomputes when the player's integer cell (`floor(x),floor(y+0.5),floor(z)`) changed, OR `AURA_REFRESH_S` 0.5 s of
  `this.clock` passed, OR `this.lastDraw` changed since the cache (the rod just drew, the numbers must drop at once). Otherwise
  it returns the cached object. One 343-cell scan at most twice a second plus once per rod draw (draws are at most every
  `ROD_INTERVAL_S` 0.2 s), replacing today's scan per frame.
- The HUD reads it on its slow tick (`SLOW_S` 0.125 s) through a new dep `aura?: () => AuraView | null` and updates DOM only
  when a key string changes (`AuraDial.key`, the same trick as `VehicleHud.key`). The pip angle updates in `frame()`.

#### 4.1.7 The crosshair after this unit

`rodReading()` is no longer shown in the crosshair: remove `?? m.rodReading()` from `magicLabel` and the
`!hit && ... rodReading()` branch in `showStationName`. Aiming at a block with a rod in hand names the block again. `rodReading()`
stays as a method (now built from `auraView()` + `auraLine()`, see 8) for tests and diagnostics.

### 4.2 Tube flow

#### 4.2.1 The model in one paragraph

A **tube network** is a connected set of `essentia_tube` cells (6-neighbour). Each network has a **budget** in units: it refills
at `rate` units per second up to `cap = rate x TUBE_BURST_S`, where `rate = TUBE_UPS` (4) or `2 x TUBE_UPS` (8) with
`steady_tubes`. A consumer drawing from a jar it reaches only through tubes asks that network for a grant; a grant is given
when the budget is **above 0**, and the full request is subtracted (the budget may go negative: debt). Jars within the
consumer's own reach radius (touching for servants and the siphon, 3 for the desk, 4 for the altar) are **near** and never
touch a budget: they pay instantly, as today. Units are never created or lost: a refused grant takes nothing.

Why "debt" instead of "only what the budget holds": the rune desk pays its cost at once (8-16 units). With debt, a desk fed
only by tubes still crafts immediately when the line is rested, and then the line rests `debt / rate` seconds (16 units at
4/s from a full 8 budget = 2 s; at 8/s from 16 = 0 s). The flow limit shows up as a short, honest wait, never as a desk that
can never afford a recipe because its burst is smaller than the cost.

#### 4.2.2 Numbers

| constant | value | where | why |
|---|---|---|---|
| `TUBE_UPS` | 4 units/s | `src/magic/tubeFlow.ts` (NEW) | SYSTEMS.md 5.2; one vial per second through any one line |
| `steady_tubes` rate | 8 units/s | `tubeRate(research)` | SYSTEMS.md 5.2 "x2" |
| `TUBE_BURST_S` | 2 s | `tubeFlow.ts` | cap 8 (16 steady): a resting line pays a vial pair instantly |
| `TUBE_FLOW_SHOW_S` | 1.5 s | `tubeFlow.ts` | motes linger this long after the last grant |
| `TUBE_SOUND_S` | 0.5 s | `tubeFlow.ts` | at most two `tube_flow` sounds a second per network |
| `TUBE_NET_FORGET_S` | 60 s | `tubeFlow.ts` | an unused budget entry is dropped (it would be full again anyway) |
| `MOTES_PER_FLOW` | 8 | `magicRenderer.ts` | <= 24 particles per emitter (T9 rule 4) |
| `TUBE_MOTES_MAX` | 96 | `magicRenderer.ts` | 12 flows on screen at once; pooled InstancedMesh |
| `MOTE_SPEED` | 3 blocks/s | `magicRenderer.ts` | a mote crosses a 12-tube line in 4 s: slow enough to see |
| `AURA_REFRESH_S` | 0.5 s | `magic.ts` | 4.1.6 |

#### 4.2.3 What each consumer does (normative)

- **Infusion altar** (`tickInfusion`, every `INFUSE_STEP_S` 0.4 s, 1 unit): near jars first; if none holds a missing
  aspect, ask the tubed jars of each touching network in order; a network with budget <= 0 is skipped this step. Demand is
  2.5 units/s, below 4, so a single altar on a rested line is never slowed; the limit matters when the same line also feeds a
  desk or many servants. Today's 6 s "needs ... fill a jar near it" advice still fires only when *no reachable jar* holds the
  aspect; a line in debt is not "missing" (no advice; the motes show it is working).
- **Rune desk** (`deskRow` / `deskMake`): `have` = near jars + carried vials + tubed jars of networks with budget > 0.
  Payment order: near jars, then tubed jars (one grant per network for the units taken from it), then whole vials (existing
  rule, Unit 18 refunds the rest). If the row would be affordable counting tubed jars of networks in debt, the row's
  `problem` is `The tubes are still carrying - ready in N s` with `N = ceil(-budget / rate)` of the slowest such network
  (min 1). The desk screen already re-renders on its refresh interval (`REFRESH_INTERVAL_S` 0.125 s in `gameUI.ts`), so the
  number counts down and the Make button enables by itself.
- **Clay servant** (`tickServants`, 1 s slow tick): `take(x, y, z, 1, 'spring', 1, false)` becomes the budgeted take. A
  servant whose line is in debt waits; it is fed on a later second. Max wait at 4/s after a 16-unit desk craft: 2 s.
- **Hearth siphon** (`tickSiphon`): `consumersOf(jar)` already distinguishes "touching" (the first six cells) from "via tubes"
  (the rest). A tubed furnace costs a grant of 1 from the jar's network before `stokeFurnace`; a touching furnace does not.
- **Golem** (Unit 17): same as a servant (2.2).

**Fairness.** Consumers ask in a fixed order inside one `Magic.tick`: infusion step (fast path) then, on the 1 s slow tick,
servants (map order) then siphons. With 4 units/s and the infusion capped at 2.5 units/s, at least 1.5 units/s remain for the
slow consumers on every tick, which covers 45 servants (1/30 s each) or one siphon at its 1 unit/s. The only bursty consumer
is the desk, and debt makes it pay its burst with a short rest that everyone on that line shares equally. No round-robin is
needed; this is stated so the builder does not add one.

#### 4.2.4 Network identity, split and merge

- `jarReach` (NEW, `essentiaNet.ts`) runs the same BFS as `jarsFor` but returns, for each tube network touching the consumer,
  its id, its tube cells and the jars on it with a path:

  ```ts
  export interface TubeNet { id: string; tubes: number; jars: { cell: Cell; path: Cell[] }[] }
  export interface JarReach { near: Cell[]; nets: TubeNet[] }
  export function jarReach(blockAt: BlockAt, x: number, y: number, z: number, radius: number): JarReach;
  ```
  - `near`: jars within `radius` (same cube rule as `jarsFor`).
  - A jar that is both near and on a tube counts as **near** only (instant), never twice.
  - `id`: the smallest tube cell of the network by `(y, z, x)` lexicographic order, as `"x,y,z"`. Deterministic, independent
    of where the BFS started.
  - `path`: tube cells from the tube touching the consumer to the tube touching the jar (BFS parent pointers), at most 64
    cells (longer paths are truncated at the consumer end for display; flow math does not use the path).
  - The BFS stops at `MAX_TUBES` 256 tubes per network, like today.
  - `jarsFor` becomes `near.concat(nets.flatMap(n => n.jars.map(j => j.cell)))` deduplicated, so existing callers and the
    existing test (`'tubes join far jars to a consumer'`) are unchanged.
- `TubeFlow` keeps `budgets: Map<id, { b: number; lastT: number }>` and `cellNet: Map<cellKey, id>` (filled from every
  `jarReach` result).
- **Merge** (a tube placed joins two lines): the next `jarReach` finds a new id. Its budget is the **minimum** of the budgets of
  every old id found in `cellNet` for its tube cells (debt carries over; placing a tube never refreshes a tired line), or `cap`
  if none is known.
- **Split** (a tube mined): each part gets a new id (or keeps the old one if its smallest cell is unchanged) and inherits the
  old network's budget. Two halves in debt are both in debt: splitting gains nothing.
- **Mid-flow change**: grants are per take; a change between two infusion steps just means the next step resolves the new
  shape. Motes of a flow whose network id disappeared fade with `TUBE_FLOW_SHOW_S` and are not recreated.
- `blockChanged` in `Magic` already listens to `'block:changed'`; when `from` or `to` is a tube or a jar, it clears the
  `jarReach` memo (4.2.6). `cellNet` entries are overwritten lazily; stale ones only feed the min rule and are pruned with
  their budget after `TUBE_NET_FORGET_S`.

#### 4.2.5 Motes (visual)

- `Magic.tubeFlows(): readonly TubeFlowView[]` (NEW) returns the flows granted within the last `TUBE_FLOW_SHOW_S`:
  ```ts
  export interface TubeFlowView { net: string; aspect: Aspect; path: readonly Cell[]; t: number /* clock of last grant */; rate: number }
  ```
  One flow per (network, consumer cell, aspect); a new grant refreshes `t`. At most 16 flows are kept (oldest dropped).
- `MagicRenderer.update` gains a 6th argument `flows: readonly TubeFlowView[]` and draws motes with ONE
  `THREE.InstancedMesh` (geometry `OctahedronGeometry(0.09, 0)`, `MeshBasicMaterial({ transparent: true, opacity: 0.95,
  depthWrite: false, vertexColors: false })`, capacity `TUBE_MOTES_MAX`, per-instance colour via `setColorAt` with
  `aspectInfo(a).color`). Per flow: `n = min(MOTES_PER_FLOW, path.length)` motes evenly spaced along the path, each at
  parameter `s = ((time * MOTE_SPEED) / path.length + i / n) % 1` from the jar end to the consumer end, position lerped
  between cell centres. Fade: scale `x (1 - age / TUBE_FLOW_SHOW_S)` where `age = clock - t`. Flows farther than
  `NODE_DRAW_DIST` 64 from the eye are skipped. `instanceMatrix.needsUpdate = true` once per frame; `mesh.count` = motes
  drawn; no allocation per frame (reuse one `THREE.Matrix4`, `THREE.Vector3`, `THREE.Color`).
- `stats` gains `motes: number` (count drawn last frame) for the e2e check.
- The tube block itself is unchanged (glass). No light, no shader.

#### 4.2.6 Performance (many tubes)

- `jarReach` memo in `Magic`: `Map<"x,y,z,r", JarReach>`, cleared on any tube/jar `block:changed` and every 5 s of clock as a
  safety net. The desk screen calls `deskRow` 7 times per refresh (8/s); with the memo that is 7 map lookups, not 7 BFS.
- Worst case: a 256-tube network feeding an altar: one BFS per change, then lookups. The siphon walks `consumersOf` per Cinder
  jar per second (unchanged, capped at 256).
- Motes: at most 96 instances, one draw call.
- Unit test asserts a 256-tube line resolves in under 5 ms (loose, CI-safe) and that the memo returns the same object twice.

### 4.3 Sounds

All patches follow the `sfxMagic.ts` house style (comment line saying what it is, glassy and mid-band so a phone carries it,
`jitter` for repeats). T9 rule 1 names; tiers by request `volume`.

| name | when (who emits) | position | volume (tier) | patch |
|---|---|---|---|---|
| `tube_flow` | a tubed grant of >= 1 unit, at most once per `TUBE_SOUND_S` per network (`Magic`) | consumer cell centre | 0.3 whisper | see below |
| `aura_tick` | the dial appears (auraView goes null -> non-null), and when `well.dist` crosses below 3 ("here") (`Magic`, emitted from `auraView()` refresh) | none (listener) | 0.3 whisper | see below |
| `golem_step` | each block a golem walks (Unit 17) | the golem | 0.6 small | see below |

```ts
// Essentia moving in a glass tube: a thin, bubbling trickle with a faint high ring, short so it can repeat twice a second.
tube_flow: {
  jitter: 3,
  layers: [
    noise('pink', bp(2200, 2800, 3), 0.16, 0.22, { a: 0.02, trem: { rate: 22, depth: 0.7 } }),
    tone('sine', 1760, 0.05, 0.18, { a: 0.01, freqEnd: 1980 }),
  ],
},
// The aura dial waking (or a wellspring right here): one small glass tick, a bell partial with a breath on top.
aura_tick: {
  jitter: 1,
  layers: [
    bell(2093, 0.12, 0.16),                       // C7 from N.C7, FM shimmer via bell()
    noise('white', hp(7000), 0.03, 0.06, { a: 0.004 }),
  ],
},
// A clay golem's foot: a soft, dull thud with a little grit, low enough to sit under the workshop's clatter.
golem_step: {
  jitter: 2,
  layers: [
    tone('sine', 95, 0.35, 0.12, { a: 0.004, freqEnd: 70 }),
    noise('brown', lp(600), 0.18, 0.1, { a: 0.003 }),
  ],
},
```

(`bell` and `lp` are exported by `src/audio/sfxKit.ts`; `sfxMagic.ts` today imports `bp, hp, noise, tone` and adds `bell, lp`.
If `'brown'` is not a `NoiseColor` in `buffers.ts`, use `'pink'` with `lp(400)`; every patch must pass the existing per-sound
tests: frequencies 20 Hz..Nyquist, no exponential ramp to 0, distinct layers.)

**Loudness pass on existing magic sounds** (emit sites add `volume`; patches unchanged):

| sound | emit site | today | new volume | tier, reason |
|---|---|---|---|---|
| `rod_hum` | `gather` | 1 | 0.3 | whisper: repeats ~5/s while Use is held; T9 "ticks" |
| `essentia_pour` | `useJar` | 1 | 0.6 | small: a glass pour, close to the ear |
| `scan_chime` | notebook scan in `use` | 1 | 0.6 | small: UI-like chime |
| `research_solve` | `notebook().place` | 1 | 0.6 | small: chime |
| `infuse` | `deskMake`, infusion done | 1 | 1 | normal: a craft, a machine finishing |
| `cast` | `cast` | 1 | 1 | normal: a tool use |

No sound loops; `tube_flow` repeats only while units actually move (T9 rule 3: idle is silent).

### 4.4 Balance pass (old -> new, against SYSTEMS.md 5)

| number | old | new | reasoning |
|---|---|---|---|
| tube throughput | unlimited, instant | `TUBE_UPS` 4 units/s per network, burst 8 | SYSTEMS 5.2. One vial (4) a second per line: tubes are convenience, not a teleport; a jar within reach stays instant so a compact bench loses nothing |
| `steady_tubes` | - | 8 units/s, burst 16 | SYSTEMS 5.2 "x2"; a 16-unit desk recipe then needs no rest at all |
| near-jar payment | instant | instant (unchanged) | SYSTEMS 5.2 "instant for jars directly touching the consumer"; the desk's `DESK_REACH` 3 and altar's 4 are existing reach rules, kept (see 14) |
| `INFUSE_STEP_S` | 0.4 s (2.5 u/s) | unchanged | infusions finish on `seconds` (10-20 s) not on draw: 24 units at 2.5 u/s = 9.6 s < 20 s. Below `TUBE_UPS`, so one altar is never starved by a rested line |
| `SERVANT_FEED_S` | 30 s / Spring | unchanged | 1/30 u/s is negligible against 4 u/s; golems copy it (T6) |
| siphon | 1 unit per s per jar below 15 s of fire, `CINDER_BURN_S / VIAL_UNITS` = 22.5 s per unit | unchanged | already slow; tubed siphon now costs one grant |
| `RODS` | capacity 16/32/64, draw 1/2/3 | unchanged | rod draws are from the land, not tubes; a bronze rod fills a vial in 2 Uses (0.4 s): fine against a 4/s line |
| `FOCI` | cost 2/1/6/4, cooldown 1/0.5/20/2 | unchanged | rod charge, not tubes |
| `NODE_POOL` / `NODE_REGEN_S` | 32 / 15 s | unchanged | a wellspring refills a vial a minute; the dial now makes them findable, which is reward enough |
| `DRAW_CAP` / `DRAW_RECOVER_S` | 24 / 30 s | unchanged | the dial shows `left` straight from these |
| `AGE_BONUS_PER_AGE` | 1 | unchanged | fingerprint table; changing it would shift every aspect and every board |
| `JAR_UNITS` / `VOID_JAR_UNITS` / `VIAL_UNITS` | 32 / 128 / 4 | unchanged | a full jar drains through one line in 8 s, a void jar in 32 s: perceptible, not tedious |
| desk costs (`ARCANE_RECIPES`) | 8-16 units | unchanged | with burst 8 and debt, a tube-only desk waits at most 2 s per craft |
| magic sound volumes | all 1 | see 4.3 table | T9 tiers |

---------------------------------------------------------------------------------------------------------------------------
