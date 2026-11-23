import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { OBJECTIVES } from '../core/registry';
import { FakeWorld } from './fakeWorld';
import { findNearestBlock, nudgeFor, stillThere } from './nextStep';
import { PlayerState } from './playerState';

const goal = (id: string) => OBJECTIVES.find((o) => o.id === id)!;
const fresh = () => new PlayerState(createBus());

describe('nudgeFor', () => {
  it('points a wood goal at logs', () => {
    const n = nudgeFor(fresh(), goal('gather_logs'))!;
    expect(n.text).toMatch(/^Break /);
    expect(n.target).toMatchObject({ kind: 'blocks' });
  });

  it('walks a recipe down to what can be mined, then up to the station', () => {
    const p = fresh();
    const quarry = nudgeFor(p, goal('collect_rubble'))!;
    expect(quarry.text).toMatch(/12 more Rubble/);
    // The clay furnace needs rubble and clay: with both held, the step is placing it.
    p.give('rubble', 12);
    p.give('clay', 6);
    const furnace = nudgeFor(p, goal('place_furnace'))!;
    expect(furnace.text).toMatch(/in your pack|Make/);
  });

  it('asks for the missing ingredient of a make goal, then the station that makes it', () => {
    const p = fresh();
    const n = nudgeFor(p, goal('make_pickaxe'))!;
    expect(n.text.length).toBeGreaterThan(0);
    p.give('flint', 3);
    p.give('stick', 2);
    p.give('cord', 1);
    const ready = nudgeFor(p, goal('make_pickaxe'))!;
    expect(ready.text).toMatch(/^Make Flint Pickaxe/);
  });

  it('says nothing when everything is done and falls back to the title for goals it cannot read', () => {
    expect(nudgeFor(fresh(), null)).toBeNull();
    const odd = { ...goal('gather_logs'), title: 'Do the thing', condition: { type: 'flag', flag: 'x' } as const };
    expect(nudgeFor(fresh(), odd)).toEqual({ text: 'Do the thing', target: null });
  });
});

describe('findNearestBlock', () => {
  it('finds the nearest of the keys and notices when it is gone', () => {
    const world = new FakeWorld();
    world.put(10, 20, 3, 'coal_ore');
    world.put(-4, 18, 2, 'coal_ore');
    world.put(3, 20, 0, 'stone');
    const at = findNearestBlock(world, { x: 0.5, y: 20, z: 0.5 }, ['coal_ore'])!;
    expect([at.x, at.y, at.z]).toEqual([-4, 18, 2]);
    expect(findNearestBlock(world, { x: 0.5, y: 20, z: 0.5 }, ['iron_ore'])).toBeNull();
    expect(stillThere(world, at, ['coal_ore'])).toBe(true);
    world.setVoxel(at.x, at.y, at.z, 0);
    expect(stillThere(world, at, ['coal_ore'])).toBe(false);
  });
});
