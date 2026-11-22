# Hearthwatt

A first-person voxel sandbox about heat, power and the furnace at the centre of your base.

You start with bare hands in a woodland. Everything you become runs through one block: the furnace. It is
where you smelt and forge, it keeps you warm through the night, it is your first generator and later the
largest machine on a power grid you build from wood, coal, wind, water, sunlight, oil, lava and uranium.
The game ends when you turn it into a star.

Animals (hens, goats, boars) are passive: you hunt them for food and hide, and you can raise your own, but
nothing hunts you and there is no combat. The world itself is the danger: cold nights and rain, hunger, long
falls, deep water, lava, radiation and reactors you forgot to cool.

## Play

```
npm install
npm run build         # dist/index.html + dist/game.js (dist/artifact.html for hosts that supply the page)
node scripts/build.mjs --serve    # serves dist/ on http://localhost:5173 (any static file server works)
```

`npm run dev` rebuilds on change and serves the game on http://localhost:5173.

The game runs in any browser with WebGL2, on desktop and on phones; without WebGL2 it says so instead of
starting. Progress is saved in the browser: when you enter a world, every 30 seconds, when you pause, when you
switch away from the page, and on "Save and quit". Continue on the title screen picks up exactly where you
left. Inside a page that blocks storage the game still runs, warns you once, and keeps your world until the
page is closed. A save that cannot be read (or comes from a newer version) is kept as a backup and never
overwritten unless you start a New World; a full storage never deletes the last good save.

## Controls

| | Keyboard and mouse | Touch |
|---|---|---|
| Move | W A S D | left thumb stick |
| Look | mouse (click the view to capture it) | drag on the right half |
| Jump / swim up | Space | Jump button |
| Sprint | Shift | push the stick to its edge |
| Mine | hold left mouse button | hold the Mine button, or press and hold on the world |
| Use / place / eat / feed an animal | right mouse button | Use button, or tap the world |
| Place a block against a furnace or machine | Shift + right mouse button (machines, pipes, cables, tanks and hearth walls also go on any side but the front without Shift) | arm the Place button, then Use |
| Pick hotbar slot | 1-9 or mouse wheel | tap the slot |
| Inventory and hand crafting | E | bag button |
| Hearth Log (goals) | L | tap the goal tracker |
| Pause / close a screen | Esc | pause button |
| At the furnace: pump the bellows / show the backpack | P / B | Pump button / Backpack handle |
| Set a pipe end to Push, Pull or Off | Use with the wrench on the pipe | the same |
| Open the pipe screen (what flows, filters, priority) | Use on a pipe with an empty hand | the same |

Screens use the same slot rules everywhere: click (tap) a stack to pick it up, click (tap) where it goes;
right-click (long-press) takes half; shift-click (double-tap) or the "To ..." buttons move it straight across.
Switching away from the page pauses the game.

## How the game works

**The furnace is your crafting table.** A workbench exists: it builds your first furnace and a few
wooden things, and everything you can make by hand can be made there too. Nearly every other recipe is forged at the furnace. Recipes are a list: pick one, see what you
have and what you need, make it. Rows you cannot make yet tell you why: the fire is not hot enough, or the
furnace needs its next upgrade.

**Fire first.** Fuel has a flame temperature: sticks 450 C, logs 650 C, charcoal 1000 C, coal 1250 C,
coke 1550 C. Pump the bellows to push a fire up to 250 C hotter while burning fuel faster. Ores are loaded
into crucibles and smelt over time while the furnace stays hot enough; tools, parts and machines are forged
on the spot, and every forging takes a little heat out of the fire.

**Then watts.** Bolt a thermopile onto the furnace and its heat becomes your first electricity. A steam
engine on top turns more heat into more power, and now the same fire has to choose between power and steel.
Water wheels, burner generators, wind turbines, solar panels, combustion engines and geothermal taps follow.
Cables join machines into networks; every cable type has a limit, and batteries cover the gaps.

**The furnace grows with you.** It is upgraded in place five times, and each tier begins an age (six ages in all). The Bronze Furnace is still one block;
every upgrade after it needs a formed hearth around the furnace first: walls of the right block with enough room inside. The
furnace's Structure tab shows the plan, marks every missing block in the world and says what is wrong; then the
upgrade panel asks for the parts and the heat below.

| Furnace | Age | Reaches | Heated by | Needs |
|---|---|---|---|---|
| Clay Furnace | Ember | 800 C | wood, charcoal | built at the workbench |
| Bronze Furnace | Bronze | 1100 C | wood, charcoal, coal | no hearth; 8 bronze ingots, 4 firebrick, a bellows, fire at 700 C |
| Blast Furnace | Forge | 1500 C | coal, coke, bellows | Blast hearth (brick); 4 bronze ingots, a bellows, fire at 700 C |
| Arc Furnace | Current | 2100 C | fuel, or 8 kW of electricity | Arc hearth (refractory brick, a ceiling, an Arc Electrode); 2 copper coils, 2 steel plates, 1200 C |
| Plasma Furnace | Atomic | 3200 C | 40 kW of electricity | Plasma hearth (plasma casing, 2x2x2 inside, 2 Power Ports); 2 circuits, 2 tungsten rods, 1900 C |
| Starhearth | Star | - | 300 kW held for 90 seconds to ignite | Star hearth (star casing, 3x3x3 inside, 4 Power Ports); the star core, 8 deuterium cells, 3000 C |

