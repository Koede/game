import { describe, expect, it } from 'vitest';
import { PhotoCamera, shotCaption, shotFileName, shotLayout, type PhotoInput } from './photoCam';

const idle: PhotoInput = { moveX: 0, moveZ: 0, up: false, fast: false, lookYaw: 0, lookPitch: 0 };

describe('PhotoCamera', () => {
  it('does nothing until entered, then flies where it looks', () => {
    const c = new PhotoCamera();
    c.update(1, { ...idle, moveZ: 1 });
    expect(c.x).toBe(0);
    c.enter(10, 70, 10, 0, 0);
    c.update(1, { ...idle, moveZ: 1 });
    expect(c.z).toBeLessThan(10);
    expect(c.x).toBeCloseTo(10, 6);
    expect(c.y).toBeCloseTo(70, 6);
  });

  it('pitches up and moves up, and sprints faster', () => {
    const slow = new PhotoCamera();
    const fast = new PhotoCamera();
    slow.enter(0, 0, 0, 0, 1);
    fast.enter(0, 0, 0, 0, 1);
    slow.update(1, { ...idle, moveZ: 1 });
    fast.update(1, { ...idle, moveZ: 1, fast: true });
    expect(slow.y).toBeGreaterThan(0);
    expect(fast.y).toBeCloseTo(slow.y * 3, 6);
    slow.update(0, { ...idle, lookPitch: 9 });
    expect(slow.pitch).toBeLessThan(Math.PI / 2);
  });

  it('strafes sideways at right angles to the view', () => {
    const c = new PhotoCamera();
    c.enter(0, 0, 0, 0, 0);
    c.update(1, { ...idle, moveX: 1 });
    expect(c.x).toBeGreaterThan(0);
    expect(c.z).toBeCloseTo(0, 6);
  });
});

describe('shot frame', () => {
  it('leaves a border and a caption strip around the picture', () => {
    const l = shotLayout(1280, 720);
    expect(l.picture).toEqual({ x: l.picture.x, y: l.picture.x, w: 1280, h: 720 });
    expect(l.width).toBe(1280 + 2 * l.picture.x);
    expect(l.height).toBeGreaterThan(720 + 2 * l.picture.x);
    expect(l.captionY).toBeLessThan(l.height);
    expect(l.captionY).toBeGreaterThan(l.picture.y + 720);
  });

  it('names the caption and the file', () => {
    expect(shotCaption(12, 'evening')).toBe('Hearthwatt - Day 12, evening');
    expect(shotFileName(3, 99)).toBe('hearthwatt-day3-99.png');
  });
});
