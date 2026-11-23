# Phone UX, HUD and onboarding - advisor report

Author: UX/HUD/onboarding advisor (read-only pass, 2026-11-21). Scope: `docs/CONGRUENCE.md` 4.6 and the owner decisions
(in-world over screens, original names/art, phone first, 44 px targets). Method: read `docs/api/{hud,ui-kit,player,food-ui,
integration}.md`, `src/player/input/*`, `src/ui/hud/*`, `src/ui/vehicleHud.ts`, `src/app/game.ts` (key bindings, crosshair
labels), `src/ui/menus/howto.ts`, plus the live game at 390x844 (Dev world, creative menu, goggles). **Limits of the live
audit:** the browser pane showed the page clipped to a 800x600 frame, so the hotbar and anything below y~600 was not
visible; pointer lock is unavailable; I did not drive machines. Everything marked *(code)* comes from reading source, not
from a screenshot. Nothing in src/ was touched.

---

## 1. Live audit

### 1.1 What I saw (screenshots, 390x844 emulation)

| # | Screen | What it showed | Verdict |
|---|---|---|---|
| S1 | Title | Wordmark, five age bars, NEW WORLD, seed, Survival/Dev, difficulty, Settings, How to Play. All fills the screen with no scroll. | Good. "Five ages" strip is stale after the six-age refactor (Ember/Forge/Current/Atomic/Star; Steam and Bronze missing) - rewrite from `AGES`. Seed field + difficulty hint text (11 px) is the smallest text on the screen. |
| S2 | HUD on spawn | Goal tracker top-left (kicker "GOAL 1 OF 75", title, 0/4, chevron), bag + pause top-right (44 px), vitals plate under the goal, clock card under the bag, orange coach bubble "Drag here to look around", DEV Items chip on the left edge, joystick bottom-left, Place/Use/Mine/Jump cluster bottom-right. | Dense but readable. Problems below. |
| S3 | Creative menu | Full-screen sheet: search, tabs ALL 371 / BLOCKS 38 / MATERIALS 138 / TOOLS... (cut off), 6-column icon grid, item detail line, backpack grid under it. | Works, but five defects (1.2). |
| S4 | Creative search "goggles" | 3 hits (two crates match on description text), 70% of the sheet empty, detail line still shows the previous hover ("Wolframite..."). | Cosmetic: stale detail, matches on description produce noise. |
| S5 | HUD after closing | Hotbar not visible in the pane (clipped). Confirmed from `hud.css`: `--hw-hud-reserve: 116px` right padding when touch, hotbar bottom-centre. | Cannot judge hotbar tap size live; see 1.3. |

### 1.2 Findings per screen / HUD element

Format: **problem** -> fix (file owner in section 6).

**Creative menu (Dev Mode)**
1. Tab strip overflows: "TOOLS" is clipped to "T" and nothing signals it scrolls. -> make the tab strip a horizontally
   scrolling row with an edge fade and snap, or a 2-row wrap; show a count only on ALL.
2. A hover tooltip (the "Wolframite" card) stays up after a tap on touch and covers 3 grid rows. Touch has no hover.
   -> on touch, never show the floating tooltip; show the detail only in the fixed detail line (already exists).
3. Detail line is stale after a search/filter. -> clear it when the filtered list changes, or show the first hit.
4. Tap = take what? Nothing says whether a tap gives 1, a stack, or sends to the backpack. -> caption under the grid:
   "Tap: take 1. Hold: take a stack." and flash the receiving slot.
5. Backpack grid is below the fold in portrait (only 2 of 4 rows visible at 800x600). -> in portrait put the search and
   tabs in a collapsed header (tap to expand) so the grid + backpack both fit; or make the backpack a 9-slot hotbar-only strip.
6. The DEV "Items" chip floats at screen-left mid-height, right where a right thumb on the look area rests in landscape.
   -> dock it into the bag screen as a tab (Dev only) or at top-right next to bag/pause as one more 44 px button.

**Goal tracker + Hearth Log** *(code + S2)*
7. Kicker "GOAL 1 OF 75" is a spoiler of scale that dwarfs a new player ("75!"). -> show "Age 1 - goal 1 of 9" (per age).
8. Tracker is a wide 200 px bar; with a long goal title it ellipsises. -> allow two lines on phone, and put the progress
   as a thin bar under the title instead of "0 / 4" text.
9. The coach "Tap the goal for details" is the only pointer to the Log/Codex. -> see onboarding, section 3.

