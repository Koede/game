import { describe, expect, it } from 'vitest';
import { setup } from './testKit';
import { jarsFor } from './essentiaNet';
import { arcaneRecipe } from '../content/recipesMagic';
import { RESEARCH_GATES } from './gates';

function linked() {
  const t = setup();
  t.hold('glass');
  t.put(0, 1, 0, 'linked_mirror');
  t.put(50, 1, 0, 'linked_mirror');
  expect(t.magic.use(t.at(0, 1, 0))).toBe('worked');
  expect(t.magic.mirrorText(0, 1, 0)).toMatch(/marked/);
  expect(t.magic.use(t.at(50, 1, 0))).toBe('worked');
  return t;
}

describe('linked mirrors', () => {
  it('are made in pairs at the desk, gated by research', () => {
    expect(arcaneRecipe('linked_mirror')?.output.count).toBe(2);
    expect(RESEARCH_GATES.has('linked_mirror')).toBe(true);
  });

  it('two Uses link a pair; the text says who sends', () => {
    const t = linked();
    expect(t.magic.mirrorText(0, 1, 0)).toBe('Linked Mirror - sends items to 50, 1, 0');
    expect(t.magic.mirrorText(50, 1, 0)).toBe('Linked Mirror - receives from 0, 1, 0');
  });

  it('essentia lines they touch join across the distance, for jars and desks', () => {
    const t = linked();
    t.put(0, 1, 1, 'essentia_jar');
    t.put(50, 2, 0, 'rune_desk');
    // a desk touching mirror B reaches the jar touching mirror A
    const cells = jarsFor(t.magic['blockAt'], 50, 2, 0, 1, t.magic.mirrorLink);
    expect(cells).toEqual([[0, 1, 1]]);
    // without the link there is nothing
    expect(jarsFor(t.magic['blockAt'], 50, 2, 0, 1)).toEqual([]);
  });

  it('breaking a mirror breaks the link; Use on a linked mirror unlinks it', () => {
    const t = linked();
    t.world.setVoxel(50, 1, 0, 0);
    expect(t.magic.mirrorText(0, 1, 0)).toMatch(/unlinked/);
    const u = linked();
    expect(u.magic.use(u.at(0, 1, 0))).toBe('worked');
    expect(u.magic.mirrorText(50, 1, 0)).toMatch(/unlinked/);
  });

  it('refuses a link over the range', () => {
    const t = setup();
    t.hold('glass');
    t.put(0, 1, 0, 'linked_mirror');
    t.put(300, 1, 0, 'linked_mirror');
    t.magic.use(t.at(0, 1, 0));
    expect(t.magic.use(t.at(300, 1, 0))).toBe('refused');
  });

  it('moves items from the first mirror\'s container to the second\'s, and survives a save', () => {
    const t = linked();
    const store = new Map<string, { item: string; count: number }[]>([['0,0,0', []]]);
    store.set('0,2,0', [{ item: 'coal', count: 9 }]);
    t.put(0, 2, 0, 'crate');
    t.put(50, 2, 0, 'crate');
    const w = {
      peek: (x: number, y: number, z: number) => store.get(`${x},${y},${z}`) ?? [],
      take: (x: number, y: number, z: number, _f: string | null, max: number) => {
        const s = (store.get(`${x},${y},${z}`) ?? []).find((e) => e.count > 0);
        if (!s) return null;
        const n = Math.min(max, s.count);
        s.count -= n;
        return { item: s.item, count: n };
      },
      offer: (x: number, y: number, z: number, item: string, count: number) => {
        const k = `${x},${y},${z}`;
        const l = store.get(k) ?? [];
        l.push({ item, count });
        store.set(k, l);
        return count;
      },
      act: () => false as const,
    };
    t.magic.bindWorkshop(w);
    const raw = JSON.parse(JSON.stringify(t.magic.toJSON()));
    expect(raw.mirrors).toEqual([[0, 1, 0, 50, 1, 0]]);
    t.magic.tick(1);
    t.magic.tick(1);
    expect(store.get('0,2,0')?.[0].count).toBe(1);
    expect(store.get('50,2,0')?.reduce((n, e) => n + e.count, 0)).toBe(8);
    const u = setup();
    u.magic.load(raw);
    expect(u.magic.mirrorLink(0, 1, 0)).toEqual([50, 1, 0]);
  });
});
