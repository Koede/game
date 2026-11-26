# Just you and Orrin: a settlement that grows from nothing

This plan changes how a new world begins. It builds on `orrin-builds-a-town.md` (the builder, storage bay, building board) and replaces
"every new world opens inside the finished tavern".

## The arc in one paragraph

A new world starts with two people: you and Gruk, at a campfire by his cart. There is no tavern and nobody else. Gruk builds his own hut,
then a storage bay and the building board, and from then on you supply the materials through the board's bounties. His next big job is a
**lodge**: one floor, a common room with a hearth and a single bedroom at the side. It is not a tavern yet. Over many moons, the lodge
grows room by room: more bedrooms, a bar, a kitchen, an upper floor, and eventually the full Hearth & Anvil tavern. Every night that a
bedroom stands empty, there is a chance someone moves into it, so newcomers arrive slowly, one at a time, never all at once. Only once the
tavern is finished does Gruk start on houses, and then each resident in turn gets their own. When
it is done, they come and find you to say goodbye to their room ("Gruk just finished my house. Come by anytime."), and their words
depend on how well they know you. Their old room is free for the next newcomer. By the end, the tavern is where everyone gathers at night.

## Timeline (pace guide)

One day is 15 real minutes, a moon is 8 days (2 hours of play), a season is 8 days.

| When (roughly) | What happens |
| --- | --- |
| Day 1 | You and Gruk at the camp: his cart, a campfire, a bedroll each. He starts his hut (with what he carries in the cart). |
| Days 2-3 | Gruk's hut is finished. He builds the storage bay and the building board. From now on, materials come from you. |
| Days 3-8 | The lodge, stage by stage (frame, walls, roof, hearth, one bedroom). You can sleep there once the bedroom is in. |
| From day 8 | The bedroom is built. Each night it stands empty, there is a chance the first newcomer moves in. |
| Moons 2-6 | Gruk adds rooms to the lodge one at a time (bedrooms, bar, kitchen, upper floor, stage). Each new empty room gets its own nightly chance of a newcomer. |
| About moon 6 | The last room is built: the lodge is the full tavern. |
| After the tavern | Gruk starts on houses, one resident at a time; each moves out with a goodbye, and their room frees up for a guest or the next newcomer. Residents come back to the tavern at night. |

The numbers are a starting point for tuning; the rule is that time must pass and nothing arrives suddenly.

## Who comes, in what order, and why

The order follows what the player needs next in the game, so advice arrives about when it is useful:

1. **Gruk** (from the start, shipped in phase 1): the camp's only resident and the town's builder, who gives the wooden tools. While he is
   alone, the general advice (the current goal) stands in for the specialists.
2. **Orrin** (a later newcomer): the artificer and the mentor for tech and machines, who gives the advice for his role when he arrives.
2. **Rosa** (first newcomer): she sees a common room and a hearth and wants to run it. Her arrival starts the bar's upgrades and the turn
   from lodge to tavern.
3. **Gruk** is already here (see 1): his room gets space for an anvil once the player's first bronze is made.
4. **Mara**: comes when the player first meets magic (an aspect vial or a shrine).
5. **Old Bram**: drifts in to trade once there are enough people to trade with.
6. **Veyra**: last, when the player reaches alchemy and the distillery.
7. **The wandering trader** keeps visiting as now, but only once the lodge stands (they need a road and a roof to come to).

**The nightly move-in roll.** Every night (at the turn to dawn), for each empty bedroom, the game rolls once whether the next person in line
moves in. The chance starts low and grows each night the room stays empty, so a newcomer usually comes within one or two moons of their
room being finished, and never on the room's first night:
- Chance per night = `base` (about 4%) + `growth` (about 2%) for each night the room has stood empty, capped at about 30%.
- At most one arrival per night across the whole settlement.
- The person must also be eligible: their trigger met (Rosa: the common room's hearth; Gruk: your first bronze; Mara: your first magic;
  Bram: three residents; Veyra: alchemy) and the town's reputation above their threshold. An ineligible person is skipped and the next in
  line is rolled for instead.