**Coach bubble** *(S2)*
10. "Drag here to look around" is drawn over the middle of the scene, with its tail pointing at nothing, and persists
    until 0.4 rad of look. On a phone with a fresh game that is fine, but it sits where the player's thumb must drag.
    -> anchor it to the right half (the look zone), add a faint animated finger glyph, and auto-dismiss after 8 s.

**Touch control cluster** *(code: `touchStyles.ts`)*
11. Jump 76 px, Mine 72 px, Use ~72 px, Place ~44 px (small, placed up-left of Use). All >= 44, but **Place is a
    *toggle* that arms the next Use** - a mode switch hidden as a tiny button. Players will tap it, forget it is armed,
    and "Use" will place instead of open. -> replace with the context button (section 2.4).
12. Four captioned buttons for the right thumb plus the look gesture also on the right: the Mine button sits at
    (right 110 px, bottom 72 px), well off the thumb's arc; one-handed play needs the thumb to travel to three
    places. -> thumb-arc layout (2.5).
13. The vehicle HUD rewrites button captions in place (Mine -> Work, Use -> Exit, Jump -> Swap). Re-using a button for
    "Exit" is dangerous: a player who habitually taps Use to interact taps Exit mid-field. -> keep Use as Use; give the
    vehicle its own explicit "Get off" button in the bag/pause cluster plus long-press on Use (hold 600 ms, ring fills).

**Vehicle HUD (tractor/skiff)** *(code: `vehicleHud.ts`)*
14. Panel sits at `bottom: 86px`, centre, exactly above the hotbar; hint text 11 px, `#cdbfae` on `rgba(24,18,14,.78)`
    (contrast ~9:1, fine) but the **hint line is a sentence of 9 words** read once. -> show the hint for the first
    20 s of a ride and on the first ride only; afterwards just fuel + tool.
15. Desktop keys F (work) / R (swap) are registered in `game.ts` with `window` listeners that **bypass the input
    manager**: they are not in How to Play and not remappable, and F is also the natural "interact" key players expect.
    -> conflict table 2.3.
16. No skiff controls are described anywhere in the HUD (the HUD is tractor-only). -> reuse the panel: "Skiff - Use: get off".

**Notebook / Rune desk / Workshop Guide screens** *(code)*
17. Notebook opens by **Use aimed at the sky** (and Use on a block *scans* it). On touch, "aim at the sky and tap Use"
    is undiscoverable and fights with Use-in-air = nothing. With goggles held, Use-at-sky opens the Workshop Guide
    instead. -> the held item decides: notebook = "Scan / open" context button (2.4); Guide = a Guide chip that appears
    on the goal tracker while goggles are in the pack.
18. Every research entry unlocks silently; there is no HUD feedback that a scan *discovered* something. -> a "New note"
    toast with a book glyph and the aspect colour swatch; the notebook button on the bag gets a dot badge until opened.
19. Notebook, desk, Workshop Guide are three separate full-screen sheets that each re-explain a similar list. They are
    justified screens (many entries), but the number of taps from "I scanned copper ore" to "what does Vein do?"
    should be <= 2: scan -> toast -> tap toast opens that note.

**Essentia readouts / goggles / distillery lines** *(code)*
20. All in-world readouts share **one** channel: the crosshair name line (`ui.setTargetName(label)`), replaced when the
    label changes. Priority in `game.ts showStationName`: hand-station > magic label > rod reading > goggles inspect >
    kinetic name. Consequences: (a) the line is one row of ~28 characters of 12 px text centred under the crosshair, so
    "Quern: grinding wheat, 14 rpm, load 4/24 su" (the 70-char sentences CONGRUENCE 4.6 mandates) will wrap or clip on a
    390 px screen; (b) a player with goggles in the pack who looks at a block always gets the goggles reading and
    never the plain name; (c) there is no colour, no icon and no pause between "name" and "state".
    -> the **target card** (2.6): two lines (name + status), status in 13 px, aspect/state colour dot, 3 s grace so it
    does not flicker while the hand moves; long statuses wrap to two lines and a tap on the card opens the full reading.
21. Essentia is only visible on jars/altars via text; no HUD gauge and the owner prefers in-world: use floating motes
    (already planned in 4.7) and the **same target card** for "Jar: 12 cinder / 16". No new HUD widget.
22. Stress/speed (workshop) shows only through goggles (rpm, load su/su). A shaft network that stops from overstress gives
    no feedback unless you look at a part with goggles. -> a world-space "stalled" smoke puff + a one-line toast at
    most once per 20 s ("Shaft network stalled: 28 of 24 su. Add a crank or remove a part.") and a red mote on the
    overloaded part.

