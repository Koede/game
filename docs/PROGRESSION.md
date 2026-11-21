# Hearthwatt - the progression plan

The complete path from bare hands to the Starhearth, in six ages. **[built]** = in the game today;
**[planned]** = designed, not built; **[change]** = alters something built. Numbers for planned parts are
starting values. Detailed plans: `docs/STEAM_PLAN.md` (Ember mechanics), `docs/BREWING_PLAN.md` (tea and
coffee), `docs/BRONZE_PLAN.md` (the Bronze Age), `docs/SPEC.md` (rules of everything built). The Codex page
shows this progression as a tree.

Note on numbering: the game today has five ages and five furnace tiers. The Bronze Age inserts a new second
age and a new tier 2 (BRONZE_PLAN work item W0 renumbers everything).

## 1. The spine: one furnace, six energy forms

| Step | Energy form | Made from | Age | Carried by | Measured in |
|---|---|---|---|---|---|
| 1 | Heat | fuel in the furnace | Ember | the furnace; from Bronze on, thermocouples | degrees C, kW |
| 2 | Open steam and rotation | heat + water in a kettle, flowing water, wind | Ember | wooden axles, cogs | rpm and stress |
| 3 | Pressure steam | heat into a sealed boiler | Bronze | steam pipes | bar |
| 4 | Compressed air | rotation into a compressor | Bronze | air tubes | bar |
| 5 | Electricity | rotation into a dynamo, later direct | Forge (end) | cables | watts |
| 6 | Fission, then fusion | electricity-built machines | Atomic, Star | cables | kW to MW |

Player's rule of thumb: **heat makes steam, steam makes motion, motion makes air and - much later - watts.**
Every conversion is a block in the world you can watch working.

## 2. The six ages at a glance

| # | Age | Furnace | Max C | What it is about | Electricity |
|---|---|---|---|---|---|
| 0 | Ember | Clay Furnace (1 block) | 800 | HANDWORK: fire, copper, tin, casting, hand stations, food, brewing - no steam, no machines | none |
| 1 | Bronze | Bronze Furnace (1 block) | 1100 | steam begins: kettle and rotor, shafts with speed and stress, then heat rods, the boiler, pressure, pneumatics | none |
| 2 | Forge | Blast hearth (multiblock, needs a blast nozzle) | 1500 | iron, steel, heavy factory machines; the dynamo at the end | first watts |
| 3 | Current | Arc hearth | 2100 | electric heating, grid, electronics, turbines | kW |
| 4 | Atomic | Plasma hearth | 3200 | superalloy, fission, heavy water | tens of kW |
| 5 | Star | Starhearth | - | ignition: 300 kW for 90 s | 1 MW |

## 3. Age by age

### Age 0 - Ember (Clay Furnace, to 800 C) - about 45 minutes

- **Arrive with:** nothing. Spawn always has trees, stone, clay, gravel, water, wild wheat and an Old Works
  ruin within reach. **[built]**
- **Find:** logs, flint, rubble, clay, copper and tin ore, peat, wild wheat/potato/carrot, berries, animals
  **[built]**; wild tea bushes and coffee shrubs **[planned]**.
- **Tools:** flint, then bronze (pickaxe, axe, shovel, hoe, maul, bucket). **[built]**
- **Furnace:** single block from the workbench. Sticks 450, logs 650, peat 900, charcoal 1000; hand bellows add
  up to 250. Copper 700, bronze 800. **[built]**
- **Food:** hunting, cooking in crucibles, hoe farming, flour, dough with a water bucket, bread, hearth stew.
  **[built]**
- **Brewing [planned, BREWING_PLAN]:** grow and harvest tea and coffee; dry or roast in a crucible; a water
  bucket set on top of the furnace boils; cup + drip cone + leaves or grounds; pour the boiling water; drink
  - six drinks, each its own 3-minute boost: Green Tea (jump), Black Tea (warmth), Berry Tea (healing), Light
  Roast (speed), Dark Roast (mining), Trail Blend (hunger). One tea and one coffee boost at a time. The kettle
  also gives boiling water; any future container works too.
