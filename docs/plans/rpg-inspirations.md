# What to borrow from other RPGs

For the loot, enchantment and legendary weapon plans. Each entry says what the game does, what makes it fun, and how it would fit Hearthwatt
(a phone-first, modular, craft-and-magic voxel game). Not everything should go in; the last section says what I would take first.

## Loot

- **Diablo and Path of Exile: affixes.** An item is a base plus a few random modifiers with ranges (a pickaxe with "swift +14%" and "wears
  slowly"). Fun: every drop is a small puzzle and a possible jackpot. Fit: a stack gets 0 to 3 rolled affixes from a pool by rarity; names
  are generated ("Smith's Pick of Sparks"), legendaries are hand-written.
- **Diablo: legendary power on a normal base.** The effect is the item; the stats are ordinary. Fit: matches legendary-weapons.md.
- **Borderlands: manufacturers and elemental flavour.** Items come in "families" with a recognisable look and quirk. Fit: workshop families
  (Brasswright, Hearthforged, Wildgrown) each with a visual trim and a typical affix.
- **Monster Hunter: carve and craft from the monster.** Gear is built from specific parts of specific creatures. Fun: you hunt for a reason.
  Fit: rare mob parts (wolf pelt, golem core) are crafting inputs for a named upgrade, so fights feed crafting directly.
- **Dark Souls: loot is placed, not rolled.** A corpse in a corner holds the good thing; shortcuts and secret walls matter. Fit: tavern vault
  style placement for named finds; markers and notes lead you to them.
- **Zelda (Breath and Tears of the Wild): chests as small puzzles and shrines.** Reward comes from solving a tiny puzzle (a lever, a flame
  to light, a block to move). Fit: puzzle crates and mini-shrines using our blocks (light a brazier with a torch, pour water, use a
  pedestal).
- **Skyrim: lore books and radiant quests.** Found books tell the world's story and unlock bonuses. Fit: the research scrolls (`scroll_*`)
  become collectible lore with a small permanent perk per set.
- **Terraria: biome and boss drops.** Defeating a boss opens the next tier of loot. Fit: a few guardian encounters gate the legendaries.
- **Hades: boons.** Pick one of three offers mid-run. Fit: a shrine offering three enchant boons, take one, lose the others.
- **Destiny and Genshin: weekly caps and pity.** Keep chase loot from feeling like pure luck. Fit: pity is optional and hidden behind
  "the world gets generous after a long dry spell".
- **Noita: spell crafting as the loot.** Pieces combine in surprising ways. Fit: enchants and focuses combine with emergent results.

## Enchantments and effects

- **Skyrim: enchant by learning.** Disenchant an item to learn its effect, then apply it to anything. Fun: discovery doubles as the economy.
  Fit: break an enchanted find at the altar once to learn the effect, then make your own with essentia.
- **Path of Exile: sockets and links.** Gems slot into gear; links change what they do. Fit: essentia slots on a weapon (1 to 3) holding
  aspect gems that modify its verb; adjacent slots link for combos.
- **Diablo: runewords.** A fixed order of runes in a socketed item makes a named effect. Fit: runes from the Rune Desk placed in order at the
  altar; a recipe you discover from a scroll.
- **Dark Souls: infusion paths.** A weapon becomes Fire, Lightning, Occult, with different scaling. Fit: infuse an element at the altar,
  changing the weapon's look and its damage type.
- **Monster Hunter: elements and status.** Fire, water, poison, paralysis; monsters have weaknesses. Fit: mob weaknesses by element make
  enchant choice meaningful; a creature "dislikes" one aspect.
- **Zelda: durability with fusion.** Attach a part to a weapon for an effect (an ember core makes a fire blade). Fun: creative, throwaway
  experimentation. Fit: temporary fusion at a bench (an ember core on a sword for one use of its charge).
- **Elder Scrolls: soul gems and charge.** Enchants use a charge you refill. Fit: essentia charge on a weapon that drains with each use of
  its verb and refills at a jar, so effects are a resource, not passive.
- **Terraria: accessories.** Small slotted items give effects. Fit: charms (src/magic/charms.ts) are the accessory layer; legendary charms
  pair with legendary weapons.
- **Genshin: elemental reactions.** Fire plus water makes steam; frost plus lightning shatters. Fit: combine two enchant elements for a
  reaction (steam burst on a wet fire hit). A big source of emergent fun without new items.
- **Curses from Diablo and Souls.** A strong effect with a cost you can see and choose. Fit: later, after the base works.

## Legendary weapons

- **Zelda: signature weapons with a verb.** The Master Sword, the Hylian Shield: each changes how you move or solve. Fit: the utility column.
- **Dark Souls: boss weapons and weapon arts.** A weapon has a special move on its own button; the lore is in the description. Fit: each
  legendary gets one "weapon art" with a cooldown, learned by use.
- **Monster Hunter: weapon types with distinct movesets.** A greatsword is not a bow. Fit: legendary weapons come from different families
  (sword, spear, hammer, staff, trident), each with its own swing, reach and timing.
- **Diablo: set items.** Wearing two or three pieces unlocks a bonus. Fit: a weapon and a charm pair into a set effect.
- **Hades: aspects.** One weapon has four forms that play very differently. Fit: a legendary can be "awakened" through an altar upgrade
  into a second form with a changed verb (not just a bigger number).
- **Destiny: exotics with a quirky perk and a quest to earn them.** Fit: the chase is a short quest chain (find the pieces, repair at the
  forge), not just a drop.
- **Kingdom Hearts and Monster Hunter: visual identity.** Silhouette, colour and sound make it recognisable at a glance. Fit: per-weapon
  trail colour, hit sound and idle glow (in legendary-weapons.md visuals).
- **Elden Ring: weapons you can read.** Lore in the description of every item, and a flavour of strange moves. Fit: one story line each.

## What I would take first

1. **Affixes with generated names** (Diablo and PoE). The single biggest change to how every drop feels, and it reuses the rarity system.
2. **Learn-by-breaking enchanting** (Skyrim) plus **discovery at the altar**. Fits our magic loop and makes loot feed it.
3. **Weapon arts** (Dark Souls) and **Zelda-style utility** on the legendaries. This is what turns a named item into a toy.
4. **Elemental reactions** (Genshin). Emergent, cheap in content, big in fun.
5. **Boss and puzzle gating** (Terraria and Zelda) for where legendaries live.
6. **Monster-part crafting** (Monster Hunter) as the bridge between fighting and the workshop.

Leave for later: runewords, sockets and links (heavy UI), set bonuses, pity, curses.
