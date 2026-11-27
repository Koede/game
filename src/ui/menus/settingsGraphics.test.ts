import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '../../core/context';
import { sanitizeSettings } from '../../save/document';
import { GRAPHICS_PROFILES, GRAPHICS_QUALITIES } from '../../render/quality';
import { GRAPHICS_OPTIONS, graphicsHint } from './settingsText';

const base = (): Settings => defaultSettings(false, false);

describe('graphics setting', () => {
  it('offers Low, Medium and High in that order, one for every quality level', () => {
    expect(GRAPHICS_OPTIONS.map((o) => o.value)).toEqual([...GRAPHICS_QUALITIES]);
    expect(GRAPHICS_OPTIONS.map((o) => o.label)).toEqual(['Low', 'Medium', 'High']);
  });

  it('every level has its own hint, and the hint for Low names what it switches off', () => {
    const hints = GRAPHICS_QUALITIES.map((q) => graphicsHint(q));
    expect(new Set(hints).size).toBe(GRAPHICS_QUALITIES.length);
    expect(graphicsHint('low')).toMatch(/no water waves/);
    expect(graphicsHint('low')).toMatch(/no loot beams/);
    expect(graphicsHint('low')).toMatch(/half speed/);
    expect(GRAPHICS_PROFILES.low.liquidRate).toBeLessThan(1);
  });

  it('a missing (older save) or unknown level reads as Medium, and its hint is Medium', () => {
    expect(graphicsHint(undefined)).toBe(graphicsHint('normal'));
    expect(sanitizeSettings({ ...base(), graphics: 'ultra' }).graphics).toBe('normal');
    const older: Record<string, unknown> = { ...base() };
    delete older.graphics;
    expect(sanitizeSettings(older).graphics).toBe('normal');
  });

  it('round-trips through the save format for each level, and survives a JSON write and read', () => {
    for (const option of GRAPHICS_OPTIONS) {
      const saved = JSON.parse(JSON.stringify({ ...base(), graphics: option.value })) as unknown;
      expect(sanitizeSettings(saved).graphics).toBe(option.value);
    }
  });
});
