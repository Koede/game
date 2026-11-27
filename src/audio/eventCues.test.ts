import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { bindEventCues } from './eventCues';

function heard() {
  const bus = createBus();
  const sounds: GameEvents['sfx'][] = [];
  bus.on('sfx', (s) => sounds.push(s));
  const off = bindEventCues(bus);
  return { bus, sounds, off };
}

describe('event cues', () => {
  it('voices the photo shutter, a blueprint, a buff and a legendary proc', () => {
    const { bus, sounds } = heard();
    bus.emit('photo:snap', {});
    bus.emit('blueprint:grant', { id: 'bp' });
    bus.emit('buff:gained', { buff: 'well_fed', durationS: 60 });
    bus.emit('legendary:proc', { effect: 'lunge', x: 1, y: 2, z: 3 });
    expect(sounds.map((s) => s.name)).toEqual(['shutter', 'blueprint_unfurl', 'buff_gain', 'legend_proc']);
    expect(sounds[3]).toMatchObject({ x: 1, y: 2, z: 3 });
  });

  it('marks the power returning or sagging, and a hearth falling in', () => {
    const { bus, sounds } = heard();
    bus.emit('power:alert', { kind: 'recovered', message: '', x: 1, y: 1, z: 1 });
    bus.emit('power:alert', { kind: 'brownout', message: '', x: 1, y: 1, z: 1 });
    bus.emit('power:alert', { kind: 'overload', message: '', x: 1, y: 1, z: 1 });
    bus.emit('hearth:unformed', { x: 4, y: 5, z: 6 });
    expect(sounds.map((s) => s.name)).toEqual(['machine_on', 'machine_off', 'fire_out']);
  });

  it('stops when unbound', () => {
    const { bus, sounds, off } = heard();
    off();
    bus.emit('photo:snap', {});
    expect(sounds).toEqual([]);
  });
});
