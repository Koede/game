/** How long toasts stay and which one makes room: the calm-pop-up rules, DOM-free so they can be tested. */
import type { ToastKind } from '../../core/gameEvents';

/** Toasts longer than this are cut at a word ("Your pack is full, so the plank was left on th…"). */
export const TOAST_MAX_CHARS = 48;
/** Most toasts on screen at once. */
export const TOAST_MAX_VISIBLE = 3;

/** Cuts a message at a word boundary so a toast stays one short line; the full text can go in a tooltip. */
export function shortenToast(text: string, max = TOAST_MAX_CHARS): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,.;:-]+$/, '')}…`;
}

/** Good news fades fast; warnings and bad news stay a little longer. Short texts leave sooner. */
export function toastDuration(kind: ToastKind, textLength: number): number {
  const base = kind === 'warn' || kind === 'bad' ? 3600 : 2400;
  return base + Math.min(1200, Math.max(0, textLength - 20) * 40);
}

/** Which toast leaves when there are too many: the oldest calm one first, a warning only when nothing calm is left. */
export function evictionIndex(kinds: readonly ToastKind[]): number {
  const calm = kinds.findIndex((k) => k === 'info' || k === 'good');
  return calm >= 0 ? calm : 0;
}
