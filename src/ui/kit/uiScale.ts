/**
 * UI size (Settings.uiScale, review ui-10): 'large' scales the HUD, the kit's touch targets and type, and - through
 * the same hooks on the UI root - the touch overlay's buttons and captions. The root carries
 * `data-ui-scale="normal|large"` and the custom property `--hw-ui-scale` (1 or UI_SCALE_LARGE) so any stylesheet
 * can follow it: `.hw-root[data-ui-scale='large'] .whatever { ... }` or `calc(10px * var(--hw-ui-scale, 1))`.
 */
import type { Settings } from '../../core/context';

export type UiScale = Settings['uiScale'];

/** The factor 'large' stands for (type, touch targets and HUD figures grow by about this much). */
export const UI_SCALE_LARGE = 1.2;

/** The number `--hw-ui-scale` carries for a setting (anything unknown reads as normal). */
export const uiScaleFactor = (scale: UiScale | undefined): number => (scale === 'large' ? UI_SCALE_LARGE : 1);

/** Marks the UI root (`UIRoot.el`, class hw-root) with the size. Cheap to call often: writes only on a change. */
export function applyUiScale(root: HTMLElement, scale: UiScale | undefined): void {
  const value = scale === 'large' ? 'large' : 'normal';
  if (root.getAttribute('data-ui-scale') === value) return;
  root.setAttribute('data-ui-scale', value);
  root.style.setProperty('--hw-ui-scale', String(uiScaleFactor(value)));
}
