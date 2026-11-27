import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { createWeatherState } from './weather';
import { WeatherSchedule } from './weatherSchedule';
import { FakeWorld } from './fakeWorld';
import { RADIO_MIN_W, RADIO_STORM_S, STORM_WIRE_S, TELEGRAPH_SPAN, Telegraph, isTelegraphSnapshot, stormDueIn, type TelegraphHost, type TelegraphSky } from './telegraph';

/** A sky with a fixed timetable: clear until `stormAt`, then a storm. */
function skyWithStormAt(stormAt: number): TelegraphSky {
  const segs = [
    { index: 0, kind: 'clear' as const, startS: 0, lengthS: stormAt, blendS: 10 },
    { index: 1, kind: 'storm' as const, startS: stormAt, lengthS: 600, blendS: 10 },
    { index: 2, kind: 'clear' as const, startS: stormAt + 600, lengthS: 1e6, blendS: 10 },
  ];
  const schedule = {
    segment: (i: number) => segs[Math.min(i, 2)],
    at: (t: number) => segs.find((s) => t < s.startS + s.lengthS) ?? segs[2],
  } as unknown as WeatherSchedule;
  return { state: createWeatherState(), schedule, override: null };
}

function rig(opts: { stormAt?: number; town?: [number, number, number] | null; watts?: number } = {}) {
  const bus = createBus();
  const world = new FakeWorld(bus);
  const toasts: string[] = [];
  bus.on('toast', (t) => void toasts.push(t.text));
  const out = new Map<string, boolean>();
  const lit = new Set<string>();
  let time = 0;
  let day = 1;
  let watts = opts.watts ?? 0;
  const sky = skyWithStormAt(opts.stormAt ?? 1e6);
  const host: TelegraphHost = {
    world, bus,
    sky: () => sky,
    now: () => time,
    day: () => day,
    town: () => (opts.town === undefined ? null : opts.town),
    powerW: () => watts,
    signalIn: (x, y, z) => lit.has(`${x},${y},${z}`),
    signalOut: (x, y, z, on) => void out.set(`${x},${y},${z}`, on),
    caravanDay: (d) => d === 3,
  };
  const tg = new Telegraph(host);
  return {
    world, tg, toasts, out, lit, sky,
    set time(t: number) { time = t; },
    set day(d: number) { day = d; },
    set watts(w: number) { watts = w; },
    run(s: number) { for (let i = 0; i < s * 20; i++) tg.tick(0.05); },
  };
}

