import { describe, expect, it } from 'vitest';
import { Ambience } from './ambience';
import { type AmbienceState, computeTargets, createAmbienceState, createAmbienceTargets, UNDERWATER_CUTOFF_HZ } from './ambienceState';
import { BufferBank } from './buffers';
import { FakeAudioContext, FakeFilter, FakeGain, FakeOscillator, FakeParam } from './fakeAudio';
import { MUFFLE_OPEN_HZ } from './master';

const targets = (patch: Partial<AmbienceState>) => computeTargets({ ...createAmbienceState(), ...patch }, createAmbienceTargets());

describe('ambience targets', () => {
  it('is completely silent for the default state', () => {
    const t = targets({});
    for (const level of [t.fire, t.arc, t.machine, t.wind, t.whistle, t.night, t.water, t.ignition, t.rain, t.rainBody, t.gust, t.boil]) expect(level).toBe(0);
    expect(t.muffle).toBe(MUFFLE_OPEN_HZ);
  });

  it('a cold furnace makes no sound however close it is', () => {
    expect(targets({ furnaceHeat: 0, furnaceDistance: 0 }).fire).toBe(0);
  });

  it('the fire fades with distance and is gone beyond earshot', () => {
    const at = (d: number) => targets({ furnaceHeat: 0.6, furnaceDistance: d }).fire;
    expect(at(0)).toBe(1);
    expect(at(1)).toBe(1);
    expect(at(6)).toBeLessThan(at(1));
    expect(at(14)).toBeLessThan(at(6));
    expect(at(14)).toBeGreaterThan(0);
    expect(at(22)).toBe(0);
    expect(at(500)).toBe(0);
  });

  it('a hotter fire roars louder, brighter and crackles more', () => {
    const low = targets({ furnaceHeat: 0.15, furnaceDistance: 2 });
    const high = targets({ furnaceHeat: 0.95, furnaceDistance: 2 });
    expect(high.roar).toBeGreaterThan(low.roar);
    expect(high.roarCutoff).toBeGreaterThan(low.roarCutoff * 2);
    expect(high.flameFreq).toBeGreaterThan(low.flameFreq);
    expect(high.crackleDense).toBeGreaterThan(low.crackleDense);
    expect(low.crackle).toBeGreaterThan(0.5);
  });

  it('only an electric furnace arcs, and it burns more quietly', () => {
    const fire = targets({ furnaceHeat: 0.7, furnaceDistance: 3 });
    const electric = targets({ furnaceHeat: 0.7, furnaceDistance: 3, furnaceElectric: true });
    expect(fire.arc).toBe(0);
    expect(electric.arc).toBeGreaterThan(0.3);
    expect(electric.crackle).toBeLessThan(fire.crackle);
    expect(targets({ furnaceHeat: 0, furnaceElectric: true }).arc).toBe(0);
  });

  it('wind grows with exposure and whistles when cold', () => {
    expect(targets({ wind: 0.9 }).wind).toBeGreaterThan(targets({ wind: 0.3 }).wind);
    expect(targets({ wind: 0.8 }).whistle).toBe(0);
    expect(targets({ wind: 0.8, cold: 0.7 }).whistle).toBeGreaterThan(0);
  });

  it('being under water closes the muffle and shuts the weather out', () => {
    const t = targets({ underwater: true, wind: 1, cold: 1, night: true, machineHum: 1 });
    expect(t.muffle).toBe(UNDERWATER_CUTOFF_HZ);
    expect(t.water).toBe(1);
    expect(t.wind).toBe(0);
    expect(t.whistle).toBe(0);
    expect(t.night).toBe(0);
    expect(t.machine).toBeLessThan(1);
    const dry = targets({ furnaceHeat: 0.8, furnaceDistance: 2, furnaceElectric: true });
    const wet = targets({ furnaceHeat: 0.8, furnaceDistance: 2, furnaceElectric: true, underwater: true });
    expect(wet.fire).toBeLessThan(dry.fire / 2);
    expect(wet.arc).toBeLessThan(dry.arc / 2);
  });

  it('rain hisses louder and heavier as it strengthens, and drums dully on a roof', () => {
    const light = targets({ rain: 0.3 });
    const heavy = targets({ rain: 1 });
    const roofed = targets({ rain: 1, sheltered: true });
    expect(heavy.rain).toBeGreaterThan(light.rain);
    expect(heavy.rainBody).toBeGreaterThan(light.rainBody * 5);
    expect(roofed.rain).toBeGreaterThan(0);
    expect(roofed.rain).toBeLessThan(heavy.rain);
    expect(roofed.rainCutoff).toBeLessThan(heavy.rainCutoff / 3);
    expect(targets({ rain: 1, underwater: true }).rain).toBe(0);
  });

  it('boiling follows its level and is shut out under water', () => {
    expect(targets({ boil: 0 }).boil).toBe(0);
    expect(targets({ boil: 0.8 }).boil).toBeGreaterThan(targets({ boil: 0.3 }).boil);
    expect(targets({ boil: 5 }).boil).toBe(1);
    expect(targets({ boil: 1, underwater: true }).boil).toBe(0);
  });

  it('storm gusts follow the storm, softened indoors and gone under water', () => {
    expect(targets({ storm: 0 }).gust).toBe(0);
    expect(targets({ storm: 1 }).gust).toBeGreaterThan(targets({ storm: 0.4 }).gust);
    expect(targets({ storm: 1, sheltered: true }).gust).toBeLessThan(targets({ storm: 1 }).gust);
    expect(targets({ storm: 1, underwater: true }).gust).toBe(0);
  });

  it('the ignition chord climbs to its final pitch and opens up', () => {
    const start = targets({ ignition: 0.01 });
    const mid = targets({ ignition: 0.5 });
    const end = targets({ ignition: 1 });
    expect(targets({ ignition: 0 }).ignition).toBe(0);
    expect(start.ignition).toBeGreaterThan(0.2);
    expect(start.ignitionDetune).toBeLessThan(mid.ignitionDetune);
    expect(end.ignitionDetune).toBeCloseTo(0);
    expect(end.ignition).toBe(1);
    expect(end.ignitionCutoff).toBeGreaterThan(mid.ignitionCutoff);
  });

  it('clamps out-of-range and non-numeric input instead of propagating it', () => {
    const t = targets({ furnaceHeat: 7, furnaceDistance: -3, machineHum: NaN, wind: -2, cold: 9, ignition: Infinity });
    for (const v of Object.values(t)) expect(Number.isFinite(v)).toBe(true);
    const lost = targets({ furnaceHeat: NaN, furnaceDistance: NaN, wind: NaN, cold: NaN, ignition: NaN });
    for (const v of Object.values(lost)) expect(Number.isFinite(v)).toBe(true);
    expect(targets({ furnaceHeat: 0.5, furnaceDistance: NaN }).fire).toBe(0);
    expect(t.fire).toBe(1);
    expect(t.machine).toBe(0);
    expect(t.wind).toBe(0);
    expect(t.ignition).toBe(1);
  });
});

