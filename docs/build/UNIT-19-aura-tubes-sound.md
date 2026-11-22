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
holds compass + day dial + power already. The dial collapses to **ring + centre number only** (a 44 x 44 px plate, padding
5 px). The right column then holds compass, day dial, power strip and the 44 px ring; `.hw-hud__right` already has
`flex-wrap: wrap` and `justify-content: flex-end`, so when the row is too narrow the dial wraps to a second right-aligned line
(on portrait it gets CSS `order: 9`, so it is the element that wraps to the end of the cluster, never the compass). The builder verifies at 390 px in the phonePortrait screenshot that nothing
overlaps the goal tracker, and the dial never covers the hotbar or the crosshair (it is in the top band).

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
`'brown'` is a `NoiseColor` in `src/audio/buffers.ts`. Every patch must pass the existing per-sound tests in `sfx.test.ts`:
frequencies 20 Hz..Nyquist, no exponential ramp to 0, layers distinct from every other patch.)

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

## 5. Behaviour and rules (including edge cases)

### 5.1 Dial rules
1. `auraView()` is null when: no rod held (and not `aura_dial` with a rod carried), or neither `aura_reading` nor `aura_dial`
   is set. The flag check is `hasFlag(this.research, 'aura_reading') || hasFlag(this.research, 'aura_dial')`.
2. **Rod switched** (hotbar scroll, number key, touch tap to another slot): the next `auraView()` call sees `heldRod()` change.
   The cache key includes the held item key, so the dial hides within one HUD slow tick (<= 0.125 s). Switching between two rod
   tiers keeps the dial (numbers do not depend on the tier) and plays no `aura_tick` (it never went null).
3. **No research**: no dial, no tick, and the crosshair no longer shows `rodReading()` either (it already returned null).
4. **Research learned while holding the rod**: the dial appears on the next slow tick with `aura_tick`.
5. **Drawing with the rod**: each draw changes `lastDraw`, which invalidates the cache, so the drawn aspect's number drops at
   once; when the land runs out the chips read `Land drained` (and the existing advice toast
   `The land here is drained. Move on, or wait for it to recover` still comes from `gather`).
6. **Recovery**: `drawn()` recovers 1 per `DRAW_RECOVER_S` 30 s; the 0.5 s refresh makes the numbers climb back while
   standing still.
7. **Wellspring**: nearest of `nodesAround(p.x, p.z, 3)` by horizontal distance (as `rodReading` does today). `dist` rounded;
   `dist < 3` = `here`. The pip shows it even before `node_tap` (the reading always showed wells; drawing from them still needs
   `wellsprings`). A well that is fully drawn still shows with `(0)`.
8. **Underground / caves**: the cube is around the player wherever they stand; nothing special.
9. **Paused**: the HUD keeps calling; the clock does not advance, so the cache simply holds.
10. **aura_tick on well**: emitted once when `well.dist` goes from >= 3 to < 3 while the dial is shown; not again until it has
    gone back to >= 4 (1 block hysteresis so standing on the edge does not tick repeatedly).

### 5.2 Flow rules
1. Near beats tubed: a jar within the consumer's reach is always drained first and costs no budget.
2. A grant is allowed iff `budget > 0`; the whole request is subtracted. Budgets refill in `Magic.tick(dt)` by `rate x dt`,
   capped at `rate x TUBE_BURST_S`. Rate is read every tick (learning `steady_tubes` takes effect at once; the cap grows, the
   current budget does not jump).
3. One grant per (network, take call) for the units taken from that network's jars in that call.
4. **Consumer touching two networks**: each is asked separately, in `nets` order (sorted by id); a network in debt is skipped.
5. **Network split mid-infusion**: the half no longer touching the altar simply stops being reachable; the altar's next step
   uses what is left; if nothing holds the aspect, the existing 6 s advice fires
   (`The altar needs Vein 4: fill a jar near it`).
6. **Network merge**: min budget rule (4.2.4).
7. **Jar emptied by another consumer**: the take finds 0 there and moves to the next jar; no grant is spent for 0 units.
8. **Tube broken by the player while motes run**: motes of that flow fade out over `TUBE_FLOW_SHOW_S` (they do not snap away,
   and nothing moves through air: the fade is in place, T9 rule 4 "nothing teleports").
9. **Old save loaded**: budgets start at `cap` (full). The first desk craft after loading may skip one short rest: accepted.
10. **Many tubes**: `MAX_TUBES` 256 per network is unchanged; a longer line simply does not reach beyond 256 tubes (today too).
11. Tubes stay their own network (T3): a fluid pipe next to a tube does not join; a jar is never a fluid container.
12. Conservation: total units in all jars + carried vials + paid infusion units + desk outputs' costs is constant across any
    sequence of grants, refusals, splits and merges (tested, 9.3).

### 5.3 Messages (all exact)

