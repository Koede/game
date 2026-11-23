/**
 * Dyeing, staining and furniture (docs/api/decor.md): six dyes ground at the mortar, planks boiled in a dye at the
 * furnace into stained planks, and a table, a bench and a bookshelf from the workbench. Data only.
 */
import type { AreaContent } from '../area';
import type { BlockSpec, ItemSpec, RecipeSpec } from '../../core/types';
import { amount, amounts } from '../amounts';

const age = 0;
/** Colour key, display name and what is ground to make one portion of its dye (two dyes from the plant). */
export const DYES: readonly { key: string; name: string; from: string }[] = [
  { key: 'red', name: 'Red', from: 'wildberries' },
  { key: 'yellow', name: 'Yellow', from: 'carrot' },
  { key: 'blue', name: 'Blue', from: 'crushed_tin' },
  { key: 'green', name: 'Green', from: 'fiber' },
  { key: 'black', name: 'Black', from: 'charcoal' },
  { key: 'white', name: 'White', from: 'flour' },
];

const dyeItems: ItemSpec[] = DYES.map((d) => ({
  key: `${d.key}_dye`, name: `${d.name} Dye`, desc: `A pinch of ${d.name.toLowerCase()} pigment. Boil it with planks in the furnace to stain them.`, category: 'material', age,
}));
const stainBlocks: BlockSpec[] = DYES.map((d) => ({
  key: `${d.key}_stained_plank`, name: `${d.name} Stained Planks`, desc: `Planks stained ${d.name.toLowerCase()}. Builds like planks, for decorating.`,
  hardness: 1.5, tool: 'axe', category: 'block', textures: { all: `${d.key}_stained_plank` },
}));
const furniture: BlockSpec[] = [
  { key: 'dining_table', name: 'Dining Table', desc: 'A low plank table. Set a few round the hearth and the room feels lived in.', shape: 'slab', hardness: 1, tool: 'axe', category: 'block', textures: { all: 'dining_table' } },
  { key: 'plank_bench', name: 'Plank Bench', desc: 'A long bench to sit on and set things down by.', shape: 'slab', hardness: 1, tool: 'axe', category: 'block', textures: { all: 'plank_bench' } },
  { key: 'bookshelf', name: 'Bookshelf', desc: 'Shelves of planks, stuffed with spare cloth bound as books.', hardness: 1.2, tool: 'axe', category: 'block', textures: { all: 'bookshelf' } },
];

export default {
  items: dyeItems,
  blocks: [...stainBlocks, ...furniture],
  recipes: [
    ...DYES.map((d): RecipeSpec => ({ id: `${d.key}_dye`, station: 'mortar', inputs: amounts(`1 ${d.from}`), output: amount(`2 ${d.key}_dye`), strokes: 4, age })),
    ...DYES.map((d): RecipeSpec => ({
      id: `${d.key}_stained_plank`, station: 'furnace', kind: 'forge', inputs: amounts(`4 plank, 1 ${d.key}_dye`), output: amount(`4 ${d.key}_stained_plank`), minTempC: 100, minTier: 1, age,
    })),
    { id: 'dining_table', station: 'workbench', inputs: amounts('4 plank, 2 stick'), output: amount('1 dining_table'), age },
    { id: 'plank_bench', station: 'workbench', inputs: amounts('3 plank, 2 stick'), output: amount('1 plank_bench'), age },
    { id: 'bookshelf', station: 'workbench', inputs: amounts('6 plank, 3 cloth'), output: amount('1 bookshelf'), age },
  ],
} satisfies AreaContent;
