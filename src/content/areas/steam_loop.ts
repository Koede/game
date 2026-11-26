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
      textures: { all: 'steam_kettle', sideActive: 'steam_kettle_on', topActive: 'steam_kettle_on' },
    },
    {
      key: 'boiler_plate', name: 'Boiler Plate', category: 'block', age: BRONZE, hardness: 2, tool: 'pickaxe', minTier: 0,
      desc: 'A riveted bronze shell plate, rated for 8 bar. The walls of the sealed boiler are built from it; the boiler itself comes later in the age.',
      textures: { all: 'boiler_plate' },
    },
    {
      key: 'safety_valve', name: 'Safety Valve', category: 'block', age: BRONZE, hardness: 1.2, tool: 'pickaxe', minTier: 0,
      desc: 'A spring valve that vents steam above its set pressure (2, 4, 6 or 8 bar). It belongs on the roof of the sealed boiler, which comes later in the age.',
      textures: { top: 'safety_valve_top', side: 'safety_valve', bottom: 'boiler_plate' },
    },
  ],
  recipes: [
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
      text: 'Put a Steam Rotor on the boiling kettle and a drive shaft beside it. It turns at 16 rpm and carries one millstone (4 stress units): no hand on the crank.',
    },
  ],
  objectivesAfter: 'make_bronze_cog',
} satisfies AreaContent;
