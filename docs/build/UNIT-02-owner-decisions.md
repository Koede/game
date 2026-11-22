# Unit 2 - Owner decisions (build spec)

Status: design pass, written 2026-11-22 against `docs/build/SYSTEMS.md` (binding). Builder: read SYSTEMS.md sections 1.4, 3 (T7, T8,
T10), 6.1 item 5, 6.2, 6b J5, 6c, 6d before starting. Everything cited below was grepped in the tree at commit `2b24bdc`;
anything that does not exist yet is marked **NEW** (written by this unit) or **Unit 0** (written by the foundations unit, which
merges before this one).

**Threads:** T7 (Knowledge and gating - side goals: consumes Unit 0's `SIDE_OBJECTIVES` / `ObjectiveTracker.side()` /
`'objective:side'`, defines `BREW_SIDE_GOALS`), T8 (Reading the world - the drying rack's sky line and refusal wording, objective
texts in the game's voice), T10 (Saving - no new saved field; old saves with `six_cups` completed or its flag set must load
cleanly). T4: this unit adds no item, fluid or block, so no material-web row is needed. T9: no new sound (reuses the
tracker's `objective` sfx via Unit 0's side-goal completion and nothing else).

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

Three decisions the owner made (HEARTHWATT_COMPLETE_HANDOFF / `docs/WHATS_LEFT.md` section 0.3 and section 6), each small in code
and large in feel:

1. **"Taste them all" stops blocking the road.** Today `six_cups` sits in the ONE sequential objective list right after
   `first_brew`, so a player who brews one cup of green tea is told, for as long as it takes, that their next goal is to find
   coffee shrubs near the dunes, roast beans to 400 C, blend trail mix and drink all six - before the game will talk to them
   about the stone anvil, bronze and everything else. The fantasy of the tea and coffee bushes is a *tasting*: something you do
   on the side, cup by cup, over days, as you wander into the woodland and the dune edge. It becomes a **side goal**: shown in
   the Hearth Log under "Side goals", completed whenever the sixth distinct boost is tasted, in any order, at any time, with its
   reward of 4 coal and the toast "Side goal: Taste them all". Along the way every new taste is acknowledged with a quiet
   toast "New taste: Light Roast - 4 of 6", so the player knows the tasting card is filling up without opening a screen.
2. **The cup and cone are clay work, and every text says so.** The forge recipes for `clay_cup` and `drip_cone` are already gone
   from the code (the Clay Table presses `unfired_cup` / `unfired_cone`, the crucible fires them at 500 C for 8 s). What is left
   is *text that lies*: the `first_brew` goal still says "Forge a clay cup and a drip cone at 400 C", and two API docs still
   list the dead forge recipes. The Ember fantasy is "your hands, clay and the first fire": the first cup of tea should be
   something you shaped yourself at the clay table. This unit makes every player-facing and doc-facing sentence agree.
3. **Glass is a roof.** Today a drying rack under glass keeps running (it only checks for *opaque* blocks above) and is also
   never rained on (rain checks *solid* blocks) - a greenhouse is a rain-proof, rule-free rack shed, which makes the rack's two
   rules (needs sky, rain spoils) meaningless the moment the player has sand and a furnace. The owner's decision: the rack dries
   by **sun and moving air**, under the open sky; any roof - glass included - stops it. That turns rain into a real problem
   with three good answers that already exist or are being built in this same release:
   - Ember: watch the sky (the Hearth Log forecast already says when rain comes) and take the hides in.
   - Bronze: the **Drying Machine** (`mech_rack`, exists) dries "rain or shine" indoors at twice the speed - the roof problem is
     the reason to build one.
   - Bronze contraption (journey J5): a **weather cock** (Unit 16) gives a rain signal, a lever-driven piston pushes a framed
     roof over the racks while it rains and pulls it back when the sky clears; Unit 13's tween makes it glide.

   One rule now holds everywhere in the game: **whatever keeps the rain off is a roof.** Crops (`STOPS_RAIN` in
   `src/sim/crops.ts`), player exposure (`openSkyAbove` in `src/game/weather.ts`) and now the rack all use
   "solid or liquid above = covered".

None of the three adds an item, a block, a screen or a saved field. The unit is mostly deletion of contradictions, plus one new
toast and one new data-driven constant.

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 Consumed from Unit 0 (must exist before this unit starts; see SYSTEMS 6.1 item 5 and 6.5)

| id / API | shape (SYSTEMS 6.5) | how Unit 2 uses it |
|---|---|---|
| `SIDE_OBJECTIVES: ObjectiveSpec[]` in `src/content/objectivesSide.ts` | concatenation of `<FEATURE>_SIDE_GOALS` arrays | Unit 2 adds `...BREW_SIDE_GOALS` to it (if Unit 0 left a commented placeholder, uncomment it) |
| `ObjectiveTracker.side(): { spec: ObjectiveSpec; done: boolean }[]` in `src/game/objectives.ts` | side goals in list order with their done state | tests and e2e read it |
| bus event `'objective:side'` `{ id }` | emitted once per side goal on completion | tests assert it fires exactly once for `six_cups` |
| toast `"Side goal: <title>"` + reward + sfx `objective` | Unit 0's completion path | Unit 2 only asserts it |
| Hearth Log "Side goals" section (`src/ui/screens/log/hearthLog.ts`) | heading "Side goals", one row per side goal, done tick | e2e reads it. If Unit 0 merged without the panel, see 14.1 |
| side goals are NEVER `current`, never counted in "Goal N of M" (`src/ui/hud/goal.ts`) | Unit 0 | asserted by Unit 2's tests for `six_cups` |

Assumption on completion bookkeeping (Unit 0 decides; Unit 2 codes against either): completed side-goal ids are kept in the
same `completedIds` set that `ObjectivesSnapshot.completed` saves (so an old save whose `completed` array holds `'six_cups'`
shows the side goal done and never re-rewards). If Unit 0 instead keeps a separate optional `ObjectivesSnapshot.sideDone?:
string[]`, it must also treat an id found in `completed` as done (old saves) - Unit 2's save test (9.4) checks exactly this
behaviour through the public API, so either implementation passes.

### 2.2 Provided by Unit 2

| id / API | file | consumers |
|---|---|---|
| `BREW_SIDE_GOALS: ObjectiveSpec[]` (**NEW**, one entry: `six_cups`) | `src/content/objectivesBrew.ts` | `src/content/objectivesSide.ts` (Unit 0 file, one-line edit here) |
| `TASTE_BUFFS: readonly DrinkBuff[]` (**NEW**) - the buffs that count for "Taste them all" | `src/core/brewing.ts` | `src/game/drink.ts`, `src/content/progression.ts`; Unit 5 (sweetened drinks) and Unit 10 (elixirs) need do nothing: a drink of a counted buff counts automatically |
| `tastedCount(drunk: Record<string, number> \| undefined): number` (**NEW**, pure) | `src/game/drink.ts` | `drink()`, tests |
| drying-rack sky rule: "covered = any block that is solid or liquid above" | `src/sim/handWork.ts` `refreshSky` | Unit 16 (weather cock story J5), Unit 13 (tween over racks) - they need no API, only the rule |
| `stopsRain(def: BlockDef): boolean` (**NEW**, pure) | `src/core/sky.ts` (**NEW** file) | `src/sim/handWork.ts` now; crops/weather may adopt it later (not in this unit: see 13) |

### 2.3 What other units must NOT do (so this unit's rules hold)

- No unit inserts a side goal into `OBJECTIVES` (SYSTEMS 6d). `six_cups` leaves it.
- Unit 5 (sweetened drinks) and Unit 10 (elixirs, spirit, glowcap draught): if your new drinkable item carries an
  `ItemSpec.drink` whose `buff` is one of the six tea/coffee buffs, it counts as that taste (an Elixir of Swift tastes "Swift").
  A drink with a buff outside `TASTE_BUFFS` (`night_sight`, `tipsy`) never counts and never toasts "New taste". You do not
  touch `FLAG_SIX_CUPS`.
