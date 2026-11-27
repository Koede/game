import { describe, expect, it } from 'vitest';
import {
  CROWD_LIMIT,
  PEOPLE,
  assignRoom,
  contentment,
  favourRate,
  freshContentment,
  isAway,
  isGrumpy,
  knockDown,
  lineTone,
  priceFactor,
  returnsOn,
  roomOf,
  tipFactor,
  type Facts,
  type Tag,
  TAGS,
} from './contentment';

const facts = (over: Partial<Facts> = {}): Facts => ({ neighbours: [], tags: new Set<Tag>(), residentsNearby: 0, ...over });

/** A spread of inputs, including extremes, to sweep the bounds. */
const sweep = (): number[] => {
  const out: number[] = [-Infinity, -10, -1, -0.5, -0.25, -0.0001, 0, 0.0001, 0.25, 0.5, 1, 10, Infinity, NaN];
  for (let i = -20; i <= 20; i++) out.push(i / 10);
  return out;
};

describe('contentment score', () => {
  it('likes raise the score', () => {
    const base = contentment('rosa', facts());
    const withHearth = contentment('rosa', facts({ tags: new Set<Tag>(['hearth']) }));
    const withGruk = contentment('rosa', facts({ neighbours: ['gruk'] }));
    expect(withHearth.score).toBeGreaterThan(base.score);
    expect(withGruk.score).toBeGreaterThan(base.score);
    expect(withGruk.reasons).toContain('likes living near Gruk');
    expect(withHearth.reasons).toContain('likes the hearth nearby');
  });

  it('dislikes lower the score', () => {
    const base = contentment('gruk', facts());
    const fumes = contentment('gruk', facts({ tags: new Set<Tag>(['fumes']) }));
    expect(fumes.score).toBeLessThan(base.score);
    expect(fumes.reasons).toContain('dislikes the fumes nearby');
  });

  it('crowding lowers the score for everyone, and more residents lower it further', () => {
    for (const person of PEOPLE) {
      const alone = contentment(person, facts({ residentsNearby: 0 }));
      const packed = contentment(person, facts({ residentsNearby: CROWD_LIMIT + 3 }));
      expect(packed.score).toBeLessThan(alone.score);
    }
    const some = contentment('bram', facts({ residentsNearby: CROWD_LIMIT + 1 }));
    const more = contentment('bram', facts({ residentsNearby: CROWD_LIMIT + 4 }));
    expect(more.score).toBeLessThan(some.score);
  });

  it('a few folk close by does not count as crowding for Orrin', () => {
    const none = contentment('orrin', facts({ residentsNearby: 0 }));
    const few = contentment('orrin', facts({ residentsNearby: 2 }));
    expect(few.score).toBeGreaterThan(none.score);
    expect(few.reasons).toContain('likes having folk close by');
  });

  it('reasons name the crowding', () => {
    const r = contentment('bram', facts({ residentsNearby: CROWD_LIMIT + 2 }));
    expect(r.reasons.some((x) => x.startsWith('crowded:'))).toBe(true);
  });

  it('every person and input keeps the score in [-1, 1]', () => {
    const everyTag = new Set<Tag>(TAGS);
    for (const person of PEOPLE) {
      for (const residentsNearby of [0, 1, 3, 4, 10, 1000]) {
        for (const neighbours of [[], [...PEOPLE], PEOPLE.filter((p) => p !== person)]) {
          for (const tags of [new Set<Tag>(), everyTag]) {
            const { score } = contentment(person, { neighbours, tags, residentsNearby });
            expect(score).toBeGreaterThanOrEqual(-1);
            expect(score).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});

describe('contentment effects stay within their bounds', () => {
  it('priceFactor is in [0.85, 1.2] and content means cheaper', () => {
    for (const s of sweep()) {
      const p = priceFactor(s);
      expect(p).toBeGreaterThanOrEqual(0.85);
      expect(p).toBeLessThanOrEqual(1.2);
    }
    expect(priceFactor(1)).toBeLessThan(priceFactor(0));
    expect(priceFactor(-1)).toBeGreaterThan(priceFactor(0));
  });

  it('tipFactor is in [0.5, 1.5]', () => {
    for (const s of sweep()) {
      const t = tipFactor(s);
      expect(t).toBeGreaterThanOrEqual(0.5);
      expect(t).toBeLessThanOrEqual(1.5);
    }
    expect(tipFactor(1)).toBeGreaterThan(tipFactor(-1));
  });

  it('favourRate is in [0.5, 1.5]', () => {
    for (const s of sweep()) {
      const f = favourRate(s);
      expect(f).toBeGreaterThanOrEqual(0.5);
      expect(f).toBeLessThanOrEqual(1.5);
    }
    expect(favourRate(1)).toBeGreaterThan(favourRate(-1));
  });

  it('lineTone gives warm, neutral and grumpy at the thresholds', () => {
    expect(lineTone(0.25)).toBe('warm');
    expect(lineTone(1)).toBe('warm');
    expect(lineTone(0)).toBe('neutral');
    expect(lineTone(0.24)).toBe('neutral');
    expect(lineTone(-0.24)).toBe('neutral');
    expect(lineTone(-0.25)).toBe('grumpy');
    expect(lineTone(-1)).toBe('grumpy');
  });

  it('a grumpy flag forces a grumpy tone', () => {
    expect(lineTone(1, true)).toBe('grumpy');
    expect(lineTone(0, true)).toBe('grumpy');
  });
});

describe('knock-down and return', () => {
  it('marks the person away on the day, back the next morning', () => {
    const s0 = freshContentment();
    const s = knockDown(s0, 'gruk', 4);
    expect(isAway(s, 'gruk', 4)).toBe(true);
    expect(returnsOn(s, 'gruk')).toBe(5);
    expect(isAway(s, 'gruk', 5)).toBe(false);
    expect(isAway(s, 'gruk', 3)).toBe(false);
    expect(isAway(s, 'rosa', 4)).toBe(false);
    expect(returnsOn(s, 'rosa')).toBeNull();
  });

  it('is grumpy only on the morning they come back', () => {
    const s = knockDown(freshContentment(), 'mara', 2);
    expect(isGrumpy(s, 'mara', 2)).toBe(false);
    expect(isGrumpy(s, 'mara', 3)).toBe(true);
    expect(isGrumpy(s, 'mara', 4)).toBe(false);
    expect(lineTone(0.9, isGrumpy(s, 'mara', 3))).toBe('grumpy');
  });

  it('does not mutate the state it is given', () => {
    const s0 = freshContentment();
    knockDown(s0, 'veyra', 1);
    expect(isAway(s0, 'veyra', 1)).toBe(false);
  });

  it('keeps the room through a knock-down and the return', () => {
    let s = assignRoom(freshContentment(), 'bram', 'yard-lean-to');
    s = knockDown(s, 'bram', 7);
    expect(roomOf(s, 'bram')).toBe('yard-lean-to');
    s = knockDown(s, 'bram', 8);
    expect(roomOf(s, 'bram')).toBe('yard-lean-to');
    expect(roomOf(freshContentment(), 'bram')).toBeNull();
  });
});