- Sleeping through the night counts as a night; time away counts each night that passed (rolled one by one).
In the morning, the newcomer walks in by the road, finds you, and introduces themselves; their room now has their things in it.

## Borrowed from Terraria's town NPCs

Terraria lets town NPCs move into empty, valid rooms by chance once their own condition is met. We already use that idea (the nightly
roll and per-person triggers). These parts fit too:

1. **Valid rooms, not only Orrin's rooms.** A bedroom counts as free housing when it passes a room check: enclosed (walls, floor, roof,
   no gaps to the outside), at least a minimum size (about 3 x 3 floor, 3 high), a door, a light source, a bed, and a place to sit or a
   table. Orrin's rooms always pass. **Rooms the player builds can pass too**, so a player who builds a nice cottage can house a newcomer
   early. The check is a flood fill from the bed, limited in size (a huge open hall is not a bedroom).
2. **The housing view.** A screen (or a mode of the building board) that marks every room the game counts: valid and free, valid and taken
   (with who lives there), or invalid with the reason ("needs a light", "not enclosed", "no door"). On a phone: tap a room to see it.
3. **Assigning rooms.** From the housing view you can move a resident to another valid room (their own house, a nicer room). A resident
   whose room stops being valid (a wall mined) complains and moves to another free valid room, or back to the camp until one is fixed.