| when | text | channel |
|---|---|---|
| desk row affordable only with tubes in debt | `The tubes are still carrying - ready in 3 s` (N = ceil(-budget / rate), min 1) | desk row `problem` (screen) and the return of `make` |
| crosshair on a tube with a flow on its network | `Essentia Tube - carrying Vein, 4 units/s, 12 tubes` | crosshair (`tubeText`) |
| crosshair on a tube, no flow, jars on the line | `Essentia Tube - idle, 12 tubes, 2 jars` | crosshair |
| crosshair on a tube, line in debt (desk just paid) | `Essentia Tube - resting, ready in 2 s, 12 tubes` | crosshair |
| crosshair on a lone tube (no jar) | `Essentia Tube - no jar on this line` | crosshair |
| dial drained | `Land drained` | dial chips |

`carrying` names the aspect of the most recent flow on that network and the network's current rate (4 or 8). Tube counts are
the network size (`TubeNet.tubes`, capped display `256+`). All lines are <= 60 characters at worst case
(`Essentia Tube - resting, ready in 4 s, 256+ tubes` = 48).

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Strings (T8)
- Chip text: `<aspect key> <left>` in lowercase with the number, e.g. `cinder 6`; container text joins chips with two spaces:
  `cinder 6  loam 4  gale 2` (SYSTEMS.md T8 example, verbatim).
- Well line: `<Aspect Name> well <dist> m <dir> (<left>)` or `<Aspect Name> well here (<left>)`, e.g. `Glow well 12 m NE (20)`.
  (The old crosshair form `Glow well 12 NE (20)` gains the unit `m`, matching the home compass `12 m`.)
- Aria label (`role="img"` on the plate), sentence, full names:
  `Aura: Cinder 6, Loam 4, Gale 2. Glow well 12 m NE, 20 left.` / `Aura: land drained.` (+ well sentence when present).
- Landscape compact chips: each chip has `title="Cinder 6"`.
- Desk / tube strings as 5.3.

### 6.2 Phone layout summary

| viewport | dial content | size |
|---|---|---|
| desktop (>= 600 w, >= 520 h) | ring + centre number + 3 chips + well line | 48 px tall, <= 230 px wide |
| portrait phone (< 600 w), 390 x 844 | ring + centre number only, pip | 44 x 44 px |
| landscape phone (< 520 h), 844 x 390 | ring + 3 number-only chips, pip, no well line | 44 px tall, <= 130 px wide |

The dial never sits in the touch reserve (`--hw-hud-reserve`), never covers the hotbar, crosshair or goal tracker; it is
`pointer-events: none`. Colours: arcs use `aspectInfo(a).color`; very dark aspects (`rift` `#5a3a6e`, `void` `#3a2a55`) get a
1 px `rgba(255,255,255,.35)` outline arc underneath (a second static track circle drawn at r 16, stroke 1) so they read on the
dark plate.

### 6.3 Sounds (T9 tiers)
`aura_tick` 0.3, `tube_flow` 0.3, `golem_step` 0.6; existing magic sounds per 4.3. Visual vocabulary: motes take the aspect
colour (no amber/green/red here: those are machine states; a resting tube is shown by the crosshair word `resting` only).

### 6.4 Reduced motion
Under `prefers-reduced-motion: reduce`: the "here" pip pulse is off; motes still move (they are information) but at
`MOTE_SPEED / 2`; read once at renderer construction via `matchMedia` (no per-frame query).

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

### 7.1 Types (TS sketches)

```ts
// src/magic/tubeFlow.ts (NEW)
import type { Aspect } from './aspects';
export type Cell = [number, number, number];
export const TUBE_UPS = 4;
export const TUBE_BURST_S = 2;
export const TUBE_FLOW_SHOW_S = 1.5;
export const TUBE_SOUND_S = 0.5;
export const TUBE_NET_FORGET_S = 60;

export interface TubeFlowView { net: string; aspect: Aspect; path: readonly Cell[]; t: number; rate: number }

export class TubeFlow {
  /** `rate` units/s, read each tick (TUBE_UPS, or 2x with steady_tubes). */
  tick(dt: number, rate: number, clock: number): void;          // refill every known budget, prune unused ones
  budget(net: string, rate: number): number;                    // current units (cap if unknown)
  /** Learns the cells of a network seen by jarReach; applies the merge/split min rule for a new id. */
  observe(net: string, tubes: readonly Cell[], rate: number, clock: number): void;
  /** True and subtracts n when budget > 0; false and changes nothing otherwise. */
  grant(net: string, n: number, rate: number, clock: number): boolean;
  /** Seconds until budget > 0 (0 when it already is). */
  readyInS(net: string, rate: number): number;
  /** Records a flow for the renderer; returns true when a tube_flow sound may play (TUBE_SOUND_S since the last one). */
  flowed(net: string, consumer: Cell, aspect: Aspect, path: readonly Cell[], rate: number, clock: number): boolean;
  flows(clock: number): readonly TubeFlowView[];                // granted within TUBE_FLOW_SHOW_S, at most 16, reused array
  lastFlow(net: string): { aspect: Aspect; t: number } | null;  // for tubeText
}
export const tubeRate = (steady: boolean): number => (steady ? TUBE_UPS * 2 : TUBE_UPS);
```

