/** The bubbling of boiling water (brewing): a soft band-passed simmer with fast random pops on top. */
import { type AmbienceLayer, Follow, type Rig } from './ambienceLayers';

export function buildBoil(rig: Rig): AmbienceLayer {
  const bus = rig.gain(0);
  bus.connect(rig.out);
  // The simmer: pink noise in the low mids, swelling slowly like a pot that is working up to a rolling boil.
  const swell = rig.gain(0.7);
  rig.wobble(0.3, 0.17, 2.9).connect(swell.gain);
  rig.chain(rig.bed(rig.bank.noise('pink')), rig.filter('bandpass', 520, 1.1), swell, rig.gain(0.5)).connect(bus);
  // The bubbles: the crackle bed played slowly and band-passed, so each pop is a little round bloop.
  const popsA = rig.chain(rig.loop(rig.bank.crackle(true), 0.55, 0.9), rig.filter('bandpass', 780, 2.4), rig.gain(0.6));
  rig.pan(popsA, -0.2).connect(bus);
  const popsB = rig.chain(rig.loop(rig.bank.crackle(false), 0.8, 3.1), rig.filter('bandpass', 1250, 2.8), rig.gain(0.45));
  rig.pan(popsB, 0.25).connect(bus);

  const level = new Follow(bus.gain, 0.5, 0);
  return { apply: (t, now) => level.to(t.boil * 0.22, now) };
}
