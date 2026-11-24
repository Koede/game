# Improvements to existing features

Things that already exist and could be much better. Grouped by system, each with the problem as I understand it from the code and the
fix. These are smaller than the big plans and several can ship alone.

## Inventory and crafting

- **Search and filters in the bag.** Sort and favourites exist (`src/game/inventoryTools.ts`); add a search box (by name, category, "can
  craft with this") and a filter strip. Phone-friendly, big hit targets.
- **Drag to split and distribute.** Drag a stack across several slots to spread it evenly; drag with a second finger to split in half.
- **"What uses this" and "craft the missing pieces".** The recipe helper shows how to make an item; add the reverse lookup and a one-tap
  chain for missing intermediates.
- **Pinned recipes.** Pin a recipe so its ingredients show a live count on the HUD while you gather.

## Magic and research

- **Research board polish.** The sticky selection and tap-again-to-erase help; add an undo for the last write, a lock for fixed aspects, and
  a hint that costs lore so stuck players are not punished with no way out.
- **Scan feel.** The animated scan is built; add a short audio cue per aspect and a "Scan history" strip so you can re-read what you learned.
- **Essentia network feedback.** Show a jar's contents and tube flow on a tooltip, and a clear "this tube joins nothing" state in the glass.
- **Infusion preview.** The altar should show the result, cost and instability bar before starting.

## Distillery and brewing

- **Guide page for the glassware.** One page per module with its model, what it does and how it joins (ports), and the separatory funnel.
- **A rig checker.** The scan finds problems; show them as markers over the glass in the world (a red ring on the loose segment) and a
  one-line fix hint.
- **Recipe cards on the still.** Tap the still base to see which process cards your rig satisfies, and which one piece is missing for each.
- **Brewing feedback.** Cup temperature and brew progress as a small ring, and a satisfying sound at the right moment.

## Combat and creatures

- **Readable attacks.** A short wind-up and a ground marker for the dangerous attacks so deaths feel fair.
- **Weak points and elements.** Creatures have a weakness by element and a stagger bar (see rpg-inspirations.md); legendary weapons use it.
- **Pets and companions.** A small command menu (stay, follow, defend) and an inventory pouch for the hired helpers.
- **Mob variety by biome and time.** More night variants, and rare "elites" that roll a second loot table.

## NPCs and the tavern

- **Daily routines you can see.** Each regular has a visible daily rhythm (sweeping, cooking, gossiping); the bedrooms and rooms to rent
  fit it. A "ask about X" topic menu with remembered answers.
- **A town board with more than bounties.** Favours, rumours (pointing at real structures), and a "needs" list for the tavern's upgrade
  (a bigger kitchen, a better bar).
- **The jukebox as a feature.** More tracks, a request menu, dancers who react to genre, and a small buff for staying through a song.

## World and exploration

- **Waystones as a network.** Activate and name them; travel for a cost; shown on the map.
- **Structure variety.** More structure types, each with its own loot table and a small puzzle.
- **Places visited on the map with names.** Place markers and notes; the compass idea from the mod list.
- **Weather gameplay.** Storms put out torches and fill buckets; fog hides the far hills; the glass apparatus reacts to cold.

## Interface and feel

- **Crosshair "Jade" line.** Second line with contents and state for the block you aim at.
- **Food preview.** Show what a food will give before eating.
- **Haptics and sound.** A little haptic tick for taps on the phone, and a layered sound for each station (furnace, still, altar).
- **Reduce clutter.** A "simple HUD" preset for new players and a "full HUD" for veterans.
- **First hour polish.** Review the first twenty minutes on a phone: every prompt, every first-use hint, nothing that stalls.

## Technical

- **Phone still-base tap bug** (documented in glass-and-liquids-polish.md).
- **Flaky end-to-end steps.** The tavern board step on the phone and a few magic steps depend on timing; make them wait on state, not time.
- **Performance budget page.** A debug overlay showing draw calls, instanced liquids and chunk build time, with a budget per feature.
- **Save migrations.** One place that lists each save-format change and tests an old save loading, as the new item fields (affixes,
  enchants, rarity) will need.

## What I would take first

1. Bag search and drag-to-split.
2. Crosshair contents line and food preview (tiny, constant payoff).
3. Glassware guide and rig checker (makes the new glass usable by a stranger).
4. Waystone network and named map markers (travel is the loot loop's engine).
5. Readable attacks and weak points (prepares the legendary weapons).
