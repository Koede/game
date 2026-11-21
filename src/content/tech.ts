/**
 * Technology: the five ages, the five furnace tiers (spec 2.4) and the static numbers of every machine (spec 2.5
 * and 3.3). Behaviour lives in src/sim; it reads its numbers from here through `machine(kind)` in the registry.
 */
import { BATTERY_EFFICIENCY, CRATE_SIZE, IGNITION_POWER_W, IGNITION_SECONDS, STARHEARTH_OUTPUT_W } from '../core/constants';
import type { AgeSpec, FurnaceTierSpec, MachineSpec } from '../core/types';
import { amounts } from './amounts';
import { ITEM_SPECS } from './items';

export const AGES: AgeSpec[] = [
  { key: 'ember', name: 'Ember Age', blurb: 'A clay furnace, a wood fire, and the first metal you ever poured.' },
  { key: 'forge', name: 'Forge Age', blurb: 'Iron, steel, and the first machines to share the work.' },
  { key: 'current', name: 'Current Age', blurb: 'Electricity becomes the hottest flame you own.' },
  { key: 'atomic', name: 'Atomic Age', blurb: 'Plasma, superalloy, and the power locked inside the atom.' },
  { key: 'star', name: 'Star Age', blurb: 'The furnace that began as clay is ready to hold a star.' },
];

export const FURNACE_TIERS: FurnaceTierSpec[] = [
  {
    tier: 1, block: 'furnace_clay', name: 'Clay Furnace', age: 0,
    maxTempC: 800, heatCapacityJ: 150, lossWPerC: 2, crucibles: 1, fuelSlots: 1, speed: 1, electricHeatW: 0, warmth: 6,
    upgradeCost: [], upgradeTempC: 0,
    blurb: 'Rubble and clay around a fire. It smelts tin and copper, forges bronze, and keeps the night away.',
  },
  {
    tier: 2, block: 'furnace_blast', name: 'Blast Furnace', age: 1,
    maxTempC: 1500, heatCapacityJ: 300, lossWPerC: 2.5, crucibles: 2, fuelSlots: 2, speed: 1.25, electricHeatW: 0, warmth: 8,
    upgradeCost: amounts('12 firebrick, 8 bronze_ingot, 1 bellows'), upgradeTempC: 700,
    blurb: 'Firebrick holds the heat that clay could not. Iron, steel and your first real machines come from here.',
  },
  {
    tier: 3, block: 'furnace_arc', name: 'Arc Furnace', age: 2,
    maxTempC: 2100, heatCapacityJ: 400, lossWPerC: 3, crucibles: 3, fuelSlots: 2, speed: 1.5, electricHeatW: 8000, warmth: 10,
    upgradeCost: amounts('3 graphite_electrode, 4 copper_coil, 8 steel_plate, 8 firebrick'), upgradeTempC: 1200,
    blurb: 'Cable it to your network and it heats itself with up to 8 kW, far past anything a fuel can reach.',
  },
  {
    tier: 4, block: 'furnace_plasma', name: 'Plasma Furnace', age: 3,
    maxTempC: 3200, heatCapacityJ: 800, lossWPerC: 8, crucibles: 4, fuelSlots: 2, speed: 2, electricHeatW: 40000, warmth: 12,
    upgradeCost: amounts('4 tungsten_rod, 8 steel_plate, 6 copper_coil, 3 circuit, 4 aluminum_ingot'), upgradeTempC: 1900,
    blurb: 'Plasma held by tungsten. It draws up to 40 kW, so copper cable will no longer do.',
  },
  {
    tier: 5, block: 'furnace_star', name: 'Starhearth', age: 4,
    maxTempC: 3200, heatCapacityJ: 800, lossWPerC: 8, crucibles: 4, fuelSlots: 2, speed: 3, electricHeatW: 40000, warmth: 24,
    upgradeCost: amounts('1 star_core, 8 deuterium_cell'), upgradeTempC: 3000,
    blurb: 'A star core in a furnace body. Hold 3000 C, deliver 300 kW for 90 seconds, and it will burn on its own forever.',
  },
];

/** Everything with a FuelSpec: what a furnace firebox and a burner generator accept. */
const FIREBOX_FUELS: string[] = ITEM_SPECS.filter((it) => it.fuel).map((it) => it.key);