```ts
// src/magic/essentiaNet.ts additions
export interface TubeNet { id: string; tubes: Cell[]; jars: { cell: Cell; path: Cell[] }[] }
export interface JarReach { near: Cell[]; nets: TubeNet[] }
export function jarReach(blockAt: BlockAt, x: number, y: number, z: number, radius: number): JarReach;
export function netOfTube(blockAt: BlockAt, x: number, y: number, z: number): TubeNet | null; // for tubeText (BFS from a tube)
// jarsFor keeps its signature and results (built on jarReach).
```

```ts
// src/magic/auraText.ts (NEW, pure)
export const AURA_CHIPS = 3;
export const AURA_ARCS = 6;
export function auraChips(view: AuraView): { aspect: Aspect; text: string; color: string }[]; // top 3, 'cinder 6'
export function auraChipsText(view: AuraView): string;        // 'cinder 6  loam 4  gale 2' | 'Land drained'
export function auraWellText(well: AuraWell | null): string;  // 'Glow well 12 m NE (20)' | 'Glow well here (32)' | ''
export function auraAria(view: AuraView): string;             // 'Aura: Cinder 6, Loam 4, Gale 2. Glow well 12 m NE, 20 left.'
export function auraArcs(view: AuraView): { color: string; frac: number }[]; // up to 6, frac = left / DRAW_CAP clamped 0..1
export function auraLine(view: AuraView): string;             // legacy rodReading text: 'Cinder 6, Loam 4, Gale 2 · Glow well 12 m NE (20)'
export function auraKey(view: AuraView | null): string;       // change-detection key for the HUD
```

`DRAW_CAP` (24) is already exported by `magic.ts`. To keep `auraText.ts` free of `magic.ts` (which imports the registry),
`auraArcs(view, cap = 24)` takes the cap as a parameter and `magic.ts`/`AuraDial` pass `DRAW_CAP`; a unit test pins
`DRAW_CAP === 24` so the default cannot drift silently.

```ts
// src/ui/hud/hud.ts
export interface HudDeps { /* existing */ aura?: () => AuraView | null }   // optional member, NEW
// src/ui/gameUI.ts
export interface GameUIDeps { /* existing */ aura?: () => AuraView | null } // passed through to Hud
// src/render/magic/magicRenderer.ts
update(dt, jars, nodes, displays, eye, flows: readonly TubeFlowView[] = []): void; // 6th param optional, NEW
stats = { jars: 0, nodes: 0, items: 0, motes: 0 };
```

### 7.2 Save (T10)

Nothing new is saved:
- Budgets are transient: on load every network starts full (`cap`). Saving them would add a field whose only effect is a
  <= 4 s rest; not worth a schema field.
- Flows and motes are visual and transient.
- The dial has no state (the `aura_dial` flag is saved by research, Unit 18).
- `MagicSnapshot` keys and `toJSON()` output are unchanged; the T10 test (9.3) proves an old snapshot loads, and that
  `toJSON()` after flow activity has exactly the same keys as before (no accidental field).

---------------------------------------------------------------------------------------------------------------------------

## 8. Implementation plan (ordered)

1. **`src/magic/essentiaNet.ts`** - add `Cell` re-export (or import from `tubeFlow.ts`), `TubeNet`, `JarReach`,
   `jarReach(blockAt, x, y, z, radius)` (BFS per touching tube; one BFS per network, parent map for paths; id = min cell by
   `(y, z, x)`), `netOfTube(blockAt, x, y, z)`. Re-implement `jarsFor` on top of `jarReach` with identical output order:
   near jars (cube scan order) first, then tubed jars in BFS discovery order. Keep `shortfall`, `MAX_TUBES`, `TUBE`,
   `JAR_BLOCKS`.
2. **`src/magic/tubeFlow.ts`** (NEW) - constants and `TubeFlow` (7.1). Pure, no world access; ~150 lines.
3. **`src/magic/auraText.ts`** (NEW) - `AuraAspect`, `AuraWell`, `AuraView` and the helpers (7.1). Uses `aspectInfo` and
   `aspectOrder` from `aspects.ts`.