4. **Contentment (Terraria's happiness, kept simple).** Each person has likes and dislikes about neighbours and surroundings: Rosa likes
   living near the hearth and near Gruk; Gruk dislikes being next to Veyra's fumes; Mara likes trees nearby; Veyra likes being near water;
   Bram dislikes crowding. Contentment shifts their shop prices (Bram, the trader), their tips, how often they pin favours, and how warm
   their lines are. It never blocks progress. Crowded rooms (too many residents close together) lower it, which gently pushes toward
   building houses.
5. **Coming back after harm.** If a resident is knocked down (a falling tree, a raid), they are not lost: they come back the next morning,
   a little grumpy. Their room is kept for them.
6. **Who is next is visible.** The housing view shows the next person in line and what they are waiting for (a free valid room,
   reputation, or their trigger), so the player knows what to do.

Not taken: random NPCs with no story, and housing that needs specific background walls or furniture lists beyond the short room check.

## The lodge and its upgrades (replacing the fixed tavern)

The finished Hearth & Anvil layout (`src/npcs/tavern.ts`) becomes the last stage of an upgrade path, built by Gruk through bounties:

1. **Lodge:** one floor, a common room with a hearth and a table, one bedroom at the side.
2. **Second bedroom and a bar counter** (Rosa runs it once she arrives).
3. **Kitchen and pantry; a third bedroom.**
4. **Upper floor** with guest rooms (the stairwell from the current tavern).
5. **The tavern:** the full current layout (yard, pool, stage, jukebox, basement), renamed the Hearth & Anvil.

Each upgrade is a building of Gruk's like any other: bounties on the board, stages, materials from the storage bay. Existing tavern features
switch on with the stage that holds them (the jukebox with the stage, the pool with the yard, the guest beds with the upper floor).

## Moving into a house, and moving out

- Houses come only after the tavern is finished. Then Gruk works through the residents in the order they arrived, pinning the bounties
  for one house at a time (each resident must have lived at the tavern at least a moon). Houses are town templates styled for the person (Mara's cottage with a herb garden, Gruk's with a smithy shed, Veyra's with a
  glasshouse).
- When the house is done, the resident comes to find you (wherever you are in the settlement) with a goodbye line, then moves out.
  The line depends on their trust with you: a stranger says a short polite goodbye; a friend says "come by anytime"; a close friend gives a
  small gift.
- From then on, their routine is: day at their house or work, evening and night at the tavern, sleeping at home. Their room at the lodge is
  free for the next newcomer or a paying guest.

## What changes in the existing game

- **New worlds:** no tavern at spawn. A camp (cart, campfire, two bedrolls) with Gruk. Spawn and respawn are at the camp, then at the
  lodge's bedroom once it exists, then at the player's own bed.
- **Old saves:** keep their finished tavern and all six people (nothing taken away). The town builder still runs for them (houses later).
- **Features tied to people** switch on when that person lives there: the quest board favours (each favour's asker must be present),
  gossip (needs two people), Rosa's drinks and upkeep, Gruk's sparring and hire, Bram's shop, Veyra's tonics, the festival (needs at
  least three residents), the jukebox (needs the tavern stage).
- **Progression advice:** advice by role falls back to the builder (Gruk) while the specialist has not arrived.
- **Tests that assume the tavern at spawn** (`npcs.test.ts`, `rooms.test.ts`, the e2e tavern scripts) move to a "settled world" fixture
  that builds the full tavern, so they keep testing it.

## Phases (each shippable on its own)

1. **Camp start (shipped):** new worlds begin at a camp by the spawn with **Gruk** only (he is the builder and gives the wooden tools;
   Orrin is a later newcomer). Old saves untouched; the builder's general advice covers absent specialists; people-gated features are
   off until their person is present (`NpcManager.isPresent`, saved as `present`). The dev command `window.__hw.settle()` builds the
   full tavern at the camp and moves everyone in for tests and e2e. See `docs/api/npcs.md` and `scripts/e2e-camp.mjs`.
2. **Gruk's hut, storage bay and the building board** (from `orrin-builds-a-town.md` phases 1-2 and 5).
3. **The lodge:** stage 1 of the upgrade path as a Gruk building; the bedroom becomes the spawn; sleeping there.
4. **Lodge upgrades to the tavern:** the rooms built one at a time, each switching on its existing features.
5. **Newcomers:** the nightly move-in roll per empty bedroom (rising chance, one arrival a night, eligibility triggers), the walk-in and
   introduction.
6. **The room check and the housing view:** valid rooms (including player-built ones) count as free housing for the move-in roll; the
   housing view with reasons; assigning rooms; residents whose room breaks move.
7. **Contentment:** likes and dislikes about neighbours and surroundings, crowding, the effects on prices, tips, favours and lines;
   residents knocked down come back the next morning.
8. **Houses and moving out (after the tavern is finished):** per-person house templates, the goodbye scene by trust tier, routines that bring them to the tavern at night.

## Tests

- A new world has no tavern and exactly one NPC (Gruk); an old save keeps its tavern and six people.
- Move-in roll: no arrival without an empty bedroom, an eligible person and a passed roll; never on a room's first night; never two on the
  same night; the chance rises each empty night and is capped; skipped nights (sleep, time away) are rolled one by one; seeded and
  deterministic in tests; over many seeds, the median wait from a finished room is within one to two moons.
- No house bounty before the last tavern room is built.
- Room check: an enclosed room with door, light, bed and seat passes; each missing piece fails with its reason; open halls and rooms
  with a gap fail; player-built rooms pass the same check; a mined wall invalidates the room and the resident moves.
- Contentment: likes and dislikes change it in the right direction, crowding lowers it, and it changes prices within set bounds only.
- Each lodge stage switches on exactly its features; a finished upgrade path equals the current tavern layout.
- Moving out frees the room; the goodbye line matches the trust tier; the resident's night routine leads to the tavern.
- Advice falls back to the builder (Gruk) for roles not yet present.
- e2e: new world, skip time with materials delivered, see the hut, the lodge, the first newcomer, then a house and a goodbye.

## Risks

- **Lonely, slow start:** the first two hours with only Gruk. Keep him talkative, put the hut and board up fast (day 1-3), and make the
  first newcomer reachable inside the first moon or two if the player is active.
- **Many features depend on the tavern at spawn.** Gate them by person, and keep the full tavern as the end of the upgrade path so nothing
  is lost.
- **Save compatibility:** old saves must not lose their tavern; new state fields are optional.
- **Pace on phones:** tune with real play; the timeline above is a first guess.

## Open questions

1. Where does the camp stand: at spawn, or does Orrin choose a nice spot near it (flat, near water and trees)? My pick: he chooses a spot
   near spawn.
2. Should the player get the lodge's first bedroom, or their own hut? My pick: the lodge bedroom at first, then the player builds their own.
3. Arrival order: keep the order above (by the player's progress), or a fixed order? My pick: by progress, with Rosa always first.
