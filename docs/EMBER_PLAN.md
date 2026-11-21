# The Ember Age - hands and fire (plan)

Nothing here is built unless marked. Companion plans: `docs/BREWING_PLAN.md` (part of this age),
`docs/BRONZE_PLAN.md` (where steam, shafts and automation begin), `docs/PROGRESSION.md`.

## 1. The owner's words

- "again, steam is a bronze age thing"
- "ember era should feel very manual and like you're making a bunch of different stuff, in bronze era the
  upgrades start becoming clear the forge is to be upgraded as the eras ask it to with the item costs"

What follows:
1. **No steam, no shafts, no pipes, no electricity in the Ember Age.** Everything in STEAM_PLAN (kettle-driven
   rotor, axles, cogs, speed and stress, shaft machines, water wheel, windmill) moves to the BRONZE AGE.
2. **Ember is handwork.** Many small stations, each worked by the player's own strokes, each making a
   different kind of thing. Breadth, not automation. The reward for reaching Bronze is that machines start
   doing these same jobs for you.
3. **The furnace upgrade ladder is introduced at the END of Ember and is the spine from Bronze on:** each age
   asks for a clear list of items to upgrade the furnace, shown on the furnace screen from the first minute
   ("Next: Bronze Furnace - 8 bronze, 4 firebrick, 1 bellows"), and the list is the age's shopping list.

## 2. Manual work - one mechanic for every hand station

