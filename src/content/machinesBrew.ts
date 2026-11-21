/** Machines of brewing (BREWING_PLAN 4, 11.3): two wild plants, the cup setup, a bucket on a furnace and the kettle. */
import { GLASS_TOP_BLOCK_KEYS } from './itemsGlass';
import { BOIL_DRY_SECONDS, BOIL_SECONDS, BOIL_TEMP_C, BREW_SECONDS, BREW_STEAM_S, KETTLE_BOIL_C, TEA_REGROW_S } from '../core/constants';
import { CUP_BLOCK } from '../core/brewing';
import type { MachineSpec } from '../core/types';

export const BREW_MACHINES: MachineSpec[] = [
  // tea_bush, coffee_shrub - like berry_bush (role 'bush'): picking the fruiting block leaves the bare one, which fruits
  // again after params.regrowS. Cuttings plant the bare block.
  {
    kind: 'tea_bush', name: 'Tea Bush', role: 'bush', blocks: ['tea_bush', 'tea_bush_bare'], params: { regrowS: TEA_REGROW_S },
    desc: 'A tea bush that leafs again six minutes after it is picked, wherever it stands.', placementHint: 'Plant on grass, dirt, peat or farmland.',
  },
  {
    kind: 'coffee_shrub', name: 'Coffee Shrub', role: 'bush', blocks: ['coffee_shrub', 'coffee_shrub_bare'], params: { regrowS: TEA_REGROW_S },
    desc: 'A coffee shrub that fruits again six minutes after it is picked, wherever it stands.', placementHint: 'Plant on grass, dirt, peat or farmland.',
  },
  // brew_cup - one entity per cup setup, all five stage blocks (src/core/brewing.ts CUP_BLOCK). params:
  //   brewS       seconds boiling water drips before the cup is done
  //   steamS      seconds a finished cup steams
  //   dripEveryS  seconds between two drip sounds while brewing
  {
    kind: 'brew_cup', name: 'Clay Cup', role: 'brew', blocks: Object.values(CUP_BLOCK),
    params: { brewS: BREW_SECONDS, steamS: BREW_STEAM_S, dripEveryS: 0.5 },
    desc: 'A clay cup with a drip cone: load the cone, pour boiling water over it, wait four seconds and take the cup.',
  },
  // boil_bucket - one entity per container set on a furnace top. params:
  //   boilC          heats while the furnace under it is at or above this
  //   boilS          seconds of full heating before it boils (the sim speeds this up with the furnace's temperature)
  //   dryS           seconds boiling before it boils dry and the empty bucket comes back
  //   heatDrawW      watts it draws from the furnace while heating, boilingDrawW while boiling
  {
    kind: 'boil_bucket', name: 'Bucket on the Furnace', role: 'brew', blocks: ['furnace_bucket', 'furnace_bucket_boiling', ...GLASS_TOP_BLOCK_KEYS],
    params: { boilC: BOIL_TEMP_C, boilS: BOIL_SECONDS, dryS: BOIL_DRY_SECONDS, heatDrawW: 600, boilingDrawW: 300 },
    desc: 'A bucket of water set on a hot furnace comes to the boil in seconds. Pick up the boiling water to brew with it.',
  },
  // kettle - a pot that holds water and boils it on a furnace (no steam power). The voxel's active bit is set while it boils.
  //   boilC      boils while the furnace under it is at or above this
  //   capacityL  litres of water it holds
  //   fillL      litres a water container pours in
  //   drainL     litres an empty container takes out as boiling water, once it is boiling
  //   heatDrawW  watts it draws from the furnace while it holds water
  {
    kind: 'kettle', name: 'Kettle Pot', role: 'brew', blocks: ['kettle_pot'],
    params: { boilC: KETTLE_BOIL_C, capacityL: 4000, fillL: 1000, drainL: 1000, heatDrawW: 600 },
    desc: 'Set it on the furnace and pour water in. Once it boils, an empty bucket takes out boiling water.',
    placementHint: 'Stands on top of a furnace.',
  },
];