A bigger hearth also gives the furnace more crucibles.

**Come home at night.** Nights are cold, and rain or snow under open sky chills you faster, day or night;
the frostfell is cold even by day. At 0 warmth the cold hurts. Any roof overhead keeps the rain off, and a
fire, a torch or a hot furnace warms everything around it. Time spent beside the furnace leaves you
Well-Warmed: faster at mining and slower to freeze. The HUD warns you, with the cause, as warmth falls, and a
short line under the bars says what to do ("Soaked: find a roof", "Hungry: eat something"). Your
last furnace is home: the compass points to it, and it is where you wake up if the world gets the better of
you, with everything you carried.

**Weather.** Each world has its own sky: clear, cloudy, rain and storms that drift in and out (the first day
and night are always dry). In the frostfell and up high the rain falls as snow, in the dunes as dust. Rain
cools a furnace that stands under open sky, and storms bring lightning.

**Food and hunger.** The food bar runs down as you work and faster when you sprint. Hold food and press Use to
eat it. Cooked food fills far more than raw: meat, potatoes and dough cook in the furnace's crucibles (the
Kitchen chip on the Smelt tab), and a hearth stew forged at the furnace makes you Well-Fed. Hungry, you cannot
sprint; below 12 food you do not heal; an empty bar slowly wears your health down.

**Farming and animals.** A hoe turns grass or dirt into farmland. Wheat seeds (from tall grass), potatoes and
carrots grow on it in daylight or lamplight, twice as fast with water within four blocks; aim at a crop to see
how long it has left. Mine an animal to hunt it. Hold what it likes and it follows you: hens like wheat seeds,
goats wheat, boars potatoes and carrots. Press Use on an animal to feed it; feed two of a kind near each other
and they raise a young one. Animals you have fed stay tame. Animals keep clear of lava and cacti, and the wild
herd refills as you explore.

**Buckets, water and bread.** Water flows: it runs downhill, spreads up to seven blocks and drains away when
its source is gone. A bucket takes one source block out of still water (a lake refills the gap, a lone puddle
does not) and pours it back out as a new source. Four wheat grind into two flour at the workbench, two flour and
a bucket of water make dough, and dough bakes into bread at 220 C. A bronze bucket can carry lava, which also
burns as furnace fuel and hands the bucket back.

**Pipes and the wrench.** Bronze chutes carry items, iron fluid pipes carry water and oil, and steel hot pipes
carry steam and lava. Use the wrench on a pipe where it meets a crate, a furnace or a machine to cycle that end through
Push, Pull and Off; use it between two pipes to part or join them. Use a pipe with an empty hand to open the
pipe screen: what flows, filters and priorities. Pumps draw water, lava or oil; a boiler on a hot furnace makes
steam for a steam turbine (set the pipe end at the boiler to Pull). Hatches and power ports built into a hearth
wall feed the furnace through its walls. Breaking a full crate or machine puts what fits in your pack and leaves
the rest in a crate where it stood.

## Development

```
npm run typecheck   # TypeScript, strict
npm test            # unit tests (vitest)
npm run build       # dist/game.js + dist/index.html
npm run e2e         # drives the built game in headless Chromium (needs Playwright)
```

`npm run e2e` (about 15 minutes on software WebGL) runs three scripts. `scripts/e2e.mjs` plays the opening of
the game on desktop, a portrait phone and a landscape phone with real keyboard, mouse and touch input (mine
logs, craft, place a workbench and a furnace, fuel and light it, smelt, forge, save, reload, Continue), then
checks a sandboxed page (no storage, no pointer lock) and a browser without WebGL2; `--device=desktop|phonePortrait|phoneLandscape|sandbox`
picks one, `--no-build` reuses dist/. `scripts/e2e-features.mjs` hunts, cooks and eats, tills, plants, bakes
bread, scoops and pours lava and water and checks rain. `scripts/e2e-tech.mjs` builds a Blast hearth brick by
brick, pipes ore into it with the wrench and uses buckets on a tank. Screenshots land in `test-results/e2e*/`. In the page, `window.__hw` is a debug handle (state summary, give,
teleport, setTime, tick, save...).

| Directory | What lives there |
|---|---|
| `src/core` | shared types, the content registry, the event bus, gameplay constants |
| `src/content` | every block, item, recipe, machine, furnace tier, ore vein and objective, as data |
| `src/world` | terrain generation, chunks, lighting, meshing, the chunk worker |
| `src/game` | inventory, crafting, mining rules, survival and hunger, day and night, weather, objectives |
| `src/sim` | the furnace, hearths, power networks, machines, pipes, crops |
| `src/mobs` | animals: spawning, behaviour, feeding and breeding, saving |
| `src/render` | procedural textures, the three.js renderer, sky, particles, item icons |
| `src/player` | keyboard, mouse and touch input, physics, block interaction |
| `src/ui` | the HUD and every screen |
| `src/audio` | synthesised sound |
| `src/save` | saving and loading |
| `src/app`, `src/main.ts` | boot, title, loading, the game loop and the wiring of everything above |

All textures are painted in code and all sound is synthesised; the repository contains no asset files.
Game balance lives in `src/content` and `src/core/constants.ts`.