- Unit 16 (weather cock) and Unit 13 (piston tween): a moving roof block over a rack marks the rack's column dirty through the
  normal `block:changed` path (`HandWork.blockChanged`), so the rack re-checks the sky the tick after the roof arrives or
  leaves. Do not add a special case for racks.

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code (verified)

### 3.1 `six_cups`

- `src/core/constants.ts:345` `export const FLAG_SIX_CUPS = 'six_cups';`
- `src/content/objectivesBrew.ts` `BREW_OBJECTIVES` holds three specs: `boil_bucket`, `first_brew` (reward `2 clay_cup`),
  `six_cups` (title `'Taste them all'`, `age: 0`, condition `{ type: 'flag', flag: FLAG_SIX_CUPS }`, reward `amounts('4 coal')`,
  text `'Green, black and berry tea, light and dark roast, and trail blend each give a different boost. Brew and drink all six.'`).
- `src/content/objectives.ts:76` spreads `...BREW_OBJECTIVES` right after `bake_bread` (line 74) and before the handwork
  `place_anvil` goal.
- `src/game/drink.ts` `drink(player, slot)`: after the cup is swapped in, `const drunk = (player.stats.drunk ??= {})`,
  `firstOfKind = !drunk[item]`, increments, emits `'player:drank'`, then
  `if (firstOfKind && DRINKS.every((d) => drunk[d.key])) bus.emit('flag', { flag: FLAG_SIX_CUPS });`, then `'buff:gained'`,
  sfx `sip`, and the toast `` `${name}: ${effect}` `` or `` `${name} replaces ${old}` ``.
- `src/core/registry.ts:611` `DRINKS = ITEMS.filter((it) => it.drink !== undefined)` - **every** drinkable item. Today that is
  exactly the six cups, but Unit 5 (sweetened drinks) and Unit 10 (elixirs, spirit, draught) may add drinkable items; then
  `DRINKS.every(...)` would silently demand all of them. This is a latent bug this unit fixes with `TASTE_BUFFS`.
- `src/core/brewing.ts:81-89` `DRINK_BUFFS` (name, family, effect per buff) and `DRINK_BUFF_KEYS` (the six, in order).
- `src/content/progression.ts:416` solver rule
  `[FLAG_SIX_CUPS]: (p) => DRINKS.length === 6 && DRINKS.every((d) => p.items.has(d.key))` - same latent bug.
- `src/game/objectives.ts` `ObjectiveTracker`: one cursor over `OBJECTIVES`, `complete()` toasts `Done: <title>`. (Unit 0 adds
  side goals.)
