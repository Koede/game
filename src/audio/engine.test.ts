import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBus, DEFAULT_SETTINGS, type GameBus, type Settings } from '../core/context';
import { mulberry32 } from '../core/math';
import { createAmbienceState } from './ambienceState';
import { AudioEngine, MAX_VOICES } from './engine';
import { FakeAudioContext, FakeGain, FakeOscillator, FakePanner } from './fakeAudio';
import { SFX_NAMES } from './sfx';

interface Rig {
  bus: GameBus;
  settings: Settings;
  ctx: FakeAudioContext;
  engine: AudioEngine;
  created: () => number;
}

function setup(volume = 0.8): Rig {
  const bus = createBus();
  const settings: Settings = { ...DEFAULT_SETTINGS, volume };
  const ctx = new FakeAudioContext();
  let created = 0;
  const engine = new AudioEngine(bus, settings, {
    createContext: () => {
      created++;
      return ctx;
    },
    random: mulberry32(1),
  });
  return { bus, settings, ctx, engine, created: () => created };
}

const hot = { ...createAmbienceState(), furnaceHeat: 0.7, furnaceDistance: 2, wind: 0.4, night: true };

afterEach(() => vi.restoreAllMocks());

describe('AudioEngine before and without audio', () => {
  it('ignores everything before resume() and creates no context', () => {
    const { bus, engine, ctx, created } = setup();
    expect(() => {
      for (const name of SFX_NAMES) bus.emit('sfx', { name, x: 1, y: 2, z: 3 });
      engine.setListener(0, 0, 0, 0);
      engine.setAmbience(hot);
      bus.emit('settings:changed', {});
      bus.emit('game:paused', { paused: true });
      bus.emit('game:paused', { paused: false });
    }).not.toThrow();
    expect(created()).toBe(0);
    expect(ctx.nodes.length).toBe(0);
    expect(engine.running).toBe(false);
  });

  it('is a silent no-op when the platform has no AudioContext', () => {
    const bus = createBus();
    const engine = new AudioEngine(bus, { ...DEFAULT_SETTINGS });
    expect(() => {
      engine.resume();
      engine.resume();
      for (const name of SFX_NAMES) bus.emit('sfx', { name });
      engine.setListener(1, 2, 3, 0.5);
      engine.setAmbience(hot);
      bus.emit('settings:changed', {});
      bus.emit('game:paused', { paused: true });
      engine.dispose();
      engine.resume();
    }).not.toThrow();
    expect(engine.running).toBe(false);
  });

  it('is a silent no-op when creating the context throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const bus = createBus();
    let attempts = 0;
    const engine = new AudioEngine(bus, { ...DEFAULT_SETTINGS }, {
      createContext: () => {
        attempts++;
        throw new Error('NotSupportedError');
      },
    });
    expect(() => {
      engine.resume();
      engine.resume();
      bus.emit('sfx', { name: 'forge' });
      engine.setAmbience(hot);
    }).not.toThrow();
    expect(attempts).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(engine.running).toBe(false);
  });

  it('plays nothing while the context is still suspended', () => {
    const { bus, engine, ctx } = setup();
    engine.resume();
    ctx.state = 'suspended';
    bus.emit('sfx', { name: 'forge' });
    engine.setAmbience(hot);
    expect(ctx.sources.length).toBe(0);
  });
});

