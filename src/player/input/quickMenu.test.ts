import { describe, expect, it } from 'vitest';
import { EMOTES } from '../emotes';
import {
  QUICK_ARC_DEG,
  QUICK_ITEM_PX,
  QUICK_RADIUS_PX,
  fitQuickRadius,
  quickArcFrom,
  quickMenuItems,
  quickMenuLit,
  quickMenuOffsets,
  quickMenuOpenable,
  quickRingSpacing,
  type QuickContext,
} from './quickMenu';

const idle: QuickContext = { dead: false, photo: false, emote: null, page: 'main', sneak: false, sprint: false };
const ids = (c: QuickContext): string[] => quickMenuItems(c).map((i) => i.id);

describe('quick menu: which items show', () => {
  it('the main ring offers emotes, photo mode, sneak and sprint, in that order', () => {
    expect(ids(idle)).toEqual(['emotes', 'photo', 'sneak', 'sprint']);
    expect(quickMenuItems(idle).every((i) => i.enabled)).toBe(true);
  });

  it('a dead player gets no menu at all', () => {
    expect(quickMenuOpenable({ dead: true, photo: false, emote: null })).toBe(false);
    expect(quickMenuItems({ ...idle, dead: true })).toEqual([]);
    expect(quickMenuOpenable(idle)).toBe(true);
  });

  it('in photo mode the menu offers only leaving it', () => {
    const items = quickMenuItems({ ...idle, photo: true, sneak: true });
    expect(items.map((i) => i.id)).toEqual(['photo']);
    expect(items[0].active).toBe(true);
    expect(items[0].effect).toEqual({ type: 'photo' });
  });

  it('the emote wheel holds the four emotes and a Stop that is only live while an emote plays', () => {
    const wheel = { ...idle, page: 'emotes' as const };
    expect(quickMenuItems(wheel).map((i) => i.id)).toEqual([...EMOTES.map((k) => `emote:${k}`), 'stop']);
    expect(quickMenuItems(wheel).find((i) => i.id === 'stop')?.enabled).toBe(false);
    const dancing = quickMenuItems({ ...wheel, emote: 'dance' });
    expect(dancing.find((i) => i.id === 'emote:dance')?.active).toBe(true);
    expect(dancing.find((i) => i.id === 'emote:wave')?.active).toBe(false);
    expect(dancing.find((i) => i.id === 'stop')?.enabled).toBe(true);
  });

  it('picking the emote item opens the wheel and each emote asks for that emote', () => {
    const emotes = quickMenuItems(idle).find((i) => i.id === 'emotes');
    expect(emotes?.effect).toEqual({ type: 'page', page: 'emotes' });
    const cheer = quickMenuItems({ ...idle, page: 'emotes' }).find((i) => i.id === 'emote:cheer');
    expect(cheer?.effect).toEqual({ type: 'emote', kind: 'cheer' });
  });
});

describe('quick menu: toggle states', () => {
  it('sneak and sprint show lit while on, and the item asks for the opposite', () => {
    const off = quickMenuItems(idle);
    expect(off.find((i) => i.id === 'sneak')).toMatchObject({ active: false, effect: { type: 'sneak', on: true } });
    expect(off.find((i) => i.id === 'sprint')).toMatchObject({ active: false, enabled: true, effect: { type: 'sprint', on: true } });
    const on = quickMenuItems({ ...idle, sneak: true, sprint: false });
    expect(on.find((i) => i.id === 'sneak')).toMatchObject({ active: true, effect: { type: 'sneak', on: false } });
  });

  it('the sprint lock is greyed out while sneaking', () => {
    expect(quickMenuItems({ ...idle, sneak: true }).find((i) => i.id === 'sprint')?.enabled).toBe(false);
  });

  it('the emote item is lit while any emote plays', () => {
    expect(quickMenuItems({ ...idle, emote: 'sit' }).find((i) => i.id === 'emotes')?.active).toBe(true);
    expect(quickMenuItems(idle).find((i) => i.id === 'emotes')?.active).toBe(false);
  });

  it('the entry button is lit while anything it controls is on', () => {
    expect(quickMenuLit(idle)).toBe(false);
    expect(quickMenuLit({ ...idle, sneak: true })).toBe(true);
    expect(quickMenuLit({ ...idle, sprint: true })).toBe(true);
    expect(quickMenuLit({ ...idle, emote: 'wave' })).toBe(true);
    expect(quickMenuLit({ ...idle, photo: true })).toBe(true);
  });
});

describe('quick menu: ring geometry', () => {
  it('items sit on a circle of the given radius, none below the button', () => {
    for (const count of [4, 5]) {
      for (const o of quickMenuOffsets(count, 200)) {
        expect(Math.hypot(o.x, o.y)).toBeCloseTo(200, 6);
        expect(o.y).toBeLessThanOrEqual(1e-9);
        expect(o.x).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });

  it('neighbouring items do not overlap at the default radius, even on the five-item emote wheel', () => {
    expect(quickRingSpacing(4)).toBeGreaterThanOrEqual(QUICK_ITEM_PX);
    expect(quickRingSpacing(5)).toBeGreaterThanOrEqual(QUICK_ITEM_PX);
  });

  it('the ring shrinks to stay on screen when the button sits near an edge', () => {
    const roomy = fitQuickRadius(QUICK_RADIUS_PX, 4, { x: 60, y: 600 }, { width: 800, height: 800 }, 1);
    expect(roomy).toBe(QUICK_RADIUS_PX);
    const low = fitQuickRadius(QUICK_RADIUS_PX, 4, { x: 60, y: 120 }, { width: 800, height: 800 }, 1);
    expect(low).toBeLessThan(QUICK_RADIUS_PX);
    expect(low).toBeGreaterThan(0);
    // Opening to the left from a button against the left edge leaves no room: the ring collapses.
    expect(fitQuickRadius(QUICK_RADIUS_PX, 4, { x: 10, y: 600 }, { width: 800, height: 800 }, -1)).toBeLessThan(QUICK_RADIUS_PX);
  });

  it('a short screen swings the arc towards the horizontal so the items keep clear of each other', () => {
    // Plenty of room: the default arc.
    expect(quickArcFrom(4, QUICK_RADIUS_PX)).toBe(QUICK_ARC_DEG.from);
    // A phone on its side leaves a radius of ~150 px: the default 70-degree arc would crowd four 64 px items.
    const from = quickArcFrom(4, 150);
    expect(from).toBeLessThan(QUICK_ARC_DEG.from);
    expect(from).toBeGreaterThanOrEqual(0);
    const o = quickMenuOffsets(4, 150, from);
    for (let i = 1; i < o.length; i++) expect(Math.hypot(o[i].x - o[i - 1].x, o[i].y - o[i - 1].y)).toBeGreaterThanOrEqual(QUICK_ITEM_PX - 1e-6);
    // The fit with the widened arc never exceeds the screen.
    expect(fitQuickRadius(QUICK_RADIUS_PX, 4, { x: 60, y: 200 }, { width: 800, height: 390 }, 1, from)).toBeGreaterThan(0);
  });
});
