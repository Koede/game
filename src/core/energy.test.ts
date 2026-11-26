import { describe, expect, it } from 'vitest';
import { ENGINE_L_PER_BAR, ETA, HEAT_PORT_W, KETTLE_HEAT_W, STEAM_J_PER_L, W_PER_SU_RPM, WATER_PER_STEAM, suFromW, windmillW, wFromSu } from './energy';
import { ENGINE, engineOutput } from '../sim/boilers';
import { STEAM_ROTOR } from '../workshop/workshop';

/** The ledger: heat -> steam -> shaft, every arrow below 1 (tech-spine K3, 1.2). */
describe('the energy ledger', () => {
  it('converts shaft watts and stress units both ways', () => {
    expect(W_PER_SU_RPM).toBe(3.125);
    expect(wFromSu(4, 16)).toBe(200);
    expect(suFromW(200, 16)).toBe(4);
    expect(suFromW(100, 0)).toBe(0);
  });

  it('every efficiency is below 1', () => {
    for (const [name, eta] of Object.entries(ETA)) {
      const values = typeof eta === 'function' ? [2, 4, 6, 8, 12].map((b) => eta(b)) : [eta];
      for (const v of values) expect(v, name).toBeGreaterThan(0);
      for (const v of values) expect(v, name).toBeLessThan(1);
    }
  });

  it('the steam rotor gives no more shaft power than its eta of the heat the kettle draws', () => {
    const shaftW = wFromSu(STEAM_ROTOR.capacity, STEAM_ROTOR.rpm);
    expect(shaftW).toBe(200);
    expect(shaftW).toBeLessThanOrEqual(KETTLE_HEAT_W * ETA.rotor);
  });

  it('a beam engine never gives more than its eta of the steam heat it uses, at any pressure', () => {
    for (let bar = ENGINE.minBar; bar <= 12; bar += 0.25) {
      const out = engineOutput(bar);
      const steamHeatW = ENGINE_L_PER_BAR * bar * STEAM_J_PER_L;
      expect(wFromSu(out.capacity, out.rpm), `${bar} bar`).toBeLessThanOrEqual(steamHeatW * ETA.beamEngine(bar) + 1e-6);
    }
  });

  it('the worked example: one engine near 6 bar gives 6 su at 96 rpm, well under the 10 kW port', () => {
    const one = engineOutput(6);
    expect(one.rpm).toBe(96);
    expect(one.capacity).toBeCloseTo(6, 1);
    // 60 L/s of steam is 10 kW of heat (1 kW = 6 L/s).
    expect(HEAT_PORT_W / STEAM_J_PER_L).toBeCloseTo(60, 0);
    expect(wFromSu(one.capacity, one.rpm)).toBeLessThan(HEAT_PORT_W * 0.2);
  });

  it('chains of converters lose energy: heat to steam to shaft stays under one', () => {
    expect(ETA.beamEngine(6) * 1).toBeLessThan(1);
    expect(ETA.beamEngine(6) * ETA.dynamo).toBeLessThan(1);
    expect(ETA.compressor * ETA.steamHammer).toBeLessThan(1);
    expect(WATER_PER_STEAM).toBeLessThan(1);
  });

  it('a windmill, which has no fuel, stays in the plan power band (100 to 400 W)', () => {
    for (let w = 0; w <= 1; w += 0.1) {
      const rpm = 8 + 16 * w;
      const p = windmillW(w);
      expect(p).toBeGreaterThanOrEqual(100);
      expect(p).toBeLessThanOrEqual(400);
      expect(wFromSu(suFromW(p, rpm), rpm)).toBeCloseTo(p, 6);
    }
  });
});
