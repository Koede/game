# Hearthwatt

A first-person voxel sandbox about heat, power and the furnace at the centre of your base.

You start with bare hands in a woodland. Everything you become runs through one block: the furnace. It is
where you smelt and forge, it keeps you warm through the night, it is your first generator and later the
largest machine on a power grid you build from wood, coal, wind, water, sunlight, oil, lava and uranium.
The game ends when you turn it into a star.

There are no creatures and no combat. The world itself is the danger: cold nights, long falls, deep water,
lava, radiation and reactors you forgot to cool.

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
page is closed.

## Controls

| | Keyboard and mouse | Touch |
|---|---|---|
| Move | W A S D | left thumb stick |
| Look | mouse (click the view to capture it) | drag on the right half |
| Jump / swim up | Space | Jump button |
| Sprint | Shift | push the stick to its edge |
| Mine | hold left mouse button | hold the Mine button, or press and hold on the world |
| Use / place | right mouse button | Use button, or tap the world |
| Pick hotbar slot | 1-9 or mouse wheel | tap the slot |
| Inventory and hand crafting | E | bag button |
| Hearth Log (goals) | L | tap the goal tracker |
| Pause / close a screen | Esc | pause button |
| At the furnace: pump the bellows / show the backpack | P / B | Pump button / Backpack handle |

Screens use the same slot rules everywhere: click (tap) a stack to pick it up, click (tap) where it goes;
right-click (long-press) takes half; shift-click (double-tap) or the "To ..." buttons move it straight across.
Switching away from the page pauses the game.

## How the game works

**The furnace is your crafting table.** A workbench exists, and it builds your first furnace and a few
wooden things, but nearly every recipe is forged at the furnace. Recipes are a list: pick one, see what you
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

**The furnace grows with you.** It is upgraded in place, and each tier begins an age:

| Furnace | Age | Reaches | Heated by |
|---|---|---|---|
| Clay Furnace | Ember | 800 C | wood, charcoal |
| Blast Furnace | Forge | 1500 C | coal, coke, bellows |
| Arc Furnace | Current | 2100 C | fuel, or 8 kW of electricity |
| Plasma Furnace | Atomic | 3200 C | 40 kW of electricity |
| Starhearth | Star | - | 300 kW held for 90 seconds to ignite |

**Come home at night.** Nights are cold. A hot furnace warms everything around it, and time spent beside
it leaves you Well-Warmed: faster at mining and slower to freeze. Your last furnace is home: the compass
points to it, and it is where you wake up if the world gets the better of you.

## Development

```
npm run typecheck   # TypeScript, strict
npm test            # unit tests (vitest)
npm run build       # dist/game.js + dist/index.html
npm run e2e         # drives the built game in headless Chromium (needs Playwright)
```

`npm run e2e` plays the opening of the game on desktop, a portrait phone and a landscape phone with real
keyboard, mouse and touch input (mine logs, craft, place a workbench and a furnace, fuel and light it, smelt,
forge, save, reload, Continue), then checks a sandboxed page (no storage, no pointer lock) and a browser without
WebGL2. Screenshots of every step land in `test-results/e2e/`. `--device=desktop|phonePortrait|phoneLandscape|sandbox`
picks one, `--no-build` reuses dist/. In the page, `window.__hw` is a debug handle (state summary, give,
teleport, setTime, tick, save...).

| Directory | What lives there |
|---|---|
| `src/core` | shared types, the content registry, the event bus, gameplay constants |
| `src/content` | every block, item, recipe, machine, furnace tier, ore vein and objective, as data |
| `src/world` | terrain generation, chunks, lighting, meshing, the chunk worker |
| `src/game` | inventory, crafting, mining rules, survival, day and night, objectives |
| `src/sim` | the furnace, power networks and machines |
| `src/render` | procedural textures, the three.js renderer, sky, particles, item icons |
| `src/player` | keyboard, mouse and touch input, physics, block interaction |
| `src/ui` | the HUD and every screen |
| `src/audio` | synthesised sound |
| `src/save` | saving and loading |
| `src/app`, `src/main.ts` | boot, title, loading, the game loop and the wiring of everything above |

All textures are painted in code and all sound is synthesised; the repository contains no asset files.
Game balance lives in `src/content` and `src/core/constants.ts`.
