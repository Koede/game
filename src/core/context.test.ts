import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, DESKTOP_RENDER_DISTANCE, PHONE_RENDER_DISTANCE, defaultSettings, isTouchFirst } from './context';

const device = (maxTouchPoints: number, coarse: boolean): void => {
  vi.stubGlobal('navigator', { maxTouchPoints });
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: coarse && q === '(pointer: coarse)' }));
};

describe('default settings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draws less on phones than on desktops and keeps every other default the same', () => {
    expect(PHONE_RENDER_DISTANCE).toBeLessThan(DESKTOP_RENDER_DISTANCE);
    const phone = defaultSettings(true);
    const desk = defaultSettings(false);
    expect(phone.renderDistance).toBe(PHONE_RENDER_DISTANCE);
    expect(desk.renderDistance).toBe(DESKTOP_RENDER_DISTANCE);
    expect(phone.autoStep).toBe(true);
    expect(desk.autoStep).toBe(false);
    expect({ ...phone, renderDistance: 0, autoStep: false }).toEqual({ ...desk, renderDistance: 0 });
  });

  it('treats only a touch screen with a coarse pointer as touch-first (not a touch laptop, not node)', () => {
    expect(DEFAULT_SETTINGS.renderDistance).toBe(DESKTOP_RENDER_DISTANCE);
    device(5, true);
    expect(isTouchFirst()).toBe(true);
    device(10, false);
    expect(isTouchFirst()).toBe(false);
    device(0, true);
    expect(isTouchFirst()).toBe(false);
  });
});