- **Handwork [planned, EMBER_PLAN] - the age is manual (owner: "ember era should feel very manual and like
  you're making a bunch of different stuff"):** no steam, no shafts, no machines. Hand stations worked stroke by
  stroke: Chopping Block, Hand Quern, Stone Anvil, Mortar, Clay Table, Casting Bench with moulds, Drying Rack,
  Tanning Trough, Loom, the Kettle Pot (boils water only). Metal is POURED from the crucible into moulds; bronze
  is alloyed in a pot. Leather and cloth.
- **Logistics:** carry it; crates. **No item pipes in this age** - the Bronze Chute moved to the Bronze Age.
  **[change]**
- **Threats:** cold nights, hunger, Cinder Mites in the dark, Forge Wardens and Kiln Sentries at ruins. A hot
  furnace's warm zone and torchlight are safe. **[rules built; visuals and wiring in progress]**
- **Goals, in order:** gather wood - planks - workbench - flint - flint pickaxe - rubble - clay - place
  furnace - light it - charcoal - get warm - cook a meal - eat - *clay table* - *fire a mould* - smelt copper - *first pour* - *hand quern* - till soil - plant wheat - *stone
  anvil* - reach 800 C - *alloy bronze* - *cast a bronze pickaxe head* - forge a maul - salvage an automaton - bake bread - *boil a
  bucket* - *brew a cup*. (Italics = planned goals.)
- **Gate:** the furnace screen shows its upgrade list from the start; fill it to enter the Bronze Age: 8 bronze
  ingots, 4 firebricks, 1 bellows, 2 bronze plates, 1 leather at 700 C. From here on every age is opened by the
  furnace's upgrade list. **[planned]**

### Age 1 - Bronze (Bronze Furnace, to 1100 C) - about 45 minutes  [planned, BRONZE_PLAN]

- **Furnace:** still one block; 1100 C, two crucibles.
- **Steam begins (first half of the age, STEAM_PLAN):** Copper Kettle + Steam Rotor, Water Wheel, Windmill,
  wooden axles and cogs; SPEED and STRESS; Millstone, Saw Bench, Trip Hammer, Shaft Bellows, Mechanical Pump
  and Drill automate the Ember hand stations. Clutch, Flywheel, gauges.
- **Heat moves:** Thermocouples carry furnace (or lava) heat to Hot Plates, Heat Vents and boiler Heat Ports:
  2% lost per block, 6 kW per line; they glow by temperature and burn to the touch. The furnace stays the only
  origin of heat.
- **The boiler - first multiblock:** a sealed box of Boiler Plate standing apart from the furnace, with a Gauge
  Glass, Heat Port, Water Port and Steam Port, built from a ghost preview in the Structure planner.
- **Pressure:** steam in bronze pipes, measured in bar; Pressure Gauges; Safety Valves; above 8 bar with no
  valve the weakest part bursts after a 5-second warning. Boiling dry warps the vessel.
- **Piston power:** the Steam Engine gives 16 rpm and 128 stress capacity per bar onto the shaft lines from
  the Ember Age. Steam Hammer, Steam Whistle.
- **Pneumatics:** Air Compressor on a shaft, Air Tubes, Air Tank (to 6 bar; open ends leak). Pneumatic Press,
  Pneumatic Drill, the Air Hammer hand tool, the Blast Nozzle.
- **Items move:** the Bronze Chute does nothing alone; a Vacuum Pump on the chute network (fed with air) draws
  items from every chute end toward itself and delivers them where it stands.
- **Threats:** scalding and bursts; Bellows Hounds at night.
- **Goals, in order:** Bronze Furnace - move the heat - build a steam boiler - raise steam - fit a safety
  valve - piston power - compress air - pneumatic post (vacuum chute) - press plates - forge a blast nozzle.
- **Gate:** brick walls around the furnace with a Blast Nozzle in one wall, fed by air at 2 bar: the Blast
  hearth forms.

### Age 2 - Forge (Blast hearth, to 1500 C) - about 55 minutes

- **Find:** coal, iron, limestone, sulfur, oil shale; lava with the bronze bucket. **[built]**
- **Hearth:** brick multiblock 1x1x1 to 3x3x3 inside, more crucibles and speed with size, hatches **[built]**;
  requires a Blast Nozzle **[planned]**. Coal 1250, coke 1550, lava bucket 1300, ember core 1700. Iron 1150,
  steel 1400.
- **Heavy industry [planned]:** iron axles (128 rpm), then steel (256); Rolling Mill, Drop Forge, shaft- or
  steam-driven Crusher; iron thermocouples (20 kW); steel boilers and pipes (16 bar).
- **Fluids:** iron and steel pipes, pump, tanks. **[built]**
- **First electricity, at the END of the age [planned / change]:** the Dynamo turns shaft rotation into up to
  2 kW; the Thermopile moves here; copper cable, lamps, the Acid Battery. **[cable, lamp, battery built]**
- **Defence:** iron and steel mauls, plated coat, steel cuirass. **[data and rules built]**
- **Goals, in order:** Blast hearth - smelt iron - heavy machines (rolling mill) - steel - make electricity
  (dynamo) - place a lamp - crusher - a machine finishes a job - generate 2 kW - store 1 MJ.
- **Gate:** refractory brick shell with an Arc Electrode in the roof, and a grid that can feed 8 kW.
  **[built]**

### Age 3 - Current (Arc hearth, to 2100 C) - about 60 minutes

- **Find:** quartz, bauxite, wolframite, spodumene, oil pools. **[built]**
- **Hearth:** electric heating; silicon 1700, tungsten 2000. **[built]**
- **Power:** the modern Steam Turbine turns steam straight into electricity **[built]** (decided: only the
  Ember and Bronze steam devices drive shafts); wind, solar, combustion, geothermal with built-in generators
  **[built]**. Storms boost wind and bring Arc Drones; cloud and rain cut
  solar. **[built]**
- **Machines:** still, bore rig, fast item pipes, heavy cable, circuits, Ward Beacon, arc maul. **[built]**
- **Goals:** Arc hearth - pump water - reach 1900 C - circuits - generate 10 kW - ward your base - tungsten.
- **Gate:** plasma casing shell with two power ports, 40 kW available. **[built]**

### Age 4 - Atomic (Plasma hearth, to 3200 C) - about 60 minutes  [built]

Superalloy, fused quartz, power drill, shield suit, centrifuge, fuel rods, Fission Pile (60 kW, water-cooled),
electrolyzer and deuterium, Lithium Bank, superconducting lines; the Slag Colossus in the deep.
**Goals:** Plasma hearth - superalloy - fission pile - 60 kW - deuterium - star core.
**Gate:** star casing shell with four power ports (93 casings - under review), a star core, 8 deuterium cells.

### Age 5 - Star (Starhearth)  [built]

Hold 300 kW for 90 seconds on a line that can carry it. Then 1 MW forever, every recipe at any heat.

## 4. Requirements and complexity

The Codex "Item map" places every built item by crafting steps and furnace tier with its raw cost (181 items
today; the planned ages add roughly 14 Ember mechanics items, 12 brewing items and 25 Bronze items, nearly all
at steps 1-3 of the first two ages).

## 5. Build order across the plans

1. Finish the Emberbound (visuals, screens, wiring, e2e) - in progress.
2. BREWING_PLAN - independent, small; can go first.
3. BRONZE_PLAN W0 - six tiers and ages (pure refactor, with a save migration).
3b. EMBER_PLAN - hand stations, casting, leather and cloth; move instant recipes onto stations.
4. STEAM_PLAN waves - open steam and shafts (now early Bronze).
5. BRONZE_PLAN B1-B4 - heat, boiler, pressure, air, vacuum chute.
6. Forge heavy industry and the dynamo (to be planned in the same detail once Bronze is in).
Each step ends with the full test suite, a review pass, and a republished game and Codex.

## 6. Decisions

Made by the owner: the Ember Age is manual handwork with no steam (steam, shafts, speed and stress begin in the
Bronze Age); from Bronze on each age is opened by the furnace's upgrade list; a separate Bronze Age
with pressure, pneumatics and thermocouples; the Bronze Furnace is one block and the steam boiler is the first
multiblock; the Bronze Chute lives in the Bronze Age and needs a Vacuum Pump; brewing is Ember; hand recipes
are also at the workbench; buckets take source blocks and water flows; enemies are the Emberbound.

Also decided: every tea and coffee variety gives its own boost; tea and coffee are regrowing bushes; the
kettle and any future container give boiling water; steam drives shafts in the Ember and Bronze ages and the
modern Steam Turbine (Current Age) converts straight to electricity.

Still open:
1. Star hearth: keep 93 casings or reduce?
