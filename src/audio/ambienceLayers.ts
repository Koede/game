/**
 * The node graphs behind each continuous layer. A layer is built once, the first time it is needed,
 * and from then on only its parameters move.
 */
import type { BufferBank } from './buffers';
import type { AmbienceTargets } from './ambienceState';
import type { AudioCtxLike, BufferLike, FilterKind, FilterLike, GainLike, NodeLike, OscLike, ParamLike, SourceLike, Wave } from './types';

/**
 * Glides a parameter towards its latest target. Re-targets only when the value really moved, so a
 * caller can feed it every frame without piling up automation events.
 */
export class Follow {
  private last: number;

  constructor(private readonly param: ParamLike, private readonly timeConstant: number, initial: number) {
    this.last = initial;
    param.value = initial;
  }

  to(value: number, now: number): void {
    const moved = Math.abs(value - this.last);
    // `!(moved > 0)` also rejects NaN, which an AudioParam would throw on.
    if (!(moved > 0) || (value !== 0 && moved < 0.002 * Math.max(1, Math.abs(this.last)))) return;
    this.last = value;
    this.param.setTargetAtTime(value, now, this.timeConstant);
  }
}

/** Creates nodes for the ambience and remembers them so everything can be torn down at once. */
export class Rig {
  private readonly sources: SourceLike[] = [];
  private readonly nodes: NodeLike[] = [];
  private readonly shared = new Map<BufferLike, SourceLike>();

  constructor(readonly ctx: AudioCtxLike, readonly bank: BufferBank, readonly out: NodeLike) {}

  gain(value: number): GainLike {
    const g = this.ctx.createGain();
    g.gain.value = value;
    this.nodes.push(g);
    return g;
  }

  filter(type: FilterKind, freq: number, q: number): FilterLike {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    this.nodes.push(f);
    return f;
  }

  osc(wave: Wave, freq: number): OscLike {
    const o = this.ctx.createOscillator();
    o.type = wave;
    o.frequency.value = freq;
    o.start();
    this.sources.push(o);
    return o;
  }

  loop(buffer: BufferLike, rate = 1, offset = 0): SourceLike {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.playbackRate.value = rate;
    s.start(0, offset);
    this.sources.push(s);
    return s;
  }

  /** One looping source per noise bed, fanned out to every layer that filters it. */
  bed(buffer: BufferLike): SourceLike {
    let s = this.shared.get(buffer);
    if (!s) {
      s = this.loop(buffer);
      this.shared.set(buffer, s);
    }
    return s;
  }

  /** A slow random wobble of +-`depth`, to be connected to a parameter. */
  wobble(depth: number, rate: number, offset: number): GainLike {
    return this.chain(this.loop(this.bank.flicker(), rate, offset), this.gain(depth));
  }

  /** Places `node` in the stereo field where the browser can; otherwise leaves it centred. */
  pan(node: NodeLike, position: number): NodeLike {
    if (!this.ctx.createStereoPanner) return node;
    const p = this.ctx.createStereoPanner();
    p.pan.value = position;
    this.nodes.push(p);
    node.connect(p);
    return p;
  }

  /** Connects the nodes in series and returns the last one. */
  chain<T extends NodeLike>(...nodes: [...NodeLike[], T]): T {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    return nodes[nodes.length - 1] as T;
  }

  dispose(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // already stopped
      }
      s.disconnect();
    }
    for (const n of this.nodes) n.disconnect();
    this.sources.length = 0;
    this.nodes.length = 0;
    this.shared.clear();
  }
}

export interface AmbienceLayer {
  apply(t: AmbienceTargets, now: number): void;
}

const LEVEL_TC = 0.25;
const TONE_TC = 0.4;

