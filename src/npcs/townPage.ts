/**
 * The Town page's data (docs/plans/feature-plan-2026-11-26.md, 1.3): what Gruk is building and how far along, what is missing, the
 * town's standing and its next unlock, who lives where and how content they are, the housing view, who is next in line, and the camp
 * goals. Plain data: the manager fills it, the screen and the HUD chip read it.
 */
import type { LineTone } from './contentment';
import type { WaitingFor } from './housingView';
import type { HousingRow } from './settlement';

export interface TownBuilding {
  name: string;
  /** Stage within a building that has stages (the lodge): 1-based, and how many; null for a single-stage building. */
  stage: number | null;
  stages: number | null;
  /** 0..100 of the building's cells laid. */
  percent: number;
  /** What is still missing from the bay's stock. */
  missing: { item: string; count: number }[];
  /** Days of Gruk's work left once the materials are in; null while materials are missing. */
  daysLeft: number | null;
  /** Why he is not building (a lock note), or null. */
  waiting: string | null;
}

export interface TownResident {
  id: string;
  name: string;
  /** Where they sleep: a room's label, or 'Common room' / 'Camp'. */
  home: string;
  score: number;
  tone: LineTone;
  reasons: string[];
  trust: number;
  /** The room id they live in ('camp' for none), and where they could be moved by hand (none for the builder). */
  room: string;
  moves: { id: string; label: string }[];
}

export interface TownNextInLine {
  id: string;
  name: string;
  waitingFor: WaitingFor | null;
  /** A plain sentence for the page. */
  text: string;
}

export interface TownGoalRow {
  id: string;
  title: string;
  text: string;
  done: boolean;
}

export interface TownPage {
  /** The camp stands, or a lodge is being built: the page has something to show. */
  active: boolean;
  camp: boolean;
  day: number;
  /** The building in progress, or null when nothing is going up. */
  building: TownBuilding | null;
  /** Buildings finished and planned. */
  finished: number;
  planned: number;
  standing: { name: string; value: number; next: { name: string; at: number } | null };
  /** The next building to unlock, with what it needs, or null. */
  nextUnlock: string | null;
  mood: number;
  moodLabel: string;
  residents: TownResident[];
  rooms: HousingRow[];
  nextInLine: TownNextInLine | null;
  goals: TownGoalRow[];
  /** Where the building board stands from the player ("45 blocks north-east"), or null when it is not placed. */
  boardWhere?: string | null;
  /** The current camp goal, or null when the track is done or not shown. */
  goal: TownGoalRow | null;
  /** Tonight's festival or the next one (festival.ts), with the medals won so far. */
  festival?: { name: string; line: string; tonight: boolean; medals: string };
}

export const moodLabel = (score: number): string => (score >= 0.5 ? 'cheerful' : score >= 0.2 ? 'content' : score > -0.2 ? 'settled' : score > -0.5 ? 'restless' : 'unhappy');

export function waitingText(id: string, name: string, w: WaitingFor | null): string {
  if (w === null) return `${name} can come on any night now.`;
  if (w === 'free room') return `${name} is waiting for a free bedroom. Gruk adds one with each lodge stage, or build a room with a bed, a door, a light and a seat.`;
  if (w === 'reputation') return `${name} wants the town to stand a little higher. Fill bounties on the board.`;
  return `${name} is waiting for ${TRIGGER_TEXT[id] ?? 'something you have not done yet'}.`;
}

/** What each person waits for, in the player's terms. */
const TRIGGER_TEXT: Readonly<Record<string, string>> = {
  rosa: 'a hearth in the lodge',
  orrin: 'your first bronze',
  mara: 'your first brush with magic (a shrine or an aspect vial)',
  bram: 'three neighbours already here',
  veyra: 'the distillery (glass and spirit)',
};

const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const;

/** "45 blocks north-east" from `from` to `to` (north is -Z, east is +X), or "right here" when close. */
export function whereIs(from: { x: number; z: number }, to: { x: number; z: number }): string {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.round(Math.hypot(dx, dz));
  if (dist < 4) return 'right here';
  const angle = (Math.atan2(dx, -dz) + 2 * Math.PI) % (2 * Math.PI);
  return `${dist} blocks ${DIRS[Math.round(angle / (Math.PI / 4)) % 8]}`;
}
