/**
 * Glass and optics (docs/api/optics.md): glass ground into lenses, a hand spyglass, a tripod telescope and the lighthouse
 * lamp. Data only (src/content/area.ts). The rules live in src/game/optics.ts (zoom, spotting, the sky watch), the lamp's
 * behaviour in src/sim/machines.ts (lighthouseLamp) and its ward in src/sim/safeZones.ts; the beam is drawn by
 * src/render/beams.ts and the coastal lighthouses are generated in src/world/lighthouses.ts.
 */
import type { AreaContent } from '../area';
import type { RecipeSpec } from '../../core/types';
import { amount, amounts } from '../amounts';

const BRONZE = 1;
const forge = (minTier: number, output: string, inputs: string, minTempC: number, id = amount(output).item): RecipeSpec => ({
  id, station: 'furnace', kind: 'forge', inputs: amounts(inputs), output: amount(output), minTempC, minTier, age: minTier - 1,
});

/** Burn rate of the lighthouse lamp (W): a lump of coal (800 kJ) lasts eight minutes, charcoal four. */
export const LIGHTHOUSE_LAMP_W = 1700;
/** Blocks round a lit lighthouse lamp where no automaton spawns or walks. */
export const LIGHTHOUSE_WARD_RADIUS = 28;

export default {
  items: [
    {
      key: 'lens', name: 'Ground Lens', category: 'material', age: 0, stack: 64,
      desc: 'Glass ground smooth with sand into a clear, curved lens. Two make a spyglass; more make a telescope or a lighthouse lamp.',
    },
    {
      key: 'spyglass', name: 'Spyglass', category: 'tool', age: BRONZE, stack: 1,
      desc: 'A bronze tube with a lens at each end. Use it to look through (four times closer) and again to lower it. Hold it on a far landmark to spot it: it goes in your Hearth Log.',
    },
  ],
  blocks: [
    {
      key: 'telescope', name: 'Telescope', category: 'machine', age: BRONZE, hardness: 1.2, tool: 'axe', stack: 16,
      desc: 'A long brass telescope on a wooden tripod. Use it to look ten times closer and spot landmarks far off. At night under open sky it reads the weather coming in the stars.',
      textures: { top: 'telescope_top', side: 'telescope_side', bottom: 'plank' },
    },
    {
      key: 'lighthouse_lamp', name: 'Lighthouse Lamp', category: 'machine', age: BRONZE, hardness: 1.5, tool: 'pickaxe', stack: 16,
      machine: 'lighthouse_lamp', power: 'device', lightActive: 15,
      desc: 'A great lamp in a ring of turning lenses. Fed coal or charcoal, its beam sweeps the dark and keeps automatons 28 blocks off. High on a shore it is a lighthouse.',
      textures: { top: 'lighthouse_lamp_top', bottom: 'lighthouse_lamp_top', side: 'lighthouse_lamp_side', sideActive: 'lighthouse_lamp_side_on' },
    },
  ],
  machines: [
    {
      // Not on any network (like the kerosene lamp): it burns one lump at a time from its slot while switched on. The output
      // is nominal, availW stays 0. params: lampW burn rate, radius of the ward while lit.
      kind: 'lighthouse_lamp', name: 'Lighthouse Lamp', role: 'generator', blocks: ['lighthouse_lamp'], outputW: 1,
      fuels: ['coal', 'charcoal', 'coke'], efficiency: 1, slots: 1,
      params: { lampW: LIGHTHOUSE_LAMP_W, radius: LIGHTHOUSE_WARD_RADIUS },
      desc: 'Burns coal, charcoal or coke for a sweeping beam and a 28-block ward against automatons. Coal lasts eight minutes.',
    },
  ],
  recipes: [
    forge(1, 'lens', '1 glass, 1 sand', 600),
    forge(2, 'spyglass', '2 lens, 2 bronze_ingot, 1 leather', 700),
    forge(2, 'telescope', '3 lens, 3 bronze_ingot, 3 stick', 700),
    forge(2, 'lighthouse_lamp', '4 lens, 4 bronze_ingot, 2 glass, 1 coal', 800),
  ],
} satisfies AreaContent;
