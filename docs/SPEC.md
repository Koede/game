# HEARTHWATT - build spec

Hearthwatt is an ORIGINAL first-person voxel sandbox for the browser. The player asked for a block-building
game "more focused on technological advancement and generating power from resources. Your furnace is your
crafting table, there is a crafting table but the furnace is the main place in one's base they should
congregate to."

It must not recreate any existing game: no borrowed names, creatures, items, textures, UI layouts or
recipes. No shaped 3x3 crafting grid - crafting is always a recipe LIST (pick a row, see have/need, tap to make).
All art is procedural 16x16 pixel textures with our own palette; all sound is synthesised.

THE PLAYER IS VERY LIKELY ON A PHONE. Touch controls and phone-sized UI (portrait ~400px wide AND landscape)
are first-class, not an afterthought. Desktop (keyboard + mouse, pointer lock) must be equally good.

Repo root: /home/user/game. Stack: TypeScript (strict), three.js 0.170 (bundled), esbuild, vitest. No other
dependencies may be added. `npm run build` -> dist/game.js + dist/index.html (+ dist/artifact.html).

---------------------------------------------------------------------------------------------------------

## 1. The game in one page

Pillars
1. THE FURNACE IS THE HEART. One furnace block, upgraded in place through five tiers, is fire, forge, first
   generator, grid console, warm shelter, respawn anchor and finally the win condition. ~75% of all recipes
   are made at it. The workbench exists (it builds the first furnace and a handful of cold wooden things) but
   is deliberately minor.
2. HEAT FIRST, THEN WATTS. Early game you manage a real fire (fuel, temperature, bellows). Mid game the
   furnace's heat becomes your first electricity. Late game the furnace is the largest consumer on a power
   grid you built from wind, sun, water, oil, lava and uranium. The finale turns it into a star.
3. TECHNOLOGY IS A PLACE, NOT A MENU. The furnace's recipe list IS the tech tree: locked rows say what
   temperature / tier they need. No research points.
4. NO CREATURES, NO COMBAT. Danger is environmental: cold nights, falls, drowning, lava, radiation, meltdown.

Loop: explore and mine by day -> come home to the warm furnace at night -> smelt, forge, upgrade -> build
power -> upgrade the furnace -> repeat, until the Starhearth is ignited.

Ages (index -> name -> furnace tier that begins it)
0 Ember Age (Clay Furnace) - 1 Forge Age (Blast Furnace) - 2 Current Age (Arc Furnace) -
3 Atomic Age (Plasma Furnace) - 4 Star Age (Starhearth)

---------------------------------------------------------------------------------------------------------

## 2. Content roster (authoritative keys - src/content implements exactly these; it may add detail, not rename)

### 2.1 Blocks (68)
Natural: air, corestone (unbreakable floor at y=0), stone (drops rubble), rubble, dirt, grass (drops dirt),
sand, gravel (drops gravel + 25% flint), clay, snow, ice, basalt, limestone, water (liquid), lava (liquid,
light 15, contactDamage 4, warmth 4), oak_log, oak_leaves (drops: 30% fiber, 15% stick), pine_log,
pine_leaves (same drops), tall_grass (cross, drops 50% fiber), dry_shrub (cross, drops 1-2 stick).
Ores: coal_ore (drops 1-2 coal), copper_ore, tin_ore, iron_ore, sulfur_ore (drops 1-2 sulfur), quartz_ore,
bauxite, wolframite, spodumene, pitchblende (radiation 2), oil_shale. Ores other than coal/sulfur drop themselves.
Built: plank, stone_brick, brick, glass (translucent), concrete, torch (shape torch, light 13, warmth 2),
workbench (station), crate (machine 'crate'), lamp (machine, lightActive 15).
Furnaces (machine 'furnace', oriented, power 'device'): furnace_clay, furnace_blast, furnace_arc,
furnace_plasma, furnace_star. Active flag = furnace is hot (>= 200 C): frontActive texture, lightActive
11/12/13/14/15, warmthActive 6/8/10/12/24.
Generators (power 'device'): thermopile, steam_engine, burner_generator, water_wheel, wind_turbine,
solar_panel (shape slab), combustion_engine, geothermal_tap, fission_pile.
Grid: copper_cable, heavy_cable, super_cable (shape cable, power 'cable'), battery, lithium_bank.
Consumers (power 'device'): lamp, blower, space_heater (warmthActive 6), crusher, still, bore_rig,
centrifuge, electrolyzer.
Hazard: corium (radiation 8, light 9, hardness -1... breakable only with tier 5; drops none).

Tool tiers (minTier): hands 0 - flint 1 - bronze 2 - iron 3 - steel 4 - power drill 5.
 pickaxe blocks: stone 1, rubble 0, coal/copper/tin/limestone 1, iron/sulfur/basalt/oil_shale 2,
 quartz/bauxite 3, wolframite/spodumene 4, pitchblende 5, corium 5. Machines: pickaxe, minTier 0, hardness ~2
 (always drop themselves so nothing is ever lost). axe: logs, plank, workbench, crate. shovel: dirt, grass,
 sand, gravel, clay, snow. Hardness guide (seconds by hand): leaves 0.3, dirt/sand 0.8, logs 2, stone 4,
 ores 5-8, deep ores 10-14.

### 2.2 Items (non-block, ~60)
Raw: stick, fiber, cord, flint, coal, charcoal, coke, sulfur.
Tools (kind, tier, speed, durability): flint_pickaxe/axe/shovel (1, 2.0, 64); bronze_* (2, 3.0, 192);
iron_* (3, 4.5, 384); steel_* (4, 6.0, 768); power_drill (pickaxe, 5, 10, 3000, universal).
Metals: copper_ingot, tin_ingot, bronze_ingot, iron_ingot, steel_ingot, aluminum_ingot,
crushed_copper, crushed_tin, crushed_iron.
Parts: firebrick, ceramic_insulator, bellows, iron_plate, steel_plate, copper_wire, copper_coil, chassis,
graphite_electrode, silica, silicon_wafer, circuit, alumina, tungsten_powder, tungsten_rod, lithium_salt,
yellowcake, enriched_pellet, fuel_rod, empty_cell, deuterium_cell, superalloy, fused_quartz, magnet_ring,
star_core, fuel_canister.
Gear: pail, water_pail (use on water: pail -> water_pail; use water_pail on a block face: places a water
block and returns the pail), padded_coat (in inventory: warmth drain x0.5), shield_suit (in inventory:
radiation x0.1).

Fuels (FuelSpec: energyJ, burnS, flameTempC): stick 30k/12/450 - plank 60k/20/550 - oak_log & pine_log
200k/50/650 - charcoal 400k/80/1000 - coal 800k/100/1250 - coke 1200k/120/1550.

### 2.3 Recipes
HAND: plank x4 <- 1 oak_log (and a pine_log variant) | stick x4 <- 2 plank | cord <- 3 fiber |
flint_pickaxe <- 2 flint, 2 stick, 1 cord | flint_axe <- same | flint_shovel <- 1 flint, 2 stick, 1 cord |
workbench <- 6 plank | torch x4 <- 1 stick + 1 charcoal (and a coal variant).
WORKBENCH (the complete list, forever): furnace_clay <- 12 rubble, 6 clay | crate <- 8 plank |
stone_brick x4 <- 4 rubble | pail <- 3 plank, 1 cord | padded_coat <- 6 cord, 6 fiber | bellows <- 4 plank, 4 cord.

FURNACE - kind 'smelt' (exactly ONE input item type; loaded into a crucible, timed; minTempC / timeS / minTier):
 charcoal <- oak_log (pine variant) 300/8 | tin_ingot <- tin_ore 250/8 | firebrick x2 <- clay 400/6 |
 copper_ingot <- copper_ore 700/10 | glass <- sand 700/8 | crushed_tin -> tin_ingot 250/5 |
 crushed_copper -> copper_ingot 700/6 | coke <- coal 1000/12/T2 | iron_ingot <- iron_ore 1150/12/T2 |
 crushed_iron -> iron_ingot 1150/8/T2 | aluminum_ingot <- 2 alumina 1500/12/T3 |
 tungsten_rod <- 2 tungsten_powder 2000/16/T3 | fused_quartz <- 2 silica 2400/12/T4.
FURNACE - kind 'forge' (several inputs, made instantly if the furnace is at >= minTempC; minTempC[/minTier]):
 T1: bronze_ingot x4 <- 3 copper_ingot, 1 tin_ingot 800 | bronze_pickaxe <- 3 bronze_ingot, 2 stick 600 |
  bronze_axe <- same | bronze_shovel <- 1 bronze_ingot, 2 stick 600 | brick <- 4 firebrick 400 |
  ceramic_insulator x2 <- 1 clay, 1 sand 600 | copper_wire x3 <- 1 copper_ingot 500 |
  copper_cable x6 <- 3 copper_wire, 2 ceramic_insulator 500 | thermopile <- 4 copper_ingot, 2 tin_ingot, 2 firebrick 700 |
  lamp <- 1 glass, 2 copper_wire 500.
 T2: iron_pickaxe/axe/shovel <- 3/3/1 iron_ingot, 2 stick 1000 | iron_plate <- 2 iron_ingot 900 |
  copper_coil <- 4 copper_wire, 1 iron_ingot 700 | chassis <- 4 iron_plate, 2 bronze_ingot 1000 |
  steam_engine <- 1 chassis, 2 copper_coil, 4 iron_plate, 2 glass 1000 |
  burner_generator <- 1 chassis, 2 copper_coil, 4 firebrick 1000 | water_wheel <- 12 plank, 2 iron_plate, 2 copper_coil 700 |
  blower <- 2 iron_plate, 1 copper_coil, 1 bellows 900 | space_heater <- 2 iron_plate, 1 copper_coil 900 |
  crusher <- 1 chassis, 2 iron_plate, 1 copper_coil, 4 flint 1000 | battery <- 2 iron_plate, 2 copper_ingot, 3 sulfur 900 |
  steel_ingot x2 <- 2 iron_ingot, 1 coke, 1 limestone 1400 | steel_plate <- 2 steel_ingot 1300 |
  steel_pickaxe/axe/shovel <- 3/3/1 steel_ingot, 2 stick 1300 | graphite_electrode <- 3 coke 1200 |
  concrete x8 <- 4 gravel, 2 sand, 2 limestone 600.
 T3: silicon_wafer <- 2 silica, 1 coke 1700 | circuit <- 1 silicon_wafer, 3 copper_wire, 1 ceramic_insulator 900 |
  heavy_cable x6 <- 3 aluminum_ingot, 2 ceramic_insulator 900 | empty_cell x2 <- 1 aluminum_ingot 900 |
  wind_turbine <- 3 aluminum_ingot, 2 copper_coil, 1 steel_plate 1200 | solar_panel <- 2 silicon_wafer, 1 glass, 1 aluminum_ingot 1200 |
  still <- 1 chassis, 2 steel_plate, 2 glass, 1 copper_coil 1200 |
  combustion_engine <- 1 chassis, 4 steel_plate, 3 copper_coil, 1 circuit 1400 |
  geothermal_tap <- 1 chassis, 4 steel_plate, 2 copper_coil, 1 circuit 1400 |
  bore_rig <- 1 chassis, 2 tungsten_rod, 2 copper_coil, 1 circuit 1600.
 T4: superalloy x2 <- 2 steel_ingot, 1 tungsten_rod, 1 aluminum_ingot 2600 |
  power_drill <- 2 superalloy, 2 tungsten_rod, 1 copper_coil, 1 battery 2600 |
  lithium_bank <- 6 lithium_salt, 2 superalloy, 2 circuit 2400 | shield_suit <- 4 superalloy, 2 fused_quartz, 6 cord 2400 |
  centrifuge <- 1 chassis, 4 superalloy, 2 copper_coil, 2 circuit 2600 |
  electrolyzer <- 1 chassis, 2 superalloy, 2 fused_quartz, 1 circuit 2600 |
  fuel_rod <- 4 enriched_pellet, 1 superalloy 2000 | fission_pile <- 1 chassis, 6 superalloy, 4 fused_quartz, 4 circuit 2800 |
  magnet_ring <- 4 copper_coil, 2 superalloy, 2 lithium_salt 2800 |
  super_cable x6 <- 1 magnet_ring, 2 aluminum_ingot, 2 ceramic_insulator 2600 |
  star_core <- 6 magnet_ring, 8 superalloy, 6 fused_quartz, 4 circuit 3000.
MACHINE recipes (station = machine kind; ONE input item type; timeS; energyJ = drawW x timeS):
 crusher (1 kW, 4 s): crushed_copper x2 <- copper_ore | crushed_tin x2 <- tin_ore | crushed_iron x2 <- iron_ore |
  silica x2 <- quartz_ore | alumina x2 <- bauxite | tungsten_powder x2 <- wolframite | lithium_salt x2 <- spodumene |
  yellowcake x2 <- pitchblende | gravel <- rubble | sand <- gravel.
 still (2 kW, 20 s): fuel_canister <- 2 oil_shale.
 centrifuge (8 kW, 20 s): enriched_pellet <- 4 yellowcake.
 electrolyzer (20 kW, 45 s, must touch water): deuterium_cell <- 1 empty_cell.

### 2.4 Furnace tiers (FurnaceTierSpec)
| tier | block | name | maxTempC | heatCapacityJ | lossWPerC | crucibles | fuelSlots | speed | electricHeatW | warmth | upgradeTempC | upgradeCost |
|1| furnace_clay | Clay Furnace | 800 | 150 | 2.0 | 1 | 1 | 1.0 | 0 | 6 | - | - (crafted at the workbench) |
|2| furnace_blast | Blast Furnace | 1500 | 300 | 2.5 | 2 | 2 | 1.25 | 0 | 8 | 700 | 12 firebrick, 8 bronze_ingot, 1 bellows |
|3| furnace_arc | Arc Furnace | 2100 | 400 | 3.0 | 3 | 2 | 1.5 | 8000 | 10 | 1200 | 3 graphite_electrode, 4 copper_coil, 8 steel_plate, 8 firebrick |
|4| furnace_plasma | Plasma Furnace | 3200 | 800 | 8.0 | 4 | 2 | 2.0 | 40000 | 12 | 1900 | 4 tungsten_rod, 8 steel_plate, 6 copper_coil, 3 circuit, 4 aluminum_ingot |
|5| furnace_star | Starhearth | 3200 (5000 once ignited) | 800 | 8.0 | 4 | 2 | 3.0 | 40000 | 24 | 3000 | 1 star_core, 8 deuterium_cell |

### 2.5 Machines (MachineSpec; numbers live in src/content/tech.ts, behaviour in src/sim)
Generators
| kind | output | rule |
| thermopile | 0.25 W per C above 100 of an adjacent furnace, cap 300 W | must touch a furnace (any of 6 faces). Draws 4x its output from the furnace as heat. |
| steam_engine | min(2000, 4 x (T - 250)) W | must sit directly ON TOP of a furnace and touch water on one of its 4 sides. Draws 3x its output as heat. |
| burner_generator | 3000 W | burns any FuelSpec item from its fuel slot at 30% efficiency (electric J = energyJ x 0.3). Load-following (see 3.2). |
| water_wheel | 400 W | needs >= 2 water blocks among its 6 neighbours. Output is divided by the number of water wheels within 3 blocks (itself included). |
| wind_turbine | 1500 W x wind(t) x altitude | needs open sky (no solid block anywhere above). wind(t) = slow noise in 0.25..1; altitude = clamp((y-40)/40, 0.25, 1). |
| solar_panel | 300 W x sunlight (0 at night) | needs open sky. |
| combustion_engine | 12000 W | burns fuel_canister: 6 MJ each at 40% = 2.4 MJ electric (200 s at full load). Load-following. |
| geothermal_tap | 2000 W per adjacent lava block, cap 6000 W | never depletes. |
| fission_pile | 60000 W | burns fuel_rod: 72 MJ electric each (20 min). Needs >= 2 water blocks among its 6 neighbours. See 3.3. |
| furnace (tier 5, ignited) | 1,000,000 W | the Starhearth after ignition. |
Storage: battery ("Acid Battery") 2 MJ, 3 kW | lithium_bank 40 MJ, 150 kW. Charging is 90% efficient.
Cables (rating of the whole network = lowest-rated cable in it; a network without any cable is unlimited):
copper_cable 10 kW | heavy_cable 120 kW | super_cable 2 MW.
Consumers
| lamp 10 W | lit (active) while powered |
| blower 150 W | keeps the draft of every adjacent furnace at >= 0.8 x f |
| space_heater 300 W | warm radius 6 while powered |
| crusher 1000 W | runs crusher recipes: 1 input slot, 1 output slot |
| still 2000 W | still recipes |
| bore_rig 4000 W | mines the column straight below it, 1 block per 2 s, top to bottom, stops at corestone/liquids; drops go to its 9-slot buffer; pauses when the buffer is full |
| centrifuge 8000 W | centrifuge recipes |
| electrolyzer 20000 W | electrolyzer recipes; only runs while touching water |
| furnace electric heat | tier 3: up to 8 kW, tier 4-5: up to 40 kW (thermostat, see 3.1) |
| Starhearth ignition | 300 kW for 90 s |
crate: 27 slots. Every machine with an output buffer pushes finished items into a crate that touches it, if any.

### 2.6 Ore veins (OreVeinSpec; y band, veins per chunk x size, biome multipliers)
coal_ore 20-70, 5 x 8 (marsh x1.5) | copper_ore 16-60, 4 x 6 (dunes x2) | tin_ore 30-66, 2.5 x 5 | limestone 22-52, 1.5 x 14 |
iron_ore 6-46, 4 x 6 (marsh x1.5) | sulfur_ore 4-34, 1 x 5 (scar x3) | oil_shale 10-40, 1 x 8 (dunes x2, scar x2) |
quartz_ore 6-38, 1.5 x 5 | bauxite 18-46, 1.5 x 6 (dunes x2) | wolframite 3-20, 0.7 x 5 (frostfell x2) |
spodumene 3-22, 0.6 x 5 (dunes x2) | pitchblende 2-14, 0.5 x 4 (scar x3).
Nothing is biome-exclusive: every ore exists everywhere, some biomes are richer.

