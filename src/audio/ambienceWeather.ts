/** The weather's continuous layers (spec 15): rain and storm gusts. Built on first use like every ambience layer. */
import { type AmbienceLayer, Follow, type Rig } from './ambienceLayers';
import { RAIN_OPEN_HZ } from './ambienceState';

/**
 * Rain: a bright hiss, a patter of drops (the crackle bed played fast and band-passed), and the low wash of a
 * downpour. One low-pass over all three closes from open air to a dull drumming when a roof is overhead.
 */
export function buildRain(rig: Rig): AmbienceLayer {
  const roof = rig.filter('lowpass', RAIN_OPEN_HZ, 0.6);
  const bus = rig.gain(0);
  rig.chain(roof, bus).connect(rig.out);

  const hissMod = rig.gain(0.8);
  rig.wobble(0.2, 0.13, 4.2).connect(hissMod.gain);
  rig.chain(rig.bed(rig.bank.noise('pink')), rig.filter('highpass', 900, 0.5), hissMod, rig.gain(0.55)).connect(roof);
  const patter = rig.chain(rig.loop(rig.bank.crackle(true), 1.35, 0.6), rig.filter('bandpass', 2600, 0.7), rig.gain(0.5));
  rig.pan(patter, 0.25).connect(roof);
  const patterLeft = rig.chain(rig.loop(rig.bank.crackle(false), 1.6, 2.3), rig.filter('bandpass', 3400, 0.8), rig.gain(0.4));
  rig.pan(patterLeft, -0.3).connect(roof);

  const body = rig.gain(0);
  rig.chain(rig.bed(rig.bank.noise('brown')), rig.filter('lowpass', 380, 0.6), body).connect(bus);

  const f = {
    level: new Follow(bus.gain, 1.2, 0),
    cutoff: new Follow(roof.frequency, 0.3, RAIN_OPEN_HZ),
    body: new Follow(body.gain, 1.5, 0),
  };
  return {
    apply(t, now) {
      f.level.to(t.rain * 0.3, now);
      f.cutoff.to(t.rainCutoff, now);
      f.body.to(t.rainBody * 0.55, now);
    },
  };
}

/** Storm gusts: deep band-passed wind that swells and sags slowly and wanders in pitch and across the field. */
export function buildGusts(rig: Rig): AmbienceLayer {
  const band = rig.filter('bandpass', 240, 0.6);
  rig.wobble(140, 0.045, 1.1).connect(band.frequency);
  const swell = rig.gain(0.55);
  rig.wobble(0.5, 0.11, 6.7).connect(swell.gain);
  const gust = rig.chain(rig.bed(rig.bank.noise('pink')), band, swell, rig.gain(0));
  rig.pan(gust, -0.2).connect(rig.out);
  const howl = rig.filter('bandpass', 620, 3);
  rig.wobble(220, 0.07, 3.3).connect(howl.frequency);
  const high = rig.chain(rig.bed(rig.bank.noise('white')), howl, rig.gain(0));
  rig.pan(high, 0.3).connect(rig.out);

  const f = { gust: new Follow(gust.gain, 1.5, 0), howl: new Follow(high.gain, 1.5, 0) };
  return {
    apply(t, now) {
      f.gust.to(t.gust * 0.6, now);
      f.howl.to(t.gust * t.gust * 0.08, now);
    },
  };
}