**Buff pills** *(code: `hud.ts`, `BuffPill`s: burn, warm, fed, sugar, six drinks)*
23. Up to 10 pills in `.hw-buffs`. Drinks use glyphs `up, home, heart, bolt, pick, hourglass`; **Sugar Rush uses the
    same `hourglass` glyph as Lasting** - two different buffs, one shape. -> give Sugar its own glyph (cube/crystal) and
    a distinct tint; text title for screen readers stays.
24. No cap or stacking rule; 10 pills would wrap into the vitals region (see 4).

**Pause/Settings/How to Play** *(code)*
25. How to Play lists Place + Use as one control line, Drop (Q) is missing on desktop and on touch (hotbar long-press
    throws the whole stack - a *destructive* gesture on a 44 px hotbar slot where players also tap to select).
    -> see conflict table; confirm only for stacks > 1 of valuable items, or move drop to the bag.
26. UI size Normal/Large exists (`uiScale`, `hw-touch--large`); `docs/WHATS_LEFT.md` section 6 still lists it as a gap -
    stale; there is no reduced-motion or contrast setting beyond the OS `prefers-reduced-motion` media queries, and no
    one-handed (left/right swap) setting.

---

## 2. Interaction grammar (one set of rules for the whole game)

### 2.1 Verbs

The game has **five verbs**, each with one meaning everywhere:

| Verb | Meaning | Desktop | Phone | Feedback |
|---|---|---|---|---|
| **Mine** | break / hit / dig; also strike a hand station? **no** (see Work) | hold left mouse | hold Mine button, or press-hold the world | ring fills; dig sfx; haptic tick every 4th hit; break = `Haptic.thump` |
| **Use** | open, operate, eat, scan, light, crank-once | right mouse / `F` (proposed) | tap world, or **Use** button | `ui_click` + swing; haptic light |
| **Place** | put the held block | `Shift`+Use, or right mouse with a block held | tap world with a block held (context button reads "Place") | ghost preview, `place` sfx, haptic light |
| **Hold-Use** (Work/Repeat) | repeat the Use while held: crank, hand-station strokes, stirring, tractor work | hold right mouse / hold `F` | hold Use button | the target card shows a progress ring; sfx loop per machine; haptic pulse at 2 Hz |
| **Drop** | throw the held item/stack | `Q` (stack: `Shift+Q`) | in the Bag: long-press slot -> "Drop" chip; hotbar long-press shows a small "Drop?" chip for 2 s instead of dropping at once | `drop` sfx |

Rule 1: **Use never changes meaning by hidden mode.** The only modal state is "held item", and the button caption shows it.
Rule 2: **Aim decides the target, held item decides the verb.** The caption on the context button is `verb + noun`
("Open Furnace", "Place Plank", "Scan Copper Ore", "Eat Stew", "Crank", "Wrench Pipe").
Rule 3: **Hold = repeat or confirm, tap = once.** Tap-vs-hold threshold stays 280 ms (existing).
Rule 4: **A modifier never exists on phone.** Every Shift/Ctrl chord has a visible button or a context-button caption.
Rule 5: **Destructive = two steps** (drop a stack, break a placed machine with contents, empty a tank).

### 2.2 Prompts and the crosshair line

- One *target card* under the crosshair (section 2.6): **line 1 = name (bold)**, **line 2 = status or prompt**.
- The prompt names the verb the **context button** will do: "Use: open", "Use: scan (new!)", "Hold Use: crank".
  On desktop the same line says the key: "F: crank (hold)". Same string table; the key glyph differs by platform.
- Status words are verbs/states: "grinding", "seized", "out of fuel", "stalled: 28/24 su". Failures say the next action.
- Colour: neutral text white; warn amber; fail red; magic aspect colour only for the dot, never the text (contrast).

### 2.3 Conflict table: buttons now overloaded

