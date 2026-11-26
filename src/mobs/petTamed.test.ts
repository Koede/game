/** Winning a stray over announces 'pet:tamed' (achievements and the journal listen) and plays its chirp, once. */
import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { creature } from '../core/registry';
import { MobManager } from './manager';
import { FlatWorld, TestClock } from './testKit';

describe('pet:tamed', () => {
  it('fires on the first gift only', () => {
    const bus = createBus();
    const mobs = new MobManager(new FlatWorld(10, 7, bus), bus, new TestClock(), 5, { naturalSpawning: false, biomeAt: () => 'woodland', spawn: null });
    const tamed: string[] = [];
    const sfx: string[] = [];
    bus.on('pet:tamed', (e) => tamed.push(e.species));
    bus.on('sfx', (e) => sfx.push(e.name));
    const dog = mobs.add(creature('dog'), { x: 3.5, y: 11, z: 0.5, yaw: 0 });
    expect(mobs.feed(dog.id, 'raw_chop')).toEqual({ ok: true });
    expect(mobs.feed(dog.id, 'raw_chop')).toEqual({ ok: true });
    expect(tamed).toEqual(['dog']);
    expect(sfx.filter((s) => s === 'pet_tamed')).toHaveLength(1);
  });
});
