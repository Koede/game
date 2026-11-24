# Message bottles

## Goal
Bottles wash up on beaches with notes inside. Some are small stories from the world, some are clues to a hidden place, and some come from other
players' worlds (shared only through an export code, and kept safe by using fixed phrases). Exploring the shore becomes a reason to walk its edge.

## What is fun
- Spotting a glint in the surf and finding a note that makes you smile or sends you somewhere new.
- A clue that leads to a sunken chest or a camp you have not seen yet.
- Writing a note from a fixed set of phrases and corking it to send to a friend's world.

## What exists
Beaches and the sea (src/world), ground items and loot tables, the research scroll pattern (src/magic/scrolls.ts) for readable items, the
notebook screen (src/ui/screens/notebook) for keeping notes, and the map and waypoints (src/game/exploration.ts).

## Design
1. **Spawning.** Bottles wash up on sandy shores, a few per beach per week, placed deterministically from the seed and the day. They bob in
   the shallows and drift slowly before settling on the sand.
2. **Note contents.** Three kinds: a flavour note (a line of story, a joke, a regular's letter), a clue (a direction or landmark, or a hint about
   a hidden place or camp), and a message from another world (see 4).
3. **Reading.** A note is a readable item: opening it shows the text, and it is kept in the notebook's Notes tab so you can reread it.
4. **Sharing (optional).** You write a note from a fixed set of phrases (no free text, which keeps it safe and kind) and cork it into a bottle.
   It exports as a short code; importing a code plants that note on a beach in your world. No accounts, no servers.
5. **Clues.** A clue points at a real place in your world (a structure, a camp, a biome) with a vague hint, and marks it on your map once you have
   been near.
6. **Pick-up feel.** A small splash, the bottle pops into the pack, and the text appears once.

## Phases
1. Spawning and pick-up with flavour notes in the notebook.
2. Clues to real places, with map marks.
3. Export and import codes with a fixed phrase set.

## Tests
Spawning is deterministic per seed and day and only on sand; a note saves in the notebook; a clue names a place that exists; a code round-trips;
a code with unknown phrases is refused safely.

## Risks
Shared notes must never carry anything unsafe, so the phrase-only design is essential. Clues must never reveal secret rooms (the tavern's closet
and vault stay secret).

## Open questions
Should notes from other worlds show the name of their world, or stay anonymous?
