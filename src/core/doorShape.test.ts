import { describe, expect, it } from 'vitest';
import { Facing } from './types';
import { DOOR_MAX, DOOR_MIN, doorHandle, doorPanel } from './doorShape';

describe('door panel and handle by facing', () => {
  it('is thin across the facing axis when closed', () => {
    const north = doorPanel(Facing.North, false);
    expect(north.lo).toEqual([0, 0, DOOR_MIN]);
    expect(north.hi).toEqual([1, 1, DOOR_MAX]);
    const east = doorPanel(Facing.East, false);
    expect(east.lo).toEqual([DOOR_MIN, 0, 0]);
    expect(east.hi).toEqual([DOOR_MAX, 1, 1]);
  });

  it('is pushed against one edge when open', () => {
    const north = doorPanel(Facing.North, true);
    expect(north.lo).toEqual([0, 0, 0]);
    expect(north.hi[0]).toBeLessThan(0.5);
    expect(north.hi[2]).toBe(1);
  });

  it('puts the handle on the front side (North and West are negative)', () => {
    expect(doorHandle(Facing.North).hi[2]).toBeLessThanOrEqual(DOOR_MIN);
    expect(doorHandle(Facing.South).lo[2]).toBeGreaterThanOrEqual(DOOR_MAX);
    expect(doorHandle(Facing.West).hi[0]).toBeLessThanOrEqual(DOOR_MIN);
    expect(doorHandle(Facing.East).lo[0]).toBeGreaterThanOrEqual(DOOR_MAX);
  });
});
