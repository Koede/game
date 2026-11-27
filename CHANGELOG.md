# Changelog

Hearthwatt is pre-release (`version` is still 0.1.0), so everything below sits under **Unreleased**. Entries are grouped by area rather than by merge. The list covers the features and fixes merged to `main` up to commit `bd79042`.

## Unreleased

### Town and people

- New worlds begin at a camp with Gruk alone. The camp is a low cart with campfire stones set so the fire shows.
- Gruk builds the town: he clears wild crops and loose growth, finds a site, and keeps the storage bay in place when it has to move. The lodge grows room by room into the Hearth & Anvil, and tavern levels follow the camp.
- Orrin's building board posts material bounties. Filling them raises town reputation, and rest days, unlock chances and the bay crate follow from it.
- Newcomers: a nightly move-in roll, a housing check and a Town page. Contentment comes from NPC likes, crowding and room warmth. Residents walk to their houses for the night and back in the morning.
- Settlement jobs: residents haul, run stations and tend machines. Moving a resident by hand and moving out are supported.
- A wandering trader visits every few days at dusk.
- Caravans trade at prices fitted to the time model, with no sell loops.
- Wooden door: a two-cell toggle door. Mobs and NPC routes pass open doors only.
- Outfit and sleep/swim sprites for the townsfolk, including Rosa, Mara, Bram and Veyra.

### Heat, steam and power

- Heat zones: one temperature model across rooms, with insulation, a heat view and warm-room contentment.
- Small steam loop: Copper Steam Kettle, Steam Rotor, Boiler Plate and Safety Valve. Steam has heat, water and steam ports, steam pipes and a beam engine. Boilers are sealed and hold real pressure.
- The watt-to-shaft bridge is retired. Dynamos take a shaft directly.
- Forge Age heavy industry: rolling mill, drop forge and dynamo. Power moves to the Forge Age.
- Water power: dams raise a wheel's head, and rivers ice over in late autumn and winter. A mill wheel is driven by a river shaft.
- Windmill, steam tank and an energy ledger with a conservation test.
- Bronze air network and Blast Nozzle: air tube, tank, compressor and nozzle. The Blast hearth requires a nozzle.
- Power grid overlay: Grid Meter item, Grid Monitor block, load colouring and losses. Cell Rack storage block with a night-cover line on the grid panel. Storage blocks light their face while they hold charge.
- Signals: relay (renew, delay, hold, pulse), a tap-set timer and a push button.
- Kerosene is tractor fuel. A kerosene lamp is a wire-free lantern that burns Kerosene Canisters and returns each used-up canister once. Chainsaws refuse it.
- Furnaces burn refined fuels, the still-base burner takes plain fuels, and fuel slots are consistent across the engine and the burner.

### Machines and wear

- Machines wear while they run, slow down, break and are repaired with iron ingots.
- Status faces show starved, full, worn and broken machines, and jammed networks and starved twins.

### Seasons, disasters and animals

- Winter prep: frozen rivers, hard-winter cold (a per-world flag), greenhouse crops and a first-winter goal track.
- Disasters with counterplay: boiler overpressure, chimney fires, and storms on exposed wiring. Steam-loop boilers keep their own warning, valve and burst, and disasters add a scald.
- Animals live a day: home points, sleep at night, shelter in storms and winter nights, and herds hold together.

### World, caves and survival

- Felling: felled trees lie as fallen logs that the axe cuts up. A stump is left behind, and branch wood drops. Falling trees hurt what they land on. There are sounds, landing dust and haptics, and reduced motion is respected.
- Hoes cut ferns and reeds like tall grass.
- Caves: a depth-widened network with cave rooms (camps, lodes, sinkholes and foul air), chalk marks and a cave cairn. Foul air puts out a held torch. A boss holds the deep cave camps, and its hoard holds a legendary weapon.
- Fishing and cooking: five seasonal catches, fish chowder and winter broth.
- Mining aimed at a person stops with a toast instead of digging behind them.

### Crafting, items and progression

- Modular tools (phases 1-2): heads, handles and bindings combined at the workbench, a Tool Builder and Rework panel, hoes and mauls, a resin trait, and composed icons.
- Legendary weapons: Emberfang, Gale Reed, Lanternblade, Quiet Hammer, Tidebrand, Rootsong, Starcleaver and Attunement at the altar. Notebook notes cover them, and the Spare Pick hums.
- Enchantments: altar discovery, enchant notes and more enchants. Loot carries enchants and quality, and crates keep both on stored tools.
- Research by doing: using a rod, crucible, altar or focus earns insight notes that unlock small steps.
- Blueprints: save a machine layout, see a placement ghost, and build it from the pack or hand it to a resident. Ruins and old-age crates can hold old plans.
- Daily and seasonal goals with keepsake and dye rewards.
- Glassware: a condenser coil as a helix tube, a still-base tap, profile liquids, crucible rims and sounds.
- Belt Pouch: the pocket item, crafted at the workbench.
- Bag and inventory: spread a held stack, bulk moves, gather, locks, undo, pockets, pickup ticks and sort order.

### Interface and accessibility

- Photo mode: filters, a phone controls bar and a share sheet. Town postcards are taken at each age, with the first-person hand hidden in the frame.
- Notebook and Workshop Guide open from Bag chips.
- Legends screen in the Hearth Log.
- Accessibility: colour-blind palettes and overlay ramps, text and HUD size sliders, and tap to move with an on-screen destination ring.
- Touch quick menu and a graphics setting.
- Heat view and grid overlay use colour-mode ramps.
- Hotbar slots fill the edge of phone screens.
- Interaction sweep: a Use that does nothing now says why, and screens that cannot be built explain themselves.

### Fixes

- Fixed silent failures in NPC and animal interactions.
- Kerosene lamp returns each used canister once.
- Fire-related and furnace fixes, including a Blast hearth and furnace fuel slot consistency.

### Development

- A time model (`timeModel.ts`) for expert-time costs, with balance tests (T1, T1b and T8 buff stacking bounds).
- Block ids are reconciled after each merge, and the golden files are regenerated when content changes.
- End-to-end checks were added for the newcomers, handwork, features, tech, goat, photo and town flows.
- Thermal performance tests use loose bounds so they pass on noisy CI runners.
- Docs: what is built, age by age; the feature plan in waves; inventory moves; a Shipped note for felling.
