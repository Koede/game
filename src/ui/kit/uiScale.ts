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

/**
 * Accessibility switches on the UI root: `data-reduce-motion` (motion off like prefers-reduced-motion),
 * `data-color-mode="red-green|blue-yellow"` (absent when off: the palettes in styles.css and the overlay ramps in
 * palette.ts follow it) and the sizes `--hw-text-scale` (all UI text) and `--hw-hud-scale` (HUD and touch buttons).
 * Cheap to call often: writes only on a change.
 */
export function applyAccessibility(root: HTMLElement, s: Pick<Settings, 'reduceMotion' | 'colorMode'> & Partial<Pick<Settings, 'textScale' | 'hudScale'>>): void {
  if (s.reduceMotion !== root.hasAttribute('data-reduce-motion')) {
    if (s.reduceMotion) root.setAttribute('data-reduce-motion', '');
    else root.removeAttribute('data-reduce-motion');
  }
  if (s.colorMode === 'off') {
    if (root.hasAttribute('data-color-mode')) root.removeAttribute('data-color-mode');
  } else if (root.getAttribute('data-color-mode') !== s.colorMode) root.setAttribute('data-color-mode', s.colorMode);
  setScale(root, '--hw-text-scale', s.textScale);
  setScale(root, '--hw-hud-scale', s.hudScale);
}

const written = new WeakMap<HTMLElement, Map<string, string>>();

function setScale(root: HTMLElement, name: string, value: number | undefined): void {
  const v = String(Number.isFinite(value) && value ? value : 1);
  let seen = written.get(root);
  if (!seen) written.set(root, (seen = new Map()));
  if (seen.get(name) === v) return;
  seen.set(name, v);
  root.style.setProperty(name, v);
}

/** Marks the UI root (`UIRoot.el`, class hw-root) with the size. Cheap to call often: writes only on a change. */
export function applyUiScale(root: HTMLElement, scale: UiScale | undefined): void {
  const value = scale === 'large' ? 'large' : 'normal';
  if (root.getAttribute('data-ui-scale') === value) return;
  root.setAttribute('data-ui-scale', value);
  root.style.setProperty('--hw-ui-scale', String(uiScaleFactor(value)));
}
