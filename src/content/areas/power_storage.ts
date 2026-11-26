/**
 * The cell rack: a mid-size store between the acid battery (2 MJ, 3 kW) and the lithium bank (40 MJ, 150 kW). Ten MJ at
 * 20 kW carries an arc-age workshop's lights, blower and heater through a whole night. Behaves exactly like the other
 * storage blocks (src/sim/power.ts); its charge shows on the machine screen and the grid monitor.
 */
import type { AreaContent } from '../area';
import type { BlockSpec, MachineSpec, RecipeSpec } from '../../core/types';
import { amount, amounts } from '../amounts';
import { BATTERY_EFFICIENCY } from '../../core/constants';

const block: BlockSpec = {
  key: 'cell_rack', name: 'Cell Rack', age: 3,
  desc: 'A steel frame of linked acid cells: 10 MJ, released as fast as 20 kW. Enough to run a workshop through the night.',
  machine: 'cell_rack', power: 'device', oriented: true, hardness: 2, tool: 'pickaxe', stack: 16, category: 'block',
  textures: { side: 'machine_side', top: 'machine_top', front: 'battery_front', frontActive: 'battery_front_on' },
};

const machine: MachineSpec = {
  kind: 'cell_rack', name: 'Cell Rack', role: 'storage', blocks: ['cell_rack'], capacityJ: 10_000_000, rateW: 20_000,
  params: { chargeEfficiency: BATTERY_EFFICIENCY },
  desc: 'Stores up to 10 MJ and moves up to 20 kW in or out. A tenth of what goes in is lost.',
};

const recipe: RecipeSpec = {
  id: 'cell_rack', station: 'furnace', kind: 'forge', inputs: amounts('3 battery, 2 steel_plate, 1 copper_coil'),
  output: amount('1 cell_rack'), minTempC: 1800, minTier: 4, age: 3,
};

export default { blocks: [block], machines: [machine], recipes: [recipe] } satisfies AreaContent;
