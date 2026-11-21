import { describe, expect, it } from 'vitest';
import { Face } from '../core/types';
import { FakeWorld } from '../game/fakeWorld';
import { pipeArmMask, pipeSideAt } from './pipeAim';

/** A bronze chute at (0, 10, 0) with a pipe to the east and a crate to the north. */
function line(): FakeWorld {
  const w = new FakeWorld();
  w.put(0, 10, 0, 'item_pipe');
  w.put(1, 10, 0, 'item_pipe');
  w.put(0, 10, -1, 'crate');
  w.put(0, 9, 0, 'stone');
  return w;
}

/** Side aimed at by a ray from `from` towards the cell-local point `at` of the pipe at (0, 10, 0). */
function aim(w: FakeWorld, from: [number, number, number], at: [number, number, number], entered: Face): Face {
  const [ox, oy, oz] = from;
  return pipeSideAt(w, 0, 10, 0, ox, oy, oz, at[0] - ox, 10 + at[1] - oy, at[2] - oz, entered);
}

describe('pipeSideAt', () => {
  it('knows the arms: pipes and endpoints of its family, not plain blocks', () => {
    expect(pipeArmMask(line(), 0, 10, 0)).toBe((1 << Face.PX) | (1 << Face.NZ));
  });

  it('an arm aimed at from above gives that arm', () => {
    const w = line();
    expect(aim(w, [0.9, 12.5, 0.5], [0.9, 0.75, 0.5], Face.PY)).toBe(Face.PX);
    expect(aim(w, [0.5, 12.5, 0.1], [0.5, 0.75, 0.1], Face.PY)).toBe(Face.NZ);
  });

  it('an arm aimed at from the side, through the core plane, gives the arm', () => {
    const w = line();
    // Standing south-east, looking north-west at the east arm's side.
    expect(aim(w, [0.85, 10.5, 3], [0.85, 0.5, 0.5], Face.PZ)).toBe(Face.PX);
  });

  it('the core gives the core face turned to the player', () => {
    const w = line();
    expect(aim(w, [-3, 10.5, 0.5], [0.5, 0.5, 0.5], Face.NX)).toBe(Face.NX);
    expect(aim(w, [0.5, 13, 0.5], [0.5, 0.5, 0.5], Face.PY)).toBe(Face.PY);
    expect(aim(w, [0.5, 10.5, 4], [0.5, 0.5, 0.5], Face.PZ)).toBe(Face.PZ);
  });

  it('a ray past both core and arms picks the nearest side', () => {
    const w = new FakeWorld();
    w.put(0, 10, 0, 'item_pipe');
    // Grazes the west edge of the cell, top to bottom.
    expect(aim(w, [0.03, 13, 0.5], [0.03, 0.2, 0.5], Face.PY)).toBe(Face.NX);
    // Just south of the core (inside the aim margin of no arm): the south side.
    expect(aim(w, [0.5, 13, 0.79], [0.5, 0.5, 0.79], Face.PY)).toBe(Face.PZ);
  });
});
