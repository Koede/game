import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/math';
import { CAMP } from './housingView';
import { ARRIVALS, newcomerLine, type TownFacts } from './moveIn';
import { LODGE_COMMON, LODGE_ROOMS, LODGE_SLEEP, MAX_NIGHTS, Settlement, lodgeRooms, sampleTags, townContentment } from './settlement';
import { contentment } from './contentment';
import { walkable } from './nav';

const facts: TownFacts = { hearth: true, firstBronze: false, firstMagic: false, residents: 0, alchemy: false };
const lineOf = (f: Partial<TownFacts>, present: string[] = []) => newcomerLine({ ...facts, ...f }, 0).filter((n) => !present.includes(n.id));
const never = () => 0.999;
const always = () => 0;

describe('the line', () => {
  it('has Orrin second, not Gruk: Gruk is the builder and lives at the camp', () => {
    expect(ARRIVALS.map((a) => a.id)).toEqual(['rosa', 'orrin', 'mara', 'bram', 'veyra']);
    expect(ARRIVALS.some((a) => a.id === 'gruk')).toBe(false);
  });
});

describe('lodge rooms', () => {
  it('counts the lodge bedrooms as valid housing by default, stage by stage, guest rooms included', () => {
    expect(lodgeRooms(0)).toEqual([]);
    expect(lodgeRooms(1).map((r) => r.id)).toEqual(['lodge_1']);
    expect(lodgeRooms(3).map((r) => r.id)).toEqual(['lodge_1', 'lodge_2', 'lodge_3']);
    const all = lodgeRooms(4);
    expect(all.map((r) => r.id)).toEqual(['lodge_1', 'lodge_2', 'lodge_3', 'guest_1', 'guest_2']);
    expect(all.every((r) => r.check.ok)).toBe(true);
  });

  it('stands the people on walkable cells of the lodge: the sleeping spots and the common room', () => {
    for (const [id, s] of Object.entries(LODGE_SLEEP)) expect(walkable(s[0], s[2]), id).toBe(true);
    for (const [id, s] of Object.entries(LODGE_COMMON)) expect(walkable(s[0], s[2]), id).toBe(true);
  });
});

describe('the nightly roll', () => {
  const rooms = () => lodgeRooms(1);

  it('never rolls on the night the room is finished, then a person can come', () => {
    const s = new Settlement();
    s.track(5, rooms());
    s.advance(5, rooms, () => lineOf({}), always, () => undefined); // first look: only starts the clock
    const first = s.advance(6, rooms, () => lineOf({}), always, () => undefined);
    expect(first).toEqual([]); // the turn to day 6 is the room's first night
    const second = s.advance(7, rooms, () => lineOf({}), always, () => undefined);
    expect(second).toEqual([{ personId: 'rosa', roomId: 'lodge_1' }]);
    expect(s.roomOf('rosa')).toBe('lodge_1');
  });

  it('rolls each night that passed, one by one, and stops at one arrival per room', () => {
    const s = new Settlement();
    s.track(1, rooms());
    s.advance(1, rooms, () => lineOf({}), never, () => undefined);
    const present: string[] = [];
    const got = s.advance(30, rooms, () => lineOf({}, present), mulberry32(3), (a) => present.push(a.personId));
    expect(got.length).toBe(1);
    expect(present).toEqual(['rosa']);
  });

  it('skips people whose trigger is not met: Orrin waits for bronze, and a full house waits for a room', () => {
    const s = new Settlement();
    s.track(1, lodgeRooms(3));
    s.advance(1, () => lodgeRooms(3), () => lineOf({}), never, () => undefined);
    const present = ['rosa'];
    s.place('rosa', 'lodge_1');
    const none = s.advance(20, () => lodgeRooms(3), () => lineOf({}, present), always, (a) => present.push(a.personId));
    expect(none).toEqual([]); // Orrin has no bronze yet, Mara no magic, Bram has too few neighbours
    const bronze = s.advance(25, () => lodgeRooms(3), () => lineOf({ firstBronze: true }, present), always, (a) => present.push(a.personId));
    expect(bronze[0].personId).toBe('orrin');
    expect(['lodge_2', 'lodge_3']).toContain(bronze[0].roomId);
  });

  it('caps a long absence', () => {
    const s = new Settlement();
    s.track(1, rooms());
    s.advance(1, rooms, () => lineOf({}), never, () => undefined);
    let rolls = 0;
    s.advance(1 + MAX_NIGHTS * 5, rooms, () => lineOf({}), () => { rolls++; return 0.999; }, () => undefined);
    expect(rolls).toBeLessThanOrEqual(MAX_NIGHTS);
  });

  it('has a median wait within about one to two moons (8 days each) of a finished room', () => {
    const waits: number[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      const s = new Settlement();
      s.track(1, rooms());
      s.advance(1, rooms, () => lineOf({}), never, () => undefined);
      const present: string[] = [];
      const rng = mulberry32(seed);
      let day = 1;
      while (present.length === 0 && day < 200) s.advance(++day, rooms, () => lineOf({}, present), rng, (a) => present.push(a.personId));
      waits.push(day - 1);
    }
    waits.sort((a, b) => a - b);
    const median = waits[Math.floor(waits.length / 2)];
    expect(median).toBeGreaterThanOrEqual(3);
    expect(median).toBeLessThanOrEqual(16);
  });
});