| Input | Meanings today | Conflict | Resolution |
|---|---|---|---|
| **Use / right mouse** | open screen; place block; eat; till/plant; pail; **scan with notebook**; **open notebook at the sky**; **Workshop Guide at the sky with goggles**; wrench on pipe; crank once; **exit tractor** while driving | one button, 10 outcomes, 3 of them keyed on "aim at nothing" | Context button + caption (2.4). Sky-Use stops opening screens: notebook scan is Use on a block; opening the notebook is the **Notebook chip in the Bag** (and the held-notebook context caption "Open notebook" only when nothing is aimed). Guide: chip in the Bag, not Use-at-sky. Vehicle exit: its own button. |
| **Mine** | dig; hit mob; **Work** while driving | recaptioned live | Keep Mine = dig/hit only. Work uses Hold-Use (same gesture as crank/hand stations): one grammar "hold Use to work". |
| **Jump** | jump / swim; **Swap tool** while driving | recaptioned live | Vehicle gets a 44 px "Tool" chip beside its panel; Jump stays Jump (no jumping a tractor, so it may stay hidden). |
| **Place toggle** | arms next Use to place | hidden mode, forgettable | Remove the toggle on phone. When a block is held and the aimed block has a screen on that face, the caption reads "Place Plank" and the *tap on the world* places; a second smaller chip **"Open"** appears beside it (so both outcomes are one tap, no mode). Desktop keeps Shift+Use. |
| **Q (drop)** | drop held; drop stack on Shift? not bound | no touch equivalent except hotbar long-press | Phone: Bag slot chip, hotbar long-press = a confirm chip. Desktop: Q one, Shift+Q stack. |
| **F** | tractor Work (hold); nothing else | F is also the universal "interact" key; undocumented | Make **F = Use alias** on desktop (same as right-click: one-handed keyboard play), and the tractor Work becomes **hold F / hold Use** (same key, no conflict because Use on a driven tractor means Work). Exit moves to **E-long / Esc menu "Get off"** or `X`. R swap stays but is shown in the panel. |
| **R** | tractor swap tool | free key otherwise; unconfirmed in How to Play | Keep; list in the panel and How to Play. |
| **E / bag** | inventory; closes any screen | fine | Unchanged. |
| **L / goal tap** | Hearth Log | fine | Unchanged, plus Codex pointer inside the Log. |
| **Crank (Use on a hand crank)** | one Use = turn for 3 s (`CRANK_S`), hold repeats | on phone "hold Use" is the same as hold on a block = **mine**! | Aim decides: a crank/lever/hand-station aim switches the hold ring to "Work" mode (the Mine hold-to-dig on a placed machine is a footgun: it destroys the crank). Mining a placed machine needs the wrench/hammer-held rule or a deliberate "hold Mine". Desktop already separates left/right; on touch, **hold on world = mine only when aimed at a block that is not a station/crank/lever**, otherwise it is Work. |
| **Wrench** | Use on pipe turns the side aimed | cooldown 0.35 s; on touch no hold-to-repeat | Keep; caption "Turn side (N)". |
| **Goggles** | carried = replaces crosshair name with inspect reading; held + Use-at-sky = Guide | silent override of block names | Goggles show their reading *as line 2*, name stays line 1. Guide = Bag chip. |
| **Notebook scan** | Use on block scans; lens 1.5x | no feedback of "already scanned" | Caption: "Scan (new)" / "Scan (known)"; sfx `scan_chime` pitch differs; a known block does nothing but toast "Known". |

### 2.4 The context-sensitive action button (design)

Replace the Place toggle + Use with **one Action button** (the Use button, 72 px) plus **at most one secondary chip** (44 px).

State resolver (pure function, DOM-free, `src/player/actionHint.ts`, unit-tested): input = held item, aimed
block + face (`RayHit`), aimed creature, vehicle state, sim query (`handView`, `magic.useHint`). Output =
`{ primary: { verb, noun, icon, repeat: boolean } | null; secondary: { verb, noun } | null }`. Priority (highest first):

1. Driving: primary = "Work" (repeat) if an attachment, secondary = "Tool" (swap); Get off is a separate chip.
2. Creature in reach + edible/tame item: "Feed Goat"; else null (Mine hits it).
3. Hand station / crank / lever aimed: "Crank" / "Chop" / "Grind" (repeat = true).
4. Pipe aimed + wrench held: "Turn side". Bucket on fluid port: "Fill"/"Pour".
5. Notebook held: aimed block -> "Scan <Name> (new)"; nothing aimed -> "Open notebook".
6. Block with a screen aimed: "Open <Name>" (secondary = "Place <held>" when a block is held).
7. Block held (nothing special aimed): "Place <held>" (secondary = "Open <Name>" if a screen block is aimed).
8. Food held, hungry: "Eat <Name>". Hoe/seed aimed at soil: "Till"/"Plant".
9. Nothing: the button greys to the Bag icon "Bag" (tap = inventory) so it is never dead.

Presentation: the caption lives **inside** the 72 px button (two lines, 11 px, verb on top); the noun also appears on
the target card. The button pulses once when the primary changes (no pulse when reduced motion). Secondary chip appears
above-left of Use, auto-hides after 2.5 s without aim. Haptic: light tick on caption change *only* when a repeat/Work
verb becomes available (so crank/hand stations are discoverable by feel).

### 2.5 Reach zones (one-handed, 390x844)

