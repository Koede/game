import { describe, expect, it } from 'vitest';
import { block } from '../core/registry';
import { recipe } from '../core/registry';

describe('wooden door content', () => {
  it('is a solid door-shaped block', () => {
    const def = block('wooden_door');
    expect(def.shape).toBe('door');
    expect(def.solid).toBe(true);
    expect(def.opaque).toBe(false);
    expect(def.oriented).toBe(true);
  });

  it('has a hand recipe that makes one door from planks and sticks', () => {
    const r = recipe('wooden_door');
    expect(r).not.toBeNull();
    expect(r?.station).toBe('hand');
    expect(r?.output.item).toBe('wooden_door');
  });
});
