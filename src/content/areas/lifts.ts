/**
 * Bridges, lifts and elevators (docs/api/lifts.md): ways across cliffs and down mineshafts, driven by the workshop's
 * shafts (steam engine, mill wheel, clockwork motor).
 *
 *  - Lift Winch (Bronze): stands at the lip of a shaft or a cliff edge and hangs a timber cage in the open column beside
 *    it, up to 40 blocks deep. Tap the cage to call it or ride it; it stops at every landing (a tunnel or ledge off the shaft).
 *  - Steam Elevator (Forge): the iron version: a chain-hung iron cage, 160 blocks of chain, twice as fast.
 *  - Drawbridge: while its shaft turns it runs a deck of planks out of its front (up to 16 blocks) or winds it back in.
 *    Use it to choose which way; a lever beside it decides instead (lit = out).
 *  - Bridge Deck: the plank slab a drawbridge lays, also made by hand for footbridges.
 * Data only (src/content/area.ts). The behaviour is src/workshop/lifts.ts and src/workshop/drawbridge.ts.
 */
import type { AreaContent } from '../area';
import type { BlockSpec, RecipeSpec } from '../../core/types';
import { amount, amounts } from '../amounts';

const BRONZE = 1;
const FORGE = 2;

const forge = (output: string, inputs: string, minTempC: number, minTier: number, age: number): RecipeSpec => ({
  id: amount(output).item, station: 'furnace', kind: 'forge', inputs: amounts(inputs), output: amount(output), minTempC, minTier, age,
});

const winch = (key: string, name: string, age: number, desc: string): BlockSpec => ({
  key, name, desc, category: 'machine', age, hardness: 1.5, tool: 'pickaxe', minTier: 0, stack: 16, oriented: true,
  textures: { side: key, sideActive: `${key}_on`, top: 'ws_hopper_top', bottom: 'ws_machine_side', front: key, frontActive: `${key}_on`, status: true },
});

const blocks: BlockSpec[] = [
  winch('lift_winch', 'Lift Winch', BRONZE,
    'A rope drum for a timber lift cage. Set it at the lip of a shaft or cliff with a turning shaft beside it; the cage hangs in the open column next to it. 40 blocks of rope.'),
  winch('elevator_winch', 'Steam Elevator', FORGE,
    'A chain winch for an iron mine cage: 160 blocks of chain, twice the lift\'s speed. Set it at the lip of a mineshaft; it stops at every tunnel off the shaft.'),
  {
    key: 'drawbridge', name: 'Drawbridge', category: 'machine', age: BRONZE, hardness: 1.5, tool: 'pickaxe', minTier: 0, stack: 16, oriented: true,
    desc: 'While its shaft turns it runs a plank deck out across the gap ahead of you, up to 16 blocks, or winds it back. Use it to pick which; a lit lever beside it means out.',
    textures: { side: 'ws_machine_side', top: 'ws_hopper_top', bottom: 'ws_machine_side', front: 'drawbridge_front', frontActive: 'drawbridge_front_on', status: true },
  },
  {
    key: 'bridge_deck', name: 'Bridge Deck', category: 'block', age: 0, shape: 'slab', opaque: false, solid: true, hardness: 1, tool: 'axe', oriented: true,
    desc: 'Lashed planks half a block thick, to walk across a gap. A drawbridge lays and lifts its own.',
    textures: { top: 'bridge_deck', side: 'plank', bottom: 'plank' },
  },
];

const recipes: RecipeSpec[] = [
  { id: 'bridge_deck', station: 'hand', inputs: amounts('3 plank, 1 fiber'), output: amount('6 bridge_deck'), age: 0 },
  forge('lift_winch', '2 bronze_plate, 1 bronze_cog, 1 drive_shaft, 2 cord, 4 plank', 600, 2, BRONZE),
  forge('drawbridge', '2 bronze_plate, 1 bronze_cog, 1 drive_shaft, 6 bridge_deck', 600, 2, BRONZE),
  forge('elevator_winch', '4 iron_plate, 2 iron_axle, 1 bronze_cog, 1 lift_winch', 1000, 3, FORGE),
];

export default {
  blocks,
  recipes,
} satisfies AreaContent;
