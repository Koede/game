/**
 * Graphics quality: what each level of the `graphics` setting turns on. Pure data so it can be tested and read by
 * the renderer, the ground-item beams and (later) a settings screen.
 *  low    - phones that struggle: no water waves/foam, no loot beams, fog closes in earlier and softer, and the machine
 *           liquids animate at half speed.
 *  normal - the default.
 *  high   - everything, and the fog stays clear a little longer.
 */
export type GraphicsQuality = 'low' | 'normal' | 'high';
export const GRAPHICS_QUALITIES: readonly GraphicsQuality[] = ['low', 'normal', 'high'];

export interface GraphicsProfile {
  /** 0..1 strength of the optional surface effects (water waves and foam, loot beams). 0 switches them off. */
  fx: number;
  /** Where the fog starts, as a share of where it ends (0..1): lower is a softer, longer fade. */
  fogStart: number;
  /** Share of the loaded circle's edge the fog ends at: below 1 hides the far chunks sooner. */
  fogEnd: number;
  /** Speed of the animated liquids in the brewing, distilling and magic machines: 1 is full speed. */
  liquidRate: number;
}

export const GRAPHICS_PROFILES: Readonly<Record<GraphicsQuality, GraphicsProfile>> = {
  low: { fx: 0, fogStart: 0.4, fogEnd: 0.85, liquidRate: 0.5 },
  normal: { fx: 1, fogStart: 0.62, fogEnd: 1, liquidRate: 1 },
  high: { fx: 1, fogStart: 0.7, fogEnd: 1, liquidRate: 1 },
};

/** Any value -> a profile; unknown or missing falls back to normal. */
export function graphicsProfile(quality: unknown): GraphicsProfile {
  return GRAPHICS_PROFILES[(GRAPHICS_QUALITIES as readonly unknown[]).includes(quality) ? (quality as GraphicsQuality) : 'normal'];
}