function rig() {
  const ctx = new FakeAudioContext();
  const out = ctx.createGain();
  const muffle = ctx.createBiquadFilter();
  const ambience = new Ambience(ctx, new BufferBank(ctx), out, muffle);
  return { ctx, out, muffle, ambience };
}

const everything: AmbienceState = {
  furnaceHeat: 0.8,
  furnaceDistance: 3,
  furnaceElectric: true,
  machineHum: 0.6,
  wind: 0.7,
  night: true,
  underwater: false,
  cold: 0.5,
  ignition: 0.4,
  rain: 0.6,
  storm: 0.5,
  sheltered: false,
  boil: 0.7,
};

describe('Ambience', () => {
  it('builds nothing while there is nothing to hear', () => {
    const { ctx, ambience } = rig();
    const before = ctx.nodes.length;
    for (let i = 0; i < 100; i++) {
      ctx.currentTime += 0.05;
      ambience.update(createAmbienceState(), ctx.currentTime);
    }
    expect(ctx.nodes.length).toBe(before);
    expect(ctx.sources.length).toBe(0);
  });

  it('builds a layer the first time it is needed and keeps it', () => {
    const { ctx, ambience } = rig();
    ambience.update({ ...createAmbienceState(), furnaceHeat: 0.5, furnaceDistance: 2 }, 1);
    const fireOnly = ctx.nodes.length;
    expect(ctx.sources.length).toBeGreaterThan(0);
    for (const s of ctx.sources) expect(s.startedAt).not.toBeNull();
    ambience.update(everything, 2);
    const all = ctx.nodes.length;
    expect(all).toBeGreaterThan(fireOnly);
    ambience.update(createAmbienceState(), 3);
    ambience.update(everything, 4);
    expect(ctx.nodes.length).toBe(all);
  });

  it('survives 10,000 updates without creating nodes or piling up automation', () => {
    const { ctx, ambience } = rig();
    const state = { ...everything };
    // Two primers so that every layer, including the underwater one, exists before counting.
    ambience.update({ ...state, underwater: true }, -2);
    ambience.update(state, -1);
    ctx.currentTime = 5;
    ambience.update(state, ctx.currentTime);
    const nodes = ctx.nodes.length;
    const buffers = ctx.buffersCreated;
    const events = () => ctx.nodes.reduce((n, node) => n + Object.values(node).reduce((m, f) => m + (f instanceof FakeParam ? f.events.length : 0), 0), 0);
    const baseline = events();
    for (let i = 1; i <= 10000; i++) {
      ctx.currentTime += 1 / 60;
      ambience.update(state, ctx.currentTime);
    }
    expect(ctx.nodes.length).toBe(nodes);
    expect(ctx.buffersCreated).toBe(buffers);
    // Nothing changed, so nothing may have been re-scheduled.
    expect(events()).toBe(baseline);

    for (let i = 1; i <= 10000; i++) {
      ctx.currentTime += 1 / 60;
      state.furnaceHeat = 0.5 + 0.5 * Math.sin(i / 200);
      state.furnaceDistance = 6 + 5 * Math.sin(i / 90);
      state.wind = (i % 500) / 500;
      state.underwater = i % 1000 > 900;
      state.night = i % 3000 > 1500;
      state.rain = (i % 700) / 700;
      state.sheltered = i % 2000 > 1000;
      ambience.update(state, ctx.currentTime);
    }
    expect(ctx.nodes.length).toBe(nodes);
    expect(ctx.buffersCreated).toBe(buffers);
  });

  it('only ever glides parameters once a layer exists (no jumps, no clicks)', () => {
    const { ctx, muffle, ambience } = rig();
    ambience.update(everything, 0);
    const marks = new Map<FakeParam, number>();
    for (const node of ctx.nodes) for (const f of Object.values(node)) if (f instanceof FakeParam) marks.set(f, f.events.length);
    ambience.update({ ...everything, furnaceHeat: 0.1, underwater: true, wind: 0, ignition: 0.9 }, 1);
    ambience.update(createAmbienceState(), 2);
    let moved = 0;
    for (const [param, from] of marks) {
      for (const e of param.events.slice(from)) {
        expect(e.kind).toBe('target');
        expect(Number.isFinite(e.value)).toBe(true);
        moved++;
      }
    }
    expect(moved).toBeGreaterThan(10);
    expect((muffle as FakeFilter).frequency.events.map((e) => e.value)).toEqual([UNDERWATER_CUTOFF_HZ, MUFFLE_OPEN_HZ]);
  });

  it('brings every layer back to silence when the state goes quiet', () => {
    const { ctx, out, ambience } = rig();
    ambience.update(everything, 0);
    ambience.update(createAmbienceState(), 1);
    const buses = ctx.nodes.filter((n): n is FakeGain => n instanceof FakeGain && n.outputs.includes(out));
    expect(buses.length).toBeGreaterThanOrEqual(8);
    for (const bus of buses) {
      const last = bus.gain.events[bus.gain.events.length - 1];
      expect(last.value).toBe(0);
    }
  });

  it('raises the ignition chord by detuning its oscillators upwards', () => {
    const { ctx, ambience } = rig();
    ambience.update({ ...createAmbienceState(), ignition: 0.1 }, 0);
    ambience.update({ ...createAmbienceState(), ignition: 0.9 }, 1);
    const voices = ctx.nodes.filter((n): n is FakeOscillator => n instanceof FakeOscillator && n.detune.events.length > 0);
    expect(voices.length).toBeGreaterThanOrEqual(5);
    for (const v of voices) {
      const [first, second] = v.detune.events;
      expect(second.value).toBeGreaterThan(first.value);
      expect(second.value).toBeLessThanOrEqual(0);
    }
  });

  it('ignores updates that arrive faster than parameters can usefully move', () => {
    const { ctx, ambience } = rig();
    ambience.update({ ...createAmbienceState(), wind: 0.5 }, 5);
    const nodes = ctx.nodes.length;
    ambience.update(everything, 5.001);
    expect(ctx.nodes.length).toBe(nodes);
    ambience.update(everything, 5.1);
    expect(ctx.nodes.length).toBeGreaterThan(nodes);
  });

  it('stops every source on dispose', () => {
    const { ctx, ambience } = rig();
    ambience.update(everything, 0);
    ambience.dispose();
    for (const s of ctx.sources) {
      expect(s.stoppedAt).not.toBeNull();
      expect(s.disconnected).toBe(true);
    }
  });
});
