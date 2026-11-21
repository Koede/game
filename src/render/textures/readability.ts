/**
 * The readability pass: one pointwise tone curve applied to every painted texture, so the whole set reads clearly on a
 * phone in daylight and in dim caves without repainting 400 tiles. The habits behind it come from the better
 * Minecraft packs (Faithful's contrast guidance, ReMaster, Stark Contrast) and from general pixel-art practice:
 *
 *  - lift the darkest tones: dark machine casings and deep rock were nearly black, so shape and detail vanished;
 *  - a gentle S-curve: lights a little lighter and darks a little darker around the middle, so edges and details pop
 *    without touching the extremes much (the darkest and lightest tones of each ramp stay the extremes);
 *  - slightly richer colour, so materials separate by hue as well as brightness (ore flecks, metals, woods);
 *  - hue-shifted ramps: highlights lean warm, shadows lean cool, instead of grey-only brightness steps.
 *
 * It is POINTWISE (a colour maps to the same colour wherever it appears) and monotonic in brightness, so it cannot add
 * seams to a tiling tile, keeps the ore tiles' host rock identical to the stone it is painted on, and keeps every
 * "brighter than" relation of lit variants, outlines and glow. Alpha is never touched. DOM-free.
 */

/** Shadow lift: luminance L gains SHADOW_LIFT * (1 - L)^4, i.e. real lift for the darks and almost none above the mids. */
export const SHADOW_LIFT = 0.1;
/** How far toward the smoothstep S-curve the lifted luminance is pulled (0 = none, 1 = full smoothstep). */
export const S_CURVE = 0.2;
/** Extra colour: chroma around the pixel's own luminance is multiplied by 1 + this. */
export const CHROMA_BOOST = 0.15;
/** Warm push of the lights and cool push of the shadows, in 0..255 steps at the extremes. */
export const WARM_LIGHTS = 6;
export const COOL_SHADOWS = 7;

const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

/** Maps one colour (0..255 per channel) through the readability curve. */
export function readable(r: number, g: number, b: number): [number, number, number] {
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // Brightness: lift the shadows, then bend toward an S so the middle separates.
  const lifted = lum + SHADOW_LIFT * Math.pow(1 - lum, 4);
  const target = lifted + S_CURVE * (lifted * lifted * (3 - 2 * lifted) - lifted);
  const gain = lum > 0.004 ? target / lum : 1;
  let nr = r * gain;
  let ng = g * gain;
  let nb = b * gain;
  if (lum <= 0.004) nr = ng = nb = target * 255;
  // Colour: more chroma around the new luminance, and a small temperature shift along the brightness axis.
  const y = target * 255;
  nr = y + (nr - y) * (1 + CHROMA_BOOST);
  ng = y + (ng - y) * (1 + CHROMA_BOOST);
  nb = y + (nb - y) * (1 + CHROMA_BOOST);
  const warm = Math.max(0, target - 0.5) * 2;
  const cool = Math.max(0, 0.4 - target) / 0.4;
  nr += WARM_LIGHTS * warm - COOL_SHADOWS * 0.35 * cool;
  nb += -WARM_LIGHTS * 0.7 * warm + COOL_SHADOWS * cool;
  return [clamp(nr), clamp(ng), clamp(nb)];
}

/** Applies the curve to a painted RGBA buffer in place (fully transparent pixels are left alone). */
export function applyReadability(px: Uint8ClampedArray): Uint8ClampedArray {
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const [r, g, b] = readable(px[i], px[i + 1], px[i + 2]);
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
  return px;
}
