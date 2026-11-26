import { describe, expect, it } from 'vitest';
import { FakeWorld } from '../game/fakeWorld';
import { checkRoom } from './housing';

// A 3x3 bedroom: floor y=0, walls on x=0/4 and z=0/4, roof at y=height+1, interior x 1..3, z 1..3, y 1..height.
// Bed in the corner (1,1,1), a table at (3,1,3), a torch at (2,height,2), a crate standing in for a door at (0,1,2).
// The crate is passed as the door key (content has no door block yet).
const DOORS = new Set(['crate']);

function bedroom(height = 3, size = 3): FakeWorld {
  const w = new FakeWorld();
  const far = size + 1;
  w.fill(0, 0, 0, far, 0, far, 'plank');
  w.fill(0, 1, 0, far, height + 1, far, 'plank');
  w.fill(1, 1, 1, size, height, size, 'air');
  w.put(1, 1, 1, 'wool_bedding');
  w.put(size, 1, size, 'dining_table');
  w.put(2, height, 2, 'torch');
  w.put(0, 1, 2, 'crate');
  return w;
}

describe('checkRoom', () => {
  it('passes a 3x3 room with a door, a light, a bed and a table', () => {
    const r = checkRoom(bedroom(), 1, 1, 1, { doors: DOORS });
    expect(r.ok).toBe(true);
    expect(r.reasons).toEqual([]);
    expect(r.cells).toBe(25); // 27 interior cells less the bed and the table
  });

  it('fails with needs a door when there is no door block', () => {
    const w = bedroom();
    w.put(0, 1, 2, 'plank');
    expect(checkRoom(w, 1, 1, 1, { doors: DOORS }).reasons).toEqual(['needs a door']);
  });

  it('fails with needs a light when nothing in or beside the room gives light', () => {
    const w = bedroom();
    w.put(2, 3, 2, 'air');
    expect(checkRoom(w, 1, 1, 1, { doors: DOORS }).reasons).toEqual(['needs a light']);
  });

  it('fails with needs a seat or table when no table or bench is there', () => {
    const w = bedroom();
    w.put(3, 1, 3, 'air');
    expect(checkRoom(w, 1, 1, 1, { doors: DOORS }).reasons).toEqual(['needs a seat or table']);
  });

  it('fails with needs a bed when the position is not a bed', () => {
    const r = checkRoom(bedroom(), 2, 1, 2, { doors: DOORS });
    expect(r).toEqual({ ok: false, reasons: ['needs a bed'], cells: 0 });
  });

  it('fails too small: a 2 x 3 room has no 3 x 3 floor', () => {
    const w = new FakeWorld();
    w.fill(0, 0, 0, 4, 0, 4, 'plank');
    w.fill(0, 1, 0, 4, 4, 4, 'plank');
    w.fill(1, 1, 1, 2, 3, 3, 'air');
    w.put(1, 1, 1, 'wool_bedding');
    w.put(2, 1, 3, 'dining_table');
    w.put(2, 3, 2, 'torch');
    w.put(0, 1, 2, 'crate');
    const r = checkRoom(w, 1, 1, 1, { doors: DOORS });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain('too small');
  });

  it('fails too low: height 2 is under 3', () => {
    const r = checkRoom(bedroom(2), 1, 1, 1, { doors: DOORS });
    expect(r.ok).toBe(false);
    expect(r.reasons).toEqual(['too low']);
  });

  it('fails not enclosed when a wall has a gap to outside', () => {
    const w = bedroom();
    w.put(0, 2, 2, 'air');
    const r = checkRoom(w, 1, 1, 1, { doors: DOORS });
    expect(r.ok).toBe(false);
    expect(r.reasons).toEqual(['not enclosed']);
  });

  it('fails too large: a huge hall is not a bedroom', () => {
    const w = new FakeWorld();
    const n = 20;
    w.fill(0, 0, 0, n + 1, 0, n + 1, 'plank');
    w.fill(0, 1, 0, n + 1, 5, n + 1, 'plank');
    w.fill(1, 1, 1, n, 4, n, 'air');
    w.put(1, 1, 1, 'wool_bedding');
    w.put(2, 1, 1, 'dining_table');
    w.put(3, 4, 3, 'torch');
    w.put(0, 1, 2, 'crate');
    const r = checkRoom(w, 1, 1, 1, { doors: DOORS });
    expect(r.ok).toBe(false);
    expect(r.reasons).toEqual(['too large']);
    expect(r.cells).toBeGreaterThan(300);
  });

  it('defaults to no door keys, so a bedroom needs a door block that exists', () => {
    expect(checkRoom(bedroom(), 1, 1, 1).reasons).toContain('needs a door');
  });
});