export const MACHINE_SPECS: MachineSpec[] = [
  // furnace - one spec for all five tier blocks. Per-tier numbers are in FURNACE_TIERS and the fire model's
  // constants in core/constants. outputW is what an ignited Starhearth generates. params:
  //   ignitionTempC            temperature the Starhearth must be at before ignition may start
  //   ignitionPowerW           watts demanded while igniting, on top of electric heating
  //   ignitionSeconds          seconds of supply needed to finish
  //   ignitionMinSatisfaction  network satisfaction f below which ignition makes no progress
  //   ignitionGraceS           seconds f may stay below that before the attempt fails and resets
  //   ignitedTempC             temperature an ignited Starhearth is pinned at
  {
    kind: 'furnace', name: 'Furnace', role: 'furnace',
    blocks: ['furnace_clay', 'furnace_blast', 'furnace_arc', 'furnace_plasma', 'furnace_star'],
    outputW: STARHEARTH_OUTPUT_W,
    params: {
      ignitionTempC: 3000, ignitionPowerW: IGNITION_POWER_W, ignitionSeconds: IGNITION_SECONDS,
      ignitionMinSatisfaction: 0.95, ignitionGraceS: 2, ignitedTempC: 5000,
    },
    desc: 'Fire, forge and grid console in one. It smelts in its crucibles, forges on the spot while it is hot enough, and is upgraded in place.',
  },
  // crate - slots: storage slots. Machines with an output buffer push finished items into a touching crate.
  {
    kind: 'crate', name: 'Crate', role: 'crate', blocks: ['crate'], slots: CRATE_SIZE,
    desc: 'Holds 27 stacks. A furnace or workbench within 4 blocks uses what is inside, and machines that touch a crate unload into it.',
  },

  // ---- generators (outputW = the most one unit can ever deliver) ------------------------------
  // thermopile - watts = clamp(wattsPerC * (furnaceTempC - minTempC), 0, capW) for a furnace touching any of
  // its 6 faces. params:
  //   wattsPerC    watts per degree C the furnace is above minTempC
  //   minTempC     furnace temperature at which output starts
  //   capW         most it can deliver
  //   heatPerWatt  watts of heat taken out of the furnace per watt delivered
  {
    kind: 'thermopile', name: 'Thermopile', role: 'generator', blocks: ['thermopile'], outputW: 300,
    params: { wattsPerC: 0.25, minTempC: 100, capW: 300, heatPerWatt: 4 },
    desc: 'Makes 0.25 W for every degree a touching furnace is above 100 C, up to 300 W. It cools that furnace by four times what it delivers.',
    placementHint: 'Must touch a furnace.',
  },
  // steam_engine - same formula as the thermopile, for the furnace directly below it. params:
  //   wattsPerC, minTempC, capW, heatPerWatt   as for the thermopile
  //   minWater     water blocks needed among its 4 horizontal neighbours
  {
    kind: 'steam_engine', name: 'Steam Engine', role: 'generator', blocks: ['steam_engine'], outputW: 2000,
    params: { wattsPerC: 4, minTempC: 250, capW: 2000, heatPerWatt: 3, minWater: 1 },
    desc: 'Makes 4 W for every degree the furnace beneath it is above 250 C, up to 2 kW. It takes three times that out of the fire as heat.',
    placementHint: 'Goes on top of a furnace, with water against one of its sides.',
  },
  // burner_generator - load-following. Burns one item from its fuel slot at a time; electric joules per item =
  // fuel.energyJ * efficiency. slots: 1 fuel slot. No params.
  {
    kind: 'burner_generator', name: 'Burner Generator', role: 'generator', blocks: ['burner_generator'], outputW: 3000,
    fuels: FIREBOX_FUELS, efficiency: 0.3, slots: 1,
    desc: 'Makes up to 3 kW from any furnace fuel, turning 30% of its heat into electricity. It burns only as fast as the network draws.',
  },
  // water_wheel - params:
  //   minWater     water blocks needed among its 6 neighbours
  //   shareRadius  output is divided by the number of water wheels within this many blocks (itself included)
  {
    kind: 'water_wheel', name: 'Water Wheel', role: 'generator', blocks: ['water_wheel'], outputW: 400,
    params: { minWater: 2, shareRadius: 3 },
    desc: 'Makes a steady 400 W. Wheels within 3 blocks of each other share that between them.',
    placementHint: 'Needs water on at least two of its six sides.',
  },
  // wind_turbine - watts = outputW * wind(t) * altitude, only under open sky. params:
  //   windMin, windMax   range of the slow wind noise wind(t)
  //   altitudeBaseY, altitudeSpanY, altitudeMin, altitudeMax
  //                      altitude = clamp((y - altitudeBaseY) / altitudeSpanY, altitudeMin, altitudeMax)
  {
    kind: 'wind_turbine', name: 'Wind Turbine', role: 'generator', blocks: ['wind_turbine'], outputW: 1500,
    params: { windMin: 0.25, windMax: 1, altitudeBaseY: 40, altitudeSpanY: 40, altitudeMin: 0.25, altitudeMax: 1 },
    desc: 'Makes up to 1.5 kW as the wind rises and falls. Height matters: a quarter of that near the ground, all of it 80 blocks up.',
    placementHint: 'Needs open sky above. Higher is better.',
  },
  // solar_panel - watts = outputW * sunlight, only under open sky. params:
  //   minSunlight  sunlight factor at or below which it makes nothing (the night sky is about 0.08)
  {
    kind: 'solar_panel', name: 'Solar Panel', role: 'generator', blocks: ['solar_panel'], outputW: 300,
    params: { minSunlight: 0.1 },
    desc: 'Makes up to 300 W in full daylight, less at dawn and dusk, and nothing at night.',
    placementHint: 'Needs open sky above.',
  },
  // combustion_engine - load-following. slots: 1 fuel slot. Electric joules per canister = fuelEnergyJ * efficiency
  // (2.4 MJ, 200 s at full load). params:
  //   fuelEnergyJ  heat in one fuel canister
  {
    kind: 'combustion_engine', name: 'Combustion Engine', role: 'generator', blocks: ['combustion_engine'], outputW: 12000,
    fuels: ['fuel_canister'], efficiency: 0.4, slots: 1,
    params: { fuelEnergyJ: 6_000_000 },
    desc: 'Makes up to 12 kW. Each fuel canister gives 2.4 MJ of electricity, burned only as fast as the network draws.',
  },
  // geothermal_tap - never depletes. params:
  //   wattsPerLava  watts per lava block among its 6 neighbours
  //   capW          most it can deliver
  {
    kind: 'geothermal_tap', name: 'Geothermal Tap', role: 'generator', blocks: ['geothermal_tap'], outputW: 6000,
    params: { wattsPerLava: 2000, capW: 6000 },
    desc: 'Makes 2 kW for every lava block touching it, up to 6 kW, for as long as the lava stays.',
    placementHint: 'Must touch lava.',
  },
  // fission_pile - slots: 1 fuel rod slot; efficiency is 1 because rodEnergyJ is already electric. Cooled
  // (>= minWater water neighbours) it settles at runTempC and delivers outputW; uncooled it delivers nothing and
  // heats up. Melting down, it explodes and the pile block becomes 'corium'. params:
  //   rodEnergyJ       ELECTRIC joules in one fuel rod (60 kW for 20 minutes)
  //   minWater         water blocks needed among its 6 neighbours to count as cooled
  //   runTempC         core temperature it settles at while cooled
  //   warnTempC        at or above this: meltdown_warning alert, alarm, radiation
  //   meltdownTempC    at or above this for meltdownSeconds: meltdown
  //   meltdownSeconds  see meltdownTempC
  //   heatRateC        degrees C per second the uncooled core rises
  //   coolRateC        degrees C per second it falls once switched off or cooled again
  //   blastRadius      radius of the meltdown explosion, in blocks
  //   warnRadiation    radiation dose it emits while at or above warnTempC
  //   warnRadius       reach of that radiation, in blocks
  //   alarmIntervalS   seconds between alarm sounds while at or above warnTempC
  {
    kind: 'fission_pile', name: 'Fission Pile', role: 'generator', blocks: ['fission_pile'], outputW: 60000,
    fuels: ['fuel_rod'], efficiency: 1, slots: 1,
    params: {
      rodEnergyJ: 72_000_000, minWater: 2, runTempC: 600, warnTempC: 900, meltdownTempC: 1200, meltdownSeconds: 10,
      heatRateC: 8, coolRateC: 20, blastRadius: 3, warnRadiation: 4, warnRadius: 6, alarmIntervalS: 2,
    },
    desc: 'Makes 60 kW for twenty minutes per fuel rod. Without water on two sides the core overheats: at 900 C the alarm sounds, and ten seconds at 1200 C is a meltdown.',
    placementHint: 'Needs water on at least two of its six sides.',
  },

  // ---- storage (capacityJ, rateW = most it can charge or discharge) --------------------------
  // battery, lithium_bank - params:
  //   chargeEfficiency  fraction of charging power that ends up stored
  {
    kind: 'battery', name: 'Acid Battery', role: 'storage', blocks: ['battery'], capacityJ: 2_000_000, rateW: 3000,
    params: { chargeEfficiency: BATTERY_EFFICIENCY },
    desc: 'Stores up to 2 MJ and moves up to 3 kW in or out. A tenth of what goes in is lost.',
  },
  {
    kind: 'lithium_bank', name: 'Lithium Bank', role: 'storage', blocks: ['lithium_bank'], capacityJ: 40_000_000, rateW: 150_000,
    params: { chargeEfficiency: BATTERY_EFFICIENCY },
    desc: 'Stores up to 40 MJ and moves up to 150 kW in or out. A tenth of what goes in is lost.',
  },

  // ---- consumers (drawW = demand while working) ----------------------------------------------
  { kind: 'lamp', name: 'Lamp', role: 'consumer', blocks: ['lamp'], drawW: 10, desc: 'Draws 10 W and shines for as long as it gets it.' },
  // blower - params:
  //   draftFloor  while powered at satisfaction f, every touching furnace keeps a draft of at least draftFloor * f
  {
    kind: 'blower', name: 'Blower', role: 'consumer', blocks: ['blower'], drawW: 150,
    params: { draftFloor: 0.8 },
    desc: 'Draws 150 W and holds the draft of every furnace touching it at 80% or better.',
    placementHint: 'Must touch a furnace.',
  },
  // space_heater - params:
  //   warmRadius  blocks kept warm while powered (equals the block's warmthActive)
  {
    kind: 'space_heater', name: 'Space Heater', role: 'consumer', blocks: ['space_heater'], drawW: 300,
    params: { warmRadius: 6 },
    desc: 'Draws 300 W and keeps everything within 6 blocks warm.',
  },
  // crusher, still, centrifuge, electrolyzer - run the recipes whose station is their kind. slots: 2, slot 0 is
  // the input and slot 1 the output. Time and energy per run are on the recipe (energyJ = drawW * timeS).
  {
    kind: 'crusher', name: 'Crusher', role: 'consumer', blocks: ['crusher'], drawW: 1000, slots: 2,
    desc: 'Draws 1 kW. Every 4 seconds it grinds one block into two portions.',
  },
  {
    kind: 'still', name: 'Still', role: 'consumer', blocks: ['still'], drawW: 2000, slots: 2,
    desc: 'Draws 2 kW. Every 20 seconds it cooks two oil shale into a fuel canister.',
  },
  // bore_rig - slots: 9, the buffer its finds go to; it pauses while that is full. params:
  //   secondsPerBlock  time to mine one block of the column below it
  //   toolTier         tool tier it mines with. A block that needs more (pitchblende, corium) stops it the way
  //                    corestone does, so uranium stays behind the power drill and no ore is ground to nothing
  {
    kind: 'bore_rig', name: 'Bore Rig', role: 'consumer', blocks: ['bore_rig'], drawW: 4000, slots: 9,
    params: { secondsPerBlock: 2, toolTier: 4 },
    desc: 'Draws 4 kW. It mines the column beneath it, one block every 2 seconds, into its 9 slots. Corestone, liquid and rock too hard for steel stop it.',
  },
  {
    kind: 'centrifuge', name: 'Centrifuge', role: 'consumer', blocks: ['centrifuge'], drawW: 8000, slots: 2,
    desc: 'Draws 8 kW. Every 20 seconds it refines four yellowcake into one enriched pellet.',
  },
  // electrolyzer - params:
  //   minWater  water blocks needed among its 6 neighbours for it to run at all
  {
    kind: 'electrolyzer', name: 'Electrolyzer', role: 'consumer', blocks: ['electrolyzer'], drawW: 20000, slots: 2,
    params: { minWater: 1 },
    desc: 'Draws 20 kW. Every 45 seconds it fills an empty cell with deuterium, for as long as it touches water.',
    placementHint: 'Must touch water.',
  },

  // ---- farming (spec 12.4) --------------------------------------------------------------------
  // crop - one entity per planted crop; the stage blocks <crop>_0..3 swap in place as it grows (like a furnace
  // upgrade). No power, no screen. A crop only grows while it stands on farmland and is lit. params:
  //   stageS           seconds of growing time per stage: 3 stages from planted to ripe = 300 s
  //   dryRate          growth rate when no water is within hydrationRadius (a dry crop ripens in 600 s)
  //   hydrationRadius  water within this many blocks horizontally (|dx|, |dz| <= r), at the crop's y or y-1,
  //                    hydrates it
  //   lampRadius       a powered (active) lamp within this Euclidean distance lights it at any hour, underground too
  //   minSunlight      by day: clock sunlight at or above this with no opaque block anywhere above lights it
  {
    kind: 'crop', name: 'Crop', role: 'crop',
    blocks: ['wheat', 'potato', 'carrot'].flatMap((c) => [0, 1, 2, 3].map((stage) => `${c}_${stage}`)),
    params: { stageS: 100, dryRate: 0.5, hydrationRadius: 4, lampRadius: 5, minSunlight: 0.3 },
    desc: 'Grows a stage every 100 seconds while it has daylight or a lamp, half as fast with no water nearby.',
    placementHint: 'Plant on farmland.',
  },
];