A hand station holds an input and shows a work bar. Each USE on it (click / tap; holding Use repeats at the
station's stroke rate) is one STROKE: a sound, a small animation on the block, and progress. After N strokes
the output appears in the station (take it with Use on an empty hand, or it pops into the pack if the station
has no slot). The right tool in hand makes strokes count double. Strokes cost a little food (0.01 each).

| Station | Made | Tool that doubles | Jobs (strokes) |
|---|---|---|---|
| Hand Quern | workbench: 2 stone_brick, 1 stick | - | wheat -> flour 1:1 (6); roasted beans -> ground coffee (6); dried tea + berries -> berry blend (4) |
| Chopping Block | hand: 1 log | axe | log -> 4 planks (3) [with axe 6 planks]; plank -> 4 sticks (2) |
| Stone Anvil | workbench: 3 stone_brick | hammer (new: flint_hammer, bronze_hammer) | copper/bronze ingot x2 -> plate (8); copper ingot -> 3 wire (6); HOT work: items straight from a crucible count as hot for 20 s and need half the strokes |
| Mortar | forge 400 C: 1 clay | - | copper/tin ore -> 1 crushed + 35% second (8) - slow ore stretching; charcoal -> pigment-free: skip |
| Drying Rack | hand: 3 stick, 1 cord | - | no strokes: time + open sky by day: tea leaves -> dried tea (60 s), hide -> leather (120 s), tall grass -> fiber x2 (30 s); rain resets |
| Tanning Trough | workbench: 4 plank + water bucket | - | hide -> soaked hide (wait 60 s) then Drying Rack -> leather |
| Loom | workbench: 4 plank, 2 stick, 2 cord | - | 4 fiber -> cloth (10) ; padded coat now needs cloth |
| Clay Table | workbench: 2 plank, 1 clay | - | shape clay by strokes into UNFIRED cup, cone, pot, crucible, brick mould, tool moulds (4 each); fire them in the furnace |
| Casting Bench | forge 400 C: 2 fired mould... (1 clay) | - | pour: a crucible's molten metal into a mould = tool head / ingot / nozzle; knock out with Use |
| Bellows (on the furnace screen) | built | - | pump by hand, as today |
| Kettle Pot | forge 600 C: 3 copper_ingot | - | sits on the furnace: boils water for brewing and stew (NO steam power in this age) |

Keep the existing instant recipes that these replace as slower fallbacks? No: move them (planks at the block,
flour at the quern, plates at the anvil) so the stations matter; hand/workbench keep cord, tools, torches,
the stations themselves and the furnace.

### Casting (makes metal tools feel made)
- Crucible output is MOLTEN for 20 s after a smelt completes (the crucible slot glows). Taking it with a fired
  MOULD in hand pours that shape: ingot mould -> ingot; pickaxe/axe/shovel/hoe/maul head moulds -> tool head;
  no mould -> it cools into a rough "bloom" that must be re-smelted. Moulds are reusable (40 pours).
- Tool = head + 2 sticks + cord at the workbench (hand recipe). Bronze alloy: pour 3 copper + 1 tin into the
  ALLOY POT (a fired pot set in a crucible slot) - replaces the instant bronze forge recipe.
- The furnace stays the centre: every chain passes through it (fire clay, smelt, pour), the hand stations
  stand around it.

## 3. What is in the age (complete list)

Built today and staying: gathering, flint and bronze tools, the Clay Furnace with fuels and hand bellows,
charcoal, firebrick, glass, cooking, farming, flour and dough and bread, stew, buckets and flowing water,
animals, warmth, hunger, the Emberbound basics (mites, ruin guards), mauls, torches, crates, the Hearth Log.
Planned for the age: the hand stations of section 2, casting and moulds, leather and cloth, brewing
(BREWING_PLAN: six drinks; the Kettle Pot or a bucket on the furnace boils water).
Removed from the age: Bronze Chute and wrench (Bronze), thermopile and lamp (Forge), any generator.

## 4. Goals of the age (in order)

gather wood - chopping block - planks - workbench - flint - flint pickaxe - rubble - clay - place furnace -
light it - charcoal - get warm - cook a meal - eat - clay table - fire a mould - smelt copper - first pour
(cast an ingot) - hand quern - till soil - plant wheat - grind flour - bake bread - stone anvil - hammer a
plate - reach 800 C - alloy bronze - cast a bronze pickaxe head - forge a maul (cast) - salvage an automaton -
drying rack - boil water - brew a cup - loom - "The furnace wants bronze" (hold the Bronze Furnace upgrade
list: 8 bronze_ingot, 4 firebrick, 1 bellows, 2 bronze_plate, 1 leather) -> upgrade = Bronze Age.

## 5. Implementation notes

- Contract: `BlockSpec.handStation?: { strokesPerS: number; tool?: ToolKind }`; recipes with
  `station: '<station key>'` and `strokes: number`; MachineRole 'hand' (no power; has slots; opens no screen -
  the world interaction IS the interface; aiming shows "Hand Quern - wheat 3/6 strokes" as the target name).
- Sim (`src/sim/handWork.ts`): entity { input: Slot, output: Slot, progress: number, recipe: string | null };
  action `stroke(x,y,z, heldKey) -> { ok, reason?, done? }`:
  ```
  stroke(st, held):
    if st.output and not empty-hand-take: refuse "Take the " + name first
    if held is a valid input and (st.input empty or same item): move 1..stack into st.input; return ok
    r = recipeFor(st.kind, st.input.item); if !r: refuse "Nothing to work"
    if st.input.count < r.inputs[0].count: refuse "Needs " + n + " " + name
    st.progress += (held is st.tool or hotBonus(st) ? 2 : 1)
    player.food -= 0.01; sfx(st.strokeSound, pitch jitter); emit 'hand:stroke' (render: bounce the block part)
    if st.progress >= r.strokes: consume inputs; st.output = r.output; st.progress = 0; flagOnce(...)
  ```
  Holding Use repeats through the player's existing use-repeat (0.25 s) - set per station via strokesPerS.
- Drying rack / trough: timers on the entity, sky and rain checks like crops (`cropRules` open-sky cache).
- Casting: FurnaceEntity crucible gets `moltenS` (20 s countdown after each completed smelt); taking output
  with a mould in hand picks the cast item via `MOULDS[mouldKey][metal]`; mould durability on the stack.
- Player: Use priority adds "hand station" right after brewing blocks; touch = tap for a stroke, hold repeats.
- Render: each station has a small animated part (quern stone turns 30 degrees per stroke, hammer mark flash,
  loom shuttle) through the machine-parts layer with an event-driven impulse instead of a speed.
- Tests: stroke counts with and without tools, hot-work bonus window, refusals, rack timing with rain, casting
  matrix, bloom fallback, solver: age completable with zero machines; e2e: quern flour and a cast pickaxe head
  on a phone.
