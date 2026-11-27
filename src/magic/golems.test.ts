import { describe, expect, it } from 'vitest';
import { fillJar, setup } from './testKit';
import { GOLEMS, golemBody } from './golems';
import { infusionRecipe } from '../content/recipesMagic';
import { RESEARCH_GATES } from './gates';
import { itemOrNull } from '../core/registry';

/** A workshop whose containers are plain item lists. */
function fakeWorkshop() {
  const store = new Map<string, { item: string; count: number }[]>();
  return {
    store,
    peek: (x: number, y: number, z: number) => store.get(`${x},${y},${z}`) ?? [],
    take: (x: number, y: number, z: number, _f: string | null, max: number) => {
      const l = store.get(`${x},${y},${z}`) ?? [];
      const s = l.find((e) => e.count > 0);
      if (!s) return null;
      const n = Math.min(max, s.count);
      s.count -= n;
      return { item: s.item, count: n };
    },
    offer: (x: number, y: number, z: number, item: string, count: number) => {
      const k = `${x},${y},${z}`;
      const l = store.get(k) ?? [];
      const s = l.find((e) => e.item === item);
      if (s) s.count += count; else l.push({ item, count });
      store.set(k, l);
      return count;
    },
    act: () => false as const,
  };
}

describe('golem bodies, markers, traits', () => {
  it('three upgraded bodies are blocks with altar recipes and research gates; markers have recipes', () => {
    for (const k of ['wood_golem', 'stone_golem', 'iron_golem']) {
      expect(golemBody(k)).not.toBeNull();
      expect(infusionRecipe(k)?.center).toBe('clay_servant');
      expect(RESEARCH_GATES.has(k)).toBe(true);
      expect(itemOrNull(k)).not.toBeNull();
    }
    expect(RESEARCH_GATES.has('golem_pull_marker')).toBe(true);
    // traits: wood is swift, stone lasts, iron reaches
    expect(golemBody('wood_golem')!.steps).toBe(2);
    expect(golemBody('stone_golem')!.feedS).toBeGreaterThan(golemBody('clay_servant')!.feedS * 2);
    expect(golemBody('iron_golem')!.range).toBeGreaterThan(golemBody('clay_servant')!.range);
    expect(GOLEMS.every((g) => g.carry > 0 || g.key === 'clay_servant')).toBe(true);
  });

  it('a wood golem carries items from the Pull marker container to the Drop marker container', () => {
    const t = setup();
    const w = fakeWorkshop();
    t.magic.bindWorkshop(w);
    t.put(0, 1, 0, 'wood_golem');
    t.put(0, 1, 1, 'essentia_jar');
    fillJar(t, 0, 1, 1, 'spring', 2);
    t.put(3, 1, 0, 'crate');
    t.put(3, 2, 0, 'golem_pull_marker');
    t.put(6, 1, 0, 'crate');
    t.put(6, 2, 0, 'golem_drop_marker');
    w.store.set('3,1,0', [{ item: 'coal', count: 10 }]);
    for (let i = 0; i < 40; i++) t.magic.tick(1);
    const got = w.store.get('6,1,0')?.reduce((n, e) => n + e.count, 0) ?? 0;
    expect(got).toBeGreaterThanOrEqual(4);
    expect(got + (w.store.get('3,1,0')?.[0].count ?? 0)).toBeLessThanOrEqual(10);
  });

  it('a clay servant cannot haul; without a Drop marker nothing is pulled', () => {
    const t = setup();
    const w = fakeWorkshop();
    t.magic.bindWorkshop(w);
    t.put(0, 1, 0, 'clay_servant');
    t.put(0, 1, 1, 'essentia_jar');
    fillJar(t, 0, 1, 1, 'spring', 2);
    t.put(3, 1, 0, 'crate');
    t.put(3, 2, 0, 'golem_pull_marker');
    t.put(6, 1, 0, 'crate');
    t.put(6, 2, 0, 'golem_drop_marker');
    w.store.set('3,1,0', [{ item: 'coal', count: 10 }]);
    for (let i = 0; i < 20; i++) t.magic.tick(1);
    expect(w.store.get('3,1,0')?.[0].count).toBe(10);
    const u = setup();
    const w2 = fakeWorkshop();
    u.magic.bindWorkshop(w2);
    u.put(0, 1, 0, 'iron_golem');
    u.put(0, 1, 1, 'essentia_jar');
    fillJar(u, 0, 1, 1, 'spring', 2);
    u.put(3, 1, 0, 'crate');
    u.put(3, 2, 0, 'golem_pull_marker');
    w2.store.set('3,1,0', [{ item: 'coal', count: 10 }]);
    for (let i = 0; i < 20; i++) u.magic.tick(1);
    expect(w2.store.get('3,1,0')?.[0].count).toBe(10);
  });

  it('a hauling load survives a save, and is dropped when the golem block is broken', () => {
    const t = setup();
    const w = fakeWorkshop();
    t.magic.bindWorkshop(w);
    t.put(0, 1, 0, 'stone_golem');
    t.put(0, 1, 1, 'essentia_jar');
    fillJar(t, 0, 1, 1, 'spring', 2);
    t.put(2, 1, 0, 'crate');
    t.put(2, 2, 0, 'golem_pull_marker');
    t.put(8, 1, 0, 'crate');
    t.put(8, 2, 0, 'golem_drop_marker');
    w.store.set('2,1,0', [{ item: 'coal', count: 20 }]);
    let loadedAt: string | null = null;
    for (let i = 0; i < 12 && !loadedAt; i++) {
      t.magic.tick(1);
      for (let x = 0; x <= 8; x++) for (let z = 0; z <= 1; z++) for (let y = 1; y <= 2; y++) if (t.magic.servantText(x, y, z)?.includes('carrying')) loadedAt = `${x},${y},${z}`;
    }
    expect(loadedAt).not.toBeNull();
    const raw = JSON.parse(JSON.stringify(t.magic.toJSON()));
    expect(raw.carries).toHaveLength(1);
    const [x, y, z] = (loadedAt as string).split(',').map(Number);
    t.world.setVoxel(x, y, z, 0);
    expect(t.player.ground.items.some((e) => e.item === 'coal')).toBe(true);
  });
});