describe('AudioEngine one-shots', () => {
  it.each(SFX_NAMES)('plays %s from the bus: sources start and are scheduled to stop', (name) => {
    const { bus, engine, ctx } = setup();
    engine.resume();
    expect(engine.running).toBe(true);
    bus.emit('sfx', { name });
    expect(ctx.sources.length).toBeGreaterThan(0);
    for (const s of ctx.sources) {
      expect(s.startedAt).not.toBeNull();
      expect(s.stoppedAt as number).toBeGreaterThan(s.startedAt as number);
    }
    expect(engine.activeVoices).toBe(1);
    for (const v of ctx.allParamValues()) expect(Number.isFinite(v)).toBe(true);
  });

  it('routes the output through master gain, compressor and clipper', () => {
    const { engine, ctx } = setup();
    engine.resume();
    expect(ctx.count('compressor')).toBe(1);
    expect(ctx.count('shaper')).toBe(1);
    const clip = ctx.nodes.find((n) => n.kind === 'shaper');
    expect(clip?.outputs).toEqual([ctx.destination]);
    // Nothing else may reach the speakers directly.
    expect(ctx.nodes.filter((n) => n.outputs.includes(ctx.destination)).length).toBe(1);
  });

  it('produces no sources at volume 0', () => {
    const { bus, engine, ctx } = setup(0);
    engine.resume();
    for (const name of SFX_NAMES) bus.emit('sfx', { name });
    for (let i = 0; i < 20; i++) engine.setAmbience(hot);
    expect(ctx.sources.length).toBe(0);
    expect(ctx.buffersCreated).toBe(0);
    expect(engine.activeVoices).toBe(0);
  });

  it('produces no sources for a request with volume 0, and honours the volume field', () => {
    const { bus, engine, ctx } = setup();
    engine.resume();
    bus.emit('sfx', { name: 'forge', volume: 0 });
    bus.emit('sfx', { name: 'forge', volume: NaN });
    expect(ctx.sources.length).toBe(0);
    const before = ctx.nodes.length;
    bus.emit('sfx', { name: 'forge', volume: 0.25 });
    expect((ctx.nodes[before] as FakeGain).gain.value).toBeCloseTo(0.25);
  });

  it('scales one-shots by the effects and music sliders, and leaves interface sounds alone', () => {
    const { bus, engine, ctx, settings } = setup();
    engine.resume();
    settings.effectsVolume = 0.5;
    settings.musicVolume = 0.25;
    const level = (name: 'forge' | 'jukebox_note' | 'ui_click') => {
      const before = ctx.nodes.length;
      bus.emit('sfx', { name, volume: 1 });
      return (ctx.nodes[before] as FakeGain).gain.value;
    };
    expect(level('forge')).toBeCloseTo(0.5);
    expect(level('jukebox_note')).toBeCloseTo(0.25);
    expect(level('ui_click')).toBeCloseTo(1);
    settings.effectsVolume = 0;
    const sources = ctx.sources.length;
    bus.emit('sfx', { name: 'explosion' });
    expect(ctx.sources.length).toBe(sources); // a silenced effects slider starts nothing
  });

  it('honours the pitch field and ignores nonsense pitches', () => {
    const first = (pitch?: number) => {
      const { bus, engine, ctx } = setup();
      engine.resume();
      bus.emit('sfx', { name: 'ui_click', pitch });
      return ctx.nodes.find((n): n is FakeOscillator => n instanceof FakeOscillator)?.frequency.events[0].value;
    };
    expect(first()).toBeCloseTo(1100);
    expect(first(2)).toBeCloseTo(2200);
    expect(first(0.5)).toBeCloseTo(550);
    expect(first(NaN)).toBeCloseTo(1100);
    expect(first(-1)).toBeCloseTo(1100);
  });

  it('varies the pitch of repeated physical sounds', () => {
    const { bus, engine, ctx } = setup();
    engine.resume();
    const pitches: number[] = [];
    for (let i = 0; i < 6; i++) {
      ctx.currentTime += 0.3;
      const from = ctx.nodes.length;
      bus.emit('sfx', { name: 'step' });
      const osc = ctx.nodes.slice(from).find((n): n is FakeOscillator => n instanceof FakeOscillator);
      pitches.push(osc?.frequency.events[0].value ?? 0);
    }
    expect(new Set(pitches.map((p) => p.toFixed(3))).size).toBe(6);
    for (const p of pitches) {
      expect(p).toBeGreaterThan(96 / 1.2);
      expect(p).toBeLessThan(96 * 1.2);
    }
  });

  it('ignores the same sound fired again within 30 ms', () => {
    const { bus, engine, ctx } = setup();
    engine.resume();
    bus.emit('sfx', { name: 'dig_stone' });
    const once = ctx.sources.length;
    bus.emit('sfx', { name: 'dig_stone' });
    ctx.currentTime += 0.02;
    bus.emit('sfx', { name: 'dig_stone' });
    expect(ctx.sources.length).toBe(once);
    bus.emit('sfx', { name: 'dig_dirt' });
    expect(ctx.sources.length).toBeGreaterThan(once);
    const twoSounds = ctx.sources.length;
    ctx.currentTime += 0.011;
    bus.emit('sfx', { name: 'dig_stone' });
    expect(ctx.sources.length).toBe(twoSounds + once);
  });

  it('never exceeds the voice limit: the oldest voice is cut short to make room', () => {
    const { bus, engine, ctx } = setup();
    engine.resume();
    for (let i = 0; i < 60; i++) {
      ctx.currentTime += 0.04;
      bus.emit('sfx', { name: 'splash' });
      expect(engine.activeVoices).toBeLessThanOrEqual(MAX_VOICES);
    }
    // Splashes last ~0.5 s, so only about a dozen overlap: nothing needed stealing yet.
    expect(engine.activeVoices).toBeLessThan(MAX_VOICES);

    for (let i = 0; i < 60; i++) {
      ctx.currentTime += 0.04;
      bus.emit('sfx', { name: 'fire_out' });
      bus.emit('sfx', { name: 'bellows' });
      bus.emit('sfx', { name: 'smelt_done' });
      expect(engine.activeVoices).toBeLessThanOrEqual(MAX_VOICES);
    }
    expect(engine.activeVoices).toBe(MAX_VOICES);
    const now = ctx.currentTime;
    const sounding = ctx.sources.filter((s) => (s.stoppedAt as number) > now + 0.06).length;
    // At most 24 voices of at most 5 sources each can still be scheduled to sound.
    expect(sounding).toBeLessThanOrEqual(MAX_VOICES * 5);
  });

  it('never cuts an important sound for a minor one', () => {
    const { bus, engine, ctx } = setup();
    engine.resume();
    for (let i = 0; i < MAX_VOICES; i++) {
      ctx.currentTime += 0.04;
      bus.emit('sfx', { name: 'win' });
    }
    expect(engine.activeVoices).toBe(MAX_VOICES);
    const before = ctx.nodes.length;
    const stops = ctx.sources.map((s) => s.stoppedAt);
    ctx.currentTime += 0.04;
    bus.emit('sfx', { name: 'step' });
    expect(ctx.nodes.length).toBe(before);
    expect(ctx.sources.map((s) => s.stoppedAt)).toEqual(stops);
  });

  it('releases finished voices', () => {
    const { bus, engine, ctx } = setup();
    engine.resume();
    bus.emit('sfx', { name: 'ui_click' });
    const voiceOut = ctx.nodes.find((n) => n instanceof FakeGain && n.outputs.length === 1 && ctx.nodes.indexOf(n) > 6);
    expect(engine.activeVoices).toBe(1);
    ctx.currentTime += 1;
    engine.setAmbience(createAmbienceState());
    expect(engine.activeVoices).toBe(0);
    expect(voiceOut?.disconnected).toBe(true);
  });
});

