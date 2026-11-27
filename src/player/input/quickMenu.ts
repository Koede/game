/**
 * Radial quick menu (touch): one entry button in a bottom corner opens a ring of large thumb targets with the
 * emote wheel, photo mode, the sneak toggle and the sprint lock. This file is the DOM-free part: which items show,
 * what each one does, which ones are lit, and where the ring sits. The DOM lives in quickMenuView.ts.
 */
import { EMOTES, type EmoteKind } from '../emotes';

/** The main ring, or the emote wheel opened from it. */
export type QuickPage = 'main' | 'emotes';

/** What the rest of the game says about the player; the menu only reads it. */
export interface QuickPlayerState {
  /** A dead player gets no menu. */
  dead: boolean;
  /** Photo mode is on: the menu offers only leaving it. */
  photo: boolean;
  /** The emote playing, or null. */
  emote: EmoteKind | null;
}

export interface QuickContext extends QuickPlayerState {
  page: QuickPage;
  /** The sneak toggle is on. */
  sneak: boolean;
  /** The sprint lock is on. */
  sprint: boolean;
}

/** What tapping an item asks the game to do. Applied by the input layer (inputManager.ts). */
export type QuickEffect =
  | { type: 'page'; page: QuickPage }
  | { type: 'photo' }
  | { type: 'sneak'; on: boolean }
  | { type: 'sprint'; on: boolean }
  | { type: 'emote'; kind: EmoteKind }
  | { type: 'stopEmote' };

export interface QuickItem {
  id: string;
  label: string;
  /** Lit: the thing it switches is on, or it is the emote playing. */
  active: boolean;
  /** A disabled item is drawn faded and ignores taps. */
  enabled: boolean;
  effect: QuickEffect;
}

export const EMOTE_LABELS: Readonly<Record<EmoteKind, string>> = { wave: 'Wave', sit: 'Sit', cheer: 'Cheer', dance: 'Dance' };

/** The menu opens only for a living player. */
export const quickMenuOpenable = (c: QuickPlayerState): boolean => !c.dead;

/** The entry button shows lit while something it controls is on, so a sneaking player sees it without opening the menu. */
export const quickMenuLit = (c: QuickContext): boolean => c.photo || c.sneak || c.sprint || c.emote !== null;

/** The items on screen for this state, in ring order. Empty when the menu cannot open. */
export function quickMenuItems(c: QuickContext): QuickItem[] {
  if (!quickMenuOpenable(c)) return [];
  if (c.photo) {
    return [{ id: 'photo', label: 'Photo', active: true, enabled: true, effect: { type: 'photo' } }];
  }
  if (c.page === 'emotes') {
    const emotes: QuickItem[] = EMOTES.map((kind) => ({
      id: `emote:${kind}`,
      label: EMOTE_LABELS[kind],
      active: c.emote === kind,
      enabled: true,
      effect: { type: 'emote', kind },
    }));
    return [...emotes, { id: 'stop', label: 'Stop', active: false, enabled: c.emote !== null, effect: { type: 'stopEmote' } }];
  }
  return [
    { id: 'emotes', label: 'Emote', active: c.emote !== null, enabled: true, effect: { type: 'page', page: 'emotes' } },
    { id: 'photo', label: 'Photo', active: false, enabled: true, effect: { type: 'photo' } },
    { id: 'sneak', label: 'Sneak', active: c.sneak, enabled: true, effect: { type: 'sneak', on: !c.sneak } },
    // Sprinting and sneaking do not go together: while sneaking the sprint lock is greyed out.
    { id: 'sprint', label: 'Sprint', active: c.sprint, enabled: !c.sneak, effect: { type: 'sprint', on: !c.sprint } },
  ];
}

// ---- ring geometry (CSS pixels) -----------------------------------------------------------------------------------

/** Angles (degrees, counter-clockwise from the side the ring opens to) the items spread over. */
export const QUICK_ARC_DEG = { from: 20, to: 90 } as const;
/** Distance from the entry button's centre to each item's centre, when there is room. */
export const QUICK_RADIUS_PX = 220;
/** Diameter of an item: large thumb targets. */
export const QUICK_ITEM_PX = 64;
/** Keeps an item this far inside the touch surface's edge. */
const EDGE_PX = QUICK_ITEM_PX / 2 + 4;

/**
 * Offsets (x to the right, y downwards, both in px) of `count` items on the ring, evenly spread over the arc, from the
 * entry button's centre. The ring opens to the right; the caller mirrors x for a ring that opens to the left.
 */
export function quickMenuOffsets(count: number, radius: number, fromDeg: number = QUICK_ARC_DEG.from): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    const a = ((fromDeg + (QUICK_ARC_DEG.to - fromDeg) * t) * Math.PI) / 180;
    out.push({ x: radius * Math.cos(a), y: -radius * Math.sin(a) });
  }
  return out;
}

/**
 * The largest radius up to `radius` at which every item of the ring stays on screen, given the entry button's centre
 * (client px relative to the surface) and the surface size. `side` is +1 when the ring opens to the right, -1 to the left.
 */
export function fitQuickRadius(radius: number, count: number, centre: { x: number; y: number }, surface: { width: number; height: number }, side: 1 | -1, fromDeg: number = QUICK_ARC_DEG.from): number {
  let fit = radius;
  for (const o of quickMenuOffsets(count, 1, fromDeg)) {
    const x = side * o.x;
    const y = o.y;
    if (x > 1e-6) fit = Math.min(fit, (surface.width - EDGE_PX - centre.x) / x);
    if (x < -1e-6) fit = Math.min(fit, (centre.x - EDGE_PX) / -x);
    if (y < -1e-6) fit = Math.min(fit, (centre.y - EDGE_PX) / -y);
  }
  return Math.max(0, fit);
}

/** Gap kept between two neighbouring items of the ring, px. */
export const QUICK_GAP_PX = 6;

/**
 * Where the arc starts (degrees) so neighbouring items clear each other at `radius`: the default arc when it already does,
 * otherwise swung further down towards the horizontal, as far as 0, so a short screen (a phone on its side, where the ring
 * cannot get tall) spreads the items sideways instead of stacking them on top of each other.
 */
export function quickArcFrom(count: number, radius: number): number {
  if (count < 2 || radius <= 0) return QUICK_ARC_DEG.from;
  const needRad = 2 * Math.asin(Math.min(1, (QUICK_ITEM_PX + QUICK_GAP_PX) / (2 * radius)));
  const from = QUICK_ARC_DEG.to - (needRad * 180 * (count - 1)) / Math.PI;
  return Math.max(0, Math.min(QUICK_ARC_DEG.from, from));
}

/** How far apart two neighbouring items sit on the ring: items do not overlap when this is at least QUICK_ITEM_PX. */
export function quickRingSpacing(count: number, radius: number = QUICK_RADIUS_PX): number {
  if (count < 2) return Infinity;
  const stepDeg = (QUICK_ARC_DEG.to - QUICK_ARC_DEG.from) / (count - 1);
  return 2 * radius * Math.sin((stepDeg * Math.PI) / 360);
}
