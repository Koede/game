/**
 * The power grid overlay's in-world tools (docs/api/grid-overlay.md): the Grid Meter, held, draws every wire and machine
 * of the grids around you coloured by load and reads a network out when used on it; the Grid Monitor is a powered block
 * that does the same for its own network, with a screen of supply, load, losses and a minute of history. Data only.
 */
import type { AreaContent } from '../area';
import type { BlockSpec, ItemSpec, MachineSpec, RecipeSpec } from '../../core/types';
import { amount, amounts } from '../amounts';

/** What the monitor draws to keep its lens lit: a trickle that never tips a grid into brown-out. */
export const MONITOR_DRAW_W = 5;

const meter: ItemSpec = {
  key: 'grid_meter', name: 'Grid Meter', category: 'tool', age: 0, stack: 1,
  // The texture budget is full (spec maxTextures): borrows the vein lens until the meter gets its own icon.
  icon: 'item_vein_lens',
  desc: 'Held, it paints the cables and machines of nearby grids green, amber or red by load. Use it on a cable or machine to read that network out.',
};

const monitorBlock: BlockSpec = {
  key: 'grid_monitor', name: 'Grid Monitor', age: 1,
  desc: 'A meter set into a block. Wired into a network it shows supply, load and losses on its screen, and while you are within 12 blocks of it the grid lights up for you.',
  machine: 'grid_monitor', power: 'device', hardness: 2, tool: 'pickaxe', stack: 16, lightActive: 8,
  // Borrows the lamp's faces (texture budget): a lit panel reads as a display.
  textures: { side: 'lamp', sideActive: 'lamp_on', top: 'machine_top' },
};

const monitorMachine: MachineSpec = {
  kind: 'grid_monitor', name: 'Grid Monitor', role: 'consumer', blocks: ['grid_monitor'], drawW: MONITOR_DRAW_W,
  desc: 'Draws 5 W. Its screen shows what the whole network makes, wants and loses; near it, the grid overlay lights up.',
};

const forge = (output: string, inputs: string, minTempC: number, minTier: number): RecipeSpec => ({
  id: output, station: 'furnace', kind: 'forge', inputs: amounts(inputs), output: amount(output), minTempC, minTier, age: minTier - 1,
});

export default {
  items: [meter],
  blocks: [monitorBlock],
  machines: [monitorMachine],
  recipes: [
    forge('grid_meter', '2 copper_wire, 1 glass, 1 tin_ingot', 500, 1),
    forge('grid_monitor', '1 grid_meter, 2 copper_cable, 1 glass, 2 copper_ingot', 700, 2),
  ],
} satisfies AreaContent;
