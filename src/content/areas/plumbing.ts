/**
 * Bronze Age plumbing (docs/api/plumbing.md): copper water pipes, a hand pump, a cistern and the sprinkler, simulated by
 * src/sim/waterNet.ts. A line carries water from a pond or a cistern to sprinklers over the fields and to the Water
 * Port of a steam boiler, so neither has to stand in water. Data only (src/content/area.ts).
 */
import type { AreaContent } from '../area';
import { amount, amounts } from '../amounts';

const BRONZE = 1;
const forge = (output: string, inputs: string, minTempC: number, id = amount(output).item) => ({
  id, station: 'furnace' as const, kind: 'forge' as const, inputs: amounts(inputs), output: amount(output), minTempC, minTier: 2, age: BRONZE,
});

export default {
  blocks: [
    {
      key: 'water_pipe', name: 'Copper Water Pipe', category: 'machine', age: BRONZE, shape: 'pipe', hardness: 0.5, tool: 'pickaxe',
      plumb: { role: 'pipe', volumeL: 25 },
      desc: 'A copper pipe for water. It joins every pipe, pump, cistern, sprinkler and boiler Water Port it touches; the whole line shares one store of water.',
      textures: { all: 'pipe_water' },
    },
    {
      key: 'hand_pump', name: 'Hand Pump', category: 'machine', age: BRONZE, hardness: 1.5, tool: 'pickaxe', stack: 16,
      plumb: { role: 'pump', volumeL: 20 },
      desc: 'Set it touching still water and Use it: every stroke lifts 40 L into its pipes. A workshop shaft beside it pumps on its own, half a litre a second per rpm.',
      textures: { side: 'hand_pump_side', top: 'hand_pump_top', bottom: 'hand_pump_bottom' },
    },
    {
      key: 'cistern', name: 'Cistern', category: 'machine', age: BRONZE, hardness: 1.5, tool: 'axe', stack: 16,
      plumb: { role: 'cistern', volumeL: 2000 },
      desc: 'A hooped oak tank that holds 2000 L for its water line. Left open to the sky it fills with rain.',
      textures: { side: 'cistern_side', top: 'cistern_top', bottom: 'cistern_bottom' },
    },
    {
      key: 'sprinkler', name: 'Sprinkler', category: 'machine', age: BRONZE, shape: 'pipe', hardness: 0.6, tool: 'pickaxe', stack: 32,
      plumb: { role: 'sprinkler', volumeL: 10 },
      desc: 'A brass rose on a water line. While the line holds water it waters every crop within 4 blocks, from up to 3 blocks above, under a roof too.',
      textures: { all: 'sprinkler', sideActive: 'sprinkler_on', topActive: 'sprinkler_on', bottomActive: 'sprinkler_on' },
    },
  ],
  recipes: [
    forge('8 water_pipe', '2 copper_ingot', 700, 'water_pipe'),
    forge('hand_pump', '3 copper_ingot, 1 bronze_ingot, 2 plank, 1 water_pipe', 750),
    forge('cistern', '6 plank, 2 copper_ingot, 1 water_pipe', 600),
    forge('2 sprinkler', '1 bronze_ingot, 2 water_pipe', 750, 'sprinkler'),
  ],
} satisfies AreaContent;