describe('AudioEngine positioning', () => {
  const played = (rig: Rig, request: { x: number; y: number; z: number }) => {
    const from = rig.ctx.nodes.length;
    rig.ctx.currentTime += 0.1;
    rig.bus.emit('sfx', { name: 'forge', ...request });
    return rig.ctx.nodes.slice(from);
  };

  it('skips sounds beyond hearing range and attenuates with distance', () => {
    const rig = setup();
    rig.engine.resume();
    rig.engine.setListener(10, 40, 10, 0);
    expect(played(rig, { x: 10, y: 40, z: 40 }).length).toBe(0);
    expect(played(rig, { x: NaN, y: 40, z: 10 }).length).toBe(0);
    const near = played(rig, { x: 10, y: 40, z: 9 })[0] as FakeGain;
    const mid = played(rig, { x: 10, y: 40, z: 0 })[0] as FakeGain;
    const far = played(rig, { x: 10, y: 40, z: -12 })[0] as FakeGain;
    expect(near.gain.value).toBe(1);
    expect(mid.gain.value).toBeLessThan(1);
    expect(far.gain.value).toBeLessThan(mid.gain.value);
    expect(far.gain.value).toBeGreaterThan(0);
  });

  it('pans by where the sound is relative to where the player looks', () => {
    const rig = setup();
    rig.engine.resume();
    const pan = (yaw: number, x: number, z: number) => {
      rig.engine.setListener(0, 0, 0, yaw);
      const p = played(rig, { x, y: 0, z }).find((n): n is FakePanner => n instanceof FakePanner);
      return p ? p.pan.value : 0;
    };
    // Looking north (-Z): east is to the right, west to the left, straight ahead is centred.
    expect(pan(0, 8, 0)).toBeGreaterThan(0.5);
    expect(pan(0, -8, 0)).toBeLessThan(-0.5);
    expect(pan(0, 0, -8)).toBe(0);
    // Turned a quarter left to face west (-X): north is now on the right.
    expect(pan(Math.PI / 2, 0, -8)).toBeGreaterThan(0.5);
    expect(pan(Math.PI / 2, 0, 8)).toBeLessThan(-0.5);
    for (const v of [pan(1, 3, 4), pan(2, -20, 1), pan(-4, 0.1, 0.1)]) expect(Math.abs(v)).toBeLessThanOrEqual(0.8);
  });

  it('never positions interface sounds', () => {
    const rig = setup();
    rig.engine.resume();
    rig.engine.setListener(0, 0, 0, 0);
    rig.bus.emit('sfx', { name: 'ui_click', x: 500, y: 0, z: 0 });
    expect(rig.ctx.sources.length).toBeGreaterThan(0);
    expect(rig.ctx.count('panner')).toBe(0);
  });
});