### 2.7 Objectives (in order; the tracker shows the first incomplete one)
gather 4 logs (any: break oak_log or pine_log x4) -> make 4 plank -> place workbench -> have 3 flint ->
make flint_pickaxe -> have 12 rubble and 6 clay (two objectives) -> place furnace_clay -> flag furnace_lit ->
make 4 charcoal -> flag well_warmed -> make 2 copper_ingot -> make 4 bronze_ingot -> make bronze_pickaxe ->
furnaceTemp 800 (bellows) -> generate 100 W (thermopile) -> place lamp -> furnaceTier 2 -> make 8 iron_ingot ->
make 6 steel_ingot -> place crusher -> flag machine_job -> generate 2000 W -> stored 1 MJ -> furnaceTier 3 ->
furnaceTemp 1900 -> make 2 circuit -> generate 10000 W -> make 4 tungsten_rod -> furnaceTier 4 ->
make 8 superalloy -> place fission_pile -> generate 60000 W -> make 8 deuterium_cell -> make star_core ->
furnaceTier 5 -> flag ignited.
Flags emitted by code: furnace_lit, bellows_pumped, well_warmed, rested, machine_job, ignited.

---------------------------------------------------------------------------------------------------------

## 3. Rules

### 3.1 The furnace (simulated every tick, dt = 0.05 s) - constants in src/core/constants.ts
State: tier, tempC (starts at ambient 20), lit, draft 0..1, fuel slots, current burn (item + seconds left),
crucibles [{ input: Slot, progress s, output: Slot }], electric on/off, ignition { state, progress }.
```
draft   = max(0, draft - 0.1*dt);  a Blower holds it at >= 0.8*f.   pump(): draft = min(1, draft + 0.34)
burning : lit && a fuel item is burning. When one burns out the next is taken from the fuel slots; if none
          is left the fire dies (lit = false, event furnace:out). Burn time elapses at rate (1 + draft).
flameEff= fuel.flameTempC + 250*draft
Qfuel   = burning && temp < flameEff ? (fuel.energyJ / fuel.burnS) * (1 + draft) : 0
Qelec   = electric (tier >= 3, switched on, on a network) ? f * demandW : 0
          demandW = clamp(loss + extract + (maxTempC - temp) * C / 2, 0, electricHeatW)      // thermostat to max temp
loss    = lossWPerC * (temp - 20);   extract = sum of thermopile / steam engine heat draw
temp   += (Qfuel + Qelec - loss - extract) * dt / heatCapacityJ
temp    = clamp(temp, 20, tier.maxTempC); fuel heating never pushes temp past flameEff (clamp to flameEff
          when Qfuel alone would overshoot), so a steady fire sits exactly at its flame temperature.
hot     = temp >= 200  -> the voxel's active flag (glow, light, warmth) follows `hot`.
```
- Lighting: `light()` needs fuel in a fuel slot. Adding fuel to a furnace that is still hot (>= 200 C) relights it automatically.
- Smelting: a crucible advances while temp >= recipe.minTempC, at speed tier.speed x (1 + min(1, (temp - minTempC)/300)).
  Each completed item moves to the crucible's output stack (event furnace:smelted). The crucible picks its recipe
  from the input item (smelt inputs are unique). Loading requires recipe.minTier <= tier.
- Forging: needs temp >= recipe.minTempC and tier >= recipe.minTier. Ingredients come from the player's inventory
  first, then from crates within 4 blocks of the furnace. Each forge removes 25 C. Output goes to the player's inventory
  (refused when it would not fit). Events: item:made, sfx forge.
- Upgrading (in place): needs upgradeCost (same ingredient sources) and temp >= upgradeTempC. The voxel's block id
  changes to the next tier's block (facing and state preserved), the entity keeps everything.
- Starhearth: tier 5 behaves like tier 4 until ignited. `startIgnition()` is allowed at temp >= 3000 C on a network.
  It then demands IGNITION_POWER_W (300 kW) on top of heating; progress advances while f >= 0.95 and resets to 0
  ('failed') if f < 0.95 for more than 2 s in a row. After IGNITION_SECONDS (90 s): ignited = true -> temp is
  pinned at 5000 C, it needs no fuel or power, generates 1 MW, every forge/smelt minimum is met; flag 'ignited',
  event game:won. The game continues afterwards.
- Rest: at night, when the player is inside the warm radius of a hot furnace, `rest()` skips the clock to dawn.
  It is refused unless the fire can last: remaining burn time (all fuel in the firebox at the current draft) or an
  electrically heated furnace. It consumes 60 s worth of fuel. Flag 'rested'.
- Home: the last furnace the player placed or opened is "home": respawn point and HUD compass target.

### 3.2 Power networks
Every block with `power` ('cable' or 'device') joins a network with its 6-neighbour power blocks (flood fill;
rebuild affected networks whenever a power block is placed or removed). Per network, per tick:
```
G      = sum of generator available watts
D      = sum of consumer demand watts
rating = min cable rating in the network (Infinity when it has no cables)
dis    = min(max(D - G, 0), sum battery.maxOutW)          maxOutW = min(rateW, storedJ/dt)
supply = min(G + dis, rating)
f      = D > 0 ? min(1, supply / D) : 1                   // satisfaction; every consumer gets the same f
used   = f * D
fromGen= min(G, used);   fromBat = used - fromGen          // batteries only cover what generators cannot
chg    = dis > 0 ? 0 : min(min(G, rating) - used, sum battery.maxInW)    maxInW = min(rateW, (capJ-storedJ)/(0.9*dt))
batteries share fromBat / chg pro rata:  storedJ += (0.9*chg_i - out_i) * dt
load   = G > 0 ? (fromGen + chg) / G : 0                   // fuel generators burn fuel in proportion to load
overloaded = (G + dis) > rating && D > supply
```
Consumers run at speed x f; below f = 0.25 they stall (no progress). Fuel-burning generators only count as
available while they hold fuel, and consume fuel energy = output x load x dt / efficiency. Emit power:alert
('overload', 'brownout', 'recovered') on state CHANGES only (never every tick).
Network stats exposed to the UI: generationW (potential), demandW, deliveredW, storedJ, capacityJ, rating,
satisfaction f, overloaded, list of members with their status text, and a rolling 60 s history of G and used.

### 3.3 Fission
core temp C; with a fuel rod loaded and switched on it produces heat; cooled = >= 2 water neighbours.
Cooled: core settles at 600 C and outputs 60 kW. Uncooled: output 0 and core rises 8 C/s from wherever it is.
>= 900 C: power:alert meltdown_warning (once), sfx alarm every 2 s, radiation 4 in radius 6.
>= 1200 C for 10 s: meltdown -> explosion radius 3 (removes non-corestone blocks, destroys machines), the pile
becomes a corium block. Switching the pile off or restoring water cools it 20 C/s.

### 3.4 Survival (per second unless noted)
Health 20. Warmth 0..100: drain 0.3 at night, +0.2 day / +0.6 night in frostfell, +0.4 while in water; x0.5 with a
padded_coat; x0.5 while Well-Warmed. Regain +4 inside any heat radius (furnace/torch/lava/space heater: block
warmth radius, Euclidean), +0.5 on a mild day. At 0 warmth: 1 damage every 3 s. Well-Warmed: 8 s within the
radius of a furnace at >= 400 C grants 300 s of +25% mining speed and half warmth drain (flag well_warmed, event buff:gained).
Air: 15 s underwater, then 1 damage/s. Fall: 1 damage per block beyond 3.5. Lava: 4 damage/s. Radiation: sum of
radiating blocks within 4 blocks (linear falloff), dose > 1 -> 1 damage per 2 s (x0.1 dose with shield_suit).
Health regenerates 1 per 4 s when warmth > 50 and no damage for 8 s. Death: respawn at home furnace (or world
spawn) keeping the whole inventory; full health if the home furnace is hot, half otherwise.

### 3.5 Time
A day is 900 s. timeOfDay 0..1 (0 = sunrise, 0.64 = sunset). sunlight factor 1 by day, ~0.08 at night with
smooth 0.05-wide dawn/dusk ramps. Events time:phase on change. A new world starts at 0.05 (early morning).

### 3.6 Mining and placing
Mining time = hardness / speed, speed = tool.speed if the held tool's kind matches the block's tool (or the tool
is universal) else 1; x1.25 while Well-Warmed. If block.minTier > the effective tool tier (0 for hands or a
wrong tool kind) mining takes 3x longer and drops nothing. hardness -1 cannot be mined. A matching tool loses 1
durability per block. Drops go straight into the inventory (event item:gained); what does not fit is lost with a
warning toast. Reach 5 blocks. Blocks cannot be placed inside the player. Oriented blocks face the player.
Interact ("use") priority: a held block is placed when the player forces it (Shift + Use, the touch Place toggle) or
when it is a building block (machine, generator, tank, cable, pipe, hearth wall) aimed at a block with a screen
anywhere but its front (an engine on a furnace, a tank on a tank); else station/machine block under the crosshair
opens its screen (from any face with an empty hand, an item or an ordinary block); else item-specific use (pail);
else place the held block item. Use looks past a thin block without a screen (a cable in a furnace mouth).

---------------------------------------------------------------------------------------------------------

## 4. Architecture

```
src/core/      (DONE, read-only for everyone) types.ts, registry.ts, events.ts, gameEvents.ts, context.ts,
               constants.ts, math.ts
src/content/   blocks, items, recipes, tech (ages, furnace tiers, machines), objectives, ore veins
src/world/     worldgen, chunks, World (implements IWorld), lighting, mesher, chunk worker + pool
src/game/      inventory, crafting, mining rules, player state, survival, clock, objectives
src/sim/       block entities: furnace, power networks, machines, explosions
src/render/    procedural textures, three.js renderer, chunk meshes, sky, particles, held item, item icons
src/player/    input (keyboard/mouse/touch), physics, raycast, block interaction
src/ui/        styles.css, kit/ (widgets), hud/, screens/
src/audio/     WebAudio synth
src/save/      persistence          src/main.ts  wiring + game loop        scripts/e2e.mjs  browser test
```
Layering (a module may import from modules to its left, never to its right, never sideways unless stated):
core <- content <- world, game <- sim <- render, audio <- player, ui <- main.
`core`, `content`, `world` (except its worker pool), `game`, `sim` are DOM-FREE and must run in node (vitest)
and, for core/content/world, inside a Web Worker. Only render, player, ui, audio, main touch the DOM.