4. **`src/magic/magic.ts`**
   - `private readonly flow = new TubeFlow()`; `private tubeRate(): number { return tubeRate(hasFlag(this.research, 'steady_tubes')); }`.
   - `private reachMemo = new Map<string, JarReach>()`; `private reach(x, y, z, r): JarReach` (memo, cleared in
     `blockChanged` when `from`/`to` is `TUBE` or in `JAR_BLOCKS`, and every 5 s in `tick`). `blockChanged` needs the old key:
     read it from the event (`e.from` voxel -> `BLOCKS[voxelId(e.from)].key`) - extend the listener to pass `e.from`.
   - `tick(dt)`: `this.flow.tick(dt, this.tubeRate(), this.clock)` first.
   - Replace private `available(...)` and `take(...)` with budget-aware versions:
     `available(x, y, z, radius, withVials, includeResting = false): Aspects` (tubed jars only from nets with budget > 0
     unless `includeResting`) and `take(x, y, z, radius, aspect, n, withVials): number` (near, then nets in id order with
     `grant`, then vials). On each successful tubed take call `flow.flowed(...)` with the path of the jar it drew from and
     the consumer cell; if it returns true emit `{ name: 'tube_flow', x: cx + 0.5, y: cy + 0.5, z: cz + 0.5, volume: 0.3 }`.
   - `deskRow`: compute `have` (ready) and `haveAll` (`includeResting`); if `shortfall(cost, have)` is non-empty but
     `shortfall(cost, haveAll)` is empty, `problem = \`The tubes are still carrying - ready in ${n} s\``.
   - `tickSiphon`: split `consumersOf` result into touching (first 6) vs tubed; for a tubed furnace, find the jar's network
     (`reach(x, y, z, 1)` from the jar's side: `netOfTube` on any touching tube) and `grant(net, 1)` before stoking.
   - `auraView(): AuraView | null` with the cache of 4.1.6 and the `aura_tick` emission of 5.1.4/5.1.10
     (`{ name: 'aura_tick', volume: 0.3 }`, no position).
   - `rodReading()` becomes `const v = this.auraView(); return v && v.mode === 'held' ? auraLine(v) : null;` (keeps the
     method; text gains `m`).
   - `tubeFlows(): readonly TubeFlowView[]` -> `this.flow.flows(this.clock)`.
   - `tubeText(x, y, z): string | null` -> null unless the block is `TUBE`; else 5.3 lines via `netOfTube` (memoised by the
     same reach memo key `"t,x,y,z"`).
   - Add `volume` to the six existing `sfx` emits per 4.3.
   - Export constant `AURA_REFRESH_S = 0.5`.
5. **`src/audio/sfxMagic.ts`** - add `tube_flow`, `aura_tick`, `golem_step` (4.3); import `bell`, `lp`. Update the header
   comment (nine sounds).
6. **`src/core/gameEvents.ts`** - append `| 'tube_flow' | 'aura_tick' | 'golem_step'` after `| 'cast'` in `SfxName`
   (append only; if Unit 17 already added `golem_step`, skip it).
7. **`src/audio/sfx.test.ts`** - the count line is a shared merge point: do NOT restructure it. The magic term
   `Object.keys(MAGIC_SFX).length` already counts the three new patches; only update the comment to
   `// 72 before Essentia & Research; MAGIC_SFX now holds nine (Unit 19 added tube_flow, aura_tick, golem_step).` If by merge
   time the line has become a sum of named terms (`72 + MAGIC + DISTILL + WORKSHOP`, SYSTEMS.md T9 rule 1), keep the `MAGIC`
   term as is. Add one new `it` (9.4).
8. **`src/ui/hud/auraDial.ts`** (NEW) - `class AuraDial { readonly el; update(view: AuraView | null): void; aim(player:
   PlayerState): void }`. Built with `h`, `setText`, `setAttr`, `setFlag` from `src/ui/kit/dom.ts`; SVG ring built once (six
   arc circles, track, outline); `key` change detection via `auraKey`; `aim` uses `relativeBearing` from `./hudMath`, rounds
   to whole degrees and skips unchanged angles like `Compass.aim`. ~140 lines.
9. **`src/ui/hud/hud.ts`** - `private readonly aura = new AuraDial()`; insert `this.aura.el` first in `.hw-hud__right`;
   `frame()`: `this.aura.aim(d.player)`; `update()`: `this.aura.update(d.aura?.() ?? null)`.
10. **`src/ui/hud/hud.css`** - `.hw-aura` (shares the `.hw-compass, .hw-dial, .hw-power` block: add `.hw-aura` to that
    selector list for height/padding), `.hw-aura__ring`, `__top`, `__pip`, `__chips`, `__chip`, `__dot`, `__well`,
    `[data-mode='carried'] .hw-aura__ring { opacity: .7 }`, `[data-drained]`, the `@keyframes hw-aura-here` with its
    reduced-motion override, and the two phone media blocks (portrait: hide `__chips`, `__well`; landscape: hide `__well`,
    chips show only `.hw-aura__num`).
11. **`src/ui/gameUI.ts`** - `GameUIDeps.aura?` passed into `new Hud(root, { ..., aura: () => deps.aura?.() ?? null })`.
12. **`src/app/game.ts`** - pass `aura: () => this.magic.auraView()` to `new GameUI(...)`; remove `?? m.rodReading()` from
    `magicLabel` and add `?? m.tubeText(x, y, z)` in its place; delete the `!hit && rodReading()` branch in
    `showStationName`; pass `this.magic.tubeFlows()` as the 6th argument to `this.magicRenderer.update(...)`.
13. **`src/render/magic/magicRenderer.ts`** - motes (4.2.5), `stats.motes`, dispose the instanced mesh geometry/material.
14. **Docs** (11).

Helpers to reuse, never duplicate: `aspectInfo`, `aspectOrder`, `ASPECT_LIST` (`aspects.ts`); `compass` (`nodes.ts`);
`relativeBearing` (`hudMath.ts`); `h`/`setText`/`setAttr`/`setFlag` (`kit/dom.ts`); `hasFlag` (`research.ts`); `tone`, `noise`,
`bp`, `hp`, `lp`, `bell`, `N` (`sfxKit.ts`); the material cache `MagicRenderer.material()` is not used for motes (instanced
colour instead).

---------------------------------------------------------------------------------------------------------------------------

## 9. Tests (vitest, exact cases)

### 9.1 `src/magic/auraText.test.ts` (NEW, pure)
1. `auraChipsText` of `{ mode:'held', aspects:[{cinder,6},{loam,4},{gale,2},{brook,1}], well:null }` is
   `'cinder 6  loam 4  gale 2'` (two spaces, top 3 only).
2. Ties sort by `aspectOrder`: `[{loam,4},{cinder,4}]` -> `'cinder 4  loam 4'`.
3. Empty aspects -> `'Land drained'`; `auraArcs` -> `[]`.
4. `auraWellText({aspect:'glow', dist:12, dir:'NE', left:20, ...})` = `'Glow well 12 m NE (20)'`; `dist: 2` ->
   `'Glow well here (20)'`; `left: 19.7` floors to `(19)`.
5. `auraAria` = `'Aura: Cinder 6, Loam 4, Gale 2. Glow well 12 m NE, 20 left.'`; drained without well = `'Aura: land drained.'`.
6. `auraArcs` with `left 30` clamps `frac` to 1; 7 aspects -> 6 arcs; colour equals `aspectInfo(a).color`.
7. `auraLine` = `'Cinder 6, Loam 4, Gale 2 · Glow well 12 m NE (20)'`.
8. `auraKey(null) !== auraKey(view)` and is stable for equal views.
9. Every chip line is <= 60 characters for the longest names (`clarity 24  spring 24  frost 24`).

### 9.2 `src/magic/tubeFlow.test.ts` (NEW, pure)
1. Unknown net: `budget('n', 4)` = 8 (cap = 4 x 2).
2. `grant('n', 16, 4, 0)` -> true, budget -8; `grant('n', 1, 4, 0)` -> false, budget still -8 (nothing taken).
3. `readyInS('n', 4)` = 2 after the 16-unit grant; after `tick(1, 4, 1)` -> budget -4, `readyInS` 1; after 2 more seconds
   budget is 4; after 10 more, 8 (capped).
4. Steady: rate 8 -> cap 16; `grant(16)` from full leaves 0 -> next grant refused until a tick (>0 rule).
5. Merge: nets A (budget -4) and B (budget 8) observed, then `observe('C', cellsOfA.concat(cellsOfB))` -> `budget('C')` = -4.
6. Split: A (budget 2) then `observe('A2', half)` and `observe('A3', other half)` -> both 2.
7. Prune: an entry untouched for `TUBE_NET_FORGET_S` + 1 s is gone (budget back to cap) - and it was full anyway.
8. `flowed` returns true, then false within 0.5 s, then true after; `flows(clock)` drops entries older than 1.5 s; never more
   than 16 entries; the same array object is returned each call (no allocation).

### 9.3 `src/magic/magicRuntime.test.ts` (extend `describe('tubes, desk and altar')`, using the existing `setup()`/`fillJar`)
1. **`jarReach` splits near and tubed**: jar at (10,1,0) via tubes x=1..9 and a jar at (0,1,1): `near` = [[0,1,1]],
   `nets[0].jars[0].cell` = [10,1,0], `nets[0].tubes.length` = 9, `path[0]` = [1,1,0], `path.at(-1)` = [9,1,0];
   `jarsFor` still equals `[[0,1,1],[10,1,0]]` (order kept) and the existing test still passes untouched.
2. **Net id is start-independent**: `jarReach` from either end of the same line gives the same `id`.
3. **Infusion through tubes pays at most the tube rate**: `learnAll()`, altar at (0,1,0) with two pedestals as the existing
   lens test, the three jars moved to x=6..8 behind a 5-tube line (out of `ALTAR_REACH + 1`): start the infusion, tick
   `0.1 x 10` (1 s): paid units <= 8 + 4 x 1 = 12 and > 0; after 200 ticks the lens is done (`altarText` =
   `'Infusion Altar - Scrying Lens'`). Same build with jars within reach: paid after 1 s equals `floor(1 / INFUSE_STEP_S)` = 2
   (unchanged behaviour). Debt bites: then force the line into debt (`(t.magic as any).flow.grant(id, 20, 4, clock)`, id from
   `jarReach`) and assert the paid sum does not grow while `flow.readyInS(id, 4) > 0`, then grows again once it reaches 0.
4. **Desk rests the line**: desk at (2,1,0); five tubes (2,1,1)..(2,1,5); three jars touching the far end and all more than
   `DESK_REACH` 3 away: (2,1,6), (3,1,5), (1,1,5) (z distance 5 or 6 > 3, so outside
   the reach cube), holding gale 8, loam 8, rune 8. `learn('bronze_rod')`, ingredients for two rods. First `make('bronze_rod')` -> `'Made Bronze Rod'`
   (cost gale 4 + loam 4 + rune 2 = 10 tubed units; budget 8 -> -2). Immediately `row().problem` =
   `'The tubes are still carrying - ready in 1 s'` (ceil(2 / 4) = 1). After `tick(0.1)` x 6 (budget -2 + 2.4 = 0.4 > 0) the
   problem is null and the second `make` succeeds. Control: the same jars at distance 1 (near) allow two makes back to back
   with no problem.
5. **Servant waits, then eats, through a resting line**: servant + crank, Spring jar 4 tubes away; drive the line into debt
   with a desk make; servant idle text for <= 2 s of ticks, then `cranking`.
6. **Siphon via tube costs a grant**: a Cinder jar tubed to the furnace position with `setFire(5)`: one unit per second while
   the line has budget (stoked equals `CINDER_BURN_S / VIAL_UNITS` per unit); touching jar case unchanged (existing test).
7. **Conservation fuzz**: seed 1..20; random sequence of 200 actions among {desk make, infusion step, servant tick, place
   tube, mine tube, tick 0.1}; invariant: sum of all jar units + 4 x carried vials + infusion paid + aspect cost of items made
   = initial total.
8. **Motes are reported**: after a tubed take, `magic.tubeFlows().length` = 1, its `aspect` is the jar's, `path.length` = 5;
   after ticking 2 s with no takes it is 0.
9. **Sound**: a `bus.on('sfx')` collector sees `tube_flow` with `volume 0.3` at the consumer cell once per 0.5 s per network,
   never for near jars.
10. **`steady_tubes`** (`it.skipIf(!RESEARCH.some((e) => e.unlocks.flags?.includes('steady_tubes')))`): with the flag the
    infusion of case 3 pays <= 16 + 8 in 1 s and the desk of case 4 shows no problem on the second make.
11. **Aura view gating**: no research -> `auraView()` null with a rod held; `learn('aura_reading')` + hold `vis_rod` ->
    `mode 'held'`, aspects match `rodReading`-era values (stone floor gives `loam`); hold `glass` -> null;
    `aura_dial` case with `it.skipIf` like 10 -> `mode 'carried'` while the rod is only in the pack.
12. **Aura cache and tick**: `auraView()` twice returns the same object within 0.5 s; after a rod draw (`use(null)` with the
    rod) the drawn aspect's `left` drops by the rod's `draw`; `aura_tick` emitted once when the view first appears, not on the
    second call.
13. **Tube crosshair**: `tubeText` on a lone tube = `'Essentia Tube - no jar on this line'`; on the line of case 8 during the
    flow = `'Essentia Tube - carrying Vein, 4 units/s, 5 tubes'`; idle = `'Essentia Tube - idle, 5 tubes, 1 jar'`
    (singular `jar` for 1, `jars` otherwise); in debt = `'Essentia Tube - resting, ready in 1 s, 5 tubes'`.
14. **Save (T10)**: `toJSON()` keys after flow activity equal the keys of a fresh `toJSON()`; loading the existing full
    snapshot of `'saves and loads every part of the state'` still passes; a snapshot from before this unit (the same object)
    loads and every network starts at `cap`.
15. **Performance**: a 256-tube straight line, `jarReach` < 5 ms (measured with `performance.now()`, generous), and the memo
    returns the identical object for a second `deskRow` within the same tick.

### 9.4 `src/audio/sfx.test.ts`
- Existing count line keeps passing (MAGIC_SFX = 9 -> 72 + 9 = 81 before other units' terms).
- NEW: `it('Unit 19 magic sounds are short enough to repeat', ...)`: `patchDuration(SFX.tube_flow) <= TUBE_SOUND_S` (0.5)
  and `patchDuration(SFX.aura_tick) <= 0.3` and `patchDuration(SFX.golem_step) <= 0.5` (a golem steps every 0.5 s).

### 9.5 Others
- `src/magic/magic.test.ts` / `fingerprint.test.ts` unchanged. `content.test.ts`, `gates.test.ts` must stay green (no content).
- `src/ui/hud`: the DOM is thin; the logic lives in `auraText.ts` (tested). No jsdom test required.

---------------------------------------------------------------------------------------------------------------------------

## 10. E2E steps (`scripts/e2e-magic.mjs`, after `'a clay servant fed Spring turns a hand crank'`)

Run: `node scripts/e2e-magic.mjs --device=desktop` (no `HW_GPU`), then `--device=phonePortrait` (UI change, SYSTEMS 6c).
Use the existing helpers: `step`, `M` (`d.hw`), `d.selectItem`, `d.use`, `d.settle`, `d.shot`, `window.__hw.setVoxel`,
`teleport`, `lookAt`, `give`, `tick(n)` (n fixed ticks of `DT` = 1/20 s). Research is already all done by the
`'set-up: every research done, a clear yard'` step.

1. **`step('the aura dial shows the land while a rod is held', ...)`**
   - Setup: `M(() => window.__hw.give('vis_rod', 1))`; teleport to the yard centre `P.yard` on the stone floor.
   - Real input: `await d.selectItem('vis_rod'); await d.settle(400);`
   - Assert: `page.locator('.hw-aura')` is visible; on desktop
     `(await page.textContent('.hw-aura__chips')).trim()` matches `/^(Land drained|[a-z]+ \d+(  [a-z]+ \d+){0,2})$/` and the
     yard's stone gives `loam` (assert `/loam \d+/`); on phonePortrait assert `.hw-aura__chips` is hidden
     (`isHidden`) and `.hw-aura__top` text matches `/^\d*$/`.
   - Assert the crosshair no longer shows the reading: aim at the floor (`lookAt` the cell under the player) and check the
     crosshair label text equals the block name (`Stone`) - read via `window.__hw.state().target` / `.hw-crosshair` text.
   - Assert the plate does not overlap the hotbar: bounding boxes of `.hw-aura` and `.hw-hotbar` do not intersect, and
     `.hw-aura` right edge <= viewport width.
   - `await d.shot('11-aura-dial')`.
   - Real input: `await d.selectItem('glass_vial')` (or any non-rod item given in setup) -> `.hw-aura` hidden within 500 ms.
2. **`step('a rod draw lowers the dial at once', ...)`**: select the rod again, read the top number, `d.use()` at the sky
   (`lookAt` up) once, settle 300 ms, assert the top number decreased or the text became `Land drained`.
3. **`step('tubes carry essentia to the altar with visible motes', ...)`**
   - Setup (via `M`): altar at `A = { x: P.yard.x + 2, y: P.gy, z: P.yard.z + 3 }`; pedestals at `(A.x + 2, A.y, A.z)` and
     `(A.x - 2, A.y, A.z)` as in the existing infusion step; six tubes at `(A.x, A.y, A.z + 1)` .. `(A.x, A.y, A.z + 6)`; three
     jars touching the far end, all more than 4 blocks from the altar: `(A.x, A.y, A.z + 7)`, `(A.x + 1, A.y, A.z + 6)`,
     `(A.x - 1, A.y, A.z + 6)`, filled with `hw.app.game.magic.setJar(...)` (vein 8, mind 8, clarity 8); `glass` on the altar
     and a `copper_ingot` on each pedestal (as the existing step does it). Clear the yard cells first (the set-up step did).
   - Real input: hold the rod (`d.selectItem('bronze_rod')`), `lookAt` the altar, `d.use()`.
   - Assert: `infusionAt` non-null; after `tick(20)` (1 s) paid units (`progress x 14`, or read `infusion.paid` sum) <= 12.
   - Stand 4 blocks off, look at the tube line, `settle(600)`: `window.__hw.app.game.magicRenderer.stats.motes > 0`.
   - Crosshair on a tube reads `/^Essentia Tube - carrying (Vein|Mind|Clarity), 4 units\/s, 6 tubes$/`.
   - `await d.shot('12-tube-motes')`; then `tick(600)` and assert `altarText` = `Infusion Altar - Scrying Lens`.
4. Existing `'no page errors'` stays last.

---------------------------------------------------------------------------------------------------------------------------
## 11. Docs to update (same PR)

- `docs/api/magic.md`:
  - Data: `essentiaNet.ts` line gains `jarReach` (near vs tubed, networks with ids and paths), `netOfTube`; new lines for
    `tubeFlow.ts` (`TUBE_UPS` 4, `TUBE_BURST_S` 2, budgets with debt, merge = min, `steady_tubes` x2) and `auraText.ts`.
  - Runtime: `auraView()` (gate `aura_reading` held / `aura_dial` carried, 0.5 s cache), `tubeFlows()`, `tubeText()`; the
    desk refusal `The tubes are still carrying - ready in N s`; consumers pay near jars instantly and tubed jars from the
    network budget.
  - Sounds list gains `tube_flow`, `aura_tick`, `golem_step`, with the volume tiers.
  - UI and render: the aura dial (`src/ui/hud/auraDial.ts`), motes in `MagicRenderer` (`stats.motes`).
  - Known limits: remove "an aura HUD dial" from "Not built"; replace "Tubes are glass blocks with their own small network"
    with "...own network, 4 units/s each (8 with Steady Tubes); budgets are not saved".
- `docs/api/hud.md`: the top-right cluster order is now aura dial, compass, day dial, power; the dial's three layouts.
- `docs/api/audio.md`: nothing structural (sounds are listed per feature in `magic.md`).
- Never edit `docs/WHATS_LEFT.md` or `docs/build/SYSTEMS.md` (the coordinator does).

---------------------------------------------------------------------------------------------------------------------------

## 12. Acceptance checklist

- [ ] With `aura_reading` done and a rod held, `.hw-aura` shows ring + `cinder 6  loam 4  gale 2`-style chips (desktop) within
      0.125 s; hidden with any other item; hidden without the research.
- [ ] With `aura_dial` (Unit 18) the dial shows while a rod is only carried, ring at 70% opacity.
- [ ] The crosshair names blocks while a rod is held (no reading text in the crosshair any more).
- [ ] The pip points at the nearest wellspring and turns with the view; `here` within 3 blocks.
- [ ] Portrait 390 x 844: ring only, 44 px, no overlap with hotbar, goal tracker or touch reserve. Landscape 844 x 390: ring +
      number chips, one row.
- [ ] `auraView()` scans the land at most every 0.5 s plus once per rod draw.
- [ ] A tube-only consumer receives at most `8 + 4 t` units in `t` seconds (`16 + 8 t` with `steady_tubes`); near jars are
      instant; units are conserved (fuzz test).
- [ ] Desk on a resting line shows `The tubes are still carrying - ready in N s` and recovers by itself.
- [ ] Merging lines never refreshes a budget (min rule); splitting never doubles it.
- [ ] Motes in the aspect colour run jar -> consumer along the tubes, <= 8 per flow, <= 96 total, one draw call, no per-frame
      allocation; they fade after 1.5 s.
- [ ] `Essentia Tube - ...` crosshair lines exactly as 5.3.
- [ ] `tube_flow` (0.3, <= 2/s per network), `aura_tick` (0.3), `golem_step` (0.6) exist in `MAGIC_SFX` and `SfxName`;
      existing magic sounds carry their tier volume; `npm test` green including `sfx.test.ts` count.
- [ ] `MagicSnapshot` unchanged; old saves load.
- [ ] `node scripts/e2e-magic.mjs --device=desktop` and `--device=phonePortrait` green, screenshots `11-aura-dial`,
      `12-tube-motes` saved in `test-results/e2e-magic/`.
- [ ] `content.test.ts` and `gates.test.ts` green (magic still optional).
- [ ] `docs/api/magic.md` and `docs/api/hud.md` updated.

---------------------------------------------------------------------------------------------------------------------------

## 13. Out of scope

- Defining research entries or their boards (`steady_tubes`, `aura_dial`, `late_draw`, `essence_ward`, `golem_walk`): Unit 18.
- Golem behaviour and when to step: Unit 17 (this unit only ships the `golem_step` patch).
- Joining tubes to the fluid pipe machinery, per-aspect tube filters, tube valves, one-way tubes.
- Saving tube budgets; showing budgets anywhere but the tube crosshair line and the desk refusal.
- A tap/expand interaction on the dial (it is display-only); a settings toggle for the dial.
- Lighting or bloom on motes and crystals; wellspring visuals (unchanged).
- Rebalancing aspects, fingerprints (`AGE_BONUS_PER_AGE`), rods, foci or recipe costs (balance table says unchanged and why).
- Changing `DESK_REACH` / `ALTAR_REACH` (see 14, question 1).

---------------------------------------------------------------------------------------------------------------------------

## 14. Notes for the coordinator

1. **"Instant for jars directly touching the consumer" (SYSTEMS 5.2) is read as "jars within the consumer's existing reach
   radius"**: touching for servants, siphon and golems; 3 for the desk (`DESK_REACH`), 4 for the altar (`ALTAR_REACH + 1`).
   Making desk-reach jars slow would silently nerf every existing base. If the owner wants the literal "touching only",
   change one argument in `Magic.take` (pass radius 1 for the instant part) and note it in 5.2.
2. **Flag names**: reads `steady_tubes` exactly as Unit 18 defines it (Forge-age research entry, 8 units/s). Reads
   `aura_dial` and interprets it as "the dial stays while a rod is carried"; the dial itself is unlocked by the existing
   `aura_reading`, as SYSTEMS T7 says. Unit 18's entry text should say so (suggested text in 2.1). If Unit 18 did not define
   `aura_dial`, the carried mode is simply never active. Does not read `essence_ward` (Unit 10's concern).
3. **`sfx.test.ts` count line is a shared merge point**: this unit does not change the expression; the three new patches are
   counted by the existing `Object.keys(MAGIC_SFX).length` term. Merge rule: keep one `MAGIC` term whatever shape the line
   takes after Units 12/13/14/16 (`72 + MAGIC + DISTILL + WORKSHOP`).
4. **`SfxName` merge**: append `tube_flow`, `aura_tick`, `golem_step` after `cast`; Unit 17 must not add `golem_step` twice.
5. **Golem feeding** (Unit 17) must go through `Magic`'s take path so it obeys tube budgets; please check this at Unit 17 review.
6. **Crosshair change**: removing `rodReading()` from `Game.magicLabel` changes what e2e or other units may expect when aiming
   with a rod; the only current consumer is the magic e2e `'a wellspring floats near by and a held rod reads it'`, which asserts
   only `magicRenderer.stats.nodes` and is unaffected.
7. `MagicRenderer.update` gains an optional 6th parameter; no other unit calls it.
8. SYSTEMS.md T4 needs no row (no new item). SYSTEMS 5.2 could add `TUBE_BURST_S` 2 (cap 8 / 16) next to `TUBE_UPS`.
