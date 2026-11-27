/**
 * The telegraph and radio network (docs/api/telegraph.md): poles carry a copper line between telegraph offices, an office
 * hears storm warnings and the town's news and orders from the caravan by wire, and from the Current Age a powered radio
 * mast joins far-off networks without poles. Data only (src/content/area.ts); the rules are src/game/telegraph.ts.
 */
import type { AreaContent } from '../area';
import { amount, amounts } from '../amounts';

const BRONZE = 1;
const CURRENT = 3;
/** A furnace forge recipe of tier `tier` (the age is tier - 1, docs/api/ages.md). */
const forge = (tier: number, output: string, inputs: string, minTempC: number, id = amount(output).item) => ({
  id, station: 'furnace' as const, kind: 'forge' as const, inputs: amounts(inputs), output: amount(output), minTempC, minTier: tier, age: tier - 1,
});

export default {
  blocks: [
    {
      key: 'telegraph_pole', name: 'Telegraph Pole', category: 'machine', age: BRONZE, shape: 'fence', hardness: 0.8, tool: 'axe',
      desc: 'A tarred pole. Its copper line reaches every pole, office or mast within 12 blocks, so a row of them wires one place to another. Stack them for height.',
      textures: { all: 'telegraph_pole' },
    },
    {
      key: 'telegraph_office', name: 'Telegraph Office', category: 'machine', age: BRONZE, oriented: true, hardness: 1.5, tool: 'axe', lightActive: 3,
      desc: 'A sounder and brass key on a desk. Use it to read the wire: storm warnings, news from town and orders to the caravan. It also sends and receives workshop signals.',
      textures: { side: 'plank', top: 'plank', bottom: 'plank', front: 'telegraph_office_front', frontActive: 'telegraph_office_front_on' },
    },
    {
      key: 'radio_mast', name: 'Radio Mast', category: 'machine', age: CURRENT, shape: 'fence', hardness: 2, tool: 'pickaxe', lightActive: 4,
      desc: 'A steel lattice with a spark gap. Fed 100 W by a cable beside it, it talks to every powered mast within 160 blocks, no poles needed, and hears storms further ahead.',
      textures: { all: 'radio_mast', sideActive: 'radio_mast_on', topActive: 'radio_mast_on', bottomActive: 'radio_mast_on' },
    },
  ],
  recipes: [
    forge(2, '4 telegraph_pole', '2 oak_log, 2 copper_wire, 1 glass', 600, 'telegraph_pole'),
    forge(2, 'telegraph_office', '4 plank, 4 copper_wire, 2 bronze_plate', 800),
    forge(4, 'radio_mast', '4 steel_plate, 2 copper_coil, 1 circuit', 1200),
  ],
} satisfies AreaContent;
