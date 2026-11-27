import { describe, expect, it } from 'vitest';
import { evictionIndex, shortenToast, toastDuration } from './toastPolicy';

describe('toast policy', () => {
  it('leaves short text alone and cuts long text at a word', () => {
    expect(shortenToast('Picked up a plank')).toBe('Picked up a plank');
    const long = shortenToast('Your pack is full, so the plank was left on the ground for you. '.repeat(4));
    expect(long.length).toBeLessThanOrEqual(130);
    const board = 'Gruk pins what he needs on the board. Hold the items and use the board to hand them in.';
    expect(shortenToast(board)).toBe(board);
    expect(long.endsWith('…')).toBe(true);
    expect(long).not.toMatch(/ …$/);
  });
  it('keeps warnings up longer than good news, and long text longer than short', () => {
    expect(toastDuration('warn', 20)).toBeGreaterThan(toastDuration('good', 20));
    expect(toastDuration('info', 48)).toBeGreaterThan(toastDuration('info', 10));
    expect(toastDuration('bad', 200)).toBeLessThanOrEqual(7200);
  });
  it('evicts the oldest calm toast before a warning', () => {
    expect(evictionIndex(['warn', 'info', 'bad'])).toBe(1);
    expect(evictionIndex(['warn', 'bad'])).toBe(0);
    expect(evictionIndex(['good', 'warn'])).toBe(0);
  });
});