- **Easy thumb arc (bottom 35 %, both lower corners):** joystick left, Action + Mine + Jump right. Keep everything the
  player taps *repeatedly* here.
- **Reach with stretch (middle):** look-drag area (whole screen right of the joystick), target card.
- **Hard (top 25 %):** goal tracker, bag, pause. These are *glance + occasional tap* only; fine.
- **Setting "Hand: Right / Left" (default Right):** mirrors the cluster and joystick. Cost: one CSS class + gesture
  region swap in `gestures.ts`.
- Hotbar stays bottom-centre; **swipe along the hotbar to scroll slots** is not needed (9 slots x 44 px = 396 px > 390!)
  -> on 390 px the 9-slot hotbar touches the edges; `--hw-hud-reserve` already pads. Verify slot size is >= 40 px with
  a 2 px gap on 360 px-wide phones (acceptance A4).

### 2.6 Target card (replaces the one-line crosshair name)

```
 ┌───────────────────────────┐
 │ ● Quern                   │   line 1: name (14 px, 600)
 │ grinding wheat, 14 rpm    │   line 2: status (13 px), wraps to 2 lines, max 70 chars
 └───────────────────────────┘
```
Width <= 280 px, centred 56 px below the crosshair (not on it); dot = aspect/state colour; the card fades in 80 ms,
holds 3 s after the aim leaves; reduced motion = no fade. Tap on the card = full goggles reading as a bottom sheet
(only if the block has a longer reading). Data source stays the existing `ui.setTargetName(label)`; extend the
signature to `(name, status?, tone?)`. Existing `parseTargetName` for creatures is kept.

### 2.7 Haptics and sound cues

Phone: `navigator.vibrate` (Android only; iOS Safari ignores it - treat as best-effort). Respect a Settings toggle
"Vibration". Patterns: tick 8 ms (selection change, caption change), tap 15 ms (use/place), thump 30 ms (break/land),
double 15-40-15 ms (error/refused), long 60 ms (goal done, discovery). Sound: existing `SfxName` set; add
`ui_select_verb` (soft tick), `scan_known` (flat) vs `scan_chime` (bright), `stall` (descending whine) for
overstress. Never haptics on every dig tick (battery, buzz) - every 4th only.

---

## 3. Onboarding: the first 30 minutes on a phone

### 3.1 Intended path and where it breaks

| Min | Player does | What the game says now | Gap |
|---|---|---|---|
| 0-1 | Title -> New World | "Drag here to look around" | Fine. Add "Joystick: walk" to the same bubble family. |
| 1-4 | Mine tree, collect | goal "Gather wood 0/4"; coach "hold MINE" | Good. No hint that items auto-pickup / drop on the ground now (ground items). |
| 4-8 | Workbench, tools, furnace | goal chain 1-8 | The Hearth Log is mentioned once (coach); **no mention of Codex, the notebook, hand stations**. |
| 8-15 | Fire, first smelt | Furnace screen has tabs LOG/GRID/STRUCTURE | Furnace screen is the densest on the phone; first visit needs a 3-step peek ("Fuel here, ore here, wait for the glow"). |
| 15-25 | Hunger, night, farming | HUD vitals + hunger vignette | Hunger/night are explained only in How to Play (never opened). Night 9 m: the game **starts at "Night 9 m"**? (S2 clock) - first minutes at dusk is hostile; start at morning. |
| 25-30 | Bronze/steam/belts/research appear | goals | Research/notebook, belts, distillery have **no introduction event**. |

### 3.2 Hint system (event-driven, not text walls)

`src/ui/hud/hints.ts` (new, extends `coach.ts`): a `HintEngine` fed from the bus. Each hint = `{ id, when(event), text,
anchor, max: 1, cooldownS }`; stored in `localStorage hearthwatt.hints` (best effort); shown as a **hint card**: icon + <=
12 words + optional "Show me" (opens the right Codex page) + dismiss. At most **one visible**, queue depth 2, none while a
screen is open, none within 60 s of the previous one, never during hazard (health < 30 %, in lava, mob nearby).

| Trigger (bus event / state) | Hint (<= 12 words) | Anchor |
|---|---|---|
| first item on the ground (`ground:spawn`) | "Walk over items to pick them up." | item |
| first `block:placed` of a machine block | "Use opens a machine. Wrench turns pipes." | target card |
| first fuel burn in a furnace | "Pump the bellows to get hotter." | furnace |
| first `inventory:changed` with `field_notebook` | "Use on a block scans it. Notes are in the Bag." | action button |
| first scan success (`research:*`) | "New note! Tap to read." | notebook chip |
| first crank/hand station aimed | "Hold Use to keep turning." | action button |
| first overstress stall | "Too heavy. Add a crank or remove parts." | part |
| first belt/shaft placed | "Shafts pass spin along. Goggles show rpm." | target card |
| health low + night | "Stand next to a lit furnace: it is safe ground." | vitals |
| first distillery part placed | "Boil spirit, collect at the receiver." | target card |
| first goal complete (existing) | "Tap the goal to see what's next." | goal |
| 12 min with no furnace | "Goal: build a furnace. Open the Bag, tab 'Hand'." | goal |
| first vehicle mount | the vehicle hint (shown once, 20 s) | vehicle panel |

