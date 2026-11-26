import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { MemoryStorage } from '../save/storage';
import { PostcardDirector, PostcardStore, postcardCaption, postcardVantage, type Postcard } from './postcards';

import type { PostcardMoment } from './postcards';
const quiet: PostcardMoment = { paused: false, dead: false, busy: false, phase: 'day' };
const card = (age: number): Postcard => ({ age, ageName: `Age ${age}`, day: age * 3, image: 'data:image/jpeg;base64,AAAA' });

function rig(have: (a: number) => boolean = () => false) {
  const bus = createBus();
  const d = new PostcardDirector(bus, have);
  const run = (s: number, m = quiet): number | null => {
    for (let t = 0; t < s; t += 0.5) {
      const a = d.poll(0.5, m);
      if (a !== null) return a;
    }
    return null;
  };
  return { bus, d, run };
}

describe('PostcardDirector', () => {
  it('waits for the banner to pass, then asks for the card once', () => {
    const r = rig();
    r.bus.emit('age:advanced', { age: 1 });
    expect(r.d.poll(1, quiet)).toBeNull();
    expect(r.run(20)).toBe(1);
    expect(r.run(20)).toBeNull();
  });

  it('holds back while paused, dead, busy or at night', () => {
    const r = rig();
    r.bus.emit('age:advanced', { age: 2 });
    for (const m of <PostcardMoment[]>[{ ...quiet, paused: true }, { ...quiet, dead: true }, { ...quiet, busy: true }, { ...quiet, phase: 'night' }]) expect(r.run(20, m)).toBeNull();
    expect(r.d.waiting).toBe(1);
    expect(r.run(1)).toBe(2);
  });

  it('skips ages that already have a card and the Ember age', () => {
    const r = rig((a) => a === 1);
    r.bus.emit('age:advanced', { age: 0 });
    r.bus.emit('age:advanced', { age: 1 });
    expect(r.d.waiting).toBe(0);
  });

  it('takes the earliest age first when several are due', () => {
    const r = rig();
    r.bus.emit('age:advanced', { age: 3 });
    r.bus.emit('age:advanced', { age: 2 });
    expect(r.run(20)).toBe(2);
    expect(r.run(20)).toBe(3);
  });
});

describe('PostcardStore', () => {
  it('keeps cards by age, replaces a repeat, and reloads them', () => {
    const storage = new MemoryStorage();
    const s = new PostcardStore(storage, 42);
    expect(s.add(card(2))).toBe(true);
    s.add(card(1));
    s.add({ ...card(2), day: 99 });
    expect(s.list().map((c) => c.age)).toEqual([1, 2]);
    expect(s.list()[1].day).toBe(99);
    expect(s.has(1)).toBe(true);
    expect(new PostcardStore(storage, 42).list()).toHaveLength(2);
    expect(new PostcardStore(storage, 43).list()).toHaveLength(0);
  });

  it('survives junk in storage and a store that refuses writes', () => {
    const storage = new MemoryStorage();
    storage.setItem('hearthwatt:postcards:7', '{nope');
    expect(new PostcardStore(storage, 7).list()).toEqual([]);
    storage.setItem('hearthwatt:postcards:7', JSON.stringify([card(1), { age: 'x' }, { ...card(2), image: 'javascript:1' }]));
    expect(new PostcardStore(storage, 7).list()).toHaveLength(1);
    const full = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => undefined };
    const s = new PostcardStore(full, 1);
    expect(s.add(card(1))).toBe(false);
    expect(s.has(1)).toBe(true);
    expect(new PostcardStore(null, 1).add(card(1))).toBe(false);
  });

  it('caps the album', () => {
    const s = new PostcardStore(new MemoryStorage(), 1);
    for (let a = 1; a <= 12; a++) s.add(card(a));
    expect(s.list()).toHaveLength(8);
    expect(s.list()[7].age).toBe(12);
  });
});

describe('postcardVantage', () => {
  const player = { x: 100, z: 100, eyeY: 70 };
  it('stands above and back from a near town and looks down at it', () => {
    const v = postcardVantage(player, [110, 90]);
    expect(v.y).toBeGreaterThan(player.eyeY);
    expect(v.pitch).toBeLessThan(0);
    // Looking along (-sin yaw, -cos yaw) from the camera lands on the site.
    const k = Math.hypot(v.x - 110, v.z - 90);
    expect(v.x - Math.sin(v.yaw) * k).toBeCloseTo(110, 5);
    expect(v.z - Math.cos(v.yaw) * k).toBeCloseTo(90, 5);
  });
  it('uses the player when there is no town or it is far away', () => {
    const none = postcardVantage(player, null);
    const far = postcardVantage(player, [1000, 1000]);
    expect(far).toEqual(none);
    expect(Math.hypot(none.x - 100, none.z - 100)).toBeGreaterThan(5);
  });
  it('captions with the age and day', () => {
    expect(postcardCaption('Bronze Age', 12)).toBe('Bronze Age - Day 12');
  });
});
