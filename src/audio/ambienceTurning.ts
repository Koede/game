/** Turning workshop drives: a slow wooden creak, the tick of cogs and a soft whir of rope and belt. */
import { type AmbienceLayer, Follow, type Rig } from './ambienceLayers';

export function buildTurning(rig: Rig): AmbienceLayer {
  const bus = rig.gain(0);
  bus.connect(rig.out);
  // The creak: band-passed brown noise swelling and fading irregularly, like timber taking the load.
  const swell = rig.gain(0.6);
  rig.wobble(0.4, 0.23, 1.3).connect(swell.gain);
  rig.chain(rig.bed(rig.bank.noise('brown')), rig.filter('bandpass', 260, 1.3), swell, rig.gain(0.55)).connect(bus);
  // The cogs: the crackle bed played slowly and high-passed, so each tick is a small wooden knock.
  const ticks = rig.chain(rig.loop(rig.bank.crackle(false), 0.45, 2.2), rig.filter('bandpass', 1100, 2.2), rig.gain(0.5));
  rig.pan(ticks, 0.2).connect(bus);
  // The belts: a faint airy whir.
  rig.chain(rig.bed(rig.bank.noise('pink')), rig.filter('bandpass', 900, 0.7), rig.gain(0.1)).connect(bus);
  const level = new Follow(bus.gain, 0.4, 0);
  return { apply: (t, now) => level.to(t.turning * 0.24, now) };
}
