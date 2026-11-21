/**
 * Current Age engines on the move (docs/api/chainsaw.md, docs/api/tractor.md): the chainsaw, the tractor and its two
 * attachments. They need a combustion engine, so they sit in the same age as the Combustion Engine and the Fuel
 * Canister that feeds them (age 2 today; the six-age renumbering moves them with it: PROGRESSION "Current").
 */
import type { ItemSpec } from '../core/types';

/** Fuel units in a full chainsaw tank (the stack's durability is 1 + this), per log cut, and per Fuel Canister. */
export const SAW_TANK = 240;
export const SAW_FUEL_PER_LOG = 2;
export const SAW_CANISTER_FUEL = 120;
/** Most logs one chainsaw cut fells. */
export const SAW_MAX_LOGS = 48;

export const VEHICLE_ITEMS: ItemSpec[] = [
  {
    key: 'chainsaw', name: 'Chainsaw',
    desc: 'A small two-stroke engine driving a steel chain. Mine a log and the whole trunk above it comes down, fast; every log burns a little fuel. Hold a Fuel Canister and press Use to refill the tank. Empty, it is dead weight.',
    category: 'tool', age: 2,
    tool: { kind: 'axe', tier: 3, speed: 9, durability: SAW_TANK + 1, fell: { maxLogs: SAW_MAX_LOGS, fuelPerLog: SAW_FUEL_PER_LOG, canisterFuel: SAW_CANISTER_FUEL } },
  },
  {
    key: 'tractor', name: 'Tractor',
    desc: 'A small farm tractor on a combustion engine. Set it on open ground, Use it to climb aboard (W/S drive, A/D steer, Use to get off), feed it Fuel Canisters while parked, and fit an attachment. It carries one attachment; press F to work it.',
    category: 'machine', age: 2, stack: 1,
  },
  {
    key: 'tractor_tiller', name: 'Tractor Tiller',
    desc: 'A rotary tiller for the tractor. Press F while driving to till the grass and dirt under and ahead of the machine into farmland. Use it on a parked tractor to fit it.',
    category: 'component', age: 2, stack: 1,
  },
  {
    key: 'tractor_harvester', name: 'Tractor Harvester',
    desc: 'A reaping header for the tractor. Press F while driving to cut every ripe crop under and ahead of the machine; the grain goes straight into your pack and young crops are left standing. Use it on a parked tractor to fit it.',
    category: 'component', age: 2, stack: 1,
  },
];