- Tests that pin the current placement: `src/content/brewing.test.ts:124-131` ("places the goals right after bake_bread, in
  order": `['boil_bucket', 'first_brew', 'six_cups']`), `src/content/specRosterBrew.ts:72`
  `objectives: ['flag boiled_water', 'flag brewed', 'flag six_cups']` (spliced into `src/content/specRoster.ts:294`, compared in
  `src/content/content.test.ts:124-125`), `src/sim/playthrough.test.ts:294-300` (emits the three flags and expects each goal done
  in turn), `src/game/brewBuffs.test.ts:184` ("emits six_cups once, when the sixth distinct drink is drunk" - stays valid).
- Docs: `docs/api/brewing-content.md:99-101` and `:128` ("NOTE the tracker is strictly sequential: `six_cups` holds the HUD goal
  line"), `docs/api/brewing-buffs.md:39`.

### 3.2 Cup / cone recipes

- `src/content/recipesBrew.ts` header: "The clay cup and drip cone are pressed on the Clay Table and fired (recipesHand.ts)".
  `BREW_RECIPES` has NO recipe whose output is `clay_cup` or `drip_cone` (only `kettle_pot` is a forge recipe). **Verified gone.**
- `src/content/recipesHand.ts`: `CLAY_PIECES` lists `['unfired_cone', 2], ['unfired_cup', 1]` (clay loaded picks the piece, 4
  strokes each, `CLAY_STROKES`); `FIRED` lists `['clay_cup', 'unfired_cup', 'clay_cup_fired']`,
  `['drip_cone', 'unfired_cone', 'drip_cone_fired']`; fired by `smelt(id, out, from, 500, 8)` (500 C, 8 s, `minTier: 1`).
- `src/content/specRosterHand.ts:66-67, 104-105` pin those exact recipes - correct, unchanged.
- Leftover text found:
  1. `src/content/objectivesBrew.ts:13` `first_brew` text: `'Forge a clay cup and a drip cone at 400 C, set the cone on the cup,
     load it with dried tea (tea leaves dried in a crucible), then pour boiling water over it.'` - **wrong** (player-facing).
  2. `docs/api/brewing-content.md:92` "Furnace FORGE (tier 1): `clay_cup` (2 clay_cup <- 1 clay @400), `drip_cone` (1 clay, 1 fiber
     @400), ..." - **wrong**.
  3. `docs/api/brewing-content.md:130-131` (deviations) "my `clay_cup` / `drip_cone` forge recipes at 400 C are the brewing route.
     Decide which stays ..." - **decided; rewrite**.
  4. `docs/api/handwork-content.md:132` "`unfired_cup` (2 clay)" - **wrong** (code: 1 clay; the cone is 2).
  5. `docs/BREWING_PLAN.md:80` "clay_cup x2 <- 1 clay at 400 C; drip_cone <- 1 clay + 1 fiber at 400 C" - a historical plan; do
     not rewrite history, add a one-line superseded note (section 11).
- Clean (checked, no change): `src/content/itemsBrew.ts`, `blocksBrew.ts`, `machinesBrew.ts`, `src/ui/screens/food.ts` (only
  lists `clay_cup`/`drip_cone` as brewing-stage items), `docs/api/handwork-content.md:192-193` (already says the forge recipes are
  gone), `docs/api/brewing-ui.md`, `docs/api/food*.md`, `scripts/codex/progression.json` (lists "Clay Cup", "Drip Cone" by name
  only).

### 3.3 Drying rack sky rule

- `src/content/blocksHand.ts:41` `station('drying_rack', 'Drying Rack', 'Sticks lashed into a frame. Left under open sky by day
  it dries soaked hide into leather and grass into fiber. Rain sets the work back.', { tool: 'axe' }, 'hand', { strokesPerS: 1,
  sky: true })`. Note: "grass into fiber" is **false** - the only rack recipe is `timed('leather', 'drying_rack', '2 leather',
  '2 soaked_hide', 120)` (`src/content/recipesHand.ts:84`). Leftover text; fixed here.
- `src/sim/handRules.ts:39` `needsSky: timed && hs.sky === true, rainResets: timed && hs.sky === true`.
- `src/sim/handWork.ts`:
  - `HandNode { sky: boolean; rain: boolean; skyDirty: boolean; ... }` (cached, never saved).
  - `track()` registers `needsSky` stations in `columns` by `colKey(x, z)`.
  - `blockChanged(x, y, z, from, to)` marks racks below dirty when `from.opaque !== to.opaque || from.solid !== to.solid ||
    liquid changed`.
  - `waitReason(node)`: `'Rain - drying starts over'` (rainResets) / `'Raining'`, `'Needs open sky'`, `'Needs daylight'`.
  - `runTimed()` zeroes `e.progress` when `rainResets && n.rain && wetAt(...)`.
  - `refreshSky(n)` (lines ~326-338):
    ```ts
    for (let y = n.e.y + 1; y < WORLD_HEIGHT && (n.sky || n.rain); y++) {
      const b = blockOf(world.getVoxel(n.e.x, y, n.e.z));
      if (b.opaque) n.sky = false;
      if (b.solid || b.liquid !== null) n.rain = false;
    }
    ```
    Glass is `opaque: false, solid: true` (`src/content/blocks.ts:166-167`), so under glass `sky = true`, `rain = false`:
    the rack runs and is never rained on. **This is the behaviour to change.**
- `src/sim/handViews.ts` `buildView` builds the line `` `${def.name} - ${name(input.item)} ${shown}${wait ? ` (${wait.toLowerCase()})` : ''}` ``,
  e.g. `"Drying Rack - soaked hide 37/120 s (needs open sky)"` (51 chars, within the 60-char HUD rule).
- The other "sky" rules, for congruence: `src/game/weather.ts:98-110` `blocksRain` / `openSkyAbove` (solid or liquid);
  `src/sim/crops.ts:29-30` `STOPS_RAIN = BLOCKS.map((b) => b.solid || b.liquid !== null)`; `src/sim/surroundings.ts:53-54`
  machine `openSky` (solid above) used by solar panels and wind turbines ("Needs open sky above").
- Blocks that are solid but not opaque today (they start covering a rack with this change; computed from the registry):
  `glass solar_panel hand_quern mortar tanning_trough alloy_pot still_base boiling_flask boiling_flask_done reaction_vessel
  reaction_vessel_done column_segment condenser_coil cooling_jacket receiver receiver_done glass_tube airlock_cap chem_port
  essentia_jar void_jar essentia_tube drive_shaft conveyor_belt signal_wire pressure_plate rail`; liquids `water lava oil`
  (all non-opaque). Every one of these already keeps rain off a crop and a player; now it keeps sun and wind off a rack too.
- Tests pinning the old behaviour: `src/sim/handWork.test.ts:233-245` ("rain resets the rack, but a roof keeps the rain off" -
  puts `glass` at y 8 and expects `waitReason` null and progress growing to 7). Must change (9.2).
- Docs: `docs/api/handwork.md:102-108` explicitly states "glass lets the light in, so the rack still runs under glass".
- The Bronze answer exists: `src/content/itemsWorkshop.ts:23` `mech_rack` "Drying Machine": "dries in half the time, rain or
  shine". Its recipe lookup is `src/workshop/workshop.ts:522`; it has no sky check. Unchanged.

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 Side goal "Taste them all"

| field | value | reasoning |
|---|---|---|
| id | `six_cups` (unchanged) | Saves store completed ids and flags as strings; keeping the id means an old save that completed it shows it done and an old save with the flag completes it on load. SYSTEMS T7 line 361 calls it "`taste_them_all` = existing `six_cups`": that name is descriptive only; the id stays `six_cups` (coordinator note 14.2). |
| title | `Taste them all` (unchanged) | T1.4 objective voice: imperative, short. |
| age | `0` (Ember; written as in the existing file - objective `age` fields are plain AGES indices across all objective files; `ageIndexOf('ember')` would be the same 0 if the builder prefers, see 14.4) | All six drinks are Clay-Furnace goods (dark roast at 400 C). |
| condition | `{ type: 'flag', flag: FLAG_SIX_CUPS }` (unchanged) | Flags are recorded from minute one and saved; no new condition type, no solver change beyond 4.2. |
| reward | `amounts('4 coal')` (unchanged) | 4 coal = 3.2 MJ of hearth heat, a real gift at Ember that the 400 C dark roast step itself consumes fuel for. Side goals reward like main goals. |
| text (NEW wording) | `Green, black and berry tea, light and dark roast, and trail blend each give a different boost. Drink one of each, in any order - a new taste shows a toast.` | Says what, how, and that order is free; 155 chars, fits the Hearth Log card (it wraps; the HUD never shows side-goal text). |

`BREW_OBJECTIVES` keeps `boil_bucket` and `first_brew` in the main track (they teach boiling water on the furnace and the cup
setup, both on the spine's furnace). `BREW_SIDE_GOALS` holds `six_cups` alone.

### 4.2 What counts as a taste: `TASTE_BUFFS` (NEW)

```ts
// src/core/brewing.ts (NEW export, next to DRINK_BUFF_KEYS)
/** The boosts "Taste them all" asks for: every tea and coffee buff. Any drink granting one of them is that taste. */
export const TASTE_BUFFS: readonly DrinkBuff[] = DRINK_BUFF_KEYS.filter((b) => DRINK_BUFFS[b].family === 'tea' || DRINK_BUFFS[b].family === 'coffee');
```

Today it equals `DRINK_BUFF_KEYS` (6 entries), so behaviour for the six cups is identical to the present rule (each cup has a
distinct buff: `green_tea` spring, `black_tea_cup` hearthkept, `berry_tea` mending, `light_roast` swift, `dark_roast` vigor,
`trail_blend_cup` lasting - `src/content/specRosterBrew.ts` `drinks`). Counting by buff instead of by item key:

- is robust to new drinkable items from Units 5 and 10 (a sweetened light roast or an Elixir of Swift tastes "Swift");
- never requires drinking an Ember-impossible item for an Ember side goal;
- stays data-driven (no hard-coded item list; SYSTEMS 6d).

If Unit 10 widens `DrinkBuff` / `DrinkFamily` with a `tonic` family (`night_sight`), the filter keeps it out automatically.

### 4.3 Tasted count and the "New taste" toast (NEW)

```ts
// src/game/drink.ts (NEW export)
/** How many of TASTE_BUFFS the drinks in `drunk` (PlayerStats.drunk: item key -> cups) have granted. */
export function tastedCount(drunk: Readonly<Record<string, number>> | undefined): number
```
Implementation: build a `Set<DrinkBuff>` from `Object.keys(drunk ?? {})` mapped through `drinkOf(key)?.buff` (keys of items
no longer registered, or with count <= 0, are skipped), keep only members of `TASTE_BUFFS`, return the size.

In `drink()`, replace the `firstOfKind && DRINKS.every(...)` line with:

```ts
const before = tastedCount(drunk);        // computed BEFORE drunk[item]++
drunk[item] = (drunk[item] ?? 0) + 1;
const after = tastedCount(drunk);
bus.emit('player:drank', { item });
if (after > before && after >= TASTE_BUFFS.length) bus.emit('flag', { flag: FLAG_SIX_CUPS });
```
and, after the existing buff toast is emitted (order matters: the buff toast first, then the taste toast, so on a phone the
stack reads top-down "Swift: Walk, sprint and swim 15% faster" then "New taste: Light Roast - 4 of 6"):

```ts
if (after > before && after < TASTE_BUFFS.length) {
  bus.emit('toast', { text: `New taste: ${itemOrNull(item)?.name ?? item} - ${after} of ${TASTE_BUFFS.length}`, kind: 'info', item });
}
```
On the sixth taste no "New taste" toast is sent: the tracker's "Side goal: Taste them all" toast (Unit 0) is the
acknowledgement. Remove the now-unused `firstOfKind` variable; keep the `DRINKS` import only if still used (it is not after
this change: remove it to keep lint clean).

Edge facts:
- Strings: `New taste: Green Tea - 1 of 6` (29 chars) to `New taste: Trail Blend - 5 of 6` (31 chars); longest
  registered drink name today is "Trail Blend"; Unit 10's "Elixir of Hearthkept"-style names stay under 45 chars.
- A drink of a buff already tasted (second green tea, or a sweetened green tea) sends no taste toast.
- `FLAG_SIX_CUPS` is still emitted at most once per drink call and only on the call that crosses to 6; the tracker's flag set
  de-duplicates across sessions anyway.
- Old saves: `stats.drunk` is keyed by item (`src/game/playerState.ts:36-37, 420, 456`), so counts carry over; nothing new is
  saved.

### 4.4 `first_brew` text (cup and cone are clay work)

New text (replaces line 13 of `src/content/objectivesBrew.ts`):

`Press a cup (1 clay) and a drip cone (2 clay) at the Clay Table and fire both in the crucible at 500 C. Set the cone on the cup, load it with dried tea, then pour boiling water over it.`

Reasoning, number by number: cup and cone costs come from `CLAY_PIECES` (1 and 2 clay; the clay *loaded* picks the piece, which is
why the counts are named - loading 2 clay makes a cone, 1 a cup); 500 C / crucible from `FIRED` + `smelt(..., 500, 8)`; "dried
tea" is the item name (`dried_tea`, smelted from tea leaves at 150 C - the old parenthesis "tea leaves dried in a crucible" is
dropped for length; the Kitchen chip of the furnace already lists the step). Title "Brew a cup" and reward `2 clay_cup` stay.

Do NOT write the constants into the string by template (`${CLAY_STROKES}` etc.): objective text is static prose today in every
objectives file; the content test in 9.3 pins it to the recipe data instead, so a future recipe change fails a test rather than
silently lying.

### 4.5 Drying rack: glass is a roof

**Rule (normative):** a drying rack has *open sky* when no block in its column above it, up to the top of the world, is solid
or liquid - exactly the rain rule. Consequences:

| above the rack | before | after | line (with soaked hide loaded, by day) |
|---|---|---|---|
| nothing | runs; rain resets | runs; rain resets (unchanged) | `Drying Rack - soaked hide 37/120 s` |
| oak log / stone / planks (opaque, solid) | paused "Needs open sky" | same | `Drying Rack - soaked hide 37/120 s (needs open sky)` |
| glass (solid, not opaque) | **runs, never rained on** | paused "Needs open sky", progress kept, never rained on | `Drying Rack - soaked hide 37/120 s (needs open sky)` |
| water/lava/oil source above | runs, never rained on | paused "Needs open sky" | same |
| torch, tall grass, cable, leaves? | runs (not solid) | runs (not solid) | - |
| another rack / quern / jar / rail / wire (solid, not opaque) | runs | paused | same |

(Leaves: whatever `solid` says in the registry decides; the rule never special-cases a key.)

Progress under a roof is **kept**, not reset - the rack pauses exactly as it already does under a log roof; only rain falling on
an exposed rack resets it (unchanged). This is what makes the J5 piston roof worth building: slide the roof over when rain is
coming, the hides wait; slide it back, drying resumes from where it was.

Why sun-and-wind, not light: the rack's fantasy is a frame of sticks in the breeze. A greenhouse is warm and still - hides go
mouldy, not dry. The block description carries that reasoning in one clause so the rule is discoverable in the item tooltip.

**New rack description** (`src/content/blocksHand.ts:41`):

`Sticks lashed into a frame. Left under open sky by day, sun and wind dry soaked hide into leather in 2 minutes. Any roof stops it - glass too - and rain sets the work back.`

("2 minutes" = `timeS` 120 of the leather recipe; "grass into fiber" removed because no such recipe exists.)

**Wait reason wording:** unchanged strings (`'Needs open sky'`, `'Needs daylight'`, `'Rain - drying starts over'`) - they already
say the fix and fit 60 chars. No glass-specific text: the line stays short on phones, and the tooltip explains glass.

**Glass description** stays: `'Clear glass. It lets the daylight in and keeps the weather out.'` - still true (keeps weather out;
the rack needs weather).

**Drying Machine description** stays (`"... rain or shine ..."`); it is the Bronze indoor answer and now reads as one.

### 4.6 The shared helper (NEW `src/core/sky.ts`)

```ts
/** Whether a block keeps rain (and, for a drying rack, sun and wind) off what is under it: anything solid, or a liquid.
 *  The one roof rule (SYSTEMS T8 / Unit 2): crops (src/sim/crops.ts STOPS_RAIN) and the player (src/game/weather.ts
 *  openSkyAbove) use the same test. */
export const stopsRain = (def: Pick<BlockDef, 'solid' | 'liquid'>): boolean => def.solid || def.liquid !== null;
```
Used by `HandWork.refreshSky` only in this unit. Do NOT edit `crops.ts` or `weather.ts` (not even a comment): Unit 3 edits
crops and Unit 16 may edit weather; leave them untouched to avoid merge noise (out of scope 13).

---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour and rules, edge cases

### 5.1 Side goal

1. A brand-new world: the HUD goal line goes `bake_bread` -> `boil_bucket` -> `first_brew` -> `place_anvil` ("Goal N of M" with M
   one smaller than before). `six_cups` never appears in the HUD goal tracker.
2. Drinking the six tastes in any order, interleaved with any main goals, at any time (before `boil_bucket` is even current -
   e.g. a dev-mode player handed six cups) completes the side goal at the next tracker check (`CHECK_INTERVAL_S` 0.25 s).
3. Toast sequence on the sixth taste: `"<Buff>: <effect>"` (from `drink`), then `"Side goal: Taste them all"` (Unit 0), sfx
   `objective`, reward 4 coal to the pack (overflow goes to Unit 0's pending-rewards path, same as main goals).
4. **Old save, `six_cups` already completed** (`completed` contains `'six_cups'`): loads; main cursor skips nothing it should
   not; side goal shows done; no toast, no reward.
5. **Old save, stuck ON `six_cups`** (flag not set, `six_cups` current before): after load the main cursor lands on the next
   main goal (`place_anvil`) - or further, completing at once any goal whose condition was already met (normal tracker
   behaviour: "An objective whose condition was met early completes the moment it comes up"). That may toast several
   `Done: ...` in a row on the first check after loading; acceptable and correct (they were earned). The side goal is open.
6. **Old save, flag set but goal not completed** (e.g. the player drank six before reaching it in the sequential list):
   first check after load completes the side goal with toast and reward. Correct: never rewarded before.
7. **Old save, five of six drunk**: the next new taste emits the flag (count crosses to 6) - `stats.drunk` is the saved source.
8. Peaceful mode, death, respawn: nothing special; stats and flags survive death as today.
9. Multiplayer: none exists.

### 5.2 Taste toast

- Drinking is refused during the 1 s `DRINK_COOLDOWN_S`: nothing counted, no toast (unchanged refusal path).
- A drink item later removed from the registry but present in an old save's `stats.drunk`: skipped by `tastedCount`.
- `stats.drunk` missing (save older than brewing): `drunk ??= {}` as today; count 0.

### 5.3 Drying rack

1. **Placing glass over a running rack**: `World` fires `block:changed` -> `HandWork.blockChanged` -> the column's racks below
   get `skyDirty = true` (glass changes `solid` from air's false to true, so the existing condition triggers) -> next tick
   `waitReason` refreshes -> `'Needs open sky'`; `e.progress` is frozen; the station stays on the active list (it has input) and
   costs one cached check per tick (no world reads until dirty again).
2. **Removing the glass**: column dirty again -> sky true -> progress continues from the frozen value. If it is raining at that
   moment (`wetAt` true for the column), progress resets to 0 as for any exposed rack in rain.
3. **Rain while covered by glass**: `rain` is false (covered) -> no reset; reason `'Needs open sky'`.
4. **Night under glass**: `'Needs open sky'` wins over `'Needs daylight'` (the existing order: rain, then sky, then sun).
5. **Save and load mid-dry under glass**: `HandEntity.progress` is saved as today; `sky`, `rain` are runtime-only and start
   `skyDirty: true` in `track()`, so the first tick after load recomputes them with the new rule. An old save that had a rack
   running under glass resumes *paused* with its progress intact - the player sees `(needs open sky)` and either moves the rack
   or breaks the glass. No migration.
6. **Chunk unload/reload**: stations re-`track()` from saved entities with `skyDirty: true`; same as 5.
7. **Column above in an unloaded chunk**: impossible (columns are whole within a chunk in x/z).
8. **Moving structures** (Unit 13 pistons/bearings/frames carrying a roof): each moved cell is a block change, column dirty,
   recomputed. During Unit 13's visual tween the *block* change has already happened at the step's start or end (Unit 13's
   rule); the rack follows the blocks, not the tween. A rack carried *by* a contraption is re-tracked at its new cell by the
   existing relocate path and starts dirty.
9. **Breaking the rack** under glass: releases its slots as today.
10. **Tanning trough** (`sky` not set): unaffected; still runs anywhere.
11. **Drying Machine** (`mech_rack`, workshop): unaffected; no sky rule.
12. **Performance**: `refreshSky` walks at most `WORLD_HEIGHT - y` cells once per dirty event; it already did; the loop now stops at
    the first covering block (both flags drop together), so it is never slower.

### 5.4 Failure / refusal messages (unchanged, listed for the builder's tests)

- `'Drying Rack works by itself - wait'` (stroke on a loaded rack; `handWork.test.ts:209`).
- Wait reasons in the line, lowercased in brackets: `(needs open sky)`, `(needs daylight)`, `(rain - drying starts over)`.

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Strings (all T8 / SYSTEMS 1.4 grammar)

| where | string | status |
|---|---|---|
| side goal title | `Taste them all` | unchanged |
| side goal text | `Green, black and berry tea, light and dark roast, and trail blend each give a different boost. Drink one of each, in any order - a new taste shows a toast.` | NEW wording |
| side goal reward line (Hearth Log, existing `rewardText`) | `Reward: 4 Coal` | generated |
| completion toast | `Side goal: Taste them all` | Unit 0 |
| taste toast (kind `info`, item icon = the drink) | `New taste: <Drink Name> - <n> of 6` e.g. `New taste: Light Roast - 4 of 6` | NEW |
| `first_brew` text | `Press a cup (1 clay) and a drip cone (2 clay) at the Clay Table and fire both in the crucible at 500 C. Set the cone on the cup, load it with dried tea, then pour boiling water over it.` | NEW wording |
| rack description | `Sticks lashed into a frame. Left under open sky by day, sun and wind dry soaked hide into leather in 2 minutes. Any roof stops it - glass too - and rain sets the work back.` | NEW wording |
| rack line under glass | `Drying Rack - soaked hide 37/120 s (needs open sky)` | existing format |

No exclamation marks; " - " separates; numbers with units ("500 C", "2 minutes" in prose descriptions is the item-description
style: compare `"Metal stays molten for 20 seconds"` in the casting bench description).

### 6.2 Phone layout

- No new screen, button or chip. The Hearth Log's "Side goals" section is Unit 0's; rows are list items like "Up next" and
  "Done" (`hw-log__item`), well above 44 px when tappable - they are not tappable (read-only), so no touch target applies.
- The taste toast uses the existing `Toasts` stack (`src/ui/kit/feedback.ts`, max 4, identical messages bump a counter). Two
  toasts at once (buff + taste) fit the 4-stack on a 390 px portrait screen; strings under ~45 chars stay on one line at the
  toast font.
- Crosshair line for the rack is unchanged in length.

### 6.3 Sound and particles (T9)

- No new sfx. The taste toast is silent (the `sip` already played). Side-goal completion plays `objective` (Unit 0).
- The rack has no particles today; none added. (Unit 16 may add a creak to the weather cock; not here.)

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

### 7.1 TypeScript sketches

```ts
// src/content/objectivesBrew.ts (after the change)
export const BREW_OBJECTIVES: ObjectiveSpec[] = [
  { id: 'boil_bucket', /* unchanged */ },
  { id: 'first_brew', title: 'Brew a cup', age: 0, condition: { type: 'flag', flag: FLAG_BREWED }, reward: amounts('2 clay_cup'),
    text: 'Press a cup (1 clay) and a drip cone (2 clay) at the Clay Table and fire both in the crucible at 500 C. Set the cone on the cup, load it with dried tea, then pour boiling water over it.' },
];
/** Side goals of brewing (SYSTEMS T7): optional, any order, never current. Concatenated in src/content/objectivesSide.ts. */
export const BREW_SIDE_GOALS: ObjectiveSpec[] = [
  { id: 'six_cups', title: 'Taste them all', age: 0, condition: { type: 'flag', flag: FLAG_SIX_CUPS }, reward: amounts('4 coal'),
    text: 'Green, black and berry tea, light and dark roast, and trail blend each give a different boost. Drink one of each, in any order - a new taste shows a toast.' },
];

// src/content/objectivesSide.ts (Unit 0's file; Unit 2's only edit)
import { BREW_SIDE_GOALS } from './objectivesBrew';
export const SIDE_OBJECTIVES: ObjectiveSpec[] = [...BREW_SIDE_GOALS /* , ...other units */];

// src/core/brewing.ts
export const TASTE_BUFFS: readonly DrinkBuff[] = /* 4.2 */;

// src/game/drink.ts
export function tastedCount(drunk: Readonly<Record<string, number>> | undefined): number;

// src/core/sky.ts (NEW file)
export const stopsRain: (def: Pick<BlockDef, 'solid' | 'liquid'>) => boolean;

// src/content/progression.ts (solver rule, replaces line 416)
[FLAG_SIX_CUPS]: (p) => TASTE_BUFFS.every((b) => DRINKS.some((d) => d.drink!.buff === b && p.items.has(d.key))),

// src/content/specRosterBrew.ts
objectives: ['flag boiled_water', 'flag brewed'],
/** Side goals of brewing (signatures as content.test.ts writes them). */
sideObjectives: ['flag six_cups'],   // NEW field
```

### 7.2 Save

- **No new saved field.** `ObjectivesSnapshot` (`completed`, `flags`, `peaks`, `age`, `pendingRewards`) and
  `PlayerStats.drunk` are unchanged. Side-goal done state is Unit 0's (see 2.1).
- `HandEntity` unchanged; `HandNode.sky/rain` are runtime caches.
- Old-save behaviour is specified in 5.1 (4-7) and 5.3 (5); tests 9.4.
- No `SAVE_VERSION` bump (T10 rule 3).

---------------------------------------------------------------------------------------------------------------------------

## 8. Implementation plan (ordered; each step leaves `npx tsc --noEmit` and `npx vitest run` green)

**Step 0 - check Unit 0 landed.** `src/content/objectivesSide.ts` exists and exports `SIDE_OBJECTIVES`;
`ObjectiveTracker.side()` exists; `hearthLog.ts` renders a "Side goals" section. If the panel section is missing, do 14.1.

**Step 1 - `TASTE_BUFFS`.** `src/core/brewing.ts`: add the export after `DRINK_BUFF_KEYS` (line 89).

**Step 2 - drink counting.** `src/game/drink.ts`:
- import `TASTE_BUFFS` from `'../core/brewing'` (same import line as `CUP_ITEM, DRINK_BUFFS`); drop `DRINKS` from the registry import
  if unused.
- add `tastedCount` (export, pure, above `drink`).
- in `drink()`: compute `before`, increment, compute `after`, flag rule and taste toast exactly as 4.3. Update the JSDoc of
  `drink()` to mention the taste toast.

**Step 3 - solver.** `src/content/progression.ts:416`: replace the rule (7.1). Import `TASTE_BUFFS` from `'../core/brewing'`.
The rule stays true at Clay-Furnace tier (all six drinks reachable), so `brewing.test.ts:144` keeps passing.

**Step 4 - move the goal.** `src/content/objectivesBrew.ts`: remove `six_cups` from `BREW_OBJECTIVES`, add `BREW_SIDE_GOALS`
(7.1), rewrite `first_brew` text (4.4), update the file's header comment to "Goals of brewing ... `boil_bucket` and `first_brew`
on the main track after `bake_bread`; `six_cups` is a side goal (SYSTEMS T7)". `src/content/objectivesSide.ts`: spread
`...BREW_SIDE_GOALS`.

**Step 5 - roster and pinned tests.** `src/content/specRosterBrew.ts:72` objectives -> two entries; add `sideObjectives`.
`src/content/specRoster.ts:294` needs no edit (it spreads `BREW_SPEC.objectives`). If Unit 0 added a side-goal signature check
in `content.test.ts` (e.g. `SIDE_OBJECTIVES.map(signature)` vs a roster list), add `...BREW_SPEC.sideObjectives` to that list;
otherwise add the test of 9.3. Update `brewing.test.ts` and `playthrough.test.ts` per 9.

**Step 6 - rack rule.** NEW `src/core/sky.ts` with `stopsRain`. In `src/sim/handWork.ts` `refreshSky`:
```ts
for (let y = n.e.y + 1; y < WORLD_HEIGHT; y++) {
  if (stopsRain(blockOf(world.getVoxel(n.e.x, y, n.e.z)))) { n.sky = false; n.rain = false; break; }
}
```
(`sky` and `rain` keep both fields: `rain` still decides the reset, `sky` the pause; with one rule they are equal, which the
docstring on `HandNode.sky` now states: "Cached: nothing solid or liquid above (open sky) - the same cells rain reaches".)
In `blockChanged`, the dirty condition may drop the `from.opaque !== to.opaque` term (opacity no longer matters); keep solid and
liquid. Update the class/method comments that mention "open sky" if they say opaque.

**Step 7 - rack text.** `src/content/blocksHand.ts:41` description (4.5). `src/sim/handTypes.ts:41` comment of `needsSky`:
"Timed stations: runs only by day with nothing solid or liquid above (glass is a roof)."

**Step 8 - tests** (section 9), **e2e** (section 10), **docs** (section 11).

Helpers to reuse, not rewrite: `drinkOf` (`src/game/drink.ts`), `itemOrNull`, `DRINKS` (`src/core/registry.ts`), `amounts`
(`src/content/amounts.ts`), handWork test fixture `setup()` / `rackWith()` / `t.run(s, sunUp, wetAt)` in
`src/sim/handWork.test.ts`, `rig()` / `r.hold` / `r.run` / `r.seen.toasts|flags` in `src/game/brewBuffs.test.ts`, the
playthrough helpers `play.*`, `done(id)` in `src/sim/playthrough.test.ts`.

---------------------------------------------------------------------------------------------------------------------------

## 9. Tests (vitest)

### 9.1 `src/game/brewBuffs.test.ts` (extend the "drinking" describe)

1. keep `'emits six_cups once, when the sixth distinct drink is drunk'` unchanged (must still pass).
2. NEW `'toasts each new taste with the count, not the sixth'`: drink `DRINKS` (the six cups) in order with
   `r.run(DRINK_COOLDOWN_S + 0.1)` between; expect `r.seen.toasts.filter((t) => t.startsWith('New taste:'))` to equal
   `['New taste: Green Tea - 1 of 6', ..., 'New taste: Dark Roast - 5 of 6']` (build the expected list from
   `DRINKS.slice(0, 5).map((d, i) => \`New taste: ${d.name} - ${i + 1} of 6\`)` so drink order in the registry does not matter).
3. NEW `'a second cup of a tasted boost is no new taste'`: drink green tea twice -> exactly one "New taste" toast.
4. NEW `'tastedCount counts boosts, not items, and skips unknown keys'`: `tastedCount(undefined) === 0`;
   `tastedCount({ green_tea: 3, nonsense_key: 2 }) === 1`; `tastedCount(Object.fromEntries(DRINKS.map((d) => [d.key, 1]))) === 6`;
   `tastedCount({ green_tea: 0 }) === 0`.
5. NEW `'TASTE_BUFFS is every tea and coffee boost'`: `expect([...TASTE_BUFFS].sort()).toEqual([...DRINK_BUFF_KEYS].sort())` and
   length 6.

### 9.2 `src/sim/handWork.test.ts`

1. REWRITE `'rain resets the rack, but a roof keeps the rain off'` (lines 233-245): keep the first half; then
   `t.world.put(5, 8, 5, 'oak_log')` (an opaque roof) instead of glass; expect after `t.run(2, true, () => true)` that
   `waitReason === 'Needs open sky'` and `progress` still ~5 (`toBeCloseTo(5, 0)`): a roof keeps the rain off (no reset) and
   pauses.
2. NEW `'glass is a roof: the rack pauses under it and keeps its progress'`: `rackWith(t)`; `t.run(4)`; progress ~4;
   `t.world.put(5, 9, 5, 'glass')`; `t.run(5)`; expect `view` `{ state: 'waiting', waitReason: 'Needs open sky' }`, progress ~4;
   `t.run(3, true, () => true)` (rain) -> progress still ~4 (covered, no reset); `t.world.put(5, 9, 5, 'air')`; `t.run(7)` ->
   state `'ready'`, output 2 leather.
3. NEW `'water above is a roof too'`: `t.world.put(5, 7, 5, 'water')` -> `'Needs open sky'`.
4. NEW `'a non-solid block above does not cover'`: put `'torch'` (or any registered block with `solid: false`, e.g. `tall_grass`;
   pick by `BLOCKS.find((b) => !b.solid && b.liquid === null && b.key !== 'air')` to avoid key guessing) at y 9 -> rack runs
   (`waitReason` null).
5. NEW `'the sky check reruns when a roof arrives or leaves'`: with a running rack, put glass at y 20 (far up) -> paused; remove ->
   running; asserts `blockChanged` dirtying works for a solid non-opaque block (the case the old `opaque` term mattered for).
6. NEW in `src/core/sky.test.ts` (**NEW** file): `stopsRain(blockOf(blockId('glass')))` true, `'oak_log'` true, `'water'` true,
   `'air'` false, and parity: `for (const b of BLOCKS) expect(stopsRain(b)).toBe(b.solid || b.liquid !== null)`.

`src/sim/handWorkContent.test.ts:74` (puts a real `drying_rack`): run it; if it builds a roofed scene expecting work, fix the scene,
not the rule.

### 9.3 Content tests

1. `src/content/brewing.test.ts:124-131` REWRITE `'places the goals right after bake_bread, in order'`:
   ```ts
   const ids = OBJECTIVES.map((o) => o.id);
   const at = ids.indexOf('bake_bread');
   expect(ids.slice(at + 1, at + 3)).toEqual(['boil_bucket', 'first_brew']);
   expect(ids).not.toContain('six_cups');
   ```
2. NEW (same file) `'Taste them all is a side goal, rewarded with 4 coal'`:
   `expect(SIDE_OBJECTIVES.find((o) => o.id === 'six_cups')).toMatchObject({ title: 'Taste them all', condition: { type: 'flag', flag: FLAG_SIX_CUPS }, reward: [{ item: 'coal', count: 4 }] })`.
3. NEW `'the first brew goal names the clay table pieces as the recipes make them'`:
   ```ts
   const text = OBJECTIVES.find((o) => o.id === 'first_brew')!.text;
   expect(text).not.toMatch(/forge/i);
   const cup = recipesFor('unfired_cup')[0], cone = recipesFor('unfired_cone')[0];
   expect(text).toContain(`cup (${cup.inputs[0].count} clay)`);
   expect(text).toContain(`drip cone (${cone.inputs[0].count} clay)`);
   expect(text).toContain(`${recipesFor('clay_cup')[0].minTempC} C`);
   ```
4. NEW `'no forge recipe makes the cup or the cone'`:
   `expect([...recipesFor('clay_cup'), ...recipesFor('drip_cone')].every((r) => r.station === 'furnace' && r.kind === 'smelt')).toBe(true)`
   and both lists have length 1 (the firing recipe).
5. `src/content/brewing.test.ts:144` (solver: the three flags reachable at clay tier) - unchanged, must pass with the new rule.
6. NEW `src/content/handwork.test.ts`: `'the drying rack description says a roof, glass too, stops it'`:
   `expect(block('drying_rack').desc).toMatch(/glass/)` and `.not.toMatch(/fiber/)`.
7. `content.test.ts` `'has the objectives of 2.7 in order'` passes via the roster change (`flag six_cups` gone from the main list).
   If Unit 0 added a side-goal roster comparison, include `BREW_SPEC.sideObjectives`.

### 9.4 Objectives / save (`src/game/objectives.test.ts`, extending Unit 0's side-goal tests)

1. NEW `'six_cups completes as a side goal out of order and never becomes current'`: fresh tracker; emit `flag six_cups` while
   `current.id` is the first objective; `tracker.check()`; expect `tracker.side().find((s) => s.spec.id === 'six_cups')!.done`
   true, `tracker.current!.id` unchanged, one `'objective:side'` with `{ id: 'six_cups' }`, a toast `'Side goal: Taste them all'`,
   pack +4 coal.
2. NEW `'an old save that completed six_cups loads it done without a second reward'`: `load({ completed: ['six_cups', ...ids up
   to first_brew], flags: ['six_cups', ...], peaks, age: 0, pendingRewards: [] })`; `check()`; side done; no toast; coal count
   unchanged; `tracker.current?.id` is not `'six_cups'` and `isComplete('first_brew')` is true (the fixture player holds no
   stone anvil, so the next main goal `place_anvil` is current).
3. NEW `'an old save stuck on six_cups moves on to the next main goal'`: snapshot with completed up to `first_brew`, no
   `six_cups` flag; after `load` + `check()` the current goal is not `six_cups` (it is `place_anvil`) and the side goal is open.
4. NEW `'an old save with the flag but not the goal completes the side goal once on load'`.

### 9.5 Playthrough (`src/sim/playthrough.test.ts:294-300`)

Change the loop to the two main goals:
```ts
for (const [flag, id] of [[FLAG_BOILED_WATER, 'boil_bucket'], [FLAG_BREWED, 'first_brew']] as const) { ... }
```
and right after it, assert the side goal is optional with the test's existing `tracker` handle (`const { sim, player, tracker,
kit } = play;`, line 183): `expect(tracker.side().find((s) => s.spec.id === 'six_cups')?.done).toBe(false)` and
`expect(tracker.current?.id).toBe('place_anvil')` (`HAND_OBJECTIVES.anvil`, the goal spread right after `...BREW_OBJECTIVES` in
`src/content/objectives.ts:77`). The next line
(`play.work(ANVIL, ...)`, `done('hammer_plate')`) proves the track moved on without the six cups. Update the STAND-IN comment:
"the two brewing goals complete from their flags alone; Taste them all is a side goal (SYSTEMS T7)".

### 9.6 Expected test count change

Roughly +14 new cases, 4 rewritten, none deleted (the old glass assertion is replaced, not dropped).

---------------------------------------------------------------------------------------------------------------------------

## 10. E2E (`scripts/e2e-handwork.mjs` via `scripts/lib/e2eHandwork.mjs`)

Brewing has no e2e script; the handwork run already builds a yard with a drying rack (cell 6) and already drives drinking-free
handwork. Both new steps go into `handworkSteps` in `scripts/lib/e2eHandwork.mjs`, after the existing step
`'the trough soaks hides and the rack dries them to leather: timed work, the line counts seconds'`. Run:

```
node scripts/e2e-handwork.mjs --device=desktop          # no HW_GPU
node scripts/e2e-handwork.mjs --no-build --device=phonePortrait
```
Screenshots land in `test-results/e2e-handwork/<device>-<name>.png`.

### 10.1 Step `'glass over the drying rack pauses it and keeps its progress; open sky resumes'`

1. Setup (`window.__hw` only): `clearInventory()`, `give('soaked_hide', 2)`, `setWeather('clear')`, `setTime(0.35)`.
2. Real input: `stand(cell(6))`, `d.selectItem('soaked_hide')`, `tapStep(d)` -> label starts with `Drying Rack - soaked hide`.
3. `ticks(300)` (the file's tick helper, holding the time at 0.35); read the label; parse `n/120 s`; assert `n > 0`.
4. Setup: `window.__hw.setVoxel(x, y + 2, z, 'glass')` over the rack (two cells up so the crosshair still targets the rack).
5. `ticks(300)`; label must end with `(needs open sky)` and its `n/120 s` equal (within 1 s) the value read in step 3.
   `d.shot('hand-11-rack-glass')`.
6. Setup: `setVoxel(x, y + 2, z, 'air')`; `ticks(300)`; label has no bracket and `n` grew. Take the leather later or clear the
   rack with an empty-hand tap is NOT required; leave it.

### 10.2 Step `'six tastes in any order finish the side goal Taste them all'`

1. Setup: `clearInventory()`; give one of each drink in a deliberately non-registry order:
   `['trail_blend_cup', 'green_tea', 'dark_roast', 'berry_tea', 'light_roast', 'black_tea_cup']`.
   Also install a toast recorder (reading only, same pattern as the existing `hand:stroke` recorder in this file):
   `const g = window.__hw.app.game; window.__toasts = []; g.bus.on('toast', (t) => window.__toasts.push(t.text));`.
2. Real input for each: `d.selectItem(key)`, aim up at the open sky so no block is targeted (setup: `window.__hw.look(yaw,
   pitch)` with the upward pitch - check the sign convention in `src/app/debug.ts` `look`), `d.use()` (the drink path is
   `Interaction.drinkHeld` -> `drink()`), then `d.settle(1200)` (> `DRINK_COOLDOWN_S` 1 s). Assert the held stack became
   `clay_cup` after each Use (real effect of the input).
3. After the third drink assert `window.__toasts` contains a text matching `/^New taste: .+ - 3 of 6$/`; also assert a visible
   `.hw-toast__text` with that text exists right after the Use (toasts fade, so check promptly).
4. After the sixth: `waitFor(page, () => window.__hw.app.game.state.objectives.side().find((s) => s.spec.id === 'six_cups')?.done === true)`
   (Unit 0's tracker API; if the debug state exposes side goals in `__hw.state().objective`, prefer that); assert
   `window.__toasts` contains `Side goal: Taste them all` and exactly five `New taste:` texts; assert `__hw.state().objective.id` is NOT `'six_cups'`.
5. Real input: open the Hearth Log with the HUD goal button (`d.press(page.locator('.hw-goal'))` - works on desktop and
   touch); assert the log contains the heading text `Side goals` and a done row whose text is `Taste them all`
   (`page.locator('.hw-log', { hasText: 'Side goals' })`, then the row by `hasText: 'Taste them all'` with its tick element
   `.hw-log__tick` - use Unit 0's actual row class). `d.shot('hand-12-side-goals')`. Close the window (Escape on desktop,
   the window's close button on touch).

Both steps must pass on `desktop` and `phonePortrait`; no console errors (the script's final step).

---------------------------------------------------------------------------------------------------------------------------

## 11. Docs to update (same PR; never `docs/WHATS_LEFT.md`, never `docs/build/SYSTEMS.md`)

1. `docs/api/brewing-content.md`
   - section 5: delete the "Furnace FORGE ... `clay_cup` ... `drip_cone` ..." clauses; keep `kettle_pot`; add "The clay cup and
     drip cone are clay table pieces (`unfired_cup` 1 clay, `unfired_cone` 2 clay) fired in the crucible at 500 C for 8 s
     (`clay_cup_fired`, `drip_cone_fired`, recipesHand.ts)."
   - section 6: "`boil_bucket`, `first_brew` on the main track after `bake_bread`; `six_cups` ("Taste them all", 4 coal) is a SIDE
     goal (`BREW_SIDE_GOALS`, SYSTEMS T7). The flag counts boosts (`TASTE_BUFFS`): any drink granting each tea and coffee buff
     once; each new taste toasts `New taste: <name> - n of 6`." Delete the "NOTE the tracker is strictly sequential" line.
   - section 10 (deviations): delete the six_cups bullet and the "Decide which stays" bullet; add "Decided (owner, 2026-11): the
     clay table route stays; the forge recipes are gone."
2. `docs/api/brewing-buffs.md:39`: "...and the flag `six_cups` the first time the sixth distinct tea/coffee boost (`TASTE_BUFFS`) is
   tasted; every earlier new taste toasts `New taste: <name> - n of 6`."
3. `docs/api/handwork.md:102-108` (Timed stations): replace the glass sentence with "Any block that is solid or liquid above the
   rack is a roof - glass included (owner decision 2026-11): it pauses the rack ('Needs open sky') and keeps its progress, and
   keeps the rain off. The test is `stopsRain` (`src/core/sky.ts`), the same rule as crops and the player's exposure. Rain-proof
   drying is the Drying Machine (`mech_rack`) or a roof that moves (weather cock signal + piston, SYSTEMS J5)."
4. `docs/api/handwork-content.md:132`: `unfired_cup` (1 clay), `unfired_cone` (2 clay).
5. `docs/BREWING_PLAN.md:80`: append "(superseded: the clay table presses and the crucible fires both, see
   docs/api/brewing-content.md section 5)". Plan text otherwise untouched.
6. `docs/api/game.md` or the objectives section wherever the tracker is documented: nothing for Unit 2 unless Unit 0 did not
   document side goals; then one line naming `six_cups` as the first side goal.

---------------------------------------------------------------------------------------------------------------------------

## 12. Acceptance checklist

- [ ] `OBJECTIVES` has no `six_cups`; `SIDE_OBJECTIVES` has it with title, flag condition and 4 coal reward unchanged.
- [ ] HUD "Goal N of M" never shows "Taste them all"; the Hearth Log lists it under "Side goals" with a tick when done.
- [ ] Drinking six different boosts in any order completes it once: toast "Side goal: Taste them all", +4 coal, sfx `objective`.
- [ ] Each earlier new taste toasts `New taste: <Drink> - n of 6`; repeats do not.
- [ ] `FLAG_SIX_CUPS` and the solver count `TASTE_BUFFS`, not every drinkable item (adding a drink item with an existing buff keeps
      all brewing tests green).
- [ ] Old saves: completed `six_cups` -> done, no re-reward; stuck on it -> moves on; flag without goal -> completes once.
- [ ] No forge recipe outputs `clay_cup` or `drip_cone` (test); `first_brew` text names the Clay Table, 1 and 2 clay, 500 C and
      no "forge" (test); docs 11.1, 11.4, 11.5 corrected.
- [ ] A drying rack under glass (or water, or any solid block) shows `(needs open sky)`, keeps its progress, is not reset by
      rain; it resumes when the cover goes. Open-sky behaviour unchanged.
- [ ] Rack description mentions glass and no longer claims "grass into fiber".
- [ ] `npx tsc --noEmit` clean; `npx vitest run` all green; `node scripts/e2e-handwork.mjs --device=desktop` and
      `--device=phonePortrait` pass with the two new steps and screenshots `hand-11-rack-glass`, `hand-12-side-goals`.
- [ ] No new saved field, no new sfx, no new item/block, no `SAVE_VERSION` change.

---------------------------------------------------------------------------------------------------------------------------

## 13. Out of scope

- The side-goal mechanism, its panel section, its toast and `'objective:side'` (Unit 0).
- The weather cock, its rain signal, and the piston roof story (Unit 16, Unit 13); this unit only makes the problem real.
- Changing `openSkyAbove` (`src/game/weather.ts`), `STOPS_RAIN` (`src/sim/crops.ts`) or machine `openSky`
  (`src/sim/surroundings.ts`, solar/wind) to use `stopsRain` - same rule already; refactor later to avoid merge conflicts with
  Unit 3 (crops) and Unit 16.
- A "progress" counter (`4 / 6`) on the side-goal row: would need a new `ObjectiveCondition` type; the taste toast carries
  the count instead (14.3).
- A `tall_grass -> fiber` rack recipe (the old description promised it; this unit removes the promise, see 14.5).
- The Codex brewing group's `"planned": true` in `scripts/codex/progression.json` (14.6).
- Star hearth casings, `main` branch, six-age W0 (excluded by the owner).

---------------------------------------------------------------------------------------------------------------------------

## 14. Notes for the coordinator

1. **Panel ownership.** SYSTEMS T7 says side goals are "shown in the objectives panel ... under 'Side goals'" as part of Unit 0's
   mechanism, but 6.1 item 5 only says "Side goals mechanism (T7) with an empty `SIDE_OBJECTIVES`". If Unit 0 ships without the
   Hearth Log section, Unit 2 adds it (it is the first unit with a visible side goal): in `HearthLogView` a
   `h('section', { class: 'hw-log__section hw-log__section--side' }, h('h3', { class: 'hw-heading', text: 'Side goals' }), list)`
   after "Up next", rows `hw-log__item` with `data-state` `'done'|'next'`, the existing `hw-log__tick` check glyph for done, the
   reward line in small text for open ones, hidden when `side()` is empty; refresh key extended with the count of done side goals.
   Proposed resolution: state in SYSTEMS 6.1 item 5 that Unit 0 owns the panel section.
2. **`taste_them_all` vs `six_cups`.** SYSTEMS T7 line 361 writes "`taste_them_all` = existing `six_cups`". The id must stay
   `six_cups` (saved ids and the saved flag). Proposed SYSTEMS edit: "`six_cups` 'Taste them all' (existing id, 2)".
3. **Counting by boost.** SYSTEMS does not say what counts as a taste. `DRINKS` (every drinkable item) would break the goal and
   the solver the moment Unit 5 or Unit 10 adds a drinkable item. This spec defines `TASTE_BUFFS` (tea + coffee buffs) and counts
   a buff from any drink. Proposed: add `TASTE_BUFFS` to the SYSTEMS 6.2 table under Unit 2, consumers 5 and 10 ("no action
   needed; a drink of a counted buff counts").
4. **Literal `age: 0` in objective specs.** Every objectives file uses literal AGES indices (`age: 0`); SYSTEMS 6d forbids literal
   ages "in new code". Moving an existing spec is not new code, so this spec keeps `age: 0`; if the coordinator prefers, the
   builder writes `age: ageIndexOf('ember')` (same value). Either passes the tests.
5. **Rack description bug.** The rack's description promised "grass into fiber"; no such recipe exists (render code
   `rackVariant` even draws a grass bundle). This spec removes the promise. If the owner wants a fiber-drying recipe, it belongs to
   a later handwork unit.
6. **Codex.** `scripts/codex/progression.json` marks the brewing group `"planned": true` although brewing is built; not this unit's
   section to edit (T7 Codex rule). Suggest Unit 12 or the coordinator flip it during the Codex pass.
7. **One roof rule.** With this change the rack, crops and the player agree ("solid or liquid above"); machines (`surroundings.ts`
   `openSky`, solar panel and wind turbine) use "solid above" (liquids ignored). Worth one line in SYSTEMS T8: "a roof is anything
   solid or liquid (`stopsRain`)". A follow-up can make all four call `stopsRain`.
8. **J5 wording.** J5 step 1 says "rain spoils the dry"; precisely, rain *resets* the progress (items are not lost). Unchanged
   behaviour; suggest J5 say "rain starts the drying over".
