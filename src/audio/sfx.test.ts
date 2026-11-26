import { describe, expect, it } from 'vitest';
import { DISTILL_SFX } from './sfxDistill';
import { EXPLORE_SFX } from './sfxExplore';
import { MAGIC_SFX } from './sfxMagic';
import type { SfxName } from '../core/gameEvents';
import { BufferBank } from './buffers';
import { FakeAudioContext, FakeGain, FakeOscillator } from './fakeAudio';
import { patchDuration, playPatch, type Patch } from './patch';
import { SFX, SFX_NAMES } from './sfx';
import type { AudioCtxLike, RealtimeCtxLike } from './types';

// Compile-time proof that the browser's own contexts fit the minimal interfaces the module is written against.
export const realtimeFits = (c: AudioContext): RealtimeCtxLike => c;
export const offlineFits = (c: OfflineAudioContext): AudioCtxLike => c;

function render(patch: Patch, pitch = 1, gain = 1, when = 1) {
  const ctx = new FakeAudioContext();
  const out = ctx.createGain();
  const played = playPatch(ctx, new BufferBank(ctx), patch, out, { when, gain, pitch, random: () => 0.5 });
  return { ctx, out, played };
}

describe('sound definitions', () => {
  it('covers every sound exactly once with a distinct patch', () => {
    // 72 before Essentia & Research added six (src/audio/sfxMagic.ts); the distillery adds three (src/audio/sfxDistill.ts).
    expect(SFX_NAMES.length).toBe(72 + 5 /* surface footsteps, sfxWorld.ts */ + Object.keys(MAGIC_SFX).length + Object.keys(DISTILL_SFX).length + Object.keys(EXPLORE_SFX).length + 3); // + jukebox_note (sfxCues.ts), + tree_creak and tree_chop (sfxVehicle.ts)
    expect(Object.keys(EXPLORE_SFX).sort()).toEqual(['fish_bite', 'fish_cast', 'fish_land', 'pet_tamed', 'treasure_found', 'waypoint_travel']);
    expect(Object.keys(DISTILL_SFX).sort()).toEqual(['distill_bubble', 'distill_chime', 'distill_drip', 'distill_tap', 'distill_trickle']);
    const seen = new Set(SFX_NAMES.map((name) => JSON.stringify(SFX[name].layers)));
    expect(seen.size).toBe(SFX_NAMES.length);
  });

  it.each(SFX_NAMES)('%s starts at least one source and schedules its stop', (name) => {
    const when = 1;
    const { ctx, out, played } = render(SFX[name], 1, 1, when);
    const sources = ctx.sources;
    expect(sources.length).toBeGreaterThan(0);
    expect(played.sources.length).toBe(sources.length);
    for (const s of sources) {
      expect(s.startedAt).not.toBeNull();
      expect(s.startedAt as number).toBeGreaterThanOrEqual(when);
      expect(s.stoppedAt).not.toBeNull();
      expect(s.stoppedAt as number).toBeGreaterThan(s.startedAt as number);
      expect(s.stoppedAt as number).toBeLessThanOrEqual(played.end);
    }
    expect(played.end - when).toBeCloseTo(patchDuration(SFX[name]), 6);
    // Something must actually reach the output.
    expect(ctx.nodes.some((n) => n.outputs.includes(out))).toBe(true);
  });

  it.each(SFX_NAMES)('%s only schedules finite, sane parameter values', (name) => {
    const { ctx } = render(SFX[name]);
    for (const v of ctx.allParamValues()) expect(Number.isFinite(v)).toBe(true);
    for (const node of ctx.nodes) {
      if (node instanceof FakeOscillator) {
        for (const e of node.frequency.events) {
          expect(e.value).toBeGreaterThanOrEqual(20);
          expect(e.value).toBeLessThanOrEqual(ctx.sampleRate / 2);
        }
      }
      if (node instanceof FakeGain) {
        // Exponential ramps cannot reach zero: every one must aim at a positive value.
        for (const e of node.gain.events) if (e.kind === 'exponential') expect(e.value).toBeGreaterThan(0);
      }
    }
  });

  it('every envelope starts and ends silent, so nothing clicks', () => {
    for (const name of SFX_NAMES) {
      const patch = SFX[name];
      const { ctx } = render(patch);
      const envelopes = ctx.nodes.filter((n): n is FakeGain => n instanceof FakeGain && n.gain.events[0]?.kind === 'set' && n.gain.events[0].value === 0);
      expect(envelopes.length, name).toBe(patch.layers.length);
      for (const env of envelopes) {
        const last = env.gain.events[env.gain.events.length - 1];
        expect(last.kind, name).toBe('linear');
        expect(last.value, name).toBe(0);
      }
    }
  });

  it('keeps sounds as short as their role calls for', () => {
    const under = (names: SfxName[], seconds: number) => {
      for (const name of names) expect(patchDuration(SFX[name]), name).toBeLessThan(seconds);
    };
    under(['ui_click', 'ui_open', 'ui_close'], 0.12);
    under(['error', 'pickup', 'craft', 'place', 'jump', 'step', 'land'], 0.3);
    under(['dig_stone', 'dig_dirt', 'dig_wood', 'dig_sand', 'dig_metal', 'break'], 0.25);
    under(['explosion', 'age', 'death', 'alarm', 'upgrade', 'ignite'], 3);
    under(['eat', 'till', 'plant', 'harvest', 'mob_hurt'], 0.35);
    under(['hen', 'goat', 'boar', 'scoop_lava'], 0.7);
    under(['steam_hiss'], 1.6);
    under(['pipe_clunk'], 0.2);
    // Brewing: a bubble and a drip are tiny, a sip short, the pour a gentle second.
    under(['boil_bubble', 'drip', 'distill_bubble', 'distill_drip', 'distill_trickle', 'distill_tap'], 0.2);
    under(['distill_chime'], 0.45);
    under(['sip'], 0.45);
    under(['pour'], 0.9);
    under(['hearth_formed'], 2.5);
    // Automatons (spec 19.5): footsteps and hits are frequent, so short; the telegraph spans a typical wind-up.
    under(['automaton_step', 'automaton_hurt', 'arc_zap'], 0.45);
    under(['automaton_attack', 'ember_bolt', 'automaton_windup'], 0.7);
    under(['automaton_wake', 'automaton_break'], 1.1);
    expect(patchDuration(SFX.automaton_windup)).toBeGreaterThan(0.5);
    under(SFX_NAMES, 4.5);
    expect(patchDuration(SFX.explosion)).toBeGreaterThan(2);
    // Thunder rolls on long after the flash.
    expect(patchDuration(SFX.thunder)).toBeGreaterThan(3);
    // A hearth forming is an event: the shimmer outlasts the whoomph.
    expect(patchDuration(SFX.hearth_formed)).toBeGreaterThan(1);
  });

  it('marks exactly the interface sounds as UI', () => {
    const ui = SFX_NAMES.filter((name) => SFX[name].ui === true).sort();
    expect(ui).toEqual(['error', 'ui_click', 'ui_close', 'ui_open']);
  });

  it('gives repeated physical sounds a random pitch spread', () => {
    for (const name of ['step', 'dig_stone', 'dig_dirt', 'dig_wood', 'dig_sand', 'dig_metal', 'eat', 'till', 'plant', 'harvest', 'hen', 'goat', 'boar', 'mob_hurt', 'thunder', 'steam_hiss', 'scoop_lava', 'pipe_clunk',
      'automaton_step', 'automaton_hurt', 'automaton_attack', 'ember_bolt', 'arc_zap', 'boil_bubble', 'pour', 'drip', 'sip',
      'distill_bubble', 'distill_drip', 'distill_chime', 'distill_trickle', 'distill_tap'] as const) {
      expect(SFX[name].jitter ?? 0, name).toBeGreaterThan(0);
    }
  });

  it('scales oscillator frequencies with the pitch option', () => {
    const base = render(SFX.ui_click, 1).ctx.nodes.find((n): n is FakeOscillator => n instanceof FakeOscillator);
    const high = render(SFX.ui_click, 2).ctx.nodes.find((n): n is FakeOscillator => n instanceof FakeOscillator);
    expect(base?.frequency.events[0].value).toBeCloseTo(1100);
    expect(high?.frequency.events[0].value).toBeCloseTo(2200);
  });

  it('scales envelope peaks with the gain option and builds nothing at gain 0', () => {
    const peak = (gain: number) => {
      const { ctx } = render(SFX.place, 1, gain);
      return Math.max(...ctx.nodes.filter((n): n is FakeGain => n instanceof FakeGain).flatMap((n) => n.gain.events.map((e) => e.value)));
    };
    expect(peak(0.5)).toBeCloseTo(peak(1) / 2);
    const silent = render(SFX.objective, 1, 0);
    expect(silent.ctx.sources.length).toBe(0);
    expect(silent.played.sources.length).toBe(0);
  });

  it('keeps individual layer levels within a sane range', () => {
    for (const name of SFX_NAMES) {
      for (const layer of SFX[name].layers) {
        expect(layer.gain, name).toBeGreaterThan(0);
        expect(layer.gain, name).toBeLessThanOrEqual(1);
        expect(layer.d, name).toBeGreaterThan(0);
      }
    }
  });
});