/** The furnace: a breathing low roar, a fluttering flame band and two crackle beds. */
export function buildFire(rig: Rig): AmbienceLayer {
  const bus = rig.gain(0);
  bus.connect(rig.out);

  const roarLp = rig.filter('lowpass', 220, 0.5);
  const roarMod = rig.gain(0.72);
  rig.wobble(0.28, 1, 0).connect(roarMod.gain);
  const roar = rig.chain(rig.bed(rig.bank.noise('brown')), roarLp, roarMod, rig.gain(0));
  roar.connect(bus);

  const flameBp = rig.filter('bandpass', 450, 0.6);
  const flameMod = rig.gain(0.5);
  rig.wobble(0.5, 1.61, 3.3).connect(flameMod.gain);
  const flame = rig.chain(rig.bed(rig.bank.noise('pink')), flameBp, flameMod, rig.gain(0));
  flame.connect(bus);

  // The two beds sit left and right of centre, which makes the fire feel wide and close.
  const crackle = rig.chain(rig.loop(rig.bank.crackle(false)), rig.filter('highpass', 700, 0.5), rig.gain(0));
  rig.pan(crackle, -0.35).connect(bus);
  const dense = rig.chain(rig.loop(rig.bank.crackle(true), 1, 1.7), rig.filter('highpass', 1400, 0.5), rig.gain(0));
  rig.pan(dense, 0.35).connect(bus);

  const f = {
    bus: new Follow(bus.gain, LEVEL_TC, 0),
    roar: new Follow(roar.gain, LEVEL_TC, 0),
    roarCutoff: new Follow(roarLp.frequency, TONE_TC, 220),
    flame: new Follow(flame.gain, LEVEL_TC, 0),
    flameFreq: new Follow(flameBp.frequency, TONE_TC, 450),
    crackle: new Follow(crackle.gain, LEVEL_TC, 0),
    dense: new Follow(dense.gain, LEVEL_TC, 0),
  };
  return {
    apply(t, now) {
      f.bus.to(t.fire, now);
      f.roar.to(t.roar * 0.42, now);
      f.roarCutoff.to(t.roarCutoff, now);
      f.flame.to(t.flame * 0.75, now);
      f.flameFreq.to(t.flameFreq, now);
      f.crackle.to(t.crackle * 0.36, now);
      f.dense.to(t.crackleDense * 0.24, now);
    },
  };
}

/** Electric heating: a beating mains hum with a sizzling arc on top. */
export function buildArc(rig: Rig): AmbienceLayer {
  const bus = rig.gain(0);
  bus.connect(rig.out);
  const hum = rig.filter('lowpass', 900, 0.7);
  rig.osc('sawtooth', 100).connect(hum);
  rig.osc('sawtooth', 100.6).connect(hum);
  rig.chain(hum, rig.gain(0.2)).connect(bus);
  rig.chain(rig.osc('sine', 50), rig.gain(0.1)).connect(bus);
  const sizzleMod = rig.gain(0.3);
  rig.wobble(0.7, 2.3, 6.1).connect(sizzleMod.gain);
  rig.chain(rig.bed(rig.bank.noise('white')), rig.filter('bandpass', 3600, 1.5), sizzleMod, rig.gain(0.25)).connect(bus);
  const level = new Follow(bus.gain, LEVEL_TC, 0);
  return { apply: (t, now) => level.to(t.arc * 0.4, now) };
}

/** Running machinery: a low motor drone with a slight shudder and a rumble underneath. */
export function buildMachine(rig: Rig): AmbienceLayer {
  const bus = rig.gain(0);
  bus.connect(rig.out);
  const motor = rig.filter('lowpass', 650, 0.7);
  rig.osc('sawtooth', 55).connect(motor);
  rig.osc('sawtooth', 82.9).connect(motor);
  const shudder = rig.gain(0.85);
  rig.chain(rig.osc('sine', 7.3), rig.gain(0.15)).connect(shudder.gain);
  rig.chain(motor, shudder, rig.gain(0.3)).connect(bus);
  rig.chain(rig.bed(rig.bank.noise('pink')), rig.filter('bandpass', 420, 0.9), rig.gain(0.5)).connect(bus);
  rig.chain(rig.osc('triangle', 330), rig.gain(0.03)).connect(bus);
  const level = new Follow(bus.gain, LEVEL_TC, 0);
  return { apply: (t, now) => level.to(t.machine * 0.27, now) };
}