### 3.3 Goal tracker wording

- Kicker: "Age 1 - Ember" + step "3/9" instead of "GOAL 1 OF 75".
- Title: the verb phrase of the next action ("Gather wood", "Build a furnace"), **second line: what/where** ("4 logs: any tree").
- Tap = Log; **long-press = "Show me"** (points an arrow on the compass to the nearest needed block when known).
- Done toast: "Goal done: Gather wood. Next: Build a workbench." (<= 3 s).
- Reward line in the Log only.

### 3.4 How to Play and Codex pointers

- How to Play (`howto.ts`): keep the loop; replace the two big control tables with a **Controls card that matches the
  actual platform** and adds the new verbs (Hold Use, Notebook scan, drop, vehicle, one-handed). Add "Where do I
  read about X?" -> Codex and Hearth Log buttons.
- Pause menu: **How to Play** and **Codex** as two buttons (44 px). Hearth Log gets a "Codex" button on its header.
- Research discoverability: the Bag gets a **Notebook chip** (book glyph, dot badge when unread), opening the research board;
  the notebook item's own tooltip says "Use on a block to scan".
- Belts/distillery: the *goal chain* gets one goal each that places the first part (the hint fires on placing).

### 3.5 Accessibility

| Topic | Today | Change |
|---|---|---|
| Text size | `uiScale` normal/large exists | Make **Large** scale HUD plate, target card, hints and menus; min 14 px body (many HUD texts are 11-12 px). Check the vehicle hint (11 px) and difficulty hints (11 px). |
| Contrast | warm dark panels; light text ~9:1 | Audit amber-on-amber hint bubbles (orange coach bubble with dark text: ok); aspects colours never carry text; buff pills need a text label at Large. Add a **High contrast** option: solid `#000` plates, 2 px outlines. |
| Reduced motion | CSS `prefers-reduced-motion` in 4 sheets + `prefersReducedMotion()` in kit | Add an in-game **Reduced motion** setting (OR'd with the OS flag): no FOV kick, no throb animations, no button pulse, static hint cards. FOV kick (`SPRINT_FOV_KICK`) too. |
| Colour-blind | state colours (red hunger / green) | Every colour state must also have a glyph or word (buff pills do; power bars: add "!" for overload). |
| One-handed | right-hand cluster; stretch to Mine | "Hand: Right/Left" + optional **Auto-mine** (hold anywhere on the world with Use-aim, since Mine = hold-on-world already exists). |
| Screen reader | `aria-label`s on goal, buttons | Add `aria-live=polite` to the target card; hints `role=status`. |
| Haptics | none | Settings: Vibration On/Off. |

---

## 4. HUD budget

### 4.1 Zones (portrait 390x844)

```
┌──────────────────────────┐
│ Z1  goal tracker   bag ‖ │  top 8-52  : persistent, 44 px
│ Z2  vitals     clock     │  52-112    : persistent, small
│ Z3  alerts + toasts      │  112-170   : transient, 1 at a time
│            ·             │
│       target card  Z4    │  centre-below crosshair: transient
│            ·             │
│ Z5 buffs (a row)         │  above hotbar, left-aligned, max 4
│ Z6 vehicle / hint panel  │  above buffs, centre, one only
│ stick   hotbar  action   │  bottom: controls + hotbar
└──────────────────────────┘
```
Landscape 844x390: Z1 left, Z2 below it (compact one row), clock top-centre, buffs top-right under bag/pause, vehicle
panel left of the cluster. Total persistent HUD <= 18 % of screen area.

### 4.2 What shows when (priority 1 = never hidden)

| Element | Shown | Priority | Rule |
|---|---|---|---|
| Crosshair, controls, hotbar | always | 1 | never obscured by cards |
| Vitals plate | always; **collapses** to a single heart+flame+bowl when all > 70 % and no change for 10 s; expands on change | 2 | saves 40 px |
| Goal tracker | always (collapses to one line in landscape) | 2 | |
| Clock | tap-to-expand; shows only the phase icon + time | 3 | |
| Alerts (cold, hunger, power overload, night, low fuel) | transient 3 s, one at a time, queue 2 | 2 | alert > hint > toast |
| Target card | when aimed at something with status | 2 | |
| Buff pills | one **compact row max 4**: sorted by remaining time ascending; the rest collapse into "+3"; tap the row = full list sheet; pills show only the glyph, with timer on the pill that expires < 30 s | 3 | Sugar Rush always in the row while active (it has a downside) |
| Essentia | **not on HUD**; jar/altar via target card; world motes | 4 | |
| Stress / rpm | **not on HUD**; goggles via target card; stall = toast + smoke | 4 | |
| Fuel (vehicle) | vehicle panel while driving; low-fuel alert at 12 % | 2 | |
| Vehicle panel | while driving only; hint line only first 20 s of first ride | 3 | |
| Hint card | event-driven, one at a time, none if alert is up | 4 | |
| DEV Items chip | Dev mode only; in the Bag/top row, not left edge | 5 | |
| Coach bubbles | first 90 s only | 4 | |

### 4.3 Stacking order and collisions

1. Alerts own Z3. If an alert is active, the hint card is queued and the toast waits.
2. Target card and hint card never coexist: hint anchors to the card slot; when aimed at a status target the hint waits.
3. Vehicle panel replaces the buff row's vertical slot (buff row slides up 40 px) - not both overlapping the hotbar.
4. Bag-open and any screen hide the HUD with `[data-screen]` (existing). Keep.

---

## 5. Settings to add (all in `settings.ts`, defaults in `core/context.ts`)

`reducedMotion: 'system' | 'on' | 'off'`, `contrast: 'normal' | 'high'`, `hand: 'right' | 'left'`,
`vibration: boolean`, `hints: boolean` (turn the hint system off for veterans), `uiScale` extended (normal/large; keep).

---

## 6. Builder task list (two builders, disjoint files)

### Builder UX-1: input grammar, action button, haptics (owns `src/player/**`, `src/ui/vehicleHud.ts`, `src/app/game.ts` key block)

| # | Task | Files | Acceptance |
|---|---|---|---|
| U1 | `actionHint.ts` resolver (pure) with priority table 2.4; unit tests for every row | `src/player/actionHint.ts` (+test) | vitest: 14+ cases, e.g. notebook + ore -> "Scan Copper Ore"; goggles + sky -> null (no screen); crank aimed -> repeat |
| U2 | Remove sky-Use screens: notebook open and Workshop Guide open move to Bag chips/events; `magic.use(null)` returns not-handled | `src/app/game.ts`, `src/magic/magic.ts` (read-only edit of one branch), `src/player/interaction.ts` | unit: Use with nothing aimed never emits `ui:open`; notebook scan on a block still works |
| U3 | Context action button: caption from U1; Place toggle removed on touch; secondary chip; hold ring "Work" on station/crank aim; hold-on-world mines only for non-stations | `src/player/input/touchOverlay.ts`, `touchStyles.ts`, `core.ts`, `gestures.ts` | e2e phone: aim at a crank, hold Use 1 s -> crank rotates and the block is not mined; aim at plank with plank held -> caption "Place" and tap places |
| U4 | Vehicle: Get off as its own 44 px button; F becomes Use alias + hold = Work; R swap kept; panel hint shown 20 s on first ride; remove caption rewrite of Use | `src/ui/vehicleHud.ts`, `src/app/game.ts` key handlers, `src/player/input/keys.ts` | e2e: mount tractor on phone, Use does not dismount; "Get off" does; Esc menu also |
| U5 | Hotbar long-press = "Drop?" chip (2 s) not instant drop; Bag slot menu Drop; desktop Shift+Q stack | `src/ui/hud/hotbar.ts`, `src/player/input/keys.ts`, `intent.ts` | unit: single long-press does not drop; confirm does; vitest `drop.test.ts` updated |
| U6 | Haptics module + settings toggle; patterns in 2.7; sfx names `scan_known`, `ui_select_verb`, `stall` | `src/player/input/haptics.ts`, `src/audio/sfx*.ts`, settings | unit with fake `navigator.vibrate`; muted when setting off |
| U7 | Hand setting (mirror cluster/joystick) | `touchOverlay.ts`, `touchStyles.ts`, `gestures.ts` | e2e: hand=left mirrors; all buttons still >= 44 px |

### Builder UX-2: HUD, hints, onboarding, a11y (owns `src/ui/hud/**`, `src/ui/menus/**`, `src/ui/screens/creative/**`, `src/ui/screens/notebook/**` chips, `src/ui/styles.css`, `core/context.ts` settings, `howto.ts`, `title.ts`)

| # | Task | Files | Acceptance |
|---|---|---|---|
| H1 | Target card (two lines, 3 s grace, wrapping 70 chars), `setTargetName(name, status?, tone?)`; goggles/hand-station/jar/altar labels send name+status separately | `crosshair.ts`, `hud.ts`, `hud.css`, `game.ts showStationName` (minimal edit coordinated with UX-1) | e2e phone 390x844: aim at a hand station and a quern with goggles: card visible, no clipping, <= 2 status lines, width <= 280 px |
| H2 | Buff row cap 4 + "+N", own Sugar glyph, tap opens full list; vitals collapse | `hud.ts`, `drinkBuffs.ts`, `vitals.ts`, `hud.css`, kit icons | unit `drinkBuffs`: sort by time; with 7 buffs DOM has <= 5 pills; Sugar glyph != Lasting glyph |
| H3 | HintEngine + 13 hints (3.2), storage, quiet rules | `src/ui/hud/hints.ts` (+test), `coach.ts` (shared storage) | unit: each trigger fires once, none within 60 s of another, none while a screen is open; e2e: first fuel burn shows the bellows hint |
| H4 | Goal tracker wording per age, long-press "Show me", progress bar | `goal.ts`, `objectives.ts` (text only) | e2e: kicker reads "Age 1 ..." not "of 75"; text does not overflow at 360 px wide |
| H5 | Creative menu: tab scroll, no touch tooltip, detail refresh, tap/hold caption, Dev chip into the top row | `src/ui/screens/creative/*`, `hud.ts` dev chip | e2e: tabs scrollable, tooltip absent on touch, search clears detail |
| H6 | Notebook chip in Bag + dot badge + "New note" toast tap-through; Guide chip while goggles carried | `src/ui/screens/inventory/*`, `notebook/*`, `workshopScreen.ts` entry | e2e: scan -> toast -> tap -> note open in <= 2 taps |
| H7 | Settings: reducedMotion, contrast, hand, vibration, hints; apply classes on root; FOV-kick/shake off under reduced motion | `settings.ts`, `settingsText.ts`, `core/context.ts`, `uiScale.ts`, css | unit: defaults; e2e: toggling Large changes `.hw-hud` scale; reduced motion disables `hw-hud-throb` |
| H8 | How to Play/Pause: Codex + How to Play buttons, platform-correct controls (Hold Use, Scan, Drop, vehicle) ; title age strip from `AGES`; game starts in morning | `howto.ts`, `pause.ts`, `title.ts`, spawn clock in the game start code (owner confirmation) | e2e: How to Play shows touch list on phone and includes Hold Use; title lists six ages |

### Phone e2e assertions to add (script `scripts/e2e-phone-ux.mjs`, run `HW_GPU=1`, 390x844, 844x390, 360x740)

1. No element of `.hw-touch-btn`, `.hw-hotbar .hw-slot`, bag, pause, chips smaller than 44x44 CSS px (360 px wide: hotbar slot >= 40).
2. No horizontal page scroll; no HUD element crosses the viewport edge; no two interactive HUD rects intersect (target card vs
   buff row vs vehicle panel).
3. Text min: `getComputedStyle` font-size of every HUD text node >= 12 px at Normal, >= 14 px at Large.
4. Goal tracker, target card, hint card contrast >= 4.5:1 against the plate (sampled with a canvas readback).
5. Hold Use on a crank does not mine it; tap with a block held places; notebook scan toast appears; vehicle Use does not dismount.
6. With 7 buffs active the HUD shows <= 5 pills.
7. Landscape: vitals + goal + buffs do not overlap the joystick or cluster rects.

---

## 7. Suggested order and sequencing note

The six-age refactor holds `src/` exclusively; start builders only after it lands. UX-1 and UX-2 touch disjoint trees
except `src/app/game.ts` (UX-1 owns the key block and `showStationName` caller; UX-2 only the `setTargetName`
signature) - land H1's signature first (a one-line interface change), then UX-1. Order: **U1 -> U2/U3 (the biggest
phone win) -> H1 -> H2/H3 -> U4/U5 -> H4-H8 -> U6/U7 -> e2e script**. Estimated 2 builder sessions of one working day each.

## 8. Open questions for the owner

1. Is the first minute at "Night 9 m" intended? (HUD clock showed Night at world start; suggest morning start.)
2. OK to drop Place-as-toggle on phone in favour of the caption-driven context button?
3. OK that sky-Use no longer opens the notebook/Guide (Bag chips instead)?
4. Haptics on by default (Android only)?
