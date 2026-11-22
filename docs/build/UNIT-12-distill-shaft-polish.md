# Unit 12 - Distill shaft hooks and polish

Status: build spec, written 2026-11-22 against `docs/build/SYSTEMS.md` (binding), `docs/build/UNIT-00-foundations.md` (reaction
engine, side goals), `docs/build/UNIT-06-rig-screen.md` (rig screen, ghost chime) and `docs/build/UNIT-08-vacuum-lubricant.md` (the
sibling shaft consumer, `vacuum_pump`). Wave 1, after Unit 0 merges.

**Threads:** T2 (defines `chem_stirrer`, `STIR_MIN_RPM`, `BASE_STRESS.chem_stirrer`, `Workshop.stirredAt`; wires
`Distillery.stirredAt`), T7 (defines event `distill:step`, side goal `run_spirit`, flag `distilled_spirit`, the distillery
branches of `scripts/codex/progression.json`), T9 (defines `src/audio/sfxDistill.ts` with five sounds and feeds the existing
`boil` ambience layer), plus T8 (goggles lines for the stirrer, `, stirred` on chem lines), T10 (one optional saved field
`ChemEntity.charge`), T4 (one new part, an end product: no new intermediate).

Shared ids this unit DEFINES (SYSTEMS 6.2 row "12"): `chem_stirrer` workshop part, `Workshop.stirredAt(x, y, z)`, the
`Distillery.stirredAt` wiring in Game, the `'distill:step'` game event, `src/audio/sfxDistill.ts` (`DISTILL_SFX`), the distillery
Codex branches. Consumed by: 6 (screen prints "stirred" from `capabilitiesOf`; may swap its ghost chime to `glass_chime`), 9 / 10 /
11 (reactions may list `speedUps: { stirred: 2 }` or `needs: ['stirred']`; their side goals may listen to `distill:step`).

Shared ids this unit READS: Unit 0's `Capability`, `ReactionSpec.speedUps`, `REACTIONS` / `rx_ferment_wash`,
`Distillery.stirredAt` (null by default), `Distillery.capabilitiesOf`, `ChemEntity.lastRx`, `SIDE_OBJECTIVES`,
`ObjectiveTracker.side()`, `'objective:side'`; Unit 8's `vacuum_pump` (same networks, same goggles grammar) and rig legend letters
`U X M`; existing `BASE_STRESS`, `LUBE`, `solveNetwork`, `Workshop.describe`, `PROCESS_CARDS`, `RIG_LEGEND`, `AmbienceProbe`,
`buildBoil`.

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

The glass distillery has been a quiet, hand-poured world: you pour, you set a temperature, you wait for the green lamp. The
Bronze workshop next door has shafts that turn mills, mixers and drills. This unit lets the two touch, and then makes the
distillery feel finished.

What the player gets:

1. **The Chem Stirrer.** A bronze gearbox with a glass-rod paddle. Set it against a Reaction Vessel (or a Boiling Flask), drive
   it from any shaft at 16 rpm or more - a hand crank, a clockwork motor, a water wheel, the treadwheel - and the vessel is
   **stirred**: every reaction that lists `stirred` as a speed-up runs twice as fast, and reactions that need stirring run at
   all. On day one of this unit the only reaction is fermenting, and it gains `speedUps: { stirred: 2 }`: a stirred wash is
   ready in about 55 s instead of 110 s. Later units' elixirs and asphalt use the same capability with no new code. The stirrer
   is a workshop part on a workshop network: overload it and it stops, oil the network and it carries more (the one `LUBE`
   rule, T2).
2. **A distillery that announces itself in one event.** Every state change of a flask, vessel or receiver emits
   `distill:step { x, y, z, kind, from, state, process?, reaction?, litres }`. The run knows what it was: a flask charged with Low
   Wines that finishes is a `distil_spirit` run. Objectives listen to this, not to toasts.
3. **The side goal "Run your first spirit".** The first time a `distil_spirit` run finishes, the Hearth Log ticks it, the toast
   says `Side goal: Run your first spirit` and four glass beakers come back as the reward.
