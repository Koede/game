/** The crosshair label of a crop (spec 12.4): what it is and why it is or is not growing. DOM-free. */
import { machine } from '../../core/registry';
import { formatCountdown } from './hudMath';
import type { UICropView } from './query';

/** Water within this many blocks keeps a crop growing at full speed (content: the crop's hydrationRadius). */
const WATER_RADIUS = machine('crop').params?.hydrationRadius ?? 4;

/** "Wheat - ripe in 4 m", "Wheat - needs light: sun or a lamp", "Wheat - dry, ripe in 9 m: water within 4 blocks doubles it". */
export function cropLabel(v: UICropView): string {
  const name = v.name.replace(/\s*\(.*\)$/, '');
  if (v.ripe) return `${name} - ripe, harvest it`;
  if (!v.soil) return `${name} - needs farmland`;
  if (!v.lit) return `${name} - needs light: sun or a lamp`;
  const when = Number.isFinite(v.ripeInS) ? `ripe in ${formatCountdown(v.ripeInS)}` : 'not growing';
  // Bees from a hive in reach (src/sim/apiary.ts): said only on the short line, the dry one is long enough already.
  return v.hydrated ? `${name} - growing${v.pollinated ? ', bees pollinating' : ''}, ${when}` : `${name} - dry, ${when}: water within ${WATER_RADIUS} blocks doubles it`;
}