/** Wind: gusting band-passed noise, plus a thin whistle when the player is cold. */
export function buildWind(rig: Rig): AmbienceLayer {
  const body = rig.filter('bandpass', 320, 0.5);
  rig.wobble(180, 0.05, 0).connect(body.frequency);
  const gust = rig.gain(0.6);
  rig.wobble(0.4, 0.07, 2.9).connect(gust.gain);
  const wind = rig.chain(rig.bed(rig.bank.noise('pink')), body, gust, rig.gain(0));
  wind.connect(rig.out);

  const reed = rig.filter('bandpass', 1750, 10);
  rig.wobble(260, 0.083, 5).connect(reed.frequency);
  const whistle = rig.chain(rig.bed(rig.bank.noise('white')), reed, rig.gain(0));
  whistle.connect(rig.out);

  const f = {
    wind: new Follow(wind.gain, 0.6, 0),
    freq: new Follow(body.frequency, 0.8, 320),
    whistle: new Follow(whistle.gain, 0.6, 0),
  };
  return {
    apply(t, now) {
      f.wind.to(t.wind * 0.7, now);
      f.freq.to(t.windFreq, now);
      f.whistle.to(t.whistle * 0.12, now);
    },
  };
}

/** Night: sparse chimes, layered with a copy a fourth lower that loops at a different length. */
export function buildNight(rig: Rig): AmbienceLayer {
  const bus = rig.gain(0);
  bus.connect(rig.out);
  const chimes = rig.bank.nightChimes();
  rig.pan(rig.chain(rig.loop(chimes), rig.gain(0.5)), 0.3).connect(bus);
  rig.pan(rig.chain(rig.loop(chimes, 0.75, 4), rig.gain(0.4)), -0.3).connect(bus);
  const level = new Follow(bus.gain, 2.5, 0);
  return { apply: (t, now) => level.to(t.night * 0.14, now) };
}

/** Under water: a slow, close rumble (the muffling of everything else is done on the world bus). */
export function buildWater(rig: Rig): AmbienceLayer {
  const swell = rig.gain(0.7);
  rig.wobble(0.3, 0.35, 8).connect(swell.gain);
  const bus = rig.gain(0);
  bus.connect(rig.out);
  rig.chain(rig.bed(rig.bank.noise('brown')), rig.filter('lowpass', 420, 0.7), swell, bus);
  // A resonant band that drifts up and down: the gurgle of water around the ears.
  const gurgle = rig.filter('bandpass', 520, 5);
  rig.wobble(160, 0.6, 1.5).connect(gurgle.frequency);
  rig.chain(rig.bed(rig.bank.noise('pink')), gurgle, rig.gain(0.9), bus);
  const level = new Follow(bus.gain, 0.12, 0);
  return { apply: (t, now) => level.to(t.water * 0.25, now) };
}

/** Starhearth ignition: a C major chord that climbs an octave and opens up as progress builds. */
export function buildIgnition(rig: Rig): AmbienceLayer {
  const bus = rig.gain(0);
  bus.connect(rig.out);
  const open = rig.filter('lowpass', 400, 0.8);
  open.connect(bus);
  const voices: Array<[Wave, number, number]> = [
    ['sawtooth', 130.81, 0.09],
    ['sawtooth', 196.0, 0.06],
    ['sine', 261.63, 0.14],
    ['sine', 329.63, 0.1],
    ['sine', 392.0, 0.09],
    ['triangle', 1046.5, 0.03],
  ];
  const detunes = voices.map(([wave, freq, level], i) => {
    const o = rig.osc(wave, freq * (1 + (i % 2 ? 0.002 : -0.002)));
    rig.chain(o, rig.gain(level)).connect(open);
    return new Follow(o.detune, 0.6, -1200);
  });
  const level = new Follow(bus.gain, 0.5, 0);
  const cutoff = new Follow(open.frequency, 0.6, 400);
  return {
    apply(t, now) {
      level.to(t.ignition * 0.65, now);
      cutoff.to(t.ignitionCutoff, now);
      for (const d of detunes) d.to(t.ignitionDetune, now);
    },
  };
}
