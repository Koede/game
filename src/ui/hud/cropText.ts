/** The crosshair label of a crop (spec 12.4): what it is and why it is or is not growing. DOM-free. */
import { machine } from '../../core/registry';
import { GREENHOUSE_WARM_C } from '../../sim/seasons';
import { formatCountdown } from './hudMath';
import type { UICropView } from './query';

/** Water within this many blocks keeps a crop growing at full speed (content: the crop's hydrationRadius). */
const WATER_RADIUS = machine('crop').params?.hydrationRadius ?? 4;

/**
 * "Wheat - ripe in 4 m", "Wheat - needs light: sun or a lamp", "Wheat - dry, ripe in 9 m: water within 4 blocks doubles it",
 * "Wheat - greenhouse 18 °C, ripe in 3 m", "Wheat - frozen at -4 °C: heat the room to 10 °C".
 */
export function cropLabel(v: UICropView): string {
  const name = v.name.replace(/\s*\(.*\)$/, '');
  if (v.ripe) return `${name} - ripe, harvest it`;
  if (!v.soil) return `${name} - needs farmland`;
  const t = v.tempC === undefined ? '' : ` ${v.tempC} °C`;
  if (v.shelter === 'frozen') {
    return v.tempC === undefined ? `${name} - frozen: roof it with glass and heat it` : `${name} - frozen at${t}: heat the room to ${GREENHOUSE_WARM_C} °C`;
  }
  if (!v.lit) return `${name} - needs light: sun or a lamp`;
  const when = Number.isFinite(v.ripeInS) ? `ripe in ${formatCountdown(v.ripeInS)}` : 'not growing';
  const dry = `water within ${WATER_RADIUS} blocks doubles it`;
  if (v.shelter === 'greenhouse') return v.hydrated ? `${name} - greenhouse${t}, ${when}` : `${name} - greenhouse${t}, dry, ${when}: ${dry}`;
  if (v.shelter === 'cold') {
    const heat = `heat it to ${GREENHOUSE_WARM_C} °C for full pace`;
    return v.hydrated ? `${name} - cold${t}, ${when}: ${heat}` : `${name} - cold${t}, dry, ${when}: ${dry}`;
  }
  return v.hydrated ? `${name} - growing, ${when}` : `${name} - dry, ${when}: ${dry}`;
}
