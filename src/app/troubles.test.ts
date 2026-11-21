import { describe, expect, it } from 'vitest';
import { FAILED_FRAMES_IN_A_ROW, FAILED_FRAMES_IN_WINDOW, FAILURE_WINDOW_MS, FrameGuard, agoText } from './troubles';

describe('FrameGuard', () => {
  it('stops the world after a few failed frames in a row', () => {
    const g = new FrameGuard();
    for (let i = 1; i < FAILED_FRAMES_IN_A_ROW; i++) expect(g.fail(i * 16)).toBe(false);
    expect(g.fail(FAILED_FRAMES_IN_A_ROW * 16)).toBe(true);
  });

  it('a good frame resets the streak, but frequent failures within the window still stop it', () => {
    const g = new FrameGuard();
    let tripped = false;
    for (let i = 0; i < FAILED_FRAMES_IN_WINDOW; i++) {
      tripped = g.fail(i * 100);
      g.ok();
    }
    expect(tripped).toBe(true);
    const h = new FrameGuard();
    for (let i = 0; i < FAILED_FRAMES_IN_WINDOW * 3; i++) {
      expect(h.fail(i * (FAILURE_WINDOW_MS / 4))).toBe(false);
      h.ok();
    }
  });

  it('reset forgets everything', () => {
    const g = new FrameGuard();
    for (let i = 1; i < FAILED_FRAMES_IN_A_ROW; i++) g.fail(i);
    g.reset();
    expect(g.fail(100)).toBe(false);
  });
});

describe('agoText', () => {
  it('reads like a person would say it', () => {
    expect(agoText(0, 10_000)).toBe('just now');
    expect(agoText(0, 3 * 60_000)).toBe('3 min ago');
    expect(agoText(0, 3 * 3_600_000)).toBe('3 h ago');
    expect(agoText(0, 5 * 86_400_000)).toBe('5 days ago');
  });
});
