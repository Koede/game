# Decor that does something

## Goal
Furniture and decorations are not only pretty: each piece gives a small, understandable effect, and the best ones reward arranging a room.
You build a place people want to be in, and the place gives back.

## Think it through first
A decoration that does nothing is a dead end. A decoration whose effect is only a bonus number is a chore. The sweet spot is an effect you can
see and feel, that changes how you use the room, and that you can read at a glance.

What makes decor fun:
- **Visible results:** the fireplace warms the room, and you can see the flames and feel the warmth change.
- **Arrangement matters:** two chairs facing a table make people sit and talk; a bed by a window gives a better sleep.
- **Reasons to care:** a room people like makes the regulars stay longer and gives small perks.
- **Discovery:** effects are learned by noticing, not read from a table.

## Design
1. **Comfort.** A room's comfort score comes from its pieces: a lit hearth (+), a table with two chairs (+), a rug (a little +), a bookshelf
   (+ for the research-minded), clutter or emptiness (0). Shown as a room card on entry ("cosy", "bare", "lived in").
2. **Heat.** A fireplace or lit furnace warms its room and the cells near it, and warm rooms dry the drying rack. A faint warm glow shows it.
3. **Light.** Lamps and candles give light by strength and colour; a candle-lit room reads as cosy (see noise-and-light.md).
4. **Rest.** A bed in a room above a comfort threshold gives a better sleep (more morning buff, faster recovery).
5. **Social.** Chairs and tables used by NPCs; a rug and a hearth make the regulars linger, and a room they like unlocks a small tavern perk
   (stock or a discount).
6. **Plants.** Potted herbs in windows give a small food buff when picked; a plant in shade does nothing.
7. **Mementos.** Trophies and framed items (a legendary you found, a boss part) add comfort and a story line when examined.

## Phases
1. Comfort score and the room card.
2. Heat from hearths and furnaces; the warm glow.
3. Bed comfort and rest buffs.
4. NPC social effects in the tavern.
5. Plants and mementos.

## Tests
Comfort is a pure function of a room's pieces; heat falls off with distance and stops at walls; beds in comfortable rooms give the rest buff;
the room card matches its score; old rooms are scored when read.

## Risks
Players ignoring decor (fine, it stays optional); too many numbers (show labels, not percentages); bad room detection (reuse the room finder in
src/npcs/rooms.ts).

## Open questions
Should comfort affect the regulars' moods (they already have a mood system), and should tavern upgrades depend on it?