describe('AudioEngine volume, pause and lifecycle', () => {
  it('follows settings.volume on settings:changed', () => {
    const { bus, engine, ctx, settings } = setup(1);
    engine.resume();
    const master = ctx.nodes[0] as FakeGain;
    const full = master.gain.value;
    expect(full).toBeGreaterThan(0);
    expect(full).toBeLessThanOrEqual(1);
    settings.volume = 0.5;
    bus.emit('settings:changed', {});
    const half = master.gain.events[master.gain.events.length - 1];
    expect(half.kind).toBe('target');
    expect(half.value).toBeCloseTo(full / 4);
    settings.volume = 0;
    bus.emit('settings:changed', {});
    expect(master.gain.events[master.gain.events.length - 1].value).toBe(0);
  });

  it('mutes the world while paused but keeps interface sounds', () => {
    const { bus, engine, ctx } = setup();
    engine.resume();
    const world = ctx.nodes[1] as FakeGain;
    bus.emit('game:paused', { paused: true });
    expect(world.gain.events[world.gain.events.length - 1]).toMatchObject({ kind: 'target', value: 0 });
    for (const name of ['forge', 'explosion', 'step', 'alarm'] as const) bus.emit('sfx', { name });
    expect(ctx.sources.length).toBe(0);
    bus.emit('sfx', { name: 'ui_click' });
    bus.emit('sfx', { name: 'error' });
    expect(ctx.sources.length).toBeGreaterThan(0);
    const ui = ctx.nodes[2] as FakeGain;
    expect(ui.gain.events.length).toBe(0);
    bus.emit('game:paused', { paused: false });
    expect(world.gain.events[world.gain.events.length - 1]).toMatchObject({ kind: 'target', value: 1 });
    const before = ctx.sources.length;
    bus.emit('sfx', { name: 'forge' });
    expect(ctx.sources.length).toBeGreaterThan(before);
  });

  it('starts muted if the game was paused before audio was unlocked', () => {
    const { bus, engine, ctx } = setup();
    bus.emit('game:paused', { paused: true });
    engine.resume();
    expect((ctx.nodes[1] as FakeGain).gain.value).toBe(0);
  });

  it('drives the ambience every frame without creating nodes each call', () => {
    const { engine, ctx } = setup();
    engine.resume();
    const state = { ...hot };
    // Sample data is generated one buffer per call before the first layer is built.
    engine.setAmbience(state);
    expect(ctx.buffersCreated).toBe(1);
    expect(ctx.sources.length).toBe(0);
    for (let i = 0; i < 10; i++) engine.setAmbience(state);
    expect(ctx.buffersCreated).toBe(7);
    const nodes = ctx.nodes.length;
    expect(ctx.sources.length).toBeGreaterThan(0);
    for (let i = 0; i < 10000; i++) {
      ctx.currentTime += 1 / 60;
      state.furnaceDistance = 2 + (i % 600) / 50;
      state.furnaceHeat = 0.3 + 0.6 * ((i % 1000) / 1000);
      engine.setAmbience(state);
    }
    expect(ctx.nodes.length).toBe(nodes);
  });

  it('survives garbage in the ambience state', () => {
    const { engine } = setup();
    engine.resume();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => {
      for (let i = 0; i < 20; i++) {
        engine.setAmbience({ ...hot, furnaceHeat: NaN, furnaceDistance: NaN, wind: Infinity, cold: -Infinity, ignition: NaN, machineHum: 1e9 });
      }
    }).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it('resume() is idempotent', () => {
    const { engine, ctx, created } = setup();
    engine.resume();
    const nodes = ctx.nodes.length;
    engine.resume();
    engine.resume();
    expect(created()).toBe(1);
    expect(ctx.nodes.length).toBe(nodes);
  });

  it('dispose stops everything, closes the context and detaches from the bus', () => {
    const { bus, engine, ctx } = setup();
    engine.resume();
    for (let i = 0; i < 10; i++) engine.setAmbience(hot);
    bus.emit('sfx', { name: 'win' });
    expect(ctx.sources.filter((s) => s.stoppedAt === null).length).toBeGreaterThan(0);
    engine.dispose();
    expect(ctx.state).toBe('closed');
    for (const s of ctx.sources) expect(s.stoppedAt).not.toBeNull();
    const nodes = ctx.nodes.length;
    expect(() => {
      bus.emit('sfx', { name: 'forge' });
      bus.emit('settings:changed', {});
      bus.emit('game:paused', { paused: true });
      engine.setAmbience(hot);
      engine.resume();
      engine.dispose();
    }).not.toThrow();
    expect(ctx.nodes.length).toBe(nodes);
    expect(engine.running).toBe(false);
  });
});
