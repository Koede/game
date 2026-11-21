/**
 * Current Age engines on the move (docs/api/chainsaw.md, docs/api/tractor.md): the chainsaw, the tractor and its two
 * attachments. They need a combustion engine, so they sit in the same age as the Combustion Engine and the Fuel
 * Canister that feeds them (age 2 today; the six-age renumbering moves them with it: PROGRESSION "Current").
 */
import type { ItemSpec } from '../core/types';

/** Fuel units in a full chainsaw tank (the stack's durability is 1 + this), per log cut, and per Fuel Canister. */
export const SAW_TANK = 840;
export const SAW_FUEL_PER_LOG = 7;
export const SAW_CANISTER_FUEL = 420;
/** Most logs one chainsaw cut fells. */
export const SAW_MAX_LOGS = 48;

export const VEHICLE_ITEMS: ItemSpec[] = [
  {
    key: 'chainsaw', name: 'Chainsaw',
    desc: 'A two-stroke saw on a steel chain. Mine a log and the whole trunk above it falls; each log burns fuel. Press Use with a Fuel Canister to refill. Empty, it is dead weight.',
    category: 'tool', age: 2,
    tool: { kind: 'axe', tier: 5, speed: 9, durability: SAW_TANK + 1, fell: { maxLogs: SAW_MAX_LOGS, fuelPerLog: SAW_FUEL_PER_LOG, canisterFuel: SAW_CANISTER_FUEL } },
  },
  {
    key: 'tractor', name: 'Tractor',
    desc: 'A farm tractor with a combustion engine. Place it, Use it to climb aboard (W/S drive, A/D steer), feed it Fuel Canisters, fit one attachment, press F to work it.',
    category: 'machine', age: 2, stack: 1,
  },
  {
    key: 'tractor_tiller', name: 'Tractor Tiller',
    desc: 'A rotary tiller for the tractor. Press F while driving to till the grass and dirt ahead into farmland. Use it on a parked tractor to fit it.',
    category: 'component', age: 2, stack: 1,
  },
  {
    key: 'tractor_harvester', name: 'Tractor Harvester',
    desc: 'A reaping header for the tractor. Press F while driving to cut every ripe crop ahead; the grain goes to your pack, young crops stay. Use it on a parked tractor to fit it.',
    category: 'component', age: 2, stack: 1,
  },
];
