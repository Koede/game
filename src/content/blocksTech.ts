/**
 * Blocks of item and fluid transport (spec 16) and multiblock hearths (spec 17), appended after every older block so
 * saved voxel ids never move.
 *
 * Hearth walls and parts have an "_on" texture with glowing seams: a formed hearth sets the active bit of every
 * shell block (src/sim), on all six faces. Pipes have no active texture: the active bit means "carrying something"
 * and is a subtle tint for the mesher to apply, not a second tile (the texture array is nearly full).
 */
import type { BlockSpec, PipeSpec } from '../core/types';

/**
 * A pipe: shape 'pipe' (walk-through like a cable), mined fast with a pickaxe, one plus-shaped tile. Tiles are named
 * `pipe_*` because `item_*` names are reserved for item icons.
 */
function pipe(key: string, tile: string, name: string, desc: string, age: number, spec: PipeSpec): BlockSpec {
  return { key, name, desc, age, shape: 'pipe', pipe: spec, hardness: 0.4, tool: 'pickaxe', category: 'machine', textures: { all: tile } };
}

/** A machine in the shared casing with its own front, idle and working. */
function casedMachine(key: string, name: string, desc: string, age: number, extra: Partial<BlockSpec> = {}): BlockSpec {
  return {
    key, name, desc, age, machine: key, oriented: true, hardness: 2, tool: 'pickaxe', stack: 16,
    textures: { side: 'machine_side', top: 'machine_top', front: `${key}_front`, frontActive: `${key}_front_on` },
    ...extra,
  };
}

/** A block of a hearth's shell: the same tile on every face, and its glowing-seam twin while the hearth is formed. */
function shell(key: string, name: string, desc: string, age: number, hardness: number, extra: Partial<BlockSpec> = {}, tile = key): BlockSpec {
  const on = `${tile}_on`;
  return {
    key, name, desc, age, hardness, tool: 'pickaxe',
    textures: { all: tile, sideActive: on, topActive: on, bottomActive: on },
    ...extra,
  };
}

export const TECH_BLOCKS: BlockSpec[] = [
  // ---- pipes (spec 16.1) ----
  pipe('item_pipe', 'pipe_item', 'Bronze Chute', 'A bronze tube for items. Every 2 seconds a pulling end sends up to 4 items on their way at 4 blocks a second.', 0,
    { family: 'item', ratePerS: 0.5, batch: 4, speedBlocksPerS: 4 }),
  pipe('fast_item_pipe', 'pipe_item_fast', 'Steel Conveyor Pipe', 'A steel conveyor that moves up to 16 items every half second at 10 blocks a second.', 2,
    { family: 'item', ratePerS: 2, batch: 16, speedBlocksPerS: 10 }),
  pipe('fluid_pipe', 'pipe_fluid', 'Iron Fluid Pipe', 'Carries water, crude oil and fuel, 200 litres a second through each end. Lava and steam are too hot for it.', 2,
    { family: 'fluid', ratePerS: 200, capacityL: 250 }),
  pipe('hot_fluid_pipe', 'pipe_fluid_hot', 'Steel Hot Pipe', 'An insulated steel pipe for any fluid, lava and steam included, 1000 litres a second through each end.', 2,
    { family: 'fluid', ratePerS: 1000, capacityL: 250, hot: true }),

  // ---- fluid machines (spec 16.1, 16.5) ----
  casedMachine('pump', 'Pump', 'Draws the still liquid it touches into its pipes. Water with two sources beside it never runs dry; a lone source, lava and oil are used up.', 2, { power: 'device' }),
  {
    key: 'tank', name: 'Tank', desc: 'Holds 16 000 litres of one fluid. Tanks stacked on top of each other share one level.',
    machine: 'tank', hardness: 2, tool: 'pickaxe', stack: 16, age: 2, textures: { side: 'tank_side', top: 'tank_top' },
  },
  casedMachine('boiler', 'Boiler', 'Set on top of a furnace or hearth, it boils piped water into steam with the fire beneath it.', 2),
  casedMachine('steam_turbine', 'Steam Turbine', 'Spins 800 litres of steam a second into 8 kW. Feed it through a hot pipe.', 3, { power: 'device' }),

  // ---- hearth walls (spec 17.1-17.2) ----
  shell('refractory_brick', 'Refractory Brick', 'Brick baked hard with coke. It walls an Arc hearth and holds any lesser one.', 2, 5),
  shell('plasma_casing', 'Plasma Casing', 'Steel, aluminum and tungsten plate for the walls of a Plasma hearth.', 3, 6),
  shell('star_casing', 'Star Casing', 'Superalloy and fused quartz around magnet rings: the only wall that can hold a star.', 4, 8),

  // ---- hearth parts ----
  shell('electrode', 'Arc Electrode', 'A graphite arc set in the ceiling of a hearth. An Arc hearth needs at least one.', 2, 3),
  shell('item_hatch', 'Item Hatch', 'A door in a hearth wall for pipes: fuel goes to the firebox, ores to the crucibles, and finished metal comes out.', 2, 2,
    { machine: 'item_hatch', stack: 16 }, 'hatch_item'),
  shell('fluid_hatch', 'Fluid Hatch', 'A port in a hearth wall that takes piped lava as fuel: 1000 litres burn like a lava bucket.', 2, 2,
    { machine: 'fluid_hatch', stack: 16 }, 'hatch_fluid'),
  shell('power_port', 'Power Port', 'Brings cable power through a hearth wall to the furnace. Plasma and Star hearths need them.', 3, 2,
    { machine: 'power_port', power: 'device', stack: 16 }),
];