Read src/core/*.ts before writing anything: those contracts are fixed. If you believe a core contract is wrong,
do NOT edit it - work within it and report the problem in your final report. The single exception:
you may APPEND new events to GameEvents in src/core/gameEvents.ts and new constants to src/core/constants.ts
(re-read the file immediately before editing; never rename or remove).

Cross-module communication: the typed EventBus (src/core/events.ts + gameEvents.ts). Sound is ALWAYS requested
with the 'sfx' event; HUD messages with 'toast'; screens with 'ui:open'.

Persistence contract: every stateful class exposes `toJSON(): <PlainSnapshot>` and a static/instance
`fromJSON(snapshot)`/`load(snapshot)` that restores it exactly. Snapshots are plain JSON (no typed arrays - encode
them, e.g. base64 or run-length). src/save composes them.

Game loop (main.ts): requestAnimationFrame; frame dt clamped to 0.1 s; player physics + controls every frame;
simulation, survival, clock and objectives on a fixed 20 Hz accumulator (max 5 catch-up ticks per frame);
world chunk streaming every frame with a time budget; render last.

Coordinates: +X east, +Y up, +Z south; yaw 0 looks north (-Z); block (x,y,z) occupies [x,x+1) etc.
World height 96 (y 0..95), sea level 32, chunks are 16x16 columns addressed (cx, cz) = floor(x/16), floor(z/16).

### Working rules for every build agent
- Stay inside the files/directories you own. Never edit another module's files; if you need something from it
  that it lacks, say so in your report.
- Other agents are working in this repository AT THE SAME TIME. Type errors and failing tests outside your
  directory are not yours: check only your own with
  `npx tsc --noEmit -p . 2>&1 | grep -E "^src/<yourdir>/"` and `npx vitest run src/<yourdir>`.
- Git: never checkout, stash, reset or rebase. When your module is finished (and at sensible checkpoints), commit
  ONLY your own paths and push: `git add <your paths> && git commit -m "<what and why>" && git push origin HEAD`
  (retry a few times if the index is locked or the push races another engineer; if the push is rejected, run
  `git pull --no-rebase --no-edit origin HEAD` and push again). End every commit message with the line
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not install packages.
  Do not leave servers or watchers running.
- TypeScript strict. No `any` unless unavoidable (and then narrow it immediately). Keep files focused (aim
  for < 350 lines; split by responsibility). Comments only where the WHY is not obvious. No TODO stubs:
  everything you export must work. No dead code.
- Unit tests (vitest, `*.test.ts` next to the code) for all DOM-free logic. Tests must be deterministic.
- Performance matters on phones: no per-frame allocations in hot loops, no O(world) scans per tick.
- When you finish, write docs/api/<your-module>.md: the PUBLIC API other modules will call (exact exported names
  and signatures, one-line semantics), deviations from this spec, and known gaps. Later engineers read it.
- Finish by running your typecheck + tests and reporting honestly. Your final report must list: the files you
  wrote, the PUBLIC API other modules will call (exact exported names and signatures, with one-line semantics),
  any deviation from this spec, and known gaps.

---------------------------------------------------------------------------------------------------------

## 5. Fixed cross-module details

- Furnace block entity (written by src/sim, read by game/ui/render): `{ kind: 'furnace', x, y, z, tier: number,
  tempC: number, lit: boolean, draft: number, ignited: boolean, ... }`. These five field names are a contract.
- Cable ratings live on the block (`BlockSpec.cableRatingW`): copper_cable 10000, heavy_cable 120000, super_cable 2000000.
- The world keeps voxel data loaded for every chunk that contains a block entity and for the 8 chunks around it,
  no matter how far the player is, so machines keep working. The simulation still must skip any entity whose
  chunk is not loaded yet (e.g. right after loading a save).
- Player edits must be visible on the very next frame (the edited chunk is re-meshed synchronously on the main
  thread; neighbours and lighting ripples may follow asynchronously with high priority).
- Texture names are free-form strings chosen by src/content; src/render paints one 16x16 RGBA tile per entry of
  `TEXTURE_NAMES` (registry). Item icons default to the texture `item_<key>`; cube-like block items are drawn as
  small isometric cubes from the block's face textures.
- The page shell is src/page.html (fixed). The game mounts into `#app`; the WebGL canvas gets class
  `game-canvas`; all UI lives in one overlay root appended to `#app`. src/ui/styles.css is inlined into the page
  by the build. The published page is hosted inside a sandboxed frame: alert/confirm/prompt do nothing, downloads
  are blocked, localStorage may throw (always try/catch), pointer lock and fullscreen may be refused (always
  handle rejection and fall back), audio only starts after a user gesture, no network requests at runtime.

---------------------------------------------------------------------------------------------------------

## 6. Trying things in a real browser (for every module that touches the DOM)

Headless Chromium with WebGL2 (software rendering - slow, ~5-20 fps in a full scene, but correct) and Playwright
are installed. Bundle ANY entry file with the game's own pipeline (three.js, the inlined chunk worker, the page
shell and src/ui/styles.css) like this:

    cd /home/user/game && node scripts/build.mjs --dev --entry=<abs path to harness.ts> --out=<abs scratch dir>

That writes <out>/index.html + game.js. Keep harness sources in your scratch directory (they may import from
/home/user/game/src/... by absolute path). Then drive it from a .cjs script in your scratch directory:

    const { chromium } = require('playwright');              // works from any directory; launch() needs no options
    const { pathToFileURL } = require('url');
    (async () => {
      const { serve } = await import(pathToFileURL('/home/user/game/scripts/build.mjs').href);
      const server = await serve(0, '<abs out dir>'); const port = server.address().port;
      const browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });   // phone: 390x844 with hasTouch: true, isMobile: true
      page.on('console', m => console.log('[page]', m.type(), m.text())); page.on('pageerror', e => console.log('[pageerror]', e));
      await page.goto(`http://localhost:${port}/`);
      // ... page.evaluate / page.keyboard / page.mouse / page.touchscreen ... page.screenshot({ path })
      await browser.close(); server.close();
    })();

Look at your screenshots with the Read tool and judge them critically. Do not run `playwright install`.
Pointer lock is not available in headless Chromium - code must already cope with that (drag-to-look fallback).

---------------------------------------------------------------------------------------------------------

## 7. Module briefs for the second build wave

Controls (authoritative, the README documents exactly these):
Desktop: WASD move, mouse look (click the view to capture; if pointer lock is refused, drag with the mouse to
look), Space jump / swim up, Shift sprint, hold LEFT mouse = mine, RIGHT mouse = use / place, 1-9 and wheel =
hotbar, E = inventory + hand crafting, L = Hearth Log, Esc = pause or close the open screen.
Touch: left thumb = floating joystick (pushing it to the edge sprints), drag on the right half = look, on-screen
buttons Jump, Mine (hold), Use; a short TAP on the world = use/place at the crosshair, PRESS AND HOLD on the world
= mine at the crosshair; tap a hotbar slot to select it; bag button = inventory; tap the goal tracker = Hearth
Log; pause button. Targeting is always the crosshair at screen centre.

### 7.1 src/sim/ - furnace, power, machines   (DOM-free, node-testable)
Implements spec sections 2.4, 2.5, 3.1, 3.2, 3.3 exactly, reading every number from the registry (FURNACE_TIERS,
MACHINES, recipes, block cableRatingW) and src/core/constants.ts - no magic numbers duplicated in code.
- Block entities are plain JSON objects stored in the world (world.setEntity). ALL machine state lives in plain
  fields on the entity at all times (inventories as plain slot arrays), because the world serialises entities
  as they are. Field names fixed by spec section 5 for furnaces.
- class Simulation(world: IWorld, bus, player: PlayerState, clock: GameClock). tick(dt) advances every entity
  whose chunk is loaded, then solves every power network.
- Entity lifecycle is driven by 'block:changed': a block with `machine` appearing creates its entity (unless one
  of the same kind is already at that position - furnace upgrades swap the block id and keep the entity); a
  machine block disappearing removes the entity, returns everything it held to the player (fuel, crucible
  contents, buffers; toast if something did not fit) and emits machine:removed. The simulation sets the voxel
  active flag of machines to mirror "running/hot/lit" (only on change).
- Slot access for the UI: every machine exposes its slot groups as Inventory-compatible objects with accept rules
  (furnace: fuel slots accept only fuels with a flame; crucible inputs accept only items smeltable at the current
  tier; outputs are take-only; generator fuel slots accept only that generator's fuels; processors accept only
  their recipe inputs) so the UI can use the same click/tap transfer logic as for the player inventory.
- Player actions (each returns { ok: true } or { ok: false, reason: string } with a short human reason the UI can
  show): light, douse, pump, setElectric, forge(recipeId, times), upgrade, startIgnition, rest, toggle machine
  on/off. Forging and upgrading take ingredients from the player first, then crates within STATION_CRATE_RADIUS;
  expose the same source list so the UI can show accurate have/need numbers (also for the workbench).
- Queries for the UI and objectives: a per-furnace view (temperature, trend, flame/target temperature, burn time
  left across the firebox, per-crucible recipe + progress + status text, forgeable recipe list with per-recipe
  availability and reason, next upgrade with have/need and temperature check, electric demand/delivery,
  ignition state, whether rest is possible); a per-machine view (status text, rates, progress, placement
  problem if any, e.g. "Needs water on one side"); network stats as listed in 3.2 for the network at a position
  and for all networks; totals: maxFurnaceTempC(), maxFurnaceTier(), generationW() (sum of available generator
  watts over all networks), storedJ().
- Home: placing a furnace or opening its screen ('ui:opened' with a furnace screen) sets player.home.
- Explosions (meltdown): remove blocks in a sphere except corestone, emit 'explosion', damage the player by
  distance, destroy machines inside (their contents are lost).
- Events: furnace:lit/out/pumped/smelted/upgraded/ignition, machine:placed/removed/job, power:alert, flag
  (furnace_lit, bellows_pumped, machine_job, rested, ignited), game:won, sfx (ignite, fire_out, bellows, forge,
  smelt_done, upgrade, machine_on/off/done, alarm, explosion, ignition, win), toast for things the player must
  know. Never emit per-tick spam.
- Tests: furnace reaches each fuel's flame temperature and sits there; bellows raise it by up to 250 C and burn
  fuel faster; cooling curve; crucible gating/progress/speed; forge chill, ingredient sourcing from crates,
  refusal reasons; upgrades; thermopile and steam-engine coupling against the spec's formulas (a coal fire with
  a steam engine settles near 820 C delivering ~2 kW); every generator's placement rule; network solve cases
  (surplus charging with 90% efficiency, battery discharge, brown-out factor, stall below 0.25, cable rating
  cap + overloaded flag, load-following fuel use, splitting and merging networks when cables are removed/added,
  alerts only on change); every processor and the bore rig (with crate push); fission cooled/uncooled/meltdown;
  ignition success and failure; entity JSON round trip mid-run continues identically; and one long scripted
  PLAYTHROUGH test that walks the whole tech tree through the public API only (give raw materials, place blocks
  in a fake world, tick): tier 1 -> bronze -> tier 2 -> steel -> thermopiles/steam -> tier 3 on electric heat ->
  tier 4 -> fission -> star core -> tier 5 -> ignition -> game:won. Performance: 300 entities tick in < 1 ms.

### 7.2 src/render/ - everything drawn in 3D, plus item icons
- textures/: pure, deterministic pixel painters - paintTexture(name): Uint8ClampedArray (16x16 RGBA) for EVERY
  entry of TEXTURE_NAMES, built from a small shared palette and parametric families (stone-likes, ores = host
  rock + coloured flecks, planks, bricks, machine casings with rivets/vents/gauges, glowing furnace mouths per
  tier, ingots, plates, dusts, tools by head material, parts...). Our own look: warm, slightly desaturated
  naturals; soot-and-ember industry; electric cyan accents on powered machines. Item icons have transparent
  backgrounds and a 1px darker outline so they read on dark UI. Node tests: every TEXTURE_NAMES entry has a
  dedicated painter (no silent fallback), no texture is blank or fully transparent (except by design), painting
  is deterministic, block textures are fully opaque unless the block is cutout/translucent.
- atlas: one THREE.DataArrayTexture (WebGL2 sampler2DArray), nearest magnification, mipmaps for distance.
- materials: custom ShaderMaterial (GLSL ES 3.00) for the opaque, cutout (alpha test) and translucent batches
  using the MeshBatch attributes (position, uv, layer, light bytes). Lighting = max(sky * sunlight, block) through
  a perceptual ramp, block light tinted warm (firelight), sky light tinted by time of day, shade byte multiplied
  in, emissive flag = full brightness, sway flag = gentle wind motion, liquid flag = slow surface shimmer. Distance
  fog that matches the sky colour and hides the edge of the loaded world; darker blue fog when the camera is
  under water.
- chunk meshes: consume 'chunk:meshed' / 'chunk:unloaded'; three meshes per chunk; correct draw order; proper
  disposal; frustum culling.
- sky: gradient dome by time of day (GameClock), sun and moon, stars at night, simple drifting clouds.
- effects: outline on the targeted block; mining crack overlay in stages; pooled particles (block debris in the
  block's colours when mining/breaking, smoke rising from every hot fuel-burning furnace so the base is visible
  from afar, sparks on bellows pumps and forging, steam from running machines, explosion burst); first-person
  held item (tool / block / empty hand) with a swing while mining and a dip when placing or switching.
- icons: createIconProvider() -> (itemKey) => HTMLCanvasElement (cached; cube-like block items as small
  isometric cubes with shaded faces from the block's textures, everything else as the flat 16x16 icon scaled
  with nearest-neighbour) for the UI.
- class Renderer(container, world, bus, clock, settings): creates the canvas (class game-canvas), caps pixel ratio
  (2 on desktop, 1.5 on touch devices), setView(x, y, z, yaw, pitch), setFov, setTarget(block or null, crack
  stage), setHeldItem(itemKey or null), triggerSwing(), render(dt), resize(), stats (draw calls, triangles),
  dispose(). No per-frame allocations. Throws a clear error if WebGL2 is unavailable. Handles context loss.
- Verify in the browser (spec section 6) with a harness that streams a real World and flies a camera: daytime
  vista, dusk, night, inside a cave with a torch, a lit furnace at night with smoke, water, every biome, a wall
  of every block (texture review). Judge the screenshots like an art director; iterate on palette and textures
  until the world looks intentional and each ore is recognisable. Report triangle counts and software-rendered fps.

### 7.3 src/player/ - controls, physics, interaction
- input: one InputManager producing a per-frame intent (move vector, look delta, jump, sprint, mine held, use
  pressed, hotbar change, menu keys) from keyboard+mouse AND touch, per the controls above. Pointer lock with a
  drag-to-look fallback when it is unavailable or refused. Touch overlay (joystick, look zone, Jump / Mine / Use
  buttons, bag and pause buttons) is created inside the UI root's touch layer; it appears when settings say so
  (auto = device has touch), respects safe-area insets, works in portrait and landscape, uses pointer events with
  proper multi-touch tracking (stick + look + button at the same time), never triggers page scroll/zoom, and is
  hidden while a screen is open. Ship its CSS from your own module (inject a <style>), using the kit's CSS
  variables so it matches. Honour InputState (uiOpen / paused): no gameplay input then.
- physics: player box 0.6 x 1.8 against solid voxels (slabs are half height and can be stepped onto), gravity,
  jump, sprint, swimming in liquids (buoyancy, slower, Space to rise), no tunnelling at any speed (sub-step),
  fall damage via PlayerState.damage, falling out of the world returns the player to spawn. Unloaded chunks are
  solid walls (never fall through missing terrain).
- raycast: exact voxel traversal (DDA) from the eye along the view up to REACH; returns block, face and the
  adjacent cell for placement; ignores air and (unless a pail is held) liquids; thin shapes (torch, cross, cable,
  slab) are targetable through their real bounds or their whole cell - either is fine but be consistent.
- interaction per spec 3.6 using src/game/mining.ts: mining progress with 'block:mining' events and periodic dig
  sfx by material, completion (set voxel to air, drops via player.give, tool wear, 'block:broken'), placing with
  a short repeat delay, validity rules (not inside the player, placeOn, target replaceable), oriented blocks face
  the player, using stations/machines emits 'ui:open' with the right ScreenRequest, pail logic, hotbar selection.
- class PlayerController that ties these together each frame, drives the camera through the Renderer (eye
  position, yaw/pitch, slight view bob, FOV kick while sprinting, target outline + crack stage, held item, swing)
  and keeps InputState.pointerLocked / touch up to date; re-captures the pointer when a screen closes.
- Tests (node): physics (rest on ground, walls, ceilings, no tunnelling in a 60 m fall, step onto slab, swim),
  raycast (faces, reach, negative coordinates), interaction rules with fakes. Then verify in a real browser
  (spec section 6) with a harness that boots World + Renderer + your controller: keyboard walking moves the
  player, holding the mouse mines a block and the item arrives, placing works; and in a phone viewport with
  touch emulation: the joystick moves, dragging looks, the buttons work. Screenshot both.

### 7.4 src/ui/hud and src/ui/screens - the HUD and every in-game screen (built on the existing kit)
- class GameUI(root: UIRoot, deps): owns the HUD and all screens; listens to 'ui:open' / 'ui:close'; sets
  InputState.uiOpen; emits 'ui:opened' / 'ui:closed'; Esc / back closes; only one screen at a time; refreshes
  open screens ~8 times per second plus on relevant events; never rebuilds DOM that has not changed.
- HUD: hotbar (9 slots, counts, durability, selection; tappable), vitals (health, warmth, air only when under
  water), Well-Warmed indicator with time left, home compass (arrow towards the home furnace relative to where
  the player looks, distance, hot/cold state and temperature), goal tracker (current objective title + progress;
  tap/L opens the Hearth Log), power strip once any network exists (generation vs demand), day/night dial,
  crosshair with a mining progress ring and the targeted block's name, item-gain feed, toasts, banners for new
  ages and completed objectives, vignettes (red on damage, frost creeping in below 30 warmth, amber when
  Well-Warmed), optional FPS. On phones the HUD must leave the thumbs' zones free for the touch controls
  (bottom-left stick, bottom-right buttons): hotbar at the bottom centre, everything else along the top.
- Screens:
  * Inventory: the 36 slots (hotbar row marked) + the hand recipe list.
  * Workbench: its recipe list + inventory.
  * FURNACE - the most important screen in the game; it must be a pleasure to sit at. Header: tier name and
    age, Upgrade button showing have/need for the next tier (glows when affordable; explains what is missing).
    FIREBOX panel, always visible whatever tab is open: big thermometer coloured by the heat ramp with notches
    for the crucibles' and the selected recipe's required temperatures, live flame (height follows draft,
    colour follows temperature), fuel slots with burn bar and time left, Light / Douse, a large PUMP button for
    the bellows (satisfying: sparks, sound, the needle jumps), the electric heating switch with demand/delivered
    (tier 3+), a one-line status that always says the most useful thing ("Burns out in 2:10", "Copper needs
    700 C - now 540", "No fuel"). Tabs: SMELT (one row per crucible: input slot, recipe + progress, required
    temperature badge, output slot), FORGE (the main recipe list with category chips - Tools, Parts, Machines,
    Power, Building - showing requirement badges, have/need chips, Make and x5; rows you cannot make yet say
    why; rows from higher tiers are shown locked with what unlocks them, so the list reads as the tech tree),
    GRID (the network this furnace is on: generation / demand / stored figures, 60 s sparkline, cable limit,
    alerts, member list with status; and the Starhearth ignition panel at tier 5), LOG (Hearth Log: current
    goal, upcoming, completed, ages). Plus "Rest until dawn" when allowed. The player's inventory is reachable
    from every tab (side panel on wide screens, collapsible drawer on phones).
  * Machine screens by role (generator, burner with fuel slot, processor with in/out and progress, battery
    with charge, bore rig with depth and buffer, fission pile with core temperature gauge, rod slot, on/off,
    cooling state and warnings, crate with 27 slots), each showing the placement hint and any placement problem.
  * Hearth Log as a standalone screen, death screen (cause + Respawn), win screen (ignition celebration, stats,
    Keep playing).
- Slot interaction, identical everywhere: click/tap a slot to pick up its stack (shown attached to the cursor /
  as a highlighted "held" slot on touch), click/tap another slot to drop/swap/merge; right-click / long-press
  picks up half; double-click / a "quick move" affordance sends the stack to the other inventory. It must be
  fully usable with touch only.
- Phone first: 390x844 portrait, 844x390 landscape, 1280x800 desktop. No clipped text, no page scroll.
- Verify in the browser (spec section 6) with a harness that builds real PlayerState + Simulation + a small World
  (or fake IWorld), places a furnace, gives items, opens each screen and screenshots it at all three sizes in
  several states (cold furnace, roaring furnace mid-smelt, tier 3 on electricity with a network, tier 5 ready
  to ignite, a brown-out). Use it like a player: click through real flows with Playwright (load fuel, light, pump,
  smelt copper, forge a pickaxe, upgrade) and fix whatever is awkward.

### 7.5 Integration - src/main.ts, src/app/**, src/save/**, scripts/e2e.mjs, README.md
- Boot: title screen (kit menus) -> New World (seed) or Continue -> loading (spawn area generated) -> play.
  Pause menu, settings (persisted), save and quit to title. Friendly full-screen message if WebGL2 is missing.
- class Game wiring every module in dependency order, the game loop of spec section 4, feeding audio ambience
  and listener, HUD data, objective queries from the simulation, home/respawn, death and win flows.
- Saving: src/save - one versioned JSON document in localStorage (every access in try/catch, in-memory fallback,
  graceful handling of quota errors and corrupt/old saves): seed, world edits + entities, player, clock,
  objectives, settings. Autosave every 30 s, on pause, on visibilitychange/pagehide. Continue restores exactly.
- window.__hw debug handle for tests: read-only state summary plus helpers (give, teleport, setTime, setVoxel,
  open a screen, run N simulation ticks, save, reset).
- scripts/e2e.mjs (uses scripts/lib/browser.mjs): builds, serves, and proves in headless Chromium on desktop AND
  phone viewports that the game boots without console errors, chunks render, the player can walk, mine a tree,
  craft planks through the real UI, place a workbench and a furnace, load fuel, light it, see the temperature
  rise, smelt and collect an ingot, forge an item, that touch controls move the player, and that save -> reload
  -> Continue restores position, inventory and furnace state. Exit code 1 on any failure.
- You may edit any module to fix integration bugs (keep such edits minimal and list them in your report).

Already in the repository for 7.5: src/save/storage.ts (SaveStore: versioned, never-throwing JSON persistence with
memory fallback - build the save document on top of it), scripts/lib/browser.mjs (openGame, waitFor,
createReporter, VIEWPORTS for desktop / phonePortrait / phoneLandscape), README.md (update it where the final
game differs), .github/workflows (CI runs typecheck, tests and the build).

Note for 7.3: src/player/input/** (InputManager producing a per-frame Intent from keyboard, mouse and touch, plus
the on-screen touch overlay) and note for the game loop: src/audio/** (AudioEngine) are built by separate
engineers ahead of the second wave. Build on them; do not rewrite them. If they have a bug, fix it minimally and
say so in your report.

---------------------------------------------------------------------------------------------------------

## 8. (removed)

- src/render/textures/ has its own brief inside 7.2; whoever builds the rest of src/render builds on it.

---------------------------------------------------------------------------------------------------------

## 9. How the second wave is split (so its engineers can work at the same time)

- src/sim (7.1), src/render (7.2), src/player (7.3) and the first half of the UI (7.4a) are built SIMULTANEOUSLY.
  None of them may import another of them. They meet only through src/core, src/content, src/world, src/game, the
  UI kit, and events.
- Render <-> player: the Renderer implements `IView` from src/core/context.ts (setView, setFov, setTarget,
  setHeldItem, triggerSwing). The PlayerController takes an IView and never imports src/render.
- Player -> machines/screens: only through 'ui:open' events and world.setVoxel (the simulation reacts to
  'block:changed'); the player module never imports src/sim.
- 7.4a "HUD and basic screens" (src/ui/hud/**, src/ui/gameUI.ts, src/ui/screens/inventory, workbench, log, death,
  win, plus the shared slot-interaction controller in src/ui/screens/slots.ts): depends on src/game and the kit
  only. GameUI exposes registerScreen(type, factory) so more screens can be added without editing it. Whatever
  the HUD needs from the simulation (home furnace temperature/tier/hot, grid generation and demand, current
  network alerts) comes through a small injected query interface that 7.4a defines and documents.
- 7.4b "furnace and machine screens" (src/ui/screens/furnace/**, src/ui/screens/machines/**) is built AFTER the
  simulation and 7.4a exist, registers its screens with GameUI, and uses the slot-interaction controller of 7.4a.
- Integration (7.5) comes last.

---------------------------------------------------------------------------------------------------------

## 10. Briefs of the first wave (verbatim from the original assignments)

### 10.1 src/game
YOUR MODULE: src/game/ (you own this directory and nothing else). Everything here is DOM-free and runs in node. The world engine (src/world) is being written right now by another engineer: you never import it - you only touch the world through the IWorld interface in src/core/types.ts, and in tests you use a small in-memory fake that implements it.

Build the rules of the game that are not machines:
- inventory.ts - class Inventory over a fixed number of slots (ItemStack | null). It must be able to WRAP AN EXISTING plain slot array without copying (new Inventory(size) allocates; Inventory.over(slots) or an optional constructor argument adopts the given array and writes through to it) because the simulation stores machine inventories as plain arrays on block entities that are serialised as they are. Operations: add (stacks onto existing stacks first, respects ItemDef.stack, returns the leftover count), remove, count, has, canFit (for one or several ItemAmounts at once), firstEmpty, clear; an optional per-inventory accept rule (item key, slot index) => boolean and a take-only flag, both honoured by every operation that puts items in; slot-level operations the UI needs for click/tap interaction between any two inventories (move a whole stack, move half, move one, swap, merge, quick-move a stack into another inventory); tool durability is preserved when stacks move and tools never stack; a change listener; toJSON/fromJSON.
- crafting.ts - ingredient logic shared by every station: availability(recipe, sources: Inventory[]) -> have/need per ingredient and an ok flag, counting across several inventories in priority order (the player's first, then nearby crates); craft(recipe, sources, destination, times?) that is atomic (either all ingredients are taken and all outputs added, or nothing changes; refuse with a reason when the outputs do not fit); maxCraftable; recipe lists for 'hand' and 'workbench'. Temperature/tier gating of furnace recipes is NOT your job (the simulation does it) but your functions must be the ones it calls for ingredients.
- mining.ts - pure rules of spec 3.6: miningTime(block, heldStack, wellWarmed), canHarvest, rollDrops(block, rng), wear.
- clock.ts - GameClock per spec 3.5: timeOfDay, day count, tick(dt), sunlight(), phase, isNight, skipToDawn(), emits 'time:phase' on changes, toJSON/load.
- playerState.ts - PlayerState: position/velocity/yaw/pitch, onGround, inWater, headInWater, health, warmth, air, the 36-slot inventory (slots 0-8 are the hotbar), selectedSlot, home position, world spawn, buff timers, lifetime stats (items made, blocks placed, blocks broken - by key), dead flag; helpers heldStack(), damage(amount, cause) (emits player:damage / player:death, sfx hurt/death), heal, respawn(homeIsHot), give(item, count, durability?) that emits item:gained and inventory:changed and toasts a warning when the inventory is full (returns what did not fit); toJSON/load. Yaw convention: radians, 0 looks north (-Z), positive turns left (three.js camera.rotation.y); pitch positive looks up.
- survival.ts - Survival.tick(dt): warmth, Well-Warmed buff, air, lava and contact damage, radiation, regeneration, cold damage - exactly spec 3.4. Heat sources: block entities whose voxel has warmth (iterate world.entities(), read the voxel and use voxelWarmth from the registry, which honours the active flag) plus a small local scan (radius 4) for non-entity warm blocks such as torches and lava; do the scans at most twice per second, never every tick. The Well-Warmed buff needs a furnace entity with tempC >= FURNACE_BUFF_C (spec section 5 fixes the entity field names). Biome is supplied by a callback (x, z) => BiomeKey so you do not import src/world. Expose what the HUD needs: current warmth trend (warming/cooling/steady), whether the player is inside a heat radius, radiation dose, time left on the buff.
- objectives.ts - ObjectiveTracker: tracks OBJECTIVES in order using the bus (item:made, block:placed, block:broken, flag, furnace:upgraded ...) and the player state; conditions that need the simulation (furnaceTemp, furnaceTier, generate, stored) read from an injected query object { maxFurnaceTempC(), maxFurnaceTier(), generationW(), storedJ() }. Checks at most a few times per second. When the current objective completes: grant rewards, emit objective:completed, toast, sfx objective, and immediately evaluate the next one (cascading). Tracks the current age (highest furnace tier ever reached maps to FurnaceTierSpec.age) and emits age:advanced once per age. Exposes the current objective, progress for it as numbers and text (e.g. "3 / 8"), the upcoming and completed lists; toJSON/load. Lifetime counters (made/placed/broken) are recorded from the first moment of the game, not only while their objective is current.
- index.ts re-exporting the public API.

Tests (vitest): inventory stacking/splitting/moving edge cases incl. full inventories, tools, accept rules, take-only, wrapping an external array (mutations visible both ways, JSON.stringify of the array is the saved state); atomic crafting across several source inventories; mining times and harvest rules against real blocks and tools from the registry; clock phases and sunlight continuity; survival scenarios (night drain, coat, furnace warmth restoring, Well-Warmed after 8 s near a furnace at 400 C+, drowning, cold damage at 0 warmth, radiation with and without suit, regeneration, death and respawn keeping the inventory); objective tracker walking through the first ten real objectives with scripted events, cascade completion, reward granting, age advancement, save/load round trip in the middle.

Check with: npx tsc --noEmit -p . 2>&1 | grep -E "^src/game/"   and   npx vitest run src/game

### 10.2 src/world
YOUR MODULE: src/world/ (you own this directory and nothing else). src/content now exists; the content engineer's API notes are at the end of this prompt.

Build the voxel world engine. Everything here is DOM-free and must run in node and inside a Web Worker, except workerPool.ts.

Files and responsibilities:
- chunk.ts - chunk storage (Uint16Array of CHUNK_VOLUME, index via voxelIndex), coordinate helpers.
- worldgen.ts - generateChunk(seed, cx, cz): Uint16Array - a pure deterministic function of its arguments (no hidden state, safe to call in any order, in any thread). Also biomeAt(seed, x, z): BiomeKey and findSpawn(seed): {x, y, z}.
  Terrain: four biomes from low-frequency climate noise with smooth height blending - woodland (rolling hills, oak trees, tall_grass, lakes and rivers with sand/clay/gravel shores), dunes (sand dunes, dry_shrub, sandstone-free: use sand over stone, rare water), frostfell (high snowy mountains up to y~84, pine trees, snow cover, ice on water), scar (dark basalt badlands, crags, lava pools at the surface). Surface heights roughly 28..84 with sea level 32; water fills up to sea level. corestone at y=0 (and scattered at y=1). Caves: 3D-noise tunnels and a few chambers, never breaching water (keep >= 3 solid blocks under any water column) so there are no hanging water walls; cave air at y <= 8 is lava. Gravel patches in stone and on shores, clay under shallow water in woodland. Ore veins from ORE_VEINS (registry): deterministic blobs replacing stone/basalt only, honouring the y band, veinsPerChunk (fractional = probability) and biome multipliers; veins and trees may cross chunk borders - generate them from per-chunk seeds of the 3x3 neighbourhood and clip, so the result never depends on generation order.
  Spawn: findSpawn must return a dry woodland spot above sea level and guarantee - assert this in tests over at least 12 seeds - that within 48 blocks there are at least 8 logs worth of trees, exposed or shallow stone, clay, gravel, and standing water. If the natural terrain does not provide one of these near the chosen spot, pick another spot (search outward deterministically); never fake it by editing the world after generation.
- lighting.ts - computeLight for one chunk from the 3x3 neighbourhood of voxel arrays: sky light (15 with open sky above, attenuating 1 per block sideways/down through non-opaque blocks, -2 extra through water) and block light (BFS from emitters using voxelLight(v), 15 max). Stateless and exact because light travels at most 15 blocks and the neighbourhood margin is 16. Returns light for the centre chunk plus a 1-voxel border (needed for smooth lighting). Unloaded neighbours count as fully sky-lit air.
- mesher.ts - meshChunk(input): ChunkMeshData (types in src/core/types.ts: MeshBatch layout is a contract). Face culling against opaque neighbours (and same-liquid neighbours), per-vertex ambient occlusion and smooth lighting (average of the 4 cells around each vertex) baked into the light bytes [sky, block, shade, flags]; face shading baked into shade (top 1.0, bottom 0.5, north/south 0.8, east/west 0.65, multiplied by AO); quad diagonal flipped to avoid AO anisotropy. Shapes: cube; liquid (surface lowered by 2/16 when the block above is not the same liquid; LIGHT_FLAG_LIQUID on the top face; translucent batch for water, opaque for lava with LIGHT_FLAG_EMISSIVE); cross (two diagonal double-sided quads, cutout batch, LIGHT_FLAG_SWAY on the upper vertices); torch (thin 2/16 post 10/16 tall with a brighter emissive tip, cutout or opaque); cable (6/16 core plus an arm towards each neighbour whose block has power set); slab (bottom half). Blocks whose light value > 0 for the current voxel state render that face with LIGHT_FLAG_EMISSIVE only where the texture is the active/front variant (a lit furnace mouth glows; its brick sides do not). Texture layers via faceLayer()/voxelFaceLayer() from the registry. Output typed arrays sized exactly (no slack) so they can be transferred.
- worker.ts - Web Worker entry (bundled separately by scripts/build.mjs and exposed to the main bundle as the default export string of 'virtual:worker'): handles 'generate' and 'mesh' jobs, transfers results.
- workerPool.ts - creates 1-4 workers from the inlined source via Blob URL; if the source is empty or Worker creation throws, runs the same job functions on the main thread inside a per-frame time budget instead. One Promise-returning run(job) API either way; jobs are cancellable/skippable when their chunk is no longer wanted.
- world.ts - class World implements IWorld (src/core/types.ts) and owns streaming: update(playerX, playerZ, renderDistance, budgetMs) loads/generates chunk columns nearest-first, applies stored player edits on top of generated terrain, requests meshes once the 3x3 neighbourhood is present, re-meshes dirty chunks (player edits: synchronously, same frame, for the edited chunk; neighbours/lighting ripples asynchronously with priority), emits 'chunk:loaded', 'chunk:meshed', 'chunk:unloaded' and 'block:changed' on the GameBus. Unloads voxel data beyond renderDistance + 3 EXCEPT chunks pinned by block entities (see spec section 5). Edits are remembered forever as sparse per-chunk maps so they survive unloading. Block entities: a Map keyed by position; entities() iterates all. surfaceY, isLoaded as per the interface. Also expose what the game loop needs: a synchronous way to make sure the chunks around a position are generated before the player is dropped into the world (e.g. ensureLoadedAround(x, z, radiusChunks)), counts for a debug overlay, and toJSON()/load() covering seed, edits (compact encoding) and entities.
- index.ts re-exporting the public API.

Tests (vitest, all deterministic): worldgen determinism (same seed twice -> identical arrays; neighbouring chunks agree at borders for cross-border trees/veins by checking that generating in different orders gives identical data); spawn guarantees over >= 12 seeds; every ORE_VEINS block appears within its y band across a 12x12-chunk sample and roughly at the configured density (within a factor of 3); no water voxel has air directly below or beside it at generation (no hanging water); lighting (open sky = 15, sealed cave = 0, torch falloff, light crossing a chunk border); mesher (one block in air = 6 faces, 24 vertices, 36 indices; two adjacent opaque blocks share no interior faces; water surface; cable arms); World (get/set across chunk borders and at negative coordinates, edits survive unload and reload, toJSON/load round trip, block:changed emitted, entity pinning). Log the average time of generateChunk and meshChunk over 30 chunks; target under 25 ms each in node - optimise if you are far above it (worldgen must not call 3D noise per voxel at full resolution: sample caves on a coarse lattice and interpolate, or equivalent).

Check with: npx tsc --noEmit -p . 2>&1 | grep -E "^src/world/"   and   npx vitest run src/world

### 10.3 src/render/textures
YOUR MODULE: src/render/textures/ (you own this directory and nothing else; a later engineer builds the rest of src/render and will upload your tiles to the GPU and draw item icons from them).

Deliver pure, deterministic, DOM-free pixel painters:
- index.ts exporting paintTexture(name: string): Uint8ClampedArray (16x16 RGBA, row-major, top row first), hasPainter(name: string): boolean, TEXTURE_SIZE = 16, and averageColor(name): [r, g, b] (mean of opaque pixels; the particle system uses it for debris). paintTexture must return a fresh, correctly sized array for ANY string; names without a dedicated painter get an obvious magenta/black checker so they are noticed. Results may be cached internally but callers may mutate what they get.
- A small shared palette (palette.ts) and a toolkit (canvas.ts or similar: a tiny pixel canvas with set/fill/rect/line, seeded per-texture noise so every texture is deterministic, dithering/speckle, shading helpers, outline for icons).
- One painter per entry of TEXTURE_NAMES (registry) - about 164 names: block faces and item icons. Organise by family in several files (terrain, ores, wood and plants, building blocks, furnaces, machines, cables and grid, item icons: raw materials, metals, parts, tools, gear). Build families parametrically (e.g. ore(hostRock, fleckColours, pattern), ingot(metal), plate(metal), dust(colour), tool(kind, headMetal), machineFront(variant, lit)) but give every texture its own identity - two ores must never be confusable at a glance, in the world or as an icon.

Art direction - Hearthwatt's own look, not an imitation of any other voxel game:
- Naturals are warm and slightly desaturated: mossy olive grass rather than saturated green, umber soil, ochre sand, slate-violet stone shadows, deep teal water. Low contrast inside a tile (so tiling does not strobe), stronger contrast between materials. Tiles must tile seamlessly on all four edges; avoid obvious repeating blobs; no single-pixel noise soup.
- Industry is soot and ember: fired-clay and brick furnaces with a glowing mouth (the *_on / active variants glow - dull red for the clay furnace, orange for blast, white-yellow for arc with a blue rim, violet-white plasma, and a golden star for the Starhearth), dark riveted iron casings, copper windings, and a cool electric cyan indicator on powered machines (the *_on variants light it). Each machine front must say what it does: crusher jaws, still coils and flask, bore rig drill head, centrifuge drum, electrolyzer cells, turbine blades, solar cells grid, battery terminals and charge window, thermopile fins, steam engine piston and boiler gauge, fission pile hazard core.
- Ores: host rock plus distinctive flecks - shape and colour both differ (coal: black angular chunks; copper: orange-green streaks; tin: pale silver cubes; iron: rusty bands; sulfur: yellow crystals; quartz: white-pink shards; bauxite: red-brown pisolites, i.e. round nodules; wolframite: steel-blue blades; spodumene: lilac laths; pitchblende: black-green with a faint glow; oil shale: dark laminated layers with amber seams).
- Item icons: transparent background, a 1px darker outline, lit from the top left, readable at 32px on a dark UI. Tools show their head material clearly (flint grey, bronze gold-brown, iron grey, steel blue-white, power drill distinct). Ingots, plates, wires, coils, dusts, cells, rods and circuits must be distinguishable from each other by silhouette first, colour second.
- Cutout/cross textures (tall_grass, dry_shrub, torch, leaves if the content marks them non-opaque) use full transparency for holes; ordinary block faces are fully opaque. Glass is mostly transparent with a visible frame and a few glints. Water and lava are drawn for a translucent/emissive surface.

Review your work visually - this is the main part of the job. The repository has a contact-sheet tool: \

### 10.4 UI kit (src/ui/styles.css, src/ui/kit, src/ui/menus)
YOUR MODULE: the UI foundation - src/ui/styles.css, src/ui/kit/**, src/ui/menus/** (you own these; a later engineer builds src/ui/hud and src/ui/screens on top of your kit - you do NOT build the HUD or the inventory/furnace/machine screens).

Design direction (commit to ONE dark look; this is a game, it does not follow the host theme):
- The world of the game is fire and electricity: soot, brick, iron, embers; later copper and cold electric light. Two semantic hues carry meaning everywhere: HEAT (ember amber/orange, with a temperature ramp dull red 500C -> orange 800C -> yellow 1100C -> white 1500C -> blue-white 1900C+) and POWER (a cool electric cyan). Status colours (good/warn/bad) are separate from both. Neutrals are warm-biased greys, never pure grey. Panels read as forged plate: crisp 1-2px edges, small radii (0-3px) or chamfered corners, no soft glassmorphism, no big drop shadows, no gradients-as-decoration, no emoji.
- Type: 'Chakra Petch' for display/labels, 'IBM Plex Sans' for body, 'IBM Plex Mono' with tabular numbers for every reading (temperature, watts, counts). The page already links these fonts; always give fallback stacks.
- Everything is defined as CSS custom properties on :root in src/ui/styles.css (set color-scheme: dark and an explicit body background). Class prefix: hw-. Item icons are pixel art: image-rendering: pixelated.
- PHONE FIRST. The player is probably on a phone. Touch targets >= 44px. Works at 390x844 (portrait), 844x390 (landscape, very little height!) and 1280x800. No horizontal page scroll ever. Respect safe areas: anything at a screen edge adds env(safe-area-inset-*, 0px). Windows become full-screen sheets on small viewports with their own internal scrolling. Respect prefers-reduced-motion. Visible keyboard focus.

Build (plain TypeScript + DOM, no framework):
- kit/dom.ts: a tiny typed element helper (h(tag, props, ...children)), class toggling, listener disposal helpers.
- kit/root.ts: UIRoot - creates the overlay root inside #app with ordered layers (hud, touch, windows, toasts/banners, tooltip) and exposes them.
- kit/window.ts: a modal Window (title, optional subtitle, optional header-right slot, optional tab bar, body, optional footer status line, close button; closes on Escape; onClose callback; one window at a time is enough; full-screen sheet on small viewports), and Tabs.
- kit/controls.ts: Button (primary / quiet / danger, disabled-with-reason, optional hold-to-confirm), IconButton, Toggle, Slider, Segmented choice, TextField.
- kit/slot.ts: ItemSlot (icon, count, durability bar, selected/highlight/disabled states, empty state) and SlotGrid. Icons come from an injected provider: type IconProvider = (itemKey: string) => HTMLCanvasElement | null (the rendering engineer supplies it later; until then draw a neutral placeholder tile with the item's initials). Slots report primary (click/tap) and secondary (right-click / long-press) activation; they do not implement inventory logic.
- kit/recipe.ts: RecipeRow (icon, name, requirement badges such as "900 C" or "Tier 2", ingredient chips showing have/need with clear enough/not-enough states, a disabled reason line, a Make button and a "x5" button) and RecipeList (scrollable, optional category chips, keeps scroll position when rows update). Rows must be cheap to update in place (the furnace screen refreshes them several times per second).
- kit/gauges.ts: Thermometer (vertical; fill coloured by the heat ramp; settable notches with labels for recipe thresholds; numeric readout), Meter (horizontal bar with label and value), StatFigure (big number + unit + caption), Sparkline (canvas line/area for a rolling history, two series), Badge, Chip.
- kit/feedback.ts: Toasts (stack with kinds info/good/warn/bad and optional item icon, auto-dismiss), Banner (large centred announcement used for new ages and completed objectives), Tooltip (hover on desktop, long-press on touch; never leaves the viewport).
- kit/format.ts: heatColor(tempC) -> CSS colour on the ramp, formatWatts (W / kW / MW), formatJoules (J / kJ / MJ), formatTemp, formatDuration, formatCount. Unit-test these (vitest, node environment - keep format.ts DOM-free).
- menus/title.ts: TitleScreen - the game's front door and a designed moment: the wordmark HEARTHWATT, one line of promise, buttons New World (with an optional seed field), Continue (only when a save exists), Settings, How to Play. menus/pause.ts: PauseMenu (Resume, Settings, How to Play, Save and quit to title). menus/settings.ts: SettingsPanel bound to the Settings type in src/core/context.ts (render distance, field of view, look sensitivity for mouse and touch, invert Y, volume, touch controls auto/on/off, show FPS) calling back on every change. menus/howto.ts: HowToPlay - controls for keyboard+mouse and for touch, and the core loop in five short lines (furnace is the heart; heat then watts). All menus take callbacks/options and import nothing from other game modules except src/core.
- kit/index.ts re-exporting everything.

Verify visually before you finish: write a throwaway demo page in your scratch directory (not in the repo) that mounts every component with realistic content (a mock furnace window with a thermometer, recipe rows, slots; the title screen; the pause menu; toasts; a banner), bundle it with esbuild (node /home/user/game/node_modules/.bin/esbuild ... --bundle, inline src/ui/styles.css and the same font links as src/page.html - fonts may not load in this sandbox, so the fallback stack must look fine too), and screenshot it with Playwright (const { chromium } = require('playwright') works from a .cjs script; chromium.launch() needs no options) at 390x844, 844x390 and 1280x800. Look at the screenshots yourself (Read tool) and fix what is clipped, overlapping, unreadable or generic-looking. Iterate until all three sizes look intentional. In your report's publicApi, include a short usage example for Window + RecipeList + Thermometer.

Check with: npx tsc --noEmit -p . 2>&1 | grep -E "^src/ui/"   and   npx vitest run src/ui

### 10.5 src/player/input
YOUR MODULE: src/player/input/ (you own this directory and nothing else). A later engineer builds physics, raycasting, block interaction and the PlayerController in src/player/ on top of your input layer - you do NOT build those.

Build the input layer: one InputManager that turns keyboard, mouse and touch into a per-frame INTENT, exactly per the controls in spec section 7. THE PLAYER IS PROBABLY ON A PHONE: the touch controls must feel as good as a native mobile game.

Deliver:
- intent.ts - the Intent type: moveX (strafe, -1..1), moveZ (forward positive, -1..1; the vector is clamped to length 1), lookYaw and lookPitch deltas in radians for this frame (already scaled by the mouse/touch sensitivity and invertY from Settings), jump (held), sprint (held), mine (held), use (true on the frame it was pressed; when the button stays held, true again every 0.25 s so blocks can be placed in a row), hotbarSlot (0-8 when a number key was pressed, else null), hotbarStep (-1/0/+1 from the wheel), and edge-triggered menu flags: inventory, log, pause.
- InputManager class. constructor({ container (the #app element, receives pointer events for looking and for world tap/hold), touchLayer (element the on-screen controls are built in), settings: Settings, state: InputState, bus: GameBus }). Methods: frame(dtSeconds): Intent (returns and clears accumulated deltas/edges; returns a neutral intent while state.uiOpen or state.paused is true, and also releases every held control at that moment so nothing stays stuck); requestPointerCapture() (call from a user gesture; resolves to whether the pointer is now captured); releasePointerCapture(); setTouchVisible via settings.touchControls ('auto' = show when the device has a coarse pointer / touch points; listen for 'settings:changed'); dispose() removing every listener and DOM node.
- Keyboard + mouse: WASD and arrow keys, Space, Shift, 1-9, wheel, E, L, Escape (Escape while the pointer is locked is consumed by the browser to exit the lock - treat the resulting pointerlockchange as a pause request so one press pauses). Pointer lock on click of the container; keep state.pointerLocked accurate from pointerlockchange/pointerlockerror. If requestPointerLock is missing, throws, rejects, or errors, switch to drag-to-look: while a mouse button is held and the pointer moves more than a few pixels it rotates the view; a left press that does not turn into a drag still mines while held, and a right click still uses. Never leave the player unable to look around. Ignore keyboard events whose target is an input/textarea/contenteditable. Release all keys on window blur and visibilitychange.
- Touch (pointer events, touch-action: none, multi-touch tracked by pointerId): a FLOATING joystick - it appears where the left thumb lands anywhere in the lower-left region, follows a little if dragged past its radius, and releases on lift; pushing beyond ~90% of the radius sets sprint. Dragging anywhere else on the screen that is not on a button looks around, with a little smoothing but no lag. A short tap in the look area (under ~220 ms and ~10 px) fires use; pressing and holding still (over ~280 ms, under ~10 px) starts mine and keeps it while held, and the same finger may drag to look while mining. Buttons, sized and placed for thumbs in both portrait (390x844) and landscape (844x390): Jump (bottom right), Mine (hold) and Use above/beside it, a bag button (inventory) and a pause button at the top right. Buttons show a pressed state, never steal the look/joystick pointers of other fingers, and all three zones work simultaneously (walk + look + mine). Respect env(safe-area-inset-*). The overlay is hidden while state.uiOpen or state.paused. Ship the overlay's CSS from your module (one injected <style> element, class prefix hw-touch-), using the kit's CSS variables with fallbacks. Icons are simple inline SVG or CSS shapes drawn by you - no emoji, no icon fonts.
- Prevent the browser from interfering: no page scroll, no pinch zoom, no context menu on long-press or right-click inside the game, no text selection, no double-tap zoom; do not block interaction with UI windows (elements outside the container's game surface, i.e. events whose target is inside an element with class hw-window or hw-ui-blocking must be left alone).
- index.ts re-exporting the public API.

Structure the code so the gesture logic is testable without a browser: a pure state machine for touch gestures (pointer down/move/up with timestamps in, joystick vector / look deltas / tap / hold out) and a pure key-state reducer, with thin DOM adapters around them. Unit tests (vitest, node): joystick vector and dead zone, sprint threshold, tap vs hold vs drag classification with timing, simultaneous pointers, use auto-repeat, neutral intent + released controls when uiOpen flips, diagonal keyboard movement normalised, opposite keys cancel, hotbar keys and wheel steps, sensitivity and invertY applied.

Then verify in a real browser (spec section 6). Write a harness in your scratch directory that mounts the InputManager on #app with a visible debug readout of the live intent (move vector, accumulated yaw/pitch, held flags, counters for use/inventory/log/pause), bundle it with scripts/build.mjs --entry, and drive it with Playwright:
 1. desktop 1280x800: hold W+D and check the vector; press Space, Shift, 3, E, L; mouse-drag to look (pointer lock is unavailable headless, so this exercises the fallback); left hold = mine, right click = use.
 2. phonePortrait 390x844 and phoneLandscape 844x390 with hasTouch: use CDP for real multi-touch (const client = await page.context().newCDPSession(page); client.send('Input.dispatchTouchEvent', { type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: [{ x, y, id }] })) - joystick drag gives the expected vector while a second finger looks and a third holds Mine; tap = use; hold = mine; buttons work; nothing scrolls.
Screenshot the overlay in both phone orientations (with the joystick active) and look at the screenshots: the controls must be clearly visible over both bright sky and dark cave backgrounds (put a bright and a dark half behind them in the harness), comfortably sized, not overlapping each other or the bottom-centre area where the hotbar will sit (leave the bottom-centre ~60% width x 64px free). Fix what you see. Report the results of each check.

Check with: npx tsc --noEmit -p . 2>&1 | grep -E "^src/player/"   and   npx vitest run src/player

---------------------------------------------------------------------------------------------------------

## 11. Integration notes collected from module engineers (read before wiring main.ts)

- player: place the player at `world.spawnPoint()` + 0.5 on x and z (it returns block-corner integers).
- player: send the controller's target to `GameUI.setTarget` as well as to the renderer (same signature); call
  `input.requestPointerCapture()` from the Play / Continue button's click.
- player: scooping with the pail leaves the water block in place (water does not flow); the click that captures
  the pointer does not mine.
- textures: machines look alike as small isometric cube icons; the icon provider may show machine fronts flat.
- world: create the pool with `new WorkerPool(workerSource)` (default export of 'virtual:worker') and call
  `world.update(...)` after the player controller and before rendering; otherwise edits show one frame late.
- world: the renderer must drop meshes on 'chunk:hidden' (chunk left the view, voxels may stay loaded for machines).
- sim: call `sim.resync()` after `world.load()`. Network history, alert state and once-per-session flags are not
  saved; they restart after loading.
- sim: an idle steam engine still draws furnace heat in proportion to its available output; the player can switch
  it off. targetC in the furnace view is an estimate.
- hud: wire releasePointer -> InputManager.releasePointerCapture; intent.inventory/log/pause -> 'ui:open';
  tee IView.setTarget to GameUI.setTarget; GameUI.setIconProvider(createIconProvider()); call ui.frame(dt) every
  frame. Simulation already satisfies the HUD's UISimQuery. Full wiring notes in docs/api/hud.md.
- hud: touch has no item tooltip (long-press picks half); item descriptions show on desktop hover only.
- render: create the Renderer BEFORE the first world.update() (it builds meshes only from 'chunk:meshed' events);
  call renderer.render(dt) after world.update; catch the constructor's WebGL2 error and show the friendly message.

---------------------------------------------------------------------------------------------------------

## 12. Food, farming and animals (added at the player's request)

The player asked for: animals, a food mechanism, cooking in the furnace, farming and crops, and crafting dough
that is baked in the furnace into bread. This section REPLACES "no creatures" in pillar 4: there are now
passive animals (no hostile creatures, still no combat against the player). Everything stays original: plain
real-world animals drawn as our own blocky models, our own item names and numbers.

The design keeps the furnace at the centre: all cooking and baking happens in the furnace's crucibles, the best
meal is forged at the furnace, and electric-age tech (lamps, the crusher) feeds back into farming.

### 12.1 Hunger
- PlayerState gains `food` 0..20 (starts at 20). Saved.
- Drain per second: 1/60 (a full bar lasts ~20 min, longer than a 15-min day); x2.5 while sprinting; plus 0.03
  per block mined and 0.03 per jump. Well-Fed halves all drain.
- food <= 6: "Hungry" - cannot sprint, HUD warns once (toast) when crossing 6.
- food == 0: 1 damage every 6 s, never below 1 health (hunger alone does not kill).
- Health regeneration (spec 3.4) additionally requires food >= 12, and each health point regenerated costs 0.25 food.
- Eating: holding a food item and pressing Use (right mouse / Use button / tap the world) eats one immediately
  unless Use would plant it (see 12.4) or the crosshair is on a station/machine. Refused with a toast when food is
  full, except foods that grant a buff. 0.6 s cooldown between bites. Emits 'player:ate', sfx 'eat'.
- Well-Fed buff (from forged meals): 360 s, health regenerates twice as fast, food drain halved. HUD shows it like
  Well-Warmed.

### 12.2 Food items (ItemSpec.food = { hunger, buff?: 'well_fed', buffS? })
| item | hunger | from |
|---|---|---|
| raw_fowl | 2 | hen |
| raw_mutton | 3 | goat |
| raw_chop | 3 | boar |
| cooked_fowl | 6 | furnace |
| cooked_mutton | 7 | furnace |
| cooked_chop | 8 | furnace |
| potato | 1 | wild potato, potato crop |
| baked_potato | 5 | furnace |
| carrot | 3 | wild carrot, carrot crop |
| bread | 6 | furnace (from dough) |
| hearth_stew | 12, buff well_fed 360 s | forged at the furnace |
Non-food farm items: wheat_seeds, wheat, flour, dough, hide.

### 12.3 Cooking and baking - all at the furnace (tier 1)
Smelt recipes (one input, crucible, timed): cooked_fowl <- raw_fowl 180 C 6 s | cooked_mutton <- raw_mutton 200 C 8 s |
cooked_chop <- raw_chop 200 C 8 s | baked_potato <- potato 180 C 6 s | bread <- dough 220 C 10 s.
Forge recipes (instant at temperature, byproducts returned): hearth_stew <- 1 cooked_chop, 1 potato, 1 carrot,
1 water_pail @300 C, byproduct 1 pail (ids hearth_stew; variants hearth_stew_mutton and hearth_stew_fowl with the
other cooked meats).
Flour and dough: WORKBENCH flour <- 2 wheat (hand-ground); WORKBENCH dough <- 2 flour, 1 water_pail, byproduct 1 pail.
CRUSHER (machine) flour <- 1 wheat (twice as efficient: the electric mill).
Hide: WORKBENCH bellows_hide variant: bellows <- 4 plank, 2 hide; padded_coat_hide: padded_coat <- 4 hide, 2 cord.

### 12.4 Farming
- Hoes (ToolKind 'hoe'): flint_hoe (hand: 1 flint, 2 stick, 1 cord; tier 1, durability 64), bronze_hoe (forge
  600 C: 2 bronze_ingot, 2 stick; tier 2, 192), iron_hoe (forge 1000 C T2: 2 iron_ingot, 2 stick; tier 3, 384).
  Using a hoe on the top of grass or dirt with air above turns it into `farmland` (wears the hoe by 1; flag
  'tilled'; sfx 'till'). Hoes are not mining tools (mining with one counts as bare hands).
- farmland: cube, textures farmland_top + dirt sides/bottom, drops dirt, shovel, hardness 0.8.
- Crops: wheat, potato, carrot, each 4 stage blocks `<crop>_0` .. `<crop>_3` (shape cross, item false,
  hardness 0, placeOn ['farmland'], machine 'crop', textures `<crop>_stage0..3`). Planting = placing the seed item
  on farmland: wheat_seeds places wheat_0, potato places potato_0, carrot places carrot_0 (ItemSpec.block).
  Drops: stages 0-2 return their seed item (1); stage 3: wheat -> 1-2 wheat + 1-3 wheat_seeds;
  potato -> 2-4 potato; carrot -> 2-4 carrot. sfx 'harvest' on breaking a ripe crop, 'plant' on planting.
- Growth (src/sim, crop entities, MachineSpec kind 'crop', role 'crop'): a crop advances one stage per `stageS`
  seconds of growing time (params: stageS 100). It grows only while "lit": daytime (clock sunlight >= 0.3) with
  open sky above (no opaque block anywhere above it), OR a powered lamp within 5 blocks (any time, underground
  too - grow lamps). Hydrated (a water block within 4 blocks horizontally at the crop's y-1 or y) doubles speed.
  Needs farmland directly below, otherwise it does not grow. Ripe in 300 s hydrated in daylight, 600 s dry.
  The voxel id swaps to the next stage block (entity kept, like furnace upgrades); event 'crop:grew'.
  The machine view (status text: "Growing - stage 2 of 4", "Needs light", "Ripe") is shown nowhere special -
  crops have no screen; the HUD target name shows the stage ("Wheat (ripe)").
- Wild plants (worldgen): wild_wheat (cross; drops 1-2 wheat_seeds + 50% 1 wheat), wild_potato (drops 1-2
  potato), wild_carrot (drops 1-2 carrot); woodland and grassy frostfell edges, a few per chunk, in small
  patches. tall_grass also drops wheat_seeds 15%. Spawn guarantee adds: wild_wheat within 48 blocks.

### 12.5 Animals (src/mobs - new module, DOM-free core + render models in src/render)
CreatureSpec (src/content/creatures.ts, registry CREATURES): key, name, biomes, health, speed, size {w, h},
drops (Drop[]), likes (item keys that lure and breed it), group [min, max], model (parts as boxes with colours).
| key | name | biomes | hp | speed m/s | size w x h | drops | likes |
| hen | Hen | woodland, dunes, marsh | 4 | 2.2 | 0.45 x 0.7 | raw_fowl 1 | wheat_seeds |
| goat | Goat | frostfell, woodland | 8 | 2.6 | 0.8 x 1.2 | raw_mutton 1-2, hide 0-1 | wheat |
| boar | Boar | woodland, scar, marsh | 10 | 2.8 | 0.9 x 0.9 | raw_chop 1-3, hide 1 | potato, carrot |
- Behaviour (fixed-step AI at 20 Hz): idle / wander (pick a reachable point within 8 blocks; never step into
  liquid or a drop deeper than 2 blocks) / graze (stand, head down) / flee (when hurt: run directly away from the
  player at 1.6x speed for 5 s) / follow (player within 10 blocks holding a liked item: walk to 2 blocks from the
  player) / breed (feeding a liked item with Use makes it "eager" for 30 s, consumes 1 item, sfx 'eat'; two eager
  adults of a species within 8 blocks walk together and produce a baby after 3 s; both get a 300 s cooldown).
  Babies are half size, drop nothing, grow up after 300 s.
- Physics: AABB vs solid voxels with gravity, step up 1 block by hopping, water: float and swim to shore,
  lava/contact damage like the player. Unloaded chunks are walls.
- Spawning: the first time a chunk column is loaded, a deterministic roll (seed, cx, cz): 15% chance of one group
  of a species whose biome matches, on surface grass/snow/sand in daylight-open cells. The chunks around world spawn
  are guaranteed at least one hen group and one other group within 40 blocks. Keep-alive: if fewer than 6 adults
  are within 64 blocks of the player for 120 s of daytime, spawn one group out of sight (> 24 blocks, not in view
  direction) on matching surface. Hard cap 40 animals loaded, 300 stored.
- Persistence: every animal is saved (species, position, yaw, health, age, cooldowns). Animals in unloaded chunks
  are frozen and resume when their chunk loads. The set of chunk columns already rolled is saved.
- Combat: pressing Mine with the crosshair on an animal (ray hits its box before any block) hits it: damage 1 by
  hand, axe tier+2, pickaxe/shovel tier+1, hoe 1; 0.4 s cooldown; knockback; red flash; flee; tool wear 1.
  At 0 health it tips over for 0.6 s and its drops go straight into the player's inventory (player.give, like
  block drops). sfx 'mob_hurt' / species call. Events 'mob:hurt', 'mob:died'.
- Calls: each species makes its idle call (sfx 'hen' | 'goat' | 'boar') every 8-20 s at random, positioned.
- Rendering (src/render/mobs): each species a small box model (body, head, legs, plus beak/comb, horns,
  tusks/snout), flat-shaded with subtle per-face pixel noise in its colours; lit by the world light at its
  position (sky x sunlight, block light) like the terrain; leg swing with speed, head bob while grazing, red
  flash when hurt, tip-over on death, babies scaled 0.5. Frustum culled, no per-frame allocation.

### 12.6 Objectives added (insert in this order)
after get_warm: `cook_food` "Cook a meal" - any of make cooked_fowl / cooked_mutton / cooked_chop / baked_potato;
`eat_food` "Eat" - flag 'ate'.
after smelt_copper: `till_soil` "Till the soil" - flag 'tilled' (reward 3 wheat_seeds); `plant_seeds` "Plant
wheat" - place wheat_0.
after place_lamp (moved from after bronze_pickaxe: crops take minutes to ripen): `bake_bread` "Bake bread" - make bread.
Flags emitted by code: 'ate' (any food eaten), 'tilled'.

### 12.7 Events and sounds
GameEvents additions: 'player:ate' { item, hunger }, 'mob:spawned' { id, species }, 'mob:hurt' { id, species,
health }, 'mob:died' { id, species }, 'crop:grew' { x, y, z, stage }.
SfxName additions: eat, till, plant, harvest, hen, goat, boar, mob_hurt (src/audio must give each a patch).

### 12.8 UI
HUD: food meter beside health and warmth (drumstick-free original glyph: a small bowl), "Hungry" state, Well-Fed
indicator. Tooltips and recipe rows show "+N food" for food items. Furnace SMELT tab: cooking recipes appear in
the recipe list under a "Kitchen" chip (category Food). The target name for crops shows their stage; for animals,
their name and health.

---------------------------------------------------------------------------------------------------------

## 13. Buckets and water (player request)

- The pail becomes the BUCKET: item keys stay `pail` / `water_pail` (saves and recipes keep working) but every
  player-facing name and description says "Bucket" / "Water Bucket". Using an empty bucket on water fills it
  (sfx 'splash'). SUPERSEDED by section 18: water flows, and buckets only take source blocks. Using a water bucket on a block face pours a water block there and returns the
  bucket. A water bucket is also a fluid container for the fluid system of section 16 (a tank or fluid port
  accepts it and gives back an empty bucket, and vice versa).
- Dough REQUIRES water: dough <- 2 flour + 1 water_pail (byproduct: the empty bucket). Hearth stew also needs one.
  Tooltips and recipe rows show "returns the bucket".
- Buckets of lava: a bronze bucket (`bronze_bucket`, forge 700 C: 3 bronze_ingot) can also scoop LAVA
  (`lava_bucket`) - lava is a furnace fuel (flame 1300 C, 2 MJ, 100 s; the bucket comes back) and the fluid
  source for the geothermal tap via pipes. Scooping lava removes the lava block (lava pools are finite).

## 14. A richer world (player request: "make more of the world beyond the furnace screens")

The 3D world must be worth exploring and must feel alive; screens are where you plan, the world is where you live.
- Surface life: flowers (ember_poppy red, skybell blue, frost_lily white - cross plants, biome-specific, decor
  and dye-free), ferns in woodland shade, reeds at shorelines (cross, on sand/dirt/clay next to water), berry
  bushes (`berry_bush`, cross, drops 1-3 `wildberries`, food 2, and stays as `berry_bush_bare` that regrows in
  300 s - a crop-like entity), glowcap mushrooms on dark forest floor and cave floors (light 6, soft cyan - caves
  have their own light), cacti in dunes (contact damage 1/s, drops itself), ice spikes in frostfell, basalt
  columns and steam vents in the scar (vent: emits steam particles, warmth 3, hiss sound nearby).
- Trees with character: oaks in three sizes (bush, normal, broad old oak with a 2x2 trunk), tall and short pines,
  dead snags in the scar, palm-free dunes. Leaves sway (already in the shader).
- A new biome, MARSH: flat wetland at sea level with shallow pools, reeds, willow-shaped oaks, clay-rich ground,
  and PEAT (`peat` block, shovel, early fuel: 500 kJ, 50 s, flame 900 C - hotter than wood, before charcoal).
- Landmarks: OLD WORKS ruins - remnants of someone who tamed fire before you: crumbling stone-brick and brick
  walls, a collapsed cold furnace (decor block), rusted machine shells, and a loot crate with modest help
  (rubble, clay, copper or tin ore, coal, seeds, sometimes a bucket or a flint tool; deeper or farther ruins hold
  iron, a thermopile, cable). About one per 7x7 chunks; one is guaranteed within 96 blocks of spawn. Deterministic
  from the seed, generated chunk-order-independently like trees.
- Underground: crystal geodes (quartz_ore shell with an amethyst-free original `crystal_cluster` cross block
  inside, light 4), underground lakes, static lava falls in deep caves, ore outcrops visible on cliffs.
- Ambient motion (render only, no gameplay): fireflies at night near water and in woodland, drifting leaves under
  trees, wind-blown sand in dunes, snow flurries in frostfell, heat shimmer above lava, birds that circle high over
  woodland by day.
- MACHINES ALIVE IN THE WORLD: machines are not just textured cubes - the wind turbine has a spinning 3D rotor
  (speed follows wind), the water wheel turns, the steam engine's flywheel spins and puffs, the bore rig's drill
  turns and shakes, generators and furnaces glow, formed multiblock furnaces (section 17) look like one building
  with a roaring mouth, pipes show items moving through them (section 16). All render-only animation driven by
  the block entity state, cheap on phones (instanced / merged, culled, no per-frame allocation).

## 15. Day, night and weather (player request: "a whole dynamic day/night cycle")

The clock, sun, moon, stars, clouds and sunlight-driven lighting exist. Add:
- Moon phases: 8-day cycle; night brightness scales from 0.04 (new moon) to 0.12 (full moon); the moon is drawn
  with its phase. Stars slowly rotate. Sunrise and sunset paint the horizon on the sun's side (already partly).
- WEATHER, per world, changing every 4-12 minutes with smooth 30-60 s transitions; deterministic from the seed and
  the elapsed time so it is saved implicitly (save the current state anyway):
  clear (45%), cloudy (25%), rain (20%), storm (10%). In frostfell and high altitude rain falls as snow; in dunes
  rain becomes a dry dust wind instead.
  * visuals: cloud cover and darkness follow the weather; rain streaks / snowflakes / dust as camera-local pooled
    particles that stop under a roof (sky-light test at the camera); wet surfaces slightly darker and glossier;
    storms flash lightning (sky flash + delayed thunder by distance) - lightning is visual only, it never strikes.
  * sound: rain bed, wind gusts, thunder (new SfxName 'thunder'; ambience fields rain 0..1, storm 0..1).
  * gameplay: solar output x0.5 cloudy, x0.2 rain/storm/snow; wind turbines x1.5 in storms; rain hydrates crops
    (counts as water in reach); rain/snow adds 0.3 warmth drain per second when not under a roof; a furnace exposed
    to rain from above loses heat faster (+50% loss) - build it a roof.
- HUD: the day/night dial shows the weather glyph and the moon phase; the forecast line in the Hearth Log says
  "Rain within the hour" when the next state is rain or storm (the hearth keeper reads the sky).

### 13-15 data (laid down by the world-content pass; full tables in docs/api/world-content.md)
- Keys: blocks ember_poppy, skybell, frost_lily, fern, reeds, berry_bush, berry_bush_bare, glowcap, cactus,
  packed_ice + ice_spike (spires), basalt_column, steam_vent, peat, cracked_stone_brick, mossy_stone_brick,
  collapsed_furnace, rusted_shell, crystal_cluster (drops 1-2 silica, iron pickaxe), oil (liquid 'oil'); items
  bronze_bucket, lava_bucket (FuelSpec.fuelReturns 'bronze_bucket'), wildberries. Machine `berry_bush` (role 'bush',
  params regrowS 300); a picked bush is `BlockSpec.harvestLeaves`. The bronze bucket scoops lava only.
- Marsh: BiomeKey 'marsh'; coal and iron x1.5; hens and boars live there. Ruins: RUIN_* constants and loot tables
  'near' / 'deep' (src/content/loot.ts, `rollLoot` in the registry).
- Weather: WeatherState in src/core/types.ts, WEATHER_* / moon / lightning constants in src/core/constants.ts,
  lookups in src/core/weather.ts, events 'weather:changed' / 'weather:lightning', sfx thunder, steam_hiss, scoop_lava,
  AmbienceState rain / storm / sheltered. The first night has a full moon; solar panels need sunlight > 0.15.

---------------------------------------------------------------------------------------------------------

## 16. Item and fluid transport (player request: "pipes and item/fluid transport a la FTB mods")

Researched mechanics (BuildCraft, Thermal Dynamics, EnderIO, Mekanism, Pipez), our own design and names. Core
rules: the destination is chosen when an item leaves; travel is a timer; rendering only interpolates; items never
spill or clog; every port always shows why it is idle.

### 16.1 Blocks and items
| key | name | made | rate |
| item_pipe | Bronze Chute | forge T1 800 C: 2 bronze_ingot, 1 glass -> 8 | 1 transfer of up to 4 items every 2 s, 4 blocks/s |
| fast_item_pipe | Steel Conveyor Pipe | forge T2 1300 C: 2 steel_plate, 1 glass -> 8 | up to 16 items every 0.5 s, 10 blocks/s |
| fluid_pipe | Iron Fluid Pipe | forge T2 1000 C: 2 iron_plate, 1 glass -> 8 | 200 L/s per port, cold fluids only (water, crude oil, fuel) |
| hot_fluid_pipe | Steel Hot Pipe | forge T2 1400 C: 2 steel_plate, 1 ceramic_insulator -> 8 | 1000 L/s per port, any fluid incl. lava and steam |
| pump | Pump | forge T2 1000 C: 1 chassis, 1 copper_coil, 2 fluid_pipe | consumer 50 W; must touch a liquid block; water bodies of >= 2 blocks are endless; lava and oil blocks are removed as they are pumped (one block per 1000 L, nearest connected first, BFS <= 32) |
| tank | Tank | forge T2 1000 C: 4 iron_plate, 4 glass | 16 000 L; vertically stacked tanks share one fluid and one level |
| wrench | Wrench | forge T1 600 C: 3 bronze_ingot | configures pipe ends (16.3) |
Units: litres; a bucket is 1000 L. Pipes are shape 'pipe' (like 'cable': a core plus arms to every connectable
neighbour) - item pipes connect to item pipes and item endpoints, fluid pipes to fluid pipes and fluid endpoints;
the two families never join. Active voxel bit = carrying something (for a subtle tint).

### 16.2 Endpoints
Every inventory or tank-bearing block entity is an endpoint: crates (all slots), every machine (its input slots
accept, its output slots give), and the FURNACE with smart sides: inserted fuel goes to the firebox, smeltable items
to a free crucible input (or one with the same input), forge ingredients are not accepted, extraction only takes
finished crucible outputs. A formed hearth (section 17) exposes the same through its hatches. Fluid endpoints:
tank, pump (gives), steam_engine (takes water - piped water replaces the adjacent-water rule), electrolyzer and
fission pile (take water as coolant; piped water >= 100 L/s counts as cooled), combustion_engine (takes fuel:
1000 L of fuel = one fuel_canister of energy), still (takes crude_oil 500 L -> gives fuel 400 L, or 2 oil_shale ->
fuel_canister as before), geothermal_tap (takes lava: 1000 L runs it 600 s at full output; adjacent lava blocks
still work), furnace fluid hatch (takes lava as fuel: 1000 L = one lava bucket of fuel).
Buckets: using a bucket on a tank or a fluid endpoint fills or empties 1000 L (water, lava with the bronze bucket).

### 16.3 Pipe ends (ports) and the wrench
A pipe end touching an endpoint is a PORT with config { mode: 'push' (default: the pipe delivers into the block)
| 'pull' (the pipe extracts from the block) | 'off'; distribution: 'nearest' | 'round'; filter: up to 5 item or
fluid keys + allow/deny; priority -2..+2 }. Using the WRENCH on a pipe arm that touches a block cycles
push -> pull -> off (toast "Pulling from Blast Furnace"); using it on the centre of a pipe toggles that pipe's
connection to the targeted neighbouring pipe. Using a pipe with an empty hand (or long-press on touch) opens the
PIPE SCREEN: one row per port of that pipe's network segment near you, with the endpoint's icon, a segmented
control Push / Pull / Off, the status line ("Moving 4 every 2 s", "No destination", "Destination full", "Too hot
for this pipe"), and an expandable section with distribution, filter slots and priority.

### 16.4 Network simulation (20 Hz, phone-safe)
- Rebuild (flood fill) a family's networks only when a pipe or endpoint is placed/removed; caps: 1024 pipes and 64
  ports per network (beyond: "Network too long" warning, extra pipes inert).
- Items: each 'pull' port has a cooldown; when it fires it takes the first extractable stack that passes its
  filter, picks a destination among 'push' ports whose filter accepts the item (never its own block; priority
  first, then nearest by path length or round-robin), reserves space there, removes the items and creates a packet
  {item, count, from, to, path length, elapsed}. Arrival inserts; if the destination no longer accepts, re-route to
  the next candidate; if none, return to the source; if that fails too, the packet waits at its end and the port
  shows "Blocked". Max 48 packets per network; pulling pauses at the cap. No destination -> nothing is extracted.
- Fluids: a network holds ONE fluid and an amount, capacity 250 L per pipe. 'pull' ports drain up to the rate from
  their endpoint into the network; the network fills 'push' ports by priority, equal split inside a priority.
  Connecting two networks holding different fluids is refused (the joint stays unconnected and shows a mismatch).
  An empty network forgets its fluid. Cold pipes refuse lava and steam ("Too hot for this pipe").
- Packets and fluid amounts are saved (packets in flight are delivered to their destination on load).

### 16.5 Fluids
| key | name | colour | where it comes from |
| water | Water | blue | pump on water (endless), water bucket |
| lava | Lava | orange, glowing | pump on lava (finite), lava bucket |
| steam | Steam | white | BOILER: a new block `boiler` (forge T2 1100 C: 4 iron_plate, 2 copper_coil, 1 tank) placed directly on a furnace or hearth top: takes water, turns furnace heat into steam (needs >= 200 C; 1 L water -> 10 L steam; draws heat like a heat engine) |
| crude_oil | Crude Oil | black | pump on oil pools (new world liquid `oil`, static pools in dunes and the scar) |
| fuel | Refined Fuel | amber | still (crude_oil -> fuel) |
Steam use: a new generator `steam_turbine` (forge T3 1600 C: 1 chassis, 4 steel_plate, 4 copper_coil; 8000 W at
800 L/s steam; takes steam through a hot pipe) - the furnace-as-power-plant fantasy at scale.

## 17. Multiblock hearths (player request: "multi block furnaces ... like FTB mods")

Researched mechanics (Tinkers' smeltery cuboid scan, Mekanism free-port cuboids, Immersive Engineering formation
feedback), our own design. The furnace block becomes the HEARTH CONTROLLER. Tier 1 (Clay) stays a single block. To
run at tier 2-5 the controller must sit in the wall of a FORMED structure of that tier. Formation is automatic (no
hammer step - one less fiddly tap on a phone).

### 17.1 Structure rules
A hollow cuboid; the controller sits in a wall (a face cell, not an edge), its front facing outward; the cell
behind it is interior.
| tier | wall block (frame + faces; floor; ceiling) | interior (x*z*y) | ceiling | required parts | crucibles |
| 2 Blast | brick | 1x1x1 .. 3x3x3 | optional (an open top shows the fire) | - | min(4, x*z) + 1 |
| 3 Arc | refractory_brick | 1x1x1 .. 4x4x3 | required | >= 1 electrode in the ceiling | min(6, x*z + 1) |
| 4 Plasma | plasma_casing | 2x2x2 .. 5x5x4 | required | >= 2 power_port | min(8, x*z + 2) |
| 5 Starhearth | star_casing | 3x3x3 .. 5x5x5 | required | >= 4 power_port | 9 |
- Faces (not edges) may also be: glass (window; loses heat x2 for that cell), item_hatch, fluid_hatch,
  power_port, blower (counts as a tuyere: +25% smelting speed each, max 4; it still needs its 150 W).
  Ceilings may hold electrodes (T3+). Interior: air only.
- Structural tier = the lowest tier whose wall rules are fully met; walls of a higher tier's block also satisfy
  lower tiers (a plasma_casing wall works for a Blast hearth).
- The floor cell directly under the controller (when the furnace sits on the lowest inside layer) is walled in by the
  furnace and the ground, so it counts as frame whatever solid block stands there (grass, dirt, a lower tier's brick);
  it is never counted towards a tier. A first hearth on flat ground never needs digging under the furnace.
- The controller's effective tier = min(its own upgraded tier, structural tier). The controller is still upgraded
  in place with its upgradeCost (existing flow, objectives unchanged), but the Upgrade button additionally needs
  the structure for the next tier to be formed ("Build a Blast hearth: brick walls around the furnace").
- Interior size grants: crucibles (table), heat capacity x (interior volume)^0.5 and heat loss x (shell area / 26)
  (bigger hearths take longer to heat and cost more to keep hot; windows count double), smelting speed x
  (1 + 0.1 * (interior volume - 1)) capped at x2.
- Power: tier 3+ electric heating draws through power_port blocks (or a cable touching the controller); the hearth
  is one consumer.
- Hatches proxy to the controller: item_hatch = smart sides of 16.2; fluid_hatch takes lava (fuel) and gives
  nothing else for now; power_port joins cable networks.

### 17.2 New blocks (recipes)
| key | name | recipe |
| refractory_brick | Refractory Brick | forge T2 1300 C: 4 brick, 1 coke -> 4 |
| plasma_casing | Plasma Casing | forge T3 1900 C: 2 steel_plate, 1 aluminum_ingot, 1 tungsten_rod -> 2 |
| star_casing | Star Casing | forge T4 2800 C: 2 superalloy, 1 fused_quartz, 1 magnet_ring -> 2 |
| electrode | Arc Electrode | forge T2 1200 C: 3 graphite_electrode, 1 copper_coil |
| item_hatch | Item Hatch | forge T2 1000 C: 1 crate, 2 iron_plate |
| fluid_hatch | Fluid Hatch | forge T2 1000 C: 1 tank, 2 iron_plate |
| power_port | Power Port | forge T3 1200 C: 2 copper_coil, 2 ceramic_insulator, 1 iron_plate |
Furnace upgrade costs shrink accordingly (the structure is now most of the cost): T2 4 bronze_ingot, 1 bellows;
T3 2 copper_coil, 2 steel_plate; T4 2 circuit, 2 tungsten_rod; T5 1 star_core, 8 deuterium_cell (unchanged).

### 17.3 Validation
- Algorithm (cuboid scan, ~1100 voxel reads worst case): from the cell behind the controller walk interior air in
  the 4 horizontal directions to find the walls (max inner size of the tier + 1), check the controller's layer,
  scan down to the floor, scan up to the ceiling or until a layer stops being a wall ring; classify each cell as
  frame (edge), face, floor, ceiling or interior and check its rules; another controller in the shell fails.
  Collect up to 8 problems { code, position, text } ("Interior must be empty", "Glass cannot sit on an edge",
  "Needs 1 more Power Port", "Wall is not Refractory Brick").
- When: on any block change within the shell's bounding box + 1 (scan next tick); while unformed, every 1 s only
  if the player is within 16 blocks or the furnace screen is open; while formed, verify one shell cell every 4
  ticks (safety net).
- Unforming never destroys anything: crucibles above the new count lock (contents can still be taken out), the
  effective tier drops, the player gets a toast.

### 17.4 Feedback and rendering
- Furnace screen gains a STRUCTURE tab: status chip ("Formed - Blast hearth 3x3x2", or "Not formed"), a checklist
  (Floor, Walls, Ceiling, Electrodes 1/1, Power ports 0/2) with ticks, the problems in plain words - tapping one
  highlights that block in the world (pulsing red outline for 10 s, plus an edge-of-screen arrow when off-screen) -
  and a target-tier picker that shows the blocks needed (a materials list with have/need) and a GHOST PREVIEW: for
  the chosen tier and interior size, translucent blue cubes in the world where blocks are missing and red where
  a block is wrong. The ghost stays visible after closing the screen until the structure forms or is dismissed.
- Formed: every shell block's voxel active bit is set (glowing-seam texture variants that brighten with
  temperature); the interior shows a molten glow (a light-emitting pool at the floor whose colour follows the
  temperature heat ramp) and the hearth lights its surroundings by temperature; open tops emit heat shimmer and
  smoke; windows show the inner glow. Formation moment: a light sweep across the shell, a deep "whoomph" (new
  SfxName 'hearth_formed'), toast "Blast hearth formed".

### 16-17 data (laid down by the tech-content pass; full tables in docs/api/tech-content.md)
- Contracts: BlockShape 'pipe' with `BlockSpec.pipe` (family, ratePerS, batch, speedBlocksPerS, capacityL, hot);
  `FluidKey` / `FluidSpec` and the registry's `FLUIDS` (water, lava, steam, crude_oil, fuel - colour, hot, glow, world
  liquid, bucket); `MachineSpec.fluids` (accepts, gives, capacityL); `FurnaceTierSpec.structure` (wall, min/maxInner,
  ceiling, electrodes, powerPorts, crucible rule); `BlockTextures.bottomActive`; roles 'tank' and 'hearth_part'; events
  'hearth:formed' / 'hearth:unformed'; sfx hearth_formed, pipe_clunk; PIPE_* and HEARTH_* constants; pure hearth
  lookups in src/core/hearth.ts; registry helpers pipeJoins, pipeCarries, isItemEndpoint, isFluidEndpoint,
  hearthWallTier, fluidInBucket, bucketFilledWith, fluidOfLiquid.
- Keys: blocks item_pipe, fast_item_pipe, fluid_pipe, hot_fluid_pipe, pump, tank, boiler, steam_turbine,
  refractory_brick, plasma_casing, star_casing, electrode, item_hatch, fluid_hatch, power_port; item wrench (a tool
  with no ToolSpec). Machines pump, tank, boiler, steam_turbine, item_hatch, fluid_hatch, power_port; fluid ports on
  steam_engine, electrolyzer, fission_pile, combustion_engine, still, geothermal_tap.
- Objectives pipe_ore ("Pipe it in", after blast_furnace) and pump_water ("Pump water", after arc_furnace). The
  progression solver requires each tier's smallest shell (16 brick; 24 refractory brick + 1 electrode; 53 plasma
  casing + 2 power ports; 93 star casing + 4 power ports) to be obtainable at the previous tier.

---------------------------------------------------------------------------------------------------------

## 18. Flowing water and source blocks (player request - replaces "water does not flow" and the endless-spring bucket rule of section 13)

### 18.1 Water states (voxel encoding of the `water` block)
- variant bits (0..7) = LEVEL: 0 = SOURCE, 1..7 = flowing water, 1 strongest .. 7 weakest.
- active bit = FALLING (water dropping down a column; behaves as a strong flow when it lands).
- World generation places only sources (every existing lake, river and pool), so a freshly generated world is
  perfectly still. Water only moves after something changes next to it.

### 18.2 Flow rules (src/world, a scheduled cellular update - never a scan of the world)
- A water cell is re-evaluated when it or one of its 6 neighbours changes (block placed/broken, water arrives or
  leaves). Updates are queued with a delay of 5 game ticks (0.25 s) per step so water visibly spreads, processed at
  most 256 per tick (excess carries over), and never cross into an unloaded chunk (retried when it loads).
- Down first: if the cell below is air or a block water can wash away, water flows into it as FALLING water.
- Sideways: a source or a flowing cell of level L < 7 that is resting on something solid (or on water) spreads to
  each horizontal neighbour that is air or washable, with level L + 1 (falling water lands and spreads as level 1).
  Spreading prefers the directions that lead to the nearest drop within 4 blocks; if no drop is near, all
  directions are equal.
- Draining: a flowing cell whose feeding neighbour is gone recomputes its level from its neighbours (lowest
  neighbour level + 1, or falling if fed from above); if nothing feeds it, it disappears (levels recede over a few
  updates, not all at once).
- New sources: a flowing cell with at least 2 horizontally adjacent SOURCE cells, and a solid block or a source
  below it, becomes a source. This is what keeps lakes and two-block pools endless for buckets and pumps.
- Washable blocks (water flows into them and destroys them, no drop): tall_grass, fern, flowers, dry_shrub, reeds.
  Everything else (crops, torches, machines, pipes, cables, crates, ...) blocks the flow.
- Lava and crude oil stay still (unchanged).

### 18.3 Buckets (replaces 13: "every water block is an endless spring")
- An empty bucket can only take a SOURCE block: the ray aims through flowing water at the first source along the
  line of sight (as if flowing water were not there); taking it REMOVES the source (set to air), and the water
  around reacts (a hole in a lake refills from its neighbours by the new-source rule; a lone source is gone).
- A water bucket places a SOURCE block in the targeted cell (air, a washable block, or flowing water) and returns
  the empty bucket; the new source then flows by the rules above.
- Tanks and fluid endpoints keep working with buckets exactly as before (section 16.2).
- Pumps: a pump takes water from source blocks; a source with at least 2 adjacent sources is endless (same rule
  as before, now consistent with 18.2), a lone source is removed when pumped.

### 18.4 Rendering and physics
- Flowing water is drawn lower by level (source and falling: full height minus 2/16; level L: (8 - L) / 9 of a
  block), with sloped surfaces: each top corner takes the average height of the up-to-4 water cells around it,
  and a flowing surface scrolls its texture in the flow direction (vertex data; no new texture layers needed).
- Currents: the player and animals standing or swimming in flowing water are pushed along the flow (~1.4 m/s at
  level 1, weaker at higher levels); falling water pushes down.
- Everything that needs "water nearby" (steam engine, water wheel, crops hydration, fission cooling, electrolyzer)
  counts flowing water as water.

---------------------------------------------------------------------------------------------------------

## 19. The Emberbound - hostile automatons (player request: "war-forged, ember-fueled automatons of various
## types, as if once ago in this world the late-game items and mechanisms were more prevalent than now")

Replaces "no hostile creatures" in pillar 4. Lore (How to Play, Hearth Log, item texts): long ago this land burned
bright with machines - the Old Works were their forges. The machines outlived their makers. Some still walk,
fed by the last embers in their cores, and they wake in the dark. Everything they carry is a relic of that
age: scrap, ember cores, and now and then a part the player will not be able to make for hours.

### 19.1 The types (CreatureSpec with `hostile: {...}`; original designs, blocky like the animals, with glowing
### ember parts: eyes, vents, cores - emissive model parts)
| key | name | where / when | hp | speed | attack | drops |
| cinder_mite | Cinder Mite | caves and dark places, surface at night; groups of 2-4 | 4 | 3.2 | bite 1, 0.8 s | scrap_metal 0-1 |
| forge_warden | Forge Warden | guards ruins (placed with the ruin, persistent, active day and night within 12 blocks of its ruin); rare at night elsewhere | 16 | 2.4 | hammer 3 after a 0.5 s raise; its shield arm halves damage from the front | scrap_metal 1-3, 10% copper_coil, 4% circuit |
| kiln_sentry | Kiln Sentry | a turret on ruin walls (persistent, never moves) | 12 | 0 | lobs an ember bolt (2 damage + burning 2 s at 1/s) every 3 s at range <= 16 with line of sight; its vent glows brighter for 0.7 s before each shot | ember_core 1, scrap_metal 1-2 |
| bellows_hound | Bellows Hound | surface at night, scar biome any time it is dark; alone or in pairs | 10 | 4.5 | dash: crouches 0.8 s (bellows inhale, vents flare), then charges in a straight line, 4 damage + knockback | scrap_metal 1-2, 25% ember_core |
| arc_drone | Arc Drone | hovers over high ground during storms and on moonless nights | 8 | 3 (flies) | arc zap 2 at range <= 8 after a 0.6 s crackle; double damage if the player stands in water | scrap_metal 1, 20% copper_wire 2, 8% silicon_wafer |
| slag_colossus | Slag Colossus | rare: deep caves (y < 20) and the scar at night; at most one loaded | 60 | 1.6 | ground slam: raises both arms 1.2 s, then 6 damage within 3 blocks + knockback | superalloy 1, ember_core 3, 30% magnet_ring, scrap_metal 4-8 |
All attacks are TELEGRAPHED (a visible and audible wind-up the player can step out of) - important on a phone.

### 19.2 Behaviour (src/mobs, same manager as the animals)
- Senses: notices the player within 16 blocks with line of sight (or 6 without), forgets after 10 s out of reach.
- Moves by steering straight at the player with the animal physics (hop 1 block, swim, avoid lava; no long-range
  pathfinding - they give up and wander when blocked for 4 s). Drones fly at 2-4 blocks above ground. Sentries
  turn but never move.
- Daylight: at dawn, automatons standing under open sky WIND DOWN: they stop, their glow dims, they go dormant (do
  not attack, take normal damage, wake if hit) and despawn when > 48 blocks from the player. Ruin guards and
  sentries keep watch in daylight but only inside their ruin.
- They never enter the WARM ZONE of a furnace that is at least 200 C (its warmth radius): they halt at its edge
  and turn away - the hearth is the safe heart of the base, at every stage of the game.
- Projectiles: ember bolts arc (gravity), are visible (glowing, trailing sparks), hit the first solid block or
  the player, never break blocks.
- Damage to the player goes through PlayerState.damage with new causes 'automaton' and 'ember' (burning).

### 19.3 Spawning
- Difficulty setting (Settings + New World option): Peaceful (no hostiles; objectives that need combat
  complete themselves), Normal (default), Hard (x1.5 caps, x1.25 damage).
- Night/dark spawning near the player: every 2 s, if fewer than the cap (Normal 10 loaded hostiles), try one spot
  24-40 blocks away on a solid floor with block light < 7, never in sunlight by day, not within the warm zone of a
  hot furnace, not within 32 blocks of a powered ward_beacon, not in view of the camera; pick a type by place
  (cave/surface/scar/storm/high ground/depth) and weights. Despawn when > 64 blocks away (except ruin guards).
- Ruins (src/world features): each Old Works ruin gets 1-2 forge_wardens and, on half of the ruins, a kiln_sentry
  on a wall, created once when the ruin's chunk first loads (like its loot crate), saved, never respawned.
- Light matters: torches and lamps (block light >= 7) prevent spawns around them.

### 19.4 Fighting back
- Mine on a hostile attacks it (same as animals): hands 1, tools as for animals, and new WEAPONS - mauls, made for
  breaking metal (they do not mine faster):
  bronze_maul (forge T1 700 C: 4 bronze_ingot, 2 stick) 5 damage | iron_maul (forge T2 1100 C: 4 iron_ingot,
  2 stick) 7 | steel_maul (forge T2 1400 C: 4 steel_ingot, 2 stick) 9 | arc_maul (forge T3 1800 C: 2 steel_plate,
  1 copper_coil, 1 ember_core, 1 battery) 12 and stuns automatons for 1 s.
  Attack cooldown 0.5 s (tools 0.4 s), durability like tools. Hits knock back, flash, clang.
- ARMOUR (worn from the inventory like the padded coat; the best one counts): plated_coat (forge T2 1100 C:
  6 iron_plate, 1 padded_coat) -25% damage and keeps the coat's warmth; steel_cuirass (forge T2 1400 C: 6 steel_plate,
  1 padded_coat) -40%.
- WARD BEACON (machine consumer, 500 W; forge T3 1500 C: 2 ember_core, 1 circuit, 2 steel_plate, 1 glass): no
  hostile spawns within 32 blocks while powered; existing hostiles avoid its radius like a warm zone.
- New items: scrap_metal (smelts into iron_ingot at 1150 C, T2), ember_core (fuel: 3 MJ, 120 s, flame 1700 C -
  the hottest early fuel, and a component), the mauls, the armour, ward_beacon. Relic drops (coil, circuit,
  wafer, superalloy, magnet ring) are existing items.
- Objectives (insert): after `make_bronze`: `forge_maul` "Forge a maul" (make bronze_maul); after the first night
  objective (`get_warm`) is fine for flavour but the combat one is `salvage_automaton` "Salvage an automaton" (flag
  'automaton_salvaged', or completes itself on Peaceful) placed after `bronze_pickaxe`; after the tier-3 objective:
  `ward_base` "Ward your base" (place ward_beacon).
- Death by automaton: the death screen names the type ("Felled by a Forge Warden").

### 19.5 Presentation
- Models from CreatureSpec boxes with emissive ember parts that flare before attacks; dormant ones are dark; a
  small spark/smoke emitter on each active automaton; break-apart on death (debris in their colours, sparks).
- HUD: target name + health for hostiles ("Forge Warden - 9/16"), a subtle red screen-edge pulse in the direction
  of an attacker that hit you (directional damage indicator), a danger hint when a telegraphed attack is coming
  from off-screen (edge arrow).
- Sounds (new SfxName): automaton_step (heavy clank, positioned), automaton_wake (whirr up), automaton_windup
  (rising hiss/inhale), automaton_attack (metal impact), ember_bolt (launch whoosh), arc_zap, automaton_hurt
  (clang), automaton_break (crash and tinkle); music-free.

### 19 data (laid down by the emberbound-content pass; full tables in docs/api/emberbound-content.md)
- Contracts: `CreatureSpec.hostile` (HostileSpec + HostileHabitat with SpawnPlace weights), `CreaturePart.emissive`, anims
  legML/legMR/armL/armR; automatons are the registry's `AUTOMATONS` (not `CREATURES`). Weapons are tool kind `'maul'` (mines
  like a hand) plus `ItemSpec.weapon { damage, stunS? }`; armour is `ItemSpec.armour { reduction, warmthDrainMult? }` (the
  padded coat has one too). `Settings.difficulty` and `Settings.uiScale`. Causes 'automaton' / 'ember', events
  `hostile:*`, `player:attacked`, `projectile:*`, `automaton:salvaged`, the eight sfx; every number of 19.2-19.4 is a
  HOSTILE_* / RUIN_* / EMBER_BOLT_* / WARD_BEACON_RADIUS / WEAPON_HIT_COOLDOWN_S constant; pure lookups in src/core/hostile.ts.
- `ward_base` sits after `make_circuits` (the beacon needs a circuit). Flags the code emits: 'automaton_salvaged' (an
  automaton broken apart by the player) and 'peaceful' (a session on Peaceful), which completes salvage_automaton and ward_base.

---------------------------------------------------------------------------------------------------------

## 20. Steam and shafts - mechanical power before electricity (player request)

The furnace boils water, steam turns a rotor, rotation travels through axles and gearboxes to machines that need
motion. Watts come later: in the Forge Age a DYNAMO turns shaft rotation into electricity. This moves first
electricity from the Ember Age to the Forge Age and gives the Ember Age its own mechanisms.

### 20.1 Model (src/sim, a MECHANICAL network beside the electrical one, same solver shape)
- Every block with `mech` ('shaft' | 'source' | 'consumer') joins a shaft network with its connected neighbours.
  Axles connect only along their axis (axis stored in the voxel: facing bits N/S = z, E/W = x, variant bit = y);
  gearboxes, sources and consumers connect on all six sides.
- Units: TORQUE in N*m. Each source offers torque, each consumer needs torque. Per tick: supply S (sum of running
  sources), demand D (sum of consumers switched on and with work), rating R (lowest axle rating in the network),
  f = D > 0 ? min(1, min(S, R) / D) : 1. Consumers run at speed x f and stall below 0.25. The network's SPEED
  (0..1, for animation and readouts) = f when D > 0, else 1 if S > 0. Overload never breaks anything: the shaft
  just turns slower and the HUD/machine screens say "Overloaded - add a source or a stronger axle".
- Shown to the player as "Torque 120 / 200 N*m" and a turning speed in rpm (60 rpm x speed).

### 20.2 Blocks (content numbers - the content engineer may tune them, documenting why)
| key | name | age | made | role |
| kettle | Copper Kettle | Ember | forge T1 600 C: 3 copper_ingot, 1 bucket | sits ON a furnace; holds 4000 L water (filled by bucket, an adjacent water block, or a pipe); boils 20 L/s into steam while the furnace is >= 120 C, drawing 3 kW of furnace heat at full boil |
| steam_rotor | Steam Rotor | Ember | forge T1 650 C: 2 copper_ingot, 2 tin_ingot, 1 plank | source: touches a kettle (or a steam pipe later); 120 N*m at 20 L/s steam, proportionally less |
| wooden_axle | Wooden Axle | Ember | workbench: 3 plank -> 4 | shaft, rated 150 N*m |
| bronze_gearbox | Bronze Gearbox | Ember | forge T1 700 C: 2 bronze_ingot, 1 wooden_axle | shaft junction, all six sides, rated like the weakest attached axle |
| iron_axle | Iron Axle | Forge | forge T2 1000 C: 1 iron_ingot -> 2 | shaft, rated 1000 N*m |
| steel_axle | Steel Axle | Current | forge T2 1300 C: 1 steel_ingot -> 2 | shaft, rated 6000 N*m |
| water_wheel | (existing) | Ember | (existing recipe moves to the workbench + 2 copper_ingot) | becomes a MECHANICAL source: 30 N*m per flowing-water neighbour (flow matters now that water flows), max 90 |
| steam_engine | (existing) | Forge | (existing) | becomes a MECHANICAL source: 600 N*m on top of a furnace, fed water as before |
| millstone | Millstone | Ember | workbench: 4 stone_brick, 1 wooden_axle | consumer 40 N*m: wheat -> flour (1:1, 2 s), copper_ore / tin_ore -> 2 crushed (4 s) - early ore doubling |
| saw_bench | Saw Bench | Ember | forge T1 600 C: 2 bronze_ingot, 4 plank | consumer 30 N*m: 1 log -> 6 plank (2 s) |
| mech_bellows | Shaft Bellows | Ember | workbench: 1 bellows, 1 wooden_axle, 2 plank | consumer 20 N*m: holds an adjacent furnace's draft at >= 0.7 (the hand-pumped bellows, automated) |
| trip_hammer | Trip Hammer | Forge | forge T2 1100 C: 4 iron_ingot, 1 bronze_gearbox, 2 stone_brick | consumer 120 N*m: 2 ingots -> 1 plate (iron, steel), 3 s |
| dynamo | Dynamo | Forge | forge T2 1000 C: 2 copper_coil, 1 iron_axle, 2 iron_plate | consumer of torque AND electrical generator: converts up to 400 N*m into up to 2000 W (5 W per N*m) - the bridge to the electric grid |
All four machines have an input and output slot (pipes and crates work with them like every machine).

### 20.3 Progression changes
- Thermopile moves to Forge Age (forge T2) so the Ember Age has no electricity; the first-power objective moves
  after the Blast hearth and accepts a dynamo or a thermopile.
- New Ember Age objectives after `smelt_copper`: `boil_water` "Boil water" (place kettle), `first_motion`
  "Set it turning" (a steam rotor running), `grind` "Grind" (a millstone job). Forge Age: `first_power`
  "Make electricity" (generate 100 W) placed after `blast_furnace`.

### 20.4 Presentation
- Axles, gearboxes, rotors, the water wheel, millstone, saw and trip hammer TURN in the world, at the network's
  speed (instanced machine parts like the wind turbine; the axle block itself is drawn by the parts renderer so
  it can spin). Steam puffs from a boiling kettle and a running rotor. Stalled shafts stop; overloaded shafts
  turn slowly and creak.
- Machine screens show the shaft network: torque supply/demand/rating, speed, members. The HUD power strip shows
  shaft power when the player stands near a shaft network.

### 20.5 DECIDED by the player: the Ember Age is the age of steam and mechanics - speed and stress
This replaces the torque-only model of 20.1 and settles decision 1 (no electricity in the Ember Age; the
thermopile moves to the Forge Age).

Two quantities on every shaft network:
- SPEED in rpm. Each source turns at its own speed (Steam Rotor 32 rpm at full steam, less with less steam;
  Water Wheel 16; Windmill 8-24 with the wind). A network runs at the speed of its fastest source; slower
  sources still add their capacity.
- STRESS: every source adds CAPACITY, every working machine adds LOAD. A machine's load = its base stress x
  (network speed / 16). If load > capacity the network is OVERSTRESSED: it seizes (speed 0, a groan, everything
  on it stops) until load is removed or capacity added. Nothing is destroyed. Capacity: Steam Rotor 256,
  Water Wheel 64 per flowing side (max 192), Windmill 32-128, Steam Engine (Forge) 1024, Steam Turbine
  (Current) 4096.
- GEARS trade speed for load: a Large Cog meshed with a Small Cog doubles speed (and every machine downstream
  then costs double stress) or halves it, depending on which side drives. Chains of gear pairs stack, capped at
  256 rpm. Axles themselves have no limit in the Ember Age; material tiers limit SPEED instead: wooden parts
  shatter-proof but capped at 64 rpm, iron 128, steel 256 (faster input is simply clamped).
- Machines have a MINIMUM speed and work faster above it (rate = speed / minimum, up to x4):
  Millstone min 16, stress 4 | Saw Bench min 32, stress 4 | Shaft Bellows min 8, stress 2 (draft grows with
  speed: 0.5 at 8 rpm to 1.0 at 64) | Mechanical Pump min 16, stress 4 (50 L/s per 16 rpm - water without
  electricity) | Mechanical Drill min 32, stress 8 (mines the column below, 1 block per 4 s at 32 rpm) |
  Trip Hammer min 16, stress 8 (bronze plates in Ember, iron and steel later) | Draft Fan min 32, stress 2
  (a blower for hearth walls, +25% smelting speed) | Dynamo (Forge) min 64, stress 16, 30 W per rpm up to 2 kW.
- Control and reading blocks: Clutch (a lever block: disconnects a shaft; Use toggles), Gearshift (reverses - only
  matters for future direction-sensitive machines; skip in v1), Flywheel (adds no capacity; keeps the network
  turning for 10 s when steam drops, so a dying fire does not seize the line), Speed Gauge and Stress Gauge
  (blocks with a needle readable in the world; the machine screens show the same numbers).
- Recipes (Ember unless noted): wooden_axle (workbench 3 plank -> 4), small_cog (workbench 2 plank, 1 stick ->
  2), large_cog (workbench 4 plank, 1 wooden_axle), bronze_gearbox (forge 700 C: 2 bronze_ingot, 1 wooden_axle;
  6-way junction), clutch (workbench: 1 wooden_axle, 1 stick, 1 cord), flywheel (forge 700 C: 4 bronze_ingot,
  1 wooden_axle), speed_gauge / stress_gauge (forge 600 C: 1 copper_ingot, 1 glass, 1 small_cog),
  mech_pump (forge 700 C: 2 bronze_ingot, 1 item_pipe, 1 small_cog), mech_drill (forge 800 C: 4 bronze_ingot,
  2 flint, 1 large_cog), draft_fan (workbench: 4 plank, 1 small_cog), others as 20.2.
- Ember objectives: boil_water - first_motion - grind - gear_up ("Gear it up": a network above 32 rpm) -
  saw_planks - auto_bellows ("Let the shaft breathe for you": shaft bellows running).

---------------------------------------------------------------------------------------------------------

## 21. The Bronze Age - pressure, pneumatics and moving heat (player request; inserts a new age)

Player: "we should have a fully separate bronze age with pneumatics and pressure mechanics and steam boilers and
steam engines etc. forge era will be more advanced smelting, heavy factory stuff/machines still. there should be
thermocouple blocks in the bronze era that can move heat when connected to a heated source".

SIX ages now: 0 Ember - 1 Bronze - 2 Forge - 3 Current - 4 Atomic - 5 Star. SIX furnace tiers:
1 Clay Furnace (800 C) - 2 Bronze Furnace (1100 C, NEW) - 3 Blast (1500) - 4 Arc (2100) - 5 Plasma (3200) -
6 Starhearth. Every existing `minTier >= 2`, tier objective, hearth structure rule and age index shifts up by one.

### 21.1 What each early age is about
- EMBER (clay furnace): fire, copper, tin, food, and SIMPLE turning: kettle + steam rotor (open, unpressurised
  steam), water wheel, windmill, wooden axles and cogs, millstone, saw bench, shaft bellows. Speed and stress.
  Ends by smelting bronze.
- BRONZE (bronze furnace): PRESSURE. Sealed boilers, steam under pressure in pipes, piston steam engines,
  compressed air and pneumatic machines, and THERMOCOUPLES that carry heat away from the furnace to where it
  is needed. No electricity.
- FORGE (blast hearth): iron and steel, the multiblock hearth, heavy factory machines (rolling mill, drop forge,
  big trip hammers, crusher), and at its end the dynamo: first electricity.

### 21.2 Bronze Furnace (tier 2)
Upgrade in place from the Clay Furnace: 8 bronze_ingot, 4 firebrick, 1 bellows at 700 C. Single block (no
structure yet - the Blast hearth is the first multiblock). 1100 C, 2 crucibles, 2 fuel slots, heat capacity 220,
loss 2.2. Recipes that move here from the old tier 1/2: bronze tools stay Ember; everything in 21.3-21.5 is made
here. Iron still needs the Blast hearth (1150 C).

### 21.3 Heat network - thermocouples
- `thermocouple` (bronze rod block, shape like a pipe: core + arms): joins a HEAT network with touching
  thermocouples, heat sources and heat users.
- Sources: a furnace or formed hearth at >= 200 C (offers heat at its temperature), lava (1300 C, 2 kW per face),
  later a fission pile jacket. Users: kettle, boiler, `hot_plate` (cooks food and dries without a furnace:
  crucible-less cooking recipes at up to the delivered temperature, 1 slot), `heat_vent` (warmth radius 6:
  heated rooms far from the furnace), `drying_rack`-free v1.
- Rule per network per tick: each user asks for watts; total drawn from the hottest source first; every
  thermocouple block in the path loses 2% (the network's delivered temperature = source temperature x
  0.98^(blocks on the shortest path), delivered watts likewise); a network carries at most 6 kW (bronze),
  later `iron_thermocouple` 20 kW. Heat drawn is added to the source furnace's heat extraction, like the kettle.
  So: the furnace is still the only origin of heat, but boilers and kitchens can stand a few blocks away.
- Touching a thermocouple carrying more than 300 C burns (1 damage/s, cause 'burn'). They glow by temperature
  (the heat ramp) - you can see heat travel.

### 21.4 Steam under pressure
- `boiler` (existing block, re-timed to Bronze): sealed vessel, heated by standing on a furnace OR by a heat
  network. Water in (bucket, pipe, mech pump). Makes steam into its STEAM NETWORK.
- Steam network = boiler(s) + `steam_pipe` (bronze; the existing hot fluid pipe becomes the steel upgrade) +
  users. State: PRESSURE in bar (0-12). Volume = 100 L per pipe + 2000 L per boiler + `steam_tank` 8000 L.
  Each tick: pressure rises with steam made / volume and falls with steam used; boilers boil faster when hot
  (rate = heatW / 2260 kJ per kg, scaled to game units: 1 kW -> 6 L/s of steam at 1 bar).
- Users need a minimum pressure and use more steam at higher pressure, giving more output:
  `steam_engine` (piston engine; mech source: rpm = 16 x bar up to 96, capacity = 128 x bar; min 2 bar),
  `steam_hammer` (direct steam trip hammer, min 4 bar), `steam_whistle` (decor/alarm), `air_compressor` (below).
- Safety: bronze boilers and pipes are rated 8 bar. `safety_valve` (set 2-8 bar with Use) vents above its
  setting with a shriek and a plume. No valve and pressure above 8 bar for 5 s -> the weakest part BURSTS
  (explosion radius 2, scalding 6 damage, the block is destroyed, a warning hiss and a shaking gauge start at
  7 bar). `pressure_gauge` block shows bar with a needle. This is the Bronze Age's signature danger.

### 21.5 Pneumatics
- `air_compressor` (mech consumer min 32 rpm, stress 8, or steam-driven): fills an AIR network (bronze
  `air_tube` + `air_tank` 4000 L) to up to 6 bar.
- Air users: `pneumatic_tube` item transport - items shoot through air tubes fast (replaces the Bronze Chute as
  the Bronze-age item pipe: 16 items per 0.5 s while the network holds >= 2 bar, each transfer uses air);
  `pneumatic_press` (plates and wire from ingots, 2 s, min 3 bar), `pneumatic_drill` (mines the column below
  2x faster than the mech drill, min 3 bar), `air_hammer` hand tool (a bronze-age power tool: mines like an iron
  pickaxe, holds 60 charges, refilled by Use on an air tank), `blast_nozzle` (hearth wall part: forced air,
  counts as two tuyeres - the reason the Blast hearth reaches 1500 C: REQUIRED for the tier 3 structure).
- Leaks: an open-ended air tube vents (hiss, pressure falls) - cap ends or close the loop.

### 21.6 Forge Age re-centred on heavy industry
Blast hearth (brick shell + at least one blast_nozzle fed with air). Iron, steel, coke. `rolling_mill`
(plates x2 yield, mech 64 rpm, stress 32, iron axles), `drop_forge` (tools and machine parts from plates
without the forge chill, steam 6 bar), crusher (shaft or steam driven), `iron_thermocouple`, steel steam pipes
(16 bar), steel axles. The age ends with the DYNAMO and copper cable: first watts, lamps, the acid battery.
The thermopile stays a Forge item.

### 21.7 Objectives (Bronze Age chain)
bronze_furnace (tier 2) - move_heat (place a thermocouple network that feeds a user) - seal_boiler (a boiler
making steam) - read_pressure (place a pressure gauge) - fit_valve (place a safety valve) - piston_power
(a steam engine turning) - compress_air (an air network at 2 bar) - pneumatic_post (an item arrives by
pneumatic tube) - press_plates (pneumatic press job) - blast_nozzle (make one) -> Forge: blast_furnace.

### 21.8 DECIDED by the owner: the Bronze Furnace stays a single block; the STEAM BOILER is the first multiblock
"bronze furnace will be what it is and the steam boiler will be the first separate multiblock". This replaces the
single-block `boiler` of 21.4 for the Bronze Age (the old one-block boiler becomes the Ember KETTLE's role only).

- Structure: a hollow cuboid of `boiler_plate` (bronze casing; forge T2 800 C: 2 bronze_plate -> 2), standing
  anywhere - it is NOT built around the furnace. Interior 1x1x2 up to 3x3x4 (x*z*y), always closed (floor, walls,
  roof). Controller: `boiler_gauge_glass` in a wall face (shows the water level in the world; Use opens the
  boiler screen). Required wall parts: >= 1 `heat_port` (a thermocouple network connects here - heat still comes
  only from the furnace or lava), >= 1 `water_port` (bucket or pipe in), >= 1 `steam_port` (steam pipe out).
  Optional in the roof: `safety_valve` (setting 2-8 bar). Glass is not allowed (pressure vessel).
- Size grants: water capacity 2000 L per interior cell; steam volume 1000 L per interior cell; heat intake limit
  6 kW per heat_port; rated pressure 8 bar (bronze plate) - iron plate later 16 bar.
- Formation: automatic, same cuboid scan and feedback as the hearth (reuse `src/sim/hearthScan.ts` by making its
  scan take a rule set: wall blocks, part kinds, interior rule, ceiling rule); active bit on formed shell
  blocks; Structure tab on the boiler screen with checklist, problems, ghost preview.
- Burst (21.4) applies to the whole vessel: above rated pressure for 5 s with no working valve -> the shell
  blows out (radius 3), the plates drop as items (half are lost), scalding 6 in radius 4.
- Running dry: heating an empty formed boiler for 20 s warps it (unforms; one plate cracks into scrap) -
  warning text and a rattle from 5 s on. Keep the water port fed (mech pump).
- Objectives: `seal_boiler` becomes "Build a steam boiler" (a formed boiler); the rest of 21.7 unchanged.
- The Forge Age Blast hearth is then the SECOND multiblock the player builds, with the same language of
  shells, ports and the Structure tab.
