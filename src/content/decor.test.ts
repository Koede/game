import { describe, expect, it } from 'vitest';
import { blockOrNull, itemOrNull, recipe } from '../core/registry';
import { DYES } from './areas/decor';

describe('dyes, stains and furniture', () => {
  it('every colour has a dye, a mortar recipe, a stained block and a forge recipe from planks', () => {
    for (const d of DYES) {
      expect(itemOrNull(`${d.key}_dye`), d.key).not.toBeNull();
      expect(recipe(`${d.key}_dye`)).toMatchObject({ station: 'mortar', output: { item: `${d.key}_dye`, count: 2 } });
      expect(blockOrNull(`${d.key}_stained_plank`)).not.toBeNull();
      const r = recipe(`${d.key}_stained_plank`)!;
      expect(r.station).toBe('furnace');
      expect(r.inputs.map((i) => i.item)).toEqual(['plank', `${d.key}_dye`]);
    }
  });

  it('furniture is made at the workbench from planks', () => {
    for (const k of ['dining_table', 'plank_bench', 'bookshelf']) {
      expect(blockOrNull(k), k).not.toBeNull();
      expect(recipe(k)!.station).toBe('workbench');
      expect(recipe(k)!.inputs.some((i) => i.item === 'plank')).toBe(true);
    }
  });
});
