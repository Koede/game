/**
 * The guided path from bare hands to an ignited Starhearth (spec 2.7), in order. The tracker shows the first
 * objective that is not complete. `age` is the age the player is in while working on it, so the objective that
 * asks for a furnace upgrade still belongs to the age that upgrade ends.
 *
 * Rewards are small conveniences the player could already have made; content.test.ts checks that none of them
 * hands out anything from further up the tree.
 */
import { FLAG_AUTOMATON_SALVAGED, FLAG_DROVE_TRACTOR, FLAG_FELLED_TREE, FLAG_PEACEFUL } from '../core/constants';
import type { ObjectiveCondition, ObjectiveSpec } from '../core/types';
import { amounts } from './amounts';
import { withAreaObjectives } from './area';
import { BREW_OBJECTIVES } from './objectivesBrew';
import { HAND_OBJECTIVES } from './objectivesHand';
import { WORKSHOP_OBJECTIVES } from './objectivesWorkshop';

const make = (item: string, count = 1): ObjectiveCondition => ({ type: 'make', item, count });
const have = (item: string, count = 1): ObjectiveCondition => ({ type: 'have', item, count });
const place = (block: string): ObjectiveCondition => ({ type: 'place', block, count: 1 });
const flag = (name: string): ObjectiveCondition => ({ type: 'flag', flag: name });
const furnaceTier = (tier: number): ObjectiveCondition => ({ type: 'furnaceTier', tier });
const furnaceTemp = (tempC: number): ObjectiveCondition => ({ type: 'furnaceTemp', tempC });
const generate = (watts: number): ObjectiveCondition => ({ type: 'generate', watts });
/** Done by doing it, or by playing on Peaceful, where there are no automatons to do it with (spec 19.3). */
const orPeaceful = (c: ObjectiveCondition): ObjectiveCondition => ({ type: 'any', of: [c, flag(FLAG_PEACEFUL)] });

function objective(age: number, id: string, title: string, condition: ObjectiveCondition, text: string, reward?: string): ObjectiveSpec {
  return reward ? { id, title, text, condition, age, reward: amounts(reward) } : { id, title, text, condition, age };
}