4. **Sounds of its own.** A flask coming to the boil gives one fat glassy *blurp* (`still_bubble`) and then the soft bubbling bed
   (the existing boil ambience layer, until now never fed) swells with the number of boiling flasks near you and fades as you
   walk away. Liquid arriving in a receiver drips (`still_drip`, a heavier, ringing drop than the tea cup's). A finished run rings
   two struck glass notes (`glass_chime`) instead of the generic machine bell. A blocked module gives a muffled glass-and-copper
   thunk (`distill_clunk`) instead of the wrench's `pipe_clunk`. A stirrer that starts stirring sloshes once (`stirrer_slosh`).
5. **The Codex knows the distillery.** Four progression branches (Ember pot stills, Bronze shaft chemistry, Forge columns and
   oil, Current refinery) and a "Distillery" section in the crafting map listing every process card with its setting and time.
6. **A written balance pass.** Every process card was measured against the real simulation (numbers in 4.7). Two promised times
   were half what the rig takes, one card under-promised by half. The cards now say what the rigs make.

The fantasy in one line: *you hear the still before you see it - the bubbling grows as you come down the stairs, a drip rings
in the receiver, the paddle turns in the green-lit vessel, and a glass chime tells you the spirit is done.*

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 Threads

| thread | what this unit does | ids / constants / hooks |
|---|---|---|
| T2 rotation | adds the second distillery shaft consumer; no second capacity multiplier, no new solver logic | `chem_stirrer` (PART_DEFS), `BASE_STRESS.chem_stirrer = 4`, `STIR_MIN_RPM = 16` (NEW, `src/workshop/chemParts.ts`, re-exported by `workshop.ts`), `Workshop.stirredAt(x, y, z): boolean` (NEW), Game wires `sim.distill.stirredAt` |
| T7 knowledge | the event objectives listen to, the side goal, the Codex branch | `'distill:step'` (NEW, `gameEvents.ts`), `DISTILL_SIDE_GOALS` (NEW, `src/content/objectivesDistill.ts`), `FLAG_DISTILLED_SPIRIT = 'distilled_spirit'` (NEW, `core/constants.ts`), `progression.json` branches |
| T8 reading | stirrer goggles lines in the exact grammar Unit 8 uses for the pump; vessel/flask lines end `, stirred` | `stirFact()` (NEW, `src/workshop/chemParts.ts`) |
| T9 sound | `sfxDistill.ts`, five names, the boil ambience fed from boiling flasks | `DISTILL_SFX`, `still_bubble`, `still_drip`, `glass_chime`, `distill_clunk`, `stirrer_slosh`; `BOIL_HEARING`, `BOIL_WEIGHT` (NEW, `src/app/ambience.ts`); `DRIP_EVERY_S`, `DRIPS_PER_S` (NEW, `src/core/distill.ts`); `RUN_FLAGS` (NEW, `src/sim/distillRuns.ts`) |
| T10 saving | one optional entity field, sanitised | `ChemEntity.charge?: string` |
| T4 material web | `chem_stirrer` is a workshop part (end product of the build tree); it uses existing bronze, cog, shaft, glass | - |

### 2.2 What other units can rely on after this merges

- `Distillery.stirredAt` is set by Game to `(x, y, z) => workshop.stirredAt(x, y, z)`. Any reaction (Unit 0 table) with
  `speedUps: { stirred: k }` runs `k` times as fast in a stirred vessel; with `needs: [..., 'stirred']` it runs only there.
  Unit 0's problem phrase `needs stirring (a Chem Stirrer at 16 rpm)` is now true to the game.
- `'distill:step'` fires on every state change of a `boiling_flask`, `reaction_vessel` or `receiver` (the STATEFUL kinds) with
  the payload of 4.3. A side goal of another unit listens with a flag the Distillery sets, or with its own listener on the bus;
  it never parses toasts.
- Rig legend letter `S` = `chem_stirrer` (NEW). `distillKit.buildRig` places it as a plain block and stubs `stirredAt` to "a
  `chem_stirrer` block is a neighbour" (no workshop in the kit), exactly as Unit 8 stubs `vacuumAt` for `M`.
- `glass_chime` exists; Unit 6 may switch its ghost-complete call in `rigGhost.ts` from `machine_done` pitch 1.4 to
  `glass_chime` volume 0.6 (one line). If Unit 6 is already merged when Unit 12 lands, Unit 12 makes that one-line swap itself.

### 2.3 What this unit relies on (merge order)

| needs | from | if missing at build time |
|---|---|---|
| `Capability`, `ReactionSpec.speedUps`, `REACTIONS` with `rx_ferment_wash`, `Distillery.stirredAt`, `capabilitiesOf`, `lastRx` | Unit 0 | Unit 12 waits: Wave 1 starts after Unit 0 (SYSTEMS 6.3) |
| `SIDE_OBJECTIVES`, `ObjectiveTracker.side()`, `'objective:side'`, toast `Side goal: <title>` | Unit 0 | same |
| `vacuum_pump`, legend `U X M` | Unit 8 | not needed; the Codex branch lists `vacuum_pump`/`vacuum_cap`/`filter_bed` by key and they show as "planned" tags until 8 lands (README rule) |
| `sfxWorkshop.ts`, other units' sfx sets | 5, 8, 13, 14, 16, 19 | the `sfx.test.ts` count is a sum of `Object.keys(SET).length` terms; each unit adds its own term (see 9.4) |

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code (what exists, quoted)

### 3.1 Distillery (`src/sim/distill.ts`, 460 lines)

- `ChemEntity extends BlockEntity { kind; mix; state: ChemState; setC?; ran?; recvS?; flow?; band?; tempC? }`. Entities are world
  entities (`world.setEntity`), so `world.entities()` iterates them; kind = module kind.
- `Distillery.stepRig` -> `stepStill` (boils; sets `flask.ran = true; flask.state = 'working'`; draws
  `f.extractW += (moved / dt) * BOIL_J_PER_L`) -> `stepVessel(v, sealed, dt)` (fermenting; Unit 0 replaces it with the reaction
  table) -> `flow` -> `show(rig, arrived, was, dt)`.
- `show` computes each module's state and calls `announce(e, before)` on change. Today `announce`:
  ```ts
  if (e.state === 'done' && before === 'working' && (e.kind === CHEM.flask || e.kind === CHEM.vessel)) {
    this.bus.emit('sfx', { name: 'machine_done', ...at, pitch: 1.4 });
    const what = e.kind === CHEM.flask ? 'Distilling run finished' : `Fermenting done: ${nameOfFluid(nameOf(e.mix))}`;
    this.bus.emit('toast', { text: what, kind: 'good' });
    this.host.flagOnce(e.kind === CHEM.flask ? 'distilled' : 'fermented');
  } else if (e.state === 'blocked' && before !== 'blocked') {
    this.bus.emit('sfx', { name: 'pipe_clunk', ...at });
  }
  ```
  (Unit 0 generalises the vessel toast via `lastRx`; its toasts and flags stay.)
- No event names the process: a run does not know which card it is. `DISTILLERY_PLAN.md` 2.1 asked for
  `distill:step { x, y, z, state, process? }`; plan 15 lists it as left ("no `distill:step` event yet (sfx + toast + flags
  instead)").
- Receivers: `e.state = t <= 1e-6 ? 'idle' : e.recvS! < RECEIVE_HOLD_S ? 'working' : ...` - "working" while liquid arrived within
  `RECEIVE_HOLD_S` 2 s. There is no drip sound (the renderer `distillFx.ts` draws drips).

### 3.2 Workshop (`src/workshop/workshop.ts`, `kinetics.ts`)

- `BASE_STRESS` (kinetics.ts): `mixer: 6, mech_pump: 4, vacuum_collector: 3, ...`; cost per part
  `base * Math.max(0.25, Math.min(4, 16 / Math.abs(r)))`.
- `KINETIC` = every `PART_DEFS` key not in `NON_KINETIC` (+ cranks, shafts, generators). A new `PART_DEFS` row joins networks.
- `speed: Map<string, number>` holds signed rpm only for turning, unjammed, not overstressed networks (`solve()`:
  `if (!overstressed && r !== undefined && r !== 0) this.speed.set(key, r)`).
- `describe(x, y, z)`: `"<Name> - still"`, `"<Name> - overstressed 12/8 su"`,
  ``"<Name> - right 16 rpm, load 4/8 su[, oiled]"``, `"jammed: the gears fight each other"`.
- `LUBE = { residue: { factor: 1.25, s: 600 }, pine_resin: { factor: 1.1, s: 300 } }` (Unit 8 adds `lubricant`).
- Hooks set by Game (`src/app/game.ts` 160-185): `generatorWatts`, `standingOn`, `tractors`, `fluidBlock`, `clockText`,
  `actHook`. Game holds `this.workshop` and `this.state.sim`.

### 3.3 Audio

- `src/audio/sfx.ts`: `SFX = { ...WORLD_SFX, ...HEARTH_SFX, ...CUE_SFX, ...FARM_SFX, ...WEATHER_SFX, ...TRANSPORT_SFX,
  ...EMBER_SFX, ...BREW_SFX, ...HAND_SFX, ...VEHICLE_SFX, ...MAGIC_SFX }`.
- `src/audio/sfx.test.ts`: `expect(SFX_NAMES.length).toBe(72 + Object.keys(MAGIC_SFX).length);` (78 names today); plus duration
  bounds (`under([...], s)`), "every envelope starts and ends silent", jitter list, `layer.gain <= 1`, UI set exactly
  `['error', 'ui_click', 'ui_close', 'ui_open']`.
- `src/audio/sfxBrew.ts`: `boil_bubble`, `pour`, **`drip`** (one drop into the cup), `sip`. **The name `drip` is taken.** SYSTEMS
  T9 lists "`drip` on a receiver filling" for `sfxDistill.ts`; adding a second `drip` key is impossible (one `Record<SfxName,
  Patch>`). This unit names the distillery drop `still_drip` (T9 rule 1: `<thing>_<sound>`). Coordinator note 14.1.
- `src/audio/ambienceBoil.ts` `buildBoil(rig)`: pink-noise simmer + two band-passed crackle "bloop" beds;
  `apply: (t, now) => level.to(t.boil * 0.22, now)` (loop peak 0.22 - inside T9's "loops never above 0.6").
- `AmbienceState.boil` ("Boiling water near the listener (brewing), 0..1") exists, `computeTargets` maps it
  (`out.boil = s.underwater ? 0 : unit(s.boil)`), but **nothing ever sets it**: `src/app/ambience.ts AmbienceProbe.scan()` fills
  furnace, machine hum, wind, shelter - not `boil`. The layer is silent in the shipped game.
- `AmbienceProbe.scan()` counts every non-crate world entity whose voxel is ACTIVE and `on !== false` within
  `MACHINE_HEARING` 14 as machine hum (`MACHINE_WEIGHT` 0.35). **Working chem modules are world entities with the active bit,
  so a still today hums like a dynamo.** This unit excludes chem kinds from the hum (they have their own voice now).

### 3.4 Objectives and Codex

- `src/content/objectivesBrew.ts` `BREW_OBJECTIVES` is the pattern for a feature file (`{ id, title, age, condition: { type:
  'flag', flag }, reward: amounts('...'), text }`). No objective uses the `distilled` / `fermented` flags.
- After Unit 0: `src/content/objectivesSide.ts` `SIDE_OBJECTIVES` concatenates `<FEATURE>_SIDE_GOALS`.
- `scripts/codex/progression.json`: `{ ages: [{ name, furnace, head, line, branches: [{ name, items, planned?, note? }] }] }`.
  There is no distillery branch; the Current Age has `"Oil": ["still", "fuel_canister"]` (the old oil-shale `still` machine).
- `scripts/codex/page.html` crafting map sections: hand, workbench, furnace tiers, and `MACHINE_NAMES = { crusher, still,
  centrifuge, electrolyzer }`. **Process cards (stations `boiling_flask`, `reaction_vessel`, `column_segment`) appear in no
  section today**, although `docs/api/distillery.md` says "the Codex lists them through `RECIPES` with no script change".

### 3.5 Process cards (`src/content/recipesDistill.ts`)

`card(id, station, inputs, output, byproducts, setC, timeS, age, rig)`. Seven cards (quoted in 4.7). `RIG_LEGEND` has
`B F V | C R T J A P` (+ Unit 8 `U X M`). `src/sim/distillProcess.test.ts` builds each rig and checks it makes at least the card's
outputs. `src/content/specRosterDistill.ts` repeats each card as a line like
`'distil_spirit: 1 spirit_beaker <- 8 low_wines_beaker 60s 0J'`.

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 The Chem Stirrer (`chem_stirrer`)

| field | value |
|---|---|
| key | `chem_stirrer` |
| name | Chem Stirrer |
| kind | workshop part: one `PART_DEFS` row, `anim: true` (front `ws_chem_stirrer_front` / `ws_chem_stirrer_front_on`), kinetic (NOT in `NON_KINETIC`) |
| age | Bronze (`PART_BLOCKS` sets `age: BRONZE = ageIndexOf('bronze')`) |
| recipe | `forge('chem_stirrer', '1 bronze_ingot, 1 bronze_cog, 1 drive_shaft, 1 glass', 600)` in `WORKSHOP_RECIPES` (Clay Furnace, tier 1, 600 C; W0 comment not needed - the helper already writes `minTier: 1, age: 0`) |
| stack | 16 (PART_BLOCKS) |
| stress | `BASE_STRESS.chem_stirrer = 4` -> 4 su at 16 rpm, 2.67 su at 24 rpm, 1 su at 64 rpm, 16 su at 4 rpm (the general rule) |
| works at | `abs(rpm) >= STIR_MIN_RPM` = 16; either direction |
| desc | `A geared paddle on a glass rod. Set it against a Reaction Vessel or Boiling Flask and turn it at 16 rpm or more: the vessel is stirred, and stirred reactions run twice as fast.` |

Why these numbers (SYSTEMS 5.3 "Bronze parts: 1-4 bronze ingots or cogs, planks, a belt or cloth"): one ingot + one cog + a shaft
is the mixer's cost minus an ingot (it is a lighter machine), and the glass is the rod that goes into the liquid - a distillery
part should cost a little glass. Stress 4 = the vacuum pump and the mechanical pump: one hand crank (8 su) runs a stirrer
**and** a vacuum pump together at 16 rpm (4 + 4 = 8), which is exactly the J2 potion rig (vacuum + stirred). That pairing is
the reason the two consumers share a number.

Which vessel it stirs (adjacency rule, normative):

- The stirrer stirs every `reaction_vessel` and every `boiling_flask` in its **six neighbour cells** (both plain and `_done`
  twins - `chemKindOf` strips the suffix). Normally the player sets it beside the vessel, because the top of a vessel is where the
  airlock cap or the condenser goes and the bottom is the still base. Facing does not matter.
- One stirrer may stir two vessels it touches (between two vessels). The load does not change: stirring is not divided.
- Chem modules are not workshop parts: rotation does not pass through a vessel into another stirrer. The stirrer is the end of
  the line on that side.
- A `column_segment`, `receiver`, `condenser_coil`, tube, jacket or cap next to a stirrer is ignored (nothing to stir).

### 4.2 `Workshop.stirredAt` and the stirred capability

```ts
// src/workshop/chemParts.ts (NEW): export const STIR_MIN_RPM = 16;  // the slowest a Chem Stirrer may turn and still stir
// src/workshop/workshop.ts: export { STIR_MIN_RPM } from './chemParts';  (one constant, no import cycle)

/** True when a Chem Stirrer touching the cell x, y, z turns at STIR_MIN_RPM or more (the Distillery asks for its vessels). */
stirredAt(x: number, y: number, z: number): boolean {
  for (const [dx, dy, dz] of DIRS) {
    const key = k3(x + dx, y + dy, z + dz);
    if (this.parts.get(key)?.kind === 'chem_stirrer' && Math.abs(this.speed.get(key) ?? 0) >= STIR_MIN_RPM) return true;
  }
  return false;
}
```

- `speed` holds nothing for overstressed or jammed networks, so overload and jams un-stir by themselves (no special case).
- Game (`src/app/game.ts`, right after `this.workshop.clockText = ...`):
  `this.state.sim.distill.stirredAt = (x, y, z) => this.workshop.stirredAt(x, y, z);`
- Unit 0's `capsOf` already reads `stirredAt?.(m.x, m.y, m.z) === true` for the `stirred` capability. Unit 12 adds no capability
  code in the Distillery beyond the slosh edge (4.5) and the `, stirred` text (6.2).
- One frame of lag (the Distillery reads last tick's workshop speeds) is invisible at 4 Hz.

What stirring DOES (the only effect, through Unit 0's engine, no new multiplier - SYSTEMS 6d):

| module | effect of `stirred` |
|---|---|
| `reaction_vessel` | every running reaction's speed is multiplied by its `speedUps.stirred` (Unit 0 `rateOf`); reactions with `needs: ['stirred']` become runnable |
| `boiling_flask` | the capability is reported (rig screen, crosshair) so future flask reactions (Unit 11's `steel_flask` if it gains slots) can use it; boiling itself is NOT changed (boil rate is `BOIL_LPS` physics; a second boil multiplier would be an anti-pattern) |

Data change in Unit 0's table (one field, owned here because the stirrer is the reason):

```ts
// src/content/reactionsDistill.ts, row rx_ferment_wash
speedUps: { stirred: 2 },
```

So a stirred, sealed vessel of syrup and water ferments at 2 x 1.5 L/s of sugars: the `ferment_wash` charge (1250 L) is done in
about 55 s instead of 110 s. Unstirred it is unchanged to the second (Unit 0's guarantee holds).

Rig legend and a second fermenting card (teaches the stirrer in the Codex, the rig screen and Unit 6's ghosts):

```ts
// src/content/recipesDistill.ts
RIG_LEGEND: ... S: 'chem_stirrer',
card('ferment_wash_stirred', 'reaction_vessel', '1 syrup_beaker, 1 water_pail, 4 glass_beaker', '5 wash_beaker', '1 pail', 20, 60,
  ageIndexOf('bronze'), 'A./VS'),   // vessel at x0 with the airlock on it, the stirrer beside at x1
```

(`recipesDistill.ts` gains `import { ageIndexOf } from '../magic/ageMap';` - it has no import of it today. The progression solver then wants a `chem_stirrer` owned for this card only; the plain `ferment_wash` card still opens wash in
Ember, so the spine is untouched - T7.) The rig string has no crank letter; the card's Codex note and the stirrer's desc say it
must turn at 16 rpm.

### 4.3 The `distill:step` event

```ts
// src/core/gameEvents.ts, appended to GameEvents under a new "glass distillery" heading
/**
 * A flask, vessel or receiver changed state (docs/api/distillery.md): x,y,z = the module. `process` is the process card id the
 * run matches (flasks, from what the flask held when it started boiling), `reaction` the reaction key that ran last (vessels,
 * Unit 0's lastRx). `litres` = what the module holds now. Objectives listen to this, never to toasts.
 */
'distill:step': {
  x: number; y: number; z: number;
  kind: 'boiling_flask' | 'reaction_vessel' | 'receiver';
  from: 'idle' | 'working' | 'done' | 'blocked';
  state: 'idle' | 'working' | 'done' | 'blocked';
  process?: string;
  reaction?: string;
  litres: number;
};
```

(Literal unions instead of importing `ChemKind`/`ChemState` keep `gameEvents.ts` free of a `core/distill` import; the values are
identical. If `core/types` already re-exports `ChemState`, use it.)

Emission rules (normative):

1. Emitted from `Distillery.announce(e, before)` - which `show` already calls exactly once per state change - for kinds in
   `STATEFUL` (`boiling_flask`, `reaction_vessel`, `receiver`). Other kinds change state silently as today.
2. Emitted BEFORE the toast/flag/sfx of that change, so a listener sees the event first.
3. `process`: only for `boiling_flask`, only when `state` is `working`, `done` or `blocked` and the flask has a `charge` (4.4).
   `reaction`: only for `reaction_vessel`, `= e.lastRx` when set.
4. No event on load (`track`) and no event when a module is placed or broken (that is `block:changed`).
5. Frequency: a receiver toggles `working`/`idle` at most every `RECEIVE_HOLD_S` 2 s; bus events are cheap; no throttle.

### 4.4 Knowing what a run was: `charge` and `processFor`

`ChemEntity` gains (T10, optional, saved):

```ts
/** Flask: the named fluid it held when this run started boiling (nameOf at the first working step); cleared when it empties. */
charge?: string;
```

- Set in `stepStill` at the line `flask.ran = true;`: `if (!flask.ran) flask.charge = nameOf(flask.mix);` - i.e. once, the first
  step the flask boils after being empty. Topping up a running flask does not change it.
- Cleared where `ran` is cleared (`if (total(flask.mix) <= 0) flask.ran = false;` gains `flask.charge = undefined;` - use
  `delete flask.charge` so it leaves the save).
- Pure helper, NEW file `src/sim/distillRuns.ts`:

```ts
import { CHEM_CONTAINERS } from '../core/distill';
import { PROCESS_CARDS, type ProcessCard } from '../content/recipesDistill';

/** Column segments a card's rig stands with ('|' cells). */
export const segmentsOf = (card: ProcessCard): number => [...card.rig].filter((ch) => ch === '|').length;

/**
 * The process card a finished still run matches: a card whose first input pours `charge`, at a still (not a vessel); a card of
 * the matching station (column when the still has segments) wins, then the one whose rig's segment count is nearest; then list order.
 */
export function processFor(charge: string | undefined, segments: number, cards: readonly ProcessCard[] = PROCESS_CARDS): string | undefined {
  if (!charge) return undefined;
  const station = segments > 0 ? 'column_segment' : 'boiling_flask';
  const pours = cards.filter((c) => c.station !== 'reaction_vessel' && CHEM_CONTAINERS[c.inputs[0]?.item ?? '']?.fluid === charge);
  if (!pours.length) return undefined;
  const score = (c: ProcessCard): number => (c.station === station ? 0 : 100) + Math.abs(segmentsOf(c) - segments);
  return pours.reduce((best, c) => (score(c) < score(best) ? c : best)).id;
}
```

Resulting table (asserted in tests, 9.1):

| charge | segments | process |
|---|---|---|
| `sap` | 0 | `distil_syrup` |
| `sugar_wash` | 0 | `distil_low_wines` |
| `low_wines` | 0 | `distil_spirit` |
| `low_wines` | 2 | `distil_spirit` (no column card pours low wines; a column still counts as a spirit run) |
| `spirit` | 2 | `rectify_spirit` |
| `spirit` | 0 | `rectify_spirit` (only card that pours spirit) |
| `crude_oil` | 3 | `refine_crude` |
| `crude_oil` | 2 | `refine_crude_short` |
| `slop` / `water` / unknown | any | `undefined` (event still fires, no process) |

The still's segment count comes from the rig at announce time: `this.rigAt(e.x, e.y, e.z)?.stills.find((s) => s.flask ===
posKey(e.x, e.y, e.z))?.segments.length ?? 0`.

Later units whose cards pour a new charge (Unit 8 `vacuum_residue` pours `residue`; Unit 11's cracker pours `diesel`) are matched
by the same rule with no edit here.

### 4.5 Side goal `run_spirit`

```ts
// src/content/objectivesDistill.ts (NEW)
/** Side goals of the glass distillery (SYSTEMS T7). The flag is set by src/sim/distill.ts when a distil_spirit run finishes. */
import { FLAG_DISTILLED_SPIRIT } from '../core/constants';
import type { ObjectiveSpec } from '../core/types';
import { amounts } from './amounts';

export const DISTILL_SIDE_GOALS: ObjectiveSpec[] = [
  {
    id: 'run_spirit', title: 'Run your first spirit', age: 0, condition: { type: 'flag', flag: FLAG_DISTILLED_SPIRIT },
    reward: amounts('4 glass_beaker'),
    text: 'Pour Low Wines into a Boiling Flask on a Still Base, set the base to 92 C and let it boil. Clear Spirit drips into the Receiver.',
  },
];
```

- `src/core/constants.ts`: `export const FLAG_DISTILLED_SPIRIT = 'distilled_spirit';` (past tense, SYSTEMS 4).
- `src/content/objectivesSide.ts`: `...DISTILL_SIDE_GOALS` appended to `SIDE_OBJECTIVES`.
- Distillery: when `announce` handles a flask going `working -> done`, it looks the process up in a table and calls
  `this.host.flagOnce(flag)` after the existing `flagOnce('distilled')`. A table, not an if-chain, so later units add rows
  without touching the logic:
  ```ts
  // src/sim/distillRuns.ts (NEW file, see 4.4)
  import { FLAG_DISTILLED_SPIRIT } from '../core/constants';
  /** Flags a finished run of a process card raises (objectives listen to them). */
  export const RUN_FLAGS: Readonly<Record<string, string>> = { distil_spirit: FLAG_DISTILLED_SPIRIT };
  ```
- Reward reasoning: four glass beakers are what a second spirit run needs to bottle its output, an Ember item (`itemsGlass.ts`),
  so `content.test.ts`'s "no reward from further up the tree" holds.
- Toast and log rows come from Unit 0 (`Side goal: Run your first spirit`, sfx `objective` at 0.6). The run's own toast stays
  `Distilling run finished`; Unit 12 enriches it to name the product (4.6) - two toasts in one moment is fine (Unit 0 already
  stacks them).

### 4.6 The run toast, enriched (T8)

`announce`, flask `working -> done`: the text becomes, when `process` is known and the card's output container maps to a fluid:

`<Card fluid name> run finished - <litres> in the receiver` -> e.g. `Spirit run finished - 436 L in the receiver`,
`Pine Syrup run finished - 1.6 buckets in the flask` (syrup stays in the flask: the "where" is the module holding the most of
that fluid in the rig: `receiver` / `flask` words from the module kind's display name lowercased: "in the receiver", "in the
flask", "in the condenser"). Litres use the T8 rule: `<n> L` under 1000, `<x.x> buckets` at or above.

When the process or its fluid is unknown, or no module in the rig holds that fluid, the text stays `Distilling run finished`.
This is the string the plan asked for ("Spirit run finished - 1.4 buckets in the receiver", DISTILLERY_PLAN 2.1).

Helper (pure, in `src/sim/distillRuns.ts`): `runToast(process: string | undefined, holdings: { kind: string; fluid: string;
litres: number }[]): string`.

`litresText` already exists, private, in `src/sim/distillActions.ts` (line 28:
``const litresText = (l: number): string => (l >= 1000 ? `${(l / 1000).toFixed(1)} buckets` : `${Math.round(l)} L`);``). Move it
to `src/sim/distillRuns.ts` as an export and import it back into `distillActions.ts` (one formatter for both).

### 4.7 Sounds (`src/audio/sfxDistill.ts`, NEW)

House style (copied from `sfxBrew.ts`): a one-line comment above each patch saying what it is, `jitter` on physical sounds,
layers from `sfxKit` (`tone`, `noise`, `bp`, `hp`, `lp`, `bell`, `N`), every `gain <= 1`, durations inside the bounds below.

```ts
/** Patches of the glass distillery (SYSTEMS T9): a flask coming to the boil, a drop into a receiver, the run's glass chime,
 *  a blocked module's muffled thunk, a stirrer starting. The rolling boil itself is the ambience layer (ambienceBoil.ts). */
import type { Patch } from './patch';
import { bell, bp, lp, N, noise, tone } from './sfxKit';

export const DISTILL_SFX = {
  // A flask comes to the boil: one big glassy blurp (lower and rounder than the kettle's boil_bubble), then a smaller one.
  still_bubble: {
    jitter: 2,
    layers: [
      tone('sine', 170, 0.38, 0.14, { a: 0.008, freqEnd: 520 }),
      noise('pink', bp(900, 1500, 1.4), 0.22, 0.09, { a: 0.006 }),
      tone('sine', 330, 0.16, 0.08, { at: 0.11, a: 0.005, freqEnd: 760 }),
    ],
  },
  // One heavy drop into a glass receiver: a low plink with a glassy ring after it (heavier than the cup's drip).
  still_drip: {
    jitter: 2.5,
    layers: [
      tone('sine', 880, 0.32, 0.08, { a: 0.003, freqEnd: 600 }),
      bell(1760, 0.09, 0.16, 0.01, 0.6),
      noise('white', bp(2800, undefined, 1.6), 0.06, 0.02),
    ],
  },
  // A run is done: two struck glass notes a fifth apart, ringing out (the distillery's own "done", not the machine bell).
  glass_chime: {
    jitter: 0.5,
    layers: [
      bell(N.E6, 0.28, 0.9, 0, 0.9),
      bell(N.A6, 0.2, 1.0, 0.12, 0.8),
      tone('sine', N.E7, 0.05, 0.5, { at: 0.12, a: 0.004 }),
    ],
  },
  // A module is blocked: a muffled thunk of a full glass vessel against copper, with a short rattle.
  distill_clunk: {
    jitter: 1.5,
    layers: [
      tone('triangle', 140, 0.5, 0.12, { a: 0.004, freqEnd: 90 }),
      noise('pink', lp(600, 300), 0.3, 0.07, { a: 0.003 }),
      bell(1250, 0.07, 0.12, 0.02, 1.5),
    ],
  },
  // A stirrer starts stirring a vessel: a slow slosh of liquid going round, with a low swirl under it.
  stirrer_slosh: {
    jitter: 1.5,
    layers: [
      noise('pink', bp(700, 1100, 1.0), 0.34, 0.5, { a: 0.08, trem: { rate: 5, depth: 0.5 } }),
      tone('sine', 120, 0.1, 0.42, { a: 0.06, freqEnd: 95 }),
      noise('white', bp(2400, 1800, 1.2), 0.05, 0.3, { at: 0.1, a: 0.05 }),
    ],
  },
} satisfies Record<string, Patch>;
```

(The `bell(freq, gain, d, at, index)` signature is `sfxKit`'s; `tone`'s `extra` keys `a`, `at`, `freqEnd`, `trem`, `filter` are
used by `sfxBrew.ts` today. The builder may tune values by ear/measure, keeping names, roles, loudness tiers and duration
bounds. Each layer's envelope must start and end at 0 - `playPatch` does that for every layer; nothing custom.)

| name | when (who emits) | position | volume (T9 tier) | duration bound (sfx.test) |
|---|---|---|---|---|
| `still_bubble` | a flask goes to `working` from `idle`/`done`/`blocked` (announce) | the flask | 0.6 small | < 0.3 s |
| `still_drip` | a receiver goes to `working` (first arrival), then every `DRIP_EVERY_S` 1.2 s while it stays working; global budget `DRIPS_PER_S` 3 | the receiver | 0.3 whisper | < 0.25 s |
| `glass_chime` | a flask or vessel goes `working -> done` (replaces `machine_done` pitch 1.4 there) | the module | 0.6 small | < 1.3 s, > 0.6 s |
| `distill_clunk` | any STATEFUL module goes to `blocked` (replaces `pipe_clunk` there) | the module | 1 normal | < 0.2 s |
| `stirrer_slosh` | a flask/vessel GAINS the `stirred` capability (edge, 4.8) | the vessel | 0.6 small | < 0.7 s |
| (loop) boil layer | `AmbienceState.boil` from boiling flasks near the listener (4.9) | ambience (not positioned) | layer peak 0.22 (< 0.6) | - |

Not added (on purpose): a running stirrer loop (workshop parts make no running sound today; T9 rule 3 says sound on change or
while it works, and the slosh plus the existing machine-hum ambience cover it); a condenser hiss (the boil bed covers it).

### 4.8 The slosh edge

`Distillery` keeps a transient `private stirred = new Set<string>()` (not saved). In `stepRig`, after stills and vessels step,
for each module of kind flask/vessel: `const now = this.capsOf(rig, k).has('stirred')` (Unit 0's private helper; if it is
named differently, use whatever `capabilitiesOf` uses internally); if `now && !this.stirred.has(k)` -> add + `sfx stirrer_slosh`
(volume 0.6, at the module centre); if `!now` -> delete. On `clear()` the set empties; on `remove()` the module's entry is dropped. After a
load every stirred vessel would slosh at once; to avoid that chorus, `clear()` sets `quietSteps = CHEM_STEP_HZ` (4) and `step`
decrements it: while it is above 0 the set is filled silently. A paddle that starts later in the session sloshes once.

### 4.9 The boil bed (the "bubbling loop")

`src/app/ambience.ts` (`AmbienceProbe.scan`), NEW constants and one branch:

```ts
/** Boiling flasks within this many blocks bubble; each adds up to BOIL_WEIGHT (two close by fill the bed). */
export const BOIL_HEARING = 12;
const BOIL_WEIGHT = 0.5;
...
let boil = 0;
for (const e of this.world.entities()) {
  ...distance d...
  if (isFurnace(e)) { ...unchanged... }
  else if (isChemKind(e.kind)) {           // glass distillery: never machine hum
    if (e.kind === CHEM.flask && (e as ChemEntity).state === 'working' && d < BOIL_HEARING && this.world.isLoaded(e.x, e.z))
      boil += BOIL_WEIGHT * (1 - d / BOIL_HEARING);
  } else if (e.kind !== 'crate' && d < MACHINE_HEARING) { ...unchanged hum... }
}
s.boil = unit(boil);
```

- `isChemKind` and the type `ChemEntity` import directly from `'../sim/distill'` (both exported today; `src/sim/index.ts` does
  not re-export the distillery, and need not), `CHEM` from `'../core/distill'`.
- Many rigs: the sum is clamped to 1 by `unit`; one ambience layer exists, so 20 stills cost exactly what one costs.
- Unloaded chunks: a flask entity outside a loaded chunk never counts (`isLoaded`); the Distillery does not step unloaded rigs
  (`rescan` filters by `isLoaded`), so their state freezes, and the probe ignores them anyway.
- Under water: `computeTargets` already zeroes `boil`. Paused: the engine's existing pause handling.
- Brewing buckets (`AmbienceState.boil` doc says "brewing") still do not feed it; that was never wired and is out of scope
  (13). The doc comment on `boil` is updated to "Boiling near the listener (distillery flasks), 0..1".
- Fade: `buildBoil`'s `Follow(bus.gain, 0.5, 0)` already glides the level over about half a second; a run that finishes makes
  the bubbling die away instead of cutting.

### 4.10 Drip pacing (no spam with many rigs)

In `Distillery`, transient (not saved):

```ts
// src/core/distill.ts (NEW)
/** Seconds between drip sounds of one receiver while liquid keeps arriving. */
export const DRIP_EVERY_S = 1.2;
/** Most drip sounds the whole distillery makes per second (many rigs drip in turn, not in a chorus). */
export const DRIPS_PER_S = 3;
```

- `private dripIn = new Map<string, number>()` (receiver key -> seconds to its next drip), `private dripBudget = DRIPS_PER_S`.
- Each `step(dt)`: `dripBudget = Math.min(DRIPS_PER_S, dripBudget + DRIPS_PER_S * dt)`.
- In `show`, for each receiver in `working`: `t = (dripIn.get(k) ?? 0) - dt`; if `t <= 0 && dripBudget >= 1` -> emit `still_drip`
  (volume 0.3), `dripBudget -= 1`, `t = DRIP_EVERY_S`; store `t`. A receiver not working: `dripIn.delete(k)`. So the first drip
  comes on the first working step.
- The audio engine's own `HEARING_RANGE` 24, `MAX_VOICES` 24 and `REPEAT_GUARD_S` 0.03 do the rest.

### 4.11 Codex progression branches (owned here: SYSTEMS T7 "Unit 12 owns scripts/codex/progression.json edits for the distillery branch")

Insert these branch objects (JSON, keys as items; a key that is not yet a registry item renders as a "planned" tag automatically,
README rule, so later units' keys can be listed now):

Ember Age, after "Brewing":
```json
{ "name": "Glass distillery",
  "items": ["still_base", "boiling_flask", "condenser_coil", "receiver", "glass_tube", "reaction_vessel", "airlock_cap",
            "syrup_beaker", "wash_beaker", "low_wines_beaker", "spirit_beaker"],
  "note": "A pot still on the furnace top: sap to syrup, wash to low wines, low wines to spirit at 92 C. Liquid runs down, never up." }
```

Bronze Age, after "Items move":
```json
{ "name": "Shaft chemistry",
  "items": ["chem_stirrer", "vacuum_pump", "vacuum_cap", "filter_bed"],
  "note": "A shaft at 16 rpm stirs a vessel (reactions twice as fast) or pulls a vacuum (boiling points x0.7)." }
```

Forge Age, after "Fluids":
```json
{ "name": "Columns and oil",
  "items": ["column_segment", "cooling_jacket", "chem_port", "empty_canister", "crude_canister", "gasoline_canister",
            "kerosene_canister", "diesel_canister", "residue_canister", "fuel_ethanol_beaker", "reflux_head", "steel_flask",
            "lube_base_canister", "lubricant_canister"],
  "note": "Column segments stacked on a flask: one cut per segment. Crude at 350 C gives gasoline, kerosene, diesel and residue." }
```

Current Age, replacing nothing (append after "Oil"):
```json
{ "name": "Refinery",
  "items": ["catalyst_pellets", "catalyst_bed", "pressure_cap"],
  "note": "A catalyst bed and a pressure cap on a steel flask crack heavy oil into gasoline at 480 C." }
```

The old "Oil" branch (`still`, `fuel_canister`) stays: it is the oil-shale machine, a different thing. Potions (Unit 10:
essences, tinctures, elixirs, bandage) are NOT listed here: Unit 10 adds its own branch in a branch named after its content
(SYSTEMS T7 rule "only touch progression.json in a section headed with their unit name").

Codex crafting map (`scripts/codex/page.html`), so process cards finally show:

```js
const CHEM_NAMES = { boiling_flask: 'Boiling Flask', column_segment: 'Column', reaction_vessel: 'Reaction Vessel' };
...after the machines section:
const chemRows = recipes.filter((r) => CHEM_NAMES[r.station]);
sections.push({ id: 'distillery', title: 'Distillery',
  note: 'Process cards: a typical run of a glass rig. The temperature is the still base setting; liquids are poured by the beaker or canister.',
  groups: Object.keys(CHEM_NAMES).map((m) => ({ label: CHEM_NAMES[m], rows: chemRows.filter((r) => r.station === m) })).filter((g) => g.rows.length) });
```
and in `recipeHtml` / `stationLabel`, treat `CHEM_NAMES[r.station]` like a machine (temperature badge when `temp > 0`, time
badge when `t > 0`; label `CHEM_NAMES[r.station]`). Fermenting cards have `minTempC` 20 - show it as `20 C` (it is the room it
needs); that is honest.

### 4.12 Balance pass (written; measured, not guessed)

Method: every card was run in the real simulation with the `distillProcess.test.ts` fixture (`buildRig(card.rig)`, `feed`,
`runUntil` until done, base at the card's setting) on 2026-11-22. Measured: time to `done`, and litres of each named fluid at the
end ("k" = the fixture's scale, 0.5 when a card's inputs exceed one 4000 L flask):

| card | in | measured time | measured products | card promises |
|---|---|---|---|---|
| `distil_syrup` | 1000 L sap | 61 s | 397 L syrup (stays in the flask), 603 L water in the receiver | 1 syrup (250 L), 120 s |
| `ferment_wash` | 1250 L | 109 s | 1250 L sugar wash | 5 wash (1250 L), 110 s |
| `distil_low_wines` | 4000 L wash | 70 s | 473 L low wines | 1 low wines (250 L), 70 s |
| `distil_spirit` | 2000 L low wines | 52 s | 436 L spirit | 1 spirit (250 L), 60 s |
| `refine_crude` (k 0.5) | 4000 L crude | 245 s | 923 gasoline, 576 kerosene, 1092 diesel, 1408 residue (L) | for 8000 L: 2 diesel, 1 gasoline, 1 kerosene, 2 residue, 260 s |
| `rectify_spirit` | 1000 L spirit | 58 s | 569 L fuel ethanol | 1 fuel ethanol (250 L), 60 s |
| `refine_crude_short` | 4000 L crude | 245 s | 1043 diesel, 1549 slop, 1409 residue | 1 diesel, 1 slop, 1 residue, 130 s |

Principles (SYSTEMS 5, and the existing comment "a typical run ... at least the card's outputs"):
1. A card promises whole containers the rig **really fills**, with at least 10% margin (the test is `>=`, and a player who bottles
   a little early must still get the promise).
2. A card's time is the measured time rounded UP to 5 s, for the inputs the card lists (two flask loads = two runs).
3. The physics (`BOIL_LPS`, `FERMENT_LPS`, grades) is NOT changed here: other units' numbers (Unit 7 burn times, Unit 8 vacuum runs,
   Unit 0's fermenting guarantee) are built on it.
4. `FUEL_GRADES` stay as they are (reasoning below).

Changes (old -> new):

| card / constant | old | new | why |
|---|---|---|---|
| `distil_syrup` timeS | 120 | **65** | measured 61 s |
| `distil_spirit` timeS | 60 | **55** | measured 52 s |
| `rectify_spirit` output / byproducts | 1 fuel_ethanol_beaker / 3 glass_beaker | **2 fuel_ethanol_beaker / 2 glass_beaker** | the rig makes 569 L (2.28 beakers); promising 1 told the player a two-segment column wastes half its work. 500 L has 12% margin |
| `refine_crude` timeS | 260 | **500** | 8 canisters are two 4000 L flask loads, 245 s each |
| `refine_crude_short` timeS | 130 | **250** | measured 245 s for 4000 L; 130 was half the truth |
| `ferment_wash_stirred` (NEW) | - | 60 s | stirred fermenting at x2: ~55 s, rounded up with margin |

Unchanged, with reasons:

| card / constant | value | why it stays |
|---|---|---|
| `distil_syrup` output | 1 syrup | 397 L: 2 beakers would be 500 L (fails) |
| `ferment_wash` | 5 wash, 110 s | exact; Unit 0 guarantees it |
| `distil_low_wines` | 1 low wines, 70 s | 473 L: 2 beakers fail by 27 L. The low recovery at 97 C is the lesson of cuts (a hotter setting gives more, weaker low wines) |
| `distil_spirit` output | 1 spirit | 436 L: 2 beakers fail |
| `refine_crude` outputs | 2 diesel, 1 gasoline, 1 kerosene, 2 residue | per 8000 L the rig makes 2184 / 1846 / 1152 / 2816 L: all promises hold (gasoline is 1.85 canisters - a second canister would fail) |
| `refine_crude_short` outputs | 1 diesel, 1 slop, 1 residue | hold (1043 / 1549 / 1409 L) |
| `FUEL_GRADES.gasoline_canister` | saw 1.3, tractor 1.2 | the best saw fuel; one crude run (4000 L) gives ~0.9 canister of gasoline, so 1.3 rewards the column without making the old Fuel Canister (1/1, oil-shale still, Current) pointless |
| `FUEL_GRADES.diesel_canister` | tractor 1.5, saw 0 | diesel is the biggest cut (1.1 canister per run) and the tractor is its consumer; a saw refusing it keeps gasoline wanted |
| `FUEL_GRADES.fuel_ethanol_beaker` | saw 0.25, tractor 0.2 | per litre (x4 to a canister) = saw 1.0 / tractor 0.8: a clean Forge-age fuel exactly as good as the old canister in the saw, worse in the tractor. With rectify now promising 2 beakers per 4 spirit, the honest yield already makes it more attractive; no multiplier change needed |
| kerosene | no `FUEL_GRADES` row | Unit 7 gives it its use (burner 350 C, SYSTEMS T1 rule 2); not an engine fuel |
| `STILL_SETPOINTS`, `GLASS_MAX_C` | unchanged | Units 7 / 11 own setpoint additions |

`src/content/specRosterDistill.ts` lines change accordingly (9.3).

The whole-chain cost the balance pass looked at (for the side goal): one spirit run from scratch = 8 low wines beakers = 4
low-wines runs of 16 wash = 64 wash = 13 syrups = 52 beakers of sap. That is a long Ember project, and correct for "your first
spirit" - but the side goal does not demand a full charge: any `distil_spirit` run that finishes counts (a single beaker of Low
Wines boils dry in seconds and rings the chime). The goal teaches the second distillation; the economy rewards the patient.

---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour and rules (including edge cases)

### 5.1 The stirrer, case by case

| situation | stirred? | goggles on the stirrer | message / sound |
|---|---|---|---|
| crank Used, 16 rpm, vessel beside | yes | `Chem Stirrer - right 16 rpm, load 4/8 su, stirring the vessel beside` | first step stirred: `stirrer_slosh` at the vessel |
| clockwork motor, 24 rpm | yes | `Chem Stirrer - right 24 rpm, load 2.67/48 su, stirring the vessel beside` | - |
| reversed (reverse box before it), -16 rpm | yes (direction never matters) | `Chem Stirrer - left 16 rpm, load 4/8 su, stirring the vessel beside` | - |
| water wheel 12 rpm | no | `Chem Stirrer - too slow (12 of 16 rpm)` | none; the vessel line shows its problem (Unit 0 phrase `needs stirring (a Chem Stirrer at 16 rpm)` only when a reaction NEEDS it) |
| ratio dial x0.5 on a crank, 8 rpm | no | `Chem Stirrer - too slow (8 of 16 rpm)` | - |
| turning, no flask/vessel touching | no (nothing to stir) | `Chem Stirrer - right 16 rpm, load 4/8 su, nothing to stir` | - |
| between two vessels | both | `... stirring 2 vessels` | one slosh per vessel |
| network overstressed (e.g. 4 stirrers + a mixer on one crank) | no | existing `Chem Stirrer - overstressed 22/8 su` | existing toast `Too much load: 22 on 8 stress units. Add a source or take a machine off`, `error` sfx, bell rings (unchanged) |
| jammed | no | existing `Chem Stirrer - jammed: the gears fight each other` | existing toast |
| network oiled (resin/residue/lubricant) | capacity x factor (the one `LUBE` rule) | `..., load 4/8.8 su, oiled, stirring the vessel beside` (the oiled fact stays where `describe` puts it today, before ours) | existing toast `Oiled: this network carries 10% more for 5 min` |
| still (no source) | no | `Chem Stirrer - still` | - |
| crank stops (2.5 s after the last Use) | stops the same tick the speed goes | - | no sound when stirring stops (only the start sloshes) |
| vessel broken while stirred | - | `nothing to stir` | `stirred` set entry dropped in `remove` |
| stirrer carried by a piston/bearing (contraption, Unit 13) | after the move it stirs whatever it touches at the new cell | - | parts re-key by `relocate` (existing); no new state to move |
| chunk with the vessel unloaded | the vessel does not step (Distillery skips unloaded rigs); nothing to hear | - | - |
| a stirrer touching a `reaction_vessel_done` | yes (`chemKindOf` strips `_done`) | `stirring the vessel beside` | - |

Stirring with no reaction that cares (a vessel of plain water, or a sealed wash that already finished) is harmless: the
capability is true and visible (`, stirred` on the vessel line, "stirred" on the rig screen), nothing changes. That is the same
honesty as a pump pulling on an empty flask.

### 5.2 Stirred fermenting

- Sealed + stirred vessel with syrup + water: fermenting at x2 (Unit 0 `rateOf`), crosshair `Reaction Vessel - fermenting,
  1250 L, stirred` (Unit 0's vessel words, our suffix). Done in ~55 s; toast `Fermenting done: Sugar Wash` (Unit 0), sound
  `glass_chime` (ours).
- Stirring a vessel without an airlock: still not sealed - no fermenting (`needs an Airlock Cap`, Unit 0); stirring never
  replaces a `needs`.
- Stirring stops halfway: the reaction drops back to x1 the next step; `rx.doneL` keeps what was done (Unit 0 continuous model).

### 5.3 `distill:step` edge cases

| case | events |
|---|---|
| flask idle -> working (boil starts) | `{ kind: 'boiling_flask', from: 'idle', state: 'working', process: 'distil_spirit', litres: 2000 }`, then sfx `still_bubble` |
| flask working -> done | `{ from: 'working', state: 'done', process, litres: <left> }`, then toast (4.6), `glass_chime`, flags `distilled`, `distilled_spirit` when `RUN_FLAGS[process]` |
| flask working -> blocked (receiver full) | `{ state: 'blocked', process }`, `distill_clunk` |
| flask blocked -> working (receiver emptied) | `{ from: 'blocked', state: 'working', process }`, `still_bubble` |
| base furnace goes out mid-run | flask `working -> blocked` (existing rule `ts === null` with `ran`) -> event + clunk; relit -> working again |
| flask done -> idle (emptied by a beaker) | `{ from: 'done', state: 'idle', litres: 0 }` (process omitted: the charge was cleared) |
| vessel ferments | `{ kind: 'reaction_vessel', reaction: 'rx_ferment_wash', ... }` on each change |
| receiver first liquid | `{ kind: 'receiver', from: 'idle', state: 'working' }` + first `still_drip` |
| saved game loaded mid-run | no event on load; the first change after it emits normally. `charge` is saved, so a run in progress still knows its process |
| old save (no `charge`) loaded mid-run | the run finishes with `process` undefined: no `distilled_spirit` flag from that run (the next run sets it). Documented, harmless |
| two flasks finish the same step | two events, two chimes (the engine's voice cap and repeat guard handle it) |

### 5.4 Side goal edge cases

- Completes out of order and at any age (Unit 0 mechanism); never "current"; never in `OBJECTIVES`.
- A flask of Low Wines run at 78 C or 130 C still counts (the process is the charge, not the setting).
- Low Wines through a column (segments) counts (table 4.4).
- Pack full: Unit 0 parks the reward in `pendingRewards`.
- Flag set before the side goal existed (impossible: the flag is new) - n/a.

### 5.5 Sound edge cases

| case | behaviour |
|---|---|
| 20 stills boiling in one hall | one boil layer at full level (sum clamped to 1); drips capped at 3 per second for the whole distillery; chimes per completion |
| walking away | boil level falls linearly to 0 at 12 blocks; positioned one-shots fade by `HEARING_RANGE` 24 |
| chunk unloaded | its flasks neither step nor count for the bed |
| game paused | engine drops non-UI one-shots while paused (existing); ambience follows the engine's pause |
| under water | `boil` target 0 (existing `computeTargets`) |
| idle rig | silent (T9 rule 3): the bed needs a `working` flask; drips need a `working` receiver |
| load of a world full of stirred vessels | no slosh chorus: `quietSteps` (4.8) |

### 5.6 Messages (every new player-facing string)

| where | string |
|---|---|
| stirrer goggles, stirring | `Chem Stirrer - right 16 rpm, load 4/8 su, stirring the vessel beside` (`above` / `below` / `beside`; `the flask` when it is a Boiling Flask; two: `stirring 2 vessels`) |
| stirrer goggles, too slow | `Chem Stirrer - too slow (8 of 16 rpm)` |
| stirrer goggles, no target | `Chem Stirrer - right 16 rpm, load 4/8 su, nothing to stir` |
| vessel / flask crosshair suffix | `, stirred` (last fact) |
| run toast | `Spirit run finished - 436 L in the receiver` / fallback `Distilling run finished` |
| side goal toast (Unit 0 format) | `Side goal: Run your first spirit` |
| side goal text | `Pour Low Wines into a Boiling Flask on a Still Base, set the base to 92 C and let it boil. Clear Spirit drips into the Receiver.` |
| stirrer item desc | `A geared paddle on a glass rod. Set it against a Reaction Vessel or Boiling Flask and turn it at 16 rpm or more: the vessel is stirred, and stirred reactions run twice as fast.` |

All lines measured against the ~60 character crosshair budget: the longest stirrer line (`Chem Stirrer - right 24 rpm, load
2.67/48 su, stirring the vessel beside`, 69 chars) exceeds it; on the HUD the goggles line is the SECOND line (SYSTEMS T8 "a second
goggles line may carry kinetic facts") and wraps at the HUD's width; the e2e phone check (10) verifies it wraps without covering
the hotbar. If the builder wants it inside 60, the fallback wording is `stirring beside` / `stirring 2` (keep the exact wording in
the tests and the docs in sync).

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Goggles (T8)

`Workshop.describe(x, y, z)` for a part of kind `chem_stirrer` builds the line through NEW pure helper
`src/workshop/chemParts.ts`:

```ts
/** What a Chem Stirrer reports after its rpm facts (pure; tested without a world). */
export interface StirTargets { count: number; /** where the first one is */ side: 'above' | 'below' | 'beside'; /** 'vessel' | 'flask' */ what: 'vessel' | 'flask' }
/** The stirrer's own fact, or a full replacement of the rpm fact when it turns too slowly. */
export function stirFact(rpm: number, targets: StirTargets | null): { replace?: string; append?: string } {
  const r = Math.abs(rpm);
  if (r > 0 && r < STIR_MIN_RPM) return { replace: `too slow (${Math.round(r * 10) / 10} of ${STIR_MIN_RPM} rpm)` };
  if (r === 0) return {};
  if (!targets || targets.count === 0) return { append: 'nothing to stir' };
  return { append: targets.count > 1 ? `stirring ${targets.count} vessels` : `stirring the ${targets.what} ${targets.side}` };
}
```

- `describe` change (minimal): after `parts` is built, `if (p.kind === 'chem_stirrer') { const f = stirFact(this.speed.get(key) ??
  0, this.stirTargets(p)); if (f.replace) parts[0] = f.replace; if (f.append) parts.push(f.append); }`. `stirTargets(p)` (private)
  counts neighbour cells whose block key's `chemKindOf` is `reaction_vessel` / `boiling_flask` (vessel wins `what` if both), with
  `side` from `dy` of the first (+1 above, -1 below, else beside).
- `STIR_MIN_RPM` lives in `chemParts.ts` (workshop.ts imports chemParts and re-exports the constant; never the other way).
- If Unit 8 has landed a shared consumer helper (e.g. `consumerFact`) for the vacuum pump, reuse its "too slow" wording function
  and keep `stirFact` only for the targets part. The strings must match Unit 8's: `too slow (12 of 16 rpm)`.

### 6.2 The chem crosshair

`chemView` (`src/sim/distillActions.ts`) for a flask or vessel whose `capabilitiesOf` includes `stirred` appends `, stirred` as the
last fact (after Unit 8's `, vacuum` if both). Example: `Reaction Vessel - fermenting, 1250 L, stirred`. Unit 6's rig screen
already prints the capability word `stirred` (no edit).

### 6.3 The world

- The stirrer's front animates while turning (existing ACTIVE-bit mirror in `showActive`).
- `src/workshop/workshop.ts`: add `'chem_stirrer'` to `SPIN_KINDS`, so `view()` puts it in `WorkshopView.spin` and the renderer's
  default spin branch (`this.cog(sp.x + 0.5, sp.y + 1.07, sp.z + 0.5, a, 1, BRONZE)`) draws a turning bronze cog on its top. No
  renderer edit. (The mixer and vacuum collector draw through `swings` because they are logistics cells; the stirrer is a plain
  kinetic part, so `spin` is its list.)
- `src/render/textures/iconsWorkshopParts.ts`: `chem_stirrer: { tint: 0x9fd8c8, draw: (c, on) => ... }` - a vertical glass rod
  (light cyan 2 px column, x 7-8) with a bronze two-blade paddle at the bottom, rotated a quarter (blades swapped) when `on`.
  Two tiles: `ws_chem_stirrer_front`, `ws_chem_stirrer_front_on` (generated by the existing painter from `PART_DEFS` with
  `anim: true`).
- No new particles. The vessel's liquid swirl is not drawn (out of scope, 13).

### 6.4 Phone layout

No new screen, no new button. Everything is Use (crank, place, pour) and reading (goggles line, crosshair, toasts, Hearth Log
row). The Hearth Log side goal row is Unit 0's (44 px row, `-webkit-line-clamp: 2`). The Codex "Distillery" crafting section
reuses the page's existing recipe cards and station chips (one more chip `Distillery` in the horizontally scrolling chip row;
`preview.mjs` already checks 390 x 844 for horizontal overflow).

### 6.5 Sounds (T9 tiers)

As table 4.7. Loops: only the boil layer, peak 0.22. Alarm tier: none (a blocked still is a problem, not a danger).

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

| state | where | saved? | sanitising |
|---|---|---|---|
| `chem_stirrer` parts | `Workshop.parts` | yes, existing `WorkshopSnapshot.parts` rows `[x, y, z, 'chem_stirrer']` (no setting) | existing `load` (`KINETIC.has(kind)`), `verify` |
| `ChemEntity.charge?: string` | distill entity (world JSON) | yes, optional | `track()`: keep only if `typeof e.charge === 'string' && fluidOrNull(e.charge) !== null`, else `delete e.charge` |
| `Distillery.stirred` set, `dripIn`, `dripBudget`, `quietSteps` | memory | no | rebuilt on the first steps |
| flag `distilled_spirit` | `ObjectivesSnapshot.flags` | yes (existing) | existing |
| side goal done | Unit 0's tracker snapshot | yes (Unit 0) | Unit 0 |
| `AmbienceState.boil` | per frame | no | - |

Old saves load: no `charge` -> undefined (5.3); no `chem_stirrer` parts -> nothing. No `SAVE_VERSION` bump (T10 rule 3).
Block id: `chem_stirrer` is APPENDED via `PART_DEFS` (append the row at the END of `PART_DEFS`, after `skiff` and after any row
other Wave 1 units appended - never insert, SYSTEMS 2 "append, never insert or reorder").

---------------------------------------------------------------------------------------------------------------------------

## 8. Implementation plan (ordered; `npm test` green after each step)

1. **Part.** `src/content/itemsWorkshopParts.ts`: append the `chem_stirrer` `PART_DEFS` row (4.1, `anim: true`). `src/workshop/
   kinetics.ts`: `BASE_STRESS.chem_stirrer = 4`. `src/content/recipesWorkshop.ts`: `forge('chem_stirrer', '1 bronze_ingot, 1
   bronze_cog, 1 drive_shaft, 1 glass', 600)` appended after the last part recipe. `src/render/textures/iconsWorkshopParts.ts`:
   the glyph. `src/content/specRosterWorkshop.ts`: block key, recipe line, face counts (9.3).
2. **Hook.** NEW `src/workshop/chemParts.ts` (`STIR_MIN_RPM`, `StirTargets`, `stirFact`). `src/workshop/workshop.ts`: re-export
   `STIR_MIN_RPM`; `stirredAt(x, y, z): boolean` (4.2) next to `crank`; private `stirTargets(p: Part): StirTargets | null`;
   `describe` branch (6.1). `src/app/game.ts`: `this.state.sim.distill.stirredAt = (x, y, z) => this.workshop.stirredAt(x, y, z);`
   after `this.workshop.clockText = ...`.
3. **Renderer.** `SPIN_KINDS` gains `'chem_stirrer'` in `workshop.ts` (6.3); no renderer file edit.
4. **Reaction speed-up.** `src/content/reactionsDistill.ts`: `rx_ferment_wash` gains `speedUps: { stirred: 2 }`.
   `src/content/recipesDistill.ts`: `RIG_LEGEND.S = 'chem_stirrer'`; card `ferment_wash_stirred` (4.2). `src/sim/distillKit.ts`:
   `buildRig` places `S` as a plain block (it already places any legend block via `RIG_LEGEND`) and sets
   `kit.sim.distill.stirredAt = (x, y, z) => [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].some(([dx, dy, dz]) =>
   kit.world.getBlock(x + dx, y + dy, z + dz).key === 'chem_stirrer')` at the end of `buildRig` (`kit.world.put` already places
   any `RIG_LEGEND` key, so `S` needs no placing code) unless a test overrides it (chain with Unit 8's `vacuumAt` stub if present).
5. **Event + charge.** `src/core/gameEvents.ts`: `'distill:step'` (4.3). `src/sim/distill.ts`: `ChemEntity.charge?`; `track`
   sanitising; set/clear in `stepStill` (4.4). NEW `src/sim/distillRuns.ts`: `segmentsOf`, `processFor`, `runToast`,
   `litresText` (or reuse). `announce(e, before)`: emit `distill:step` first for STATEFUL kinds; then the sound/toast/flag rules
   of 4.7 / 4.6 / 4.5 (replace `machine_done` pitch 1.4 by `glass_chime` volume 0.6 for flask/vessel done; `pipe_clunk` by
   `distill_clunk` for blocked; `still_bubble` volume 0.6 for flask -> working).
6. **Flag + side goal.** `src/core/constants.ts` `FLAG_DISTILLED_SPIRIT`; `src/sim/distillRuns.ts` `RUN_FLAGS`; `src/core/distill.ts` `DRIP_EVERY_S`,
   `DRIPS_PER_S`; NEW `src/content/objectivesDistill.ts` `DISTILL_SIDE_GOALS`; `src/content/objectivesSide.ts` appends it.
7. **Drips and slosh.** `Distillery` fields `stirred`, `dripIn`, `dripBudget`, `quietSteps`; logic of 4.8 and 4.10 in `stepRig` /
   `show` / `step` / `clear` / `remove`.
8. **Sounds.** NEW `src/audio/sfxDistill.ts` (4.7). `src/audio/sfx.ts`: import and spread `...DISTILL_SFX` (after `MAGIC_SFX`).
   `src/core/gameEvents.ts` `SfxName`: append under `// ---- glass distillery (SYSTEMS T9; src/audio/sfxDistill.ts) ----` the five
   names with one-line doc comments each. `src/audio/sfx.test.ts` (9.4).
9. **Boil bed.** `src/app/ambience.ts`: `BOIL_HEARING`, `BOIL_WEIGHT`, the chem branch in `scan` (4.9). `src/audio/ambienceState.ts`: doc comment of `boil`.
10. **Balance.** `src/content/recipesDistill.ts` card edits (4.12). `src/content/specRosterDistill.ts` lines.
11. **Codex.** `scripts/codex/progression.json` branches (4.11); `scripts/codex/page.html` `CHEM_NAMES` section; run
    `npm run codex` and `node scripts/codex/preview.mjs dist-codex` (no console errors, no overflow at 390 x 844).
12. **Unit 6 chime** (only if `src/ui/screens/.../rigGhost.ts` exists at merge time): its `machine_done` pitch 1.4 volume 0.6
    call becomes `glass_chime` volume 0.6.
13. **E2E** (10) and **docs** (11).

Helpers to reuse, not rewrite: `DIRS` and `k3` (workshop.ts), `chemKindOf`, `STATEFUL`, `CHEM_CONTAINERS` (core/distill),
`nameOf` (core/chem), `fluidOrNull` (core/registry), `posKey` (sim/entities), `amounts` (content/amounts), `bell`/`tone`/`noise`/
`bp`/`lp`/`N` (audio/sfxKit), `buildRig`/`feed`/`runUntil` (sim/distillKit), `setup()` (workshop/parts.test.ts).

---------------------------------------------------------------------------------------------------------------------------

## 9. Tests (vitest, exact cases)

### 9.1 NEW `src/sim/distillRuns.test.ts` (pure)

- `processFor maps every charge to its card`: the full table of 4.4 (8 rows) as `it.each`.
- `processFor returns undefined for no charge, slop and water`.
- `segmentsOf counts the rig's column cells` (`refine_crude` 3, `refine_crude_short` 2, `rectify_spirit` 2, `distil_spirit` 0).
- `runToast names the product and where it is`: (`distil_spirit`, `[{ kind: 'receiver', fluid: 'spirit', litres: 436 }]`) ->
  `Spirit run finished - 436 L in the receiver`; 1400 L -> `... - 1.4 buckets in the receiver`; syrup in the flask ->
  `Pine Syrup run finished - 397 L in the flask`; unknown process -> `Distilling run finished`; product nowhere ->
  `Distilling run finished`.

### 9.2 `src/sim/distill.test.ts` (or NEW `src/sim/distillStep.test.ts` with `buildRig`)

- `a spirit run emits distill:step working then done with process distil_spirit`: `buildRig('CR/F./B.')`, feed 1000 L of
  `expand('low_wines', 1000)`, base 92, collect bus `distill:step`; assert first flask event `{ from: 'idle', state: 'working',
  process: 'distil_spirit' }` and a later `{ from: 'working', state: 'done', process: 'distil_spirit' }`; flags include
  `distilled` and `distilled_spirit`.
- `the done event comes before the toast` (record order of `distill:step` and `toast` emissions).
- `a run of wash raises no spirit flag` (process `distil_low_wines`, no `distilled_spirit`).
- `charge is saved and sanitised`: entity with `charge: 'spirit'` survives `toJSON`/`track`; `charge: 'nonsense'` and `charge: 7`
  are deleted; an entity without `charge` loads (old save).
- `charge is set once per run and cleared when the flask empties` (top up mid-run: unchanged; empty with a beaker: gone).
- `sounds: still_bubble on boil, glass_chime on done, distill_clunk on blocked` (block the receiver by filling it: 2000 L).
  Assert `machine_done` and `pipe_clunk` are no longer emitted by the Distillery.
- `drips: one on first arrival, then at most one per 1.2 s per receiver, at most 3 per second overall`: two rigs side by side
  (`buildRig` twice at different x), run 10 s, count `still_drip` events: per receiver <= ceil(10 / 1.2) + 1 = 10, total <= 33 (budget starts full at 3, refills 3 per second).
- `stirred fermenting runs twice as fast`: `buildRig('A./VS')` (stub `stirredAt` true) vs `buildRig('A/V')`, same feed as
  `ferment_wash`; stirred reaches `done` in <= 60 s, unstirred is still `working` at 60 s and done by 112 s.
- `the slosh sounds once when stirring starts, and not in the first second after a load`: toggle the stub false -> true -> true:
  one `stirrer_slosh`; `clear()` + re-track with the stub true: no slosh in the first 4 steps.
- `litres are conserved with a stirrer` (fermenting conservation, Unit 0 style).

### 9.3 Content / roster

- `src/content/specRosterWorkshop.ts`: `'chem_stirrer'` appended to `blocks`; furnace recipe line
  `'chem_stirrer: 1 chem_stirrer <- 1 bronze_ingot, 1 bronze_cog, 1 drive_shaft, 1 glass @600 T1'`; the face count comment and
  number gain 2 (front + front_on) - follow the existing comment "then 20 fronts of the modular parts (two for each running one)"
  -> 22 (or +2 on whatever the count is after other Wave 1 units).
- `src/content/specRosterDistill.ts` recipe lines become:
  ```
  'distil_syrup: 1 syrup_beaker <- 4 pine_sap 65s 0J',
  'distil_spirit: 1 spirit_beaker <- 8 low_wines_beaker 55s 0J',
  'refine_crude: 2 diesel_canister <- 8 crude_canister 500s 0J',
  'rectify_spirit: 2 fuel_ethanol_beaker <- 4 spirit_beaker 60s 0J',
  'refine_crude_short: 1 diesel_canister <- 4 crude_canister 250s 0J',
  reaction_vessel: [..., 'ferment_wash_stirred: 5 wash_beaker <- 1 syrup_beaker, 1 water_pail, 4 glass_beaker 60s 0J'],
  ```
  (`DISTILL_RECIPE_COUNT` grows by 1 automatically.)
- `src/sim/distillProcess.test.ts`: unchanged code; it now also runs `ferment_wash_stirred` (kit stub makes it stirred) and checks
  the 2-beaker rectify promise (569 L >= 500 L).
- `content.test.ts`: progression still completes; `run_spirit` reward (glass_beaker) is not from further up the tree;
  `SIDE_OBJECTIVES` ids unique across both lists (Unit 0 validation).
- Texture readability test passes for the two new fronts.

### 9.4 `src/audio/sfx.test.ts`

- Count: `expect(SFX_NAMES.length).toBe(72 + Object.keys(MAGIC_SFX).length + Object.keys(DISTILL_SFX).length);` with
  `import { DISTILL_SFX } from './sfxDistill';` (merge with other units' terms: the expression is a plain sum, each unit appends
  its own `+ Object.keys(X_SFX).length`; final form after the build e.g. `72 + MAGIC + SUGAR + DISTILL + WORKSHOP`).
- Durations (add to `keeps sounds as short as their role calls for`):
  ```ts
  // Glass distillery: a bubble and a drop are tiny, the thunk short, the slosh a half second, the chime rings.
  under(['still_drip', 'distill_clunk'], 0.25);
  under(['still_bubble'], 0.3);
  under(['stirrer_slosh'], 0.7);
  under(['glass_chime'], 1.3);
  expect(patchDuration(SFX.glass_chime)).toBeGreaterThan(0.6);
  ```
- Jitter list gains `'still_bubble', 'still_drip', 'distill_clunk', 'stirrer_slosh'`.
- The existing generic cases (`starts at least one source`, `finite values`, `envelopes start and end silent`, `layer gain <= 1`,
  distinct patches, UI set unchanged) cover the five automatically.

### 9.5 Workshop

NEW `src/workshop/chemParts.test.ts` (pure): `stirFact(16, {count:1, side:'beside', what:'vessel'})` -> append `stirring the
vessel beside`; `stirFact(-24, ...)` same; `stirFact(8, ...)` -> replace `too slow (8 of 16 rpm)`; `stirFact(12.5, null)` ->
`too slow (12.5 of 16 rpm)`; `stirFact(16, null)` -> `nothing to stir`; count 2 -> `stirring 2 vessels`; `stirFact(0, ...)` -> `{}`.

`src/workshop/parts.test.ts` (fixture `setup()`), NEW cases:
- `a cranked stirrer stirs the vessel beside it`: crank - stirrer - (vessel block east of the stirrer); `crank()`, tick; 
  `stirredAt(vessel)` true; describe(stirrer) === `Chem Stirrer - right 16 rpm, load 4/8 su, stirring the vessel beside`.
- `reversed rotation still stirs` (reverse box between crank and stirrer): true, line starts `Chem Stirrer - left 16 rpm`.
- `too slow does not stir` (ratio dial at 0.5): false; line `Chem Stirrer - too slow (8 of 16 rpm)`.
- `overstress un-stirs`: crank + 3 stirrers + mixer (4+4+4+6 > 8): `stirredAt` false; line contains `overstressed`.
- `stirrer and vacuum pump share one crank` (only if Unit 8 merged; else `it.skip` with a comment): 4 + 4 = 8 su fits.
- `oil raises the stirrer network's capacity` (residue canister): capacity 10 su, `, oiled` in the line.
- `no target`: `... nothing to stir`; two vessels: `stirring 2 vessels`.
- `stirrer save round-trip`: `toJSON` -> new Workshop `load` -> part present.

### 9.6 Ambience (`src/app/ambience.test.ts` - create if absent, else extend)

With a fake world (`src/game/fakeWorld.ts`) holding chem entities:
- `a working flask 3 blocks away bubbles` (`state.boil > 0`), `an idle one does not`, `one 13 blocks away does not`.
- `many flasks fill the bed but never exceed 1`.
- `chem modules never count as machine hum` (working receiver with active voxel: `machineHum` 0).
- `a flask in an unloaded chunk is silent`.

---------------------------------------------------------------------------------------------------------------------------

## 10. E2E steps (`scripts/e2e-distill.mjs`)

Appended after the existing chainsaw step, same `step(...)` / `d.hw` / `tapTimes` / `mod` / `fastForward` / `view` helpers.
Run: `node scripts/build.mjs --out=<dir>` then `node scripts/e2e-distill.mjs --out=<dir> --device=desktop` and
`--device=phonePortrait` (no `HW_GPU`). Screenshots land in `test-results/e2e-distill/` as `<device>-<name>.png`.

1. `step('a stirrer on a wound clockwork motor stirs a sealed vessel: it ferments twice as fast', ...)`
   - Set-up (`window.__hw`): in the cleared yard at `z0 + 3`, place two fermenters: A = `reaction_vessel` + `airlock_cap` on top,
     `chem_stirrer` east of it, `clockwork_motor` east of the stirrer; B = `reaction_vessel` + `airlock_cap` alone, 3 blocks west.
     Give `2 syrup_beaker`, `2 water_pail`.
   - Real input: select `syrup_beaker`, `tapTimes(A, 1)`, select `water_pail`, `tapTimes(A, 1)`; same for B. Empty hand,
     `tapTimes(motor, 4)` (4 winds = 120 s).
   - Assert (read via hw): `game.workshop.describe(stirrer)` contains `stirring the vessel beside` and `24 rpm`;
     `sim.distill.capabilitiesOf(A)` includes `stirred`, B's does not; the crosshair line on A (look at it with `hw.lookAt`, read
     the HUD crosshair text element) ends with `stirred`.
   - `hw.tick(1)` repeatedly up to 65 s game time: A `done`, B still `working`. Then tick to 115 s: B `done`.
   - Screenshot `9-stirred-vessel` (looking at A with the goggles: `hw.give('engineer_goggles', 1)` before).
2. `step('a pot still runs low wines to spirit: bubbling, drips, a glass chime and the side goal', ...)`
   - Set-up: third pot still (furnace lit with charcoal as in step 1 of the script, base, flask, condenser, receiver) at
     `x0 + 10`. Install a recorder: `const bus = window.__hw.app.game.state.bus; window.__steps = []; window.__sfx = [];
     bus.on('distill:step', (e) => __steps.push(e)); bus.on('sfx', (e) => __sfx.push(e.name));`. Give `4 low_wines_beaker`.
   - Real input: select `low_wines_beaker`, `tapTimes(flask, 4)`; empty hand, tap the base until `mod(base).setC === 92` (from the
     default 97: 7 taps through 130 200 260 350 420 78 92) - assert 92.
   - Teleport the player 3 blocks from the flask; `fastForward` until the flask is `working`; then
     `window.__hw.app.game.ambience.state.boil > 0` (after one 0.25 s scan); `__sfx` includes `still_bubble`.
   - `fastForward` until `done` (<= 120 s). Assert: an entry in `__steps` with `{ kind: 'boiling_flask', state: 'done', process:
     'distil_spirit' }`; `__sfx` includes `glass_chime` and `still_drip` and not `machine_done`; the objectives snapshot
     (`state.objectives.toJSON().flags`) includes `distilled_spirit`; `state.objectives.side().find((g) => g.spec.id ===
     'run_spirit').done === true`; a toast in the DOM reads `Side goal: Run your first spirit`; a toast reads
     `Spirit run finished - ` followed by a litres figure; the inventory gained 4 `glass_beaker`.
   - Teleport 40 blocks away, wait 0.5 s real time: `ambience.state.boil === 0`.
   - Screenshot `10-spirit-done` (the green flask lamp and the toast; on phone the toast must not cover the hotbar - visual).
3. `step('the Hearth Log lists the side goal as done', ...)` - open the log with a real tap on the HUD goal plate
   (`.hw-goal` button, `src/ui/hud/goal.ts`; same on desktop and phone); assert a row with `Run your first spirit` and a done tick;
   screenshot `11-hearth-log`; close.

`npm run e2e` keeps the distill script chained last (unchanged).

---------------------------------------------------------------------------------------------------------------------------

## 11. Docs to update

- `docs/api/distillery.md`: Events section (replace "`sfx machine_done` ... `pipe_clunk`" with the `distill:step` payload, the
  five sounds and when each plays, flags `distilled`, `fermented`, `distilled_spirit`); Entity line gains `charge?`; Process cards
  list gains `ferment_wash_stirred` and the new numbers; rig legend `S`; "stirred" capability via the Chem Stirrer; test count.
- `docs/api/workshop.md`: the Chem Stirrer row (16 rpm, 4 su, six faces, `stirredAt`), goggles lines.
- `docs/api/audio.md`: "Later additions" - the distillery set (`src/audio/sfxDistill.ts`) and that `AmbienceState.boil` is now fed
  by boiling flasks within 12 blocks; chem modules no longer count as machine hum.
- `scripts/codex/README.md`: one line: process cards show in the crafting map under "Distillery".
- `docs/DISTILLERY_PLAN.md` section 15: no edit (the coordinator marks items done in WHATS_LEFT; plan status lines are history).
- Never `docs/WHATS_LEFT.md` (coordinator).

---------------------------------------------------------------------------------------------------------------------------

## 12. Acceptance checklist

- [ ] `chem_stirrer` exists as an appended Bronze workshop part, forge recipe at 600 C, front + front_on tiles, roster updated.
- [ ] `BASE_STRESS.chem_stirrer === 4`; stirs at `abs(rpm) >= 16` either direction; overstress/jam un-stirs (tests 9.5).
- [ ] `Workshop.stirredAt` exists; Game wires `sim.distill.stirredAt`; `capabilitiesOf` reports `stirred` in the live game (e2e 1).
- [ ] `rx_ferment_wash` has `speedUps: { stirred: 2 }`; stirred fermenting <= 60 s, unstirred unchanged (tests 9.2, e2e 1).
- [ ] Stirrer goggles lines and `, stirred` crosshair suffix match 5.6 exactly.
- [ ] `'distill:step'` is in `GameEvents` with the 4.3 payload; emitted once per STATEFUL state change, before the toast.
- [ ] `processFor` table of 4.4 holds; `charge` saved, sanitised, cleared on empty; old saves load.
- [ ] Side goal `run_spirit` in `DISTILL_SIDE_GOALS` via `SIDE_OBJECTIVES`; flag `distilled_spirit`; reward 4 glass beakers.
- [ ] Run toast `Spirit run finished - <litres> in the receiver` with fallback.
- [ ] `sfxDistill.ts` with five patches merged in `SFX`; names in `SfxName`; `sfx.test.ts` count, durations, jitter updated;
      Distillery no longer emits `machine_done` / `pipe_clunk`.
- [ ] Boil bed audible near a working flask, silent at 12+ blocks, never above layer peak 0.22; chem modules not machine hum.
- [ ] Drips paced (<= 1 per 1.2 s per receiver, <= 3 per s overall); slosh once per stirring start; no chorus on load.
- [ ] Balance edits of 4.12 applied; `distillProcess.test.ts` green including `ferment_wash_stirred` and 2-beaker rectify.
- [ ] `progression.json` four branches; `page.html` Distillery section; `npm run codex` + `preview.mjs` clean at 1280 and 390.
- [ ] `content.test.ts`, `gates.test.ts`, all existing tests green; `npm run e2e` distill script green on desktop and phone.
- [ ] Docs of 11 updated.

---------------------------------------------------------------------------------------------------------------------------

## 13. Out of scope

- Any change to boiling physics, grades, `FERMENT_*`, `BOIL_LPS`, `STILL_SETPOINTS` (balance is cards only).
- A running loop sound for the stirrer, liquid swirl rendering inside the vessel, a vessel particle effect.
- Feeding the boil bed from brewing's boiling buckets/kettles (never wired; a separate small task).
- New reactions that need stirring (Units 9, 10, 11 add rows with `speedUps`/`needs`).
- Vacuum pump, caps, filter bed (Unit 8); rig screen (Unit 6); burner (Unit 7); potions' Codex branch (Unit 10).
- A "Run your first spirit" entry in the sequential `OBJECTIVES` track (anti-pattern 6d).
- STEAM_PLAN's mech graph (SYSTEMS T2: deferred; it would feed `extraRpm`, which the stirrer then reads like any part).

---------------------------------------------------------------------------------------------------------------------------

## 14. Notes for the coordinator

1. **`drip` name collision.** SYSTEMS T9 lists `drip` for `sfxDistill.ts`, but `drip` is already brewing's cup drop
   (`sfxBrew.ts`, in `SfxName`). This spec names the distillery's drop `still_drip`. Please update SYSTEMS T9's list to
   `still_bubble` (one-shot at boil start) + boil layer, `glass_chime`, `still_drip`, `distill_clunk`, `stirrer_slosh`.
2. **`still_bubble` is both** a one-shot (boil start) and, loosely, the name of the bubbling loop; the loop itself is the existing
   `buildBoil` ambience layer, now fed by `AmbienceProbe` (it was never fed before - the brewing boil was silent too).
3. **Rig legend `S`** = `chem_stirrer` (letters taken: `B F V | C R T J A P`, Unit 8 `U X M`). Units 10/11 must not reuse `S`.
4. **`rx_ferment_wash` gains `speedUps: { stirred: 2 }`** - a one-field edit in Unit 0's table, owned here. Unit 0's "identical to
   today" guarantee is for the unstirred case and still holds.
5. **Balance edits** touch only `PROCESS_CARDS` rows and their roster lines; any unit that also edits `recipesDistill.ts` (6, 8, 10,
   11 append cards) merges by appending - the five changed rows are existing lines.
6. **Unit 6 chime swap** (`rigGhost.ts`) is a one-line edit done by whichever of 6/12 merges second.
7. **`sfx.test.ts` count** is a sum; every sound unit appends a term. Expect a trivial merge conflict on that line.
8. **Codex `page.html`** gets a small "Distillery" crafting section; SYSTEMS gave Unit 12 only `progression.json`, but without
   this edit the process cards are invisible in the crafting map (the API doc's claim is wrong today). Small, isolated, approve or
   drop.
9. **Hum change**: chem modules stop counting as `machineHum`. A large distillery hall gets quieter in the machine layer and louder
   in the boil layer - intended.
10. Measured yields (4.12) were taken with the existing fixture on 2026-11-22; if Unit 0's reaction engine or Unit 7/8 change the
    still step, re-run the card test - the margins are 12% or more except `distil_syrup` (397 vs 250, fine) and `rectify_spirit`
    (569 vs 500).
