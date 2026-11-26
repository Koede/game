import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { BuildJob, captureBlueprint } from './blueprint';
import { BLUEPRINT_CATALOG, BlueprintBook, cleanBlueprint, grantKnownPlans, JOB_RANGE, MAX_BLUEPRINTS, MAX_JOBS, tickJobs } from './blueprintBook';
import { FakeWorld } from './fakeWorld';
import { Inventory } from './inventory';
import { PlayerState } from './playerState';

const small = () => {
  const w = new FakeWorld(createBus());
  w.fill(0, 5, 0, 1, 5, 1, 'plank');
  return captureBlueprint(w, [0, 5, 0], [1, 5, 1], 'Pad')!;
};

describe('blueprint book', () => {
  it('grants a catalog blueprint once, and a finished one by id', () => {
    const book = new BlueprintBook();
    expect(book.grant('stone_hut')).toMatchObject({ ok: true, added: true });
    expect(book.grant('stone_hut')).toMatchObject({ ok: true, added: false });
    expect(book.grant('nope')).toMatchObject({ ok: false, added: false });
    expect(book.grant(small(), 'ruin:7').added).toBe(true);
    expect(book.grant(small(), 'ruin:7').added).toBe(false);
    expect(book.entries.map((e) => e.origin)).toEqual(['granted', 'granted']);
    for (const key of Object.keys(BLUEPRINT_CATALOG)) expect(BLUEPRINT_CATALOG[key]().cells.length).toBeGreaterThan(0);
  });

  it('is full at MAX_BLUEPRINTS and renames and removes', () => {
    const book = new BlueprintBook();
    for (let i = 0; i < MAX_BLUEPRINTS; i++) expect(book.add(small())).not.toBeNull();
    expect(book.add(small())).toBeNull();
    expect(book.grant('stone_hut').text).toMatch(/full/);
    const id = book.entries[0].id;
    expect(book.rename(id, '  Smelter  ')).toBe(true);
    expect(book.get(id)!.bp.name).toBe('Smelter');
    expect(book.rename(id, '   ')).toBe(false);
    expect(book.remove(id)).toBe(true);
    expect(book.remove(id)).toBe(false);
  });

  it('saves and loads, drops damaged entries, and an old save has none', () => {
    const book = new BlueprintBook();
    book.add(small());
    book.grant('plank_shed');
    book.commission(small(), [4, 5, 4]);
    const back = new BlueprintBook();
    back.load(JSON.parse(JSON.stringify(book.toJSON())));
    expect(back.entries.map((e) => e.bp.name)).toEqual(['Pad', 'Plank Shed']);
    expect(back.jobs).toHaveLength(1);
    const fresh = back.add(small())!;
    expect(book.entries.some((e) => e.id === fresh.id)).toBe(false);
    const bad = new BlueprintBook();
    bad.load({ entries: [{ id: 'x', bp: { name: 'junk', size: [1, 1, 1], cells: [{ dx: 0, dy: 0, dz: 0, block: 'nope', facing: 0 }] }, origin: 'saved' }, 7 as never, { id: 'y', bp: null as never, origin: 'saved' }], jobs: [null as never] } as never);
    expect(bad.entries).toHaveLength(0);
    expect(bad.jobs).toHaveLength(0);
    bad.load(undefined);
    expect(bad.entries).toHaveLength(0);
  });

  it('the player snapshot carries the book, and a save without it loads empty', () => {
    const p = new PlayerState(createBus(), { x: 0, y: 20, z: 0 });
    p.blueprints.grant('stone_hut');
    const snap = JSON.parse(JSON.stringify(p.toJSON()));
    const q = new PlayerState(createBus(), { x: 0, y: 20, z: 0 });
    q.load(snap);
    expect(q.blueprints.entries).toHaveLength(1);
    delete snap.blueprints;
    const r = new PlayerState(createBus(), { x: 0, y: 20, z: 0 });
    r.blueprints.grant('stone_hut');
    r.load(snap);
    expect(r.blueprints.entries).toHaveLength(0);
  });

  it('limits jobs, builds only near the player, reports dry and finished once', () => {
    const book = new BlueprintBook();
    const world = new FakeWorld(createBus());
    for (let i = 0; i < MAX_JOBS; i++) expect(book.commission(small(), [10 * i, 5, 0])).not.toBeNull();
    expect(book.commission(small(), [0, 5, 20])).toBeNull();
    book.jobs = book.jobs.slice(0, 1);
    const pack = new Inventory(8);
    pack.add('plank', 1);
    const far = tickJobs(book, 5, world, pack, { x: JOB_RANGE + 100, z: 0 });
    expect(far).toEqual({ finished: [], dry: [] });
    expect(world.getBlock(0, 5, 0).key).toBe('air');
    const first = tickJobs(book, 5, world, pack, { x: 0, z: 0 });
    expect(first.dry).toEqual([{ name: 'Pad', item: 'plank' }]);
    expect(tickJobs(book, 5, world, pack, { x: 0, z: 0 }).dry).toEqual([]);
    pack.add('plank', 5);
    const done = tickJobs(book, 5, world, pack, { x: 0, z: 0 });
    expect(done.finished).toEqual(['Pad']);
    expect(book.jobs).toHaveLength(0);
    expect(world.getBlock(1, 5, 1).key).toBe('plank');
  });

  it('a job in the book keeps its BuildJob type through a save', () => {
    const book = new BlueprintBook();
    book.commission(small(), [0, 5, 0]);
    expect(book.jobs[0].job).toBeInstanceOf(BuildJob);
  });

  it('grants the plans a source knows once, under plan:<id>, and fills in a missing item', () => {
    const book = new BlueprintBook();
    const bp = { name: 'Kiln House', size: [1, 1, 1] as [number, number, number], cells: [{ dx: 0, dy: 0, dz: 0, block: 'stone_brick', facing: 0 }] };
    const known = [{ id: 'kiln_house' }, { id: 'ghost' }];
    const src = { list: () => known, blueprintOf: (id: string) => (id === 'kiln_house' ? bp : null) };
    expect(grantKnownPlans(book, src)).toEqual(['New blueprint: Kiln House']);
    expect(grantKnownPlans(book, src)).toEqual([]);
    expect(book.get('plan:kiln_house')!.origin).toBe('granted');
    expect(cleanBlueprint(bp)!.cells[0].item).toBeTruthy();
  });
});
