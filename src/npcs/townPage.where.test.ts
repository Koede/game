import { describe, expect, it } from 'vitest';
import { whereIs } from './townPage';

describe('whereIs', () => {
  it('names the compass direction and distance (north is -Z, east is +X)', () => {
    expect(whereIs({ x: 0, z: 0 }, { x: 0, z: -45 })).toBe('45 blocks north');
    expect(whereIs({ x: 0, z: 0 }, { x: 30, z: 30 })).toBe('42 blocks south-east');
    expect(whereIs({ x: 0, z: 0 }, { x: -20, z: 0 })).toBe('20 blocks west');
    expect(whereIs({ x: 0, z: 0 }, { x: 1, z: 2 })).toBe('right here');
  });
});
