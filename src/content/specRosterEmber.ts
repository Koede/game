/**
 * Test fixture: the roster of spec section 19 (the Emberbound automatons), typed in a second time from the design
 * document. specRoster.ts merges its blocks, items, fuels, machines and block properties into the section 2 roster;
 * emberbound.test.ts checks the rest. Nothing but the tests imports this file.
 */
import type { BlockDef, Drop, HostileAttack, MachineRole } from '../core/types';

type Numbers = Record<string, number>;

/** One row of table 19.1 as the spec states it. */
interface AutomatonRow {
  name: string;
  health: number;
  speed: number;
  attack: HostileAttack;
  damage: number;
  /** The wind-up the spec names (where it names one). */
  windupS?: number;
  /** The attack period the spec names (where it names one). */
  cooldownS?: number;
  /** The range the spec names (where it names one). */
  range?: number;
  drops: Drop[];
}

export const EMBER_SPEC = {
  blocks: ['ward_beacon'],

  items: ['scrap_metal', 'ember_core', 'bronze_maul', 'iron_maul', 'steel_maul', 'arc_maul', 'plated_coat', 'steel_cuirass'],

  /** item -> [energyJ, burnS, flameTempC]. */
  fuels: { ember_core: [3_000_000, 120, 1700] } as Record<string, number[]>,

  blockProps: {
    ward_beacon: { machine: 'ward_beacon', power: 'device', tool: 'pickaxe', minTier: 0, shape: 'cube' },
  } as Record<string, Partial<BlockDef>>,

  machines: {
    ward_beacon: ['consumer', { drawW: 500, radius: 32 }],
  } as Record<string, [MachineRole, Numbers]>,

  /** Table 19.1. */
  automatons: {
    cinder_mite: {
      name: 'Cinder Mite', health: 4, speed: 3.2, attack: 'melee', damage: 1, cooldownS: 0.8,
      drops: [{ item: 'scrap_metal', count: 1, chance: 0.5 }],
    },
    forge_warden: {
      name: 'Forge Warden', health: 16, speed: 2.4, attack: 'melee', damage: 3, windupS: 0.5,
      drops: [{ item: 'scrap_metal', count: [1, 3] }, { item: 'copper_coil', count: 1, chance: 0.1 }, { item: 'circuit', count: 1, chance: 0.04 }],
    },
    kiln_sentry: {
      name: 'Kiln Sentry', health: 12, speed: 0, attack: 'bolt', damage: 2, windupS: 0.7, cooldownS: 3, range: 16,
      drops: [{ item: 'ember_core', count: 1 }, { item: 'scrap_metal', count: [1, 2] }],
    },
    bellows_hound: {
      name: 'Bellows Hound', health: 10, speed: 4.5, attack: 'dash', damage: 4, windupS: 0.8,
      drops: [{ item: 'scrap_metal', count: [1, 2] }, { item: 'ember_core', count: 1, chance: 0.25 }],
    },
    arc_drone: {
      name: 'Arc Drone', health: 8, speed: 3, attack: 'zap', damage: 2, windupS: 0.6, range: 8,
      drops: [{ item: 'scrap_metal', count: 1 }, { item: 'copper_wire', count: 2, chance: 0.2 }, { item: 'silicon_wafer', count: 1, chance: 0.08 }],
    },
    slag_colossus: {
      name: 'Slag Colossus', health: 60, speed: 1.6, attack: 'slam', damage: 6, windupS: 1.2, range: 3,
      drops: [
        { item: 'superalloy', count: 1 }, { item: 'ember_core', count: 3 }, { item: 'magnet_ring', count: 1, chance: 0.3 },
        { item: 'scrap_metal', count: [4, 8] },
      ],
    },
  } as Record<string, AutomatonRow>,

  /** Spec 19.4: weapon -> [damage, stunS or 0]. */
  weapons: { bronze_maul: [5, 0], iron_maul: [7, 0], steel_maul: [9, 0], arc_maul: [12, 1] } as Record<string, [number, number]>,

  /** Spec 19.4: armour -> [reduction, warmthDrainMult]; the padded coat is gear of the same kind. */
  armour: { padded_coat: [0, 0.5], plated_coat: [0.25, 0.5], steel_cuirass: [0.4, 0.5] } as Record<string, [number, number]>,

  /** Spec 19.4: "Relic drops (coil, circuit, wafer, superalloy, magnet ring) are existing items." */
  relics: ['copper_coil', 'circuit', 'silicon_wafer', 'superalloy', 'magnet_ring'],
};
