/**
 * What the player takes from the Emberbound and what they make to fight back (spec 19.4): scrap and ember cores,
 * the mauls, armour worn from the pack, and the ward beacon. The automatons themselves are in automatons.ts.
 */
import { WARD_BEACON_RADIUS } from '../core/constants';
import type { BlockSpec, ItemSpec, MachineSpec } from '../core/types';

/**
 * A maul: a weapon that never mines faster (tool kind 'maul', speed 1: no block is a maul's to break, so it counts
 * as bare hands). Durability like the tools of its metal; every hit on a creature wears it by 1.
 */
function maul(material: string, name: string, tier: number, durability: number, age: number, damage: number, desc: string, stunS?: number): ItemSpec {
  return {
    key: `${material}_maul`, name: `${name} Maul`, desc, category: 'tool', age,
    tool: { kind: 'maul', tier, speed: 1, durability },
    weapon: stunS === undefined ? { damage } : { damage, stunS },
  };
}

export const EMBER_ITEMS: ItemSpec[] = [
  {
    key: 'scrap_metal', name: 'Scrap Metal', category: 'material', age: 0,
    desc: 'Bent plate and rivets torn from an automaton. The old smiths\' iron is still good: a Blast Furnace smelts it back into ingots.',
  },
  {
    key: 'ember_core', name: 'Ember Core', category: 'fuel', age: 0, stack: 16,
    desc: 'The still-burning heart of an automaton. It fuels a furnace at 1700 C for two minutes, and relic machines are built around it.',
    fuel: { energyJ: 3_000_000, burnS: 120, flameTempC: 1700 },
  },
  maul('bronze', 'Bronze', 2, 192, 0, 5,
    'A heavy bronze head on a short haft, made for denting plate, not digging: 5 damage a blow, and it breaks no stone faster than a fist.'),
  maul('iron', 'Iron', 3, 384, 2, 7, 'Iron, squared and weighted. 7 damage a blow: automaton plate buckles under it.'),
  maul('steel', 'Steel', 4, 768, 2, 9, 'A steel maul balanced for long fights: 9 damage a blow, and it outlasts two iron ones.'),
  maul('arc', 'Arc', 4, 1200, 3, 12,
    'A steel maul with an ember core and a battery in its head. 12 damage, and the arc locks an automaton\'s joints for a second.', 1),
  {
    key: 'plated_coat', name: 'Plated Coat', category: 'misc', age: 2, stack: 1,
    desc: 'A padded coat sewn with iron plates. Carried, it takes a quarter off every automaton blow and keeps you as warm as the coat.',
    armour: { reduction: 0.25, warmthDrainMult: 0.5 },
  },
  {
    key: 'steel_cuirass', name: 'Steel Cuirass', category: 'misc', age: 2, stack: 1,
    desc: 'Steel plate over a padded lining. Carried, it takes 40% off every automaton blow and still keeps out the cold.',
    armour: { reduction: 0.4, warmthDrainMult: 0.5 },
  },
];

export const EMBER_BLOCKS: BlockSpec[] = [
  {
    // Not oriented: a beacon looks the same from every side. Lit while powered, which also keeps spawns off the spot.
    key: 'ward_beacon', name: 'Ward Beacon', age: 3,
    desc: 'Glass and circuitry around two ember cores. Powered, it keeps automatons from waking within 32 blocks, and the rest stay away.',
    machine: 'ward_beacon', power: 'device', hardness: 2, tool: 'pickaxe', stack: 16, lightActive: 10,
    textures: { side: 'ward_beacon_side', top: 'ward_beacon_top', bottom: 'machine_top', sideActive: 'ward_beacon_side_on', topActive: 'ward_beacon_top_on' },
  },
];

export const EMBER_MACHINES: MachineSpec[] = [
  // ward_beacon - a consumer: while it gets power (network satisfaction above BROWNOUT_STALL) its active bit is set,
  // no automaton spawns within `radius` blocks of it and hostiles avoid that radius like a warm zone. params:
  //   radius  blocks (Euclidean, horizontal and vertical alike) it guards
  {
    kind: 'ward_beacon', name: 'Ward Beacon', role: 'consumer', blocks: ['ward_beacon'], drawW: 500,
    params: { radius: WARD_BEACON_RADIUS },
    desc: 'Draws 500 W. While powered, no automaton spawns within 32 blocks of it, and those already abroad keep their distance.',
  },
];
