/**
 * The small steam loop (docs/BRONZE_PLAN.md first half, docs/STEAM_PLAN.md section 2, docs/advice/tech-spine.md K1-K6):
 * a Copper Steam Kettle on the furnace boils water into open steam, a Steam Rotor on top of it turns the workshop's
 * shafts at 16 rpm for 4 stress units (one millstone, the machine twin of the hand quern). Boiler Plate and the Safety
 * Valve are the first pieces of the sealed boiler to come; they are craftable now and inert until the boiler multiblock.
 * Data only (src/content/area.ts). The kettle shares the brewing kettle machine, the rotor is a workshop part.
 */
import type { AreaContent } from '../area';
import { amount, amounts } from '../amounts';

const BRONZE = 1;
const TOPS = ['furnace_clay', 'furnace_bronze', 'furnace_blast', 'furnace_arc', 'furnace_plasma', 'furnace_star', 'brick', 'refractory_brick', 'plasma_casing', 'star_casing'];
const forge = (output: string, inputs: string, minTempC: number, id = amount(output).item) => ({
  id, station: 'furnace' as const, kind: 'forge' as const, inputs: amounts(inputs), output: amount(output), minTempC, minTier: 2, age: BRONZE,
});

export default {
  blocks: [
    {
      key: 'steam_kettle', name: 'Copper Steam Kettle', category: 'misc', age: BRONZE, shape: 'bucket', solid: false, hardness: 0.6, tool: 'pickaxe', machine: 'kettle', placeOn: TOPS,
      desc: 'A copper drum on the furnace. Pour water in by the bucket; boiling, it gives open steam. A Steam Rotor on top turns a shaft beside it.',
      textures: { all: 'steam_kettle', sideActive: 'steam_kettle_on', topActive: 'steam_kettle_on', status: true },
    },
    {
      key: 'boiler_gauge_glass', name: 'Gauge Glass', category: 'machine', age: BRONZE, hardness: 1.2, tool: 'pickaxe', minTier: 0, machine: 'boiler_vessel',
      desc: 'Set in the wall of a sealed boiler. Shows water and pressure; Use it with a full water bucket to fill the boiler.',
      textures: { all: 'boiler_gauge_glass' },
    },
    {
      key: 'heat_port', name: 'Heat Port', category: 'block', age: BRONZE, hardness: 2, tool: 'pickaxe', minTier: 0,
      desc: 'A boiler wall part. A furnace touching it on the outside passes 10 kW into the boiler.',
      textures: { all: 'heat_port' },
    },
    {
      key: 'water_port', name: 'Water Port', category: 'machine', age: BRONZE, hardness: 2, tool: 'pickaxe', minTier: 0, machine: 'boiler_vessel',
      desc: 'A boiler wall part. Water touching it on the outside flows in at 20 L/s; Use it with a full bucket to pour.',
      textures: { all: 'water_port' },
    },
    {
      key: 'steam_port', name: 'Steam Port', category: 'block', age: BRONZE, hardness: 2, tool: 'pickaxe', minTier: 0,
      desc: 'A boiler wall part. Steam Pipes touching it on the outside carry the steam to engines.',
      textures: { all: 'steam_port' },
    },
    {
      key: 'steam_pipe', name: 'Bronze Steam Pipe', category: 'block', age: BRONZE, hardness: 1.5, tool: 'pickaxe', minTier: 0,
      desc: 'A bronze pipe. A run of them from a Steam Port to a Beam Engine shares the boiler pressure; each adds 100 L of steam room.',
      textures: { all: 'steam_pipe' },
    },
    {
      key: 'steam_tank', name: 'Steam Receiver', category: 'block', age: BRONZE, hardness: 2, tool: 'pickaxe', minTier: 0,
      desc: 'A bronze drum on a boiler steam line. It adds 8000 L of steam room, so pressure moves slowly and engines ride out the peaks.',
      textures: { all: 'steam_tank' },
    },
    {
      key: 'boiler_plate', name: 'Boiler Plate', category: 'block', age: BRONZE, hardness: 2, tool: 'pickaxe', minTier: 0,
      desc: 'A riveted bronze shell plate, rated for 8 bar. Close a box of them round two empty cells, with a Gauge Glass in the wall, and it is a boiler.',
      textures: { all: 'boiler_plate' },
    },
    {
      key: 'safety_valve', name: 'Safety Valve', category: 'machine', age: BRONZE, hardness: 1.2, tool: 'pickaxe', minTier: 0, machine: 'boiler_vessel',
      desc: 'A spring valve in the wall of a boiler. It vents steam above its setting; Use it to cycle 2, 4, 6 or 8 bar.',
      textures: { top: 'safety_valve_top', side: 'safety_valve', bottom: 'boiler_plate' },
    },
  ],
  machines: [
    {
      kind: 'boiler_vessel', name: 'Boiler', role: 'brew', blocks: ['boiler_gauge_glass', 'safety_valve', 'water_port'], params: { ratedBar: 8, heatW: 10000, steamPerCellL: 1000 },
      desc: 'A sealed box of Boiler Plate round two or more empty cells, with a Gauge Glass in the wall. A furnace under its floor heats it.',
      placementHint: 'Set it in the wall of a closed boiler of plates.',
    },
  ],
  recipes: [
    forge('steam_tank', '6 bronze_plate, 1 steam_pipe', 900),
    forge('heat_port', '2 bronze_plate, 2 bronze_ingot', 800),
    forge('water_port', '2 bronze_plate, 1 pail', 800),
    forge('steam_port', '2 bronze_plate, 1 steam_pipe', 800),
    forge('6 steam_pipe', '2 bronze_plate', 800, 'steam_pipe'),
    forge('boiler_gauge_glass', '2 bronze_plate, 2 glass', 800),
    forge('steam_kettle', '4 copper_ingot, 2 bronze_plate', 600),
    forge('2 boiler_plate', '2 bronze_plate', 800, 'boiler_plate'),
    forge('safety_valve', '2 bronze_ingot, 1 cord, 1 bronze_cog', 900),
  ],
  objectives: [
    {
      id: 'place_steam_kettle', title: 'Set a steam kettle', age: BRONZE, condition: { type: 'place', block: 'steam_kettle', count: 1 },
      text: 'Forge a Copper Steam Kettle and stand it on top of the Bronze Furnace. Pour water in by the bucket; when the furnace is hot it boils.',
    },
    {
      id: 'place_steam_rotor', title: 'Turn a shaft with steam', age: BRONZE, condition: { type: 'place', block: 'steam_rotor', count: 1 },
      text: 'Put a Steam Rotor on the boiling kettle (or on the wall of a boiler) and a drive shaft beside it. It turns at 16 rpm and carries one millstone (4 stress units): no hand on the crank.',
    },
    {
      id: 'place_beam_engine', title: 'Run a beam engine', age: BRONZE, condition: { type: 'place', block: 'beam_engine', count: 1 },
      text: 'Fit a Steam Port in the boiler wall, run Steam Pipes to a Beam Engine and a shaft beside it. From 2 bar it turns 16 rpm per bar. The Heat Port takes heat from a furnace beside it.',
    },
    {
      id: 'place_boiler', title: 'Build a steam boiler', age: BRONZE, condition: { type: 'place', block: 'boiler_gauge_glass', count: 1 },
      text: 'Close a box of Boiler Plate round two empty cells, a furnace under its floor, a Gauge Glass in the wall and a Safety Valve. Pour water in by the bucket. Watch the needle: valve before 8 bar.',
    },
  ],
  objectivesAfter: 'make_bronze_cog',
} satisfies AreaContent;
