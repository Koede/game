# Hearthwatt - the progression plan

The complete path from bare hands to the Starhearth, with the steam-and-shafts layer worked in. Sections marked
**[built]** exist in the game today; **[planned]** are designed here and not built; **[change]** alters something
that exists. Numbers for planned parts are starting values to be tuned in playtests. Detailed rules live in
`docs/SPEC.md` (section numbers given); the Codex page shows the same progression as a tree and every item by
complexity.

> **UPDATE - six ages.** The owner added a separate BRONZE AGE between Ember and Forge (SPEC 21): pressure,
> sealed boilers, piston steam engines, pneumatics and thermocouples that carry heat. Order is now
> Ember - Bronze - Forge - Current - Atomic - Star, with a new tier-2 Bronze Furnace (1100 C). Read section 3a
> below together with SPEC 21; where the older text of this file says "Forge" for kettles/engines, the pressure
> side now belongs to Bronze and Forge is heavy industry plus the dynamo.

## 1. The spine: one furnace, five energy forms

Every age adds one way of moving energy, and each new form is made from the one before it. The furnace is the
start of every chain.

| Step | Energy form | Made from | First seen | Carried by | Measured in |
|---|---|---|---|---|---|
| 1 | Heat | fuel in the furnace | Ember | the furnace itself | degrees C |
| 2 | Steam | heat + water (kettle, later boiler) | Ember | touching blocks, later hot pipes | litres per second |
| 3 | Rotation | steam (rotor, engine, turbine), flowing water, wind | Ember | axles and gearboxes | torque, N*m |
| 4 | Electricity | rotation (dynamo, alternator), later direct | Forge | cables | watts |
| 5 | Fission, then fusion | electricity-built machines | Atomic, Star | cables | kW to MW |

Rule of thumb for the player: **heat makes steam, steam makes motion, motion makes watts.** Each conversion is a
block you place in the world and can watch working.

## 2. Power ladder by age

| Age | Heat sources | Steam | Rotation sources | Rotation users | Electricity |
|---|---|---|---|---|---|
| Ember | sticks, logs, peat, charcoal | Copper Kettle on the furnace, 20 L/s | Steam Rotor 120 N*m; Water Wheel 30-90 N*m; Windmill 20-80 N*m | Millstone, Saw Bench, Shaft Bellows | none |
| Forge | coal, coke, lava bucket, ember core | Boiler on the hearth, 80 L/s | Steam Engine 600 N*m | Trip Hammer, Crusher (shaft-driven) | Dynamo 2 kW; Thermopile 300 W; Acid Battery |
| Current | electric heating 8 kW | Boiler bank + hot pipes | Steam Turbine 2400 N*m | Alternator | Alternator 20 kW; wind, solar, combustion, geothermal with built-in generators |
| Atomic | electric heating 40 kW | fission heat (built in) | - | - | Fission Pile 60 kW; Lithium Bank; superconducting lines |
| Star | ignition | - | - | - | Starhearth 1 MW |

Shaft ratings gate the ladder the same way cables do: Wooden Axle 150 N*m, Iron Axle 1000, Steel Axle 6000.
A shaft network turns only as fast as its weakest axle and its sources allow; nothing breaks, it just slows.

## 3. Age by age

Each age lists: what you arrive with, what you must find, what you build, what threatens you, the goals in
order, and the gate to the next age.

### Age 0 - Ember (Clay Furnace, to 800 C) - about 40 minutes

- **Arrive with:** nothing. Spawn is always in woodland with trees, stone, clay, gravel, water, wild wheat and an
  Old Works ruin within reach. **[built]**
- **Find:** logs, flint (gravel), rubble, clay, copper and tin ore (shallow), peat (marsh), wild wheat, potato,
  carrot, berries, animals. **[built]**
- **Tools:** flint, then bronze (pickaxe, axe, shovel, hoe, maul, bucket). **[built]**
- **Furnace:** single block from the workbench. Fuels: sticks 450, logs 650, peat 900, charcoal 1000. Bellows
  add up to 250. Copper needs 700, bronze 800. **[built]**
- **Steam and mechanics [planned, decided: the Ember Age is all steam and motion, no electricity]:**
  a Copper Kettle on the furnace boils water; a Steam Rotor turns at 32 rpm. Shafts carry two things, SPEED
  (rpm) and STRESS (each source adds capacity, each machine adds load; load grows with speed; too much load and
  the whole line seizes until you fix it). Large and small cogs trade speed for stress. Wooden parts top out
  at 64 rpm.
  - Sources: Steam Rotor, Water Wheel (flowing water), Windmill.
  - Machines: Millstone (flour 1:1, ore to 2 crushed), Saw Bench (6 planks a log), Shaft Bellows (draft grows
    with speed), Trip Hammer (bronze plates), Mechanical Pump (piped water with no electricity), Mechanical
    Drill (mines down), Draft Fan (faster smelting).
  - Control: Clutch, Flywheel (rides out a dying fire), Speed Gauge and Stress Gauge you read in the world.
  The tension: the kettle takes 3 kW of the fire, every machine wants speed, and speed costs stress.