describe('broken rooms', () => {
  it('moves a resident whose built room stopped passing to a free valid room, or to the camp', () => {
    const s = new Settlement();
    s.place('orrin', 'bed:5,10,5');
    const ok = { ok: true, reasons: [], cells: 8 };
    const bad = { ok: false, reasons: ['needs a light'], cells: 8 };
    const moved = s.evict([...lodgeRooms(1), { id: 'bed:5,10,5', check: bad }]);
    expect(moved).toEqual([{ personId: 'orrin', from: 'bed:5,10,5', to: 'lodge_1' }]);
    s.place('mara', 'bed:7,10,7');
    const campMoved = s.evict([{ id: 'bed:7,10,7', check: bad }, { id: 'lodge_1', check: ok }]);
    expect(campMoved[0].to).toBe(CAMP);
  });

  it('saves and loads, and an empty save starts fresh', () => {
    const s = new Settlement();
    s.track(3, lodgeRooms(2));
    s.advance(3, () => lodgeRooms(2), () => lineOf({}), always, () => undefined);
    s.advance(6, () => lodgeRooms(2), () => lineOf({}), always, () => undefined);
    const t = new Settlement();
    t.load(JSON.parse(JSON.stringify(s.toJSON())));
    expect(t.toJSON()).toEqual(s.toJSON());
    t.load(undefined);
    expect(t.last).toBe(0);
    expect(t.occupancy).toEqual({});
  });
});

describe('contentment of the town', () => {
  const at = (x: number, y = 1) => ({ x, y, z: 0 });
  const spots: Record<string, { x: number; y: number; z: number }> = { rosa: at(0), gruk: at(5), mara: at(8), bram: at(100) };
  const score = (residents: string[], housed: (id: string) => boolean, tags: Record<string, string[]> = {}) =>
    townContentment(residents, (id) => spots[id] ?? null, housed, (id) => new Set(tags[id] ?? []) as never);

  it('likes and dislikes move the score the right way: Rosa near Gruk is happier than Rosa alone, Bram near Gruk is not', () => {
    const near = score(['rosa', 'gruk'], () => false);
    const alone = score(['rosa'], () => false);
    expect(near.rosa.score).toBeGreaterThan(alone.rosa.score);
    expect(near.rosa.reasons.join(' ')).toContain('Gruk');
    const far = score(['bram', 'gruk'], () => false);
    expect(far.bram.reasons.join(' ')).not.toContain('Gruk'); // 100 blocks away: not neighbours, nothing to dislike
    spots.bram = at(6);
    const close = score(['bram', 'gruk'], () => false);
    expect(close.bram.score).toBeLessThan(far.bram.score);
    spots.bram = at(100);
  });

  it('counts only housed residents as a crowd, so a common room is never crowded', () => {
    const ids = ['rosa', 'gruk', 'mara'];
    const all = townContentment([...ids, 'orrin', 'veyra', 'bram'], () => at(1), () => true, () => new Set());
    const none = townContentment([...ids, 'orrin', 'veyra', 'bram'], () => at(1), () => false, () => new Set());
    expect(all.rosa.reasons.some((r) => r.startsWith('crowded'))).toBe(true);
    expect(none.rosa.reasons.some((r) => r.startsWith('crowded'))).toBe(false);
  });

  it('keeps every score within [-1, 1]', () => {
    for (const p of ['rosa', 'gruk', 'mara', 'bram', 'veyra', 'orrin'] as const) {
      const c = contentment(p, { neighbours: ['rosa', 'gruk', 'mara', 'bram', 'veyra', 'orrin'], tags: new Set(['forge', 'fumes', 'crowded']), residentsNearby: 9 });
      expect(c.score).toBeGreaterThanOrEqual(-1);
      expect(c.score).toBeLessThanOrEqual(1);
    }
  });

  it('reads the surroundings from block samples: trees need a few leaves, a single one is not a wood', () => {
    const one = sampleTags((x, y, z) => (x === 0 && y === 1 && z === 0 ? 'oak_leaves' : 'air'), at(0));
    expect(one.has('trees')).toBe(false);
    const wood = sampleTags((x, y) => (y === 1 ? 'oak_leaves' : 'air'), at(0));
    expect(wood.has('trees')).toBe(true);
    const fire = sampleTags((x, y, z) => (x === 0 && z === 0 && y === 1 ? 'furnace_clay' : 'air'), at(0));
    expect(fire.has('hearth')).toBe(true);
  });

  it('is happier in a warm room and unhappier in a cold one, and does nothing without a reading', () => {
    const base = { neighbours: [], tags: new Set<never>(), residentsNearby: 0 } as const;
    const none = contentment('rosa', base).score;
    expect(contentment('rosa', { ...base, warmth: 10 }).score).toBeGreaterThan(none);
    expect(contentment('rosa', { ...base, warmth: -10 }).score).toBeLessThan(none);
    expect(contentment('rosa', { ...base, warmth: Number.NaN }).score).toBe(none);
    expect(contentment('rosa', { ...base, warmth: 1000 }).score).toBeLessThanOrEqual(1);
  });
});
