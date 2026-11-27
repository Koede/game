import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/math';
import {
  ARRIVALS,
  moveInChance,
  newcomerLine,
  rollNight,
  rollNights,
  triggerMet,
  type FreeRoom,
  type Newcomer,
  type TownFacts,
} from './moveIn';

const noFacts: TownFacts = { hearth: false, firstBronze: false, firstMagic: false, residents: 0, alchemy: false };
const eligible = (id: string): Newcomer => ({ id, triggerMet: true, reputationOk: true, eligible: true });
const blocked = (id: string): Newcomer => ({ id, triggerMet: false, reputationOk: true, eligible: false });
const always = (): number => 0; // every roll succeeds when the chance is above 0
const never = (): number => 0.999999; // no roll succeeds

describe('moveInChance', () => {
  it('is 0 on the room first night', () => {
    expect(moveInChance(0)).toBe(0);
  });

  it('starts at the base and rises by the growth each empty night', () => {
    expect(moveInChance(1)).toBeCloseTo(0.04, 10);
    expect(moveInChance(2)).toBeCloseTo(0.06, 10);
    expect(moveInChance(5)).toBeCloseTo(0.12, 10);
  });

  it('is capped at 0.30 and never decreases', () => {
    expect(moveInChance(100)).toBe(0.3);
    let last = -1;
    for (let n = 0; n < 60; n++) {
      const c = moveInChance(n);
      expect(c).toBeGreaterThanOrEqual(last);
      last = c;
    }
  });
});

describe('triggers and the line', () => {
  it('lists the plan order with its triggers', () => {
    expect(ARRIVALS.map((a) => [a.id, a.trigger])).toEqual([
      ['rosa', 'hearth'],
      ['orrin', 'first_bronze'],
      ['mara', 'first_magic'],
      ['bram', 'three_residents'],
      ['veyra', 'alchemy'],
    ]);
  });

  it('evaluates each trigger from the facts', () => {
    expect(triggerMet('hearth', { ...noFacts, hearth: true })).toBe(true);
    expect(triggerMet('hearth', noFacts)).toBe(false);
    expect(triggerMet('first_bronze', { ...noFacts, firstBronze: true })).toBe(true);
    expect(triggerMet('first_magic', { ...noFacts, firstMagic: true })).toBe(true);
    expect(triggerMet('alchemy', { ...noFacts, alchemy: true })).toBe(true);
    expect(triggerMet('three_residents', { ...noFacts, residents: 2 })).toBe(false);
    expect(triggerMet('three_residents', { ...noFacts, residents: 3 })).toBe(true);
  });

  it('marks eligible only when trigger and reputation both pass', () => {
    const line = newcomerLine({ ...noFacts, hearth: true }, 10, { rosa: 5, gruk: 5 });
    expect(line[0]).toEqual({ id: 'rosa', triggerMet: true, reputationOk: true, eligible: true });
    expect(line[1].eligible).toBe(false);
    const low = newcomerLine({ ...noFacts, hearth: true }, 1, { rosa: 5 });
    expect(low[0].eligible).toBe(false);
    expect(low[0].reputationOk).toBe(false);
  });
});

describe('rollNight', () => {
  const room = (emptyNights: number, id = 'r1'): FreeRoom => ({ id, emptyNights });

  it('never moves someone in on the first night, even with a lucky roll', () => {
    const r = rollNight({ arrived: [] }, [room(0)], [eligible('rosa')], always);
    expect(r.arrival).toBeNull();
    expect(r.rooms).toEqual([{ id: 'r1', emptyNights: 1 }]);
  });

  it('moves the first eligible person in on a success, and removes the room', () => {
    const r = rollNight({ arrived: [] }, [room(3)], [blocked('gruk'), eligible('rosa')], always);
    expect(r.arrival).toEqual({ personId: 'rosa', roomId: 'r1' });
    expect(r.rooms).toEqual([]);
    expect(r.state.arrived).toEqual(['rosa']);
  });

  it('brings at most one arrival per night across all rooms', () => {
    const r = rollNight({ arrived: [] }, [room(5, 'a'), room(5, 'b')], [eligible('rosa'), eligible('gruk')], always);
    expect(r.arrival).toEqual({ personId: 'rosa', roomId: 'a' });
    expect(r.rooms).toEqual([{ id: 'b', emptyNights: 6 }]);
  });

  it('skips the ineligible in favour of the next in line', () => {
    const r = rollNight({ arrived: [] }, [room(5)], [blocked('rosa'), eligible('gruk')], always);
    expect(r.arrival?.personId).toBe('gruk');
  });

  it('never brings back someone who already arrived', () => {
    const r = rollNight({ arrived: ['rosa'] }, [room(5)], [eligible('rosa')], always);
    expect(r.arrival).toBeNull();
  });

  it('ages every room that stays free', () => {
    const r = rollNight({ arrived: [] }, [room(2)], [eligible('rosa')], never);
    expect(r.arrival).toBeNull();
    expect(r.rooms).toEqual([{ id: 'r1', emptyNights: 3 }]);
  });
});

describe('rollNights', () => {
  it('rolls skipped nights one by one and reports the night', () => {
    const r = rollNights(3, { arrived: [] }, [{ id: 'r1', emptyNights: 0 }], [eligible('rosa')], always);
    // night 1 is the first night (chance 0), night 2 has the base chance and always succeeds
    expect(r.arrivals).toEqual([{ personId: 'rosa', roomId: 'r1', night: 2 }]);
    expect(r.rooms).toEqual([]);
  });

  it('ages the free rooms by the nights rolled', () => {
    const r = rollNights(4, { arrived: [] }, [{ id: 'r1', emptyNights: 0 }], [eligible('rosa')], never);
    expect(r.arrivals).toEqual([]);
    expect(r.rooms).toEqual([{ id: 'r1', emptyNights: 4 }]);
  });

  it('is deterministic for a seed', () => {
    const run = (seed: number) => rollNights(60, { arrived: [] }, [{ id: 'a', emptyNights: 0 }], [eligible('rosa'), eligible('gruk')], mulberry32(seed));
    expect(run(42)).toEqual(run(42));
  });

  it('gives a finished room a median wait between 4 and 16 nights over 2000 seeds', () => {
    const waits: number[] = [];
    for (let seed = 1; seed <= 2000; seed++) {
      const r = rollNights(200, { arrived: [] }, [{ id: 'r1', emptyNights: 0 }], [eligible('rosa')], mulberry32(seed));
      waits.push(r.arrivals[0]?.night ?? 200);
    }
    waits.sort((a, b) => a - b);
    const median = waits[1000];
    expect(median).toBeGreaterThanOrEqual(4);
    expect(median).toBeLessThanOrEqual(16);
  });
});