- **Logistics:** crates; Bronze Chutes and the wrench. **[built]**
- **Food:** hunting, cooking in crucibles, hoe farming, flour, dough with a water bucket, bread, hearth stew.
  **[built]**
- **Threats:** cold nights, hunger, Cinder Mites in the dark, Forge Wardens and Kiln Sentries at ruins. The warm
  zone of a hot furnace and torchlight are safe. **[built: rules; in progress: visuals and wiring]**
- **Goals, in order:** gather wood - planks - workbench - flint - flint pickaxe - rubble - clay - place furnace -
  light it - charcoal - get warm - cook a meal - eat - smelt copper - *boil water [planned]* - *set it turning
  [planned]* - *grind [planned]* - till soil - plant wheat - reach 800 C - bronze - bronze pickaxe - forge a maul -
  salvage an automaton - bake bread.
- **Gate:** build a Blast hearth: brick walls around the furnace (16 bricks minimum), then the upgrade
  (4 bronze, 1 bellows) at 700 C. **[built]**

### Age 0.5 (new age 1) - Bronze (Bronze Furnace, to 1100 C) - about 45 minutes  [planned]

- **Arrive with:** bronze, a kettle and rotor line, a mill.
- **Furnace:** in-place upgrade (8 bronze, 4 firebrick, bellows). Still one block.
- **Heat moves:** thermocouples carry furnace heat a few blocks (2% lost per block, 6 kW per line, they glow
  and burn to the touch) to boilers, hot plates and heat vents. The furnace stays the only origin of heat.
- **Pressure:** sealed boilers push steam into bronze steam pipes; pressure in bar; piston steam engines give
  more speed and stress capacity the higher the pressure; gauges and safety valves; above 8 bar without a valve
  something bursts.
- **Pneumatics:** a compressor fills air tubes and tanks; pneumatic tubes shoot items across the base; a
  pneumatic press makes plates and wire; a pneumatic drill; the air hammer hand tool; the blast nozzle.
- **Threats:** scalding and bursts are the new danger; Bellows Hounds at night.
- **Goals:** Bronze Furnace - move heat - seal a boiler - read the pressure - fit a valve - piston power -
  compress air - pneumatic post - press plates - make a blast nozzle.
- **Gate:** brick shell around the furnace with a blast nozzle fed by air: the Blast hearth (Forge Age).

### Age 1 (now age 2) - Forge (Blast hearth, to 1500 C) - about 55 minutes

- **Find:** coal, iron, limestone, sulfur, oil shale (bronze pickaxe); lava (bronze bucket). **[built]**
- **Tools:** iron, then steel. Plated coat, steel cuirass, iron and steel mauls. **[built]**
- **Furnace:** a brick hearth 1x1x1 to 3x3x3 inside; more crucibles and speed with size; blowers in the walls;
  item and fluid hatches. Coal 1250, coke 1550, lava bucket 1300, ember core 1700. Iron 1150, steel 1400.
  **[built]**
- **Steam and shafts [planned]:** Iron Axles (1000 N*m). Steam Engine **[change]** becomes a rotation source
  (600 N*m on top of the hearth, fed water by pipe or pump). Trip Hammer makes plates from 2 ingots (the forge
  recipe stays, slower by hand). The Crusher **[change]** can be driven by shaft (200 N*m) as well as by wire.
- **First electricity [planned / change]:** the Dynamo turns up to 400 N*m into 2 kW. The Thermopile moves here
  from the Ember Age. Copper cable, lamps, the Acid Battery. This is where the power strip first lights up.
- **Fluids:** iron and steel pipes, pump, tanks, boiler. **[built]**
- **Threats:** Bellows Hounds at night; deeper caves. **[built: rules]**
- **Goals, in order:** Blast hearth - pipe it in - smelt iron - *iron axle and trip hammer [planned]* - steel -
  *make electricity (dynamo or thermopile) [change of position]* - place a lamp - crusher - a machine finishes a
  job - generate 2 kW - store 1 MJ.
- **Gate:** refractory brick shell with an Arc Electrode in the roof (24 bricks + 1 electrode minimum), then the
  upgrade (2 coils, 2 steel plate) at 1200 C. Needs a grid that can feed 8 kW. **[built]**

### Age 2 - Current (Arc hearth, to 2100 C) - about 60 minutes

- **Find:** quartz, bauxite (iron pickaxe); wolframite, spodumene (steel pickaxe); oil pools. **[built]**
- **Furnace:** electric heating to 2100 C; fuel still works for a cold start. Silicon 1700, tungsten 2000.
  **[built]**
