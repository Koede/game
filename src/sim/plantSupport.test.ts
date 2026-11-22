import { describe, expect, it } from 'vitest';
import { FakeWorld } from '../game/fakeWorld';
import { PlantSupport } from './plantSupport';

describe('PlantSupport queue', () => {
  it('queues a cell once and checks it once on the next flush', () => {
    const q = new PlantSupport();
    q.queue(1, 2, 3);
    q.queue(1, 2, 3);
    expect(q.size).toBe(1);
    const seen: string[] = [];
    const n = q.flush(new FakeWorld(), (x, y, z) => (seen.push(`${x},${y},${z}`), true), 64);
    expect(seen).toEqual(['1,2,3']);
    expect(n).toBe(1);
    expect(q.size).toBe(0);
  });

  it('takes a cell out of the queue whether or not it popped', () => {
    const q = new PlantSupport();
    q.queue(0, 5, 0);
    expect(q.flush(new FakeWorld(), () => false, 64)).toBe(0);
    expect(q.size).toBe(0);
  });

  it('checks at most `max` cells per tick and leaves the rest for later', () => {
    const q = new PlantSupport();
    for (let i = 0; i < 5; i++) q.queue(i, 5, 0);
    expect(q.flush(new FakeWorld(), () => true, 2)).toBe(2);
    expect(q.size).toBe(3);
    expect(q.flush(new FakeWorld(), () => true, 64)).toBe(3);
  });

  it('drops cells whose chunk is not loaded (the crop is checked again when the chunk loads)', () => {
    const q = new PlantSupport();
    q.queue(0, 5, 0);
    const world = new FakeWorld();
    world.isLoaded = () => false;
    let called = 0;
    expect(q.flush(world, () => (called++, true), 64)).toBe(0);
    expect(called).toBe(0);
    expect(q.size).toBe(0);
  });
});
