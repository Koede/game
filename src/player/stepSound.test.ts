import { describe, expect, it } from 'vitest';
import { SFX } from '../audio/sfx';
import { patchDuration } from '../audio/patch';
import { block } from '../core/registry';
import { stepSound } from './blockRules';

describe('stepSound', () => {
  it('gives stone, wood, sand, snow and metal their own footsteps; earth keeps the plain one', () => {
    expect(stepSound(block('stone'))).toBe('step_stone');
    expect(stepSound(block('plank'))).toBe('step_wood');
    expect(stepSound(block('sand'))).toBe('step_sand');
    expect(stepSound(block('snow'))).toBe('step_snow');
    expect(stepSound(block('dirt'))).toBe('step');
  });

  it('every footstep has a short patch', () => {
    for (const n of ['step_stone', 'step_wood', 'step_sand', 'step_snow', 'step_metal'] as const) expect(patchDuration(SFX[n]), n).toBeLessThan(0.3);
  });
});
