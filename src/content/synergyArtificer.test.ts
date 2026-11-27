import { describe, expect, it } from 'vitest';
import { item } from '../core/registry';
import { RESEARCH } from '../magic/entries';
import { INFUSIONS } from './recipesMagic';

const PLAIN: Array<[string, string]> = [];
for (const metal of ['bronze', 'iron']) for (const kind of ['pickaxe', 'axe', 'shovel']) PLAIN.push([metal, kind]);

describe("the artificer's attuned tools", () => {
  it('are the plain tool scaled: rune keeps the edge three times as long, gale cuts half as fast again', () => {
    for (const [metal, kind] of PLAIN) {
      const base = item(`${metal}_${kind}`).tool!;
      const rune = item(`rune_${metal}_${kind}`).tool!;
      const gale = item(`gale_${metal}_${kind}`).tool!;
      expect(rune).toMatchObject({ kind, tier: base.tier, speed: base.speed, durability: base.durability * 3 });
      expect(gale).toMatchObject({ kind, tier: base.tier, speed: base.speed * 1.5, durability: base.durability });
    }
  });

  it('are made only at the altar, from the plain tool and two vials of their aspect, behind research', () => {
    for (const [metal, kind] of PLAIN) {
      for (const aspect of ['rune', 'gale']) {
        const id = `${aspect}_${metal}_${kind}`;
        const row = INFUSIONS.find((r) => r.id === id);
        expect(row, id).toBeDefined();
        expect(row!.center).toBe(`${metal}_${kind}`);
        expect(row!.around).toEqual([`vial_${aspect}`, `vial_${aspect}`]);
        expect(row!.output.item).toBe(id);
        const gate = RESEARCH.find((e) => e.unlocks.recipes?.includes(id));
        expect(gate?.key, id).toBe(metal === 'bronze' ? 'attunement' : 'master_attunement');
        // A tempered tool belongs to the age of its plain tool's attunement, never earlier.
        expect(item(id).age).toBe(metal === 'bronze' ? 1 : 2);
      }
    }
  });
});
