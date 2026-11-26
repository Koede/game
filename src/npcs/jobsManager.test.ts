import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import type { JobsWorld, Stop } from './jobs';
import { NpcManager, type NpcHost } from './manager';

const key = (s: Stop): string => `${s.x},${s.y},${s.z}`;
const A: Stop = { x: 20, y: 11, z: 20 };
const B: Stop = { x: 28, y: 11, z: 20 };

function world(): { w: JobsWorld; stores: Map<string, Record<string, number>> } {
  const stores = new Map<string, Record<string, number>>();
  const w: JobsWorld = {
    peek: (s) => Object.entries(stores.get(key(s)) ?? {}).filter(([, n]) => n > 0).map(([item, count]) => ({ item, count })),
    take: (s, item, max) => {
      const st = stores.get(key(s));
      const n = Math.min(max, st?.[item] ?? 0);
      if (!st || n <= 0) return null;
      st[item] -= n;
      return { item, count: n };
    },
    canOffer: (_s, _i, n) => n,
    offer: (s, item, n) => {
      const st = stores.get(key(s)) ?? {};
      st[item] = (st[item] ?? 0) + n;
      stores.set(key(s), st);
      return n;
    },
    loaded: () => true,
    spill: () => undefined,
    blockAt: () => 'crate',
  };
  return { w, stores };
}

function setup(time = 0.3) {
  const bus = createBus();
  const said: { work?: boolean; id: string }[] = [];
  bus.on('npc:say', (e) => said.push({ id: e.id, work: e.work }));
  const m = new NpcManager(bus);
  const { w, stores } = world();
  const host = { jobs: w, timeOfDay: () => time, day: () => 1, give: (_i: string, _n: number) => 0, held: () => null, takeHeld: () => undefined, currentGoal: () => null, completed: () => new Set<string>(), advice: () => null, companion: { player: () => ({ x: 0, y: 0, z: 0, dead: false }), hostiles: () => [], hit: () => undefined, world: undefined } } as unknown as NpcHost;
  m.bind(host);
  m.load({ v: 1, at: [10, 10, 10], greeted: true, gifted: [], spoken: {}, present: ['gruk', 'rosa'], camp: true });
  return { m, stores, said, bus };
}

describe('jobs in the manager', () => {
  it('only residents can work, and only when the world has a workshop', () => {
    const { m } = setup();
    expect(m.canWork('gruk')).toBe(true);
    expect(m.canWork('mara')).toBe(false); // does not live here yet
    expect(m.canWork('bar')).toBe(false);
    expect(m.workers().map((p) => p.id).sort()).toEqual(['gruk', 'rosa']);
    const bare = new NpcManager(createBus());
    bare.bind({ give: () => 0, companion: {} } as unknown as NpcHost);
    bare.load({ v: 1, at: [0, 0, 0], greeted: true, gifted: [], spoken: {}, present: ['gruk'], camp: true });
    expect(bare.canWork('gruk')).toBe(false);
  });

  it('Gruk hauls ore by day while the settlement ticks, and walks the road in his view', () => {
    const { m, stores } = setup();
    stores.set(key(A), { copper_ore: 30, stick: 3 });
    m.setJob('gruk', 'haul');
    m.jobs.setFilter('gruk', 'ore');
    m.jobs.setStop('gruk', 'from', A);
    m.jobs.setStop('gruk', 'to', B);
    let sawRoad = false;
    for (let i = 0; i < 400; i++) {
      m.tick(0.25);
      const v = m.views().find((p) => p.id === 'gruk')!;
      if (v.x > 22 && v.x < 26 && Math.abs(v.z - 20.5) < 0.01) sawRoad = true;
    }
    expect(stores.get(key(B))?.copper_ore).toBe(30);
    expect(stores.get(key(A))?.stick).toBe(3);
    expect(sawRoad).toBe(true);
  });

  it('does nothing at night', () => {
    const { m, stores } = setup(0.95);
    stores.set(key(A), { copper_ore: 30 });
    m.setJob('gruk', 'haul');
    m.jobs.setStop('gruk', 'from', A);
    m.jobs.setStop('gruk', 'to', B);
    for (let i = 0; i < 200; i++) m.tick(0.25);
    expect(stores.get(key(A))?.copper_ore).toBe(30);
  });

  it('picks a stop by Use on a block, then reopens the jobs screen', () => {
    const { m, bus } = setup();
    const opened: unknown[] = [];
    bus.on('ui:open', (e) => opened.push(e.screen));
    m.setJob('rosa', 'feed');
    expect(m.startPick('rosa', 'from')).toBe(true);
    expect(m.pickingStop).toEqual({ id: 'rosa', which: 'from' });
    expect(m.jobPick({ x: 5, y: 6, z: 7, block: { key: 'crate' } })).toBe(true);
    expect(m.jobs.get('rosa')!.job.from).toEqual({ x: 5, y: 6, z: 7 });
    expect(m.pickingStop).toBeNull();
    expect(opened).toEqual([{ type: 'jobs', person: 'rosa' }]);
    expect(m.jobPick({ x: 1, y: 1, z: 1, block: { key: 'crate' } })).toBe(false);
    m.startPick('rosa', 'to');
    expect(m.jobPick(null)).toBe(true); // nothing there: the pick is dropped
    expect(m.pickingStop).toBeNull();
  });

  it('keeps jobs through a save, and old saves have none', () => {
    const { m } = setup();
    m.setJob('gruk', 'haul');
    m.jobs.setStop('gruk', 'from', A);
    m.jobs.setStop('gruk', 'to', B);
    const snap = JSON.parse(JSON.stringify(m.toJSON()));
    const again = setup().m;
    again.load(snap);
    expect(again.jobs.get('gruk')!.job).toMatchObject({ kind: 'haul', from: A, to: B });
    const old = { ...snap };
    delete old.jobs;
    again.load(old);
    expect(again.jobs.size).toBe(0);
  });

  it('the dialogue offers work to people who can take it', () => {
    const { m, said } = setup();
    const gruk = m.views().find((v) => v.id === 'gruk')!;
    m.talk(gruk.x - 2, gruk.y + 1.2, gruk.z, 1, 0, 0);
    expect(said.at(-1)).toMatchObject({ id: 'gruk', work: true });
  });
});
