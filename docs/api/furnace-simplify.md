# Furnace simplification (Bronze Furnace screen)

Owner brief: "a bit simpler of a ui for the forge, it's a bit much", then "there shouldn't be pages", and "the notes
about the structure can be a floating button on the right of the ui screen you press to enlarge those settings".
Screenshots were taken at 390x844, 844x390 and 1280x800 in a Dev Mode world with a Bronze Furnace, lit, with molten
copper and a full pack (`node scripts/shoot-furnace.mjs <dist> <outDir> page all upgrade structure`).

## Audit: what was on the screen (before)

- Header: name, "Bronze Age - tier 2 of 6 - home", Upgrade button with a have/need sub line, close.
- Five tabs (SMELT, FORGE, STRUCTURE, GRID, LOG) with badges; on a phone LOG was cut off by the edge.
- Firebox, always: thermometer with up to 4 notches and a trend caption, flame canvas with a "Draft n%" overlay,
  fuel slots, Add fuel, burn bar, Douse/Light, Pump, electric switch (tier 3+), a 4-row readings list (Flame, Heading
  for, Tier maximum, Heat to machines), status line, fuel hint, Rest, fold chevron.
- SMELT: crucible rows (slots, name, heat badge, meter, pour controls), then "What the crucibles take": chips
  (All, Kitchen, Materials, Fuel) and a row per recipe with heat and time badges, ingredient chip, reason and Load.
- FORGE: a long note, chips (All, Kitchen, Tools, Parts, Machines, Power, Building), then 13+ rows each with a heat
  badge, food/note badges, one chip per ingredient, a "Missing ..." line, a x5 button and Forge.
- Upgrade sheet: kicker, title, blurb, 6-row table, "Materials" chips, "where to get it" list, "Heat" badge, reason,
  Plan the hearth, Back, hold-to-upgrade.

What was too much: five pages for one machine, the same facts said two or three times (heat in the thermometer, in
badges and in the reason), a button row per row even when it was disabled, an always-on readings list, and seven
category chips on a 390 px screen.

## Redesign (after)

- **One page, no tabs.** Firebox, crucibles and one make list. Smelt ("Load") and forge ("Forge") recipes share the
  list, so making a thing never needs a tab switch.
- **List shows "Can make now" by default**, with an "Everything" switch. Until the player chooses, it follows the
  pack: it falls back to Everything while nothing can be made. Category chips (Kitchen, Tools, Machines, Parts) show
  only under Everything.
- **Rows:** icon, name, one line ("Uses 4 Firebrick", "Takes Tin Ore - 8 s at 250 °C", or the reason while it cannot
  be made) and one 44 px button. x5 appears only when 2+ can be made (never for Load). A tap on the row opens the
  detail: badges, ingredient chips, reason. Nothing was removed, only folded.
- **Structure, Power (grid) and Log** are three small floating buttons on the right edge (Hearth / Power / Log, with
  a "!" when the hearth or grid needs attention). A press opens that panel as a sheet over the page with a Back
  button; Escape closes the sheet first. The upgrade sheet's "Plan the hearth" opens the hearth sheet.
- **Firebox:** readings list and draft text removed; the thermometer has at most one mark besides the flame limit
  (cooking now, else the recipe last touched, else the upgrade) and a one-word trend; **Light loads fuel from the pack
  when the firebox is empty**, and the next useful button (Light, then Pump while the fire is slow) glows (`data-next`).
- **Upgrade sheet:** only the stats that change, the Heat badge only while the fire is too cold; subtitle shortened.
- In-world: Add fuel + Light is now just Light. (A "Use the furnace with fuel in hand" shortcut would need player
  code; left out of scope.)

## Counts (390x844, Bronze Furnace, lit, molten copper, full pack)

| Job | Taps before | Taps after |
|---|---|---|
| Light it and see it is hot | Add fuel, Light = 2 (4+ via the bag) | Light = 1 |
| Make one thing | FORGE tab, chip/scroll to the row, Forge = 2-4 | Forge on the first rows = 1 (list is already "can make now") |
| Upgrade | Upgrade, hold = 2 | Upgrade, hold = 2 (sheet is shorter) |

Visible on screen (script count, phone portrait / landscape / desktop):

| | Before | After |
|---|---|---|
| Badges (heat, time, tab, count) | 12 / 9 / 15 | 3 / 3 / 3 |
| Ingredient chips | 3 / 1 / 4 | 0 / 0 / 0 (in the row detail) |
| Controls (buttons) | 24 / 21 / 60 | 24 / 18 / 60 (the desktop count includes the 42 backpack slots) |
| Tabs | 5 | 0 (3 floating buttons) |
| Category chips | 7 + 4 | 0 by default (4 under Everything) |

## Code

`kit/recipe.ts` and `kit/recipeList.ts` gained opt-in `simple` mode (the crafting screen is unchanged);
`furnaceScreen.ts` is one page with sheets; `forgeTab.ts` is the combined list; `forgeRows.ts` has the one-line
summaries and four categories; `firebox.ts` has `nextAction`; tests: `furnaceLogic.test.ts`, `simplify.test.ts`;
e2e: `openTab` in `scripts/lib/e2eFurnace.mjs` now means "no sheet" (smelt/forge) or "press the floating button".