describe('telegraph network', () => {
  it('joins poles and offices within the span into one network, and draws a spanning tree of lines', () => {
    const r = rig();
    r.world.put(0, 1, 0, 'telegraph_office');
    for (let x = 10; x <= 50; x += 10) r.world.put(x, 1, 0, 'telegraph_pole');
    r.world.put(60, 1, 0, 'telegraph_office');
    const v = r.tg.view(0, 1, 0);
    expect(v).toMatchObject({ offices: 2, poles: 5, masts: 0 });
    expect(v?.stations).toEqual([{ kind: 'office', x: 60, y: 1, z: 0, dist: 60 }]);
    expect(r.tg.lines()).toHaveLength(6);
    // A gap wider than the span cuts the line.
    r.world.put(30, 1, 0, 'air');
    expect(r.tg.view(0, 1, 0)?.offices).toBe(1);
    expect(r.tg.view(60, 1, 0)?.offices).toBe(1);
    expect(TELEGRAPH_SPAN).toBeLessThan(20);
  });

  it('a stacked post carries its lines from the top only', () => {
    const r = rig();
    for (const x of [0, 8]) for (let y = 1; y <= 3; y++) r.world.put(x, y, 0, 'telegraph_pole');
    expect(r.tg.view(0, 1, 0)?.poles).toBe(6);
    expect(r.tg.lines().map(([a, b]) => [a.y, b.y])).toEqual([[3, 3]]);
  });

  it('links powered radio masts far apart, and only while they have power', () => {
    const r = rig({ watts: 0 });
    r.world.put(0, 1, 0, 'telegraph_office');
    r.world.put(5, 1, 0, 'radio_mast');
    r.world.put(140, 1, 0, 'radio_mast');
    r.world.put(145, 1, 0, 'telegraph_office');
    r.run(1.1);
    expect(r.tg.view(0, 1, 0)?.offices).toBe(1);
    r.watts = RADIO_MIN_W;
    r.run(1.1);
    expect(r.tg.view(0, 1, 0)).toMatchObject({ offices: 2, masts: 2, onAir: 2, horizonS: RADIO_STORM_S });
    expect(r.tg.onAir(5, 1, 0)).toBe(true);
    // Radio links draw no copper line.
    expect(r.tg.lines()).toHaveLength(2);
  });

  it('warns once of a storm inside the horizon, and the storm-bell office lights its signal', () => {
    const r = rig({ stormAt: 1000 });
    r.world.put(0, 1, 0, 'telegraph_office');
    r.time = 1000 - STORM_WIRE_S - 60;
    r.run(1);
    expect(r.toasts.filter((t) => t.startsWith('Telegram'))).toEqual([]);
    expect(r.out.get('0,1,0') ?? false).toBe(false);
    r.time = 1000 - 300;
    r.run(1);
    expect(r.toasts.filter((t) => t.startsWith('Telegram'))).toEqual(['Telegram: Storm due in about 5 min. Cover exposed wiring and raise a lightning rod.']);
    expect(r.out.get('0,1,0')).toBe(true);
    expect(r.tg.busy(0, 1, 0)).toBe(true);
    r.run(2);
    expect(r.toasts.filter((t) => t.startsWith('Telegram'))).toHaveLength(1);
    r.time = 2000;
    r.run(1);
    expect(r.out.get('0,1,0')).toBe(false);
    expect(r.tg.telegrams()[0].text).toMatch(/Storm due/);
  });

  it('a sender lights every receiver on its line', () => {
    const r = rig();
    r.world.put(0, 1, 0, 'telegraph_office');
    r.world.put(8, 1, 0, 'telegraph_pole');
    r.world.put(16, 1, 0, 'telegraph_office');
    expect(r.tg.setMode(0, 1, 0, 'send')).toBe(true);
    expect(r.tg.setMode(16, 1, 0, 'receive')).toBe(true);
    expect(r.tg.setMode(8, 1, 0, 'send')).toBe(false);
    r.run(1);
    expect(r.out.get('16,1,0') ?? false).toBe(false);
    r.lit.add('0,1,0');
    r.run(1);
    expect(r.out.get('16,1,0')).toBe(true);
    expect(r.world.getVoxel(16, 1, 0) & (1 << 12)).not.toBe(0);
    r.lit.clear();
    r.run(1);
    expect(r.out.get('16,1,0')).toBe(false);
  });

  it('a line that reaches the town hears that the caravan is in', () => {
    const r = rig({ town: [100, 1, 0] });
    r.world.put(0, 1, 0, 'telegraph_office');
    r.run(1);
    expect(r.tg.view(0, 1, 0)?.town).toBe(false);
    for (let x = 10; x <= 80; x += 10) r.world.put(x, 1, 0, 'telegraph_pole');
    expect(r.tg.view(0, 1, 0)?.town).toBe(true);
    r.day = 3;
    r.run(2);
    expect(r.toasts.filter((t) => t.includes('caravan'))).toHaveLength(1);
  });

  it('saves and loads its nodes, modes and telegrams', () => {
    const r = rig({ stormAt: 400 });
    r.world.put(0, 1, 0, 'telegraph_office');
    r.world.put(4, 1, 0, 'telegraph_pole');
    r.tg.setMode(0, 1, 0, 'receive');
    r.time = 100;
    r.run(1);
    const snap = JSON.parse(JSON.stringify(r.tg.toJSON()));
    expect(isTelegraphSnapshot(snap)).toBe(true);
    const b = rig({ stormAt: 400 });
    b.world.put(0, 1, 0, 'telegraph_office');
    b.world.put(4, 1, 0, 'telegraph_pole');
    b.tg.load(snap);
    expect(b.tg.mode(0, 1, 0)).toBe('receive');
    expect(b.tg.view(0, 1, 0)?.poles).toBe(1);
    expect(b.tg.telegrams()).toEqual(r.tg.telegrams());
    b.tg.load({ v: 'nope' });
    expect(b.tg.size).toBe(2);
  });

  it('stormDueIn reads the timetable ahead, and an overhead storm is 0', () => {
    const sky = skyWithStormAt(1000);
    expect(stormDueIn(sky, 100, 600)).toBeNull();
    expect(stormDueIn(sky, 500, 600)).toBe(500);
    sky.state.kind = 'storm';
    sky.state.blend = 1;
    expect(stormDueIn(sky, 100, 600)).toBe(0);
  });
});
