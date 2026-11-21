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
coal_ore 20-70, 5 x 8 | copper_ore 16-60, 4 x 6 (dunes x2) | tin_ore 30-66, 2.5 x 5 | limestone 22-52, 1.5 x 14 |
iron_ore 6-46, 4 x 6 | sulfur_ore 4-34, 1 x 5 (scar x3) | oil_shale 10-40, 1 x 8 (dunes x2, scar x2) |
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
Interact ("use") priority: station/machine block under the crosshair opens its screen; else item-specific use
(pail); else place the held block item.

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
