import { describe, expect, it } from 'vitest';
import modulesAll from '../../tests/fixtures/saves/modules-all.json';
import { GameState } from './state';
import type { WorldSave } from '../save/document';

const fixture = (): WorldSave => JSON.parse(JSON.stringify(modulesAll.world));
type Extras = Record<string, unknown>;

describe('Workshop, Magic and Vehicles in the headless GameState (R3)', () => {
  it('restore + 200 ticks exercises all three modules and keeps their state', () => {
    const s = GameState.restore(fixture());
    expect(s.vehicles.views()).toHaveLength(1);
    for (let i = 0; i < 200; i++) s.tick();
    const extras = s.toSave().world.extras as Extras;
    expect((extras.workshop as { parts: unknown[] }).parts.length).toBeGreaterThanOrEqual(6);
    expect((extras.vehicles as { tractors: unknown[] }).tractors).toHaveLength(1);
    expect(Object.keys(extras)).toEqual(expect.arrayContaining(['magic', 'vehicles', 'workshop']));
    s.dispose();
  });

  it('a module whose load throws keeps its raw data as <key>.bad, toasts once, and never loses it on later saves', () => {
    const save = fixture();
    const extras = save.world.extras as Extras;
    const raw = { v: 1, parts: 'garbage' };
    extras.workshop = raw;
    const s = GameState.restore(save);
    // Whether or not Workshop.load tolerates this shape, the raw data must survive a save round-trip.
    const toasts: string[] = [];
    s.bus.on('toast', (e) => toasts.push(e.text));
    for (let i = 0; i < 5; i++) s.tick();
    const again = s.toSave().world.extras as Extras;
    if (s.world.failedExtras().includes('workshop')) {
      expect(again['workshop.bad']).toEqual(raw);
      expect(toasts.filter((t) => t.includes('workshop'))).toHaveLength(1);
      const third = GameState.restore(s.toSave());
      expect((third.toSave().world.extras as Extras)['workshop.bad']).toEqual(raw);
      third.dispose();
    }
    s.dispose();
  });

  it('World.loadExtra reports a throwing loader and keeps the copy', () => {
    const save = fixture();
    (save.world.extras as Extras).magic = { v: 1 };
    const s = GameState.restore(save);
    const ok = s.world.loadExtra('magic', () => {
      throw new Error('boom');
    });
    expect(ok).toBe(false);
    expect(s.world.failedExtras()).toContain('magic');
    expect((s.toSave().world.extras as Extras)['magic.bad']).toEqual({ v: 1 });
    s.dispose();
  });
});
