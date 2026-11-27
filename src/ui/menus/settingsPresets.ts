/** One-tap setting bundles (Quick setup): how far the game draws and how wide it looks, nothing about controls, sound or difficulty. DOM-free. */
import { PHONE_MAX_RENDER_DISTANCE, type Settings } from '../../core/context';

export type PresetId = 'phone-light' | 'phone-pretty' | 'desktop';
type PresetKeys = 'renderDistance' | 'fov' | 'showFps';

export interface Preset {
  id: PresetId;
  label: string;
  /** One line shown under the choice while it is picked. */
  hint: string;
  values: Pick<Settings, PresetKeys>;
}

export const PRESETS: readonly Preset[] = [
  { id: 'phone-light', label: 'Phone: light', hint: 'Short view and a cooler phone. Best for older phones or long sessions.', values: { renderDistance: 3, fov: 68, showFps: false } },
  { id: 'phone-pretty', label: 'Phone: pretty', hint: 'Sees further. Looks best on a recent phone; lower it if the game stutters.', values: { renderDistance: 5, fov: 75, showFps: false } },
  { id: 'desktop', label: 'Desktop', hint: 'A long view and a wide picture for a computer.', values: { renderDistance: 8, fov: 80, showFps: false } },
];

export const presetById = (id: PresetId): Preset => PRESETS.find((p) => p.id === id) ?? PRESETS[0];

/** The preset's values for this device: a phone never gets more than its render-distance limit. */
export function presetValues(id: PresetId, touchFirst: boolean): Pick<Settings, PresetKeys> {
  const v = presetById(id).values;
  return { ...v, renderDistance: touchFirst ? Math.min(v.renderDistance, PHONE_MAX_RENDER_DISTANCE) : v.renderDistance };
}

/** `settings` with the preset laid over it. */
export const applyPreset = (settings: Settings, id: PresetId, touchFirst: boolean): Settings => ({ ...settings, ...presetValues(id, touchFirst) });

/** Which preset the settings match exactly, or null once the player has tuned something by hand. */
export function detectPreset(settings: Settings, touchFirst: boolean): PresetId | null {
  for (const p of PRESETS) {
    const v = presetValues(p.id, touchFirst);
    if (settings.renderDistance === v.renderDistance && settings.fov === v.fov && settings.showFps === v.showFps) return p.id;
  }
  return null;
}
