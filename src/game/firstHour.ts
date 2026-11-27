/**
 * The guided first hour: ONE path through the first things a new player does, joining the main goal list
 * (src/content/objectives.ts) with the camp goals (campGoals.ts). Camp goals slot in between main goals where they
 * naturally happen (meet Gruk first, sleep once warm, fill a bounty after the first meal). The HUD's goal plate shows
 * the current step and the "What next?" hint follows it, so the camp chip and the goal plate no longer pull in two directions.
 * Pure and DOM-free. It adds no state: every step reads what the tracker and the camp already know.
 */
import { OBJECTIVES } from '../core/registry';
import type { ObjectiveSpec } from '../core/types';
import { CAMP_GOALS } from './campGoals';

/** The last main goal of the first hour: after eating a cooked meal the player has the loop (wood, fire, food). */
export const FIRST_HOUR_LAST_MAIN = 'eat_food';

/** Camp goals and the main goal each one follows (null = before everything). Camp goals not listed here stay on the camp chip. */
export const CAMP_SLOTS: ReadonlyArray<{ camp: string; after: string | null }> = [
  { camp: 'meet_builder', after: null },
  { camp: 'first_night', after: 'get_warm' },
  { camp: 'first_bounty', after: 'eat_food' },
];

export interface GuideStep {
  kind: 'camp' | 'main';
  id: string;
  title: string;
  text: string;
  /** 1-based position on the path, and the path's length. */
  index: number;
  total: number;
}

export interface GuideFacts {
  /** Whether a main goal is complete (ObjectiveTracker.isComplete). */
  isComplete(id: string): boolean;
  /** The camp goals done, or null when this world has no camp track (old saves, worlds without a camp). */
  campDone: ReadonlySet<string> | null;
}

interface Entry {
  kind: 'camp' | 'main';
  id: string;
}

/** The path in order, for the camp track present or not. */
export function firstHourPath(withCamp: boolean, objectives: readonly ObjectiveSpec[] = OBJECTIVES): Entry[] {
  const end = objectives.findIndex((o) => o.id === FIRST_HOUR_LAST_MAIN);
  const mains = end < 0 ? [] : objectives.slice(0, end + 1);
  const path: Entry[] = [];
  const slot = (after: string | null): void => {
    if (!withCamp) return;
    for (const s of CAMP_SLOTS) if (s.after === after) path.push({ kind: 'camp', id: s.camp });
  };
  slot(null);
  for (const o of mains) {
    path.push({ kind: 'main', id: o.id });
    slot(o.id);
  }
  return path;
}

/** The step the player is on, or null when the first hour is done (or never applied: the tracker is past it). */
export function firstHourStep(f: GuideFacts, objectives: readonly ObjectiveSpec[] = OBJECTIVES): GuideStep | null {
  const path = firstHourPath(f.campDone !== null, objectives);
  const doneOf = (e: Entry): boolean => (e.kind === 'camp' ? (f.campDone?.has(e.id) ?? true) : f.isComplete(e.id));
  const i = path.findIndex((e) => !doneOf(e));
  if (i < 0) return null;
  const e = path[i];
  const spec = e.kind === 'camp' ? CAMP_GOALS.find((g) => g.id === e.id) : objectives.find((o) => o.id === e.id);
  if (!spec) return null;
  return { kind: e.kind, id: e.id, title: spec.title, text: spec.text, index: i + 1, total: path.length };
}