const BASE_OBJECTIVES: ObjectiveSpec[] = [
  // ---- Ember Age -----------------------------------------------------------------------------
  objective(0, 'gather_logs', 'Gather wood',
    { type: 'any', of: [{ type: 'break', block: 'oak_log', count: 4 }, { type: 'break', block: 'pine_log', count: 4 }] },
    'Break four oak logs or four pine logs. Bare hands are slow, but they work. Wood is your first fuel and your first building material.'),
  HAND_OBJECTIVES.choppingBlock,
  objective(0, 'make_planks', 'Split planks', make('plank', 4),
    'Strike a log on the chopping block, stroke by stroke: it splits into four planks (six with an axe in hand).'),
  objective(0, 'place_workbench', 'Set up a workbench', place('workbench'),
    'Make a workbench from six planks and put it down. It is only for cold work; its real job is to build your first furnace.'),
  objective(0, 'find_flint', 'Find flint', have('flint', 3),
    'Dig gravel until you carry three flints. About one block in four hides one.'),
  objective(0, 'make_pickaxe', 'Make a flint pickaxe', make('flint_pickaxe'),
    'Twist fiber from leaves or tall grass into cord, strike a plank on the chopping block for sticks, and bind a flint pickaxe. Without one, stone gives you nothing.'),
  objective(0, 'collect_rubble', 'Quarry rubble', have('rubble', 12),
    'Mine stone with the pickaxe until you carry twelve rubble for the furnace walls.'),
  objective(0, 'collect_clay', 'Dig clay', have('clay', 6),
    'Dig six blocks of clay to line the furnace. It is most often found where land meets water.'),
  objective(0, 'place_furnace', 'Build your furnace', place('furnace_clay'),
    'Make a Clay Furnace at the workbench and set it where you want your home to be. You return to your furnace when things go wrong, and everything you build will grow around it.',
    '4 torch'),
  objective(0, 'light_furnace', 'Light the fire', flag('furnace_lit'),
    'Open the furnace, put sticks, planks or logs in the firebox and light it. Watch the temperature climb.'),
  objective(0, 'make_charcoal', 'Bake charcoal', make('charcoal', 4),
    'Load logs into the crucible. Above 300 C they bake into charcoal, a fuel that burns at 1000 C.'),
  objective(0, 'get_warm', 'Warm yourself', flag('well_warmed'),
    'Stay close to the furnace while it is above 400 C. After a few seconds you are Well-Warmed: you mine faster and the cold bites half as hard.'),
  objective(0, 'cook_food', 'Cook a meal',
    { type: 'any', of: [make('cooked_fowl'), make('cooked_mutton'), make('cooked_chop'), make('baked_potato')] },
    'Hunt a hen, goat or boar, or pull up a wild potato, and load it into a crucible. Above 200 C it cooks in seconds.'),
  objective(0, 'eat_food', 'Eat', flag('ate'),
    'Hold the food and press Use. Cooked food fills you far more than raw, and a full stomach lets you heal.'),
  HAND_OBJECTIVES.clayTable,
  HAND_OBJECTIVES.fireMould,
  objective(0, 'smelt_copper', 'Smelt copper', make('copper_ingot', 2),
    'Copper ore needs 700 C. Burn charcoal, or pump the bellows over a log fire, and smelt two ingots.'),
  HAND_OBJECTIVES.firstPour,
  HAND_OBJECTIVES.quern,
  objective(0, 'till_soil', 'Till the soil', flag('tilled'),
    'Bind a flint hoe from flint, sticks and cord, then use it on the top of grass or dirt to turn it into farmland.',
    '4 wheat_seeds'),
  objective(0, 'plant_seeds', 'Plant wheat', place('wheat_0'),
    'Use wheat seeds on farmland. Wheat grows in daylight, twice as fast with water within four blocks, and takes a few minutes: carry on with the furnace meanwhile. Tall grass and wild wheat give more seed.'),
  HAND_OBJECTIVES.grindFlour,
  objective(0, 'bake_bread', 'Bake bread', make('bread'),
    'Harvest four ripe wheat and grind them into flour on the hand quern. Mix the flour with a bucket of water into dough, and bake it in a crucible at 220 C.'),
  ...BREW_OBJECTIVES,
  HAND_OBJECTIVES.anvil,
  HAND_OBJECTIVES.hammerPlate,
  objective(0, 'reach_800', 'Master the bellows', flag('bellows_pumped'),
    'Open the furnace and pump the bellows (the Pump button, or P). A strong draft burns fuel faster and runs up to 250 C hotter, so a log fire reaches what only charcoal could. Bronze needs 800 C, the most a Clay Furnace can take.'),
  objective(0, 'make_bronze', 'Forge bronze', make('bronze_ingot', 4),
    'Smelt tin, set an Alloy Pot against the furnace (fire one from clay first), and melt three copper and one tin ingot into four bronze at 800 C, as hot as a Clay Furnace can get. Pour it into the ingot mould.'),
  HAND_OBJECTIVES.castHead,
  objective(0, 'forge_maul', 'Forge a maul', make('bronze_maul'),
    'The old machines of the Old Works still walk at night. Cast a maul head, then bind it to two sticks with cord at the workbench: it digs nothing, but it breaks automaton plate.'),
  objective(0, 'bronze_pickaxe', 'Forge a bronze pickaxe', make('bronze_pickaxe'),
    'Bind the cast head to two sticks with cord at the workbench. A bronze pickaxe opens iron ore, sulfur and oil shale, and lasts three times as long as flint.'),
  objective(0, 'salvage_automaton', 'Salvage an automaton', orPeaceful(flag(FLAG_AUTOMATON_SALVAGED)),
    'After dark the old machines wake in caves and ruins. When an automaton\'s embers flare it is about to strike: step out of reach, then hit back. Its scrap smelts into iron. On Peaceful this completes by itself.'),
  HAND_OBJECTIVES.dryingRack,
  HAND_OBJECTIVES.leather,
  HAND_OBJECTIVES.loom,
  objective(0, 'bronze_furnace', 'Build the Bronze Furnace', furnaceTier(2),
    'Open the furnace screen and the upgrade list: eight bronze ingots, four firebrick and a bellows, with the fire at 700 C. Bronze plates round the firebox hold 1100 C and two crucibles. It ends the Ember Age.',
    '4 coal, 1 belt_pouch'),

  // ---- Bronze Age ----------------------------------------------------------------------------
  ...WORKSHOP_OBJECTIVES,
  objective(1, 'blast_furnace', 'Build the Blast Furnace', furnaceTier(3),
    'Build a Blast hearth: brick walls around the furnace, with a floor and one empty cell behind its mouth (the STRUCTURE tab shows where each brick goes). Then open the upgrade panel: it asks for bronze, a bellows and a fire of at least 700 C.',
    '8 coal, 1 hand_vacuum'),

  // ---- Forge Age -----------------------------------------------------------------------------
  objective(2, 'pipe_ore', 'Pipe it in', place('item_pipe'),
    'Forge Bronze Chutes and a Wrench. Lay the chutes from a crate to the furnace and wrench the crate end so it pulls: ore and fuel flow in on their own.'),
  objective(2, 'smelt_iron', 'Smelt iron', make('iron_ingot', 8),
    'Iron ore needs 1150 C. Coal burns hot enough on its own, and charcoal does with a strong draft.'),
  objective(2, 'make_steel', 'Forge steel', make('steel_ingot', 6),
    'Bake coal into coke at 1000 C and mine some limestone. Iron, coke and limestone forge into steel at 1400 C: coke reaches that by itself, coal needs a strong draft.'),
  objective(2, 'make_iron_axle', 'Turn iron axles', make('iron_axle', 2),
    'Forge an iron ingot into two iron axles at 1000 C. They are the spines of heavy machines: a rolling mill and a dynamo are both built on one.'),
  objective(2, 'place_rolling_mill', 'Build a rolling mill', place('rolling_mill'),
    'Forge a Chassis, iron plate and iron axles into a Rolling Mill. Stand it over a Basin of ingots on a shaft line turning 64 rpm or more (a ratio dial will get a crank there): two ingots come out as two plates, where a press gave one.',
    '4 iron_plate'),
  objective(2, 'place_drop_forge', 'Build a drop forge', place('drop_forge'),
    'Forge steel plate and steel axles into a Drop Forge. Over a Basin on a line turning 32 rpm or more it makes chassis and copper coils with no fire.'),
  objective(2, 'place_dynamo', 'Fit a dynamo', place('dynamo'),
    'Forge two copper coils, an iron axle and iron plate into a Dynamo and join it to a shaft line. It wants 64 rpm and makes 30 W for every rpm, up to 2 kW. A Thermopile against the furnace also works, at a trickle.'),
  objective(2, 'first_power', 'Make electricity', generate(100),
    'Turn the dynamo: a hand crank through a ratio dial, or any source you can get to 64 rpm. Lines turned by a water wheel or an engine make their own watts and give the dynamo nothing. A Thermopile set against the furnace makes a quarter of a watt for every degree above 100 C.',
    '6 copper_cable'),
  objective(2, 'place_lamp', 'Light a lamp', place('lamp'),
    'Forge copper wire and glass into a Lamp. Run cable from the dynamo to it and it shines while the shaft turns.'),
  objective(2, 'place_crusher', 'Build a crusher', place('crusher'),
    'Forge iron plates, a copper coil and a chassis, add four flints for the jaws, and forge a Crusher. It needs 1 kW: a Burner Generator beside it will do.'),
  objective(2, 'machine_job', 'Crush some ore', flag('machine_job'),
    'Give the crusher power and a stack of ore. Every block comes out as two portions, doubling your metal.',
    '1 crate'),
  objective(2, 'generate_2kw', 'Generate 2 kW', generate(2000),
    'Raise your total generation to 2 kW. A Steam Engine on top of the furnace, a Burner Generator or a few well-spaced Water Wheels will get you there.'),
  objective(2, 'store_energy', 'Store 1 MJ', { type: 'stored', joules: 1_000_000 },
    'Forge an Acid Battery from iron, copper and sulfur, connect it, and let your generators fill it to 1 MJ. Stored power carries you through the gaps.'),
  objective(2, 'arc_furnace', 'Build the Arc Furnace', furnaceTier(4),
    'Rebuild the hearth in refractory brick with a full ceiling and an Arc Electrode in it. The upgrade then asks for copper coils and steel plate, with the fire at 1200 C. After it, the furnace heats itself with electricity.',
    '12 copper_cable, 1 plated_coat'),

  // ---- Current Age ---------------------------------------------------------------------------
  objective(3, 'pump_water', 'Pump water', place('pump'),
    'Forge a Pump and set it against still water - a pond two blocks wide never runs dry. Wire it to power, lay Iron Fluid Pipe to a Tank or a machine, and wrench the pump end so it pulls.'),
  objective(3, 'reach_1900', 'Reach 1900 C', furnaceTemp(1900),
    'Only ember cores under a strong draft burn this hot. Cable the Arc Furnace to your network instead, switch on its electric heating and supply about 6 kW.'),
  objective(3, 'make_circuits', 'Make circuits', make('circuit', 2),
    'Crush quartz into silica, forge silicon wafers at 1700 C, and wire each one into a circuit.'),
  objective(3, 'ward_base', 'Ward your base', orPeaceful(place('ward_beacon')),
    'Forge a Ward Beacon from two ember cores, a circuit, steel plate and glass, and give it power: no automaton wakes within 32 blocks of it. On Peaceful this completes by itself.'),
  objective(3, 'fell_tree', 'Fell a tree', flag(FLAG_FELLED_TREE),
    'Forge a Chainsaw at the Arc Furnace, fill its tank with a Fuel Canister from the Still (hold the canister, press Use), and Mine a log: the whole trunk comes down at once.'),
  objective(3, 'drive_tractor', 'Take a tractor out', flag(FLAG_DROVE_TRACTOR),
    'Forge a Tractor and a Tiller, set the tractor on open ground, feed it Fuel Canisters, fit the tiller and climb aboard. Drive over grass and press F to till it; a Harvester reaps ripe crops the same way.'),
  objective(3, 'generate_10kw', 'Generate 10 kW', generate(10000),
    'Grow your grid to 10 kW. Wind turbines, solar panels, geothermal taps and combustion engines are all forged at the Arc Furnace.'),
  objective(3, 'make_tungsten', 'Sinter tungsten', make('tungsten_rod', 4),
    'Wolframite lies deep and yields only to steel. Crush it and smelt the powder at 2000 C into four tungsten rods.'),
  objective(3, 'plasma_furnace', 'Build the Plasma Furnace', furnaceTier(5),
    'Build a Plasma hearth: 53 plasma casings (six come from each batch of 2 steel plate, 1 aluminum and 1 tungsten rod) around at least two by two by two empty cells, with two Power Ports in its walls. The upgrade asks for circuits and tungsten at 1900 C. It draws up to 40 kW, more than copper cable can carry.',
    '12 heavy_cable, 1 steel_cuirass'),

  // ---- Atomic Age ----------------------------------------------------------------------------
  objective(4, 'make_superalloy', 'Forge superalloy', make('superalloy', 8),
    'At 2600 C steel, tungsten and aluminum fuse into superalloy. Holding that heat takes about 21 kW over heavy cable.'),
  objective(4, 'place_fission_pile', 'Build a fission pile', place('fission_pile'),
    'Forge a Fission Pile and set it down with water on at least two of its sides. Never let it run dry.',
    '2 water_pail, 1 shield_suit'),
  objective(4, 'generate_60kw', 'Generate 60 kW', generate(60000),
    'Forge a Power Drill to mine pitchblende, crush it, enrich it in a centrifuge and seal the pellets into a fuel rod. One rod runs the pile at 60 kW for twenty minutes.'),
  objective(4, 'make_deuterium', 'Bottle deuterium', make('deuterium_cell', 4),
    'Forge empty cells from aluminum and feed them to an Electrolyzer that touches water. It draws 20 kW for 45 seconds a cell.'),
  objective(4, 'make_star_core', 'Forge the star core', make('star_core'),
    'Three magnet rings, superalloy, fused quartz and circuits, brought together at 3000 C. This is the hardest thing you will ever forge.'),
  objective(4, 'starhearth', 'Build the Starhearth', furnaceTier(6),
    'Build a Star hearth of 93 star casings around three by three by three empty cells, with four Power Ports. Six casings come from each batch of 2 superalloy and 1 fused quartz, so plan on 16 batches: about 32 superalloy. Hold it at 3000 C and give it the star core and four deuterium cells.'),

  // ---- Star Age ------------------------------------------------------------------------------
  objective(5, 'ignite', 'Ignite the Starhearth', flag('ignited'),
    'Ignition needs 300 kW for 90 seconds without a flicker, with the furnace at 3000 C. Lay super cable, fill your lithium banks, and light your star.'),
  objective(5, 'star_armor', 'Arm yourself in superalloy', make('superalloy_hauberk'),
    'The star burns. Now wear what it made: forge a superalloy hauberk at the Arc Furnace, the heaviest coat in the world.',
    '4 superalloy'),
  objective(5, 'star_maul', 'Forge the superalloy maul', make('superalloy_maul'),
    'Three superalloy, a magnet ring, a battery and two sticks make a maul that stuns whatever it hits.',
    '2 superalloy'),
  objective(5, 'star_bank', 'Bank 75 MJ', { type: 'stored', joules: 75_000_000 },
    'Keep the star lit for the long run: fill your batteries to 75 MJ so the Starhearth never flickers.'),
];

/** The goals in order: the lists above plus each area's (content/areas), placed after their `objectivesAfter`. */
export const OBJECTIVES: ObjectiveSpec[] = withAreaObjectives(BASE_OBJECTIVES);
