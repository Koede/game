# What to borrow from mods

Mods are good teachers because they were built by players who wanted the base game to have more. Each entry names the mod, the idea, why it is
fun, and how it fits Hearthwatt. Original names and art; only the ideas travel. Pairs with rpg-inspirations.md.

## Loot, weapons and enchanting

- **Apotheosis (affix loot).** Gear gets rolled affixes and rarity colours; a table's luck shifts with depth. Fun: every drop is worth
  reading. Fit: the exact shape of loot-and-containers.md, plus "gem sockets" later.
- **Tinkers' Construct (modular tools).** A tool is built from parts (head, handle, binding) of different materials; each material has
  traits. Fun: tools are designs, not tiers. Fit: our modular approach already likes this: a pickaxe head from bronze or from a golem core,
  a handle from oak or from a rare wood, with traits from the part. Legendary weapons become "unique parts" you fit on a handle.
- **Artifacts and Curios (trinkets).** Slots for rings, charms and trinkets with quirky one-line effects. Fit: charms (`src/magic/charms.ts`)
  get a trinket slot row and a family of legendary charms that pair with weapons.
- **Better Combat (swing animation and combos).** Weapon types have real swing arcs and combos. Fun: fights feel physical. Fit: weapon
  families get a distinct swing and a short combo window (supports weapon arts).
- **Iron's Spells and Ars Nouveau (spell crafting).** Spells are built from glyphs or pieces. Fit: foci and essentia combine into spell
  pieces at the altar; the Noita-style emergent results.
- **Botania (flower magic).** Mana from flowers, generating blocks that feed machines. Fit: a plant-fed alternative source for essentia
  that suits the farming side of the game.
- **Ice and Fire / Twilight Forest (bosses and zones).** Long, themed boss encounters that gate a tier and award a unique item. Fit: the
  guardian encounters that hold the legendaries.

## Crafting, storage and logistics

- **Create (mechanical).** Visible, physical machines with belts and shafts; contraptions you can look at. Fit: already inspiring the
  mechanical work; the glass apparatus is the same idea in chemistry.
- **Applied Energistics and Refined Storage (storage network).** One searchable inventory across many chests. Fun: the end of bag
  tetris. Fit: a Warehouse block network (listed as not started); a phone-friendly search box matters most.
- **Sophisticated Backpacks and Storage (upgrades).** Backpacks with upgrade slots (magnet, auto-feed, crafting). Fit: a worn pack with
  slots that give utilities; ties to the Magnet idea.
- **Just Enough Items and Roughly Enough Items (recipe viewer).** Click an item, see what makes it and what it makes. Fit: the recipe
  helper already exists; extend it with "what uses this" and a one-tap "craft the missing pieces" chain.
- **Waystones (fast travel nodes).** Place and name nodes; travel between them. Fit: waystones already exist as world features; let the
  player activate them for a small cost to build a travel network.
- **Mekanism and Immersive Engineering (tech trees).** Machines with a satisfying tier ladder and a clear visual per tier. Fit: the six
  furnace tiers already do this; a similar tier cue for the glass and magic apparatus.

## Food, farming and living

- **Farmer's Delight (cooking and farming).** A cooking pot, cutting board and richer recipes; food buffs by dish. Fit: the cooking
  quality system exists; add a cutting step and "comfort" meals with a short buff.
- **Spice of Life (variety).** Eating the same food gets less effective; variety is rewarded. Fit: already echoed by cooking quality's
  variety bonus; surface it as a small "dietary variety" meter.
- **Pam's Harvestcraft and Croptopia (crop variety).** Many crops with seasons. Fit: seasons already exist; more crops by biome.
- **Cooking for Blockheads, Comforts (cozy).** Rest and sit mechanics. Fit: the new bedrooms and the tavern rooms to rent get a "rest and
  recover" benefit.

## World and exploration

- **YUNG's structures and Dungeon Crawl (structure packs).** Many small, hand-designed structures with their own loot. Fit: more
  structure types in `src/world/structures*`, each with its own loot table.
- **Biomes O' Plenty and Terralith (biome variety).** More biomes with their own palettes. Fit: additional biome flavour and weather.
- **Nature's Compass and Explorer's Compass (find a biome or structure).** A compass that points to a kind of place. Fit: a craftable
  compass (a research reward) that points at a structure type, rewarding curiosity.
- **Xaero's minimap (waypoints and places visited).** Fit: the map already shows visited places; add named markers.
- **Chunky and Distant Horizons (view distance).** Not a feature to copy, a reminder: phones need a view-distance setting in the graphics
  control.

## Feel and interface

- **Quark (many small quality-of-life items).** Sorting, chest search, armour stand, a hoe harvest sweep. Fit: a bundle of tiny wins; a
  right-click harvest on crops is the classic.
- **AppleSkin (food preview).** Shows how much hunger a food restores before you eat. Fit: a tooltip line on food and a ghost bar on the
  hunger meter.
- **Jade and WTHIT (what am I looking at).** A tooltip when you aim at a block or creature: name, state, contents. Fit: the crosshair label
  already shows a short name; add a second line for contents and state.
- **Controlling and Mouse Tweaks (input polish).** Fit: touch drag-to-split and drag-to-distribute in the inventory.

## What I would take first

1. **Apotheosis affixes** for the loot plan.
2. **Tinkers-style parts** for weapons and tools: legendary weapons as unique parts is a very modular fit for this game.
3. **Storage network with search** (AE2 style), the biggest phone quality-of-life win.
4. **Better Combat swings** so named weapons feel different.
5. **Jade tooltips and AppleSkin food preview**, cheap and used constantly.
6. **Structure packs**, a lot of content for the loot tables to live in.