- **Steam at scale [planned / change]:** boilers feed hot pipes; the Steam Turbine becomes a rotation source
  (2400 N*m at 800 L/s) on Steel Axles (6000 N*m); the Alternator turns up to 2500 N*m into 20 kW
  (8 W per N*m - better than the dynamo's 5). A furnace-fed turbine hall is the first big power plant.
- **Self-contained generators [built]:** wind turbine, solar panel, combustion engine (refined fuel), geothermal
  tap. These carry their own generators and need no shafts.
- **Machines:** still, bore rig, fast item pipes, heavy cable, circuits. Ward Beacon. Arc maul. **[built]**
- **Weather matters:** storms boost wind and bring Arc Drones; cloud and rain cut solar. **[built]**
- **Goals, in order:** Arc hearth - pump water - reach 1900 C - circuits - *steam turbine hall [planned]* -
  generate 10 kW - ward your base - tungsten rods.
- **Gate:** plasma casing shell with two power ports (53 casings minimum), upgrade (2 circuits, 2 tungsten rods)
  at 1900 C, and 40 kW available. **[built]**

### Age 3 - Atomic (Plasma hearth, to 3200 C) - about 60 minutes

- **Find:** pitchblende (power drill), deep caves, the Slag Colossus. **[built]**
- **Build:** superalloy, fused quartz, power drill, shield suit, centrifuge, fuel rods, Fission Pile (60 kW,
  water-cooled, melts down if neglected), electrolyzer and deuterium cells, Lithium Bank, superconducting
  lines. **[built]**
- **Goals, in order:** Plasma hearth - superalloy - place a fission pile - generate 60 kW - deuterium - star core.
- **Gate:** star casing shell with four power ports (93 casings minimum - under review, see section 6), a star
  core and 8 deuterium cells at 3000 C. **[built]**

### Age 4 - Star (Starhearth)

- Hold 300 kW for 90 seconds on a line that can carry it. Then the furnace is a star: 1 MW forever, every
  recipe at any heat, warmth and light across the base. The game continues. **[built]**

## 4. Requirements and complexity

The Codex "Item map" places all 181 items by crafting steps (columns) and furnace tier (rows), with total raw
cost on each. The shape today:

| Steps from raw | Items | Typical examples |
|---|---|---|
| 0 | 58 | ores, logs, clay, meat, drops |
| 1 | 25 | planks, charcoal, ingots, flour, cooked food |
| 2 | 21 | bronze, tools, bricks, wire, dough |
| 3 | 34 | plates, coils, cables, pipes, mauls |
| 4 | 29 | chassis, circuits, most machines |
| 5 | 14 | fission pile, lithium bank, star core |

The costliest single items: star core (104 raw), fission pile (38), shield suit (30), steel cuirass (28).
The steam layer adds about 14 items, almost all at steps 1-3 in the first two ages, which is where the game
is thinnest on things to build.

## 5. Build plan for the steam layer

Order matters because several existing things change role. Each wave leaves the game playable.

1. **Data and contracts:** `mech` on blocks, torque fields on machine specs, axle axis in the voxel, the new
   blocks, items, recipes and goals; solver proves the game still completes. Textures and sounds (shaft creak,
   millstone, saw, hammer).
2. **Simulation:** shaft networks (same shape as the electrical solver), kettle boiling from furnace heat,
   rotor, water wheel and windmill as sources, millstone, saw bench, shaft bellows, trip hammer, dynamo and
   alternator bridging to the electrical grid; steam engine and steam turbine change to rotation sources;
   crusher accepts either drive. Saves from before the change keep working: an old steam engine or turbine
   wired to a cable gets a dynamo/alternator placed for it if the neighbouring cell is free, otherwise a toast
   explains.
3. **World and rendering:** axles, gearboxes, rotors, wheels and machine parts turn at the network's speed;
   steam puffs; stalled and overloaded states are visible.
4. **Screens and controls:** shaft network panel on machine screens, HUD strip shows shaft power near a shaft,
   Structure and How to Play updated, Codex refreshed.
5. **Playtest:** a scripted run that mills flour, saws planks and lights a lamp from a dynamo before any other
   generator exists; full end-to-end suite on desktop and phone.

## 6. Decisions I made, and ones that are yours

Made (say if you want them changed):
- Mechanical power never breaks blocks; an overstressed line seizes until fixed.
- Workbench and hand recipes stay; the mechanical machines are better versions, not replacements.
- Wind, solar, combustion and geothermal keep built-in generators so the Current Age is not all shafts.
- The thermopile stays in the game but moves to the Forge Age.

Yours:
1. ~~Ember Age electricity~~ - decided: none. The Ember Age runs on steam, speed and stress (SPEC 20.5).
2. **Steam turbine as a shaft source** (needs an alternator) or left as a direct generator? The plan converts it,
   which makes the turbine hall a real build; leaving it is less work and less to learn.
3. **Star hearth size:** 93 casings takes about a quarter of a full playthrough. Shrink the minimum shell or
   cheapen the casing?
