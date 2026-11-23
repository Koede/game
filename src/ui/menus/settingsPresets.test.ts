import { describe, expect, it } from 'vitest';
import { PHONE_MAX_RENDER_DISTANCE, defaultSettings } from '../../core/context';
import { PRESETS, applyPreset, detectPreset } from './settingsPresets';

describe('settings presets', () => {
  const base = defaultSettings(true);
  it('applies in one go and leaves the rest of the settings alone', () => {
    const next = applyPreset({ ...base, volume: 0.3, difficulty: 'hard', invertY: true }, 'phone-pretty', true);
    expect([next.renderDistance, next.fov]).toEqual([5, 75]);
    expect([next.volume, next.difficulty, next.invertY]).toEqual([0.3, 'hard', true]);
  });
  it('never gives a phone more than its render-distance limit', () => {
    for (const p of PRESETS) expect(applyPreset(base, p.id, true).renderDistance).toBeLessThanOrEqual(PHONE_MAX_RENDER_DISTANCE);
    expect(applyPreset(base, 'desktop', false).renderDistance).toBe(8);
  });
  it('recognises the preset in force, and none after a manual change', () => {
    for (const p of PRESETS) expect(detectPreset(applyPreset(base, p.id, true), true)).toBe(p.id);
    expect(detectPreset({ ...applyPreset(base, 'phone-light', true), fov: 90 }, true)).toBeNull();
  });
});
