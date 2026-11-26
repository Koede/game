import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import type { GridCell, NetworkStats } from '../sim';
import { gridOverlayFor, GRID_METER, meterReading, meterUse, METER_RANGE, MONITOR_RANGE, type GridSim } from './gridMeter';

const stats = (over: Partial<NetworkStats> = {}): NetworkStats => ({
  id: 1, generationW: 1000, demandW: 800, deliveredW: 800, storedJ: 0, capacityJ: 0, chargeW: 0, dischargeW: 0, storageRateW: 0, lossW: 0, chokedW: 0, shortW: 0,
  ratingW: 10_000, cables: 3, satisfaction: 1, overloaded: false, state: 'ok', members: [], historyG: [], historyUsed: [], ...over,
});

describe('meterReading', () => {
  it('says all is well with the figures', () => {
    expect(meterReading(stats())).toBe('Steady: 1 kW for 800 W, all at full power.');
  });
  it('names a brown-out and the percentage', () => {
    expect(meterReading(stats({ generationW: 2000, demandW: 3000, deliveredW: 2000, satisfaction: 2 / 3, state: 'brownout' })))
      .toBe('Brown-out: 2 kW of 3 kW, 66%.');
  });
  it('says machines stop below the stall point', () => {
    expect(meterReading(stats({ generationW: 100, demandW: 1000, satisfaction: 0.1, state: 'brownout' }))).toMatch(/^Stalled: 100 W of 1 kW, 10%/);
  });
  it('blames the cable on an overload', () => {
    expect(meterReading(stats({ generationW: 12_000, demandW: 20_000, satisfaction: 0.5, overloaded: true, state: 'overload' })))
      .toBe('Overload: cable carries 10 kW, 50% supplied.');
  });
  it('adds losses', () => {
    expect(meterReading(stats({ lossW: 150, chokedW: 50 }))).toMatch(/ 200 W lost\.$/);
  });
  it('counts what batteries feed as made', () => {
    expect(meterReading(stats({ generationW: 0, dischargeW: 300, demandW: 300, deliveredW: 300 }))).toMatch(/^Steady: 300 W for 300 W/);
  });
  it('an idle grid says so', () => {
    expect(meterReading(stats({ demandW: 0, deliveredW: 0 }))).toMatch(/^Idle: 1 kW made, nothing asks/);
  });
});

describe('meterReading night cover', () => {
  it('adds how long the batteries carry the load', () => {
    const text = meterReading(stats({ storedJ: 2_000_000, capacityJ: 2_000_000, storageRateW: 3000 }));
    expect(text).toMatch(/Steady: .*Lasts \d+ min unaided\.$|Lasts the night/);
  });
});

describe('meterUse', () => {
  const sim = (net: NetworkStats | null): GridSim => ({ networkAt: () => net, gridOverlay: () => ({ tick: 0, cells: [] }), monitorNear: () => null });
  const hit = (power: 'cable' | 'device' | null) => ({ x: 1, y: 2, z: 3, block: { power } });

  it('does nothing without the meter in hand, or without a target', () => {
    const bus = createBus();
    expect(meterUse(sim(stats()), bus, 'stick', hit('cable'))).toBeNull();
    expect(meterUse(sim(stats()), bus, GRID_METER, null)).toBeNull();
  });

  it('reads the network of a cable as a toast', () => {
    const bus = createBus();
    const toasts: Array<{ text: string; kind?: string }> = [];
    bus.on('toast', (t) => toasts.push(t));
    expect(meterUse(sim(stats()), bus, GRID_METER, hit('cable'))).toBe('worked');
    expect(toasts).toEqual([{ text: expect.stringMatching(/^Steady:/), kind: 'good' }]);
  });

  it('a trouble reading is a warning', () => {
    const bus = createBus();
    const kinds: Array<string | undefined> = [];
    bus.on('toast', (t) => kinds.push(t.kind));
    meterUse(sim(stats({ state: 'overload', overloaded: true })), bus, GRID_METER, hit('device'));
    meterUse(sim(stats({ state: 'brownout', satisfaction: 0.6 })), bus, GRID_METER, hit('device'));
    expect(kinds).toEqual(['bad', 'warn']);
  });

  it('refuses a plain block and a lone cable with advice', () => {
    const bus = createBus();
    const texts: string[] = [];
    bus.on('toast', (t) => texts.push(t.text));
    expect(meterUse(sim(null), bus, GRID_METER, hit(null))).toBe('refused');
    expect(meterUse(sim(null), bus, GRID_METER, hit('cable'))).toBe('refused');
    expect(texts).toEqual(['Aim the meter at a cable or a machine.', 'That one is not wired to anything yet.']);
  });
});

describe('gridOverlayFor', () => {
  const cells: GridCell[] = [];
  const calls: Array<[number, number | null]> = [];
  const sim = (monitor: number | null): GridSim => ({
    networkAt: () => null,
    gridOverlay: (_x, _y, _z, range, only) => {
      calls.push([range, only ?? null]);
      return { tick: 1, cells };
    },
    monitorNear: () => monitor,
  });

  it('a held meter shows every grid in a wide range', () => {
    calls.length = 0;
    expect(gridOverlayFor(sim(null), GRID_METER, 0, 0, 0)).not.toBeNull();
    expect(calls).toEqual([[METER_RANGE, null]]);
  });

  it('a monitor close by shows its own network in its range', () => {
    calls.length = 0;
    expect(gridOverlayFor(sim(7), 'stick', 0, 0, 0)).not.toBeNull();
    expect(calls).toEqual([[MONITOR_RANGE, 7]]);
  });

  it('is off with neither', () => {
    expect(gridOverlayFor(sim(null), null, 0, 0, 0)).toBeNull();
    expect(gridOverlayFor(sim(null), 'stick', 0, 0, 0)).toBeNull();
  });
});
