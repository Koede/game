import { describe, expect, it } from 'vitest';
import { itemOrNull } from '../core/registry';
import { aimGroundItem, dropLabel } from './groundAim';
import type { GroundItem } from './groundItems';

const drop = (id: number, item: string, x: number, y: number, z: number, count = 1): GroundItem => ({
  id, item, count, x, y, z, vx: 0, vy: 0, vz: 0, age: 0, delayS: 0, onGround: true, homing: false, pulled: false, phase: 0,
});

// The eye at (0, 1.6, 0) looking down -z. A drop's middle sits 0.15 above its feet, so feet at 1.45 are dead ahead.
const EYE = [0, 1.6, 0] as const;
const AHEAD = [0, 0, -1] as const;
const aim = (items: GroundItem[], maxDist = 4.5, blockDist = Infinity) => aimGroundItem(items, ...EYE, ...AHEAD, maxDist, blockDist);

describe('aimGroundItem', () => {
  it('names a drop the look ray passes through, and misses one off to the side', () => {
    const on = drop(1, 'rubble', 0, 1.45, -3);
    expect(aim([on])).toBe(on);
    expect(aim([drop(2, 'rubble', 1, 1.45, -3)])).toBeNull();
  });

  it('picks the nearest of several drops on the ray', () => {
    const far = drop(1, 'rubble', 0, 1.45, -4);
    const near = drop(2, 'dirt', 0, 1.45, -2);
    expect(aim([far, near])).toBe(near);
  });

  it('does not name a drop behind a block nearer than it, or one beyond the reach', () => {
    const d = drop(1, 'rubble', 0, 1.45, -3);
    expect(aim([d], 4.5, 2)).toBeNull();
    expect(aim([d], 4.5, 4)).toBe(d);
    expect(aim([drop(2, 'rubble', 0, 1.45, -9)], 4.5)).toBeNull();
    expect(aim([drop(3, 'rubble', 0, 1.45, 2)])).toBeNull();
  });
});

describe('dropLabel', () => {
  it('names a drop, with its count from two up, and gives its rarity colour only when it is not common', () => {
    expect(dropLabel('rubble', 1)).toEqual({ text: itemOrNull('rubble')?.name ?? 'rubble', rarity: null });
    expect(dropLabel('rubble', 12).text).toBe(`${itemOrNull('rubble')?.name ?? 'rubble'} ×12`);
    expect(dropLabel('orrins_spare_pick', 1).rarity).toBe('legendary');
  });
});
