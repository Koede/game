import { describe, expect, it } from 'vitest';
import { LAND_DIP_FROM, LAND_DIP_MAX, SHAKE_HURT, SHAKE_MAX, Shake, landingDip, settle } from './cameraFx';

describe('camera effects', () => {
  it('dips only for real falls and never more than the cap', () => {
    expect(landingDip(0.3)).toBe(0);
    expect(landingDip(LAND_DIP_FROM)).toBe(0);
    expect(landingDip(1.5)).toBeGreaterThan(0);
    expect(landingDip(3)).toBeGreaterThan(landingDip(1.5));
    expect(landingDip(40)).toBe(LAND_DIP_MAX);
  });

  it('settles to exactly zero', () => {
    let v = 0.1;
    for (let i = 0; i < 200; i++) v = settle(v, 9, 1 / 60);
    expect(v).toBe(0);
  });

  it('shakes on events, is capped, and dies away to stillness', () => {
    const s = new Shake();
    s.update(1 / 60);
    expect(Math.abs(s.yaw) + Math.abs(s.pitch)).toBe(0);
    for (let i = 0; i < 10; i++) s.add(SHAKE_HURT);
    expect(s.amount).toBe(SHAKE_MAX);
    s.update(1 / 60);
    expect(Math.abs(s.yaw) + Math.abs(s.pitch)).toBeGreaterThan(0);
    for (let i = 0; i < 300; i++) s.update(1 / 60);
    expect(Math.abs(s.yaw) + Math.abs(s.pitch)).toBe(0);
  });
});
