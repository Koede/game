import { describe, expect, it } from 'vitest';
import { evictionIndex, shortenToast, toastDuration } from './toastPolicy';

describe('toast policy', () => {
  it('leaves short text alone and cuts long text at a word', () => {
    expect(shortenToast('Picked up a plank')).toBe('Picked up a plank');
    const long = shortenToast('Your pack is full, so the plank was left on the ground for you');
    expect(long.length).toBeLessThanOrEqual(48);
    expect(long.endsWith('…')).toBe(true);
    expect(long).not.toMatch(/ …$/);
  });
  it('keeps warnings up longer than good news, and long text longer than short', () => {
    expect(toastDuration('warn', 20)).toBeGreaterThan(toastDuration('good', 20));
    expect(toastDuration('info', 48)).toBeGreaterThan(toastDuration('info', 10));
    expect(toastDuration('bad', 200)).toBeLessThanOrEqual(4800);
  });
  it('evicts the oldest calm toast before a warning', () => {
    expect(evictionIndex(['warn', 'info', 'bad'])).toBe(1);
    expect(evictionIndex(['warn', 'bad'])).toBe(0);
    expect(evictionIndex(['good', 'warn'])).toBe(0);
  });
});
